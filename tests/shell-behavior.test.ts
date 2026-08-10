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
    "startup",
    "internet-explorer",
    "msn",
    "outlook-express",
    "remote-assistance",
    "windows-media-player",
    "windows-messenger",
    "windows-movie-maker",
    "astro-settings",
    "internet-games",
  ]);
  expect(
    flyouts
      .querySelector('[data-program-id="program-access-defaults"] img')!
      .getAttribute("src"),
  ).toEndWith("/ProgramAccessDefaultsSmall.png");
  expect(
    flyouts
      .querySelector('[data-program-id="windows-catalog"] img')!
      .getAttribute("src"),
  ).toEndWith("/WindowsCatalog.png");
  expect(
    flyouts
      .querySelector('[data-program-id="windows-update"] img')!
      .getAttribute("src"),
  ).toEndWith("/WindowsUpdate.png");
  expect(
    flyouts
      .querySelector('[data-program-id="internet-explorer"] img')!
      .getAttribute("src"),
  ).toEndWith("/InternetExplorer.png");
  for (const programId of ["accessories", "games", "startup"]) {
    expect(
      flyouts
        .querySelector(`[data-program-id="${programId}"] img`)!
        .getAttribute("src"),
    ).toEndWith("/ProgramFolder.png");
  }

  flyouts
    .querySelector<HTMLButtonElement>('[data-program-id="accessories"]')!
    .click();
  const accessories = flyouts.querySelectorAll(".start-program-flyout")[1]!;
  const accessoryIds = [
    ...accessories.querySelectorAll<HTMLElement>("[data-program-id]"),
  ].map((item) => item.dataset.programId);
  for (const programId of [
    "accessibility",
    "communications",
    "entertainment",
    "system-tools",
    "address-book",
    "calculator",
    "command-prompt",
    "notepad",
    "paint",
    "wordpad",
  ]) {
    expect(accessoryIds).toContain(programId);
  }
  const calculator = accessories.querySelector<HTMLButtonElement>(
    '[data-program-id="calculator"]',
  )!;
  calculator.click();
  const calculatorWindow = shell.document.querySelector(
    '.xp-window[data-game="__calculator"]',
  )!;
  const calculatorKeys = [
    ...calculatorWindow.querySelectorAll<HTMLButtonElement>(
      ".xp-calculator-keys button",
    ),
  ];
  for (const key of ["2", "+", "3", "="]) {
    calculatorKeys.find((button) => button.textContent === key)!.click();
  }
  expect(
    calculatorWindow.querySelector<HTMLInputElement>(".xp-calculator-display")!
      .value,
  ).toBe("5");

  shell.document.getElementById("start-button")!.click();
  shell.document.getElementById("all-programs-button")!.click();
  flyouts
    .querySelector<HTMLButtonElement>('[data-program-id="accessories"]')!
    .click();
  const notepad = flyouts.querySelector<HTMLButtonElement>(
    '[data-program-id="notepad"]',
  )!;
  expect(notepad).not.toBeNull();
  expect(notepad.querySelector("img")!.getAttribute("src")).toEndWith(
    "/Notepad.png",
  );
  notepad.click();
  expect(shell.document.querySelector(".notepad-window")).not.toBeNull();

  shell.document.getElementById("start-button")!.click();
  shell.document.getElementById("all-programs-button")!.click();
  flyouts
    .querySelector<HTMLButtonElement>('[data-program-id="games"]')!
    .click();
  const minesweeper = flyouts.querySelector<HTMLButtonElement>(
    '[data-program-id="minesweeper"]',
  )!;
  expect(minesweeper.querySelector("img")!.getAttribute("src")).toEndWith(
    "/Minesweeper.png",
  );
  minesweeper.click();
  const minesweeperWindow = shell.document.querySelector(
    '.xp-window[data-game="__minesweeper"]',
  )!;
  const mineCells = minesweeperWindow.querySelectorAll<HTMLButtonElement>(
    ".xp-minesweeper-board [role='gridcell']",
  );
  expect(mineCells).toHaveLength(81);
  mineCells[40]!.click();
  expect(mineCells[40]!.classList.contains("revealed")).toBeTrue();
  const difficulty = minesweeperWindow.querySelector<HTMLSelectElement>(
    '[aria-label="Difficulty"]',
  )!;
  difficulty.value = "intermediate";
  difficulty.dispatchEvent(new shell.window.Event("change", { bubbles: true }));
  const intermediateCells =
    minesweeperWindow.querySelectorAll<HTMLButtonElement>(
      ".xp-minesweeper-board [role='gridcell']",
    );
  expect(intermediateCells).toHaveLength(256);
  intermediateCells[128]!.click();
  expect(intermediateCells[128]!.classList.contains("revealed")).toBeTrue();

  shell.document.getElementById("start-button")!.click();
  shell.document.getElementById("all-programs-button")!.click();
  flyouts
    .querySelector<HTMLButtonElement>('[data-program-id="games"]')!
    .click();
  flyouts
    .querySelector<HTMLButtonElement>('[data-program-id="solitaire"]')!
    .click();
  const solitaireWindow = shell.document.querySelector(
    '.xp-window[data-game="__solitaire"]',
  )!;
  expect(
    solitaireWindow.querySelectorAll(".xp-solitaire-tableau > div"),
  ).toHaveLength(7);
  solitaireWindow
    .querySelector<HTMLButtonElement>(".xp-solitaire-stock")!
    .click();
  expect(
    solitaireWindow
      .querySelector(".xp-solitaire-waste")!
      .classList.contains("empty"),
  ).toBeFalse();

  shell.document.getElementById("start-button")!.click();
  shell.document.getElementById("all-programs-button")!.click();
  flyouts
    .querySelector<HTMLButtonElement>('[data-program-id="games"]')!
    .click();
  const adventure = [
    ...flyouts.querySelectorAll<HTMLButtonElement>(".start-program-folder"),
  ].find((button) => button.textContent?.trim().startsWith("Adventure"));
  expect(adventure).not.toBeNull();
  expect(adventure!.querySelector("img")!.getAttribute("src")).toEndWith(
    "/ProgramFolder.png",
  );
  adventure!.click();
  const game = [
    ...flyouts.querySelectorAll<HTMLButtonElement>(".sm-game"),
  ].find((button) => button.textContent?.includes("Inside the Firewall"));
  expect(game).not.toBeNull();
  expect(game!.querySelector("img")!.getAttribute("src")).toContain(
    "inside-the-firewall",
  );
  game!.click();
  await flushShell();
  expect(
    shell.document.querySelector(
      '.xp-window[data-game="inside-the-firewall"] iframe',
    ),
  ).not.toBeNull();
});

test("Paint launches JS Paint and owns supported picture file associations", async () => {
  const shell = await login(await loadShell());
  const picture = shell.window.VirtualFS.createFile(
    shell.window.VirtualFS.MY_PICTURES,
    "sample.png",
    { content: "data:image/png;base64,iVBORw0KGgo=" },
  );

  expect(shell.window.VirtualFS.open(picture.id)).toBeTrue();
  const paintWindow = shell.document.querySelector<HTMLElement>(
    '.xp-window[data-game="__paint"]',
  )!;
  const frame =
    paintWindow.querySelector<HTMLIFrameElement>(".xp-paint-frame")!;

  expect(paintWindow).not.toBeNull();
  expect(frame).not.toBeNull();
  expect(frame.getAttribute("src")).toBe("vendor/jspaint/index.html");
  expect(frame.title).toBe("Microsoft Paint drawing area");
});

test("Outlook Express composes mail and Windows Messenger sends local messages", async () => {
  const shell = await login(await loadShell());
  const openRootProgram = (programId: string) => {
    shell.document.getElementById("start-button")!.click();
    shell.document.getElementById("all-programs-button")!.click();
    shell.document
      .getElementById("start-menu-flyouts")!
      .querySelector<HTMLButtonElement>(`[data-program-id="${programId}"]`)!
      .click();
  };

  openRootProgram("outlook-express");
  const outlook = shell.document.querySelector(
    '.xp-window[data-game="__outlook-express"]',
  )!;
  outlook.querySelector<HTMLTableRowElement>("[data-message]")!.click();
  const reply = outlook.querySelector<HTMLButtonElement>("[data-mail-reply]")!;
  expect(reply.disabled).toBeFalse();
  reply.click();
  expect(
    outlook.querySelector<HTMLInputElement>('[name="subject"]')!.value,
  ).toBe("Re: Welcome to Outlook Express 6");
  expect(outlook.querySelector<HTMLInputElement>('[name="to"]')!.value).toBe(
    "outlook-express@example.com",
  );
  outlook.querySelector<HTMLButtonElement>("[data-mail-new]")!.click();
  const form = outlook.querySelector<HTMLFormElement>(".xp-mail-compose")!;
  form.elements.namedItem("to")!.value = "friend@example.com";
  form.elements.namedItem("subject")!.value = "Hello from XP";
  form.elements.namedItem("body")!.value = "This message stays local.";
  form.dispatchEvent(new shell.window.Event("submit", { bubbles: true }));
  expect(outlook.querySelector(".xp-mail-folders")!.textContent).toContain(
    "Sent Items (1)",
  );
  expect(outlook.querySelector(".xp-mail-list")!.textContent).toContain(
    "Hello from XP",
  );
  outlook.querySelector<HTMLTableRowElement>("[data-message]")!.click();
  outlook.querySelector<HTMLButtonElement>("[data-mail-delete]")!.click();
  expect(outlook.querySelector(".xp-mail-folders")!.textContent).toContain(
    "Deleted Items (1)",
  );

  openRootProgram("windows-messenger");
  const messenger = shell.document.querySelector(
    '.xp-window[data-game="__windows-messenger"]',
  )!;
  expect(
    messenger.querySelector<HTMLImageElement>(".title-icon img")!.src,
  ).toEndWith("/WindowsMessenger.png");
  expect(
    messenger.querySelector<HTMLImageElement>(".xp-messenger-account img")!.src,
  ).toEndWith("/WindowsMessengerLarge.png");
  messenger.querySelector<HTMLButtonElement>("[data-contact]")!.click();
  const message = messenger.querySelector<HTMLInputElement>(
    'input[aria-label="Message"]',
  )!;
  message.value = "Are you there?";
  message
    .closest("form")!
    .dispatchEvent(new shell.window.Event("submit", { bubbles: true }));
  expect(
    messenger.querySelector(".xp-messenger-history")!.textContent,
  ).toContain("Administrator says: Are you there?");
});

test("Internet Explorer maintains working navigation history", async () => {
  const shell = await login(await loadShell());
  shell.document.getElementById("start-button")!.click();
  shell.document.getElementById("all-programs-button")!.click();
  shell.document
    .getElementById("start-menu-flyouts")!
    .querySelector<HTMLButtonElement>('[data-program-id="internet-explorer"]')!
    .click();
  const browser = shell.document.querySelector(
    '.xp-window[data-game="__internet-explorer"]',
  )!;
  const address = browser.querySelector<HTMLInputElement>(
    'input[aria-label="Address"]',
  )!;
  const go = browser.querySelector<HTMLButtonElement>("[data-go]")!;
  address.value = "http://first.example/";
  go.click();
  address.value = "http://second.example/";
  go.click();
  browser.querySelector<HTMLButtonElement>("[data-browser-back]")!.click();
  expect(address.value).toBe("http://first.example/");
  expect(browser.querySelector(".xp-browser-page h1")!.textContent).toBe(
    "http://first.example/",
  );
  browser.querySelector<HTMLButtonElement>("[data-browser-forward]")!.click();
  expect(address.value).toBe("http://second.example/");
});

test("restored XP utilities expose dedicated working controls", async () => {
  const shell = await login(await loadShell());
  const openEntertainment = () => {
    shell.document.getElementById("start-button")!.click();
    shell.document.getElementById("all-programs-button")!.click();
    const flyouts = shell.document.getElementById("start-menu-flyouts")!;
    flyouts
      .querySelector<HTMLButtonElement>('[data-program-id="accessories"]')!
      .click();
    flyouts
      .querySelector<HTMLButtonElement>('[data-program-id="entertainment"]')!
      .click();
    return flyouts;
  };

  let flyouts = openEntertainment();
  flyouts
    .querySelector<HTMLButtonElement>('[data-program-id="volume-control"]')!
    .click();
  const volume = shell.document.querySelector<HTMLInputElement>(
    '.xp-window[data-game="__volume-control"] input[type="range"]',
  )!;
  volume.value = "35";
  volume.dispatchEvent(new shell.window.Event("input", { bubbles: true }));
  expect(shell.window.localStorage.getItem("volume")).toBe("35");

  flyouts = openEntertainment();
  flyouts
    .querySelector<HTMLButtonElement>('[data-program-id="sound-recorder"]')!
    .click();
  const recorder = shell.document.querySelector(
    '.xp-window[data-game="__sound-recorder"]',
  )!;
  recorder.querySelector<HTMLButtonElement>('[data-action="record"]')!.click();
  expect(recorder.querySelector(".xp-recorder-wave")!.classList).toContain(
    "active",
  );
  recorder.querySelector<HTMLButtonElement>('[data-action="stop"]')!.click();
  expect(recorder.querySelector(".xp-recorder-wave")!.classList).not.toContain(
    "active",
  );
});

test("FreeCell and restored system tools perform their primary workflows", async () => {
  const shell = await login(await loadShell());
  const openProgram = (folders: string[], programId: string) => {
    shell.document.getElementById("start-button")!.click();
    shell.document.getElementById("all-programs-button")!.click();
    const flyouts = shell.document.getElementById("start-menu-flyouts")!;
    for (const folder of folders) {
      flyouts
        .querySelector<HTMLButtonElement>(`[data-program-id="${folder}"]`)!
        .click();
    }
    flyouts
      .querySelector<HTMLButtonElement>(`[data-program-id="${programId}"]`)!
      .click();
  };

  openProgram(["games"], "freecell");
  const freeCell = shell.document.querySelector(
    '.xp-window[data-game="__freecell"]',
  )!;
  expect(freeCell.querySelectorAll(".xp-freecell-cascade")).toHaveLength(8);
  expect(
    freeCell.querySelectorAll(".xp-freecell-cascade .xp-playing-card"),
  ).toHaveLength(52);
  freeCell
    .querySelector<HTMLButtonElement>(
      ".xp-freecell-cascade:first-child button:last-child",
    )!
    .click();
  freeCell
    .querySelector<HTMLButtonElement>('.xp-freecell-cells [data-cell="0"]')!
    .click();
  expect(
    freeCell
      .querySelector('.xp-freecell-cells [data-cell="0"]')!
      .classList.contains("empty"),
  ).toBeFalse();
  expect(
    freeCell.querySelectorAll(".xp-freecell-cascade .xp-playing-card"),
  ).toHaveLength(51);

  openProgram(["accessories", "system-tools"], "disk-defragmenter");
  const defrag = shell.document.querySelector(
    '.xp-window[data-game="__disk-defragmenter"]',
  )!;
  expect(defrag.querySelector("[data-disk-clean]")).toBeNull();
  const defragment =
    defrag.querySelector<HTMLButtonElement>("[data-defrag-run]")!;
  expect(defragment.disabled).toBeTrue();
  defrag.querySelector<HTMLButtonElement>("[data-defrag-analyze]")!.click();
  expect(defragment.disabled).toBeFalse();
  defragment.click();
  expect(defrag.querySelector(".xp-program-status")!.textContent).toContain(
    "Defragmentation is complete",
  );

  openProgram(["accessories", "system-tools"], "system-information");
  const information = shell.document.querySelector(
    '.xp-window[data-game="__system-information"]',
  )!;
  information
    .querySelector<HTMLButtonElement>('[data-info-section="components"]')!
    .click();
  expect(information.querySelector("table")!.textContent).toContain(
    "Standard VGA Graphics Adapter",
  );

  openProgram(["accessories", "communications"], "hyperterminal");
  const hyperTerminal = shell.document.querySelector(
    '.xp-window[data-game="__hyperterminal"]',
  )!;
  const connection = hyperTerminal.querySelector<HTMLFormElement>(
    ".xp-hyperterminal-connect",
  )!;
  connection.elements.namedItem("phone")!.value = "5550100";
  connection.dispatchEvent(
    new shell.window.Event("submit", { bubbles: true, cancelable: true }),
  );
  const terminalInput = hyperTerminal.querySelector<HTMLInputElement>(
    ".xp-hyperterminal-prompt input",
  )!;
  terminalInput.value = "HELLO XP";
  terminalInput
    .closest("form")!
    .dispatchEvent(
      new shell.window.Event("submit", { bubbles: true, cancelable: true }),
    );
  expect(
    hyperTerminal.querySelector(".xp-hyperterminal-screen")!.textContent,
  ).toContain("HELLO XP");

  openProgram(["accessories", "system-tools"], "scheduled-tasks");
  const scheduledTasks = shell.document.querySelector(
    '.xp-window[data-game="__scheduled-tasks"]',
  )!;
  scheduledTasks.querySelector<HTMLButtonElement>("[data-task-new]")!.click();
  const taskForm =
    scheduledTasks.querySelector<HTMLFormElement>(".xp-task-form")!;
  taskForm.elements.namedItem("name")!.value = "Daily Cleanup";
  taskForm.dispatchEvent(
    new shell.window.Event("submit", { bubbles: true, cancelable: true }),
  );
  expect(scheduledTasks.querySelector(".xp-task-list")!.textContent).toContain(
    "Daily Cleanup",
  );
  scheduledTasks.querySelector<HTMLButtonElement>("[data-task-run]")!.click();
  expect(
    scheduledTasks.querySelector(".xp-program-status")!.textContent,
  ).toContain("Daily Cleanup ran Disk Cleanup");
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
