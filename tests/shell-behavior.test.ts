// @ts-nocheck -- Happy DOM's element types intentionally replace lib.dom here.
import { afterEach, expect, test } from "bun:test";
import {
  cleanupShells,
  clickStartAction,
  flushShell,
  loadShell,
  login,
} from "./helpers/shell-harness";

afterEach(cleanupShells);

test("startup accepts pointer and keyboard input before showing the desktop", async () => {
  const pointerShell = await loadShell();
  const pointerDocument = pointerShell.document;
  expect(pointerDocument.getElementById("boot-screen")!.hidden).toBeFalse();
  pointerDocument.getElementById("boot-screen")!.click();
  expect(pointerDocument.getElementById("welcome-screen")!.hidden).toBeFalse();
  pointerDocument.getElementById("welcome-screen")!.click();
  await flushShell();
  expect(pointerDocument.getElementById("desktop")!.hidden).toBeFalse();
  expect(pointerDocument.getElementById("taskbar")!.hidden).toBeFalse();

  const keyboardShell = await loadShell();
  const keyboardDocument = keyboardShell.document;
  keyboardDocument
    .getElementById("boot-screen")!
    .dispatchEvent(
      new keyboardShell.window.KeyboardEvent("keydown", { key: "Enter" }),
    );
  expect(keyboardDocument.getElementById("welcome-screen")!.hidden).toBeFalse();
  keyboardDocument
    .getElementById("welcome-screen")!
    .dispatchEvent(
      new keyboardShell.window.KeyboardEvent("keydown", { key: " " }),
    );
  await flushShell();
  expect(keyboardDocument.getElementById("desktop")!.hidden).toBeFalse();
});

test("Start menu opens, closes, and exposes working XP destinations", async () => {
  const shell = await login(await loadShell());
  const { document } = shell;
  const startButton = document.getElementById("start-button")!;
  const startMenu = document.getElementById("start-menu")!;

  startButton.click();
  expect(startMenu.hidden).toBeFalse();
  expect(
    [...document.querySelectorAll<HTMLElement>("[data-start-action]")].map(
      (item) => item.dataset.startAction,
    ),
  ).toEqual([
    "documents",
    "recent",
    "pictures",
    "music",
    "computer",
    "controlPanel",
    "printers",
    "help",
    "search",
    "run",
  ]);

  document.body.dispatchEvent(
    new shell.window.PointerEvent("pointerdown", { bubbles: true }),
  );
  expect(startMenu.hidden).toBeTrue();
  startButton.click();
  startButton.click();
  expect(startMenu.hidden).toBeTrue();

  const routes: Array<[string, string]> = [
    ["documents", "__my-documents"],
    ["pictures", "__my-pictures"],
    ["music", "__my-music"],
    ["computer", "__my-computer"],
    ["controlPanel", "__control-panel"],
    ["printers", "__printers"],
    ["help", "__help"],
    ["search", "__search"],
  ];
  for (const [action, windowId] of routes) {
    clickStartAction(shell, action);
    const opened = document.querySelector<HTMLElement>(
      `.xp-window[data-game="${windowId}"]`,
    );
    expect(opened).not.toBeNull();
    opened!.querySelector<HTMLButtonElement>(".close-btn")!.click();
  }
});

test("caption controls maximize, restore, and close a real shell window", async () => {
  const shell = await login(await loadShell());
  clickStartAction(shell, "documents");
  const win = shell.document.querySelector<HTMLElement>(
    '.xp-window[data-game="__my-documents"]',
  )!;
  const maximize = win.querySelector<HTMLButtonElement>(".maximize-btn")!;

  expect(maximize.getAttribute("aria-label")).toBe("Maximize");
  maximize.click();
  expect(win.classList.contains("maximized")).toBeTrue();
  expect(maximize.getAttribute("aria-label")).toBe("Restore");
  maximize.click();
  expect(win.classList.contains("maximized")).toBeFalse();
  expect(maximize.getAttribute("aria-label")).toBe("Maximize");

  win.querySelector<HTMLButtonElement>(".close-btn")!.click();
  expect(win.isConnected).toBeFalse();
});

test("desktop icons select and launch their actual destinations", async () => {
  const shell = await login(await loadShell());
  const settingsIcon = shell.document.querySelector<HTMLButtonElement>(
    '[data-desktop-id="__astro-settings"]',
  )!;

  settingsIcon.click();
  expect(settingsIcon.classList.contains("selected")).toBeTrue();
  settingsIcon.dispatchEvent(new shell.window.MouseEvent("dblclick"));
  expect(
    shell.document.querySelector(
      '.xp-window[data-game="__astro-settings"] .project-settings-content',
    ),
  ).not.toBeNull();
});

test("My Computer exposes the native desktop shell menu and opens Properties", async () => {
  const shell = await login(await loadShell());
  const icon = shell.document.querySelector<HTMLButtonElement>(
    '[data-desktop-id="__my-computer"]',
  )!;
  icon.dispatchEvent(
    new shell.window.MouseEvent("contextmenu", {
      bubbles: true,
      clientX: 40,
      clientY: 30,
    }),
  );

  const menu = shell.document.getElementById("desktop-context-menu")!;
  expect(menu.hidden).toBeFalse();
  const items = [...menu.querySelectorAll<HTMLButtonElement>("[data-action]")];
  expect(items.map((item) => item.textContent!.trim())).toEqual([
    "Open",
    "Explore",
    "Search...",
    "Manage",
    "Map Network Drive...",
    "Disconnect Network Drive...",
    "Create Shortcut",
    "Delete",
    "Rename",
    "Properties",
  ]);
  expect(items.every((item) => !item.disabled)).toBeTrue();
  expect(items[0].classList.contains("context-default")).toBeTrue();

  menu
    .querySelector<HTMLButtonElement>('[data-action="computer-properties"]')!
    .click();
  expect(
    shell.document.querySelector(".system-properties-dialog"),
  ).not.toBeNull();
});

test("Control Panel navigation opens applets and switches their tabs", async () => {
  const shell = await login(await loadShell());
  clickStartAction(shell, "controlPanel");
  const controlPanel = shell.document.querySelector<HTMLElement>(
    '.xp-window[data-game="__control-panel"]',
  )!;

  controlPanel
    .querySelector<HTMLButtonElement>(
      '[data-control-panel-category="appearance"]',
    )!
    .click();
  expect(controlPanel.querySelector("h1")!.textContent).toBe("Pick a task...");
  expect(
    controlPanel.querySelector(".control-panel-category-heading strong")!
      .textContent,
  ).toBe("Appearance and Themes");
  controlPanel
    .querySelector<HTMLButtonElement>(
      '[data-control-panel-action="folder-options"]',
    )!
    .click();

  const dialog = shell.document.querySelector<HTMLElement>(
    ".folder-options-dialog",
  )!;
  expect(dialog).not.toBeNull();
  const viewTab = dialog.querySelector<HTMLButtonElement>(
    '[data-folder-options-tab="view"]',
  )!;
  viewTab.click();
  expect(viewTab.getAttribute("aria-selected")).toBe("true");
  expect(
    dialog.querySelector<HTMLElement>('[data-folder-options-panel="view"]')!
      .hidden,
  ).toBeFalse();
  expect(
    dialog.querySelector<HTMLElement>('[data-folder-options-panel="general"]')!
      .hidden,
  ).toBeTrue();
});

test("Display Properties applies and persists a selected wallpaper", async () => {
  const shell = await login(await loadShell());
  clickStartAction(shell, "controlPanel");
  const controlPanel = shell.document.querySelector<HTMLElement>(
    '.xp-window[data-game="__control-panel"]',
  )!;
  controlPanel
    .querySelector<HTMLButtonElement>(
      '[data-control-panel-category="appearance"]',
    )!
    .click();
  controlPanel
    .querySelector<HTMLButtonElement>('[data-control-panel-action="display"]')!
    .click();

  const display = shell.document.querySelector<HTMLElement>(
    '.xp-window[data-game="__display-properties"]',
  )!;
  display.querySelector<HTMLButtonElement>("#display-tab-desktop")!.click();
  display
    .querySelector<HTMLButtonElement>('[data-wallpaper="ascent"]')!
    .click();
  const apply = display.querySelector<HTMLButtonElement>(
    '[data-display-action="apply"]',
  )!;
  expect(apply.disabled).toBeFalse();
  apply.click();

  expect(
    JSON.parse(shell.window.localStorage.getItem("displaySettings")!).wallpaper,
  ).toBe("ascent");
  expect(
    shell.document
      .getElementById("desktop")!
      .style.getPropertyValue("--desktop-background"),
  ).toContain("ascent.jpg");
  expect(apply.disabled).toBeTrue();
});

test("Windows Classic applies the native Classic appearance and solid desktop", async () => {
  const shell = await login(await loadShell());
  clickStartAction(shell, "controlPanel");
  const controlPanel = shell.document.querySelector<HTMLElement>(
    '.xp-window[data-game="__control-panel"]',
  )!;
  controlPanel
    .querySelector<HTMLButtonElement>(
      '[data-control-panel-category="appearance"]',
    )!
    .click();
  controlPanel
    .querySelector<HTMLButtonElement>('[data-control-panel-action="display"]')!
    .click();

  const display = shell.document.querySelector<HTMLElement>(
    '.xp-window[data-game="__display-properties"]',
  )!;
  const theme = display.querySelector<HTMLSelectElement>("#display-theme")!;
  theme.value = "classic";
  theme.dispatchEvent(new shell.window.Event("change", { bubbles: true }));

  expect(
    display.querySelector<HTMLElement>(".display-theme-sample")!.dataset
      .appearance,
  ).toBe("classic");
  expect(
    display.querySelector<HTMLSelectElement>("#display-window-style")!.value,
  ).toBe("classic");
  expect(
    display.querySelector<HTMLSelectElement>("#display-appearance")!.value,
  ).toBe("classic");

  display
    .querySelector<HTMLButtonElement>('[data-display-action="apply"]')!
    .click();
  const saved = JSON.parse(
    shell.window.localStorage.getItem("displaySettings")!,
  );
  expect(saved).toMatchObject({
    theme: "classic",
    appearance: "classic",
    wallpaper: "none",
    backgroundColor: "#3a6ea5",
  });
  expect(shell.document.documentElement.dataset.xpAppearance).toBe("classic");
  expect(
    shell.document
      .getElementById("desktop")!
      .style.getPropertyValue("--desktop-background"),
  ).toBe("none");
});

test("Run executes a shell command and closes after success", async () => {
  const shell = await login(await loadShell());
  clickStartAction(shell, "run");
  const runDialog = shell.document.querySelector<HTMLElement>(".run-dialog")!;
  const input = runDialog.querySelector<HTMLInputElement>("input")!;
  input.value = "control panel";
  input.dispatchEvent(new shell.window.Event("input", { bubbles: true }));
  runDialog.querySelector<HTMLButtonElement>('[data-action="run"]')!.click();
  await flushShell();

  expect(runDialog.isConnected).toBeFalse();
  expect(
    shell.document.querySelector('.xp-window[data-game="__control-panel"]'),
  ).not.toBeNull();
});

test("Search finds a virtual file and opens it in Notepad", async () => {
  const shell = await login(await loadShell());
  const filesystem = (
    shell.window as unknown as {
      VirtualFS: {
        MY_DOCUMENTS: string;
        createFile(parent: string, name: string, options: object): unknown;
      };
    }
  ).VirtualFS;
  filesystem.createFile(filesystem.MY_DOCUMENTS, "notes.txt", {
    content: "hello",
  });
  clickStartAction(shell, "search");
  const search = shell.document.querySelector<HTMLElement>(
    '.xp-window[data-game="__search"]',
  )!;
  [...search.querySelectorAll<HTMLButtonElement>("[data-search-kind]")]
    .find((button) => button.textContent === "All files and folders")!
    .click();
  const name = search.querySelector<HTMLInputElement>("#search-filename")!;
  name.value = "notes";
  name.dispatchEvent(new shell.window.Event("input", { bubbles: true }));
  search
    .querySelector<HTMLButtonElement>('[data-search-action="search"]')!
    .click();
  await flushShell();

  const result = [...search.querySelectorAll<HTMLElement>("button")].find(
    (button) => button.textContent?.includes("notes.txt"),
  )!;
  expect(result).not.toBeNull();
  result.dispatchEvent(
    new shell.window.MouseEvent("dblclick", { bubbles: true }),
  );
  expect(
    shell.document.querySelector('.xp-window[data-game="__notepad"]'),
  ).not.toBeNull();
});

test("system tray volume controls persist volume and mute state", async () => {
  const shell = await login(await loadShell());
  const { document, window } = shell;
  document.getElementById("tray-volume-button")!.click();
  expect(document.getElementById("tray-volume-popup")!.hidden).toBeFalse();

  const slider = document.getElementById(
    "tray-volume-slider",
  ) as HTMLInputElement;
  slider.value = "35";
  slider.dispatchEvent(new window.Event("input", { bubbles: true }));
  expect(window.localStorage.getItem("volume")).toBe("35");
  expect(window.localStorage.getItem("isMuted")).toBe("false");

  const mute = document.getElementById(
    "tray-mute-checkbox",
  ) as HTMLInputElement;
  mute.checked = true;
  mute.dispatchEvent(new window.Event("change", { bubbles: true }));
  expect(window.localStorage.getItem("isMuted")).toBe("true");
  expect(document.getElementById("tray-volume-button")!.title).toBe(
    "Volume (muted)",
  );
});

test("clock and network tray buttons open their corresponding dialogs", async () => {
  const shell = await login(await loadShell());
  shell.document.getElementById("taskbar-clock")!.click();
  expect(shell.document.querySelector(".datetime-dialog")).not.toBeNull();

  shell.document.getElementById("tray-network-button")!.click();
  expect(shell.document.getElementById("network-status-state")).not.toBeNull();
});

test("All Programs opens cascading menus and launches a game window", async () => {
  const shell = await login(await loadShell());
  shell.document.getElementById("start-button")!.click();
  shell.document.getElementById("all-programs-button")!.click();
  const flyouts = shell.document.getElementById("start-menu-flyouts")!;
  expect(flyouts.hidden).toBeFalse();
  flyouts
    .querySelector<HTMLButtonElement>('[data-category="Adventure"]')!
    .click();
  const game = [
    ...flyouts.querySelectorAll<HTMLButtonElement>(".sm-game"),
  ].find((button) => button.textContent?.includes("Inside the Firewall"));
  expect(game).not.toBeNull();
  game!.click();
  await flushShell();
  expect(
    shell.document.querySelector(
      '.xp-window[data-game="inside-the-firewall"] iframe',
    ),
  ).not.toBeNull();
});

test("logoff and shutdown actions change the visible session screen", async () => {
  const shell = await login(await loadShell());
  const { document } = shell;

  document.getElementById("start-button")!.click();
  document.getElementById("log-off-button")!.click();
  expect(document.getElementById("logoff-dialog")!.hidden).toBeFalse();
  document.getElementById("logoff-confirm")!.click();
  expect(document.getElementById("welcome-screen")!.hidden).toBeFalse();

  document.getElementById("welcome-screen")!.click();
  await flushShell();
  document.getElementById("start-button")!.click();
  document.getElementById("turn-off-button")!.click();
  expect(document.getElementById("shutdown-dialog")!.hidden).toBeFalse();
  document.getElementById("standby-confirm")!.click();
  expect(document.getElementById("standby-screen")!.hidden).toBeFalse();
  document.getElementById("standby-resume")!.click();
  expect(document.getElementById("standby-screen")!.hidden).toBeTrue();
});
