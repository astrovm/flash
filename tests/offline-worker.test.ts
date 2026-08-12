// @ts-nocheck
import { afterEach, expect, test } from "bun:test";
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

test("optional runtime assets prefer the network and fall back offline", async () => {
  const listeners = new Map();
  globalThis.self = {
    location: { origin: "https://flash.example" },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
  };
  const stale = new Response("stale runtime");
  globalThis.caches = {
    open: async () => ({ match: async () => stale.clone() }),
  };
  globalThis.fetch = async () => new Response("current runtime");
  require(workerPath);

  const request = new Request(
    "https://flash.example/vendor/boxedwine/26R1/boxedwine.12345678.wasm",
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
});
