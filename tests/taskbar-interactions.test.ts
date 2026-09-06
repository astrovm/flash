// @ts-nocheck -- Happy DOM supplies browser objects.
import { afterEach, expect, test } from "bun:test";
import {
  cleanupShells,
  flushShell,
  loadShell,
  login,
} from "./helpers/shell-harness";

afterEach(cleanupShells);

const properties = (s) => {
  s.document
    .getElementById("taskbar")
    .dispatchEvent(new s.window.MouseEvent("contextmenu", { bubbles: true }));
  s.document.querySelector('[data-taskbar-action="properties"]').click();
  return s.document.querySelector(".taskbar-properties-dialog");
};

test("Show the clock persists and reopening Properties reflects the saved value", async () => {
  const s = await login(await loadShell());
  Object.defineProperty(
    s.document.getElementById("task-buttons"),
    "clientWidth",
    { value: 800 },
  );
  const dialog = properties(s);
  dialog.querySelector('[data-taskbar-setting="show-clock"]').click();
  dialog.querySelector('[data-action="ok"]').click();
  expect(s.document.getElementById("taskbar-clock").hidden).toBeTrue();
  expect(s.window.localStorage.getItem("taskbarShowClock")).toBe("false");
  expect(
    properties(s).querySelector('[data-taskbar-setting="show-clock"]').checked,
  ).toBeFalse();
  const restored = await login(
    await loadShell({ initialStorage: { taskbarShowClock: "false" } }),
  );
  expect(restored.document.getElementById("taskbar-clock").hidden).toBeTrue();
});

test("double-clicking Volume opens Volume Control and closes the quick popup", async () => {
  const s = await login(await loadShell());
  Object.defineProperty(
    s.document.getElementById("task-buttons"),
    "clientWidth",
    { value: 800 },
  );
  const button = s.document.getElementById("tray-volume-button");
  button.click();
  expect(button.getAttribute("aria-expanded")).toBe("true");
  button.dispatchEvent(new s.window.MouseEvent("dblclick"));
  await flushShell();
  await flushShell();
  expect(s.document.getElementById("tray-volume-popup").hidden).toBeTrue();
  expect(button.getAttribute("aria-expanded")).toBe("false");
  expect(
    s.document.querySelector('.task-button[data-game="__volume-control"]'),
  ).not.toBeNull();
});

test("Explorer task title follows its current folder", async () => {
  const s = await login(await loadShell());
  Object.defineProperty(
    s.document.getElementById("task-buttons"),
    "clientWidth",
    { value: 800 },
  );
  const bin = s.document.querySelector('[data-desktop-id="__recycle-bin"]');
  bin.dispatchEvent(new s.window.MouseEvent("dblclick"));
  await flushShell();
  await flushShell();
  expect(s.document.querySelector(".task-button .task-label").textContent).toBe(
    "Recycle Bin",
  );
});

test("taskbar options apply together, survive reload, and Cancel discards edits", async () => {
  const s = await login(await loadShell());
  const dialog = properties(s);
  for (const name of [
    "locked",
    "auto-hide",
    "keep-on-top",
    "quick-launch",
    "hide-inactive",
  ]) {
    dialog.querySelector(`[data-taskbar-setting="${name}"]`).click();
  }
  dialog.querySelector('[data-action="ok"]').click();
  const saved = JSON.parse(s.window.localStorage.getItem("taskbarSettings"));
  expect(saved).toMatchObject({
    locked: false,
    autoHide: true,
    onTop: false,
    quickLaunch: true,
    hideInactive: false,
  });
  expect(
    s.document.querySelector('[aria-label="Show Desktop"]'),
  ).not.toBeNull();
  const next = properties(s);
  next.querySelector('[data-taskbar-setting="quick-launch"]').click();
  next.querySelector('[data-action="cancel"]').click();
  expect(
    JSON.parse(s.window.localStorage.getItem("taskbarSettings")).quickLaunch,
  ).toBeTrue();
  const restored = await login(
    await loadShell({
      initialStorage: { taskbarSettings: JSON.stringify(saved) },
    }),
  );
  expect(
    restored.document.getElementById("taskbar").classList.contains("unlocked"),
  ).toBeTrue();
  expect(
    properties(restored).querySelector('[data-taskbar-setting="auto-hide"]')
      .checked,
  ).toBeTrue();
});

test("unlocked taskbar docks and resizes; locking prevents further movement", async () => {
  const s = await login(
    await loadShell({
      initialStorage: { taskbarSettings: JSON.stringify({ locked: false }) },
    }),
  );
  const bar = s.document.getElementById("taskbar");
  bar.setPointerCapture = () => {};
  const pointer = (target, type, x, y) =>
    target.dispatchEvent(
      new s.window.PointerEvent(type, {
        bubbles: true,
        pointerId: 1,
        button: 0,
        clientX: x,
        clientY: y,
      }),
    );
  pointer(bar, "pointerdown", 500, 750);
  pointer(bar, "pointermove", 0, 300);
  pointer(bar, "pointerup", 0, 300);
  expect(bar.dataset.edge).toBe("left");
  expect(s.document.getElementById("desktop").style.left).not.toBe("0px");
  pointer(s.document.getElementById("taskbar-resize"), "pointerdown", 106, 300);
  pointer(bar, "pointermove", 220, 300);
  pointer(bar, "pointerup", 220, 300);
  expect(
    JSON.parse(s.window.localStorage.getItem("taskbarSettings")).width,
  ).toBe(220);
  s.document.querySelector('[data-taskbar-action="lock"]').click();
  pointer(bar, "pointerdown", 10, 300);
  pointer(bar, "pointermove", 500, 0);
  pointer(bar, "pointerup", 500, 0);
  expect(bar.dataset.edge).toBe("left");
});

test("notification settings hide Volume, preserve expansion, and honor Cancel", async () => {
  const s = await login(await loadShell());
  const dialog = properties(s);
  dialog.querySelector("[data-customize-tray]").click();
  const customize = s.document.querySelector(
    ".taskbar-customize-notifications",
  );
  expect(customize).not.toBeNull();
  customize.querySelector("select").value = "hide";
  customize.querySelector('[data-action="ok"]').click();
  expect(s.document.getElementById("tray-volume-button").hidden).toBeFalse();
  dialog.querySelector('[data-action="ok"]').click();
  expect(s.document.getElementById("tray-volume-button").hidden).toBeTrue();
  s.document.getElementById("tray-expand").click();
  expect(s.document.getElementById("tray-volume-button").hidden).toBeFalse();
  s.document.getElementById("tray-expand").click();
  expect(s.document.getElementById("tray-volume-button").hidden).toBeTrue();
});

test("New Toolbar creates a working folder toolbar and it can be removed", async () => {
  const s = await login(await loadShell());
  s.document.querySelector('[data-taskbar-toolbar="new"]').click();
  const dialog = s.document.querySelector(".taskbar-new-toolbar-dialog");
  expect(dialog).not.toBeNull();
  dialog.querySelector('[data-action="ok"]').click();
  const toolbar = s.document.querySelector(".taskbar-folder-toolbar");
  expect(toolbar.textContent).toContain("My Documents");
  toolbar.click();
  expect(s.document.getElementById("taskbar-overflow-menu").hidden).toBeFalse();
  toolbar.dispatchEvent(
    new s.window.MouseEvent("contextmenu", { bubbles: true }),
  );
  s.document
    .getElementById("taskbar-overflow-menu")
    .querySelector("button")
    .click();
  expect(s.document.querySelector(".taskbar-folder-toolbar")).toBeNull();
  s.document.querySelector('[data-taskbar-toolbar="new"]').click();
  const create = s.document.querySelector(".taskbar-new-toolbar-dialog");
  create.querySelector('[data-action="new-folder"]').click();
  await flushShell();
  const selected = create.querySelector('[aria-selected="true"]');
  expect(selected.textContent).toBe("New Folder");
  expect(selected.closest("[hidden]")).toBeNull();
  create.querySelector('[data-action="ok"]').click();
  expect(
    s.document.querySelector(".taskbar-folder-toolbar").textContent,
  ).toContain("New Folder");
});

test("auto-hide reserves the reveal edge, hides, and returns on pointer entry", async () => {
  const s = await login(
    await loadShell({
      initialStorage: { taskbarSettings: JSON.stringify({ autoHide: true }) },
    }),
  );
  const bar = s.document.getElementById("taskbar");
  await new Promise((resolve) => setTimeout(resolve, 550));
  expect(bar.classList.contains("auto-hidden")).toBeTrue();
  bar.dispatchEvent(new s.window.PointerEvent("pointerenter"));
  expect(bar.classList.contains("auto-hidden")).toBeFalse();
  expect(parseFloat(s.document.getElementById("desktop").style.height)).toBe(
    s.window.innerHeight - 2,
  );
});

test("crowded Explorer windows group and the group menu restores a chosen window", async () => {
  const s = await login(await loadShell());
  const container = s.document.getElementById("task-buttons");
  Object.defineProperty(container, "clientWidth", { value: 240 });
  for (const id of ["__my-computer", "__my-documents", "__recycle-bin"]) {
    s.document
      .querySelector(`[data-desktop-id="${id}"]`)
      .dispatchEvent(new s.window.MouseEvent("dblclick"));
    await flushShell();
  }
  const group = container.querySelector(".task-button-grouped");
  expect(group.textContent).toBe("3 Windows Explorer");
  group.click();
  const menu = s.document.getElementById("taskbar-overflow-menu");
  expect(menu.querySelectorAll("button")).toHaveLength(3);
  [...menu.querySelectorAll("button")]
    .find((button) => button.textContent === "My Documents")
    .click();
  expect(menu.hidden).toBeTrue();
  const dialog = properties(s);
  dialog.querySelector('[data-taskbar-setting="group"]').click();
  dialog.querySelector('[data-action="ok"]').click();
  expect(
    container.querySelector('[data-game="__my-documents"]'),
  ).not.toBeNull();
});

test("dragging a desktop shortcut to Quick Launch adds a launch button without moving the original", async () => {
  const s = await login(
    await loadShell({
      initialStorage: {
        taskbarSettings: JSON.stringify({ quickLaunch: true }),
      },
    }),
  );
  const icon = s.document.querySelector('[data-desktop-id="__my-documents"]');
  const original = { left: icon.style.left, top: icon.style.top };
  Object.defineProperty(icon, "offsetLeft", {
    get: () => parseFloat(icon.style.left) || 0,
  });
  Object.defineProperty(icon, "offsetTop", {
    get: () => parseFloat(icon.style.top) || 0,
  });
  const toolbar = s.document.querySelector(".quick-launch-toolbar");
  s.document.elementsFromPoint = () => [toolbar];
  for (const [type, x, y] of [
    ["pointerdown", 20, 80],
    ["pointermove", 150, 740],
    ["pointerup", 150, 740],
  ]) {
    icon.dispatchEvent(
      new s.window.PointerEvent(type, {
        bubbles: true,
        pointerId: 1,
        button: 0,
        clientX: x,
        clientY: y,
      }),
    );
  }
  await flushShell();
  expect(
    JSON.parse(s.window.localStorage.getItem("taskbarSettings"))
      .quickLaunchItems,
  ).toContain("__my-documents");
  expect({ left: icon.style.left, top: icon.style.top }).toEqual(original);
  expect(icon.isConnected).toBeTrue();
  const launch = [...s.document.querySelectorAll(".quick-launch-button")].find(
    (button) => button.title === "My Documents",
  );
  expect(launch).not.toBeUndefined();
  launch.click();
  await flushShell();
  expect(
    s.document.querySelector('.xp-window[data-game="__my-documents"]'),
  ).not.toBeNull();
  launch.dispatchEvent(
    new s.window.MouseEvent("contextmenu", { bubbles: true }),
  );
  s.document
    .getElementById("taskbar-overflow-menu")
    .querySelector("button")
    .click();
  expect(
    JSON.parse(s.window.localStorage.getItem("taskbarSettings"))
      .quickLaunchItems,
  ).not.toContain("__my-documents");
  expect(icon.isConnected).toBeTrue();
});
