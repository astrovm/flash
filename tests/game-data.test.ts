// @ts-nocheck
import { test } from "bun:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const gameData = require("../site/js/game-data.js");

class FakeFileHandle {
  kind = "file";
  constructor(size) {
    this.size = size;
  }
  async getFile() {
    return { size: this.size };
  }
}

class FakeDirectory {
  kind = "directory";
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
  }
  async getDirectoryHandle(name) {
    const value = this.values.get(name);
    if (!value || value.kind !== "directory") {
      throw Object.assign(new Error("Missing"), { name: "NotFoundError" });
    }
    return value;
  }
  async removeEntry(name) {
    if (!this.values.delete(name)) {
      throw Object.assign(new Error("Missing"), { name: "NotFoundError" });
    }
  }
  async *entries() {
    yield* this.values.entries();
  }
}

test("lists and removes external game data without save databases", async () => {
  const revcdos = new FakeDirectory({
    "manifest.json": new FakeFileHandle(100),
    "assets-current.bin": new FakeFileHandle(900),
  });
  const scummvm = new FakeDirectory({
    "peril-one.iso": new FakeFileHandle(500),
    "pokus-one.iso": new FakeFileHandle(600),
  });
  const root = new FakeDirectory({
    [gameData.REVCDOS_DIRECTORY]: revcdos,
    [gameData.SCUMMVM_DIRECTORY]: scummvm,
  });
  const removedKeys = [];
  const messages = [];
  const manager = gameData.createManager({
    storage: { getDirectory: async () => root },
    localStorageObject: { removeItem: (key) => removedKeys.push(key) },
    serviceWorker: {
      ready: Promise.resolve({
        active: { postMessage: (message) => messages.push(message) },
      }),
    },
  });

  assert.deepEqual(await manager.list(), [
    {
      id: "revcdos",
      title: "reVCDOS",
      detail: "Game data",
      bytes: 1000,
    },
    {
      id: "scummvm:peril",
      title: "The Pink Panther: Passport to Peril",
      detail: "CD image",
      bytes: 500,
    },
    {
      id: "scummvm:pokus",
      title: "The Pink Panther: Hokus Pokus Pink",
      detail: "CD image",
      bytes: 600,
    },
  ]);

  await manager.remove("scummvm:peril");
  assert.equal(scummvm.values.has("peril-one.iso"), false);
  assert(removedKeys.includes("astro-flash.scummvm.peril.iso.v1"));

  scummvm.values.set("pokus-temp.iso", new FakeFileHandle(700));
  scummvm.values.set("pokus-manifest.json", new FakeFileHandle(100));
  await manager.removeTemporary("scummvm:pokus", "pokus-temp.iso");
  assert.equal(scummvm.values.has("pokus-temp.iso"), false);
  assert.equal(scummvm.values.has("pokus-manifest.json"), false);

  await manager.remove("revcdos");
  assert.equal(root.values.has(gameData.REVCDOS_DIRECTORY), false);
  assert.deepEqual(messages, [{ type: "REVCDOS_PACK_UPDATED" }]);
});
