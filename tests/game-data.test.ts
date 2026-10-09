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
  const re3 = new FakeDirectory({
    "manifest.json": new FakeFileHandle(10),
    "assets-current.bin": new FakeFileHandle(990),
  });
  const scummvm = new FakeDirectory({
    "peril-one.iso": new FakeFileHandle(500),
    "pokus-one.iso": new FakeFileHandle(600),
  });
  const root = new FakeDirectory({
    [gameData.REVCDOS_DIRECTORY]: revcdos,
    [gameData.RE3_DIRECTORY]: re3,
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
        title: "reVC",
        detail: "Game data",
        bytes: 1000,
      },
      { id: "re3", title: "re3", detail: "Game data", bytes: 1000 },
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

  test("removes re3 data and notifies the service worker", async () => {
    const { root, messages, manager } = createFixture();
    await manager.remove("re3");
    expect(root.values.has(gameData.RE3_DIRECTORY)).toBe(false);
    expect(root.values.has(gameData.REVCDOS_DIRECTORY)).toBe(true);
    expect(messages).toEqual([{ type: "RE3_PACK_UPDATED" }]);
    await manager.removeTemporary("re3");
  });

  test("removes reVCDOS data and notifies the service worker", async () => {
    const { root, messages, manager } = createFixture();
    await manager.remove("revcdos");
    expect(root.values.has(gameData.REVCDOS_DIRECTORY)).toBe(false);
    expect(messages).toEqual([{ type: "REVCDOS_PACK_UPDATED" }]);
  });
});

describe("game data edge cases", () => {
  const notFound = () =>
    Object.assign(new Error("Missing"), { name: "NotFoundError" });
  const locked = () => Object.assign(new Error("Locked"), { name: "Locked" });

  test("reports nothing without a storage manager and counts nested folders", async () => {
    expect(await gameData.createManager({ storage: null }).list()).toEqual([]);
    const nested = new FakeDirectory({
      "saves/": new FakeDirectory({ "save.bin": new FakeFileHandle(5) }),
      "manifest.json": new FakeFileHandle(1),
    });
    const scummvm = new FakeDirectory({
      "peril-empty.iso": new FakeFileHandle(0),
      "readme.txt": new FakeFileHandle(3),
    });
    const manager = gameData.createManager({
      storage: {
        getDirectory: async () =>
          new FakeDirectory({
            [gameData.REVCDOS_DIRECTORY]: nested,
            [gameData.SCUMMVM_DIRECTORY]: scummvm,
          }),
      },
    });
    expect(await manager.list()).toEqual([
      { id: "revcdos", title: "reVC", detail: "Game data", bytes: 6 },
    ]);
  });

  test("removes reVCDOS data without storage or a ready service worker", async () => {
    const messages = [];
    await gameData
      .createManager({
        storage: null,
        localStorageObject: null,
        serviceWorker: {
          ready: Promise.reject(new Error("no worker")),
          controller: { postMessage: (message) => messages.push(message) },
        },
      })
      .remove("revcdos");
    expect(messages).toEqual([{ type: "REVCDOS_PACK_UPDATED" }]);
    await gameData
      .createManager({
        storage: {
          getDirectory: async () => ({
            removeEntry: async () => {
              throw notFound();
            },
          }),
        },
        serviceWorker: null,
      })
      .removeTemporary("revcdos");
    await expect(
      gameData
        .createManager({
          storage: {
            getDirectory: async () => ({
              removeEntry: async () => {
                throw locked();
              },
            }),
          },
        })
        .remove("revcdos"),
    ).rejects.toThrow("Locked");
  });

  test("rejects unknown data and tolerates missing ScummVM folders", async () => {
    const empty = gameData.createManager({
      storage: { getDirectory: async () => new FakeDirectory() },
      localStorageObject: null,
    });
    await expect(empty.remove("unknown")).rejects.toThrow(
      "Unknown installed game data.",
    );
    await empty.remove("scummvm:peril");
    for (const [id, file] of [
      ["unknown", "peril-a.iso"],
      ["scummvm:peril", 42],
      ["scummvm:peril", "pokus-a.iso"],
      ["scummvm:peril", "peril-a/../x"],
    ])
      await expect(empty.removeTemporary(id, file)).rejects.toThrow(
        "Unknown temporary game data.",
      );
    await empty.removeTemporary("scummvm:peril", "peril-a.iso");
    await gameData
      .createManager({
        storage: {
          getDirectory: async () =>
            new FakeDirectory({
              [gameData.SCUMMVM_DIRECTORY]: new FakeDirectory(),
            }),
        },
      })
      .removeTemporary("scummvm:peril", "peril-a.iso");
    expect(await gameData.createManager().list()).toEqual([]);
  });

  test("keeps temporary files that cannot be removed", async () => {
    for (const failing of ["peril-a.iso", "peril-manifest.json"]) {
      const scummvm = new FakeDirectory({
        "peril-a.iso": new FakeFileHandle(1),
        "peril-manifest.json": new FakeFileHandle(1),
      });
      const remove = scummvm.removeEntry.bind(scummvm);
      scummvm.removeEntry = async (name) => {
        if (name === failing) throw locked();
        return remove(name);
      };
      const manager = gameData.createManager({
        storage: {
          getDirectory: async () =>
            new FakeDirectory({ [gameData.SCUMMVM_DIRECTORY]: scummvm }),
        },
      });
      await expect(
        manager.removeTemporary("scummvm:peril", "peril-a.iso"),
      ).rejects.toThrow("Locked");
    }
  });
});
