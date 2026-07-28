"use strict";

// Node test suite for docs/js/filesystem.js, driven by
// tests/test_filesystem.py. Exits non-zero on the first failed assertion.

const assert = require("assert");

// localStorage shim so persistence can be exercised across module reloads.
const memoryStorage = new Map();
global.localStorage = {
    getItem: (key) => (memoryStorage.has(key) ? memoryStorage.get(key) : null),
    setItem: (key, value) => memoryStorage.set(key, String(value)),
    removeItem: (key) => memoryStorage.delete(key),
    clear: () => memoryStorage.clear()
};

const fsPath = require.resolve("../docs/js/filesystem.js");
const fs = require(fsPath);

// ---- Seed structure and well-known locations ----
assert.ok(fs.getNode(fs.MY_COMPUTER), "My Computer exists");
assert.ok(fs.getNode(fs.DESKTOP), "Desktop exists");
assert.ok(fs.getNode(fs.MY_DOCUMENTS), "My Documents exists");
assert.ok(fs.getNode(fs.MY_PICTURES), "My Pictures exists");
assert.ok(fs.getNode(fs.MY_MUSIC), "My Music exists");
assert.ok(fs.getNode(fs.DRIVE_C), "Local Disk exists");
assert.ok(fs.getNode(fs.RECYCLE_BIN), "Recycle Bin exists");
assert.strictEqual(fs.getChildren(fs.MY_COMPUTER).length, 2);

// ---- Paths ----
assert.strictEqual(fs.getPath(fs.DRIVE_C), "C:\\");
assert.strictEqual(
    fs.getPath(fs.MY_PICTURES),
    "C:\\Documents and Settings\\astro\\My Documents\\My Pictures"
);
assert.strictEqual(
    fs.resolvePath("C:\\Documents and Settings\\astro\\My Documents"),
    fs.MY_DOCUMENTS
);
assert.strictEqual(fs.resolvePath("c:\\documents and settings\\ASTRO\\desktop"), fs.DESKTOP);
assert.strictEqual(fs.resolvePath("C:\\does\\not\\exist"), null);
assert.strictEqual(fs.resolvePath("My Computer"), fs.MY_COMPUTER);

// ---- Windows-compatible name validation ----
assert.strictEqual(fs.validateName("notes.txt"), "notes.txt");
assert.strictEqual(fs.validateName("  notes.txt"), "notes.txt");
[
    "",
    "   ",
    ".",
    "..",
    "trailing.",
    "trailing ",
    "bad/name.txt",
    "bad:name.txt",
    "bad\u0000name.txt",
    "CON",
    "nul.txt",
    "COM1.log",
    "LPT9"
].forEach((name) => {
    assert.throws(() => fs.validateName(name), /VirtualFS:/, `rejects ${JSON.stringify(name)}`);
});

assert.throws(
    () => fs.createFolder(fs.MY_DOCUMENTS, "invalid?folder"),
    /invalid characters/
);

// ---- Create, timestamps, sizes ----
const folder = fs.createFolder(fs.MY_DOCUMENTS, "Test Folder");
assert.strictEqual(folder.type, "folder");
assert.strictEqual(folder.parent, fs.MY_DOCUMENTS);
assert.ok(folder.created > 0 && folder.modified > 0);

const file = fs.createFile(folder.id, "notes.txt", { content: "hello" });
assert.strictEqual(file.ext, ".txt");
assert.strictEqual(fs.getSize(file.id), 5);
assert.strictEqual(fs.getContent(file.id), "hello");
fs.setContent(file.id, "hello world");
assert.strictEqual(fs.getSize(file.id), 11);
assert.strictEqual(fs.getSize(folder.id), 11);

// ---- Rename and name deduplication ----
fs.rename(file.id, "todo.txt");
assert.strictEqual(fs.getNode(file.id).name, "todo.txt");
assert.throws(() => fs.rename(file.id, "AUX.txt"), /reserved device name/);
assert.strictEqual(fs.getNode(file.id).name, "todo.txt", "invalid rename leaves node unchanged");
const duplicate = fs.createFile(folder.id, "todo.txt");
assert.strictEqual(duplicate.name, "todo (2).txt");

// ---- Copy (recursive, "Copy of" in the same folder) ----
const folderCopy = fs.copy(folder.id, fs.MY_DOCUMENTS);
assert.strictEqual(folderCopy.name, "Copy of Test Folder");
assert.strictEqual(fs.getChildren(folderCopy.id).length, 2);
assert.notStrictEqual(fs.getChildren(folderCopy.id)[0].id, file.id);

// Copying into another folder keeps the name when there is no conflict.
const elsewhere = fs.copy(folder.id, fs.MY_PICTURES);
assert.strictEqual(elsewhere.name, "Test Folder");

// ---- Move with cycle protection ----
const subFolder = fs.createFolder(folder.id, "Sub");
assert.throws(() => fs.move(folder.id, subFolder.id), /into itself/);
assert.throws(() => fs.move(folder.id, folder.id), /into itself/);
assert.throws(() => fs.copy(folder.id, subFolder.id), /into itself/);
fs.move(subFolder.id, fs.MY_PICTURES);
assert.strictEqual(fs.getNode(subFolder.id).parent, fs.MY_PICTURES);

// ---- Protected system items ----
assert.throws(() => fs.remove(fs.MY_DOCUMENTS), /access is denied/);
assert.throws(() => fs.destroy(fs.DESKTOP), /access is denied/);
assert.throws(() => fs.rename(fs.DRIVE_C, "X"), /access is denied/);
assert.throws(() => fs.move(fs.MY_PICTURES, folder.id), /access is denied/);
assert.ok(fs.isProtected(fs.RECYCLE_BIN));

// ---- Delete to Recycle Bin, restore, permanent delete ----
fs.remove(folderCopy.id);
assert.ok(fs.isInRecycleBin(folderCopy.id));
assert.strictEqual(fs.getChildren(fs.RECYCLE_BIN).length, 1);
// My Pictures, My Music (seeded) and Test Folder remain.
assert.strictEqual(fs.getChildren(fs.MY_DOCUMENTS).length, 3);

fs.restore(folderCopy.id);
assert.ok(!fs.isInRecycleBin(folderCopy.id));
assert.strictEqual(fs.getNode(folderCopy.id).parent, fs.MY_DOCUMENTS);

// Deleting twice destroys permanently (second delete happens in the bin).
fs.remove(folderCopy.id);
fs.remove(folderCopy.id);
assert.ok(!fs.getNode(folderCopy.id));
assert.strictEqual(fs.getChildren(fs.RECYCLE_BIN).length, 0);

// ---- Empty Recycle Bin destroys recursively ----
fs.remove(folder.id);
assert.strictEqual(fs.getChildren(fs.RECYCLE_BIN).length, 1);
fs.emptyRecycleBin();
assert.strictEqual(fs.getChildren(fs.RECYCLE_BIN).length, 0);
assert.ok(!fs.getNode(folder.id), "folder destroyed");
assert.ok(!fs.getNode(file.id), "descendants destroyed too");

// ---- File associations ----
let openedWith = null;
fs.registerFileType(".game", (node) => {
    openedWith = node;
});
const gameFile = fs.createFile(fs.DESKTOP, "Doom.game", { app: "doom" });
assert.strictEqual(fs.open(gameFile.id), true);
assert.strictEqual(openedWith.id, gameFile.id);
const unknownFile = fs.createFile(fs.DESKTOP, "readme.xyz");
assert.strictEqual(fs.open(unknownFile.id), false);

// ---- Persistence across sessions ----
const persistent = fs.createFile(fs.MY_DOCUMENTS, "keep.txt", { content: "saved" });
delete require.cache[fsPath];
const reloaded = require(fsPath);
assert.strictEqual(reloaded.getContent(persistent.id), "saved");
assert.strictEqual(reloaded.getNode(persistent.id).parent, fs.MY_DOCUMENTS);
assert.ok(reloaded.getNode(fs.MY_PICTURES), "seed survives reload");

// ---- Change notifications ----
let notified = 0;
const unsubscribe = reloaded.subscribe(() => {
    notified += 1;
});
reloaded.createFile(fs.MY_DOCUMENTS, "ping.txt");
assert.ok(notified > 0, "listener fired");
unsubscribe();

console.log("filesystem tests passed");
