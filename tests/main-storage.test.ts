// @ts-nocheck -- Shell storage, screen saver, and playback helpers.
import { afterEach, expect, test } from "bun:test";
import {
  cleanupShells,
  flushShell,
  loadShell,
  login,
} from "./helpers/shell-harness";

afterEach(cleanupShells);

const settle = async () => {
  for (let i = 0; i < 4; i++) await flushShell();
};

test("malformed stored preferences fall back to defaults", async () => {
  const errors = [];
  const s = await loadShell({
    initialStorage: {
      favorites: "{broken",
      displaySettings: JSON.stringify({ screenSaver: "flying-toasters" }),
      desktopSystemIcons: "null",
      desktopSystemNames: "null",
      volume: "loud",
    },
  });
  s.window.console.error = (...args) => errors.push(args);
  await login(s);
  s.document.getElementById("start-button").click();
  expect(
    errors.some(([message]) => message.includes("Error parsing favorites")),
  ).toBeTrue();
  expect(s.document.getElementById("screen-saver-overlay").dataset.saver).toBe(
    "pipes",
  );
  const invalid = await login(
    await loadShell({
      initialStorage: { displaySettings: JSON.stringify({ theme: "neon" }) },
    }),
  );
  expect(invalid.document.documentElement.dataset.xpAppearance).toBe("blue");
});

test("failed preference writes are reported without interrupting the shell", async () => {
  const s = await login(await loadShell());
  const real = s.window.localStorage;
  const errors = [];
  s.window.console.error = (...args) => errors.push(args);
  Object.defineProperty(s.window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => real.getItem(key),
      removeItem: (key) => real.removeItem(key),
      setItem() {
        throw new Error("quota");
      },
    },
  });
  try {
    s.document.getElementById("taskbar").dispatchEvent(
      new s.window.MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      }),
    );
    s.document.querySelector('[data-taskbar-action="lock"]').click();
  } finally {
    Object.defineProperty(s.window, "localStorage", {
      configurable: true,
      value: real,
    });
  }
  expect(
    errors.some(([message]) => message.includes("Error storing")),
  ).toBeTrue();
});

test("the screen saver starts after the idle wait and keeps a running pipes animation", async () => {
  const s = await login(
    await loadShell({
      initialStorage: {
        displaySettings: JSON.stringify({
          screenSaver: "pipes",
          screenSaverWait: 1,
        }),
      },
    }),
  );
  await s.advanceTime(60_000);
  const overlay = s.document.getElementById("screen-saver-overlay");
  expect(overlay.hidden).toBeFalse();
  const frame = overlay.querySelector(".pipes-screen-saver");
  expect(frame).toBeTruthy();
  await s.advanceTime(60_000);
  expect(overlay.querySelector(".pipes-screen-saver")).toBe(frame);
});

test("fullscreen toggles exit when already fullscreen and report refused requests", async () => {
  const s = await login(await loadShell());
  const players = [];
  s.window.RufflePlayer = {
    newest: () => ({
      createPlayer: () => {
        const player = s.document.createElement("ruffle-player");
        player.load = () => {};
        player.requestFullscreen = () => Promise.reject(new Error("denied"));
        Object.defineProperty(player, "volume", {
          set() {
            throw new Error("not ready");
          },
        });
        players.push(player);
        return player;
      },
    }),
  };
  const errors = [];
  s.window.console.error = (...args) => errors.push(args);
  s.window.history.replaceState(null, "", "#bike-mania");
  s.window.dispatchEvent(new s.window.HashChangeEvent("hashchange"));
  await settle();
  const win = s.document.querySelector('.xp-window[data-game="bike-mania"]');
  players[0].dispatchEvent(new s.window.Event("loadedmetadata"));
  win.querySelector(".fullscreen-btn").click();
  await settle();
  let exited = 0;
  Object.defineProperty(s.document, "fullscreenElement", {
    configurable: true,
    value: players[0],
  });
  s.document.exitFullscreen = () => exited++;
  win.querySelector(".fullscreen-btn").click();
  expect(exited).toBe(1);
  expect(
    errors.some(([message]) =>
      String(message).includes("Error setting SWF volume"),
    ),
  ).toBeTrue();
  expect(
    errors.some(([message]) =>
      String(message).includes("Error attempting to enable fullscreen"),
    ),
  ).toBeTrue();
});
