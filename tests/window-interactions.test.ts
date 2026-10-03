// @ts-nocheck -- Happy DOM supplies browser geometry and events.
import { afterEach, expect, test } from "bun:test";
import {
  cleanupShells,
  loadShell,
  login,
  clickStartAction,
  flushShell,
} from "./helpers/shell-harness";
afterEach(cleanupShells);
const key = (s, el, value, extra = {}) =>
  el.dispatchEvent(
    new s.window.KeyboardEvent("keydown", {
      key: value,
      bubbles: true,
      cancelable: true,
      ...extra,
    }),
  );
const pointer = (s, el, type, x, y) =>
  el.dispatchEvent(
    new s.window.PointerEvent(type, {
      clientX: x,
      clientY: y,
      button: 0,
      pointerId: 1,
      bubbles: true,
      cancelable: true,
    }),
  );
function geometry(s, win) {
  const desktop = s.document.getElementById("desktop");
  Object.defineProperties(desktop, {
    clientWidth: { configurable: true, value: 1024 },
    clientHeight: { configurable: true, value: 738 },
  });
  Object.assign(win.style, {
    left: "100px",
    top: "80px",
    width: "500px",
    height: "400px",
  });
  for (const [prop, style] of Object.entries({
    offsetLeft: "left",
    offsetTop: "top",
    offsetWidth: "width",
    offsetHeight: "height",
  }))
    Object.defineProperty(win, prop, {
      configurable: true,
      get: () => parseFloat(win.style[style]),
    });
  win.getBoundingClientRect = () => ({
    left: win.offsetLeft,
    top: win.offsetTop,
    width: win.offsetWidth,
    height: win.offsetHeight,
    right: win.offsetLeft + win.offsetWidth,
    bottom: win.offsetTop + win.offsetHeight,
  });
  win.getAnimations = () => [];
}
async function documents() {
  const s = await login(await loadShell());
  clickStartAction(s, "documents");
  const win = s.document.querySelector(
    '.xp-window[data-game="__my-documents"]',
  );
  geometry(s, win);
  const command = (name) => {
    win.querySelector(".title-bar").dispatchEvent(
      new s.window.MouseEvent("contextmenu", {
        bubbles: true,
        clientX: 120,
        clientY: 90,
      }),
    );
    s.document
      .querySelector(`#window-system-menu [data-command="${name}"]`)
      .click();
  };
  return { s, win, command };
}
test("window system commands support keyboard and pointer move/size, cancel and commit", async () => {
  const { s, win, command } = await documents();
  command("move");
  key(s, s.document, "ArrowRight");
  key(s, s.document, "ArrowDown");
  expect([win.style.left, win.style.top]).toEqual(["108px", "88px"]);
  key(s, s.document, "Escape");
  expect([win.style.left, win.style.top]).toEqual(["100px", "80px"]);
  command("move");
  key(s, s.document, "ArrowLeft");
  key(s, s.document, "ArrowUp");
  key(s, s.document, "Enter");
  expect([win.style.left, win.style.top]).toEqual(["92px", "72px"]);
  command("size");
  key(s, s.document, "ArrowRight");
  key(s, s.document, "ArrowDown");
  key(s, s.document, "Enter");
  expect([win.style.width, win.style.height]).toEqual(["508px", "408px"]);
  for (const mode of ["move", "size"]) {
    command(mode);
    pointer(s, s.document, "pointermove", 10, 10);
    pointer(s, s.document, "pointermove", 30, 40);
    pointer(s, s.document, "pointerdown", 30, 40);
    expect(win.classList.contains(`${mode}-mode`)).toBeFalse();
  }
  expect([
    win.style.left,
    win.style.top,
    win.style.width,
    win.style.height,
  ]).toEqual(["112px", "102px", "528px", "438px"]);
  command("maximize");
  expect(win.classList.contains("maximized")).toBeTrue();
  command("restore");
  expect(win.classList.contains("maximized")).toBeFalse();
  command("minimize");
  await flushShell();
  expect(win.style.display).toBe("none");
  command("restore");
  expect(win.style.display).toBe("flex");
  command("close");
  expect(win.isConnected).toBeFalse();
});
test("caption dragging and all resize edges update and persist window geometry", async () => {
  const { s, win } = await documents(),
    bar = win.querySelector(".title-bar");
  pointer(s, bar, "pointerdown", 120, 90);
  pointer(s, bar, "pointermove", 160, 130);
  pointer(s, bar, "pointerup", 160, 130);
  expect([win.style.left, win.style.top]).toEqual(["140px", "120px"]);
  expect(win.classList.contains("moving")).toBeFalse();
  for (const dir of ["e", "s", "w", "n", "se", "nw", "ne", "sw"]) {
    geometry(s, win);
    const handle = win.querySelector(`.resize-handle[data-dir="${dir}"]`);
    pointer(s, handle, "pointerdown", 500, 400);
    pointer(s, handle, "pointermove", 520, 420);
    pointer(s, handle, "pointerup", 520, 420);
    expect(win.offsetWidth).toBe(
      dir.includes("e") ? 520 : dir.includes("w") ? 480 : 500,
    );
    expect(win.offsetHeight).toBe(
      dir.includes("s") ? 420 : dir.includes("n") ? 380 : 400,
    );
  }
  bar.dispatchEvent(new s.window.MouseEvent("dblclick", { bubbles: true }));
  expect(win.classList.contains("maximized")).toBeTrue();
  pointer(s, bar, "pointerdown", 200, 90);
  pointer(s, bar, "pointercancel", 200, 90);
  expect(win.classList.contains("maximized")).toBeFalse();
  win.querySelector(".title-icon").click();
  expect(s.document.getElementById("window-system-menu").hidden).toBeFalse();
  win
    .querySelector(".title-icon")
    .dispatchEvent(new s.window.MouseEvent("dblclick", { bubbles: true }));
  expect(win.isConnected).toBeFalse();
});
async function game() {
  const s = await login(await loadShell()),
    players = [];
  s.window.RufflePlayer = {
    newest: () => ({
      createPlayer: () => {
        const p = s.document.createElement("ruffle-player");
        p.load = (config) => {
          p.config = config;
        };
        p.metadata = { frameRate: 24 };
        p.requestFullscreen = async () => {
          p.fullscreenRequested = true;
        };
        players.push(p);
        return p;
      },
    }),
  };
  s.window.history.replaceState(null, "", "#big-truck-adventures");
  s.window.dispatchEvent(new s.window.HashChangeEvent("hashchange"));
  await flushShell();
  const win = s.document.querySelector(
    '.xp-window[data-game="big-truck-adventures"]',
  );
  return { s, win, players };
}
test("game controls persist favorites, mute and volume and navigate menus by keyboard", async () => {
  const { s, win, players } = await game();
  const favorite = win.querySelector(".favorite-btn"),
    mute = win.querySelector(".volume-btn"),
    volume = win.querySelector(".game-volume-slider");
  favorite.click();
  expect(favorite.getAttribute("aria-pressed")).toBe("true");
  win.querySelector('[data-game-action="favorite"]').click();
  expect(favorite.getAttribute("aria-pressed")).toBe("false");
  volume.value = "35";
  volume.dispatchEvent(new s.window.Event("input"));
  expect(players.at(-1).volume).toBe(0.35);
  mute.click();
  expect(players.at(-1).volume).toBe(0);
  win.querySelector('[data-game-action="mute"]').click();
  expect(players.at(-1).volume).toBe(0.35);
  win.querySelector(".fullscreen-btn").click();
  expect(players.at(-1).fullscreenRequested).toBeTrue();
  const file = win.querySelector('.game-menu-button[data-game-menu="file"]'),
    help = win.querySelector('.game-menu-button[data-game-menu="help"]'),
    menu = win.querySelector('.game-menu[data-game-menu="file"]');
  key(s, file, "ArrowRight");
  expect(s.document.activeElement === help).toBeTrue();
  key(s, help, "ArrowLeft");
  expect(s.document.activeElement === file).toBeTrue();
  key(s, file, "ArrowDown");
  expect(menu.hidden).toBeFalse();
  key(s, s.document.activeElement, "ArrowDown");
  expect(s.document.activeElement.dataset.gameAction).toBe("favorite");
  key(s, s.document.activeElement, "ArrowUp");
  expect(s.document.activeElement.dataset.gameAction).toBe("fullscreen");
  key(s, s.document.activeElement, "ArrowRight");
  expect(s.document.activeElement.dataset.gameAction).toBe("project");
  key(s, s.document.activeElement, "ArrowLeft");
  key(s, s.document.activeElement, "Escape");
  expect(menu.hidden).toBeTrue();
  key(s, win, "f", { altKey: true });
  expect(menu.hidden).toBeFalse();
  key(s, s.document.activeElement, "v");
  expect(s.document.activeElement.dataset.gameAction).toBe("volume-popup");
  s.document.activeElement.click();
  expect(s.document.activeElement === volume).toBeTrue();
  win.querySelector('[data-game-action="project"]').click();
  expect(
    !!s.document.querySelector('.xp-window[data-game="__astro-settings"]'),
  ).toBeTrue();
  win.querySelector('[data-game-action="close"]').click();
  expect(win.isConnected).toBeFalse();
});
test("SWF playback properties validate and apply custom, native and default frame rates", async () => {
  const { s, win, players } = await game();
  const open = () => {
    win.querySelector('[data-game-action="properties"]').click();
    return s.document.querySelector(".xp-dialog");
  };
  const button = (dialog, text) =>
    [...dialog.querySelectorAll("button")].find((b) => b.textContent === text);
  let dialog = open();
  expect(dialog.textContent).toContain("24 FPS");
  let select = dialog.querySelector("select");
  select.value = "custom";
  select.dispatchEvent(new s.window.Event("change"));
  const custom = dialog.querySelector(".game-fps-custom");
  custom.value = "999";
  button(dialog, "OK").click();
  expect(dialog.querySelector('[role="alert"]').textContent).toContain(
    "1 to 240",
  );
  custom.value = "75";
  button(dialog, "OK").click();
  await flushShell();
  expect(players.at(-1).config.frameRate).toBe(75);
  dialog = open();
  button(dialog, "Cancel").click();
  expect(players).toHaveLength(2);
  for (const mode of ["native", "60", "default"]) {
    dialog = open();
    select = dialog.querySelector("select");
    select.value = mode;
    button(dialog, "OK").click();
    await flushShell();
    expect(players.at(-1).config.frameRate).toBe(
      mode === "native" ? undefined : mode === "60" ? 60 : 45,
    );
  }
});
test("dragging and resizing stop at the taskbar", async () => {
  const { s, win } = await documents();
  Object.defineProperties(s.document.getElementById("desktop"), {
    clientWidth: { configurable: true, value: 1024 },
    clientHeight: { configurable: true, value: 768 },
  });
  Object.defineProperties(s.window, {
    innerWidth: { configurable: true, value: 1024 },
    innerHeight: { configurable: true, value: 768 },
  });
  s.document.getElementById("taskbar").getBoundingClientRect = () => ({
    height: 30,
  });
  const bar = win.querySelector(".title-bar");
  pointer(s, bar, "pointerdown", 120, 90);
  pointer(s, bar, "pointermove", 120, 2000);
  pointer(s, bar, "pointerup", 120, 2000);
  // 738px work area minus the 28px that keeps the caption reachable.
  expect(win.style.top).toBe("710px");

  win.style.top = "80px";
  const handle = win.querySelector('.resize-handle[data-dir="s"]');
  pointer(s, handle, "pointerdown", 300, 480);
  pointer(s, handle, "pointermove", 300, 2000);
  pointer(s, handle, "pointerup", 300, 2000);
  expect(win.offsetTop + win.offsetHeight).toBe(738);
});
