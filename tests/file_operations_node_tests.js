"use strict";

const assert = require("assert");

const memoryStorage = new Map();
global.localStorage = {
    getItem: (key) => (memoryStorage.has(key) ? memoryStorage.get(key) : null),
    setItem: (key, value) => memoryStorage.set(key, String(value)),
    removeItem: (key) => memoryStorage.delete(key)
};

const fsPath = require.resolve("../docs/js/filesystem.js");
const operationsPath = require.resolve("../docs/js/file-operations.js");
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

console.log("file operations tests passed");
