"use strict";

const wireSystemWindowControls = (win) => {
  win.el.addEventListener("pointerdown", () => focusWindow(win.gameId));
  win.el
    .querySelector(".close-btn")
    .addEventListener("click", () => closeGameWindow(win.gameId));
  win.el
    .querySelector(".minimize-btn")
    .addEventListener("click", () => minimizeWindow(win.gameId));
  const maximize = win.el.querySelector(".maximize-btn");
  if (maximize) {
    maximize.addEventListener("click", () => toggleMaximize(win.gameId));
    updateMaximizeButton(win);
  }
  wireDrag(win);
  if (win.application?.window.resizable !== false) wireResize(win);
};

const focusNativeOwnedWindow = (owner, dialog) => {
  focusWindow(owner.gameId, { notifyApplication: false });
  owner.el.classList.remove("active");
  dialog.el.classList.add("active");
  dialog.el.style.zIndex = String(++zIndexCounter);
  dialog.canvas.focus({ preventScroll: true });
  dialog.focus?.();
};

const wireNativeOwnedWindowDrag = (owner, dialog) => {
  const bar = dialog.el.querySelector(".title-bar");
  bar.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest(".title-buttons")) return;
    focusNativeOwnedWindow(owner, dialog);
    const start = {
      x: event.clientX,
      y: event.clientY,
      left: dialog.el.offsetLeft,
      top: dialog.el.offsetTop,
    };
    const move = (moveEvent) => {
      const position = clampWindowPosition(
        { el: dialog.el },
        start.left + moveEvent.clientX - start.x,
        start.top + moveEvent.clientY - start.y,
      );
      dialog.el.style.left = `${position.left}px`;
      dialog.el.style.top = `${position.top}px`;
      dialog.moved = true;
    };
    const stop = () => {
      bar.removeEventListener("pointermove", move);
      bar.removeEventListener("pointerup", stop);
      bar.removeEventListener("pointercancel", stop);
    };
    try {
      bar.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is not available in older browsers.
    }
    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", stop);
    bar.addEventListener("pointercancel", stop);
    event.preventDefault();
  });
};

const removeNativeOwnedWindow = (owner, id) => {
  const dialog = owner.nativeOwnedWindows?.get(id);
  if (!dialog) return false;
  dialog.el.remove();
  owner.nativeOwnedWindows.delete(id);
  if (owner.nativeOwnedWindows.size === 0) {
    owner.el.removeAttribute("aria-disabled");
    owner.el.classList.remove("native-owned-window-blocked");
    owner.el.removeEventListener(
      "pointerdown",
      owner.nativeDialogBlocker,
      true,
    );
    owner.el.removeEventListener("click", owner.nativeDialogBlocker, true);
    owner.nativeDialogBlocker = null;
    focusWindow(owner.gameId, { notifyApplication: false });
  }
  return true;
};

const clearNativeOwnedWindows = (owner) => {
  for (const id of [...(owner.nativeOwnedWindows?.keys() || [])])
    removeNativeOwnedWindow(owner, id);
};

const upsertNativeOwnedWindow = (owner, detail) => {
  owner.nativeOwnedWindows ||= new Map();
  let dialog = owner.nativeOwnedWindows.get(detail.id);
  const created = !dialog;
  if (!dialog) {
    const el = createWindowElement(owner.gameId);
    el.dataset.game = `${owner.gameId}:native:${detail.id}`;
    el.dataset.nativeWindowId = String(detail.id);
    el.classList.add(
      "xp-native-program-window",
      "xp-boxedwine-shared-window",
      "xp-boxedwine-owned-window",
    );
    el.querySelectorAll(".game-menu-bar, .game-menu, .resize-handle").forEach(
      (node) => node.remove(),
    );
    el.querySelector(".minimize-btn")?.remove();
    el.querySelector(".maximize-btn")?.remove();
    const content = el.querySelector(".window-content");
    content.className = "window-content boxedwine-shared-app-host";
    content.replaceChildren(detail.canvas);
    dialog = {
      canvas: detail.canvas,
      close: detail.close,
      el,
      focus: detail.focus,
      moved: false,
    };
    owner.nativeOwnedWindows.set(detail.id, dialog);
    el.querySelector(".close-btn").addEventListener("click", () =>
      dialog.close?.(),
    );
    el.addEventListener("pointerdown", () =>
      focusNativeOwnedWindow(owner, dialog),
    );
    wireNativeOwnedWindowDrag(owner, dialog);
    document.getElementById("desktop").appendChild(el);
    if (!owner.nativeDialogBlocker) {
      owner.nativeDialogBlocker = (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const topDialog = [...owner.nativeOwnedWindows.values()].at(-1);
        if (topDialog) focusNativeOwnedWindow(owner, topDialog);
      };
      owner.el.addEventListener("pointerdown", owner.nativeDialogBlocker, true);
      owner.el.addEventListener("click", owner.nativeDialogBlocker, true);
    }
    owner.el.classList.add("native-owned-window-blocked");
    owner.el.setAttribute("aria-disabled", "true");
  } else if (dialog.canvas !== detail.canvas) {
    dialog.canvas = detail.canvas;
    dialog.el
      .querySelector(".boxedwine-shared-app-host")
      .replaceChildren(detail.canvas);
  }
  dialog.close = detail.close;
  dialog.focus = detail.focus;
  dialog.el.querySelector(".title-text").textContent = detail.title;
  const dialogWidth = Number(detail.clientWidth) || Number(detail.width);
  const dialogHeight = Number(detail.clientHeight) || Number(detail.height);
  const dialogCaption = parseWindowLength(
    dialog.el.ownerDocument.defaultView
      ?.getComputedStyle?.(dialog.el)
      ?.getPropertyValue("--boxedwine-shell-caption-height"),
    28,
  );
  dialog.el.style.width = `${dialogWidth}px`;
  dialog.el.style.height = `${dialogHeight + dialogCaption}px`;
  if (!dialog.moved) {
    const position = clampWindowPosition(
      { el: dialog.el },
      owner.el.offsetLeft + detail.x,
      owner.el.offsetTop + detail.y,
    );
    dialog.el.style.left = `${position.left}px`;
    dialog.el.style.top = `${position.top}px`;
  }
  if (created) focusNativeOwnedWindow(owner, dialog);
};

const applicationContext = (win) => ({
  windowElement: win.el,
  nativeWindowReady: false,
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
  getMasterVolume,
  setMasterVolume,
  setSize(width, height) {
    win.el.style.width = `${width}px`;
    win.el.style.height = `${height}px`;
  },
  setTitle(title) {
    win.title = title;
    if (systemShortcuts[win.gameId]) systemShortcuts[win.gameId].title = title;
    const titleText = win.el.querySelector(".title-text");
    if (titleText) titleText.textContent = title;
    renderTaskButtons();
    updateDocumentTitle();
  },
  setAccessKeyText,
  close: () => closeGameWindow(win.gameId),
  minimize: () => minimizeWindow(win.gameId),
  applyNativeSize(width, height) {
    win.el.style.width = `${width}px`;
    win.el.style.height = `${height}px`;
    fitNativeProgramToWorkArea(win);
  },
  applyNativeClientSize(width, height) {
    if (win.maximized) return;
    const host = win.el.querySelector(".boxedwine-shared-app-host");
    if (!host) return;
    const frameWidth = Math.max(0, win.el.offsetWidth - host.clientWidth);
    const measuredFrameHeight = Math.max(
      0,
      win.el.offsetHeight - host.clientHeight,
    );
    const caption = parseWindowLength(
      win.el.ownerDocument.defaultView
        ?.getComputedStyle?.(win.el)
        ?.getPropertyValue("--boxedwine-shell-caption-height"),
      28,
    );
    win.el.style.width = `${width + frameWidth}px`;
    win.el.style.height = `${height + (measuredFrameHeight || caption)}px`;
    fitNativeProgramToWorkArea(win);
  },
  applyNativeWindowMetadata(metadata) {
    if (win.maximized) return;
    const canResize = metadata.canResize !== false;
    const canMaximize = metadata.canMaximize !== false;
    const canMinimize = metadata.canMinimize !== false;
    win.el.querySelectorAll(".resize-handle").forEach((handle) => {
      handle.hidden = !canResize;
    });
    const maximize = win.el.querySelector(".maximize-btn");
    if (maximize) {
      maximize.disabled = !canMaximize;
      maximize.setAttribute("aria-disabled", String(!canMaximize));
    }
    const minimize = win.el.querySelector(".minimize-btn");
    if (minimize) {
      minimize.disabled = !canMinimize;
      minimize.setAttribute("aria-disabled", String(!canMinimize));
    }

    const frameLeft = Math.max(0, Number(metadata.frameLeft) || 0);
    const frameTop = Math.max(0, Number(metadata.frameTop) || 0);
    const frameRight = Math.max(0, Number(metadata.frameRight) || 0);
    const frameBottom = Math.max(0, Number(metadata.frameBottom) || 0);
    const outerWidth = Number(metadata.outerWidth) || Number(metadata.width);
    const outerHeight = Number(metadata.outerHeight) || Number(metadata.height);
    const width =
      Number(metadata.clientWidth) ||
      (outerWidth > 0 ? outerWidth - frameLeft - frameRight : 0);
    const height =
      Number(metadata.clientHeight) ||
      (outerHeight > 0 ? outerHeight - frameTop - frameBottom : 0);
    if (width <= 0 || height <= 0) return;
    const saved = getWindowPlacements()[win.gameId];
    if (saved && !win.nativeMetadataApplied) {
      restoreWindowPlacement(win);
    } else if (!saved) {
      if (!win.nativeMetadataApplied) win.workAreaFitRect = null;
      this.applyNativeClientSize(width, height);
      if (!win.nativeMetadataApplied) {
        const workArea = getVisibleWorkArea();
        const offset = (cascadeCount++ % 6) * 28;
        win.el.style.left = `${Math.max(0, (workArea.width - win.el.offsetWidth) / 2 + offset - 56)}px`;
        win.el.style.top = `${Math.max(0, (workArea.height - win.el.offsetHeight) / 2 + offset - 40)}px`;
      }
      const position = clampWindowPosition(
        win,
        win.el.offsetLeft,
        win.el.offsetTop,
      );
      win.el.style.left = `${position.left}px`;
      win.el.style.top = `${position.top}px`;
    }
    win.nativeMetadataApplied = true;
    this.nativeWindowReady = true;
  },
  applyNativeClose: () => {
    clearNativeOwnedWindows(win);
    closeGameWindow(win.gameId, {
      skipBeforeClose: true,
      skipUnmount: true,
    });
  },
  applyNativeFocus: () => focusWindow(win.gameId, { notifyApplication: false }),
  applyNativeMinimize: () =>
    minimizeWindow(win.gameId, { notifyApplication: false }),
  applyNativeRestore: () => {
    if (win.minimized) restoreWindow(win.gameId, { notifyApplication: false });
  },
  upsertNativeOwnedWindow: (detail) => upsertNativeOwnedWindow(win, detail),
  removeNativeOwnedWindow: (id) => removeNativeOwnedWindow(win, id),
  clearNativeOwnedWindows: () => clearNativeOwnedWindows(win),
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
  const program = window.XPApplicationRegistry.get(programId);
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
  const usesNativeDefaults =
    program.window.fitToWorkArea || program.window.nativeMetadata;
  const windowWidth = usesNativeDefaults
    ? preferredWidth
    : desktopWidth > 16
      ? Math.min(preferredWidth, desktopWidth - 16)
      : preferredWidth;
  const windowHeight = usesNativeDefaults
    ? preferredHeight
    : desktopHeight > 16
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
  fitNativeProgramToWorkArea(win);
  if (program.window.maximizable === false) {
    const maximize = el.querySelector(".maximize-btn");
    if (maximize) {
      maximize.disabled = true;
      maximize.setAttribute("aria-disabled", "true");
    }
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
