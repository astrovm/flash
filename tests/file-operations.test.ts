// @ts-nocheck
import { beforeEach, describe, expect, test } from "bun:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const fsPath = require.resolve("../site/js/filesystem.js");
const operationsPath = require.resolve("../site/js/file-operations.js");

describe("file operations", () => {
  let fs;
  let operations;

  beforeEach(() => {
    const memoryStorage = new Map();
    global.localStorage = {
      getItem: (key) =>
        memoryStorage.has(key) ? memoryStorage.get(key) : null,
      setItem: (key, value) => memoryStorage.set(key, String(value)),
      removeItem: (key) => memoryStorage.delete(key),
    };

    delete require.cache[fsPath];
    delete require.cache[operationsPath];
    fs = require(fsPath);
    fs.resetForTests();
    operations = require(operationsPath);
    operations.resetForTests();
  });

  const createClipboardFixture = () => {
    const source = operations.createFolder(fs.MY_DOCUMENTS, "Source");
    const nested = operations.createFolder(source.id, "Nested");
    const note = operations.createFile(source.id, "note.txt", {
      content: "hello",
    });
    const destination = operations.createFolder(fs.MY_DOCUMENTS, "Destination");
    return { source, nested, note, destination };
  };

  const createConflictFixture = () => {
    const conflictSource = operations.createFolder(
      fs.MY_DOCUMENTS,
      "Conflict Source",
    );
    const conflictFile = operations.createFile(conflictSource.id, "same.txt", {
      content: "new",
    });
    const conflictFolder = operations.createFolder(
      conflictSource.id,
      "same-folder",
    );
    const conflictTarget = operations.createFolder(
      fs.MY_DOCUMENTS,
      "Conflict Target",
    );
    const existingFile = operations.createFile(conflictTarget.id, "same.txt", {
      content: "old",
    });
    operations.createFolder(conflictTarget.id, "same-folder");
    return {
      conflictSource,
      conflictFile,
      conflictFolder,
      conflictTarget,
      existingFile,
    };
  };

  const createAtomicFixture = () => {
    const atomicSource = operations.createFolder(
      fs.MY_DOCUMENTS,
      "Atomic Source",
    );
    const atomicA = operations.createFile(atomicSource.id, "a.txt", {
      content: "a",
    });
    const atomicB = operations.createFile(atomicSource.id, "b.txt", {
      content: "b",
    });
    const atomicTarget = operations.createFolder(
      fs.MY_DOCUMENTS,
      "Atomic Target",
    );
    const oldA = operations.createFile(atomicTarget.id, "a.txt", {
      content: "old a",
    });
    const oldB = operations.createFile(atomicTarget.id, "b.txt", {
      content: "old b",
    });
    return { atomicSource, atomicA, atomicB, atomicTarget, oldA, oldB };
  };

  test("tracks clipboard state and names same-folder copies deterministically", () => {
    const { source, nested, note, destination } = createClipboardFixture();

    expect(operations.canPaste(destination.id)).toBe(false);
    operations.copy([source.id, nested.id]);
    expect(operations.getClipboard()).toEqual({
      mode: "copy",
      ids: [source.id],
    });
    expect(operations.canPaste(destination.id)).toBe(true);
    const [copied] = operations.paste(destination.id);
    expect(copied.name).toBe("Source");
    expect(fs.getChildren(copied.id).length).toBe(2);
    operations.copy([note.id]);
    const [sameFolderCopy] = operations.paste(source.id);
    expect(sameFolderCopy.name).toBe("Copy of note.txt");
  });

  test("moves cut items on paste and clears the clipboard only after success", () => {
    const { note, destination } = createClipboardFixture();

    operations.cut([note.id]);
    expect(operations.canPaste(destination.id)).toBe(true);
    const [moved] = operations.paste(destination.id);
    expect(moved.id).toBe(note.id);
    expect(fs.getNode(note.id).parent).toBe(destination.id);
    expect(operations.getClipboard()).toBe(null);
    expect(() => operations.paste(destination.id)).toThrow(
      /clipboard is empty/,
    );
  });

  test("keeps a cut clipboard and its source when the destination is invalid", () => {
    const { source, nested } = createClipboardFixture();

    operations.cut([source.id]);
    expect(operations.canPaste(nested.id)).toBe(false);
    expect(() => operations.paste(nested.id)).toThrow(/into itself/);
    expect(operations.getClipboard()).toEqual({
      mode: "cut",
      ids: [source.id],
    });
    expect(fs.getNode(source.id).parent).toBe(fs.MY_DOCUMENTS);
  });

  test("validates names on create and rename", () => {
    const { note, destination } = createClipboardFixture();

    expect(() => operations.createFile(destination.id, "bad?.txt")).toThrow(
      /invalid characters/,
    );
    expect(() => operations.rename(note.id, "CON.txt")).toThrow(
      /reserved device name/,
    );
  });

  test("moves items through the Recycle Bin explicitly and rejects accidental permanent deletes", () => {
    const { source, destination } = createClipboardFixture();
    const note = operations.createFile(destination.id, "note.txt");

    operations.removeToBin([note.id]);
    expect(fs.isInRecycleBin(note.id)).toBeTruthy();
    expect(() => operations.removeToBin([note.id])).toThrow(/cannot delete/);
    const [restored] = operations.restore([note.id]);
    expect(restored.id).toBe(note.id);
    expect(fs.getNode(note.id).parent).toBe(destination.id);
    operations.removeToBin([note.id]);
    operations.permanentlyDelete([note.id]);
    expect(fs.getNode(note.id)).toBe(null);
    expect(() => operations.permanentlyDelete([source.id])).toThrow(
      /not deletable/,
    );

    operations.removeToBin([source.id]);
    operations.emptyRecycleBin();
    expect(fs.getChildren(fs.RECYCLE_BIN).length).toBe(0);
  });

  test("notifies subscribers of clipboard and filesystem changes", () => {
    const { source, destination } = createClipboardFixture();

    let notifications = 0;
    const unsubscribe = operations.subscribe(() => {
      notifications += 1;
    });
    operations.copy([source.id]);
    operations.createFile(destination.id, "ping.txt");
    expect(notifications >= 2).toBeTruthy();
    unsubscribe();
  });

  test("reports paste conflicts with existing items", () => {
    const { conflictFile, conflictTarget, existingFile } =
      createConflictFixture();

    operations.copy([conflictFile.id]);
    const conflicts = operations.getConflicts(
      [conflictFile.id],
      conflictTarget.id,
    );
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].existing.id).toBe(existingFile.id);
  });

  test("cancels a conflicting paste atomically and keeps the cut clipboard", async () => {
    const { conflictSource, conflictFile, conflictTarget } =
      createConflictFixture();

    operations.cut([conflictFile.id]);
    const cancelled = await operations.pasteWithConflicts(
      conflictTarget.id,
      () => "cancel",
    );
    expect(cancelled.cancelled).toBe(true);
    expect(fs.getNode(conflictFile.id).parent).toBe(conflictSource.id);
    expect(operations.getClipboard()).toEqual({
      mode: "cut",
      ids: [conflictFile.id],
    });
  });

  test("replaces only a conflicting file and completes the move", async () => {
    const { conflictFile, conflictTarget, existingFile } =
      createConflictFixture();

    operations.cut([conflictFile.id]);
    const replaced = await operations.pasteWithConflicts(
      conflictTarget.id,
      () => "replace",
    );
    expect(replaced.cancelled).toBe(false);
    expect(fs.getNode(existingFile.id)).toBe(null);
    expect(fs.getNode(conflictFile.id).parent).toBe(conflictTarget.id);
    expect(operations.getClipboard()).toBe(null);
  });

  test("auto-renames a conflicting copy and leaves the existing file intact", async () => {
    const { conflictFile, conflictTarget, existingFile } =
      createConflictFixture();

    operations.copy([conflictFile.id]);
    const renamed = await operations.pasteWithConflicts(
      conflictTarget.id,
      () => "rename",
    );
    expect(renamed.results[0].name).toBe("same (2).txt");
    expect(fs.getNode(existingFile.id)).toBeTruthy();
  });

  test("auto-names folder conflicts instead of replacing the existing folder", async () => {
    const { conflictFolder, conflictTarget } = createConflictFixture();

    operations.copy([conflictFolder.id]);
    const folderResult = await operations.pasteWithConflicts(
      conflictTarget.id,
      () => "replace",
    );
    expect(folderResult.results[0].name).toBe("same-folder (2)");
  });

  test("auto-renames on invalid decisions rather than mutating the existing file", async () => {
    const { conflictFile, conflictTarget, existingFile } =
      createConflictFixture();

    operations.copy([conflictFile.id]);
    const invalidResult = await operations.pasteWithConflicts(
      conflictTarget.id,
      () => "unexpected",
    );
    expect(invalidResult.results[0].name.startsWith("same")).toBeTruthy();
    expect(fs.getNode(existingFile.id)).toBeTruthy();
  });

  test("rejects protected destinations before running the resolver", async () => {
    const { conflictFile } = createConflictFixture();
    operations.copy([conflictFile.id]);

    let called = false;
    await expect(
      operations.pasteWithConflicts(fs.MY_COMPUTER, () => {
        called = true;
        return "rename";
      }),
    ).rejects.toThrow(/cannot accept new items/);
    expect(called).toBe(false);
  });

  test("preflights every conflict decision so a later cancel leaves everything untouched", async () => {
    const { atomicSource, atomicA, atomicB, atomicTarget, oldA, oldB } =
      createAtomicFixture();

    operations.cut([atomicA.id, atomicB.id]);
    let decisions = 0;
    const atomicCancelled = await operations.pasteWithConflicts(
      atomicTarget.id,
      () => (++decisions === 1 ? "replace" : "cancel"),
    );
    expect(atomicCancelled.cancelled).toBe(true);
    expect(fs.getNode(oldA.id) && fs.getNode(oldB.id)).toBeTruthy();
    expect(fs.getNode(atomicA.id).parent).toBe(atomicSource.id);
    expect(fs.getNode(atomicB.id).parent).toBe(atomicSource.id);
    expect(operations.getClipboard()).toEqual({
      mode: "cut",
      ids: [atomicA.id, atomicB.id],
    });
  });

  test('names a same-folder conflict-aware copy "Copy of"', async () => {
    const { atomicSource, atomicA } = createAtomicFixture();

    operations.copy([atomicA.id]);
    const sameCopy = await operations.pasteWithConflicts(
      atomicSource.id,
      () => "rename",
    );
    expect(sameCopy.results[0].name).toBe("Copy of a.txt");
  });

  test("treats a same-folder cut as a no-op and retains the clipboard", async () => {
    const { atomicSource, atomicB } = createAtomicFixture();

    operations.cut([atomicB.id]);
    const sameCut = await operations.pasteWithConflicts(
      atomicSource.id,
      () => "replace",
    );
    expect(sameCut.cancelled).toBe(false);
    expect(sameCut.results[0].id).toBe(atomicB.id);
    expect(operations.getClipboard()).toEqual({
      mode: "cut",
      ids: [atomicB.id],
    });
  });

  test("restores only top-level Recycle Bin items without partial restores", () => {
    const recycledFolder = operations.createFolder(
      fs.MY_DOCUMENTS,
      "Recycled Folder",
    );
    const recycledChild = operations.createFile(
      recycledFolder.id,
      "nested.txt",
    );
    const recycledDirect = operations.createFile(fs.MY_DOCUMENTS, "direct.txt");
    operations.removeToBin([recycledFolder.id, recycledDirect.id]);
    expect(() =>
      operations.restore([recycledDirect.id, recycledChild.id]),
    ).toThrow(/top-level Recycle Bin items/);
    expect(fs.getNode(recycledDirect.id).parent).toBe(fs.RECYCLE_BIN);
    expect(fs.getNode(recycledChild.id).parent).toBe(recycledFolder.id);
  });

  test("restores an item to the Desktop when its original folder is still recycled", () => {
    const fallbackFolder = operations.createFolder(
      fs.MY_DOCUMENTS,
      "Fallback Folder",
    );
    const fallbackChild = operations.createFile(
      fallbackFolder.id,
      "fallback.txt",
    );
    operations.removeToBin([fallbackChild.id]);
    operations.removeToBin([fallbackFolder.id]);
    operations.restore([fallbackChild.id]);
    expect(fs.getNode(fallbackChild.id).parent).toBe(fs.DESKTOP);
    expect(fs.isInRecycleBin(fallbackChild.id)).toBe(false);
  });

  test("restores a selected ancestor first so its child returns to its original folder", () => {
    const selectedFolder = operations.createFolder(
      fs.MY_DOCUMENTS,
      "Selected Folder",
    );
    const selectedChild = operations.createFile(
      selectedFolder.id,
      "selected.txt",
    );
    operations.removeToBin([selectedChild.id]);
    operations.removeToBin([selectedFolder.id]);
    operations.restore([selectedChild.id, selectedFolder.id]);
    expect(fs.getNode(selectedFolder.id).parent).toBe(fs.MY_DOCUMENTS);
    expect(fs.getNode(selectedChild.id).parent).toBe(selectedFolder.id);
  });

  test("restores original names after temporary Recycle Bin conflict names", () => {
    const nameFolderA = operations.createFolder(fs.MY_DOCUMENTS, "Name A");
    const nameFolderB = operations.createFolder(fs.MY_DOCUMENTS, "Name B");
    const sameNameA = operations.createFile(nameFolderA.id, "same-name.txt");
    const sameNameB = operations.createFile(nameFolderB.id, "same-name.txt");
    operations.removeToBin([sameNameA.id, sameNameB.id]);
    expect(fs.getNode(sameNameA.id).name).not.toBe(
      fs.getNode(sameNameB.id).name,
    );
    operations.restore([sameNameA.id, sameNameB.id]);
    expect(fs.getNode(sameNameA.id).name).toBe("same-name.txt");
    expect(fs.getNode(sameNameB.id).name).toBe("same-name.txt");
    expect(fs.getNode(sameNameA.id).originalName).toBe(null);
    expect(fs.getNode(sameNameB.id).originalName).toBe(null);
  });

  test("moves only processed items when progress is cancelled and keeps the rest on the clipboard", async () => {
    const { destination } = createClipboardFixture();
    const { atomicSource, atomicA, atomicB } = createAtomicFixture();

    operations.cut([atomicA.id, atomicB.id]);
    let stop = false;
    const partial = await operations.pasteWithConflicts(
      destination.id,
      () => "rename",
      {
        onProgress: () => {
          stop = true;
        },
        isCancelled: () => stop,
      },
    );
    expect(partial.cancelled).toBe(true);
    expect(partial.results.length).toBe(1);
    expect(fs.getNode(atomicA.id).parent).toBe(destination.id);
    expect(fs.getNode(atomicB.id).parent).toBe(atomicSource.id);
    expect(operations.getClipboard()).toEqual({
      mode: "cut",
      ids: [atomicB.id],
    });
  });
});
