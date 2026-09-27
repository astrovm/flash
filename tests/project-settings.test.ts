// @ts-nocheck -- Happy DOM supplies browser event and element types.
import { afterEach, expect, test } from "bun:test";
import {
  cleanupShells,
  loadShell,
  login,
  flushShell,
} from "./helpers/shell-harness";
afterEach(cleanupShells);
async function setup(options = {}) {
  const s = await login(await loadShell(options));
  s.document
    .querySelector('[data-desktop-id="__astro-settings"]')
    .dispatchEvent(new s.window.MouseEvent("dblclick", { bubbles: true }));
  const content = s.document.querySelector(".project-settings-content");
  await flushShell();
  const action = (id) => content.querySelector(`[data-project-action="${id}"]`);
  const setting = (id, value) => {
    const el = content.querySelector(`[data-project-setting="${id}"]`);
    if (typeof value === "boolean") el.checked = value;
    else el.value = String(value);
    el.dispatchEvent(new s.window.Event("change", { bubbles: true }));
    return el;
  };
  const answer = async (text = "Yes") => {
    [...s.document.querySelectorAll(".xp-dialog .dlg-buttons button")]
      .find((b) => b.textContent === text)
      .click();
    await flushShell();
    await flushShell();
  };
  const state = (updates) => {
    Object.assign(s.offlineSnapshot, updates);
    s.notifyOfflineListeners();
  };
  return { s, content, action, setting, answer, state };
}
test("settings tabs, startup and update preferences invoke the manager and format delays", async () => {
  const calls = [];
  const h = await setup({
    offlineMethods: {
      setAutomaticUpdateDelay: (d) => calls.push(d),
      checkForUpdates: async (opts) => calls.push(opts),
      updateNow: async () => calls.push("update"),
    },
  });
  const tabs = [...h.content.querySelectorAll('[role="tab"]')];
  for (const [key, expected] of [
    ["End", 3],
    ["Home", 0],
    ["ArrowRight", 1],
    ["ArrowLeft", 3],
  ]) {
    h.s.document.activeElement?.blur();
    tabs[0].dispatchEvent(
      new h.s.window.KeyboardEvent("keydown", { key, bubbles: true }),
    );
    expect(h.content.querySelector('[aria-selected="true"]').id).toBe(
      tabs[expected].id,
    );
  }
  h.setting("full-startup", true);
  expect(h.s.window.localStorage.getItem("fullStartup")).toBe("true");
  h.setting("full-startup", false);
  expect(h.s.window.localStorage.getItem("fullStartup")).toBeNull();
  h.setting("save-played-games", false);
  expect(h.s.offlineSnapshot.savePlayedGamesOffline).toBeFalse();
  h.setting("automatic-updates", false);
  expect(h.s.offlineSnapshot.automaticUpdatesEnabled).toBeFalse();
  h.setting("automatic-updates", true);
  for (const [hours, label] of [
    [0, "No delay"],
    [1, "1 hour"],
    [24, "1 day"],
    [49, "2 days 1 hour"],
  ]) {
    const input = h.content.querySelector(
      '[data-project-setting="update-delay"]',
    );
    input.value = String(hours);
    input.dispatchEvent(new h.s.window.Event("input"));
    expect(
      h.content.querySelector('[data-project-value="update-delay"]').value,
    ).toBe(label);
    h.setting("update-delay", hours);
    expect(calls).toContain(hours * 3600000);
  }
  expect(calls).toContainEqual({ applyAutomatically: true });
  h.action("check").click();
  h.action("update-now").click();
  expect(calls).toContain("update");
  h.setting("offline-enabled", false);
  await h.answer("No");
  expect(h.s.offlineSnapshot.enabled).toBeTrue();
  h.setting("offline-enabled", false);
  await h.answer();
  expect(h.s.offlineSnapshot.enabled).toBeFalse();
  h.setting("offline-enabled", true);
  await flushShell();
  expect(h.s.offlineSnapshot.enabled).toBeTrue();
});
test("settings renders update progress, scheduled releases, storage and disabled states", async () => {
  const h = await setup();
  for (const phase of [
    "starting",
    "downloading",
    "checking",
    "updating",
    "applying",
    "repairing",
  ]) {
    h.state({ phase });
    expect(h.action("check").disabled).toBeTrue();
    expect(
      h.content.querySelector("[data-project-update-progress]").hidden,
    ).toBeFalse();
  }
  h.state({
    phase: "update-pending",
    updateEligibleAt: Date.now(),
    availableVersion: "next",
    lastChecked: Date.now(),
    usage: 1024,
    downloadBytes: null,
    downloadMetadataError: true,
  });
  expect(
    h.content.querySelector('[data-project-status="updates"]').textContent,
  ).toContain("scheduled");
  h.state({ phase: "update-ready", updateReady: true });
  expect(
    h.content.querySelector('[data-project-status="updates"]').textContent,
  ).toContain("next visit");
  h.state({ phase: "ready", updateReady: false });
  expect(
    h.content.querySelector('[data-project-status="updates"]').textContent,
  ).toContain("is available");
  h.state({ availableVersion: null });
  expect(
    h.content.querySelector('[data-project-status="updates"]').textContent,
  ).toContain("up to date");
  h.state({
    phase: "error",
    error: "Disk full",
    online: false,
    usage: null,
    workerState: "waiting",
  });
  expect(
    h.content.querySelector('[data-project-status="updates"]').textContent,
  ).toBe("Disk full");
  expect(h.action("update-now").disabled).toBeTrue();
  h.state({
    gamePhase: "downloading",
    activeGameId: "freecell",
    gameProgressLoaded: 2,
    gameProgressTotal: 4,
  });
  expect(h.content.querySelector("[data-project-game-progress]").value).toBe(2);
  h.state({ gamePhase: "removing", downloadedGameIds: ["freecell"] });
  expect(h.action("remove-all-games").disabled).toBeTrue();
  h.state({ gamePhase: "idle", enabled: false, bundledGames: [] });
  expect(
    h.content.querySelector("[data-project-offline-games]").textContent,
  ).toContain("Enable offline");
  h.state({ enabled: true });
  expect(
    h.content.querySelector("[data-project-offline-games]").textContent,
  ).toContain("Loading");
  h.content.closest(".xp-window").querySelector(".close-btn").click();
  expect(h.content.isConnected).toBeFalse();
});
test("offline game downloads, removal and repair handle success, cancellation and errors", async () => {
  const calls = [];
  const fail = async () => {
    throw new Error("storage unavailable");
  };
  const h = await setup({
    offlineMethods: {
      removeGame: async (id) => calls.push(id),
      downloadAllGames: fail,
      removeAllGames: fail,
      repair: fail,
    },
  });
  const checkbox = h.content.querySelector('[data-offline-game="freecell"]');
  checkbox.checked = true;
  checkbox.dispatchEvent(new h.s.window.Event("change", { bubbles: true }));
  expect(h.s.offlineDownloads).toContain("freecell");
  const checked = h.content.querySelector('[data-offline-game="freecell"]');
  checked.checked = false;
  checked.dispatchEvent(new h.s.window.Event("change", { bubbles: true }));
  expect(calls).toEqual(["freecell"]);
  h.action("download-all-games").click();
  await flushShell();
  expect(
    h.content.querySelector('[data-project-status="offline-games"]')
      .textContent,
  ).toBe("storage unavailable");
  h.action("remove-all-games").click();
  await h.answer("No");
  h.action("remove-all-games").click();
  await h.answer();
  expect(
    h.content.querySelector('[data-project-status="offline-games"]')
      .textContent,
  ).toBe("storage unavailable");
  h.action("repair").click();
  await h.answer("No");
  h.action("repair").click();
  await h.answer();
  expect(
    h.content.querySelector('[data-project-status="offline"]').textContent,
  ).toBe("storage unavailable");
  for (const id of ["restore-desktop", "reset"]) {
    h.action(id).click();
    await h.answer("No");
  }
});
test("installed game data lists both stores, removes only the selected item and reports failures", async () => {
  const installed = [{ id: "internet", title: "Internet Game", bytes: 100 }],
    external = [{ id: "iso", title: "CD data", detail: "ISO", bytes: 200 }],
    removed = [];
  let fail = false;
  const library = {
    subscribe: () => () => {},
    initialize: async () => ({}),
    getInstallations: async () => installed,
    uninstall: async (id) => {
      removed.push(id);
      installed.length = 0;
    },
  };
  const data = {
    list: async () => external,
    remove: async (id) => {
      if (fail) throw new Error("remove failed");
      removed.push(id);
      external.length = 0;
    },
  };
  const h = await setup({
    gameLibraryManager: library,
    gameDataManager: data,
    offlineMethods: { refreshStorageEstimate: async () => {} },
  });
  h.content.querySelector("#project-tab-games").click();
  await flushShell();
  expect(h.content.querySelectorAll("[data-game-data-id]").length).toBe(2);
  h.content.querySelector('[data-game-data-id="internet"]').click();
  await h.answer();
  expect(removed).toEqual(["internet"]);
  fail = true;
  h.content.querySelector('[data-game-data-id="iso"]').click();
  await h.answer();
  expect(
    h.content.querySelector('[data-project-status="game-data"]').textContent,
  ).toBe("remove failed");
  fail = false;
  h.content.querySelector('[data-game-data-id="iso"]').click();
  await h.answer();
  expect(removed).toEqual(["internet", "iso"]);
  expect(
    h.content.querySelector("[data-project-game-data]").textContent,
  ).toContain("No installed games");
  h.s.window.dispatchEvent(new h.s.window.StorageEvent("storage"));
  h.s.window.dispatchEvent(
    new h.s.window.MessageEvent("message", {
      origin: h.s.window.location.origin,
      data: { event: "astro.game-data-changed" },
    }),
  );
  await flushShell();
  expect(
    h.content.querySelector('[data-project-status="game-data"]').textContent,
  ).toBe("");
});
test("date and time properties edit the shell clock, calendar, spinner and sync controls", async () => {
  const s = await login(await loadShell());
  s.document
    .getElementById("taskbar-clock")
    .dispatchEvent(
      new s.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
  const dialog = s.document.querySelector(".datetime-dialog");
  const button = (text) =>
    [...dialog.querySelectorAll("button")].find((b) => b.textContent === text);
  const change = (selector, value) => {
    const el = dialog.querySelector(selector);
    el.value = value;
    el.dispatchEvent(new s.window.Event("change", { bubbles: true }));
    return el;
  };
  const year = change('[aria-label="Year"]', "2024");
  change('[aria-label="Month"]', "1");
  expect(dialog.querySelectorAll(".dlg-calendar-day").length).toBe(29);
  [...dialog.querySelectorAll(".dlg-calendar-day")]
    .find((b) => b.textContent === "29")
    .click();
  change('[aria-label="Year"]', "2025");
  expect(dialog.querySelector(".dlg-calendar-day.selected").textContent).toBe(
    "28",
  );
  change('[aria-label="Year"]', "2500");
  expect(year.value).toBe("2099");
  change('[aria-label="Year"]', "1800");
  expect(year.value).toBe("1901");
  change('[aria-label="Year"]', "");
  expect(year.value).toBe("1901");
  change('[aria-label="Year"]', "2025");
  const time = change('[aria-label="Time"]', "11:59:59 PM");
  dialog.querySelector('[aria-label="Increase time"]').click();
  expect(time.value).toBe("12:00:00 AM");
  dialog.querySelector('[aria-label="Decrease time"]').click();
  expect(time.value).toBe("11:59:59 PM");
  button("Apply").click();
  expect(button("Apply").disabled).toBeTrue();
  const clockOffset = Number(s.window.localStorage.getItem("clockOffsetMs"));
  const chosen = new Date(Date.now() + clockOffset);
  expect([
    chosen.getFullYear(),
    chosen.getMonth(),
    chosen.getDate(),
    chosen.getHours(),
    chosen.getMinutes(),
  ]).toEqual([2025, 1, 28, 23, 59]);
  button("Time Zone").click();
  expect(dialog.querySelector(".datetime-time-zone-panel").hidden).toBeFalse();
  button("Internet Time").click();
  const sync = dialog.querySelector(".datetime-sync-label input");
  sync.checked = false;
  sync.dispatchEvent(new s.window.Event("change"));
  expect(button("Update Now").disabled).toBeTrue();
  sync.checked = true;
  sync.dispatchEvent(new s.window.Event("change"));
  button("Update Now").click();
  expect(dialog.querySelector(".datetime-sync-status").textContent).toContain(
    "error occurred",
  );
  dialog.querySelector('[aria-label="Help"]').click();
  expect(s.document.querySelectorAll(".xp-dialog").length).toBe(2);
  [...s.document.querySelectorAll(".xp-dialog .dlg-buttons button")]
    .filter((b) => b.textContent === "OK")
    .at(-1)
    .click();
  button("Date & Time").click();
  change('[aria-label="Time"]', "invalid");
  button("OK").click();
  expect(dialog.isConnected).toBeFalse();
});

test("restoring the desktop and resetting reload the page or report failures", async () => {
  const h = await setup();
  let reloads = 0;
  Object.defineProperty(h.s.window.location, "reload", {
    configurable: true,
    value: () => reloads++,
  });
  for (const id of ["restore-desktop", "reset"]) {
    h.action(id).click();
    await h.answer("Yes");
    await flushShell();
  }
  expect(reloads).toBe(2);
  const transaction = h.s.window.VirtualFS.transaction;
  const reset = h.s.window.VirtualFS.reset;
  h.s.window.VirtualFS.transaction = async () => {
    throw new Error("");
  };
  h.s.window.VirtualFS.reset = async () => {
    throw new Error("");
  };
  try {
    for (const id of ["restore-desktop", "reset"]) {
      h.action(id).click();
      await h.answer("Yes");
      await flushShell();
      expect(
        [...h.s.document.querySelectorAll(".xp-dialog")].at(-1).textContent,
      ).toContain("The file operation failed.");
      await h.answer("OK");
    }
  } finally {
    h.s.window.VirtualFS.transaction = transaction;
    h.s.window.VirtualFS.reset = reset;
  }
});

test("settings report failed offline changes and skip update checks when automatic updates are off", async () => {
  const calls = [];
  let gamesChanged;
  const h = await setup({
    offlineSettings: { automaticUpdatesEnabled: false },
    gameLibraryManager: {
      subscribe: (listener) => {
        gamesChanged = listener;
        return () => {};
      },
      initialize: async () => ({}),
      getInstallations: async () => [],
    },
    offlineMethods: {
      setOfflineEnabled: async () => {
        throw new Error("worker unavailable");
      },
      downloadGame: async () => {
        throw new Error("quota exceeded");
      },
      checkForUpdates: async (options) => {
        calls.push(options);
        throw new Error("offline");
      },
      updateNow: async () => {
        throw new Error("offline");
      },
      refreshStorageEstimate: async () => {},
    },
  });
  h.setting("update-delay", 2);
  expect(calls).toEqual([]);
  h.action("check").click();
  h.action("update-now").click();
  await flushShell();
  h.setting("offline-enabled", false);
  await h.answer("Yes");
  await flushShell();
  expect(
    h.content.querySelector('[data-project-status="offline"]').textContent,
  ).toBe("worker unavailable");
  const checkbox = h.content.querySelector('[data-offline-game="freecell"]');
  checkbox.checked = true;
  checkbox.dispatchEvent(new h.s.window.Event("change", { bubbles: true }));
  await flushShell();
  expect(
    h.content.querySelector('[data-project-status="offline-games"]')
      .textContent,
  ).toBe("quota exceeded");
  h.content
    .querySelector("[data-project-offline-games], .project-offline-games")
    ?.dispatchEvent(new h.s.window.Event("change", { bubbles: true }));
  gamesChanged({});
  await flushShell();
});

test("game data removal ignores stray clicks and declined confirmations", async () => {
  const external = [{ id: "iso", title: "CD data", detail: "ISO", bytes: 1 }];
  const removed = [];
  const h = await setup({
    gameDataManager: {
      list: async () => external,
      remove: async (id) => removed.push(id),
    },
  });
  h.content.querySelector("#project-tab-games").click();
  await flushShell();
  const list = h.content.querySelector("[data-project-game-data]");
  list.dispatchEvent(new h.s.window.MouseEvent("click", { bubbles: true }));
  h.content.querySelector('[data-game-data-id="iso"]').click();
  await h.answer("No");
  expect(removed).toEqual([]);
});

test("settings describe unusual offline states", async () => {
  const h = await setup();
  const value = (id) =>
    h.content.querySelector(`[data-project-value="${id}"]`)?.textContent;
  h.state({
    phase: "mystery",
    workerState: "",
    downloadBytes: null,
    downloadMetadataError: false,
    updateReady: true,
    availableVersion: null,
    automaticUpdateDelayMs: null,
    releaseUpdateDelayMs: 2 * 60 * 60 * 1000,
  });
  expect(value("offlineFiles")).toBe("Unavailable");
  expect(value("downloadSize")).toBe("Checking...");
  expect(
    h.content.querySelector('[data-project-status="offline"]').textContent,
  ).toContain("Offline status is unavailable.");
  expect(h.content.textContent).toContain("Astro Flash update is ready");
  expect(
    h.content.querySelector('[data-project-setting="update-delay"]').value,
  ).toBe("2");
  h.s.window.dispatchEvent(
    new h.s.window.MessageEvent("message", {
      origin: "https://elsewhere.example",
      data: { event: "astro.game-data-changed" },
    }),
  );
  h.s.window.dispatchEvent(
    new h.s.window.MessageEvent("message", {
      origin: h.s.window.location.origin,
      data: { event: "other" },
    }),
  );
});

test("the tray volume menu opens Volume Control and ignores invalid levels", async () => {
  const s = await login(
    await loadShell({
      initialStorage: { taskbarSettings: JSON.stringify({ edge: "top" }) },
    }),
  );
  const button = s.document.getElementById("tray-volume-button");
  button.click();
  expect(s.document.getElementById("tray-volume-popup").hidden).toBeFalse();
  const slider = s.document.getElementById("tray-volume-slider");
  slider.value = "abc";
  slider.dispatchEvent(new s.window.Event("input"));
  button.dispatchEvent(
    new s.window.MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
  );
  const menu = s.document.getElementById("tray-volume-menu");
  expect(menu.hidden).toBeFalse();
  menu.querySelector("button").click();
  await flushShell();
  expect(
    !!s.document.querySelector('.xp-window[data-game="__volume-control"]'),
  ).toBeTrue();
  const clock = s.document.getElementById("taskbar-clock");
  clock.dispatchEvent(
    new s.window.KeyboardEvent("keydown", { key: "a", bubbles: true }),
  );
  clock.dispatchEvent(
    new s.window.KeyboardEvent("keydown", { key: " ", bubbles: true }),
  );
  expect(!!s.document.querySelector(".xp-dialog")).toBeTrue();
});

test("offline initialization failures and played-game downloads are reported", async () => {
  const errors = [];
  const warnings = [];
  const s = await loadShell({
    offlineSettings: { savePlayedGamesOffline: true, enabled: true },
    offlineMethods: {
      initialize: async () => {
        throw new Error("worker blocked");
      },
      downloadGame: async () => {
        throw new Error("quota");
      },
    },
  });
  s.window.console.error = (...args) => errors.push(args);
  s.window.console.warn = (...args) => warnings.push(args);
  await login(s);
  await flushShell();
  s.window.history.replaceState(null, "", "#freecell");
  s.window.dispatchEvent(new s.window.HashChangeEvent("hashchange"));
  await flushShell();
  await flushShell();
  Object.defineProperty(s.window.navigator, "onLine", {
    configurable: true,
    value: false,
  });
  s.window.history.replaceState(null, "", "#hearts");
  s.window.dispatchEvent(new s.window.HashChangeEvent("hashchange"));
  await flushShell();
  expect(warnings.length + errors.length).toBeGreaterThan(0);
});
