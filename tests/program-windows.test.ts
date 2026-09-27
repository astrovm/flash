// @ts-nocheck -- Program and system windows opened through the real shell.
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
  for (let i = 0; i < 4; i++) await flushShell();
};
const dialogText = (s) =>
  [...s.document.querySelectorAll(".xp-dialog")].at(-1)?.textContent || "";
const runCommand = async (s, command) => {
  clickStartAction(s, "run");
  const dialog = s.document.querySelector(".run-dialog");
  dialog.querySelector("#run-command").value = command;
  dialog.querySelector('[data-action="run"]').click();
  await settle();
};
// Serves selected applications from test doubles while leaving the rest of
// the real registry in place.
const overrideRegistry = (s, overrides) => {
  const registry = s.window.XPApplicationRegistry;
  s.window.XPApplicationRegistry = {
    ...registry,
    get: (id) => (id in overrides ? overrides[id] : registry.get(id)),
    values: () => registry.values(),
  };
};

test("system windows load lazily and report load failures", async () => {
  const s = await login(await loadShell({ preloadApplications: false }));
  clickStartAction(s, "documents");
  await settle();
  expect(
    !!s.document.querySelector('.xp-window[data-game="__my-documents"]'),
  ).toBeTrue();

  overrideRegistry(s, {
    "__my-music": {
      kind: "system",
      title: "My Music",
      loaded: null,
      load: () => Promise.reject(new Error("")),
    },
    "__my-pictures": { kind: "program" },
  });
  clickStartAction(s, "music");
  await settle();
  expect(dialogText(s)).toContain(
    "The window could not be loaded. Try opening it again.",
  );
  clickStartAction(s, "pictures");
  await settle();
  expect(
    !!s.document.querySelector('.xp-window[data-game="__my-pictures"]'),
  ).toBeFalse();
});

test("programs report load failures and honor custom window options", async () => {
  const s = await login(await loadShell());
  const element = s.document.createElement("div");
  element.className = "window-content";
  overrideRegistry(s, {
    __notepad: {
      title: "Notepad",
      loaded: null,
      load: () => Promise.reject(new Error("")),
    },
  });
  await runCommand(s, "notepad");
  expect(dialogText(s)).toContain(
    "The application could not be loaded. Try opening it again.",
  );
  s.document.querySelector('.xp-dialog [data-action="ok"]').click();

  const desktop = s.document.getElementById("desktop");
  Object.defineProperties(desktop, {
    clientWidth: { configurable: true, value: 12 },
    clientHeight: { configurable: true, value: 12 },
  });
  overrideRegistry(s, {
    __notepad: {
      id: "__notepad",
      title: "Custom",
      icon: "Notepad.png",
      kind: "program",
      window: {
        width: 200,
        height: 120,
        customChrome: true,
        resizable: false,
        maximizable: false,
      },
      mount: () => ({ element, unmount() {} }),
    },
  });
  await runCommand(s, "notepad");
  const win = s.document.querySelector('.xp-window[data-game="__notepad"]');
  expect(win.style.width).toBe("200px");
  expect(win.querySelector(".maximize-btn").disabled).toBeTrue();
  expect(win.querySelectorAll(".resize-handle")).toHaveLength(0);
  win.dispatchEvent(
    new s.window.PointerEvent("pointerdown", { bubbles: true }),
  );
});

test("desktop items open games, system windows, and survive failing files", async () => {
  const s = await login(
    await loadShell({
      initialStorage: {
        taskbarSettings: JSON.stringify({
          quickLaunch: true,
          quickLaunchItems: ["bike-mania", "__my-computer", "__astro-settings"],
        }),
      },
    }),
  );
  const fs = s.window.VirtualFS;
  s.window.RufflePlayer = {
    newest: () => ({
      createPlayer: () => {
        const player = s.document.createElement("ruffle-player");
        player.load = () => {};
        return player;
      },
    }),
  };
  const desktop = s.document.getElementById("desktop");
  Object.defineProperties(desktop, {
    clientWidth: { configurable: true, value: 1600 },
    clientHeight: { configurable: true, value: 300 },
  });
  const quick = (id) =>
    s.document.querySelector(`.quick-launch-toolbar [data-shortcut="${id}"]`);
  quick("bike-mania").click();
  await settle();
  expect(s.window.location.hash).toBe("#bike-mania");
  const game = s.document.querySelector('.xp-window[data-game="bike-mania"]');
  expect(parseFloat(game.style.height)).toBeLessThanOrEqual(276);
  quick("__my-computer").click();
  quick("__astro-settings").click();
  await settle();
  expect(
    !!s.document.querySelector('.xp-window[data-game="__astro-settings"]'),
  ).toBeTrue();

  fs.registerFileType(".boom", () => {
    throw new Error("handler failed");
  });
  const file = fs.createFile(fs.DESKTOP, "broken.boom");
  await settle();
  const errors = [];
  const originalError = s.window.console.error;
  s.window.console.error = (error) => errors.push(error);
  try {
    s.document
      .querySelector(`[data-desktop-id="${file.id}"]`)
      .dispatchEvent(new s.window.MouseEvent("dblclick", { bubbles: true }));
  } finally {
    s.window.console.error = originalError;
  }
  expect(errors[0].message).toBe("handler failed");
});
