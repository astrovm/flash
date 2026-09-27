// @ts-nocheck
import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

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
  constructor(state = "activated", version = null, scriptURL = null) {
    super();
    this.state = state;
    this.version = version;
    this.scriptURL = scriptURL;
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
  async match(key) {
    return this.values.get(String(key));
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
    files: [{ url: "js/runtime.wasm?rev=runtime-1", bytes: 10 }],
  },
  runtimes: {
    scummvm: {
      revision: "scummvm-1",
      bytes: 8,
      files: [
        {
          url: "vendor/scummvm/scummvm.wasm?rev=scummvm-1",
          bytes: 8,
        },
      ],
    },
  },
  games: {
    "bike-mania": {
      revision: "bike-1",
      root: "swf/bike-mania.bike-1/",
      type: "swf",
      bytes: 4,
      files: [{ url: "swf/bike-mania.bike-1/main.swf", bytes: 4 }],
    },
    doom: {
      revision: "doom-1",
      root: "iframe/doom.doom-1/",
      type: "iframe",
      bytes: 6,
      files: [
        { url: "iframe/doom.doom-1/index.html", bytes: 2 },
        { url: "iframe/doom.doom-1/dos/doom/doom.jsdos", bytes: 4 },
      ],
    },
    "pink-panther-passport-to-peril": {
      revision: "peril-1",
      root: "iframe/pink-panther-passport-to-peril.peril-1/",
      runtime: "scummvm",
      type: "iframe",
      bytes: 2,
      files: [
        {
          url: "iframe/pink-panther-passport-to-peril.peril-1/index.html",
          bytes: 2,
        },
      ],
    },
    "pink-panther-hokus-pokus": {
      revision: "pokus-1",
      root: "iframe/pink-panther-hokus-pokus.pokus-1/",
      runtime: "scummvm",
      type: "iframe",
      bytes: 2,
      files: [
        {
          url: "iframe/pink-panther-hokus-pokus.pokus-1/index.html",
          bytes: 2,
        },
      ],
    },
  },
};
const testIntegrity = `sha384-${"A".repeat(64)}`;
const now = 1_800_000_000_000;
const sixHours = 6 * 60 * 60 * 1000;
for (const entry of [
  manifest.runtime,
  ...Object.values(manifest.runtimes),
  ...Object.values(manifest.games),
]) {
  for (const file of entry.files) file.integrity = testIntegrity;
}

const makeEnvironment = ({
  assetBaseUrl = "https://flash.example/",
  registration = new Registration({
    active: new Worker("activated", manifest.version),
  }),
  remoteVersion = "26.07.29-aaaaaaa",
  remoteReleasedAt = new Date(now - sixHours).toISOString(),
  stabilityDelayMs = sixHours,
  storageValues = {},
  sessionValues = {},
} = {}) => {
  let remote = {
    releasedAt: remoteReleasedAt,
    stabilityDelayMs,
    version: remoteVersion,
  };
  let currentTime = now;
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
  const timers = [];
  const fetches = [];
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
    Date: { now: () => currentTime },
    clearTimeout() {},
    setTimeout: (callback, delay) => {
      timers.push({ callback, delay });
      return timers.length;
    },
    document: Object.assign(new Events(), {
      baseURI: assetBaseUrl,
      visibilityState: "visible",
    }),
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
      fetches.push({ options, url });
      expect(options.cache).toBe("no-store");
      if (String(url).startsWith("/version.json")) {
        return new Response(
          JSON.stringify({
            version: remote.version,
            revision: remote.version.split("-").at(-1),
            releasedAt: remote.releasedAt,
            stabilityDelayMs: remote.stabilityDelayMs,
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
    fetches,
    getReloads: () => reloads,
    registration,
    setNow: (value) => {
      currentTime = value;
    },
    setRemote: (value) => {
      remote = { ...remote, ...value };
    },
    serviceWorker,
    storage,
    sessionStorage,
    timers,
  };
};

const createInitializedManager = async (environment) => {
  const manager = createManager({
    currentVersion: manifest.version,
    environment,
  });
  await manager.initialize();
  return manager;
};

const flush = () => new Promise((resolve) => setImmediate(resolve));

const flushUntil = async (condition, attempts = 50) => {
  for (let attempt = 0; attempt < attempts && !condition(); attempt += 1) {
    await flush();
  }
};

const countVersionFetches = ({ fetches }) =>
  fetches.filter(({ url }) => String(url).startsWith("/version.json")).length;

const makeDisabledEnvironment = () =>
  makeEnvironment({
    storageValues: {
      astroFlashOfflineEnabled: "false",
      astroFlashOfflineGameRecords: JSON.stringify({
        "synthetic-game": {
          bytes: 4,
          files: ["swf/synthetic-game/main.swf"],
          revision: "synthetic-1",
          type: "swf",
        },
      }),
      syntheticPersonalPreference: "preserve-me",
    },
  });

const makeReenabledManager = async () => {
  const disabled = makeDisabledEnvironment();
  const manager = await createInitializedManager(disabled.environment);
  await manager.setOfflineEnabled(true);
  return { disabled, manager };
};

describe("waitForWorker", () => {
  test("resolves once an installing worker becomes activated", async () => {
    const activatingWorker = new Worker("installing");
    const activation = waitForWorker(activatingWorker);
    activatingWorker.transition("activated");
    await activation;
  });
});

describe("validateGameManifest", () => {
  test("rejects file URLs that escape the asset root", () => {
    expect(() =>
      validateGameManifest({
        ...manifest,
        runtime: {
          ...manifest.runtime,
          files: [{ url: "../runtime.wasm", bytes: 1 }],
        },
      }),
    ).toThrow(/invalid/);
  });
});

describe("offline manager", () => {
  test("registers the versioned worker and becomes ready with default preferences", async () => {
    const initial = makeEnvironment();
    const manager = await createInitializedManager(initial.environment);
    expect(manager.getSnapshot().enabled).toBe(true);
    expect(manager.getSnapshot().savePlayedGamesOffline).toBe(true);
    expect(manager.getSnapshot().automaticUpdatesEnabled).toBe(true);
    expect(initial.serviceWorker.registerCalls[0]).toEqual([
      `/sw.${manifest.version}.js`,
      { scope: "/", updateViaCache: "none" },
    ]);
    expect(manager.getSnapshot().phase).toBe("ready");
    expect(manager.getSnapshot().bundledGames.length).toBe(4);
  });

  test("unregisters the worker and clears caches and game records when offline access is disabled", async () => {
    const disabled = makeDisabledEnvironment();
    const disabledManager = await createInitializedManager(
      disabled.environment,
    );
    expect(disabledManager.getSnapshot().enabled).toBe(false);
    expect(disabledManager.getSnapshot().phase).toBe("disabled");
    expect(disabled.registration.unregisterCalls).toBe(1);
    expect(disabled.serviceWorker.registerCalls.length).toBe(0);
    await expect(disabledManager.downloadGame("bike-mania")).rejects.toThrow(
      /Enable offline access/,
    );
    expect(
      disabled.fetches.some(({ url }) =>
        String(url).startsWith("/version.json"),
      ),
    ).toBe(false);
    expect(disabled.deletedCaches).toContain("astro-flash-precache");
    expect(disabled.deletedCaches).toContain(BUNDLED_GAME_CACHE);
    expect(
      JSON.parse(disabled.storage.getItem("astroFlashOfflineGameRecords")),
    ).toEqual({});
    expect(disabled.storage.getItem("syntheticPersonalPreference")).toBe(
      "preserve-me",
    );
  });

  test("registers the worker again when offline access is re-enabled", async () => {
    const { disabled, manager } = await makeReenabledManager();
    expect(manager.getSnapshot().enabled).toBe(true);
    expect(manager.getSnapshot().phase).toBe("ready");
    expect(disabled.serviceWorker.registerCalls.length).toBe(1);
  });

  test("persists the save-played-games preference", async () => {
    const { disabled, manager } = await makeReenabledManager();
    manager.setSavePlayedGamesOffline(false);
    expect(disabled.storage.getItem("astroFlashSavePlayedGamesOffline")).toBe(
      "false",
    );
  });

  test("skips update checks on visibility changes but still checks manually when automatic updates are disabled", async () => {
    const { disabled, manager } = await makeReenabledManager();
    manager.setSavePlayedGamesOffline(false);
    manager.setAutomaticUpdatesEnabled(false);
    const versionFetchesBeforeVisibility = countVersionFetches(disabled);
    disabled.setNow(now + 2 * 60 * 60 * 1000);
    disabled.environment.document.dispatch("visibilitychange");
    await flush();
    expect(countVersionFetches(disabled)).toBe(versionFetchesBeforeVisibility);
    await manager.checkForUpdates();
    expect(countVersionFetches(disabled)).toBe(
      versionFetchesBeforeVisibility + 1,
    );
  });

  test("shares one in-flight update and does not re-register while a worker is installing", async () => {
    const downloading = makeEnvironment();
    const downloadingManager = await createInitializedManager(
      downloading.environment,
    );
    downloading.setRemote({ version: "26.07.30-download" });
    downloading.registration.installing = new Worker(
      "installing",
      "26.07.30-download",
    );
    const firstUpdate = downloadingManager.updateNow();
    expect(downloadingManager.getSnapshot().phase).toBe("checking");
    expect(downloadingManager.updateNow()).toBe(firstUpdate);
    await firstUpdate;
    expect(downloadingManager.getSnapshot().phase).toBe("updating");
    expect(downloadingManager.getSnapshot().workerState).toBe("installing");
    const registrationsDuringDownload =
      downloading.serviceWorker.registerCalls.length;
    await downloadingManager.updateNow();
    expect(downloading.serviceWorker.registerCalls.length).toBe(
      registrationsDuringDownload,
    );
  });

  test("installs a manual update and reloads only once when automatic updates are disabled", async () => {
    const manualUpdates = makeEnvironment({
      storageValues: { astroFlashAutomaticUpdatesEnabled: "false" },
    });
    const manualUpdatesManager = await createInitializedManager(
      manualUpdates.environment,
    );
    expect(
      manualUpdates.fetches.some(({ url }) =>
        String(url).startsWith("/version.json"),
      ),
    ).toBe(false);
    manualUpdates.setRemote({ version: "26.07.30-manual11" });
    manualUpdates.registration.waiting = new Worker(
      "installed",
      "26.07.30-manual11",
    );
    await manualUpdatesManager.updateNow();
    expect(manualUpdates.registration.waiting.messages).toEqual([
      { type: "SKIP_WAITING" },
    ]);
    manualUpdates.serviceWorker.dispatch("controllerchange");
    expect(manualUpdates.getReloads()).toBe(1);
    manualUpdates.serviceWorker.dispatch("controllerchange");
    // The manual reload intent is consumed once.
    expect(manualUpdates.getReloads()).toBe(1);
  });

  test("migrates a legacy query-string worker to the versioned worker script", async () => {
    const legacyActiveWorker = new Worker(
      "activated",
      manifest.version,
      `/sw.js?v=${manifest.version}`,
    );
    const migrationRegistration = new Registration({
      active: legacyActiveWorker,
    });
    const migration = makeEnvironment({
      registration: migrationRegistration,
      remoteVersion: manifest.version,
    });
    const migrationWaitingWorker = new Worker("installed", manifest.version);
    migration.serviceWorker.register = async (...args) => {
      migration.serviceWorker.registerCalls.push(args);
      migrationRegistration.waiting = migrationWaitingWorker;
      return migrationRegistration;
    };
    await createInitializedManager(migration.environment);
    expect(migration.serviceWorker.registerCalls[0][0]).toBe(
      `/sw.${manifest.version}.js`,
    );
    expect(migrationWaitingWorker.messages).toEqual([{ type: "SKIP_WAITING" }]);
  });

  test("migrates a legacy worker without checking for updates when automatic updates are disabled", async () => {
    const manualMigrationRegistration = new Registration({
      active: new Worker(
        "activated",
        manifest.version,
        `/sw.js?v=${manifest.version}`,
      ),
    });
    const manualMigration = makeEnvironment({
      registration: manualMigrationRegistration,
      storageValues: { astroFlashAutomaticUpdatesEnabled: "false" },
    });
    const manualMigrationWorker = new Worker("installed", manifest.version);
    manualMigration.serviceWorker.register = async (...args) => {
      manualMigration.serviceWorker.registerCalls.push(args);
      manualMigrationRegistration.waiting = manualMigrationWorker;
      return manualMigrationRegistration;
    };
    await createInitializedManager(manualMigration.environment);
    expect(manualMigration.serviceWorker.registerCalls[0][0]).toBe(
      `/sw.${manifest.version}.js`,
    );
    expect(manualMigrationWorker.messages).toEqual([{ type: "SKIP_WAITING" }]);
    expect(
      manualMigration.fetches.some(({ url }) =>
        String(url).startsWith("/version.json"),
      ),
    ).toBe(false);
  });

  test("downloads a game and its runtime with integrity metadata", async () => {
    const initial = makeEnvironment();
    const manager = await createInitializedManager(initial.environment);
    await manager.downloadGame("bike-mania");
    expect(
      initial.fetches.find(({ url }) =>
        String(url).includes("bike-mania.bike-1/main.swf"),
      ).options.integrity,
    ).toBe(testIntegrity);
    expect(manager.getSnapshot().downloadedGameIds).toEqual(["bike-mania"]);
    expect(manager.getSnapshot().downloadedGameBytes).toBe(14);
    expect(initial.bundledCache.values.size).toBe(2);
  });

  test("caches game files relative to a versioned asset base URL", async () => {
    const versioned = makeEnvironment({
      assetBaseUrl: `https://flash.example/releases/${manifest.version}/`,
    });
    const versionedManager = await createInitializedManager(
      versioned.environment,
    );
    await versionedManager.downloadGame("bike-mania");
    expect(
      versioned.bundledCache.values.has(
        `https://flash.example/releases/${manifest.version}/swf/bike-mania.bike-1/main.swf`,
      ),
    ).toBe(true);
  });

  test("restores a missing cached file when a downloaded game is downloaded again", async () => {
    const initial = makeEnvironment();
    const manager = await createInitializedManager(initial.environment);
    await manager.downloadGame("bike-mania");
    const bikeUrl = "https://flash.example/swf/bike-mania.bike-1/main.swf";
    await initial.bundledCache.delete(bikeUrl);
    await manager.downloadGame("bike-mania");
    expect(initial.bundledCache.values.has(bikeUrl)).toBe(true);
  });

  test("tracks multiple downloaded games and removes them individually and all at once", async () => {
    const initial = makeEnvironment();
    const manager = await createInitializedManager(initial.environment);
    await manager.downloadGame("bike-mania");
    await manager.downloadGame("doom");
    expect(manager.getSnapshot().downloadedGameIds.length).toBe(2);
    expect(manager.getSnapshot().downloadedGameBytes).toBe(20);
    expect(initial.bundledCache.values.size).toBe(4);

    await manager.removeGame("bike-mania");
    expect(manager.getSnapshot().downloadedGameIds).toEqual(["doom"]);
    expect(manager.getSnapshot().downloadedGameBytes).toBe(6);
    expect(
      initial.bundledCache.values.has(
        "https://flash.example/js/runtime.wasm?rev=runtime-1",
      ),
    ).toBe(false);

    await manager.removeAllGames();
    expect(manager.getSnapshot().downloadedGameIds).toEqual([]);
    expect(initial.deletedCaches).toContain(BUNDLED_GAME_CACHE);
  });

  test("aborts an in-progress download and discards its files when offline access is disabled", async () => {
    const interrupted = makeEnvironment();
    const interruptedManager = await createInitializedManager(
      interrupted.environment,
    );
    const originalInterruptedPut = interrupted.bundledCache.put.bind(
      interrupted.bundledCache,
    );
    let releaseInterruptedPut;
    let markInterruptedPutStarted;
    const interruptedPutStarted = new Promise((resolve) => {
      markInterruptedPutStarted = resolve;
    });
    const interruptedPutRelease = new Promise((resolve) => {
      releaseInterruptedPut = resolve;
    });
    interrupted.bundledCache.put = async (...arguments_) => {
      markInterruptedPutStarted();
      await interruptedPutRelease;
      return originalInterruptedPut(...arguments_);
    };
    const interruptedDownload = interruptedManager.downloadGame("doom");
    await interruptedPutStarted;
    await interruptedManager.setOfflineEnabled(false);
    releaseInterruptedPut();
    await expect(interruptedDownload).rejects.toThrow(
      /Offline access was disabled/,
    );
    expect(interruptedManager.getSnapshot().phase).toBe("disabled");
    expect(interruptedManager.getSnapshot().gamePhase).toBe("idle");
    expect(interrupted.bundledCache.values.size).toBe(0);
    expect(
      JSON.parse(
        interrupted.storage.getItem("astroFlashOfflineGameRecords") || "{}",
      ),
    ).toEqual({});
  });

  test("repairs system files by unregistering, clearing caches, and activating without reloading", async () => {
    const repaired = makeEnvironment({
      storageValues: { astroFlashAutomaticUpdatesEnabled: "false" },
    });
    const repairedManager = await createInitializedManager(
      repaired.environment,
    );
    repaired.setRemote({ version: "26.07.30-repair111" });
    repaired.registration.waiting = new Worker(
      "installed",
      "26.07.30-repair111",
    );
    await repairedManager.repair();
    repaired.serviceWorker.dispatch("controllerchange");
    // Repair does not reload the current session.
    expect(repaired.getReloads()).toBe(0);
    expect(repaired.registration.unregisterCalls).toBe(1);
    expect(repaired.deletedCaches).toContain("astro-flash-precache");
    expect(repaired.registration.waiting.messages).toEqual([
      { type: "SKIP_WAITING" },
    ]);
  });

  test("downloads games despite a low storage estimate and unavailable persistence", async () => {
    const lowEstimate = makeEnvironment();
    lowEstimate.environment.navigator.storage = {
      estimate: async () => ({ usage: 100, quota: 100 }),
      persist: async () => {
        throw new Error("persistence unavailable");
      },
    };
    const lowEstimateManager = await createInitializedManager(
      lowEstimate.environment,
    );
    await lowEstimateManager.downloadGame("bike-mania");
    expect(lowEstimateManager.getSnapshot().downloadedGameIds).toEqual([
      "bike-mania",
    ]);
  });

  test("rolls back a partial download and reports an error when the storage quota is exceeded", async () => {
    const quotaFailure = makeEnvironment();
    const originalPut = quotaFailure.bundledCache.put.bind(
      quotaFailure.bundledCache,
    );
    let putCount = 0;
    quotaFailure.bundledCache.put = async (key, response) => {
      putCount += 1;
      if (putCount === 2) {
        throw new DOMException("full", "QuotaExceededError");
      }
      return originalPut(key, response);
    };
    const quotaFailureManager = await createInitializedManager(
      quotaFailure.environment,
    );
    await expect(quotaFailureManager.downloadGame("doom")).rejects.toThrow(
      /actual storage quota/,
    );
    expect(quotaFailure.bundledCache.values.size).toBe(0);
    expect(quotaFailureManager.getSnapshot().downloadedGameIds).toEqual([]);
    expect(quotaFailureManager.getSnapshot().gameError).toMatch(
      /actual storage quota/,
    );
  });

  test("keeps the previous game revision when upgrading a downloaded game fails", async () => {
    const failedUpgrade = makeEnvironment({
      storageValues: {
        astroFlashOfflineGameRecords: JSON.stringify({
          __runtime__: {
            bytes: 10,
            files: ["js/runtime.wasm?rev=runtime-old"],
            revision: "runtime-old",
            type: "runtime",
          },
          "bike-mania": {
            bytes: 4,
            files: ["swf/bike-mania.old/main.swf"],
            revision: "old",
            type: "swf",
          },
        }),
      },
    });
    const oldBikeUrl = "https://flash.example/swf/bike-mania.old/main.swf";
    await failedUpgrade.bundledCache.put(oldBikeUrl, new Response("old game"));
    const upgradePut = failedUpgrade.bundledCache.put.bind(
      failedUpgrade.bundledCache,
    );
    failedUpgrade.bundledCache.put = async (key, response) => {
      if (String(key).includes("bike-mania.bike-1")) {
        throw new DOMException("full", "QuotaExceededError");
      }
      return upgradePut(key, response);
    };
    const failedUpgradeManager = await createInitializedManager(
      failedUpgrade.environment,
    );
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (failedUpgradeManager.getSnapshot().gamePhase === "error") break;
      await flush();
    }
    expect(failedUpgrade.bundledCache.values.has(oldBikeUrl)).toBe(true);
    expect(
      JSON.parse(failedUpgrade.storage.getItem("astroFlashOfflineGameRecords"))[
        "bike-mania"
      ].revision,
    ).toBe("old");
  });

  test("keeps a shared runtime cached until the last game using it is removed", async () => {
    const sharedRuntime = makeEnvironment();
    const sharedRuntimeManager = await createInitializedManager(
      sharedRuntime.environment,
    );
    await sharedRuntimeManager.downloadGame("pink-panther-passport-to-peril");
    await sharedRuntimeManager.downloadGame("pink-panther-hokus-pokus");
    expect(sharedRuntime.bundledCache.values.size).toBe(3);
    await sharedRuntimeManager.removeGame("pink-panther-passport-to-peril");
    expect(
      sharedRuntime.bundledCache.values.has(
        "https://flash.example/vendor/scummvm/scummvm.wasm?rev=scummvm-1",
      ),
    ).toBe(true);
    await sharedRuntimeManager.removeGame("pink-panther-hokus-pokus");
    expect(sharedRuntime.bundledCache.values.size).toBe(0);
  });

  test("refreshes a stale downloaded runtime to the current revision", async () => {
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
    await createInitializedManager(staleRuntime.environment);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const saved = JSON.parse(
        staleRuntime.storage.getItem("astroFlashOfflineGameRecords"),
      );
      if (saved.__runtime__?.revision === manifest.runtime.revision) break;
      await flush();
    }
    expect(
      JSON.parse(staleRuntime.storage.getItem("astroFlashOfflineGameRecords"))
        .__runtime__.revision,
    ).toBe(manifest.runtime.revision);
  });

  test("reports an available update and reloads after applying it", async () => {
    const updateRegistration = new Registration({
      active: new Worker("activated", manifest.version),
    });
    const update = makeEnvironment({
      registration: updateRegistration,
      remoteVersion: "26.07.30-bbbbbbb",
    });
    const updateManager = await createInitializedManager(update.environment);
    await updateManager.checkForUpdates();
    expect(updateManager.getSnapshot().availableVersion).toBe(
      "26.07.30-bbbbbbb",
    );
    const waitingWorker = new Worker("installed", "26.07.30-bbbbbbb");
    updateRegistration.waiting = waitingWorker;
    updateRegistration.dispatch("updatefound");
    await flush();
    await updateManager.applyUpdate();
    expect(waitingWorker.messages).toEqual([{ type: "SKIP_WAITING" }]);
    update.serviceWorker.dispatch("controllerchange");
    expect(update.getReloads()).toBe(1);
  });

  test("refuses to activate a stale waiting worker and retries registration for the remote version", async () => {
    const staleWaitingRegistration = new Registration({
      active: new Worker("activated", manifest.version),
      waiting: new Worker("installed", "26.07.30-intermediate"),
    });
    const staleWaiting = makeEnvironment({
      registration: staleWaitingRegistration,
      remoteVersion: "26.07.30-bbbbbbb",
    });
    const staleWaitingManager = await createInitializedManager(
      staleWaiting.environment,
    );
    expect(staleWaitingManager.getSnapshot().updateReady).toBe(false);
    await expect(staleWaitingManager.applyUpdate()).rejects.toThrow(
      /not ready to install/,
    );
    expect(staleWaitingRegistration.waiting.messages).toEqual([]);
    staleWaitingRegistration.waiting = new Worker(
      "installed",
      "26.07.30-bbbbbbb",
    );
    const retry = staleWaiting.timers.find(({ delay }) => delay === 30_000);
    expect(retry).toBeTruthy();
    retry.callback();
    await flushUntil(
      () => staleWaitingRegistration.waiting.messages.length > 0,
    );
    expect(staleWaiting.serviceWorker.registerCalls.at(-1)[0]).toMatch(
      /^\/sw\.26\.07\.30-bbbbbbb\.js\?retry=1800000000000$/,
    );
    expect(staleWaitingManager.getSnapshot().updateReady).toBe(true);
    expect(staleWaitingRegistration.waiting.messages).toEqual([
      { type: "SKIP_WAITING" },
    ]);
  });

  test("delays automatic activation until a release is stable and never reloads the open session", async () => {
    const firstReleaseTime = now - 3 * 60 * 60 * 1000;
    const delayedRegistration = new Registration({
      active: new Worker("activated", manifest.version),
      waiting: new Worker("installed", "26.07.30-first111"),
    });
    const delayed = makeEnvironment({
      registration: delayedRegistration,
      remoteVersion: "26.07.30-first111",
      remoteReleasedAt: new Date(firstReleaseTime).toISOString(),
    });
    const delayedManager = await createInitializedManager(delayed.environment);
    expect(delayedManager.getSnapshot().phase).toBe("update-pending");
    expect(delayedRegistration.waiting.messages).toEqual([]);

    const secondReleaseTime = now;
    delayed.setRemote({
      version: "26.07.30-second22",
      releasedAt: new Date(secondReleaseTime).toISOString(),
    });
    delayed.setNow(secondReleaseTime + sixHours);
    delayedRegistration.waiting = new Worker("installed", "26.07.30-second22");
    const dueTimer = delayed.timers.find(
      ({ delay }) => delay === 3 * 60 * 60 * 1000,
    );
    expect(dueTimer).toBeTruthy();
    dueTimer.callback();
    for (
      let attempt = 0;
      attempt < 20 && !delayedRegistration.waiting.messages.length;
      attempt++
    ) {
      await flush();
    }
    expect(delayedRegistration.waiting.messages).toEqual([
      { type: "SKIP_WAITING" },
    ]);
    delayed.serviceWorker.dispatch("controllerchange");
    // Automatic activation keeps the current session open.
    expect(delayed.getReloads()).toBe(0);
    delayedRegistration.waiting.messages.length = 0;
    await createInitializedManager(delayed.environment);
    expect(delayedRegistration.waiting.messages).toEqual([
      { type: "SKIP_WAITING" },
    ]);
    delayed.serviceWorker.dispatch("controllerchange");
    expect(delayed.getReloads()).toBe(0);
  });

  test("honors a configured automatic update delay while still allowing an immediate update", async () => {
    const configurableReleaseTime = now - 7 * 60 * 60 * 1000;
    const configurableRegistration = new Registration({
      active: new Worker("activated", manifest.version),
    });
    const configurable = makeEnvironment({
      registration: configurableRegistration,
      remoteVersion: "26.07.30-config123",
      remoteReleasedAt: new Date(configurableReleaseTime).toISOString(),
      storageValues: {
        astroFlashAutomaticUpdateDelay: String(12 * 60 * 60 * 1000),
      },
    });
    const configurableManager = await createInitializedManager(
      configurable.environment,
    );
    expect(configurableManager.getSnapshot().automaticUpdateDelayMs).toBe(
      12 * 60 * 60 * 1000,
    );
    expect(configurableManager.getSnapshot().phase).toBe("update-pending");
    expect(configurable.serviceWorker.registerCalls.length).toBe(0);
    await configurableManager.checkForUpdates();
    expect(configurable.serviceWorker.registerCalls.length).toBe(0);

    const scheduledUpdate = configurable.timers.find(
      ({ delay }) => delay === 5 * 60 * 60 * 1000,
    );
    expect(scheduledUpdate).toBeTruthy();
    configurable.setNow(now + 5 * 60 * 60 * 1000);
    configurableRegistration.waiting = new Worker(
      "installed",
      "26.07.30-config123",
    );
    scheduledUpdate.callback();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (configurableRegistration.waiting.messages.length > 0) break;
      await flush();
    }
    expect(configurable.serviceWorker.registerCalls.at(-1)[0]).toBe(
      "/sw.26.07.30-config123.js",
    );
    expect(configurableRegistration.waiting.messages).toEqual([
      { type: "SKIP_WAITING" },
    ]);

    const configurableWaitingWorker = new Worker(
      "installed",
      "26.07.30-config123",
    );
    configurableRegistration.waiting = configurableWaitingWorker;
    await configurableManager.updateNow();
    expect(configurable.serviceWorker.registerCalls.at(-1)[0]).toBe(
      "/sw.26.07.30-config123.js",
    );
    expect(configurableWaitingWorker.messages).toEqual([
      { type: "SKIP_WAITING" },
    ]);
  });

  test("persists the automatic update delay and clears it when reset", async () => {
    const configurable = makeEnvironment({
      storageValues: {
        astroFlashAutomaticUpdateDelay: String(12 * 60 * 60 * 1000),
      },
    });
    const configurableManager = await createInitializedManager(
      configurable.environment,
    );
    configurableManager.setAutomaticUpdateDelay(0);
    expect(configurable.storage.getItem("astroFlashAutomaticUpdateDelay")).toBe(
      "0",
    );
    configurableManager.setAutomaticUpdateDelay(null);
    expect(configurable.storage.getItem("astroFlashAutomaticUpdateDelay")).toBe(
      null,
    );
  });

  test("marks an already-active newer worker as ready and reloads on updateNow", async () => {
    const activatedUpdate = makeEnvironment({
      registration: new Registration({
        active: new Worker("activated", "26.07.30-bbbbbbb"),
      }),
      remoteVersion: "26.07.30-bbbbbbb",
    });
    const activatedManager = await createInitializedManager(
      activatedUpdate.environment,
    );
    await activatedManager.checkForUpdates();
    expect(activatedUpdate.getReloads()).toBe(0);
    expect(activatedManager.getSnapshot().updateReady).toBe(true);
    await activatedManager.updateNow();
    expect(activatedUpdate.getReloads()).toBe(1);
  });

  test("requires a repair instead of reloading again when a previous active-version reload did not take effect", async () => {
    const inconsistentUpdate = makeEnvironment({
      registration: new Registration({
        active: new Worker("activated", "26.07.30-bbbbbbb"),
      }),
      remoteVersion: "26.07.30-bbbbbbb",
      sessionValues: {
        astroFlashActiveVersionReload: "26.07.30-bbbbbbb",
      },
    });
    const inconsistentManager = await createInitializedManager(
      inconsistentUpdate.environment,
    );
    await inconsistentManager.checkForUpdates();
    expect(inconsistentUpdate.getReloads()).toBe(0);
    await inconsistentManager.updateNow();
    expect(inconsistentManager.getSnapshot().phase).toBe("repair-required");
    expect(inconsistentManager.getSnapshot().error).toMatch(
      /Repair System Files/,
    );
  });

  test("reports an error suggesting repair when an installing worker becomes redundant", async () => {
    const failedWorker = new Worker("installing");
    const failedRegistration = new Registration({
      active: new Worker("activated", manifest.version),
      installing: failedWorker,
    });
    const failedUpdate = makeEnvironment({
      registration: failedRegistration,
      remoteVersion: "26.07.30-bbbbbbb",
    });
    const failedManager = await createInitializedManager(
      failedUpdate.environment,
    );
    failedWorker.transition("redundant");
    expect(failedManager.getSnapshot().phase).toBe("error");
    expect(failedManager.getSnapshot().error).toMatch(/Repair System Files/);
  });
});

describe("offline failure and lifecycle boundaries", () => {
  test("workers already finished or missing resolve; redundant workers reject and detach listeners", async () => {
    await waitForWorker(null);
    await waitForWorker(new Worker());
    await expect(waitForWorker(new Worker("redundant"))).rejects.toThrow(
      "interrupted",
    );
    const worker = new Worker("installing"),
      waiting = waitForWorker(worker);
    worker.transition("redundant");
    await expect(waiting).rejects.toThrow("interrupted");
    expect(worker.listeners.get("statechange").size).toBe(0);
  });
  for (const [label, change] of [
    ["null", () => null],
    ["runtime array", (m) => ({ ...m, runtimes: [] })],
    ["null runtimes", (m) => ({ ...m, runtimes: null })],
    [
      "invalid runtime name",
      (m) => ({ ...m, runtimes: { "../bad": m.runtime } }),
    ],
    ["invalid runtime entry", (m) => ({ ...m, runtimes: { bad: {} } })],
    ["invalid game id", (m) => ({ ...m, games: { "Bad!": m.games.doom } })],
    [
      "invalid game type",
      (m) => ({ ...m, games: { doom: { ...m.games.doom, type: "exe" } } }),
    ],
    [
      "unversioned root",
      (m) => ({
        ...m,
        games: { doom: { ...m.games.doom, root: "iframe/doom/" } },
      }),
    ],
    [
      "missing runtime",
      (m) => ({
        ...m,
        games: { doom: { ...m.games.doom, runtime: "absent" } },
      }),
    ],
    ["negative bytes", (m) => ({ ...m, runtime: { ...m.runtime, bytes: -1 } })],
    [
      "missing integrity",
      (m) => ({
        ...m,
        runtime: { ...m.runtime, files: [{ url: "runtime.wasm", bytes: 1 }] },
      }),
    ],
  ])
    test(`rejects ${label} manifests before downloading files`, () => {
      expect(() =>
        validateGameManifest(change(structuredClone(manifest))),
      ).toThrow("catalog is invalid");
    });
  test("invalid stored records are ignored and subscriptions receive isolated snapshots", async () => {
    for (const records of ["broken-json", "[]", "null"]) {
      const h = makeEnvironment({
        storageValues: { astroFlashOfflineGameRecords: records },
      });
      const manager = await createInitializedManager(h.environment),
        snapshots = [];
      const unsubscribe = manager.subscribe((value) => snapshots.push(value));
      expect(snapshots[0].downloadedGameIds).toEqual([]);
      snapshots[0].bundledGames[0].id = "changed";
      snapshots[0].downloadedGameIds.push("changed");
      expect(manager.getSnapshot().bundledGames[0].id).toBe("bike-mania");
      expect(manager.getSnapshot().downloadedGameIds).toEqual([]);
      manager.setSavePlayedGamesOffline(false);
      expect(snapshots.length).toBe(2);
      unsubscribe();
      manager.setSavePlayedGamesOffline(true);
      expect(snapshots.length).toBe(2);
    }
  });
  test("rejects malformed preferences and unavailable offline actions without changing storage", async () => {
    const h = makeEnvironment(),
      manager = await createInitializedManager(h.environment);
    await expect(manager.setOfflineEnabled("false")).rejects.toThrow(
      "setting is invalid",
    );
    expect(() => manager.setSavePlayedGamesOffline(0)).toThrow(
      "setting is invalid",
    );
    expect(() => manager.setAutomaticUpdatesEnabled(null)).toThrow(
      "setting is invalid",
    );
    for (const delay of [-1, 1.5, NaN, "0"])
      expect(() => manager.setAutomaticUpdateDelay(delay)).toThrow(
        "delay is invalid",
      );
    h.environment.navigator.onLine = false;
    await expect(manager.repair()).rejects.toThrow("Connect to the internet");
    await expect(manager.checkForUpdates()).rejects.toThrow(
      "Connect to the internet",
    );
    await manager.setOfflineEnabled(false);
    await expect(manager.repair()).rejects.toThrow("Enable offline access");
    await expect(manager.checkForUpdates()).rejects.toThrow(
      "Enable offline access",
    );
    await expect(manager.downloadAllGames()).rejects.toThrow(
      "Enable offline access",
    );
  });
  test("downloads all built-in games once and retains shared runtimes", async () => {
    const h = makeEnvironment(),
      manager = await createInitializedManager(h.environment);
    await manager.downloadAllGames();
    expect(manager.getSnapshot().downloadedGameIds.sort()).toEqual(
      Object.keys(manifest.games).sort(),
    );
    const downloaded = h.fetches.length;
    await manager.downloadAllGames();
    expect(h.fetches.length).toBe(downloaded);
    await manager.removeAllGames();
    expect(manager.getSnapshot().downloadedGameIds).toEqual([]);
    expect(h.bundledCache.values.size).toBe(0);
  });
  for (const [label, response, error] of [
    [
      "HTTP failure",
      () => new Response("offline", { status: 503 }),
      "Update check failed (503)",
    ],
    [
      "invalid metadata",
      () => Response.json({ version: "bad" }),
      "invalid version metadata",
    ],
  ])
    test(`reports ${label} during update checks`, async () => {
      const h = makeEnvironment(),
        manager = await createInitializedManager(h.environment);
      h.environment.fetch = async () => response();
      await expect(manager.checkForUpdates()).rejects.toThrow(error);
      expect(manager.getSnapshot().error).toContain(error);
    });
  for (const [label, response, error] of [
    [
      "HTTP failure",
      () => new Response("offline", { status: 503 }),
      "catalog failed (503)",
    ],
    [
      "wrong version",
      () => Response.json({ ...manifest, version: "different" }),
      "catalog version is inconsistent",
    ],
  ])
    test(`reports catalog ${label} during initialization`, async () => {
      const h = makeEnvironment(),
        fetch = h.environment.fetch;
      h.environment.fetch = async (url, options) =>
        url === "offline-games.json" ? response() : fetch(url, options);
      const manager = await createInitializedManager(h.environment);
      expect(manager.getSnapshot().phase).toBe("error");
      expect(manager.getSnapshot().error).toContain(error);
    });
  test("rolls back runtime downloads when an asset server fails", async () => {
    const h = makeEnvironment(),
      manager = await createInitializedManager(h.environment),
      fetch = h.environment.fetch;
    h.environment.fetch = async (url, options) =>
      String(url).endsWith("main.swf")
        ? new Response("offline", { status: 502 })
        : fetch(url, options);
    await expect(manager.downloadGame("bike-mania")).rejects.toThrow(
      "Offline download failed (502)",
    );
    expect(manager.getSnapshot().downloadedGameIds).toEqual([]);
    expect(manager.getSnapshot().gamePhase).toBe("error");
  });
  test("persists disabled state even when service-worker removal fails", async () => {
    const h = makeEnvironment(),
      manager = await createInitializedManager(h.environment);
    h.registration.unregister = async () => {
      throw new Error("worker removal failed");
    };
    await expect(manager.setOfflineEnabled(false)).rejects.toThrow(
      "worker removal failed",
    );
    expect(manager.getSnapshot().enabled).toBeFalse();
    expect(manager.getSnapshot().phase).toBe("disabled");
    expect(manager.getSnapshot().error).toBe("worker removal failed");
  });
  test("tracks online and offline transitions and resumes automatic checks", async () => {
    const h = makeEnvironment(),
      manager = await createInitializedManager(h.environment);
    h.environment.navigator.onLine = false;
    h.environment.dispatch("offline");
    expect(manager.getSnapshot().online).toBeFalse();
    h.environment.navigator.onLine = true;
    h.environment.dispatch("online");
    expect(manager.getSnapshot().online).toBeTrue();
    manager.setAutomaticUpdatesEnabled(false);
    const before = h.fetches.length;
    manager.setAutomaticUpdatesEnabled(true);
    await flushUntil(() => h.fetches.length > before);
    expect(h.fetches.length).toBeGreaterThan(before);
  });
  for (const workerUrl of ["/sw.js", "/sw.js?channel=test"])
    test(`supports custom worker URL ${workerUrl}`, async () => {
      const h = makeEnvironment(),
        manager = createManager({
          currentVersion: manifest.version,
          environment: h.environment,
          serviceWorkerUrl: workerUrl,
        });
      await manager.initialize();
      expect(h.serviceWorker.registerCalls[0][0]).toBe(
        `${workerUrl}${workerUrl.includes("?") ? "&" : "?"}v=${manifest.version}`,
      );
    });
  test("waits for a first installation and reports activation failures", async () => {
    for (const finalState of ["activated", "redundant"]) {
      const worker = new Worker("installing", manifest.version),
        registration = new Registration({ installing: worker });
      const h = makeEnvironment({ registration });
      h.serviceWorker.getRegistration = async () => null;
      const manager = createManager({
        currentVersion: manifest.version,
        environment: h.environment,
      });
      const ready = manager.initialize();
      await flushUntil(() => worker.listeners.get("statechange")?.size === 2);
      registration.installing = null;
      if (finalState === "activated") registration.active = worker;
      worker.transition(finalState);
      await ready;
      expect(manager.getSnapshot().phase).toBe(
        finalState === "activated" ? "ready" : "error",
      );
      if (finalState === "activated")
        expect(manager.getSnapshot().usage).toBe(100);
      else expect(manager.getSnapshot().error).toContain("interrupted");
    }
  });
});
