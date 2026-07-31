// @ts-nocheck
import { test } from "bun:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

test("offline updates", async () => {
  const offlinePath = require.resolve("../site/js/offline.js");
  delete require.cache[offlinePath];
  const {
    BUNDLED_GAME_CACHE,
    createManager,
    validateGameManifest,
    waitForWorker,
  } = require(offlinePath);

  class Events {
    constructor() {
      this.listeners = new Map();
    }
    addEventListener(name, listener) {
      if (!this.listeners.has(name)) this.listeners.set(name, new Set());
      this.listeners.get(name).add(listener);
    }
    removeEventListener(name, listener) {
      this.listeners.get(name)?.delete(listener);
    }
    dispatch(name) {
      this.listeners.get(name)?.forEach((listener) => listener());
    }
  }

  class Worker extends Events {
    constructor(state = "activated", version = null) {
      super();
      this.state = state;
      this.version = version;
      this.messages = [];
    }
    transition(state) {
      this.state = state;
      this.dispatch("statechange");
    }
    postMessage(message, ports = []) {
      if (message.type === "GET_VERSION") {
        if (this.version) ports[0]?.postMessage({ version: this.version });
        return;
      }
      this.messages.push(message);
    }
  }

  class Registration extends Events {
    constructor({ active = null, installing = null, waiting = null } = {}) {
      super();
      this.active = active;
      this.installing = installing;
      this.waiting = waiting;
      this.updateCalls = 0;
      this.unregisterCalls = 0;
    }
    async update() {
      this.updateCalls += 1;
    }
    async unregister() {
      this.unregisterCalls += 1;
    }
  }

  class MemoryStorage {
    constructor(values = {}) {
      this.values = new Map(Object.entries(values));
    }
    getItem(key) {
      return this.values.get(key) ?? null;
    }
    setItem(key, value) {
      this.values.set(key, String(value));
    }
    removeItem(key) {
      this.values.delete(key);
    }
  }

  class MemoryCache {
    constructor() {
      this.values = new Map();
    }
    async put(key, response) {
      this.values.set(String(key), response);
    }
    async delete(key) {
      return this.values.delete(String(key));
    }
  }

  const manifest = {
    version: "26.07.29-aaaaaaa",
    runtime: {
      revision: "runtime-1",
      bytes: 10,
      files: [{ url: "js/runtime.wasm", bytes: 10 }],
    },
    runtimes: {
      scummvm: {
        revision: "scummvm-1",
        bytes: 8,
        files: [{ url: "vendor/scummvm/scummvm.wasm", bytes: 8 }],
      },
    },
    games: {
      "bike-mania": {
        revision: "bike-1",
        type: "swf",
        bytes: 4,
        files: [{ url: "swf/bike-mania/main.swf", bytes: 4 }],
      },
      doom: {
        revision: "doom-1",
        type: "iframe",
        bytes: 6,
        files: [
          { url: "iframe/doom/index.html", bytes: 2 },
          { url: "dos/doom/doom.jsdos", bytes: 4 },
        ],
      },
      "pink-panther-passport-to-peril": {
        revision: "peril-1",
        runtime: "scummvm",
        type: "iframe",
        bytes: 2,
        files: [
          {
            url: "iframe/pink-panther-passport-to-peril/index.html",
            bytes: 2,
          },
        ],
      },
      "pink-panther-hokus-pokus": {
        revision: "pokus-1",
        runtime: "scummvm",
        type: "iframe",
        bytes: 2,
        files: [
          {
            url: "iframe/pink-panther-hokus-pokus/index.html",
            bytes: 2,
          },
        ],
      },
    },
  };

  const makeEnvironment = ({
    registration = new Registration({
      active: new Worker("activated", manifest.version),
    }),
    remoteVersion = "26.07.29-aaaaaaa",
    storageValues = {},
    sessionValues = {},
  } = {}) => {
    const serviceWorker = new Events();
    serviceWorker.controller = registration.active;
    serviceWorker.registerCalls = [];
    serviceWorker.register = async (...args) => {
      serviceWorker.registerCalls.push(args);
      return registration;
    };
    serviceWorker.getRegistration = async () => registration;
    serviceWorker.ready = Promise.resolve(registration);
    const bundledCache = new MemoryCache();
    const shellCache = new MemoryCache();
    const deletedCaches = [];
    const storage = new MemoryStorage({
      astroFlashLastUpdateCheck: "1800000000000",
      ...storageValues,
    });
    const sessionStorage = new MemoryStorage(sessionValues);
    let reloads = 0;
    const environment = new Events();
    Object.assign(environment, {
      navigator: {
        onLine: true,
        serviceWorker,
        storage: {
          estimate: async () => ({ usage: 100, quota: 10_000 }),
        },
      },
      localStorage: storage,
      sessionStorage,
      MessageChannel,
      location: {
        href: "https://flash.example/",
        origin: "https://flash.example",
        reload: () => {
          reloads += 1;
        },
      },
      Date: { now: () => 1_800_000_000_000 },
      document: Object.assign(new Events(), { visibilityState: "visible" }),
      caches: {
        keys: async () => ["astro-flash-precache", BUNDLED_GAME_CACHE],
        open: async (name) =>
          name === BUNDLED_GAME_CACHE ? bundledCache : shellCache,
        delete: async (name) => {
          deletedCaches.push(name);
          if (name === BUNDLED_GAME_CACHE) bundledCache.values.clear();
          return true;
        },
      },
      fetch: async (url, options) => {
        assert.strictEqual(options.cache, "no-store");
        if (String(url).startsWith("version.json")) {
          return new Response(
            JSON.stringify({
              version: remoteVersion,
              revision: remoteVersion.split("-").at(-1),
              offlineBytes: 8_000_000,
              bundledGameBytes: 10,
            }),
          );
        }
        if (url === "offline-games.json") {
          return new Response(JSON.stringify(manifest));
        }
        return new Response(new Uint8Array([1]));
      },
    });
    return {
      bundledCache,
      deletedCaches,
      environment,
      getReloads: () => reloads,
      registration,
      serviceWorker,
      storage,
      sessionStorage,
    };
  };

  const activatingWorker = new Worker("installing");
  const activation = waitForWorker(activatingWorker);
  activatingWorker.transition("activated");
  await activation;

  assert.throws(
    () =>
      validateGameManifest({
        ...manifest,
        runtime: {
          ...manifest.runtime,
          files: [{ url: "../runtime.wasm", bytes: 1 }],
        },
      }),
    /invalid/,
  );

  const initial = makeEnvironment();
  const manager = createManager({
    currentVersion: manifest.version,
    environment: initial.environment,
  });
  await manager.initialize();
  assert.deepStrictEqual(initial.serviceWorker.registerCalls[0], [
    "sw.js",
    { updateViaCache: "none" },
  ]);
  assert.strictEqual(manager.getSnapshot().phase, "ready");
  assert.strictEqual(manager.getSnapshot().bundledGames.length, 4);

  await manager.downloadGame("bike-mania");
  assert.deepStrictEqual(manager.getSnapshot().downloadedGameIds, [
    "bike-mania",
  ]);
  assert.strictEqual(manager.getSnapshot().downloadedGameBytes, 14);
  assert.strictEqual(initial.bundledCache.values.size, 2);

  await manager.downloadGame("doom");
  assert.strictEqual(manager.getSnapshot().downloadedGameIds.length, 2);
  assert.strictEqual(manager.getSnapshot().downloadedGameBytes, 20);
  assert.strictEqual(initial.bundledCache.values.size, 4);

  await manager.removeGame("bike-mania");
  assert.deepStrictEqual(manager.getSnapshot().downloadedGameIds, ["doom"]);
  assert.strictEqual(manager.getSnapshot().downloadedGameBytes, 6);
  assert.strictEqual(
    initial.bundledCache.values.has("https://flash.example/js/runtime.wasm"),
    false,
  );

  await manager.removeAllGames();
  assert.deepStrictEqual(manager.getSnapshot().downloadedGameIds, []);
  assert(initial.deletedCaches.includes(BUNDLED_GAME_CACHE));

  const sharedRuntime = makeEnvironment();
  const sharedRuntimeManager = createManager({
    currentVersion: manifest.version,
    environment: sharedRuntime.environment,
  });
  await sharedRuntimeManager.initialize();
  await sharedRuntimeManager.downloadGame("pink-panther-passport-to-peril");
  await sharedRuntimeManager.downloadGame("pink-panther-hokus-pokus");
  assert.strictEqual(sharedRuntime.bundledCache.values.size, 3);
  await sharedRuntimeManager.removeGame("pink-panther-passport-to-peril");
  assert.strictEqual(
    sharedRuntime.bundledCache.values.has(
      "https://flash.example/vendor/scummvm/scummvm.wasm",
    ),
    true,
  );
  await sharedRuntimeManager.removeGame("pink-panther-hokus-pokus");
  assert.strictEqual(sharedRuntime.bundledCache.values.size, 0);

  const staleRuntime = makeEnvironment({
    storageValues: {
      astroFlashOfflineGameRecords: JSON.stringify({
        __runtime__: {
          bytes: 10,
          files: ["js/old-runtime.wasm"],
          revision: "runtime-old",
          type: "runtime",
        },
        "bike-mania": {
          bytes: 4,
          files: ["swf/bike-mania/main.swf"],
          revision: "bike-1",
          type: "swf",
        },
      }),
    },
  });
  const staleRuntimeManager = createManager({
    currentVersion: manifest.version,
    environment: staleRuntime.environment,
  });
  await staleRuntimeManager.initialize();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const saved = JSON.parse(
      staleRuntime.storage.getItem("astroFlashOfflineGameRecords"),
    );
    if (saved.__runtime__?.revision === manifest.runtime.revision) break;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.strictEqual(
    JSON.parse(staleRuntime.storage.getItem("astroFlashOfflineGameRecords"))
      .__runtime__.revision,
    manifest.runtime.revision,
  );

  const updateRegistration = new Registration({
    active: new Worker("activated", manifest.version),
  });
  const update = makeEnvironment({
    registration: updateRegistration,
    remoteVersion: "26.07.30-bbbbbbb",
  });
  const updateManager = createManager({
    currentVersion: manifest.version,
    environment: update.environment,
  });
  await updateManager.initialize();
  await updateManager.checkForUpdates();
  assert.strictEqual(
    updateManager.getSnapshot().availableVersion,
    "26.07.30-bbbbbbb",
  );
  const waitingWorker = new Worker("installed");
  updateRegistration.waiting = waitingWorker;
  updateRegistration.dispatch("updatefound");
  await new Promise((resolve) => setImmediate(resolve));
  await updateManager.applyUpdate();
  assert.deepStrictEqual(waitingWorker.messages, [{ type: "SKIP_WAITING" }]);
  update.serviceWorker.dispatch("controllerchange");
  assert.strictEqual(update.getReloads(), 1);

  const activatedUpdate = makeEnvironment({
    registration: new Registration({
      active: new Worker("activated", "26.07.30-bbbbbbb"),
    }),
    remoteVersion: "26.07.30-bbbbbbb",
  });
  const activatedManager = createManager({
    currentVersion: manifest.version,
    environment: activatedUpdate.environment,
  });
  await activatedManager.initialize();
  await activatedManager.checkForUpdates();
  assert.strictEqual(activatedUpdate.getReloads(), 1);

  const inconsistentUpdate = makeEnvironment({
    registration: new Registration({
      active: new Worker("activated", "26.07.30-bbbbbbb"),
    }),
    remoteVersion: "26.07.30-bbbbbbb",
    sessionValues: {
      astroFlashActiveVersionReload: "26.07.30-bbbbbbb",
    },
  });
  const inconsistentManager = createManager({
    currentVersion: manifest.version,
    environment: inconsistentUpdate.environment,
  });
  await inconsistentManager.initialize();
  await inconsistentManager.checkForUpdates();
  assert.strictEqual(inconsistentUpdate.getReloads(), 0);
  assert.strictEqual(
    inconsistentManager.getSnapshot().phase,
    "repair-required",
  );
  assert.match(inconsistentManager.getSnapshot().error, /Repair System Files/);

  const failedWorker = new Worker("installing");
  const failedRegistration = new Registration({
    active: new Worker("activated", manifest.version),
    installing: failedWorker,
  });
  const failedUpdate = makeEnvironment({
    registration: failedRegistration,
    remoteVersion: "26.07.30-bbbbbbb",
  });
  const failedManager = createManager({
    currentVersion: manifest.version,
    environment: failedUpdate.environment,
  });
  await failedManager.initialize();
  failedWorker.transition("redundant");
  assert.strictEqual(failedManager.getSnapshot().phase, "error");
  assert.match(failedManager.getSnapshot().error, /Repair System Files/);
});
