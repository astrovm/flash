"use strict";
const assert = require("assert");
const installer = require("../site/js/game-installer.js");
const uuid = "a2fb012a-b14c-4921-b688-403571e42bb0";
const record = { uuid, library: "Games", platform: "Flash", status: "Playable", applicationPath: "Flash Player", downloadUrl: "https://download.unstable.life/gib-roms/Games/x.zip", launchCommand: "http://localflash/game/main.swf" };
assert.strictEqual(installer.archiveLaunchPath(record.launchCommand), "content/localflash/game/main.swf");
assert.doesNotThrow(() =>
  installer.validateCatalogRecord(
    {
      ...record,
      applicationPath: "FPSoftware\\Flash\\flashplayer_32_sa.exe",
      downloadUrl: "http://localhost:8000/api/games/example/download",
    },
    { origin: "http://localhost:8000" },
  ),
);
assert.throws(() => installer.validateCatalogRecord({ ...record, platform: "HTML5" }), /Flash/);
assert.throws(() => installer.safeArchivePath("../evil.swf"), /Unsafe/);
assert.throws(() => installer.validateZipEntries({ "content/a": new Uint8Array(2) }, { maxTotalBytes: 1 }), /too large/);

class Cache { constructor() { this.data = new Map(); } async put(k, v) { if (k.includes("fail")) throw Error("put failed"); this.data.set(k, v); } async delete(k) { return this.data.delete(k.url || k); } async keys() { return [...this.data.keys()]; } }
(async () => {
  const cache = new Cache(), stored = new Map();
  const deps = { origin: "https://flash.example", cache, store: { put: async (v) => stored.set(v.id, v), delete: async (k) => stored.delete(k) }, unzipSync: () => ({ "content/localflash/game/main.swf": new Uint8Array([1]), "content/localflash/game/data.txt": new Uint8Array([2]) }), responseFactory: (x) => x };
  const result = await installer.install(record, new Uint8Array([0]), deps);
  assert.strictEqual(result.launchPath, "https://flash.example/__installed-games/" + uuid + "/content/localflash/game/main.swf");
  assert.strictEqual(result.basePath, "https://flash.example/__installed-games/" + uuid + "/content/localflash/game/");
  assert.strictEqual(cache.data.size, 2); assert.strictEqual(stored.size, 1);
  await installer.uninstall(uuid, deps); assert.strictEqual(cache.data.size, 0); assert.strictEqual(stored.size, 0);
  const legacy = await installer.installLegacy(
    { ...record, packageType: "legacy", legacyFallback: true },
    new Uint8Array([7, 8]),
    deps,
  );
  assert.strictEqual(legacy.packageType, "legacy");
  assert.strictEqual(cache.data.size, 1);
  assert.deepStrictEqual(
    [...cache.data.get(legacy.launchPath)],
    [7, 8],
  );
  await installer.uninstall(uuid, deps);
  const failing = new Cache();
  await assert.rejects(installer.install(record, new Uint8Array([0]), { ...deps, cache: failing, unzipSync: () => ({ "content/localflash/game/main.swf": new Uint8Array([1]), "content/fail": new Uint8Array([2]) }) }), /put failed/);
  assert.strictEqual(failing.data.size, 0);
  console.log("game installer tests passed");
})().catch((error) => { console.error(error); process.exit(1); });
