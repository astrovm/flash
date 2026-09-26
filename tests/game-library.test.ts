// @ts-nocheck
import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { unzipSync, zipSync } = require("fflate");

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

function loadModules() {
  const installerPath = require.resolve("../site/js/game-installer.js");
  const libraryPath = require.resolve("../site/js/game-library.js");
  delete require.cache[installerPath];
  delete require.cache[libraryPath];
  return {
    installer: require(installerPath),
    library: require(libraryPath),
  };
}

function createFixture({
  storageManager = { persist: async () => true },
  cache = new FakeCache(),
} = {}) {
  const { installer, library } = loadModules();
  const gameZipBytes = zipSync({
    "content/localflash/bikemaniaarena1/bike-mania-arena-1.swf": new Uint8Array(
      [4, 5],
    ),
  });
  let assetRequests = 0;
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
      assetRequests++;
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
  const store = new FakeStore();
  const manager = library.createManager({
    installer,
    unzipSync,
    fetchObject,
    cacheObject: cache,
    metadataStore: store,
    storageManager,
    origin: "https://flash.example",
  });
  return {
    library,
    cache,
    store,
    manager,
    assetRequests: () => assetRequests,
  };
}

const unpersistedStorage = {
  persist: async () => {
    throw new Error("persistence unavailable");
  },
  estimate: async () => ({ usage: 1, quota: 1 }),
};

async function createInitializedFixture(options) {
  const fixture = createFixture(options);
  await fixture.manager.initialize();
  return fixture;
}

async function createLegacyFixture() {
  const fixture = await createInitializedFixture();
  fixture.legacyInstalled = await fixture.manager.install(legacyDetails);
  return fixture;
}

async function bytesOf(response) {
  return [...new Uint8Array(await response.arrayBuffer())];
}

function rewrite(library, id, url) {
  for (const [pattern, replacement] of library.assetRewriteRules(
    id,
    "https://flash.example",
  )) {
    if (pattern.test(url)) return url.replace(pattern, replacement);
  }
  return url;
}

describe("game library", () => {
  test("keeps only source metadata in the icon source registry", async () => {
    const sources = await Bun.file(
      new URL("../site/assets/icons/SOURCES.json", import.meta.url),
    ).json();
    for (const source of Object.values(sources)) {
      expect("notes" in source).toBe(false);
    }
  });

  test("uses the browser-loadable proxy URL for installed artwork", () => {
    const { library } = loadModules();
    expect(
      library.asGameConfig({
        ...details,
        iconPath: `https://flash.example/__installed-games/${uuid}/logo.jpg`,
      }).icon,
    ).toBe(details.logoUrl);
  });

  test("initializes with no games when persistence is unavailable", async () => {
    const { manager } = createFixture({ storageManager: unpersistedStorage });
    expect(await manager.initialize()).toEqual({});
  });

  test("searches the catalog", async () => {
    const { manager } = await createInitializedFixture({
      storageManager: unpersistedStorage,
    });
    const results = await manager.search("Bike Mania");
    expect(results).toHaveLength(1);
  });

  test("installs a game zip and registers it as a game", async () => {
    const { manager } = await createInitializedFixture({
      storageManager: unpersistedStorage,
    });
    const installed = await manager.install(details);
    expect(installed.id).toBe(`flashpoint:${uuid}`);
    expect(installed.category).toBe("Racing");
    expect(installed.base).toMatch(/bikemaniaarena1\/$/);
    expect(Object.keys(manager.getGames())).toHaveLength(1);
    expect(await manager.getInstallations()).toEqual([
      {
        id: `flashpoint:${uuid}`,
        uuid,
        title: details.title,
        bytes: 3,
      },
    ]);
  });

  test("serves installed game files from the cache", async () => {
    const { manager } = await createInitializedFixture({
      storageManager: unpersistedStorage,
    });
    const installed = await manager.install(details);
    const response = await manager.match(installed.url);
    expect(response).toBeInstanceOf(Response);
    expect(await bytesOf(response)).toEqual([4, 5]);
  });

  test("clears the game, cache and metadata on uninstall", async () => {
    const { manager, cache, store } = await createInitializedFixture({
      storageManager: unpersistedStorage,
    });
    await manager.install(details);
    await manager.uninstall(uuid);
    expect(manager.getGames()).toEqual({});
    expect(cache.values.size).toBe(0);
    expect(store.values.size).toBe(0);
  });

  test("reports the storage quota and rolls back when the cache is full", async () => {
    const quotaCache = new FakeCache();
    quotaCache.put = async () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    const { manager, store } = await createInitializedFixture({
      cache: quotaCache,
      storageManager: { estimate: async () => ({ usage: 1, quota: 1 }) },
    });
    await expect(manager.install(details)).rejects.toThrow(
      /actual storage quota/,
    );
    expect(quotaCache.values.size).toBe(0);
    expect(store.values.size).toBe(0);
  });

  test("installs legacy packages and serves the downloaded file", async () => {
    const { manager, legacyInstalled } = await createLegacyFixture();
    expect(legacyInstalled.id).toBe(`flashpoint:${legacyUuid}`);
    expect(await bytesOf(await manager.match(legacyInstalled.url))).toEqual([
      7, 8,
    ]);
  });

  test("fetches and caches missing legacy assets on demand", async () => {
    const { manager, cache } = await createLegacyFixture();
    const lazyAsset = await manager.match(
      "http://localflash/bikemania3/data/config.bin",
    );
    expect(lazyAsset).toBeInstanceOf(Response);
    expect(await bytesOf(lazyAsset)).toEqual([6, 7]);
    expect(
      cache.values.has(
        `https://flash.example/__installed-games/${legacyUuid}/content/localflash/bikemania3/data/config.bin`,
      ),
    ).toBe(true);
  });

  test("ignores requests for unrelated origins", async () => {
    const { manager, assetRequests } = await createLegacyFixture();
    const before = assetRequests();
    expect(
      await manager.match("https://unrelated.example/missing.bin"),
    ).toBeNull();
    expect(assetRequests()).toBe(before);
  });

  test("shares one asset download between concurrent requests", async () => {
    const { manager, assetRequests } = await createLegacyFixture();
    const before = assetRequests();
    const concurrent = await Promise.all([
      manager.match("http://localflash/bikemania3/shared.bin"),
      manager.match("http://localflash/bikemania3/shared.bin"),
    ]);
    expect(assetRequests()).toBe(before + 1);
    for (const result of concurrent)
      expect(await bytesOf(result)).toEqual([6, 7]);
  });

  test("scopes rewritten remote asset URLs to each game", () => {
    const { library } = loadModules();
    const remote = "https://cdn.example/shared.bin";
    const firstScoped = rewrite(library, legacyUuid, remote);
    const secondScoped = rewrite(library, uuid, remote);
    expect(firstScoped).not.toBe(secondScoped);
    expect(rewrite(library, legacyUuid, firstScoped)).toBe(firstScoped);
  });

  test("caches rewritten remote assets separately for each game", async () => {
    const { library, manager, cache } = await createLegacyFixture();
    await manager.install({ ...details, packageType: "legacy" });
    const remote = "https://cdn.example/shared.bin";
    const firstScoped = rewrite(library, legacyUuid, remote);
    const secondScoped = rewrite(library, uuid, remote);
    expect(await manager.match(firstScoped)).toBeInstanceOf(Response);
    expect(await manager.match(secondScoped)).toBeInstanceOf(Response);
    expect(
      cache.values.has(
        `https://flash.example/__installed-games/${legacyUuid}/content/cdn.example/shared.bin`,
      ),
    ).toBe(true);
    expect(
      cache.values.has(
        `https://flash.example/__installed-games/${uuid}/content/cdn.example/shared.bin`,
      ),
    ).toBe(true);
  });

  test("fetches ambiguous localflash assets only for a named game", async () => {
    const { manager, assetRequests, legacyInstalled } =
      await createLegacyFixture();
    await manager.install({ ...details, packageType: "legacy" });
    const before = assetRequests();
    expect(await manager.match("http://localflash/ambiguous.bin")).toBeNull();
    expect(assetRequests()).toBe(before);
    expect(
      await manager.match("http://localflash/scoped.bin", {
        gameId: legacyInstalled.id,
      }),
    ).toBeInstanceOf(Response);
    expect(assetRequests()).toBe(before + 1);
  });

  test("serves legacy assets without caching them when storage is full", async () => {
    const { manager, cache } = await createLegacyFixture();
    cache.put = async () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    const uncachedAsset = await manager.match(
      "http://localflash/bikemania3/data/optional.bin",
    );
    expect(uncachedAsset).toBeInstanceOf(Response);
    expect(await bytesOf(uncachedAsset)).toEqual([6, 7]);
    expect(
      cache.values.has(
        `https://flash.example/__installed-games/${legacyUuid}/content/localflash/bikemania3/data/optional.bin`,
      ),
    ).toBe(false);
  });

  test("ignores requests for the app's own files", async () => {
    const { manager, cache } = await createLegacyFixture();
    const sizeBefore = cache.values.size;
    expect(
      await manager.match("https://flash.example/js/runtime.wasm"),
    ).toBeNull();
    expect(cache.values.size).toBe(sizeBefore);
  });

  test("rejects downloads larger than the size limit", async () => {
    const { library } = loadModules();
    await expect(
      library.readDownload(
        new Response(new Uint8Array([1, 2]), {
          headers: { "Content-Length": "2" },
        }),
        { maxBytes: 1 },
      ),
    ).rejects.toThrow(/larger/);
  });
});
