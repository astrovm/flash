// @ts-nocheck -- Isolated browser globals exercise the actual IndexedDB backend.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { IDBFactory } from "fake-indexeddb";

const source = readFileSync(
  new URL("../site/js/filesystem.js", import.meta.url),
  "utf8",
);
const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};
const tab = (indexedDB, localStorage) => {
  const context = createContext({
    indexedDB,
    localStorage,
    document: {},
    console,
  });
  runInContext(source, context);
  return context.VirtualFS;
};
const request = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

test("migrates existing documents once and saves individual records without writing localStorage", async () => {
  const localStorage = storage();
  const oldContext = createContext({ localStorage, console });
  runInContext(source, oldContext);
  const old = oldContext.VirtualFS;
  const legacy = old.createFile(old.MY_DOCUMENTS, "existing.txt", {
    content: "old document",
  });
  const indexedDB = new IDBFactory();
  const first = tab(indexedDB, localStorage);
  await first.ready;
  expect(first.getContent(legacy.id)).toBe("old document");
  localStorage.setItem = () => {
    throw new Error("localStorage writes must not happen");
  };
  await first.setContent(legacy.id, "new document");
  first.close();
  const reopened = tab(indexedDB, localStorage);
  await reopened.ready;
  expect(reopened.getContent(legacy.id)).toBe("new document");
  const db = await request(indexedDB.open("astro-documents", 1));
  const records = await request(
    db.transaction("nodes").objectStore("nodes").getAll(),
  );
  expect(records.find((node) => node.id === legacy.id).revision).toBe(2);
  expect(records.find((node) => node.id === old.DRIVE_C).revision).toBe(1);
  reopened.close();
  db.close();
});

test("concurrent tab transactions reject stale writes without losing either tab's files", async () => {
  const indexedDB = new IDBFactory(),
    localStorage = storage();
  const a = tab(indexedDB, localStorage),
    b = tab(indexedDB, localStorage);
  await Promise.all([a.ready, b.ready]);
  const results = await Promise.allSettled([
    a.createFile(a.MY_DOCUMENTS, "a.txt", { content: "A" }),
    b.createFile(b.MY_DOCUMENTS, "b.txt", { content: "B" }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const loser = results[0].status === "rejected" ? a : b;
  const name = loser === a ? "a.txt" : "b.txt";
  await loser.createFile(loser.MY_DOCUMENTS, name, { content: name });
  const reopened = tab(indexedDB, localStorage);
  await reopened.ready;
  expect(reopened.findChild(reopened.MY_DOCUMENTS, "a.txt")).not.toBeNull();
  expect(reopened.findChild(reopened.MY_DOCUMENTS, "b.txt")).not.toBeNull();
  a.close();
  b.close();
  reopened.close();
});

test("aborted durable writes preserve committed content and report failure", async () => {
  const indexedDB = new IDBFactory(),
    localStorage = storage();
  const fs = tab(indexedDB, localStorage);
  await fs.ready;
  const file = await fs.createFile(fs.MY_DOCUMENTS, "notes.txt", {
    content: "saved",
  });
  const db = await request(indexedDB.open("astro-documents", 1));
  const prototype = Object.getPrototypeOf(
    db.transaction("nodes").objectStore("nodes"),
  );
  const put = prototype.put;
  prototype.put = function (value, ...args) {
    const result = put.call(this, value, ...args);
    if (value.content === "failed") this.transaction.abort();
    return result;
  };
  try {
    await expect(fs.setContent(file.id, "failed")).rejects.toThrow();
  } finally {
    prototype.put = put;
  }
  expect(fs.getContent(file.id)).toBe("saved");
  fs.close();
  db.close();
});

test("editor content preconditions reject overwrite after a refresh", async () => {
  const fs = tab(new IDBFactory(), storage());
  await fs.ready;
  const file = await fs.createFile(fs.MY_DOCUMENTS, "notes.txt", {
    content: "old",
  });
  await fs.setContent(file.id, "new", { expectedContent: "old" });
  await expect(
    fs.setContent(file.id, "stale", { expectedContent: "old" }),
  ).rejects.toThrow("changed in another window");
  expect(fs.getContent(file.id)).toBe("new");
  await fs.rename(file.id, "notes.txt");
  await fs.rename(file.id, "NOTES.txt");
  expect(fs.getNode(file.id).name).toBe("NOTES.txt");
  fs.close();
});
