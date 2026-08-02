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

test("desktop arrow keys move between icons by screen direction", async () => {
  const shell = await login(await loadShell());
  const ids = [
    "__my-computer",
    "__my-documents",
    "__internet-games",
    "__astro-settings",
  ];
  const icons = ids.map((id) =>
    shell.document.querySelector<HTMLButtonElement>(
      `[data-desktop-id="${id}"]`,
    ),
  );
  const positions = [
    [8, 8],
    [8, 88],
    [90, 8],
    [90, 88],
  ];
  icons.forEach((icon, index) => {
    const [left, top] = positions[index];
    icon!.getBoundingClientRect = () => ({
      left,
      top,
      right: left + 76,
      bottom: top + 74,
      width: 76,
      height: 74,
      x: left,
      y: top,
      toJSON: () => ({}),
    });
  });

  const press = (key: string) => {
    shell.document.dispatchEvent(
      new shell.window.KeyboardEvent("keydown", { key, bubbles: true }),
    );
  };
  icons[0]!.click();
  icons[0]!.focus();

  press("ArrowRight");
  expect(shell.document.activeElement).toBe(icons[2]);
  press("ArrowDown");
  expect(shell.document.activeElement).toBe(icons[3]);
  press("ArrowLeft");
  expect(shell.document.activeElement).toBe(icons[1]);
  press("ArrowUp");
  expect(shell.document.activeElement).toBe(icons[0]);
  expect(icons[0]!.classList.contains("selected")).toBeTrue();
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

test("All Programs exposes system applications and games in the XP hierarchy", async () => {
  const shell = await login(await loadShell());
  shell.document.getElementById("start-button")!.click();
  shell.document.getElementById("all-programs-button")!.click();
  const flyouts = shell.document.getElementById("start-menu-flyouts")!;
  expect(flyouts.hidden).toBeFalse();
  expect(
    [...flyouts.querySelectorAll<HTMLElement>("[data-program-id]")].map(
      (item) => item.dataset.programId,
    ),
  ).toEqual([
    "program-access-defaults",
    "windows-catalog",
    "windows-update",
    "accessories",
    "games",
    "astro-settings",
    "internet-games",
  ]);

  flyouts
    .querySelector<HTMLButtonElement>('[data-program-id="accessories"]')!
    .click();
  const notepad = flyouts.querySelector<HTMLButtonElement>(
    '[data-program-id="notepad"]',
  )!;
  expect(notepad).not.toBeNull();
  notepad.click();
  expect(shell.document.querySelector(".notepad-window")).not.toBeNull();

  shell.document.getElementById("start-button")!.click();
  shell.document.getElementById("all-programs-button")!.click();
  flyouts
    .querySelector<HTMLButtonElement>('[data-program-id="games"]')!
    .click();
  const adventure = [
    ...flyouts.querySelectorAll<HTMLButtonElement>("button"),
  ].find((button) => button.textContent?.trim().startsWith("Adventure"))!;
  adventure.click();
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

test("Taskbar Properties applies Classic Start menu independently and switches previews", async () => {
  const shell = await login(await loadShell());
  const { document, window } = shell;
  document.getElementById("taskbar")!.dispatchEvent(
    new window.MouseEvent("contextmenu", {
      bubbles: true,
      clientX: 400,
      clientY: 740,
    }),
  );
  document
    .querySelector<HTMLButtonElement>('[data-taskbar-action="properties"]')!
    .click();
  const dialog = document.querySelector<HTMLElement>(
    ".taskbar-properties-dialog",
  )!;
  dialog
    .querySelector<HTMLButtonElement>(
      '[data-taskbar-properties-tab="start-menu"]',
    )!
    .click();

  const preview = dialog.querySelector<HTMLImageElement>(
    ".taskbar-start-menu-preview",
  )!;
  expect(preview.src).toEndWith("/assets/xp/system/StartMenuPreview.png");
  const classic = dialog.querySelector<HTMLInputElement>(
    '[name="taskbar-start-menu-style"][value="classic"]',
  )!;
  classic.click();
  expect(preview.src).toEndWith(
    "/assets/xp/system/ClassicStartMenuPreview.png",
  );
  expect(
    dialog.querySelector<HTMLButtonElement>(".taskbar-start-customize")!
      .disabled,
  ).toBeTrue();
  expect(
    dialog.querySelector<HTMLButtonElement>(".taskbar-classic-customize")!
      .disabled,
  ).toBeFalse();
  dialog
    .querySelector<HTMLButtonElement>(
      '.taskbar-properties-buttons [data-action="ok"]',
    )!
    .click();

  expect(window.localStorage.getItem("startMenuStyle")).toBe("classic");
  expect(document.documentElement.dataset.xpStartMenu).toBe("classic");
  expect(document.documentElement.dataset.xpAppearance).toBe("blue");
  document.getElementById("start-button")!.click();
  expect(document.querySelector(".start-menu-user")!.textContent).toBe(
    "Windows XP Professional",
  );
  expect(
    document.querySelector("#all-programs-button > .all-programs-label")!
      .textContent,
  ).toBe("Programs");
  expect(document.getElementById("log-off-button")!.textContent).toContain(
    "Log Off astro...",
  );

  document.documentElement.dataset.xpAppearance = "classic";
  expect(document.documentElement.dataset.xpStartMenu).toBe("classic");
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
