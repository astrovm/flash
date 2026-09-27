// @ts-nocheck -- Game windows driven through the real shell with fake players.
import { afterEach, expect, test } from "bun:test";
import {
  cleanupShells,
  clickStartAction,
  flushShell,
  loadShell,
  login,
} from "./helpers/shell-harness";

afterEach(cleanupShells);

const settle = async () => {
  await flushShell();
  await flushShell();
};
const press = (s, target, key, options = {}) =>
  target.dispatchEvent(
    new s.window.KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...options,
    }),
  );

async function flashGame(options) {
  const s = await login(await loadShell(options));
  const players = [];
  s.window.RufflePlayer = {
    newest: () => ({
      createPlayer: () => {
        const player = s.document.createElement("ruffle-player");
        player.load = (config) => {
          player.config = config;
        };
        player.metadata = { frameRate: 24 };
        player.requestFullscreen = async () => {
          player.fullscreenRequested = true;
        };
        players.push(player);
        return player;
      },
    }),
  };
  const open = async (gameId) => {
    s.window.history.replaceState(null, "", `#${gameId}`);
    s.window.dispatchEvent(new s.window.HashChangeEvent("hashchange"));
    await settle();
    return s.document.querySelector(`.xp-window[data-game="${gameId}"]`);
  };
  return { s, players, open };
}

test("game menu bars toggle from clicks and keyboard shortcuts", async () => {
  const { s, players, open } = await flashGame();
  const win = await open("big-truck-adventures");
  const fileButton = win.querySelector(
    '.game-menu-button[data-game-menu="file"]',
  );
  const fileMenu = win.querySelector('.game-menu[data-game-menu="file"]');
  fileButton.click();
  expect(fileMenu.hidden).toBeFalse();
  fileButton.click();
  expect(fileMenu.hidden).toBeTrue();
  win
    .querySelector(".game-menu-bar")
    .dispatchEvent(new s.window.MouseEvent("click", { bubbles: true }));
  press(s, win.querySelector(".game-menu-bar"), "ArrowDown");
  press(s, fileButton, "Enter");
  expect(fileMenu.hidden).toBeFalse();
  press(s, fileButton, "Escape");
  expect(fileMenu.hidden).toBeTrue();
  press(s, fileButton, " ");
  expect(fileMenu.hidden).toBeFalse();
  press(s, fileButton, "Tab");
  press(s, fileMenu, "q");
  expect(fileMenu.hidden).toBeFalse();
  fileMenu.dispatchEvent(new s.window.MouseEvent("click", { bubbles: true }));
  press(s, win, "z", { altKey: true });
  press(s, win, "f", { altKey: true, ctrlKey: true });
  press(s, win, "f");

  const slider = win.querySelector(".game-volume-slider");
  const sliderMenu = slider.closest(".game-menu");
  if (sliderMenu) {
    slider.focus();
    press(s, slider, "ArrowLeft");
    expect(sliderMenu.hidden).toBeFalse();
  }

  win.querySelector('[data-game-action="fullscreen"]').click();
  expect(players.at(-1).fullscreenRequested).toBeTrue();
  win.querySelector('[data-game-action="properties"]').click();
  expect(s.document.querySelector(".xp-dialog").textContent).toContain(
    "Properties",
  );
  press(s, s.document.querySelector(".xp-dialog"), "Escape");

  win.querySelector(".maximize-btn").click();
  expect(win.classList.contains("maximized")).toBeTrue();
  win.querySelector(".maximize-btn").click();
  win.querySelector(".minimize-btn").click();
  await settle();
  expect(win.style.display).toBe("none");
  win.dispatchEvent(
    new s.window.PointerEvent("pointerdown", { bubbles: true }),
  );
  win.querySelector(".close-btn").click();
  expect(win.isConnected).toBeFalse();
});

test("system windows ignore fullscreen requests", async () => {
  const s = await login(await loadShell());
  clickStartAction(s, "documents");
  const win = s.document.querySelector(
    '.xp-window[data-game="__my-documents"]',
  );
  win.querySelector(".fullscreen-btn")?.click();
  expect(win.isConnected).toBeTrue();
});

test("Show Desktop minimizes open windows and restores them on the second toggle", async () => {
  const s = await login(await loadShell());
  clickStartAction(s, "documents");
  clickStartAction(s, "pictures");
  clickStartAction(s, "music");
  await settle();
  const win = (id) => s.document.querySelector(`.xp-window[data-game="${id}"]`);
  const hidden = (id) => win(id).style.display === "none";
  win("__my-music").querySelector(".minimize-btn").click();
  const toggle = async () => {
    s.document.getElementById("taskbar").dispatchEvent(
      new s.window.MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 400,
        clientY: 750,
      }),
    );
    s.document
      .querySelector(
        '#taskbar-context-menu [data-taskbar-action="show-desktop"]',
      )
      .click();
    await settle();
  };
  await toggle();
  expect(
    ["__my-documents", "__my-pictures", "__my-music"].every((id) => hidden(id)),
  ).toBeTrue();
  await toggle();
  expect(hidden("__my-documents")).toBeFalse();
  expect(hidden("__my-pictures")).toBeFalse();
  expect(hidden("__my-music")).toBeTrue();

  await toggle();
  win("__my-pictures").querySelector(".close-btn").click();
  await toggle();
  expect(hidden("__my-documents")).toBeFalse();
});

test("iframe games remove temporary data on close and add themselves to offline games", async () => {
  const removed = [];
  const downloads = [];
  let failRemoval = false;
  let failDownload = false;
  const { s, open } = await flashGame({
    gameDataManager: {
      list: async () => [],
      remove: async () => {},
      removeTemporary: async (...args) => {
        removed.push(args);
        if (failRemoval) throw new Error("locked");
      },
    },
    offlineMethods: {
      async downloadGame(gameId) {
        downloads.push(gameId);
        if (failDownload) throw new Error("quota");
      },
    },
  });
  const errors = [];
  const originalError = s.window.console.error;
  s.window.console.error = (...args) => errors.push(args);
  try {
    for (const gameId of ["pink-panther-hokus-pokus", "revcdos"]) {
      const win = await open(gameId);
      const frame = win.querySelector("iframe");
      const post = (data, source = frame.contentWindow) =>
        s.window.dispatchEvent(
          new s.window.MessageEvent("message", {
            data,
            origin: s.window.location.origin,
            source,
          }),
        );
      post({ event: "astro.offline-game-ready", gameId: "other" });
      post({ event: "astro.offline-game-ready", gameId }, null);
      post({ event: "astro.offline-game-ready", gameId });
      failDownload = true;
      post({ event: "astro.offline-game-ready", gameId });
      failDownload = false;
      post({ event: "astro.game-data-retention", gameId, keep: true });
      post({ event: "astro.game-data-retention", gameId, keep: false }, null);
      post({
        event: "astro.game-data-retention",
        gameId,
        keep: false,
        fileName: "pokus-a.iso",
      });
      failRemoval = gameId === "revcdos";
      win.querySelector(".close-btn").click();
      await settle();
      await settle();
      expect(win.isConnected).toBeFalse();
    }
  } finally {
    s.window.console.error = originalError;
  }
  expect(downloads).toEqual([
    "pink-panther-hokus-pokus",
    "pink-panther-hokus-pokus",
    "revcdos",
    "revcdos",
  ]);
  expect(removed).toEqual([
    ["pink-panther-hokus-pokus", "pokus-a.iso"],
    ["revcdos", "pokus-a.iso"],
  ]);
  expect(errors.length).toBeGreaterThan(0);
});

test("unsaved Notepad windows ask before closing", async () => {
  const s = await login(await loadShell()),
    fs = s.window.VirtualFS;
  fs.open(fs.createFile(fs.MY_DOCUMENTS, "draft.txt").id);
  await settle();
  const win = s.document.querySelector(".notepad-window");
  const text = win.querySelector("textarea");
  text.value = "draft";
  text.dispatchEvent(new s.window.Event("input", { bubbles: true }));
  win.querySelector(".close-btn").click();
  await settle();
  const dialog = () => [...s.document.querySelectorAll(".xp-dialog")].at(-1);
  expect(dialog().textContent).toMatch(/save/i);
  dialog().querySelector('[data-action="cancel"]').click();
  await settle();
  expect(win.isConnected).toBeTrue();
  win.querySelector(".close-btn").click();
  win.querySelector(".close-btn").click();
  await settle();
  dialog().querySelector('[data-action="no"]').click();
  await settle();
  expect(win.isConnected).toBeFalse();
});

test("game volume controls handle unfocused windows, invalid values, and silent restores", async () => {
  const { s, players, open } = await flashGame({
    initialStorage: {
      gameVolumes: JSON.stringify({
        "big-truck-adventures": { volume: "loud", isMuted: false },
        "bike-mania": { volume: 0, isMuted: true },
      }),
    },
  });
  const truck = await open("big-truck-adventures");
  expect(truck.querySelector(".game-volume-slider").value).toBe("100");
  const bike = await open("bike-mania");
  const truckPlayer = players[0];
  const slider = truck.querySelector(".game-volume-slider");
  slider.value = "";
  slider.dispatchEvent(new s.window.Event("input"));
  slider.value = "40";
  slider.dispatchEvent(new s.window.Event("input"));
  truck.querySelector(".volume-btn").click();
  truck.querySelector(".volume-btn").click();
  expect(truckPlayer.volume ?? 0).toBe(0);
  bike.querySelector(".volume-btn").click();
  expect(
    JSON.parse(s.window.localStorage.getItem("gameVolumes"))["bike-mania"],
  ).toMatchObject({ volume: 100, isMuted: false });

  s.document.getElementById("start-button").click();
  s.document.getElementById("all-programs-button").click();
  bike.querySelector(".favorite-btn").click();
  expect(s.window.localStorage.getItem("favorites")).toContain("bike-mania");
});
