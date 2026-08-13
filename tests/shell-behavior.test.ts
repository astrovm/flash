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
  ).toContain('url("/assets/xp/wallpapers/ascent.jpg")');
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
    "accessories",
    "games",
    "startup",
    "winamp",
    "astro-settings",
    "internet-games",
  ]);
  for (const programId of ["accessories", "games", "startup", "winamp"]) {
    expect(
      flyouts
        .querySelector(`[data-program-id="${programId}"] img`)!
        .getAttribute("src"),
    ).toEndWith("/ProgramFolder.png");
  }

  flyouts
    .querySelector<HTMLButtonElement>('[data-program-id="winamp"]')!
    .click();
  const winampGroup = flyouts.querySelectorAll(".start-program-flyout")[1]!;
  expect(
    winampGroup.querySelector<HTMLElement>('[data-program-id="winamp"]'),
  ).not.toBeNull();

  flyouts
    .querySelector<HTMLButtonElement>('[data-program-id="accessories"]')!
    .click();
  const accessories = flyouts.querySelectorAll(".start-program-flyout")[1]!;
  const accessoryIds = [
    ...accessories.querySelectorAll<HTMLElement>("[data-program-id]"),
  ].map((item) => item.dataset.programId);
  for (const programId of [
    "entertainment",
    "system-tools",
    "calculator",
    "command-prompt",
    "notepad",
    "paint",
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
  expect(
    minesweeperWindow.querySelector<HTMLButtonElement>(".maximize-btn")!
      .disabled,
  ).toBeTrue();
  expect(minesweeperWindow.querySelector(".resize-handle")).toBeNull();
  const mineCells = minesweeperWindow.querySelectorAll<HTMLButtonElement>(
    ".xp-minesweeper-board [role='gridcell']",
  );
  expect(mineCells).toHaveLength(81);
  mineCells[40]!.click();
  expect(mineCells[40]!.dataset.open).toBe("true");
  minesweeperWindow
    .querySelector<HTMLButtonElement>(".minesweeper-menu-trigger")!
    .click();
  minesweeperWindow
    .querySelector<HTMLButtonElement>('[data-command="intermediate"]')!
    .click();
  const intermediateCells =
    minesweeperWindow.querySelectorAll<HTMLButtonElement>(
      ".xp-minesweeper-board [role='gridcell']",
    );
  expect(intermediateCells).toHaveLength(256);
  intermediateCells[128]!.click();
  expect(intermediateCells[128]!.dataset.open).toBe("true");

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
  const solitaireFrame = solitaireWindow.querySelector<HTMLIFrameElement>(
    ".boxedwine-app-frame",
  )!;
  expect(solitaireFrame).not.toBeNull();
  expect(new URL(solitaireFrame.src).searchParams.get("executable")).toBe(
    "resize-host.exe",
  );

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

test("Command Prompt uses the XP console layout and operates on the shared filesystem", async () => {
  const shell = await login(await loadShell());
  shell.document.getElementById("start-button")!.click();
  shell.document.getElementById("all-programs-button")!.click();
  const flyouts = shell.document.getElementById("start-menu-flyouts")!;
  flyouts
    .querySelector<HTMLButtonElement>('[data-program-id="accessories"]')!
    .click();
  flyouts
    .querySelector<HTMLButtonElement>('[data-program-id="command-prompt"]')!
    .click();

  const commandWindow = shell.document.querySelector<HTMLElement>(
    '.xp-window[data-game="__command-prompt"]',
  )!;
  const input = commandWindow.querySelector<HTMLInputElement>(
    ".xp-terminal-prompt input",
  )!;
  const output = commandWindow.querySelector<HTMLElement>(
    ".xp-terminal-output",
  )!;
  const prompt = commandWindow.querySelector<HTMLElement>(
    ".xp-terminal-prompt span",
  )!;
  const run = (command: string) => {
    input.value = command;
    input.dispatchEvent(
      new shell.window.KeyboardEvent("keydown", {
        bubbles: true,
        key: "Enter",
      }),
    );
  };

  expect(commandWindow.style.width).toBe("668px");
  expect(commandWindow.style.height).toBe("338px");
  expect(commandWindow.style.left).toBe("24px");
  expect(commandWindow.style.top).toBe("30px");
  expect(
    commandWindow.querySelector<HTMLButtonElement>(".maximize-btn")!.disabled,
  ).toBeTrue();
  expect(commandWindow.querySelector(".resize-handle")).toBeNull();
  expect(commandWindow.querySelector(".title-text")!.textContent).toBe(
    "C:\\WINDOWS\\system32\\cmd.exe",
  );
  expect(output.textContent).toStartWith(
    "Microsoft Windows XP [Version 5.1.2600]",
  );
  expect(prompt.textContent).toBe("C:\\Documents and Settings\\Administrator>");

  run('cd "My Documents"');
  expect(prompt.textContent).toBe(
    "C:\\Documents and Settings\\Administrator\\My Documents>",
  );
  run("echo Hello XP>note.txt");
  const note = shell.window.VirtualFS.findChild(
    shell.window.VirtualFS.MY_DOCUMENTS,
    "note.txt",
  );
  expect(note).not.toBeNull();
  expect(shell.window.VirtualFS.getContent(note.id)).toBe("Hello XP\n");

  run("type note.txt");
  expect(output.textContent).toContain("Hello XP");
  run("notepad note.txt");
  expect(
    shell.document.querySelector('.xp-window[data-game="__notepad"]'),
  ).not.toBeNull();
  run("del note.txt");
  expect(shell.window.VirtualFS.getNode(note.id)).toBeNull();
});

test("native games open from their public deep links", async () => {
  for (const [deepLink, applicationId] of [
    ["freecell", "__freecell"],
    ["minesweeper", "__minesweeper"],
    ["pinball", "__pinball"],
    ["solitaire", "__solitaire"],
    ["spider-solitaire", "__spider-solitaire"],
  ]) {
    const shell = await loadShell();
    shell.window.location.hash = `#${deepLink}`;
    await login(shell);
    expect(
      shell.document.querySelector(`.xp-window[data-game="${applicationId}"]`),
    ).not.toBeNull();
  }
});

test("bundled iframe deep links use the production release base URL", async () => {
  const shell = await loadShell();
  const version = "26.08.12-abcdef1";
  const gameRoot = "iframe/inside-the-firewall.0123456789abcdef/";
  const base = shell.document.createElement("base");
  base.href = `/releases/${version}/`;
  shell.document.head.prepend(base);
  shell.window.ASTRO_GAME_ROOTS = {
    "inside-the-firewall": gameRoot,
  };
  shell.window.location.hash = "#inside-the-firewall";

  await login(shell);

  const frame = shell.document.querySelector<HTMLIFrameElement>(
    '.xp-window[data-game="inside-the-firewall"] iframe',
  );
  expect(frame?.src).toBe(`http://127.0.0.1/releases/${version}/${gameRoot}`);
});

test("placeholder-only applications are not installed or exposed by the shell", async () => {
  const shell = await login(await loadShell());
  const removedApplicationIds = [
    "__accessibility-wizard",
    "__magnifier",
    "__narrator",
    "__utility-manager",
    "__program-compatibility-wizard",
    "__synchronize",
    "__tour-windows-xp",
    "__network-connections",
    "__network-setup-wizard",
    "__new-connection-wizard",
    "__wireless-network-setup-wizard",
    "__remote-assistance",
    "__hearts",
    "__internet-backgammon",
    "__internet-checkers",
    "__internet-hearts",
    "__internet-reversi",
    "__internet-spades",
    "__windows-catalog",
    "__windows-update",
    "__backup",
    "__files-settings-transfer",
    "__system-restore",
    "__windows-movie-maker",
    "__on-screen-keyboard",
    "__character-map",
    "__remote-desktop",
    "__wordpad",
    "__hyperterminal",
    "__internet-explorer",
    "__msn",
    "__outlook-express",
    "__windows-messenger",
    "__program-access-defaults",
    "__sound-recorder",
    "__windows-media-player",
    "__disk-cleanup",
    "__disk-defragmenter",
    "__scheduled-tasks",
    "__system-information",
    "__address-book",
  ];

  for (const applicationId of removedApplicationIds) {
    expect(shell.window.XPApplicationRegistry.has(applicationId)).toBeFalse();
    expect(
      shell.document.querySelector(
        `.desktop-icon[data-system-id="${applicationId}"]`,
      ),
    ).toBeNull();
  }

  shell.document.getElementById("start-button")!.click();
  shell.document.getElementById("all-programs-button")!.click();
  const flyouts = shell.document.getElementById("start-menu-flyouts")!;
  for (const folder of [
    "accessories",
    "accessibility",
    "communications",
    "system-tools",
    "games",
  ]) {
    flyouts
      .querySelector<HTMLButtonElement>(`[data-program-id="${folder}"]`)
      ?.click();
  }
  const exposedIds = [
    ...flyouts.querySelectorAll<HTMLElement>("[data-program-id]"),
  ].map((item) => item.dataset.programId);
  for (const applicationId of removedApplicationIds) {
    expect(exposedIds).not.toContain(applicationId.slice(2));
  }
});

test("Paint mounts natively and owns supported picture file associations", async () => {
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
  expect(paintWindow).not.toBeNull();
  expect(paintWindow.querySelector("iframe")).toBeNull();
  expect(paintWindow.querySelector(".paint-menu-bar")).not.toBeNull();
  expect(paintWindow.querySelector(".paint-toolbox")).not.toBeNull();
  expect(paintWindow.querySelector("canvas.paint-canvas")).not.toBeNull();
  expect(paintWindow.querySelectorAll(".paint-scrollbar")).toHaveLength(2);
  expect(
    paintWindow.querySelector<HTMLButtonElement>(".paint-tool.selected")!
      .dataset.tool,
  ).toBe("rect-select");
  expect(paintWindow.querySelectorAll(".paint-status span")).toHaveLength(3);
  expect(paintWindow.classList.contains("xp-native-paint-window")).toBeTrue();
  expect(paintWindow.style.width).toBe("760px");
  expect(paintWindow.style.height).toBe("560px");
  expect(paintWindow.style.left).toBe("0px");
  expect(paintWindow.style.top).toBe("0px");

  const menuButton = (label: string) =>
    [
      ...paintWindow.querySelectorAll<HTMLButtonElement>(
        ".paint-menu-group > button",
      ),
    ].find((button) => button.textContent === label)!;
  menuButton("File").click();
  expect(
    paintWindow.querySelector<HTMLButtonElement>(
      '[data-paint-command="scanner"]',
    )!.disabled,
  ).toBeTrue();
  expect(
    paintWindow.querySelector('[data-paint-command="wallpaper-tiled"]'),
  ).not.toBeNull();
  paintWindow
    .querySelector<HTMLButtonElement>('[data-paint-command="open"]')!
    .click();
  await flushShell();
  const openDialog = shell.document.querySelector<HTMLElement>(
    '.xp-dialog[aria-label="Open"]',
  )!;
  expect(
    [...openDialog.querySelectorAll<HTMLElement>(".dlg-file-item")].some(
      (item) => item.textContent?.trim().endsWith("sample.png"),
    ),
  ).toBeTrue();
  openDialog
    .querySelectorAll<HTMLButtonElement>(".dlg-buttons button")[1]
    .click();
  menuButton("File").click();
  paintWindow
    .querySelector<HTMLButtonElement>('[data-paint-command="new"]')!
    .click();
  await flushShell();

  menuButton("Colors").click();
  paintWindow
    .querySelector<HTMLButtonElement>('[data-paint-command="edit-colors"]')!
    .click();
  const editColors = shell.document.querySelector<HTMLElement>(
    ".paint-edit-colors-dialog",
  )!;
  expect(editColors.querySelector(".help-btn")).not.toBeNull();
  expect(
    editColors.querySelectorAll(".paint-edit-color-grid button"),
  ).toHaveLength(48);
  editColors
    .querySelectorAll<HTMLButtonElement>(".dlg-buttons button")[1]
    .click();

  menuButton("Image").click();
  paintWindow
    .querySelector<HTMLButtonElement>('[data-paint-command="attributes"]')!
    .click();
  const attributes = shell.document.querySelector<HTMLElement>(
    ".paint-attributes-dialog",
  )!;
  expect(
    attributes.querySelector<HTMLInputElement>('[name="width"]')!.value,
  ).toBe("516");
  attributes
    .querySelectorAll<HTMLButtonElement>(".dlg-buttons button")[1]
    .click();

  menuButton("Help").click();
  paintWindow
    .querySelector<HTMLButtonElement>('[data-paint-command="about"]')!
    .click();
  const aboutPaint = shell.document.querySelector<HTMLElement>(
    '.xp-about-dialog[aria-label="About Paint"]',
  )!;
  expect(aboutPaint).not.toBeNull();
  expect(aboutPaint.querySelector(".xp-about-banner")).not.toBeNull();
  aboutPaint.querySelector<HTMLButtonElement>(".dlg-buttons button")!.click();
  expect(
    shell.document.querySelector('.xp-about-dialog[aria-label="About Paint"]'),
  ).toBeNull();

  Object.assign(paintWindow.style, {
    width: "700px",
    height: "520px",
    left: "96px",
    top: "72px",
  });
  paintWindow.querySelector<HTMLButtonElement>(".close-btn")!.click();
  expect(shell.window.VirtualFS.open(picture.id)).toBeTrue();
  const reopenedPaint = shell.document.querySelector<HTMLElement>(
    '.xp-window[data-game="__paint"]',
  )!;
  expect(reopenedPaint.style.width).toBe("700px");
  expect(reopenedPaint.style.height).toBe("520px");
  expect(reopenedPaint.style.left).toBe("96px");
  expect(reopenedPaint.style.top).toBe("72px");
});

test("Volume Control changes the shell volume", async () => {
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

  const flyouts = openEntertainment();
  flyouts
    .querySelector<HTMLButtonElement>('[data-program-id="volume-control"]')!
    .click();
  const volume = shell.document.querySelector<HTMLInputElement>(
    '.xp-window[data-game="__volume-control"] input[type="range"]',
  )!;
  volume.value = "35";
  volume.dispatchEvent(new shell.window.Event("input", { bubbles: true }));
  expect(shell.window.localStorage.getItem("volume")).toBe("35");
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
