"use strict";

const assert = require("assert");
const {
  createManager,
  waitForWorker,
} = require("../site/js/offline.js");

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
  constructor(state = "installing") {
    super();
    this.state = state;
    this.messages = [];
  }

  transition(state) {
    this.state = state;
    this.dispatch("statechange");
  }

  postMessage(message) {
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
}

const makeEnvironment = ({
  registration,
  enabled = false,
  remoteVersion = "26.07.29-bbbbbbb",
} = {}) => {
  const serviceWorker = new Events();
  serviceWorker.controller = registration?.active || null;
  serviceWorker.registerCalls = [];
  serviceWorker.register = async (...args) => {
    serviceWorker.registerCalls.push(args);
    return registration;
  };
  serviceWorker.getRegistration = async () => registration;
  serviceWorker.ready = Promise.resolve(registration);

  const windowEvents = new Events();
  const documentEvents = new Events();
  documentEvents.visibilityState = "visible";
  const deletedCaches = [];
  let reloads = 0;
  let now = 1_800_000_000_000;

  return {
    environment: {
      navigator: {
        onLine: true,
        serviceWorker,
        storage: {
          estimate: async () => ({ usage: 138_000_000, quota: 500_000_000 }),
        },
      },
      localStorage: new MemoryStorage({
        offlineModeEnabled: enabled ? "true" : "false",
      }),
      fetch: async (_url, options) => {
        assert.strictEqual(options.cache, "no-store");
        return {
          ok: true,
          json: async () => ({
            version: remoteVersion,
            revision: remoteVersion.split("-").at(-1),
            offlineBytes: 172_000_000,
          }),
        };
      },
      caches: {
        keys: async () => ["astro-flash-precache", "unrelated-cache"],
        delete: async (name) => {
          deletedCaches.push(name);
          return true;
        },
      },
      location: {
        reload: () => {
          reloads += 1;
        },
      },
      Date: {
        now: () => now,
      },
      document: documentEvents,
      addEventListener: (...args) => windowEvents.addEventListener(...args),
    },
    deletedCaches,
    getReloads: () => reloads,
    setNow: (value) => {
      now = value;
    },
    serviceWorker,
    windowEvents,
  };
};

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

(async () => {
  const activatingWorker = new Worker();
  const activation = waitForWorker(activatingWorker);
  activatingWorker.transition("activated");
  await activation;

  const failedWorker = new Worker();
  const failure = waitForWorker(failedWorker);
  failedWorker.transition("redundant");
  await assert.rejects(failure, /interrupted/);

  const initialWorker = new Worker();
  const initialRegistration = new Registration({ installing: initialWorker });
  const initial = makeEnvironment({ registration: initialRegistration });
  const initialManager = createManager({
    currentVersion: "26.07.28-aaaaaaa",
    environment: initial.environment,
  });
  const enabling = initialManager.setEnabled(true);
  await flushPromises();
  assert.strictEqual(initialManager.getSnapshot().phase, "downloading");
  initialRegistration.active = initialWorker;
  initialRegistration.installing = null;
  initialWorker.transition("activated");
  await enabling;
  assert.strictEqual(initialManager.getSnapshot().phase, "ready");
  assert.strictEqual(
    initial.environment.localStorage.getItem("offlineModeEnabled"),
    "true",
  );
  assert.deepStrictEqual(initial.serviceWorker.registerCalls[0], [
    "sw.js",
    { updateViaCache: "none" },
  ]);

  const activeWorker = new Worker("activated");
  const updateRegistration = new Registration({ active: activeWorker });
  const update = makeEnvironment({
    registration: updateRegistration,
    enabled: true,
  });
  const updateManager = createManager({
    currentVersion: "26.07.28-aaaaaaa",
    environment: update.environment,
  });
  await updateManager.initialize();
  const waitingWorker = new Worker();
  updateRegistration.installing = waitingWorker;
  updateRegistration.dispatch("updatefound");
  updateRegistration.installing = null;
  updateRegistration.waiting = waitingWorker;
  waitingWorker.transition("installed");
  await flushPromises();
  assert.strictEqual(updateManager.getSnapshot().phase, "update-ready");
  assert.strictEqual(updateManager.getSnapshot().updateReady, true);
  await updateManager.applyUpdate();
  assert.deepStrictEqual(waitingWorker.messages, [{ type: "SKIP_WAITING" }]);
  update.serviceWorker.dispatch("controllerchange");
  assert.strictEqual(update.getReloads(), 1);

  const disabledRegistration = new Registration();
  const disabled = makeEnvironment({ registration: disabledRegistration });
  const disabledManager = createManager({
    currentVersion: "26.07.28-aaaaaaa",
    environment: disabled.environment,
  });
  await disabledManager.initialize();
  await flushPromises();
  assert.strictEqual(disabledManager.getSnapshot().downloadBytes, 172_000_000);
  assert.strictEqual(
    disabled.environment.localStorage.getItem("astroFlashDownloadVersion"),
    "26.07.29-bbbbbbb",
  );
  assert.strictEqual(disabledManager.getSnapshot().phase, "update-available");
  assert.strictEqual(
    disabled.environment.localStorage.getItem("astroFlashLastUpdateCheck"),
    "1800000000000",
  );
  await disabledManager.applyUpdate();
  assert.strictEqual(disabled.getReloads(), 1);

  await updateManager.setEnabled(false);
  assert.deepStrictEqual(update.deletedCaches, ["astro-flash-precache"]);
  assert.strictEqual(
    update.environment.localStorage.getItem("offlineModeEnabled"),
    "false",
  );
  assert.strictEqual(updateManager.getSnapshot().phase, "disabled");

  console.log("offline update tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
