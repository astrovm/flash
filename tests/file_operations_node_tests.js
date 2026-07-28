"use strict";

const assert = require("assert");

const memoryStorage = new Map();
global.localStorage = {
    getItem: (key) => (memoryStorage.has(key) ? memoryStorage.get(key) : null),
    setItem: (key, value) => memoryStorage.set(key, String(value)),
    removeItem: (key) => memoryStorage.delete(key)
};

const fsPath = require.resolve("../site/js/filesystem.js");
const operationsPath = require.resolve("../site/js/file-operations.js");
delete require.cache[fsPath];
delete require.cache[operationsPath];
const fs = require(fsPath);
fs.resetForTests();
const operations = require(operationsPath);
operations.resetForTests();

const source = operations.createFolder(fs.MY_DOCUMENTS, "Source");
const nested = operations.createFolder(source.id, "Nested");
const note = operations.createFile(source.id, "note.txt", { content: "hello" });
const destination = operations.createFolder(fs.MY_DOCUMENTS, "Destination");

// Clipboard state and deterministic same-folder copies.
assert.strictEqual(operations.canPaste(destination.id), false);
operations.copy([source.id, nested.id]);
assert.deepStrictEqual(operations.getClipboard(), { mode: "copy", ids: [source.id] });
assert.strictEqual(operations.canPaste(destination.id), true);
const [copied] = operations.paste(destination.id);
assert.strictEqual(copied.name, "Source");
assert.strictEqual(fs.getChildren(copied.id).length, 2);
operations.copy([note.id]);
const [sameFolderCopy] = operations.paste(source.id);
assert.strictEqual(sameFolderCopy.name, "Copy of note.txt");

// Cut moves all requested top-level items and clears only after success.
operations.cut([note.id]);
assert.strictEqual(operations.canPaste(destination.id), true);
const [moved] = operations.paste(destination.id);
assert.strictEqual(moved.id, note.id);
assert.strictEqual(fs.getNode(note.id).parent, destination.id);
assert.strictEqual(operations.getClipboard(), null);
assert.throws(() => operations.paste(destination.id), /clipboard is empty/);

// Invalid destinations preserve a cut clipboard and the source node.
operations.cut([source.id]);
assert.strictEqual(operations.canPaste(nested.id), false);
assert.throws(() => operations.paste(nested.id), /into itself/);
assert.deepStrictEqual(operations.getClipboard(), { mode: "cut", ids: [source.id] });
assert.strictEqual(fs.getNode(source.id).parent, fs.MY_DOCUMENTS);

// Shared validation is used by create and rename.
assert.throws(() => operations.createFile(destination.id, "bad?.txt"), /invalid characters/);
assert.throws(() => operations.rename(note.id, "CON.txt"), /reserved device name/);

// Recycle Bin lifecycle is explicit and rejects accidental permanent deletes.
operations.removeToBin([note.id]);
assert.ok(fs.isInRecycleBin(note.id));
assert.throws(() => operations.removeToBin([note.id]), /cannot delete/);
const [restored] = operations.restore([note.id]);
assert.strictEqual(restored.id, note.id);
assert.strictEqual(fs.getNode(note.id).parent, destination.id);
operations.removeToBin([note.id]);
operations.permanentlyDelete([note.id]);
assert.strictEqual(fs.getNode(note.id), null);
assert.throws(() => operations.permanentlyDelete([source.id]), /not deletable/);

// Subscribers receive both clipboard and underlying filesystem changes.
let notifications = 0;
const unsubscribe = operations.subscribe(() => { notifications += 1; });
operations.copy([source.id]);
operations.createFile(destination.id, "ping.txt");
assert.ok(notifications >= 2);
unsubscribe();

operations.removeToBin([source.id]);
operations.emptyRecycleBin();
assert.strictEqual(fs.getChildren(fs.RECYCLE_BIN).length, 0);

(async () => {
    // ---- Conflict-aware paste decisions ----
    const conflictSource = operations.createFolder(fs.MY_DOCUMENTS, "Conflict Source");
    const conflictFile = operations.createFile(conflictSource.id, "same.txt", { content: "new" });
    const conflictFolder = operations.createFolder(conflictSource.id, "same-folder");
    const conflictTarget = operations.createFolder(fs.MY_DOCUMENTS, "Conflict Target");
    const existingFile = operations.createFile(conflictTarget.id, "same.txt", { content: "old" });
    operations.createFolder(conflictTarget.id, "same-folder");

    operations.copy([conflictFile.id]);
    const conflicts = operations.getConflicts([conflictFile.id], conflictTarget.id);
    assert.strictEqual(conflicts.length, 1);
    assert.strictEqual(conflicts[0].existing.id, existingFile.id);

    // Cancel is atomic and retains a cut clipboard for a later destination.
    operations.cut([conflictFile.id]);
    const cancelled = await operations.pasteWithConflicts(conflictTarget.id, () => "cancel");
    assert.strictEqual(cancelled.cancelled, true);
    assert.strictEqual(fs.getNode(conflictFile.id).parent, conflictSource.id);
    assert.deepStrictEqual(operations.getClipboard(), { mode: "cut", ids: [conflictFile.id] });

    // Replace overwrites only a conflicting file and completes the move.
    const replaced = await operations.pasteWithConflicts(conflictTarget.id, () => "replace");
    assert.strictEqual(replaced.cancelled, false);
    assert.strictEqual(fs.getNode(existingFile.id), null);
    assert.strictEqual(fs.getNode(conflictFile.id).parent, conflictTarget.id);
    assert.strictEqual(operations.getClipboard(), null);

    // Auto-rename leaves the original intact and uses VFS deterministic naming.
    const renameSource = operations.createFile(conflictSource.id, "same.txt", { content: "copy" });
    operations.copy([renameSource.id]);
    const renamed = await operations.pasteWithConflicts(conflictTarget.id, () => "rename");
    assert.strictEqual(renamed.results[0].name, "same (2).txt");
    assert.ok(fs.getNode(conflictFile.id));

    // Folder conflicts cannot replace an existing folder; auto-name remains safe.
    operations.copy([conflictFolder.id]);
    const folderResult = await operations.pasteWithConflicts(conflictTarget.id, () => "replace");
    assert.strictEqual(folderResult.results[0].name, "same-folder (2)");

    // Invalid decisions conservatively auto-rename rather than mutating the existing file.
    const invalidSource = operations.createFile(conflictSource.id, "same.txt", { content: "invalid" });
    operations.copy([invalidSource.id]);
    const invalidResult = await operations.pasteWithConflicts(conflictTarget.id, () => "unexpected");
    assert.ok(invalidResult.results[0].name.startsWith("same"));
    assert.ok(fs.getNode(conflictFile.id));

    // Protected/system destinations are rejected before resolver execution.
    let called = false;
    await assert.rejects(
        operations.pasteWithConflicts(fs.MY_COMPUTER, () => { called = true; return "rename"; }),
        /cannot accept new items/
    );
    assert.strictEqual(called, false);

    // Two conflict decisions are fully preflighted: a later cancel leaves
    // both existing files and both sources untouched.
    const atomicSource = operations.createFolder(fs.MY_DOCUMENTS, "Atomic Source");
    const atomicA = operations.createFile(atomicSource.id, "a.txt", { content: "a" });
    const atomicB = operations.createFile(atomicSource.id, "b.txt", { content: "b" });
    const atomicTarget = operations.createFolder(fs.MY_DOCUMENTS, "Atomic Target");
    const oldA = operations.createFile(atomicTarget.id, "a.txt", { content: "old a" });
    const oldB = operations.createFile(atomicTarget.id, "b.txt", { content: "old b" });
    operations.cut([atomicA.id, atomicB.id]);
    let decisions = 0;
    const atomicCancelled = await operations.pasteWithConflicts(atomicTarget.id, () => (++decisions === 1 ? "replace" : "cancel"));
    assert.strictEqual(atomicCancelled.cancelled, true);
    assert.ok(fs.getNode(oldA.id) && fs.getNode(oldB.id));
    assert.strictEqual(fs.getNode(atomicA.id).parent, atomicSource.id);
    assert.strictEqual(fs.getNode(atomicB.id).parent, atomicSource.id);
    assert.deepStrictEqual(operations.getClipboard(), { mode: "cut", ids: [atomicA.id, atomicB.id] });

    // Same-folder copy gets the normal deterministic Copy of name.
    operations.copy([atomicA.id]);
    const sameCopy = await operations.pasteWithConflicts(atomicSource.id, () => "rename");
    assert.strictEqual(sameCopy.results[0].name, "Copy of a.txt");

    // Same-folder cut is an explicit no-op and retains the clipboard.
    operations.cut([atomicB.id]);
    const sameCut = await operations.pasteWithConflicts(atomicSource.id, () => "replace");
    assert.strictEqual(sameCut.cancelled, false);
    assert.strictEqual(sameCut.results[0].id, atomicB.id);
    assert.deepStrictEqual(operations.getClipboard(), { mode: "cut", ids: [atomicB.id] });

    // Restore preflights every selection and accepts only items directly in
    // the Recycle Bin. A nested item cannot cause a partial mixed restore.
    const recycledFolder = operations.createFolder(fs.MY_DOCUMENTS, "Recycled Folder");
    const recycledChild = operations.createFile(recycledFolder.id, "nested.txt");
    const recycledDirect = operations.createFile(fs.MY_DOCUMENTS, "direct.txt");
    operations.removeToBin([recycledFolder.id, recycledDirect.id]);
    assert.throws(
        () => operations.restore([recycledDirect.id, recycledChild.id]),
        /top-level Recycle Bin items/
    );
    assert.strictEqual(fs.getNode(recycledDirect.id).parent, fs.RECYCLE_BIN);
    assert.strictEqual(fs.getNode(recycledChild.id).parent, recycledFolder.id);

    // If an item's original parent is still recycled, restoring only the item
    // uses Desktop rather than leaving it hidden inside the Recycle Bin.
    const fallbackFolder = operations.createFolder(fs.MY_DOCUMENTS, "Fallback Folder");
    const fallbackChild = operations.createFile(fallbackFolder.id, "fallback.txt");
    operations.removeToBin([fallbackChild.id]);
    operations.removeToBin([fallbackFolder.id]);
    operations.restore([fallbackChild.id]);
    assert.strictEqual(fs.getNode(fallbackChild.id).parent, fs.DESKTOP);
    assert.strictEqual(fs.isInRecycleBin(fallbackChild.id), false);

    // When both are selected, restore the ancestor first so the child can
    // return to its original folder in the same operation.
    const selectedFolder = operations.createFolder(fs.MY_DOCUMENTS, "Selected Folder");
    const selectedChild = operations.createFile(selectedFolder.id, "selected.txt");
    operations.removeToBin([selectedChild.id]);
    operations.removeToBin([selectedFolder.id]);
    operations.restore([selectedChild.id, selectedFolder.id]);
    assert.strictEqual(fs.getNode(selectedFolder.id).parent, fs.MY_DOCUMENTS);
    assert.strictEqual(fs.getNode(selectedChild.id).parent, selectedFolder.id);

    // Bin-level conflict names are temporary. Files with the same name from
    // different folders recover their original names on restore.
    const nameFolderA = operations.createFolder(fs.MY_DOCUMENTS, "Name A");
    const nameFolderB = operations.createFolder(fs.MY_DOCUMENTS, "Name B");
    const sameNameA = operations.createFile(nameFolderA.id, "same-name.txt");
    const sameNameB = operations.createFile(nameFolderB.id, "same-name.txt");
    operations.removeToBin([sameNameA.id, sameNameB.id]);
    assert.notStrictEqual(fs.getNode(sameNameA.id).name, fs.getNode(sameNameB.id).name);
    operations.restore([sameNameA.id, sameNameB.id]);
    assert.strictEqual(fs.getNode(sameNameA.id).name, "same-name.txt");
    assert.strictEqual(fs.getNode(sameNameB.id).name, "same-name.txt");
    assert.strictEqual(fs.getNode(sameNameA.id).originalName, null);
    assert.strictEqual(fs.getNode(sameNameB.id).originalName, null);

    // Progress cancellation after one item documents partial move behavior;
    // the cut clipboard remains available for the unprocessed source.
    operations.cut([atomicA.id, atomicB.id]);
    let stop = false;
    const partial = await operations.pasteWithConflicts(destination.id, () => "rename", {
        onProgress: () => { stop = true; },
        isCancelled: () => stop
    });
    assert.strictEqual(partial.cancelled, true);
    assert.strictEqual(partial.results.length, 1);
    assert.strictEqual(fs.getNode(atomicA.id).parent, destination.id);
    assert.strictEqual(fs.getNode(atomicB.id).parent, atomicSource.id);
    assert.deepStrictEqual(operations.getClipboard(), { mode: "cut", ids: [atomicB.id] });

    console.log("file operations tests passed");
})().catch((error) => {
    process.nextTick(() => { throw error; });
});
