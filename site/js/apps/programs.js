"use strict";

const wireSystemWindowControls = (win) => {
  win.el.addEventListener("pointerdown", () => focusWindow(win.gameId));
  win.el
    .querySelector(".close-btn")
    .addEventListener("click", () => closeGameWindow(win.gameId));
  win.el
    .querySelector(".minimize-btn")
    .addEventListener("click", () => minimizeWindow(win.gameId));
  win.el
    .querySelector(".maximize-btn")
    .addEventListener("click", () => toggleMaximize(win.gameId));
  updateMaximizeButton(win);
  wireDrag(win);
  wireResize(win);
};

const applicationContext = (win) => ({
  XP_ICON_PATHS,
  dialogs: XPDialogs,
  fileOps,
  fs,
  getDesktopSize,
  getMasterVolume,
  setMasterVolume,
  setTitle(title) {
    win.title = title;
    if (systemShortcuts[win.gameId]) systemShortcuts[win.gameId].title = title;
    win.el.querySelector(".title-text").textContent = title;
    renderTaskButtons();
    updateDocumentTitle();
  },
  setAccessKeyText,
  close: () => closeGameWindow(win.gameId),
  openFile: (options) => XPDialogs.openFile(options),
  saveFile: (options) => XPDialogs.saveFile(options),
  myPictures: fs.MY_PICTURES,
  dataUrlFromBlob,
  setFileContent: (id, content) => fs.setContent(id, content),
  createFile: (parentId, name, content) =>
    fs.createFile(parentId, name, { content }),
  setWallpaper(dataUrl) {
    const desktop = document.getElementById("desktop");
    desktop.style.setProperty("--desktop-background", `url("${dataUrl}")`);
    desktop.dataset.wallpaperPosition = "center";
  },
  showMessage: (title, text) => XPDialogs.alert(text, title, "info"),
});

const openXPProgram = (programId, options = {}) => {
  const existing = openWindows.get(programId);
  if (existing) {
    restoreWindow(programId);
    focusWindow(programId);
    return options.file
      ? existing.mountedApplication?.openFile?.(options.file)
      : existing;
  }
  const program = window.XPApplicationRegistry.get(programId);
  const { width: desktopWidth, height: desktopHeight } = getDesktopSize();
  const el = createWindowElement(programId);
  el.classList.add("xp-native-program-window");
  if (program.window.className) el.classList.add(program.window.className);
  el.querySelectorAll(".game-menu-bar, .game-menu").forEach((node) =>
    node.remove(),
  );
  const preferredWidth = program.window.width;
  const preferredHeight = program.window.height;
  if (programId === "__minesweeper") {
    el.style.minWidth = `${preferredWidth}px`;
    el.style.minHeight = `${preferredHeight}px`;
  }
  const windowWidth =
    desktopWidth > 16
      ? Math.min(preferredWidth, desktopWidth - 16)
      : preferredWidth;
  const windowHeight =
    desktopHeight > 16
      ? Math.min(preferredHeight, desktopHeight - 16)
      : preferredHeight;
  el.style.width = `${windowWidth}px`;
  el.style.height = `${windowHeight}px`;
  el.style.left = `${program.window.left ?? Math.max(8, (desktopWidth - windowWidth) / 2)}px`;
  el.style.top = `${program.window.top ?? Math.max(8, (desktopHeight - windowHeight) / 2)}px`;
  const win = {
    gameId: programId,
    el,
    type: "system",
    player: null,
    minimized: false,
    maximized: false,
    prevRect: null,
    zIndex: 0,
    lastUsed: Date.now(),
    maximizeBtn: el.querySelector(".maximize-btn"),
    favoriteBtn: null,
    volumeBtn: null,
    application: program,
  };
  const mounted = program.mount(applicationContext(win), {
    application: program,
    file: options.file || null,
    window: win,
  });
  win.mountedApplication = mounted;
  win.beforeClose = mounted.beforeClose;
  el.querySelector(".window-content").replaceWith(mounted.element);
  document.getElementById("desktop").appendChild(el);
  openWindows.set(programId, win);
  wireSystemWindowControls(win);
  focusWindow(programId);
  return win;
};

const dataUrlFromBlob = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result), {
      once: true,
    });
    reader.addEventListener("error", () => reject(reader.error), {
      once: true,
    });
    reader.readAsDataURL(blob);
  });

const openNotepad = (file = null) => openXPProgram("__notepad", { file });

window.AstroApplicationHost = Object.freeze({
  installFileAssociations(registry) {
    registry.values().forEach((application) => {
      application.fileTypes?.forEach((extension) => {
        fs.registerFileType(extension, (file) =>
          openXPProgram(application.id, { file }),
        );
      });
    });
  },
});

const systemApplicationContext = () => ({
  XPDialogs,
  XP_ICON_PATHS,
  closeGameWindow,
  confirmEmptyRecycleBin,
  confirmRecycleDelete,
  explorerBack,
  explorerForward,
  fileOps,
  fs,
  navigateExplorer,
  openAboutWindows,
  openAccessibilityOptions,
  openControlPanel,
  openDateTimeProperties,
  openFolderOptions,
  openGameControllers,
  openHelpAndSupport,
  openInternetProperties,
  openKeyboardProperties,
  openMouseProperties,
  openNetworkStatus,
  openPowerOptions,
  openPrintersAndFaxes,
  openProjectSettings,
  openRegionalLanguageOptions,
  openSearchDialog,
  openShellProperties,
  openSoundsAudioProperties,
  openSystemProperties,
  openSystemWindow,
  openTaskbarProperties,
  openWindows,
  pasteIntoFolder,
  renderExplorerItems,
  renderExplorerTree,
  renderTaskButtons,
  selectedExplorerNodes,
  setAccessKeyText,
  toggleTrayVolumePopup,
  wireDisplayProperties,
  wireHelpAndSupport,
  wireSearchCompanion,
  wireInternetGames,
  wirePrintersAndFaxes,
  wireProjectSettings,
});

const openSystemWindow = (shortcutId) => {
  const existing = openWindows.get(shortcutId);
  if (existing) {
    restoreWindow(shortcutId);
    focusWindow(shortcutId);
    return;
  }

  const application = window.XPApplicationRegistry.get(shortcutId);
  if (!application || application.kind !== "system") return;
  const { width: desktopWidth, height: desktopHeight } = getDesktopSize();
  const el = createWindowElement(shortcutId);
  el.classList.add("explorer-window");
  if (application.window.className)
    el.classList.add(application.window.className);
  el.querySelectorAll(".game-menu-bar, .game-menu").forEach((node) =>
    node.remove(),
  );
  const windowWidth = Math.min(application.window.width, desktopWidth - 16);
  const windowHeight = Math.min(application.window.height, desktopHeight - 16);
  el.style.width = `${windowWidth}px`;
  el.style.height = `${windowHeight}px`;
  const defaultLeft = Math.max(8, (desktopWidth - windowWidth) / 2);
  const defaultTop = Math.max(8, (desktopHeight - windowHeight) / 2);
  el.style.left = `${Math.min(
    application.window.left ?? defaultLeft,
    Math.max(8, desktopWidth - windowWidth),
  )}px`;
  el.style.top = `${Math.min(
    application.window.top ?? defaultTop,
    Math.max(8, desktopHeight - windowHeight),
  )}px`;
  document.getElementById("desktop").appendChild(el);

  const win = {
    gameId: shortcutId,
    el,
    type: "system",
    player: null,
    minimized: false,
    maximized: false,
    prevRect: null,
    zIndex: 0,
    lastUsed: Date.now(),
    currentFolderId: systemFolderShortcuts[shortcutId]
      ? systemFolderShortcuts[shortcutId]()
      : null,
    history: systemFolderShortcuts[shortcutId]
      ? [systemFolderShortcuts[shortcutId]()]
      : [],
    historyIndex: 0,
    explorerView: "tiles",
    maximizeBtn: el.querySelector(".maximize-btn"),
    favoriteBtn: null,
    volumeBtn: null,
    application,
  };
  openWindows.set(shortcutId, win);
  const context = systemApplicationContext(win);
  const mounted = application.mount(context, {
    application,
    window: win,
  });
  win.mountedApplication = mounted;
  el.querySelector(".window-content").replaceWith(mounted.element);
  if (win.currentFolderId) renderExplorerItems(win);
  wireSystemWindowControls(win);
  if (application.window.dialogControls) {
    const helpBtn = document.createElement("button");
    helpBtn.type = "button";
    helpBtn.className = "tb-btn help-btn";
    helpBtn.title = "Help";
    helpBtn.setAttribute("aria-label", "Help");
    el.querySelector(".title-buttons").prepend(helpBtn);
    el.querySelector(".minimize-btn").remove();
    el.querySelector(".maximize-btn").remove();
  }
  application.activate?.(context, { application, window: win }, mounted);
  focusWindow(shortcutId);
};

const openDesktopItem = (itemId) => {
  const node = fs.getNode(itemId);
  if (node) {
    try {
      fs.open(itemId);
    } catch (error) {
      console.error(error);
    }
  } else if (itemId === "__astro-settings") {
    openProjectSettings();
  } else if (systemShortcuts[itemId]) {
    openSystemWindow(itemId);
  } else {
    openGameWindow(itemId);
  }
};

const openGameWindow = (gameId) => {
  if (!gamesList[gameId]) return;

  const existing = openWindows.get(gameId);
  if (existing) {
    restoreWindow(gameId);
    focusWindow(gameId);
    return;
  }

  const game = gamesList[gameId];
  const aspectRatio = game.aspectRatio || DEFAULT_ASPECT_RATIO;
  const { width: desktopWidth, height: desktopHeight } = getDesktopSize();
  const availableWidth = Math.max(desktopWidth - 8, 0);
  const availableHeight = Math.max(desktopHeight - 8, 0);
  const minWidth = Math.min(MIN_WINDOW_WIDTH, availableWidth);
  const minHeight = Math.min(MIN_WINDOW_HEIGHT, availableHeight);

  let winWidth = Math.min(720, availableWidth * 0.92);
  let winHeight = winWidth / aspectRatio + WINDOW_CHROME_HEIGHT;
  const maxHeight = availableHeight * 0.92;
  if (winHeight > maxHeight) {
    winHeight = maxHeight;
    winWidth = (winHeight - WINDOW_CHROME_HEIGHT) * aspectRatio;
  }
  winWidth = Math.min(Math.max(winWidth, minWidth), availableWidth);
  winHeight = Math.min(Math.max(winHeight, minHeight), availableHeight);

  const offset = (cascadeCount++ % 6) * 28;
  const left = Math.max(
    4,
    Math.min(
      (desktopWidth - winWidth) / 2 + offset - 56,
      desktopWidth - winWidth - 4,
    ),
  );
  const top = Math.max(
    4,
    Math.min(
      (desktopHeight - winHeight) / 2 + offset - 40,
      desktopHeight - winHeight - 4,
    ),
  );

  const el = createWindowElement(gameId);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.style.width = `${winWidth}px`;
  el.style.height = `${winHeight}px`;
  document.getElementById("desktop").appendChild(el);
  el.animate(
    [
      { transform: "scale(0.94)", opacity: 0.35 },
      { transform: "scale(1)", opacity: 1 },
    ],
    { duration: 145, easing: "ease-out" },
  );

  const win = {
    gameId,
    el,
    type: game.type,
    player: null,
    minimized: false,
    maximized: false,
    prevRect: null,
    zIndex: 0,
    lastUsed: Date.now(),
    content: el.querySelector(".window-content"),
    maximizeBtn: el.querySelector(".maximize-btn"),
    favoriteBtn: el.querySelector(".favorite-btn"),
    favoriteMenuItem: el.querySelector('[data-game-action="favorite"]'),
    volumeBtn: el.querySelector(".volume-btn"),
    volumeMenuItem: el.querySelector('[data-game-action="mute"]'),
    volumeSlider: el.querySelector(".volume-slider"),
  };
  openWindows.set(gameId, win);
  trackGamePlay(gameId);

  switch (game.type) {
    case "swf":
      loadRuffleSWF(gameId, win);
      break;
    case "iframe":
      loadIframe(gameId, win);
      break;
  }

  saveBundledGameForOffline(gameId);

  wireWindowControls(win);
  focusWindow(gameId);

  if (window.location.hash !== `#${gameId}`) {
    window.location.hash = gameId;
  }
};
