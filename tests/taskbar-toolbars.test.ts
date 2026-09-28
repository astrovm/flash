// @ts-nocheck -- Taskbar toolbars driven through the real shell.
import { afterEach, expect, test } from "bun:test";
import {
  cleanupShells,
  flushShell,
  loadShell,
  login,
} from "./helpers/shell-harness";

afterEach(cleanupShells);

const settings = (s) =>
  JSON.parse(s.window.localStorage.getItem("taskbarSettings"));
const layout = (s, id) => settings(s).toolbarLayouts?.[id];
const press = (s, target, key, options = {}) =>
  target.dispatchEvent(
    new s.window.KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...options,
    }),
  );
const pointer = (s, target, type, x, y, pointerId = 1, button = 0) =>
  target.dispatchEvent(
    new s.window.PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      button,
      pointerId,
      clientX: x,
      clientY: y,
    }),
  );
const context = (s, target) =>
  target.dispatchEvent(
    new s.window.MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
  );
const menuItem = (s, label) =>
  s.document.querySelector(`#taskbar-overflow-menu [aria-label="${label}"]`);

async function shellWithToolbars(taskbarSettings, options = {}) {
  const s = await login(
    await loadShell({
      initialStorage: {
        taskbarSettings: JSON.stringify({ locked: false, ...taskbarSettings }),
      },
      ...options,
    }),
  );
  for (const element of [
    s.document.getElementById("taskbar"),
    ...s.document.querySelectorAll(".taskbar-toolbar"),
  ])
    element.setPointerCapture = () => {};
  return s;
}

test("folder and desktop toolbars list entries and open their folders", async () => {
  const s = await shellWithToolbars({
    quickLaunch: true,
    quickLaunchItems: ["__show-desktop", "missing-item", "__my-computer"],
    desktopToolbar: true,
    folders: ["my-documents", "missing-folder"],
  });
  const fs = s.window.VirtualFS;
  const toolbar = (id) =>
    s.document.querySelector(`.taskbar-toolbar[data-toolbar-id="${id}"]`);
  expect(toolbar("__quick-launch").textContent).not.toContain("missing-item");
  expect(toolbar(fs.DESKTOP)).toBeTruthy();
  expect(toolbar("missing-folder")).toBeNull();
  toolbar("__quick-launch")
    .querySelector('[data-shortcut="__show-desktop"]')
    .click();
  toolbar("__quick-launch")
    .querySelector('[data-shortcut="__show-desktop"]')
    .click();
  toolbar(fs.MY_DOCUMENTS).querySelector("[data-shortcut]").click();
  await flushShell();

  context(s, toolbar(fs.MY_DOCUMENTS));
  menuItem(s, "Open Folder").click();
  await flushShell();
  expect(
    !!s.document.querySelector('.xp-window[data-game="__my-documents"]'),
  ).toBeTrue();

  context(s, toolbar(fs.MY_DOCUMENTS));
  menuItem(s, "Close Toolbar").click();
  expect(settings(s).folders).toEqual(["missing-folder"]);
  context(s, toolbar(fs.DESKTOP));
  menuItem(s, "Close Toolbar").click();
  expect(settings(s).desktopToolbar).toBeFalse();
});

test("locked toolbars hide layout options and ignore dragging keys", async () => {
  const s = await shellWithToolbars({ quickLaunch: true, locked: true });
  const toolbar = s.document.querySelector(".quick-launch-toolbar");
  context(s, toolbar);
  expect(menuItem(s, "Show Text")).toBeNull();
  press(s, s.document.body, "Escape");
  const before = settings(s).toolbarLayouts;
  press(s, toolbar.querySelector(".toolbar-size"), "ArrowRight");
  press(s, toolbar.querySelector(".toolbar-size"), "Enter");
  pointer(s, toolbar.querySelector(".toolbar-size"), "pointerdown", 10, 10);
  pointer(s, toolbar.querySelector("[data-shortcut]"), "pointerdown", 10, 10);
  expect(settings(s).toolbarLayouts).toEqual(before);
});

test("the overflow menu lists hidden buttons or shows that it is empty", async () => {
  const s = await shellWithToolbars({
    quickLaunch: true,
    quickLaunchItems: ["__my-computer", "__my-documents"],
  });
  const toolbar = s.document.querySelector(".quick-launch-toolbar");
  const overflow = toolbar.querySelector(".toolbar-overflow");
  toolbar.querySelectorAll("[data-shortcut]").forEach((button) => {
    button.hidden = false;
  });
  overflow.click();
  expect(
    s.document.getElementById("taskbar-overflow-menu").textContent,
  ).toContain("(Empty)");
  press(s, s.document.body, "Escape");
  toolbar.querySelectorAll("[data-shortcut]").forEach((button) => {
    button.hidden = true;
  });
  overflow.click();
  const entry = menuItem(s, "My Computer");
  expect(entry.querySelector("img")).toBeTruthy();
  entry.click();
  await flushShell();
  expect(
    !!s.document.querySelector('.xp-window[data-game="__my-computer"]'),
  ).toBeTrue();
});

test("toolbar submenus ignore unrelated keys", async () => {
  const s = await shellWithToolbars({ quickLaunch: true });
  context(s, s.document.querySelector(".quick-launch-toolbar"));
  const view = menuItem(s, "View");
  press(s, view, "ArrowDown");
  expect(view.getAttribute("aria-expanded")).toBe("false");
  view.click();
  const submenu = s.document.querySelector(".toolbar-view-menu");
  press(s, submenu, "ArrowDown");
  expect(submenu.hidden).toBeFalse();
  press(s, submenu, "Escape");
  expect(submenu.hidden).toBeTrue();
});

test("dragging a toolbar away floats it, and dragging it back docks it", async () => {
  const s = await shellWithToolbars({
    quickLaunch: true,
    folders: ["my-documents"],
  });
  const grip = () =>
    s.document.querySelector(".quick-launch-toolbar .toolbar-grip");
  const handle = grip();
  pointer(s, handle, "pointerdown", 0, 0, 1, 2);
  pointer(s, handle, "pointerdown", 0, 0);
  pointer(s, handle, "pointermove", 1, 1, 2);
  pointer(s, handle, "pointermove", 2, 2);
  pointer(s, handle, "pointerup", 2, 2);
  expect(layout(s, "__quick-launch")).toBeUndefined();

  pointer(s, grip(), "pointerdown", 0, 0);
  pointer(s, grip(), "pointermove", 400, 300);
  press(s, s.document.body, "Escape");
  expect(layout(s, "__quick-launch")).toBeUndefined();

  const floating = grip();
  pointer(s, floating, "pointerdown", 0, 0);
  pointer(s, floating, "pointermove", 400, 300);
  pointer(s, floating, "pointerup", 400, 300, 2);
  pointer(s, floating, "pointerup", 400, 300);
  expect(layout(s, "__quick-launch")).toMatchObject({
    floating: true,
    width: 300,
  });

  const title = s.document.querySelector(
    ".quick-launch-toolbar.floating .toolbar-title",
  );
  title.setPointerCapture = () => {};
  pointer(s, title, "pointerdown", 400, 300);
  pointer(s, title, "pointermove", 0, 0);
  pointer(s, title, "pointerup", 0, 0);
  expect(layout(s, "__quick-launch").floating).toBeFalse();
  expect(settings(s).toolbarOrder).toContain("__quick-launch");

  const resize = s.document.querySelector(
    ".quick-launch-toolbar .toolbar-size",
  );
  resize.setPointerCapture = () => {};
  pointer(s, resize, "pointerdown", 0, 0);
  pointer(s, resize, "pointermove", 30, 0);
  pointer(s, resize, "pointercancel", 30, 0);
  pointer(s, resize, "pointerdown", 0, 0);
  pointer(s, resize, "pointermove", 30, 0);
  pointer(s, resize, "pointerup", 30, 0);
  expect(layout(s, "__quick-launch").width).toBe(36);
});

test("floating toolbars resize in both directions and vertical taskbars resize bands", async () => {
  const s = await shellWithToolbars({
    quickLaunch: true,
    toolbarLayouts: {
      "__quick-launch": { floating: true, width: 200, height: 100 },
    },
  });
  const resize = s.document.querySelector(
    ".quick-launch-toolbar .toolbar-size",
  );
  resize.setPointerCapture = () => {};
  pointer(s, resize, "pointerdown", 0, 0);
  pointer(s, resize, "pointermove", 20, 20);
  pointer(s, resize, "pointerup", 20, 20);
  expect(layout(s, "__quick-launch")).toMatchObject({ width: 36, height: 60 });
  const floating = s.document.querySelector(".quick-launch-toolbar");
  pointer(s, floating.querySelector(".toolbar-title"), "pointerdown", 0, 0);
  pointer(s, floating.querySelector(".toolbar-title"), "pointerup", 0, 0);

  const vertical = await shellWithToolbars({ quickLaunch: true, edge: "left" });
  const band = vertical.document.querySelector(
    ".quick-launch-toolbar .toolbar-size",
  );
  press(vertical, band, "ArrowDown");
  expect(layout(vertical, "__quick-launch").bandHeight).toBe(36);
  const bandHandle = vertical.document.querySelector(
    ".quick-launch-toolbar .toolbar-size",
  );
  bandHandle.setPointerCapture = () => {};
  pointer(vertical, bandHandle, "pointerdown", 0, 0);
  pointer(vertical, bandHandle, "pointermove", 0, 40);
  pointer(vertical, bandHandle, "pointercancel", 0, 40);
  pointer(vertical, bandHandle, "pointerdown", 0, 0);
  pointer(vertical, bandHandle, "pointermove", 0, 40);
  pointer(vertical, bandHandle, "pointerup", 0, 40);
  expect(layout(vertical, "__quick-launch").bandHeight).toBe(40);
});

test("Quick Launch buttons reorder by dragging and cancel with Escape", async () => {
  const s = await shellWithToolbars({
    quickLaunch: true,
    quickLaunchItems: ["__my-computer", "__my-documents", "__my-pictures"],
  });
  const button = (id) =>
    s.document.querySelector(`.quick-launch-toolbar [data-shortcut="${id}"]`);
  for (const id of ["__my-computer", "__my-documents", "__my-pictures"])
    button(id).setPointerCapture = () => {};
  const documents = button("__my-documents");
  pointer(s, documents, "pointerdown", 0, 0, 1, 2);
  pointer(s, documents, "pointerdown", 0, 0);
  pointer(s, documents, "pointermove", 1, 1, 2);
  pointer(s, documents, "pointerup", 1, 1, 2);
  pointer(s, documents, "pointerup", 1, 1);
  pointer(s, documents, "pointerdown", 0, 0);
  pointer(s, documents, "pointermove", 20, 20);
  press(s, s.document.body, "Escape");
  expect(settings(s).quickLaunchItems).toEqual([
    "__my-computer",
    "__my-documents",
    "__my-pictures",
  ]);
  pointer(s, documents, "pointerdown", 0, 0);
  pointer(s, documents, "pointermove", 20, 20);
  pointer(s, documents, "pointerup", 20, 20);
  expect(settings(s).quickLaunchItems.at(-1)).toBe("__my-documents");
  const pictures = button("__my-pictures");
  pictures.setPointerCapture = () => {};
  pointer(s, pictures, "pointerdown", 0, 0);
  pointer(s, pictures, "pointermove", -20, -20);
  pointer(s, pictures, "pointerup", -20, -20);
  expect(settings(s).quickLaunchItems[0]).toBe("__my-pictures");
});

test("toolbars fit their buttons and hide the ones that overflow", async () => {
  let observed;
  class ResizeObserver {
    constructor(callback) {
      observed = callback;
    }
    observe() {}
    disconnect() {}
  }
  const s = await login(
    await loadShell({
      initialStorage: {
        taskbarSettings: JSON.stringify({
          locked: false,
          quickLaunch: true,
          quickLaunchItems: [
            "__my-computer",
            "__my-documents",
            "__my-pictures",
          ],
        }),
      },
    }),
  );
  s.window.ResizeObserver = ResizeObserver;
  s.window.dispatchEvent(new s.window.Event("resize"));
  const toolbar = s.document.querySelector(".quick-launch-toolbar");
  const items = toolbar.querySelector(".toolbar-items");
  const buttons = [...items.children];
  let width = 50;
  Object.defineProperty(items, "clientWidth", { get: () => width });
  items.getBoundingClientRect = () => ({ bottom: 30 });
  buttons.forEach((button, index) => {
    button.getBoundingClientRect = () => ({
      width: 30,
      bottom: 20 + index * 20,
    });
  });
  observed();
  expect(buttons.map((button) => button.hidden)).toEqual([false, true, true]);
  expect(toolbar.querySelector(".toolbar-overflow").hidden).toBeFalse();
  s.document.getElementById("taskbar").classList.add("vertical");
  observed();
  expect(buttons.map((button) => button.hidden)).toEqual([false, true, true]);
  width = 500;
  s.document.getElementById("taskbar").classList.remove("vertical");
  observed();
  expect(buttons.every((button) => !button.hidden)).toBeTrue();
});

test("toolbars dock before the toolbar they are dropped on, on horizontal and vertical taskbars", async () => {
  for (const edge of ["bottom", "left"]) {
    const s = await shellWithToolbars({
      edge,
      quickLaunch: true,
      folders: ["my-documents"],
      toolbarOrder: ["__quick-launch", "my-documents"],
    });
    const quickLaunch = s.document.querySelector(".quick-launch-toolbar");
    quickLaunch.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
    });
    const grip = s.document.querySelector(
      '[data-toolbar-id="my-documents"] .toolbar-grip',
    );
    pointer(s, grip, "pointerdown", 4, 4);
    pointer(s, grip, "pointermove", 30, 30);
    press(s, s.document.body, "a");
    pointer(s, grip, "pointermove", 0, 0);
    pointer(s, grip, "pointerup", 0, 0);
    expect(settings(s).toolbarOrder).toEqual([
      "my-documents",
      "__quick-launch",
    ]);
  }
});

test("dragging a floating toolbar keeps its width", async () => {
  const s = await shellWithToolbars({
    quickLaunch: true,
    toolbarLayouts: {
      "__quick-launch": {
        floating: true,
        width: 220,
        height: 90,
        x: 50,
        y: 50,
      },
    },
  });
  const title = s.document.querySelector(
    ".quick-launch-toolbar.floating .toolbar-title",
  );
  title.setPointerCapture = () => {};
  pointer(s, title, "pointerdown", 60, 60);
  pointer(s, title, "pointermove", 400, 300);
  pointer(s, title, "pointerup", 400, 300);
  expect(layout(s, "__quick-launch")).toMatchObject({
    floating: true,
    width: 220,
  });
});

test("a Quick Launch drag ignores other keys and swallows the click that ends it", async () => {
  const s = await shellWithToolbars({
    quickLaunch: true,
    quickLaunchItems: ["__my-computer", "__my-documents"],
  });
  const button = (id) =>
    s.document.querySelector(`.quick-launch-toolbar [data-shortcut="${id}"]`);
  const documents = button("__my-documents");
  documents.setPointerCapture = () => {};
  pointer(s, documents, "pointerdown", 0, 0);
  pointer(s, documents, "pointermove", -20, -20);
  press(s, s.document.body, "a");
  pointer(s, documents, "pointerup", -20, -20);
  expect(settings(s).quickLaunchItems).toEqual([
    "__my-documents",
    "__my-computer",
  ]);
  documents.click();
  await flushShell();
  expect(
    s.document.querySelector('.xp-window[data-game="__my-documents"]'),
  ).toBeNull();
  button("__my-documents").click();
  await flushShell();
  expect(
    s.document.querySelector('.xp-window[data-game="__my-documents"]'),
  ).not.toBeNull();
});

test("vertical toolbars show every button that fits", async () => {
  let observed;
  const s = await shellWithToolbars(
    {
      edge: "left",
      quickLaunch: true,
      quickLaunchItems: ["__my-computer", "__my-documents"],
    },
    {
      beforeScripts: (window) => {
        window.ResizeObserver = class {
          constructor(callback) {
            observed = callback;
          }
          observe() {}
          disconnect() {}
        };
      },
    },
  );
  const toolbar = s.document.querySelector(".quick-launch-toolbar");
  const items = toolbar.querySelector(".toolbar-items");
  Object.defineProperty(items, "clientWidth", { get: () => 40 });
  items.getBoundingClientRect = () => ({ bottom: 100 });
  const buttons = [...items.children];
  buttons.forEach((button, index) => {
    button.getBoundingClientRect = () => ({ bottom: 30 + index * 30 });
  });
  observed();
  expect(buttons.every((button) => !button.hidden)).toBeTrue();
  expect(toolbar.querySelector(".toolbar-overflow").hidden).toBeTrue();
});
