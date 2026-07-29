// @ts-nocheck
import { test } from "bun:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

test("game library", async () => {
  const { unzipSync, zipSync } = require("fflate");
  const installerPath = require.resolve("../site/js/game-installer.js");
  const libraryPath = require.resolve("../site/js/game-library.js");
  delete require.cache[installerPath];
  delete require.cache[libraryPath];
  const installer = require(installerPath);
  const library = require(libraryPath);

  class FakeCache {
    constructor() {
      this.values = new Map();
    }
    async put(key, response) {
      this.values.set(String(key), response);
    }
    async match(key) {
      const value = this.values.get(String(key.url || key));
      return value?.clone ? value.clone() : value || null;
    }
    async delete(key) {
      return this.values.delete(String(key.url || key));
    }
    async keys() {
      return [...this.values.keys()];
    }
  }

  class FakeStore {
    constructor() {
      this.values = new Map();
    }
    async list() {
      return [...this.values.values()];
    }
    async get(id) {
      return this.values.get(id);
    }
    async put(record) {
      this.values.set(record.id, record);
    }
    async delete(id) {
      this.values.delete(id);
    }
  }

  const uuid = "a2fb012a-b14c-6921-b688-403571e42bb0";
  const details = {
    uuid,
    title: "Bike Mania Arena",
    library: "Games",
    platform: "Flash",
    status: "Playable",
    applicationPath: "FPSoftware\\Flash\\flashplayer_32_sa.exe",
    downloadUrl: `https://flash.example/api/games/${uuid}/download`,
    logoUrl: `https://flash.example/api/games/${uuid}/logo`,
    launchCommand: "http://localflash/bikemaniaarena1/bike-mania-arena-1.swf",
    tags: ["Sports", "Racing"],
    compatible: true,
    packageType: "gamezip",
    legacyFallback: true,
  };
  const legacyUuid = "6ad53148-33c7-0fd0-9c7b-5baa815b752d";
  const legacyDetails = {
    ...details,
    uuid: legacyUuid,
    title: "Bike Mania 3 on Ice",
    packageType: "legacy",
    downloadUrl: `https://flash.example/api/games/${legacyUuid}/download`,
    logoUrl: `https://flash.example/api/games/${legacyUuid}/logo`,
    launchCommand: "http://localflash/bikemania3/bikemaniaonice.swf",
  };
  const gameZipBytes = zipSync({
    "content/localflash/bikemaniaarena1/bike-mania-arena-1.swf": new Uint8Array(
      [4, 5],
    ),
  });

  assert.equal(
    library.asGameConfig({
      ...details,
      iconPath: `https://flash.example/__installed-games/${uuid}/logo.jpg`,
    }).icon,
    details.logoUrl,
    "installed artwork should use the browser-loadable proxy URL",
  );

  const fetchObject = async (url) => {
    if (url === "/api/games?q=Bike%20Mania") {
      return new Response(JSON.stringify({ games: [details] }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.endsWith("/logo")) {
      return new Response(new Uint8Array([9]), {
        headers: { "Content-Type": "image/jpeg" },
      });
    }
    if (url.includes("/asset?")) {
      return new Response(new Uint8Array([6, 7]), {
        headers: { "Content-Type": "application/octet-stream" },
      });
    }
    if (url.endsWith("/download")) {
      const bytes = url.includes(legacyUuid)
        ? new Uint8Array([7, 8])
        : gameZipBytes;
      return new Response(bytes, {
        headers: { "Content-Length": String(bytes.byteLength) },
      });
    }
    return new Response(JSON.stringify(details), {
      headers: { "Content-Type": "application/json" },
    });
  };

  const cache = new FakeCache();
  const store = new FakeStore();
  const manager = library.createManager({
    installer,
    unzipSync,
    fetchObject,
    cacheObject: cache,
    metadataStore: store,
    storageManager: {
      persist: async () => true,
      estimate: async () => ({ usage: 0, quota: 1024 }),
    },
    origin: "https://flash.example",
  });

  assert.deepEqual(await manager.initialize(), {});
  const results = await manager.search("Bike Mania");
  assert.equal(results.length, 1);

  const installed = await manager.install(details);
  assert.equal(installed.id, `flashpoint:${uuid}`);
  assert.equal(installed.category, "Racing");
  assert.match(installed.base, /bikemaniaarena1\/$/);
  assert.equal(Object.keys(manager.getGames()).length, 1);

  const response = await manager.match(installed.url);
  assert(response);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [4, 5]);

  await manager.uninstall(uuid);
  assert.deepEqual(manager.getGames(), {});
  assert.equal(cache.values.size, 0);
  assert.equal(store.values.size, 0);

  const legacyCache = new FakeCache();
  const legacyStore = new FakeStore();
  const legacyManager = library.createManager({
    installer,
    unzipSync,
    fetchObject,
    cacheObject: legacyCache,
    metadataStore: legacyStore,
    storageManager: { persist: async () => true },
    origin: "https://flash.example",
  });
  await legacyManager.initialize();
  const legacyInstalled = await legacyManager.install(legacyDetails);
  assert.equal(legacyInstalled.id, `flashpoint:${legacyUuid}`);
  assert.deepEqual(
    [
      ...new Uint8Array(
        await (await legacyManager.match(legacyInstalled.url)).arrayBuffer(),
      ),
    ],
    [7, 8],
  );
  const lazyAsset = await legacyManager.match(
    "http://localflash/bikemania3/data/config.bin",
  );
  assert(lazyAsset);
  assert.deepEqual([...new Uint8Array(await lazyAsset.arrayBuffer())], [6, 7]);
  assert(
    legacyCache.values.has(
      `https://flash.example/__installed-games/${legacyUuid}/content/localflash/bikemania3/data/config.bin`,
    ),
  );
  const fetchCountBeforeAppRequest = legacyCache.values.size;
  assert.equal(
    await legacyManager.match("https://flash.example/js/runtime.wasm"),
    null,
  );
  assert.equal(legacyCache.values.size, fetchCountBeforeAppRequest);

  await assert.rejects(
    library.readDownload(
      new Response(new Uint8Array([1, 2]), {
        headers: { "Content-Length": "2" },
      }),
      { maxBytes: 1 },
    ),
    /larger/,
  );
});
