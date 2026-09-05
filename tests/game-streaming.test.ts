// @ts-nocheck -- Dependencies are injected into the browser installer.
import { expect, test } from "bun:test";
import { createRequire } from "node:module";
import { zipSync, AsyncInflate } from "fflate";
const require = createRequire(import.meta.url);
const installer = require("../site/js/game-installer.js");
const library = require("../site/js/game-library.js");
const record = {
  uuid: "a2fb012a-b14c-4921-b688-403571e42bb0",
  library: "Games",
  platform: "Flash",
  status: "Playable",
  applicationPath: "Flash Player",
  downloadUrl: "https://flash.example/api/game/download",
  launchCommand: "https://game.example/main.swf",
};
const makeDependencies = () => {
  const cached = new Map(),
    metadata = new Map();
  return {
    cached,
    metadata,
    dependencies: {
      origin: "https://flash.example",
      Inflate: AsyncInflate,
      cache: {
        async put(key, response) {
          cached.set(key, new Uint8Array(await response.arrayBuffer()));
        },
        async delete(key) {
          cached.delete(key);
        },
      },
      store: {
        async put(value) {
          metadata.set(value.id, value);
        },
      },
    },
  };
};

test("extracts stored and deflated files in bounded reads and commits only after cache writes", async () => {
  for (const level of [0, 6]) {
    const main = new Uint8Array(200_000).fill(42),
      asset = new Uint8Array([1, 2, 3]);
    const zip = zipSync(
      {
        "content/game.example/main.swf": main,
        "content/cdn.example/asset.bin": asset,
      },
      { level },
    );
    const archive = new Blob([zip]);
    const reads = [];
    const blob = {
      size: archive.size,
      slice(...args) {
        const part = archive.slice(...args);
        reads.push(part.size);
        return part;
      },
    };
    const { cached, metadata, dependencies } = makeDependencies();
    const result = await installer.installStream(record, blob, dependencies);
    expect(cached.get(result.launchPath)).toEqual(main);
    expect(Math.max(...reads)).toBeLessThanOrEqual(65557);
    expect(cached.size).toBe(2);
    expect(metadata.size).toBe(1);
  }
});

test("rejects corruption and rolls back incomplete cache entries", async () => {
  const zip = zipSync(
    { "content/game.example/main.swf": new Uint8Array([1, 2, 3]) },
    { level: 0 },
  );
  const view = new DataView(zip.buffer);
  const start = 30 + view.getUint16(26, true) + view.getUint16(28, true);
  zip[start] ^= 255;
  const { cached, metadata, dependencies } = makeDependencies();
  await expect(
    installer.installStream(record, new Blob([zip]), dependencies),
  ).rejects.toThrow("corrupt");
  expect(cached.size).toBe(0);
  expect(metadata.size).toBe(0);
});

test("checks declared limits before extraction and cancels during cache writes", async () => {
  const zip = zipSync(
    { "content/game.example/main.swf": new Uint8Array(50_000) },
    { level: 0 },
  );
  const { cached, metadata, dependencies } = makeDependencies();
  await expect(
    installer.installStream(record, new Blob([zip]), {
      ...dependencies,
      limits: { maxFileBytes: 1 },
    }),
  ).rejects.toThrow("too large");
  const controller = new AbortController();
  dependencies.cache.put = async (key, response) => {
    const reader = response.body.getReader();
    await reader.read();
    controller.abort();
    try {
      while (!(await reader.read()).done) {
        /* Drain until cancellation rejects. */
      }
    } finally {
      reader.releaseLock();
    }
    cached.set(key, true);
  };
  await expect(
    installer.installStream(record, new Blob([zip]), {
      ...dependencies,
      signal: controller.signal,
    }),
  ).rejects.toThrow();
  expect(cached.size).toBe(0);
  expect(metadata.size).toBe(0);
});

test("temporary downloads apply backpressure, enforce limits, and delete files on failure", async () => {
  const files = new Map();
  let writes = 0,
    removed = 0;
  const storageManager = {
    async getDirectory() {
      return {
        async getFileHandle(name) {
          files.set(name, []);
          return {
            async createWritable() {
              return {
                async write(chunk) {
                  writes++;
                  files.get(name).push(chunk.slice());
                },
                async close() {},
                async abort() {},
              };
            },
            async getFile() {
              return new Blob(files.get(name));
            },
          };
        },
        async removeEntry(name) {
          removed++;
          files.delete(name);
        },
      };
    },
  };
  const response = () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2]));
          controller.enqueue(new Uint8Array([3, 4]));
          controller.close();
        },
      }),
    );
  const progress = [];
  const archive = await library.createTemporaryArchive(response(), {
    onProgress: (value) => progress.push(value.loaded),
    storageManager,
    maxBytes: 4,
  });
  expect(progress).toEqual([2, 4]);
  expect(archive.blob.size).toBe(4);
  expect(writes).toBe(2);
  await archive.cleanup();
  expect(files.size).toBe(0);
  await expect(
    library.createTemporaryArchive(response(), { storageManager, maxBytes: 3 }),
  ).rejects.toThrow("download limit");
  expect(files.size).toBe(0);
  expect(removed).toBe(2);
});
