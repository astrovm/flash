// @ts-nocheck -- Happy DOM supplies browser objects.
import { afterEach, describe, expect, test } from "bun:test";
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

describe("taskbar", () => {
  test("persists Show the clock and reflects it when Properties reopens", async () => {
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
      properties(s).querySelector('[data-taskbar-setting="show-clock"]')
        .checked,
    ).toBeFalse();
    const restored = await login(
      await loadShell({ initialStorage: { taskbarShowClock: "false" } }),
    );
    expect(restored.document.getElementById("taskbar-clock").hidden).toBeTrue();
  });

  test("opens Volume Control and closes the quick popup when Volume is double-clicked", async () => {
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

  test("names an Explorer task after its current folder", async () => {
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
    expect(
      s.document.querySelector(".task-button .task-label").textContent,
    ).toBe("Recycle Bin");
  });

  test("applies options together, keeps them after reload, and discards edits on Cancel", async () => {
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
      restored.document
        .getElementById("taskbar")
        .classList.contains("unlocked"),
    ).toBeTrue();
    expect(
      properties(restored).querySelector('[data-taskbar-setting="auto-hide"]')
        .checked,
    ).toBeTrue();
  });

  test("docks and resizes when unlocked and stays put once locked", async () => {
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
    pointer(
      s.document.getElementById("taskbar-resize"),
      "pointerdown",
      106,
      300,
    );
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

  test("hides Volume from notification settings, preserves expansion, and honors Cancel", async () => {
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

  test("creates and removes a working folder toolbar with New Toolbar", async () => {
    const s = await login(await loadShell());
    s.document.querySelector('[data-taskbar-toolbar="new"]').click();
    const dialog = s.document.querySelector(".taskbar-new-toolbar-dialog");
    expect(dialog).not.toBeNull();
    dialog.querySelector('[data-action="ok"]').click();
    const toolbar = s.document.querySelector(".taskbar-folder-toolbar");
    expect(toolbar.textContent).toContain("My Documents");
    const folderButton = toolbar.querySelector("[data-shortcut]");
    expect(folderButton).not.toBeNull();
    folderButton.click();
    await flushShell();
    expect(s.document.querySelector(".xp-window")).not.toBeNull();
    toolbar.dispatchEvent(
      new s.window.MouseEvent("contextmenu", { bubbles: true }),
    );
    [
      ...s.document
        .getElementById("taskbar-overflow-menu")
        .querySelectorAll("button"),
    ]
      .find((button) => button.textContent === "Close Toolbar")
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

  test("auto-hides behind a reserved reveal edge and returns on pointer entry", async () => {
    const s = await login(
      await loadShell({
        initialStorage: { taskbarSettings: JSON.stringify({ autoHide: true }) },
      }),
    );
    const bar = s.document.getElementById("taskbar");
    await s.advanceTime(550);
    expect(bar.classList.contains("auto-hidden")).toBeTrue();
    bar.dispatchEvent(new s.window.PointerEvent("pointerenter"));
    expect(bar.classList.contains("auto-hidden")).toBeFalse();
    expect(parseFloat(s.document.getElementById("desktop").style.height)).toBe(
      s.window.innerHeight - 2,
    );
  });

  test("groups crowded Explorer windows and restores a chosen window from the group menu", async () => {
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

  test("adds a Quick Launch button from a dragged desktop shortcut without moving the original", async () => {
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
    const launch = [
      ...s.document.querySelectorAll(".quick-launch-button"),
    ].find((button) => button.title === "My Documents");
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

  test("detaches, resizes, rolls back, and redocks dragged toolbars", async () => {
    const s = await login(
      await loadShell({
        initialStorage: {
          taskbarSettings: JSON.stringify({ quickLaunch: true, locked: false }),
        },
      }),
    );
    const point = (target, type, x, y) =>
      target.dispatchEvent(
        new s.window.PointerEvent(type, {
          bubbles: true,
          pointerId: 2,
          button: 0,
          clientX: x,
          clientY: y,
        }),
      );
    const rect = (element, x, y, width, height) =>
      (element.getBoundingClientRect = () => ({
        left: x,
        top: y,
        right: x + width,
        bottom: y + height,
        width,
        height,
      }));
    let toolbar = s.document.querySelector(".quick-launch-toolbar");
    rect(toolbar, 110, 738, 90, 26);
    let grip = toolbar.querySelector(".toolbar-grip");
    point(grip, "pointerdown", 114, 750);
    point(grip, "pointermove", 350, 300);
    point(grip, "pointerup", 350, 300);
    toolbar = s.document.querySelector(".quick-launch-toolbar");
    expect(toolbar.classList.contains("floating")).toBeTrue();
    rect(toolbar, 346, 288, 300, 300);
    let size = toolbar.querySelector(".toolbar-size");
    point(size, "pointerdown", 644, 586);
    point(size, "pointermove", 694, 626);
    point(size, "pointerup", 694, 626);
    const saved = JSON.parse(s.window.localStorage.getItem("taskbarSettings"));
    expect(saved.toolbarLayouts["__quick-launch"].width).toBe(350);
    expect(saved.toolbarLayouts["__quick-launch"].height).toBe(340);
    toolbar = s.document.querySelector(".quick-launch-toolbar");
    rect(toolbar, 346, 288, 350, 340);
    size = toolbar.querySelector(".toolbar-size");
    point(size, "pointerdown", 694, 626);
    point(size, "pointermove", 794, 726);
    point(size, "pointercancel", 794, 726);
    expect(
      JSON.parse(s.window.localStorage.getItem("taskbarSettings")),
    ).toEqual(saved);
    rect(s.document.getElementById("taskbar"), 0, 734, 1024, 34);
    grip = toolbar.querySelector(".toolbar-title");
    point(grip, "pointerdown", 400, 297);
    point(grip, "pointermove", 150, 750);
    point(grip, "pointerup", 150, 750);
    expect(
      s.document
        .querySelector(".quick-launch-toolbar")
        .classList.contains("floating"),
    ).toBeFalse();
    expect(
      JSON.parse(s.window.localStorage.getItem("taskbarSettings")).toolbarOrder,
    ).toEqual(["__quick-launch"]);
  });

  test("reorders Quick Launch by dragging without launching an application", async () => {
    const s = await login(
      await loadShell({
        initialStorage: {
          taskbarSettings: JSON.stringify({
            quickLaunch: true,
            locked: false,
            quickLaunchItems: [
              "__show-desktop",
              "__my-documents",
              "__my-computer",
            ],
          }),
        },
      }),
    );
    const buttons = [...s.document.querySelectorAll(".quick-launch-button")];
    buttons.forEach(
      (button, i) =>
        (button.getBoundingClientRect = () => ({
          left: 100 + i * 24,
          right: 124 + i * 24,
          top: 740,
          bottom: 764,
          width: 24,
          height: 24,
        })),
    );
    const target = buttons[2];
    for (const [type, x] of [
      ["pointerdown", 160],
      ["pointermove", 102],
      ["pointerup", 102],
    ])
      target.dispatchEvent(
        new s.window.PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          button: 0,
          pointerId: 3,
          clientX: x,
          clientY: 752,
        }),
      );
    expect(
      [...s.document.querySelectorAll(".quick-launch-button")].map(
        (button) => button.title,
      ),
    ).toEqual(["My Computer", "Show Desktop", "My Documents"]);
    expect(s.document.querySelector(".xp-window")).toBeNull();
  });

  test("collapses expanded notifications after leaving the tray but not during volume interaction", async () => {
    const s = await login(
      await loadShell({
        initialStorage: {
          taskbarSettings: JSON.stringify({
            hideInactive: true,
            volumeBehavior: "hide",
          }),
        },
      }),
    );
    s.document.getElementById("tray-expand").click();
    s.document.getElementById("tray-volume-button").click();
    s.document
      .getElementById("taskbar-tray")
      .dispatchEvent(new s.window.PointerEvent("pointerleave"));
    await s.advanceTime(2100);
    expect(s.document.getElementById("tray-volume-button").hidden).toBeFalse();
    s.document.getElementById("tray-volume-button").click();
    s.document
      .getElementById("taskbar-tray")
      .dispatchEvent(new s.window.PointerEvent("pointerleave"));
    await s.advanceTime(2100);
    expect(s.document.getElementById("tray-volume-button").hidden).toBeTrue();
  });

  test("populates a persisted Desktop toolbar after startup builds the desktop", async () => {
    const s = await login(
      await loadShell({
        initialStorage: {
          taskbarSettings: JSON.stringify({ desktopToolbar: true }),
        },
      }),
    );
    const toolbar = s.document.querySelector(".taskbar-folder-toolbar");
    const desktopLabels = [
      ...s.document.querySelectorAll(".desktop-icon .icon-label"),
    ].map((label) => label.textContent);
    expect(
      [...toolbar.querySelectorAll(".toolbar-item")].map(
        (button) => button.title,
      ),
    ).toEqual(desktopLabels);
  });

  test("waits for crowding before grouping Explorer windows and restores minimized members", async () => {
    const s = await login(await loadShell());
    Object.defineProperties(s.document.getElementById("desktop"), {
      clientWidth: { value: 1024 },
      clientHeight: { value: 738 },
    });
    let availableWidth = 360;
    const container = s.document.getElementById("task-buttons");
    Object.defineProperty(container, "clientWidth", {
      get: () => availableWidth,
    });
    for (const id of ["__my-computer", "__my-documents", "__recycle-bin"]) {
      s.document
        .querySelector(`[data-desktop-id="${id}"]`)
        .dispatchEvent(new s.window.MouseEvent("dblclick"));
      await flushShell();
    }
    expect(container.querySelector(".task-button-grouped")).toBeNull();
    availableWidth = 240;
    s.window.dispatchEvent(new s.window.Event("resize"));
    await flushShell();
    const context = () => {
      container
        .querySelector(".task-button-grouped")
        .dispatchEvent(
          new s.window.MouseEvent("contextmenu", { bubbles: true }),
        );
      return [...s.document.querySelectorAll("#taskbar-overflow-menu button")];
    };
    context()
      .find((button) => button.textContent === "Minimize Group")
      .click();
    expect(
      context().find((button) => button.textContent === "Minimize Group")
        .disabled,
    ).toBeTrue();
    context()
      .find((button) => button.textContent === "Tile Vertically")
      .click();
    const windows = [...s.document.querySelectorAll(".xp-window")];
    expect(windows).toHaveLength(3);
    expect(windows.every((win) => win.style.display !== "none")).toBeTrue();
    expect(new Set(windows.map((win) => win.style.left)).size).toBe(3);
    context()
      .find((button) => button.textContent === "Close Group")
      .click();
    await flushShell();
    expect(s.document.querySelectorAll(".xp-window")).toHaveLength(0);
  });

  test("keeps zero coordinates for a floating toolbar at the top-left corner", async () => {
    const s = await login(
      await loadShell({
        initialStorage: {
          taskbarSettings: JSON.stringify({
            quickLaunch: true,
            toolbarLayouts: {
              "__quick-launch": { floating: true, x: 0, y: 0 },
            },
          }),
        },
      }),
    );
    const toolbar = s.document.querySelector(".quick-launch-toolbar.floating");
    expect(toolbar.style.left).toBe("0px");
    expect(toolbar.style.top).toBe("0px");
  });

  test("keeps the Start menu usable while its style properties are open", async () => {
    const s = await login(await loadShell());
    const dialog = properties(s);
    dialog.querySelector('[data-taskbar-properties-tab="start-menu"]').click();
    for (const style of ["classic", "start"]) {
      dialog
        .querySelector(`[name="taskbar-start-menu-style"][value="${style}"]`)
        .click();
      dialog.querySelector('[data-action="apply"]').click();
      const choice = dialog.querySelector(
        `[name="taskbar-start-menu-style"][value="${style}"]`,
      );
      choice.focus();
      choice.dispatchEvent(
        new s.window.KeyboardEvent("keydown", {
          key: "Escape",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      expect(s.document.getElementById("start-menu").hidden).toBeFalse();
      expect(dialog.isConnected).toBeTrue();
      expect(s.document.documentElement.dataset.xpStartMenu).toBe(style);
      s.document.activeElement.dispatchEvent(
        new s.window.KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
      expect(s.document.getElementById("start-menu").hidden).toBeTrue();
      expect(dialog.isConnected).toBeTrue();
      s.document.getElementById("start-button").click();
      expect(s.document.getElementById("start-menu").hidden).toBeFalse();
      s.document.getElementById("start-button").click();
    }
    dialog.querySelector('[data-action="cancel"]').click();
    expect(dialog.isConnected).toBeFalse();
  });
});
