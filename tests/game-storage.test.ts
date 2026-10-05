// @ts-nocheck -- Exercise browser storage boundaries with fake IndexedDB and OPFS.
import { expect, test } from "bun:test";
import { createRequire } from "node:module";
import { IDBFactory } from "fake-indexeddb";
const require = createRequire(import.meta.url);
const {
  createMetadataStore,
  readDownload,
  createTemporaryArchive,
  asGameConfig,
} = require("../site/js/game-library.js");
test("game metadata persists, reopens and deletes records in IndexedDB", async () => {
  const db = new IDBFactory();
  const store = await createMetadataStore(db);
  const record = { id: "one", title: "Game", bytes: 3 };
  expect(await store.list()).toEqual([]);
  await store.put(record);
  expect(await store.get("one")).toEqual(record);
  store.close();
  const reopened = await createMetadataStore(db);
  expect(await reopened.list()).toEqual([record]);
  await reopened.delete("one");
  expect(await reopened.get("one")).toBeUndefined();
  reopened.close();
  await expect(createMetadataStore(null)).rejects.toThrow("can't");
  await expect(
    createMetadataStore({
      open: () => {
        const request = {};
        queueMicrotask(() => request.onerror());
        return request;
      },
    }),
  ).rejects.toThrow("Can't open");
  expect(
    asGameConfig({
      id: "one",
      tags: [],
      launchPath: "/main.swf",
      basePath: "/",
    }),
  ).toMatchObject({
    title: "Installed Flash Game",
    category: "Downloaded Games",
    icon: null,
    url: "/main.swf",
  });
});
test("downloads check HTTP failures and streamed/non-streamed size limits", async () => {
  await expect(
    readDownload(new Response("missing", { status: 404 })),
  ).rejects.toThrow("404");
  const bytes = new Uint8Array([1, 2, 3]);
  const progress = [];
  const noStream = {
    ok: true,
    headers: new Headers(),
    arrayBuffer: async () => bytes.buffer,
  };
  expect(
    await readDownload(noStream, {
      onProgress: (value) => progress.push(value),
    }),
  ).toEqual(bytes);
  expect(progress).toEqual([{ loaded: 3, total: null }]);
  await expect(readDownload(noStream, { maxBytes: 2 })).rejects.toThrow(
    "too big",
  );
  await expect(
    readDownload(new Response(bytes), { maxBytes: 2 }),
  ).rejects.toThrow("too big");
  expect(
    await readDownload(
      new Response(bytes, { headers: { "content-length": "3" } }),
    ),
  ).toEqual(bytes);
});
function storage() {
  const data = [];
  let removed = 0,
    aborted = 0,
    closed = 0;
  const manager = {
    getDirectory: async () => ({
      getFileHandle: async () => ({
        createWritable: async () => ({
          write: async (bytes) => data.push(bytes),
          close: async () => {
            closed++;
          },
          abort: async () => {
            aborted++;
          },
        }),
        getFile: async () => new Blob(data),
      }),
      removeEntry: async () => {
        removed++;
      },
    }),
  };
  return { manager, counts: () => ({ removed, aborted, closed }) };
}
test("temporary game archives stream to OPFS and clean up on success, size failure and abort", async () => {
  const s = storage(),
    progress = [];
  const archive = await createTemporaryArchive(new Response("zip"), {
    storageManager: s.manager,
    onProgress: (value) => progress.push(value),
  });
  expect(await archive.blob.text()).toBe("zip");
  expect(progress[0].loaded).toBe(3);
  await archive.cleanup();
  expect(s.counts()).toEqual({ removed: 1, aborted: 0, closed: 1 });
  for (const failure of ["size", "no-body", "abort"]) {
    const f = storage(),
      controller = new AbortController();
    const response =
      failure === "no-body" ? new Response(null) : new Response("zip");
    await expect(
      createTemporaryArchive(response, {
        storageManager: f.manager,
        maxBytes: failure === "size" ? 2 : 100,
        signal: controller.signal,
        onProgress: () => {
          if (failure === "abort") controller.abort(new Error("cancelled"));
        },
      }),
    ).rejects.toThrow(
      failure === "size"
        ? "too big"
        : failure === "no-body"
          ? "download was empty"
          : "cancelled",
    );
    expect(f.counts().removed).toBe(1);
    expect(f.counts().aborted).toBe(1);
  }
  const early = storage(),
    controller = new AbortController();
  controller.abort(new Error("already cancelled"));
  await expect(
    createTemporaryArchive(new Response("zip"), {
      storageManager: early.manager,
      signal: controller.signal,
    }),
  ).rejects.toThrow("already cancelled");
  expect(early.counts().removed).toBe(1);
  await expect(
    createTemporaryArchive(new Response("", { status: 500 })),
  ).rejects.toThrow("500");
  await expect(
    createTemporaryArchive(
      new Response("zip", { headers: { "Content-Length": "999" } }),
      { maxBytes: 10 },
    ),
  ).rejects.toThrow("too big");
  await expect(
    createTemporaryArchive(new Response("zip"), { storageManager: {} }),
  ).rejects.toThrow("can't download games");
});
