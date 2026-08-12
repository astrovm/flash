// @ts-nocheck
import { afterEach, expect, test } from "bun:test";
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

test("a successful startup cancels recovery and cleans its URL", () => {
  const recovery = makeEnvironment();
  recovery.environment.location.href =
    "https://flash.example/?__astro_recovery=old#game";
  recovery.values.set("astroFlashStartupRecovery", "previous");
  const manager = createStartupRecovery(recovery.environment);

  manager.markReady();

  expect(recovery.values.has("astroFlashStartupRecovery")).toBeFalse();
  expect(recovery.getHistoryReplacement()).toBe("https://flash.example/#game");
});
