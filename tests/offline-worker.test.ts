// @ts-nocheck
import { afterEach, describe, expect, test } from "bun:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const workerPath = require.resolve("../site/js/offline-worker.js");
const originalSelf = globalThis.self;
const originalCaches = globalThis.caches;
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.self = originalSelf;
  globalThis.caches = originalCaches;
  globalThis.fetch = originalFetch;
  delete require.cache[workerPath];
});

describe("offline service worker", () => {
  test("prefers the network for optional runtime assets and falls back offline", async () => {
    const listeners = new Map();
    globalThis.self = {
      location: { origin: "https://flash.example" },
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
    };
    const stale = new Response("stale runtime");
    // Downloads are stored without the release prefix, so a file saved
    // before an update is still found under the new release's URL.
    globalThis.caches = {
      open: async () => ({
        match: async (key) =>
          key ===
          "https://flash.example/vendor/boxedwine/26R1/boxedwine.12345678.wasm"
            ? stale.clone()
            : undefined,
      }),
    };
    globalThis.fetch = async () => new Response("current runtime");
    require(workerPath);

    const request = new Request(
      "https://flash.example/releases/26.08.01-1234567/vendor/boxedwine/26R1/boxedwine.12345678.wasm",
    );
    let responsePromise;
    listeners.get("fetch")({
      request,
      respondWith(promise) {
        responsePromise = promise;
      },
    });
    expect(await (await responsePromise).text()).toBe("current runtime");

    globalThis.fetch = async () => {
      throw new TypeError("offline");
    };
    listeners.get("fetch")({
      request,
      respondWith(promise) {
        responsePromise = promise;
      },
    });
    expect(await (await responsePromise).text()).toBe("stale runtime");

    globalThis.fetch = async () => new Response("gone", { status: 404 });
    listeners.get("fetch")({
      request,
      respondWith(promise) {
        responsePromise = promise;
      },
    });
    expect(await (await responsePromise).text()).toBe("stale runtime");

    const uncached = new Request(
      "https://flash.example/releases/26.08.01-1234567/swf/missing.swf",
    );
    listeners.get("fetch")({
      request: uncached,
      respondWith(promise) {
        responsePromise = promise;
      },
    });
    expect((await responsePromise).status).toBe(404);
  });
});

const originalNavigator = Object.getOwnPropertyDescriptor(
  globalThis,
  "navigator",
);
afterEach(() => {
  if (originalNavigator)
    Object.defineProperty(globalThis, "navigator", originalNavigator);
});
function packedWorker() {
  const listeners = new Map(),
    files = new Map();
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      storage: {
        getDirectory: async () => ({
          getDirectoryHandle: async (name) => ({
            getFileHandle: async (file) => ({
              getFile: async () => {
                const data = files.get(`${name}/${file}`);
                if (!data) throw new Error("not stored");
                return data;
              },
            }),
          }),
        }),
      },
    },
  });
  globalThis.self = {
    location: { origin: "https://flash.example" },
    addEventListener: (type, cb) => listeners.set(type, cb),
  };
  delete require.cache[workerPath];
  require(workerPath);
  return {
    files,
    put: (name, value) =>
      files.set(
        name,
        new Blob([typeof value === "string" ? value : JSON.stringify(value)]),
      ),
    notify: (data) => listeners.get("message")({ data }),
    request: (path, options = {}) => {
      let response;
      listeners.get("fetch")({
        request: new Request(
          path.startsWith("http") ? path : `https://flash.example${path}`,
          options,
        ),
        respondWith: (p) => {
          response = p;
        },
      });
      return response;
    },
  };
}
test("packed reVCDOS assets normalize paths, serve byte ranges, invalidate and reject broken storage", async () => {
  const h = packedWorker(),
    root = "astro-flash-revcdos/";
  const manifest = {
    version: 1,
    dataFile: "pack.bin",
    size: 10,
    files: { "vc-assets/local/data.bin": { offset: 2, length: 6 } },
  };
  h.put(root + "manifest.json", manifest);
  h.put(root + "pack.bin", "0123456789");
  const path = "/releases/v1/iframe/revcdos/local-assets/fetched/DATA.bin";
  expect(await (await h.request(path)).text()).toBe("234567");
  for (const [range, expected, header] of [
    ["bytes=1-3", "345", "bytes 1-3/6"],
    ["bytes=3-", "567", "bytes 3-5/6"],
    ["bytes=-2", "67", "bytes 4-5/6"],
    ["bytes=0-99", "234567", "bytes 0-5/6"],
  ]) {
    const res = await h.request(path, { headers: { range } });
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe(header);
    expect(await res.text()).toBe(expected);
  }
  expect(
    await (
      await h.request(
        path.replace("fetched/DATA.bin", "vcsky/fetched/data.bin"),
      )
    ).text(),
  ).toBe("234567");
  for (const range of [
    "bytes=99-100",
    "bytes=4-1",
    "bytes=-0",
    "bytes=1-2,4-5",
    "invalid",
  ])
    expect((await h.request(path, { headers: { range } })).status).toBe(416);
  expect((await h.request(path.replace("DATA.bin", "missing"))).status).toBe(
    404,
  );
  h.put(root + "pack.bin", "short");
  h.notify({ type: "REVCDOS_PACK_UPDATED" });
  expect((await h.request(path)).status).toBe(503);
  h.put(root + "manifest.json", { version: 2 });
  expect((await h.request(path)).status).toBe(503);
  h.put(root + "manifest.json", manifest);
  h.put(root + "pack.bin", "abcdefghij");
  expect(await (await h.request(path)).text()).toBe("cdefgh");
});
test("ScummVM game files expose the index and safe ISO slices, refresh and reject invalid entries", async () => {
  const h = packedWorker(),
    root = "astro-flash-scummvm/",
    path = "/releases/v1/iframe/scummvm/local-games/game/";
  const manifest = {
    version: 1,
    isoFile: "game.iso",
    isoSize: 10,
    files: {
      "DATA.DAT": { offset: 2, size: 4 },
      "BAD.DAT": { offset: 99, size: 1 },
    },
  };
  h.put(root + "game-manifest.json", manifest);
  h.put(root + "game.iso", "0123456789");
  expect(await (await h.request(path + "index.json")).json()).toEqual({
    "DATA.DAT": 4,
    "BAD.DAT": 1,
  });
  const data = await h.request(path + "data.dat");
  expect(data.headers.get("Content-Length")).toBe("4");
  expect(await data.text()).toBe("2345");
  for (const name of ["missing", "BAD.DAT"])
    expect((await h.request(path + name)).status).toBe(404);
  expect((await h.request(path.replace("game/", "missing"))).status).toBe(404);
  h.put(root + "game.iso", "short");
  h.notify({ type: "SCUMMVM_GAME_UPDATED", gameId: "game" });
  expect((await h.request(path + "DATA.DAT")).status).toBe(503);
  h.put(root + "game-manifest.json", { version: 2 });
  expect((await h.request(path + "DATA.DAT")).status).toBe(503);
  h.put(root + "game-manifest.json", manifest);
  h.put(root + "game.iso", "abcdefghij");
  expect(await (await h.request(path + "DATA.DAT")).text()).toBe("cdef");
  h.notify({ type: "unrelated" });
});
test("worker ignores non-GET, cross-origin and unversioned requests and propagates uncached offline failures", async () => {
  const h = packedWorker();
  for (const [path, options] of [
    ["/releases/v1/swf/a.swf", { method: "POST" }],
    ["https://other.example/releases/v1/swf/a.swf", {}],
    ["/swf/a.swf", {}],
    ["/releases/v1/css/main.css", {}],
  ])
    expect(h.request(path, options)).toBeUndefined();
  globalThis.caches = { open: async () => ({ match: async () => undefined }) };
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  await expect(
    h.request("/releases/v1/js/core.ruffle.hash.js"),
  ).rejects.toThrow("offline");
});
