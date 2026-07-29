"use strict";

const assert = require("assert");
const installer = require("../site/js/game-installer.js");
const library = require("../site/js/game-library.js");

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
  launchCommand:
    "http://localflash/bikemaniaarena1/bike-mania-arena-1.swf",
  tags: ["Sports", "Racing"],
  compatible: true,
};

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
  if (url.endsWith("/download")) {
    return new Response(new Uint8Array([1, 2, 3]), {
      headers: { "Content-Length": "3" },
    });
  }
  return new Response(JSON.stringify(details), {
    headers: { "Content-Type": "application/json" },
  });
};

(async () => {
  const cache = new FakeCache();
  const store = new FakeStore();
  const manager = library.createManager({
    installer,
    unzipSync: () => ({
      "content/localflash/bikemaniaarena1/bike-mania-arena-1.swf":
        new Uint8Array([4, 5]),
    }),
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
  assert.deepEqual(
    [...new Uint8Array(await response.arrayBuffer())],
    [4, 5],
  );

  await manager.uninstall(uuid);
  assert.deepEqual(manager.getGames(), {});
  assert.equal(cache.values.size, 0);
  assert.equal(store.values.size, 0);

  await assert.rejects(
    library.readDownload(
      new Response(new Uint8Array([1, 2]), {
        headers: { "Content-Length": "2" },
      }),
      { maxBytes: 1 },
    ),
    /larger/,
  );

  console.log("game library tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
