// @ts-nocheck
import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { unzipSync, zipSync } = require("fflate");

const uuid = "a2fb012a-b14c-4921-b688-403571e42bb0";
const record = {
  uuid,
  library: "Games",
  platform: "Flash",
  status: "Playable",
  applicationPath: "Flash Player",
  downloadUrl: "https://download.unstable.life/gib-roms/Games/x.zip",
  launchCommand: "http://localflash/game/main.swf",
};

class Cache {
  constructor() {
    this.data = new Map();
  }
  async put(k, v) {
    if (k.includes("fail")) throw Error("put failed");
    this.data.set(k, v);
  }
  async delete(k) {
    return this.data.delete(k.url || k);
  }
  async keys() {
    return [...this.data.keys()];
  }
}

function loadInstaller() {
  const installerPath = require.resolve("../site/js/game-installer.js");
  delete require.cache[installerPath];
  return require(installerPath);
}

function createGameZip() {
  return zipSync({
    "content/localflash/game/main.swf": new Uint8Array([1]),
    "content/localflash/game/data.txt": new Uint8Array([2]),
  });
}

function createDeps() {
  const cache = new Cache();
  const stored = new Map();
  const deps = {
    origin: "https://flash.example",
    cache,
    store: {
      put: async (v) => stored.set(v.id, v),
      delete: async (k) => stored.delete(k),
    },
    unzip: async (bytes) => unzipSync(bytes),
    responseFactory: (x) => x,
  };
  return { cache, stored, deps };
}

describe("game installer", () => {
  test("maps launch commands to archive content paths", () => {
    const installer = loadInstaller();
    expect(installer.archiveLaunchPath(record.launchCommand)).toBe(
      "content/localflash/game/main.swf",
    );
  });

  test("accepts Flash Player records downloaded from the configured origin", () => {
    const installer = loadInstaller();
    expect(() =>
      installer.validateCatalogRecord(
        {
          ...record,
          applicationPath: "FPSoftware\\Flash\\flashplayer_32_sa.exe",
          downloadUrl: "http://localhost:8000/api/games/example/download",
        },
        { origin: "http://localhost:8000" },
      ),
    ).not.toThrow();
  });

  test("rejects catalog records for platforms other than Flash", () => {
    const installer = loadInstaller();
    expect(() =>
      installer.validateCatalogRecord({ ...record, platform: "HTML5" }),
    ).toThrow(/Flash/);
  });

  test("rejects plain and percent-encoded path traversal", () => {
    const installer = loadInstaller();
    expect(() => installer.safeArchivePath("../evil.swf")).toThrow(/Unsafe/);
    expect(() => installer.safeArchivePath("%2e%2e/%2E./version.json")).toThrow(
      /Unsafe/,
    );
  });

  test("rejects archives whose entries exceed the size limit", () => {
    const installer = loadInstaller();
    expect(() =>
      installer.validateZipEntries(
        { "content/a": new Uint8Array(2) },
        { maxTotalBytes: 1 },
      ),
    ).toThrow(/too large/);
    expect(() =>
      installer.validateZipMetadata(
        zipSync({ "content/a": new Uint8Array(2) }),
        { maxTotalBytes: 1 },
      ),
    ).toThrow(/too large/);
  });

  test("installs a game zip into the cache and metadata store", async () => {
    const installer = loadInstaller();
    const { cache, stored, deps } = createDeps();
    const result = await installer.install(record, createGameZip(), deps);
    expect(result.launchPath).toBe(
      "https://flash.example/__installed-games/" +
        uuid +
        "/content/localflash/game/main.swf",
    );
    expect(result.basePath).toBe(
      "https://flash.example/__installed-games/" +
        uuid +
        "/content/localflash/game/",
    );
    expect(cache.data.size).toBe(2);
    expect(stored.size).toBe(1);
  });

  test("removes cached files on uninstall", async () => {
    const installer = loadInstaller();
    const { cache, deps } = createDeps();
    await installer.install(record, createGameZip(), deps);
    await installer.uninstall(uuid, deps);
    expect(cache.data.size).toBe(0);
  });

  test("rolls back an install that is aborted mid-way", async () => {
    const installer = loadInstaller();
    const { cache, stored, deps } = createDeps();
    const controller = new AbortController();
    await expect(
      installer.install(record, createGameZip(), {
        ...deps,
        signal: controller.signal,
        unzip: async (bytes) => {
          controller.abort();
          return unzipSync(bytes);
        },
      }),
    ).rejects.toThrow(/abort/i);
    expect(cache.data.size).toBe(0);
    expect(stored.size).toBe(0);
  });

  test("installs legacy packages as a single cached file", async () => {
    const installer = loadInstaller();
    const { cache, deps } = createDeps();
    const legacy = await installer.installLegacy(
      { ...record, packageType: "legacy", legacyFallback: true },
      new Uint8Array([7, 8]),
      deps,
    );
    expect(legacy.packageType).toBe("legacy");
    expect(cache.data.size).toBe(1);
    expect([...cache.data.get(legacy.launchPath)]).toEqual([7, 8]);
  });

  test("rolls back cached files when a cache write fails", async () => {
    const installer = loadInstaller();
    const { deps } = createDeps();
    const failing = new Cache();
    const failingZip = zipSync({
      "content/localflash/game/main.swf": new Uint8Array([1]),
      "content/fail": new Uint8Array([2]),
    });
    await expect(
      installer.install(record, failingZip, { ...deps, cache: failing }),
    ).rejects.toThrow(/put failed/);
    expect(failing.data.size).toBe(0);
  });
});
