// @ts-nocheck
import { afterEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const recoveryPath = require.resolve("../site/js/startup-recovery.js");
const { createStartupRecovery } = require(recoveryPath);
const windows = [];

afterEach(() => {
  windows.splice(0).forEach((window) => window.close());
  delete require.cache[recoveryPath];
});

const makeEnvironment = ({ htmlVersion = "26.08.12-abcdef1" } = {}) => {
  const window = new Window({ url: "https://flash.example/" });
  windows.push(window);
  const values = new Map();
  const timers = [];
  const deletedCaches = [];
  const errors = [];
  let unregisters = 0;
  let replacement = null;
  let historyReplacement = null;
  const environment = {
    URL,
    DOMParser: window.DOMParser,
    Date: { now: () => 1_800_000_000_000 },
    caches: {
      keys: async () => [
        "astro-flash-precache-v2",
        "astro-bundled-games-v1",
        "astro-installed-games-v1",
      ],
      delete: async (name) => {
        deletedCaches.push(name);
        return true;
      },
    },
    clearTimeout() {},
    console: { error: (...values) => errors.push(values) },
    fetch: async (url, options) => {
      expect(options).toEqual({ cache: "no-store" });
      if (String(url).startsWith("/version.json?")) {
        return new Response(JSON.stringify({ version: "26.08.12-abcdef1" }));
      }
      return new Response(
        `<meta name="astro-version" content="${htmlVersion}" />`,
      );
    },
    history: {
      replaceState: (_state, _title, url) => {
        historyReplacement = url;
      },
    },
    location: {
      href: "https://flash.example/",
      replace: (url) => {
        replacement = url;
      },
    },
    navigator: {
      onLine: true,
      serviceWorker: {
        getRegistrations: async () => [
          {
            unregister: async () => {
              unregisters += 1;
              return true;
            },
          },
        ],
      },
    },
    sessionStorage: {
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, String(value)),
    },
    setTimeout: (callback, delay) => {
      timers.push({ callback, delay });
      return timers.length;
    },
  };
  return {
    deletedCaches,
    environment,
    errors,
    getHistoryReplacement: () => historyReplacement,
    getReplacement: () => replacement,
    getUnregisters: () => unregisters,
    timers,
    values,
  };
};

describe("startup recovery", () => {
  test("silently reloads a verified release and preserves user game caches", async () => {
    const recovery = makeEnvironment();
    createStartupRecovery(recovery.environment);

    expect(recovery.timers[0].delay).toBe(12_000);
    await recovery.timers[0].callback();

    expect(recovery.getUnregisters()).toBe(1);
    expect(recovery.deletedCaches).toEqual(["astro-flash-precache-v2"]);
    expect(recovery.getReplacement()).toContain(
      "__astro_recovery=26.08.12-abcdef1-1800000000000",
    );
    expect(recovery.values.has("astroFlashStartupRecovery")).toBeTrue();
    expect(recovery.errors).toEqual([]);
  });

  test("does not clear caches when the recovery page version is inconsistent", async () => {
    const recovery = makeEnvironment({ htmlVersion: "stale" });
    createStartupRecovery(recovery.environment);

    await recovery.timers[0].callback();

    expect(recovery.getUnregisters()).toBe(0);
    expect(recovery.deletedCaches).toEqual([]);
    expect(recovery.getReplacement()).toBeNull();
    expect(recovery.timers[1].delay).toBe(30_000);
    expect(recovery.errors).toHaveLength(1);
  });

  test("cancels recovery and cleans its URL after a successful startup", () => {
    const recovery = makeEnvironment();
    recovery.environment.location.href =
      "https://flash.example/?__astro_recovery=old#game";
    recovery.values.set("astroFlashStartupRecovery", "previous");
    const manager = createStartupRecovery(recovery.environment);

    manager.markReady();

    expect(recovery.values.has("astroFlashStartupRecovery")).toBeFalse();
    expect(recovery.getHistoryReplacement()).toBe(
      "https://flash.example/#game",
    );
  });
});

describe("startup recovery edge cases", () => {
  const { readFileSync } = require("node:fs");
  const { createContext, runInContext } = require("node:vm");
  const { instrumentSource } = require("./helpers/coverage");

  test("installs itself on the page when loaded as a classic script", () => {
    const timers = [];
    const context = createContext({
      __coverage__: globalThis.__coverage__,
      clearTimeout() {},
      setTimeout: (callback, delay) => timers.push(delay),
    });
    runInContext(
      instrumentSource(readFileSync(recoveryPath, "utf8"), recoveryPath),
      context,
    );
    expect(typeof context.__ASTRO_STARTUP_READY__).toBe("function");
    expect(timers).toEqual([12_000]);
  });

  test("skips recovery after startup or an earlier attempt and waits while offline", async () => {
    const ready = makeEnvironment();
    const manager = createStartupRecovery(ready.environment);
    manager.markReady();
    await manager.recover();
    expect(ready.getReplacement()).toBeNull();
    expect(ready.getHistoryReplacement()).toBeNull();

    const attempted = makeEnvironment();
    attempted.values.set("astroFlashStartupRecovery", "1");
    await createStartupRecovery(attempted.environment).recover();
    expect(attempted.getReplacement()).toBeNull();

    const offline = makeEnvironment();
    offline.environment.navigator.onLine = false;
    await createStartupRecovery(offline.environment, {
      retryTimeout: 5,
    }).recover();
    expect(offline.timers.at(-1).delay).toBe(5);
  });

  test("retries after failed or invalid version checks and recovery pages", async () => {
    for (const [respond, message] of [
      [() => new Response("down", { status: 503 }), "Version check failed"],
      [() => Response.json({ version: 1 }), "Version metadata is invalid"],
      [
        (url) =>
          String(url).startsWith("/version.json")
            ? Response.json({ version: "26.08.12-abcdef1" })
            : new Response("down", { status: 503 }),
        "Recovery page failed",
      ],
    ]) {
      const recovery = makeEnvironment();
      recovery.environment.fetch = async (url) => respond(url);
      await createStartupRecovery(recovery.environment).recover();
      expect(recovery.errors[0][1].message).toBe(message);
      expect(recovery.timers.at(-1).delay).toBe(30_000);
    }
  });

  test("leaves a page alone when startup finishes during the checks", async () => {
    const recovery = makeEnvironment();
    const fetch = recovery.environment.fetch;
    const startup = createStartupRecovery(recovery.environment);
    recovery.environment.fetch = async (url, options) => {
      startup.markReady();
      return fetch(url, options);
    };

    await recovery.timers[0].callback();

    expect(recovery.getUnregisters()).toBe(0);
    expect(recovery.deletedCaches).toEqual([]);
    expect(recovery.getReplacement()).toBeNull();
    expect(recovery.values.has("astroFlashStartupRecovery")).toBeFalse();
  });

  test("does not reload when startup finishes while caches are cleared", async () => {
    const recovery = makeEnvironment();
    const startup = createStartupRecovery(recovery.environment);
    recovery.environment.caches.keys = async () => {
      startup.markReady();
      return ["astro-flash-precache-v2"];
    };

    await recovery.timers[0].callback();

    expect(recovery.getReplacement()).toBeNull();
    expect(recovery.values.has("astroFlashStartupRecovery")).toBeFalse();
  });

  test("stops retrying when startup finishes before a check fails", async () => {
    const recovery = makeEnvironment();
    const startup = createStartupRecovery(recovery.environment);
    recovery.environment.fetch = async () => {
      startup.markReady();
      return new Response("down", { status: 503 });
    };

    await recovery.timers[0].callback();

    expect(recovery.errors).toEqual([]);
    expect(recovery.timers).toHaveLength(1);
  });

  test("recovers without service workers or Cache Storage", async () => {
    const recovery = makeEnvironment();
    delete recovery.environment.navigator.serviceWorker;
    delete recovery.environment.caches;
    await createStartupRecovery(recovery.environment).recover();
    expect(recovery.getReplacement()).toContain("__astro_recovery=");
    expect(recovery.deletedCaches).toEqual([]);
  });
});
