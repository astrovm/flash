"use strict";

const wireSystemWindowControls = (win) => {
  win.el.addEventListener("pointerdown", () => focusWindow(win.gameId));
  win.el
    .querySelector(".close-btn")
    .addEventListener("click", () => closeGameWindow(win.gameId));
  win.el
    .querySelector(".minimize-btn")
    .addEventListener("click", () =>
      minimizeWindow(win.gameId, { animate: true }),
    );
  win.el
    .querySelector(".maximize-btn")
    .addEventListener("click", () =>
      toggleMaximize(win.gameId, { animate: true }),
    );
  updateMaximizeButton(win);
  wireDrag(win);
  if (win.application?.window.resizable !== false) wireResize(win);
};

const applicationContext = (win) => ({
  windowElement: win.el,
  XP_ICON_PATHS,
  dialogs: XPDialogs,
  fileOps,
  fs,
  launchApplication(applicationId, options = {}) {
    const application = window.XPApplicationRegistry.get(applicationId);
    if (!application) return false;
    if (application.kind === "system") openSystemWindow(applicationId);
    else openXPProgram(applicationId, options);
    return true;
  },
  getDesktopSize,
  getSystemVolume,
  setSystemVolume,
  getMixer,
  setMixer,
  openAboutWindows,
  setSize(width, height) {
    win.el.style.width = `${width}px`;
    win.el.style.height = `${height}px`;
  },
  setTitle(title) {
    win.title = title;
    systemShortcuts[win.gameId].title = title;
    win.el.querySelector(".title-text").textContent = title;
    renderTaskButtons();
    updateDocumentTitle();
  },
  setAccessKeyText,
  close: () => closeGameWindow(win.gameId),
  minimize: () => minimizeWindow(win.gameId),
  openFile: (options) => XPDialogs.openFile(options),
  saveFile: (options) => XPDialogs.saveFile(options),
  myPictures: fs.MY_PICTURES,
  setFileContent: (id, content, options) => fs.setContent(id, content, options),
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
  let program = window.XPApplicationRegistry.get(programId);
  if (program.load) {
    if (!program.loaded) {
      const launchSession = sessionGeneration;
      return program
        .load()
        .then(() =>
          loggedIn && launchSession === sessionGeneration
            ? openXPProgram(programId, options)
            : null,
        )
        .catch((error) => {
          if (!loggedIn || launchSession !== sessionGeneration) return null;
          void XPDialogs.alert(
            error.message ||
              "The application could not be loaded. Try opening it again.",
            program.title,
            "error",
          );
          return null;
        });
    }
    program = program.loaded;
  }
  const activateNativeGame = () => {
    if (program.kind !== "native-game") return;
    if (program.offlineGameId) {
      saveBundledGameForOffline(program.offlineGameId);
    }
  };
  const existing = openWindows.get(programId);
  if (existing) {
    restoreWindow(programId);
    focusWindow(programId);
    activateNativeGame();
    return options.file
      ? existing.mountedApplication?.openFile?.(options.file)
      : existing;
  }
  const { width: desktopWidth, height: desktopHeight } = getDesktopSize();
  const el = createWindowElement(programId);
  el.classList.add("xp-native-program-window");
  if (program.window.className) el.classList.add(program.window.className);
  el.querySelectorAll(".game-menu-bar, .game-menu").forEach((node) =>
    node.remove(),
  );
  const preferredWidth = program.window.width;
  const preferredHeight = program.window.height;
  if (program.window.resizable === false) {
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
  // Whole pixels keep pixel art sharp in odd-sized windows.
  el.style.left = `${program.window.left ?? Math.max(8, Math.floor((desktopWidth - windowWidth) / 2))}px`;
  el.style.top = `${program.window.top ?? Math.max(8, Math.floor((desktopHeight - windowHeight) / 2))}px`;
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
  if (program.window.maximizable === false) {
    const maximize = el.querySelector(".maximize-btn");
    maximize.disabled = true;
    maximize.setAttribute("aria-disabled", "true");
  }
  if (program.window.resizable === false) {
    el.querySelectorAll(".resize-handle").forEach((handle) => handle.remove());
  }
  if (program.window.customChrome) {
    win.el.addEventListener("pointerdown", () => focusWindow(win.gameId));
    wireDrag(win);
  } else {
    wireSystemWindowControls(win);
  }
  focusWindow(programId);
  // Some XP programs, like Spider Solitaire, open maximized.
  if (program.window.startMaximized) toggleMaximize(programId);
  activateNativeGame();
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
  addTrayIcon,
  arrangeTaskbarWindows,
  closeGameWindow,
  createGameIconElement,
  focusWindow,
  gamesList,
  logOff,
  minimizeWindow,
  openRunDialog,
  restart,
  restoreWindow,
  setSuspended,
  setWindowTopmost,
  switchUser,
  toggleMaximize,
  turnOff,
  confirmEmptyRecycleBin,
  confirmRecycleDelete,
  explorerBack,
  explorerForward,
  fileOps,
  fs,
  navigateExplorer,
  openAboutWindows,
  openControlPanel,
  openDateTimeProperties,

  openProjectSettings,

  openSearchDialog,
  openShellProperties,
  openSystemWindow,
  openTaskbarProperties,
  openWindows,
  pasteIntoFolder,
  renderExplorerItems,
  renderExplorerTree,
  renderTaskButtons,
  resolveShellCommand,
  selectedExplorerNodes,
  renderExplorerSelection,
  startExplorerRename,
  setAccessKeyText,
  wireDisplayProperties,
  wireSearchCompanion,
  wireInternetGames,
  wireProjectSettings,
});

const openSystemWindow = (shortcutId) => {
  const existing = openWindows.get(shortcutId);
  if (existing) {
    restoreWindow(shortcutId);
    focusWindow(shortcutId);
    return;
  }

  const registered = window.XPApplicationRegistry.get(shortcutId);
  if (!registered || registered.kind !== "system") return;
  if (registered.load && !registered.loaded) {
    const launchSession = sessionGeneration;
    return registered
      .load()
      .then(() => {
        if (loggedIn && launchSession === sessionGeneration)
          openSystemWindow(shortcutId);
      })
      .catch((error) => {
        if (!loggedIn || launchSession !== sessionGeneration) return;
        void XPDialogs.alert(
          error.message ||
            "The window could not be loaded. Try opening it again.",
          registered.title,
          "error",
        );
      });
  }
  const application = registered.loaded || registered;
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
    el.classList.add("dialog-frame");
    el.querySelector(".minimize-btn").remove();
    el.querySelector(".maximize-btn").remove();
    XPDialogs.addWhatsThisHelp(el, mounted.element);
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

// Callers only open games listed in gamesList.
const openGameWindow = (gameId) => {
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
  // Focusing the window also links it in the address hash.
  focusWindow(gameId);
};
