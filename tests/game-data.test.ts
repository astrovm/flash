// @ts-nocheck
import { describe, expect, test } from "bun:test";
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

function createFixture() {
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
  return { root, scummvm, removedKeys, messages, manager };
}

describe("game data", () => {
  test("lists external game data without save databases", async () => {
    const { manager } = createFixture();
    expect(await manager.list()).toEqual([
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
  });

  test("removes a ScummVM CD image and its stored selection", async () => {
    const { scummvm, removedKeys, manager } = createFixture();
    await manager.remove("scummvm:peril");
    expect(scummvm.values.has("peril-one.iso")).toBe(false);
    expect(removedKeys).toContain("astro-flash.scummvm.peril.iso.v1");
  });

  test("removes temporary ScummVM files and their manifest", async () => {
    const { scummvm, manager } = createFixture();
    scummvm.values.set("pokus-temp.iso", new FakeFileHandle(700));
    scummvm.values.set("pokus-manifest.json", new FakeFileHandle(100));
    await manager.removeTemporary("scummvm:pokus", "pokus-temp.iso");
    expect(scummvm.values.has("pokus-temp.iso")).toBe(false);
    expect(scummvm.values.has("pokus-manifest.json")).toBe(false);
  });

  test("removes reVCDOS data and notifies the service worker", async () => {
    const { root, messages, manager } = createFixture();
    await manager.remove("revcdos");
    expect(root.values.has(gameData.REVCDOS_DIRECTORY)).toBe(false);
    expect(messages).toEqual([{ type: "REVCDOS_PACK_UPDATED" }]);
  });
});
