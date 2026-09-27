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

describe("installer validation and storage failures", () => {
  test.each([
    [null, "record is required"],
    [{ ...record, uuid: "invalid" }, "Invalid game UUID"],
    [{ ...record, library: "Animations" }, "Games library"],
    [{ ...record, status: "Broken" }, "playable"],
    [{ ...record, applicationPath: "java" }, "Flash player"],
    [{ ...record, packageType: "exe" }, "package type"],
    [{ ...record, downloadUrl: "https://[" }, "Invalid download"],
    [{ ...record, launchCommand: "broken" }, "Invalid launch"],
    [
      { ...record, downloadUrl: "https://evil.example/game.zip" },
      "not allowed",
    ],
    [
      { ...record, downloadUrl: "http://download.unstable.life/file.zip" },
      "not allowed",
    ],
    [{ ...record, launchCommand: "file:///game.swf" }, "point to an SWF"],
    [
      { ...record, launchCommand: "https://games.example/game.exe" },
      "point to an SWF",
    ],
  ])("rejects an unsupported catalog record %#", (input, error) => {
    expect(() => loadInstaller().validateCatalogRecord(input)).toThrow(error);
  });
  test.each([
    null,
    "",
    "a\0b",
    "a\\b",
    "/etc/passwd",
    "C:game.swf",
    "content//main.swf",
    "./main.swf",
    "content/%ZZ",
    "content/%2Fgame",
    "content/%5cgame",
    "content/%3Fgame",
    "content/%23game",
  ])("rejects unsafe archive path %#", (path) => {
    expect(() => loadInstaller().safeArchivePath(path)).toThrow(
      "Unsafe ZIP entry",
    );
  });
  test("accepts legacy catalog aliases and normalizes IDs without changing encoded safe names", () => {
    const installer = loadInstaller();
    expect(
      installer.validateCatalogRecord({
        id: uuid.toUpperCase(),
        libraryName: "Games",
        platformName: "Flash",
        status: "Playable",
        applicationPaths: ["Flash", "Player"],
        gameZIP: "/api/game/download",
        command: record.launchCommand,
      }),
    ).toMatchObject({
      uuid,
      packageType: "gamezip",
      applicationPath: "Flash Player",
      downloadUrl: "https://astro.local/api/game/download",
    });
    expect(installer.safeArchivePath("content/game%20name/")).toBe(
      "content/game%20name/",
    );
    expect(
      installer
        .validateZipEntries({
          "content/a": { data: new Uint8Array([1]) },
          "content/b": { buffer: new Uint8Array([2]) },
        })
        .map((entry) => [...entry.bytes]),
    ).toEqual([[1], [2]]);
    expect(() => installer.validateZipEntries({ "content/a": {} })).toThrow(
      "does not contain bytes",
    );
  });
  test("validates installer dependencies before writing any files", async () => {
    const installer = loadInstaller(),
      { cache, deps } = createDeps(),
      zip = createGameZip();
    await expect(installer.install(record, null, deps)).rejects.toThrow(
      "Uint8Array",
    );
    await expect(
      installer.install(record, zip, { ...deps, unzip: null }),
    ).rejects.toThrow("ZIP reader");
    await expect(
      installer.install(record, zip, { ...deps, cache: { put() {} } }),
    ).rejects.toThrow("Cache dependency");
    await expect(
      installer.install(record, zip, { ...deps, store: {} }),
    ).rejects.toThrow("Metadata store");
    await expect(
      installer.install({ ...record, packageType: "legacy" }, zip, deps),
    ).rejects.toThrow("Legacy games");
    await expect(installer.installLegacy(record, null, deps)).rejects.toThrow(
      "Uint8Array",
    );
    await expect(
      installer.installLegacy(record, new Uint8Array([1]), {
        ...deps,
        cache: null,
      }),
    ).rejects.toThrow("Cache dependency");
    await expect(
      installer.installLegacy(record, new Uint8Array([1]), {
        ...deps,
        store: null,
      }),
    ).rejects.toThrow("Metadata store");
    await expect(
      installer.installLegacy(record, new Uint8Array([1]), deps),
    ).rejects.toThrow("Only Legacy");
    await expect(
      installer.uninstall(uuid, { ...deps, cache: null }),
    ).rejects.toThrow("Cache dependency");
    await expect(
      installer.uninstall(uuid, { ...deps, store: null }),
    ).rejects.toThrow("Metadata store");
    expect(cache.data.size).toBe(0);
  });
  test("supports set/remove metadata adapters and legacy Blob downloads, rolling back a failed metadata save", async () => {
    const installer = loadInstaller(),
      { cache, deps, stored } = createDeps();
    const store = {
      set: async (id, value) => stored.set(id, value),
      remove: async (id) => stored.delete(id),
    };
    const installed = await installer.installLegacy(
      { ...record, packageType: "legacy" },
      new Blob(["SWF bytes"]),
      { ...deps, store, responseFactory: undefined },
    );
    expect(await cache.data.get(installed.launchPath).text()).toBe("SWF bytes");
    expect(stored.get(installed.id).id).toBe(installed.id);
    await installer.uninstall(uuid, { ...deps, store });
    expect(cache.data.size).toBe(0);
    expect(stored.size).toBe(0);
    await expect(
      installer.installLegacy(
        { ...record, packageType: "legacy" },
        new Uint8Array([1]),
        {
          ...deps,
          store: {
            put: async () => {
              throw new Error("metadata unavailable");
            },
          },
        },
      ),
    ).rejects.toThrow("metadata unavailable");
    expect(cache.data.size).toBe(0);
  });
});
