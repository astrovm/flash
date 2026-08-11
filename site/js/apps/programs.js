"use strict";

const openXPProgram = (programId) => {
  const existing = openWindows.get(programId);
  if (existing) {
    restoreWindow(programId);
    focusWindow(programId);
    return;
  }
  const program = XPApplicationRegistry.get(programId);
  const { width: desktopWidth, height: desktopHeight } = getDesktopSize();
  const el = createWindowElement(programId);
  el.classList.add("xp-native-program-window");
  if (program.kind === "paint") el.classList.add("xp-native-paint-window");
  el.querySelectorAll(".game-menu-bar, .game-menu").forEach((node) =>
    node.remove(),
  );
  const preferredSizes = {
    calculator: [260, 330],
    minesweeper: [184, 250],
    volume: [250, 360],
    recorder: [450, 190],
    media: [600, 420],
    disk: [430, 420],
    information: [700, 500],
    hyperterminal: [560, 420],
    mail: [720, 520],
    messenger: [500, 460],
    solitaire: [720, 520],
    freecell: [760, 540],
    paint: [640, 480],
  };
  const [preferredWidth, preferredHeight] =
    programId === "__minesweeper"
      ? preferredSizes.minesweeper
      : programId === "__solitaire"
        ? preferredSizes.solitaire
        : programId === "__freecell"
          ? preferredSizes.freecell
          : preferredSizes[program.kind] || [640, 470];
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
  el.style.left =
    program.kind === "paint"
      ? "0px"
      : `${Math.max(8, (desktopWidth - windowWidth) / 2)}px`;
  el.style.top =
    program.kind === "paint"
      ? "0px"
      : `${Math.max(8, (desktopHeight - windowHeight) / 2)}px`;
  const content = el.querySelector(".window-content");
  content.replaceWith(createXPProgramContent(programId));
  document.getElementById("desktop").appendChild(el);
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
  };
  openWindows.set(programId, win);
  wireSystemWindowControls(win);
  focusWindow(programId);
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

const browserFileFromVirtualFile = async (file, paintWindow) => {
  const response = await fetch(file.content);
  const blob = await response.blob();
  return new paintWindow.File([blob], file.name, { type: blob.type });
};

const installPaintFileHooks = (paintWindow) => {
  const child = paintWindow.el.querySelector(".xp-paint-frame").contentWindow;
  child.systemHooks.readBlobFromHandle = (fileId) =>
    browserFileFromVirtualFile(fs.getNode(fileId), child);
  child.systemHooks.writeBlobToHandle = async (fileId, blob) => {
    const file = fs.getNode(fileId);
    if (!file) return false;
    fs.setContent(file.id, await dataUrlFromBlob(blob));
    return true;
  };
  child.systemHooks.showOpenFileDialog = async ({ formats }) => {
    const extensions = new Set(
      formats.flatMap((format) => format.extensions).map((ext) => `.${ext}`),
    );
    const file = await XPDialogs.openFile({
      title: "Open",
      startFolder: fs.MY_PICTURES,
      filter: (node) => node.type === "folder" || extensions.has(node.ext),
    });
    if (!file) return {};
    return {
      file: await browserFileFromVirtualFile(file, child),
      fileHandle: file.id,
    };
  };
  child.systemHooks.showSaveFileDialog = async ({
    formats,
    defaultFileName,
    defaultFileFormatID,
    getBlob,
    savedCallbackUnreliable,
  }) => {
    const destination = await XPDialogs.saveFile({
      title: "Save As",
      startFolder: fs.MY_PICTURES,
      defaultName: defaultFileName,
    });
    if (!destination) return;
    const extension = destination.name.includes(".")
      ? destination.name.split(".").at(-1).toLowerCase()
      : "";
    const format =
      formats.find((candidate) => candidate.extensions.includes(extension)) ||
      formats.find((candidate) => candidate.formatID === defaultFileFormatID) ||
      formats[0];
    const fileName = extension
      ? destination.name
      : `${destination.name}.${format.extensions[0]}`;
    const blob = await getBlob(format.formatID);
    const content = await dataUrlFromBlob(blob);
    const file = destination.existingId
      ? fs.setContent(destination.existingId, content)
      : fs.createFile(destination.parentId, fileName, { content });
    savedCallbackUnreliable?.({
      newFileName: file.name,
      newFileFormatID: format.formatID,
      newFileHandle: file.id,
      newBlob: blob,
    });
  };
};

const openPaintFile = (file) => {
  openXPProgram("__paint");
  const paintWindow = openWindows.get("__paint");
  paintWindow.pendingFile = file;
  const child = paintWindow.el.querySelector(".xp-paint-frame").contentWindow;
  if (child?.open_from_file && child.systemHooks) {
    installPaintFileHooks(paintWindow);
    child.systemHooks
      .readBlobFromHandle(file.id)
      .then((browserFile) => child.open_from_file(browserFile, file.id));
    paintWindow.pendingFile = null;
  }
};

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return;
  const paintWindow = openWindows.get("__paint");
  const paintFrame = paintWindow?.el.querySelector(".xp-paint-frame");
  if (!paintFrame || event.source !== paintFrame.contentWindow) return;
  if (event.data?.type === "xp-paint-title") {
    paintWindow.title = event.data.title;
    paintWindow.el.querySelector(".title-text").textContent = event.data.title;
    renderTaskButtons();
  } else if (event.data?.type === "xp-paint-ready") {
    installPaintFileHooks(paintWindow);
    if (paintWindow.pendingFile) {
      const file = paintWindow.pendingFile;
      paintFrame.contentWindow.systemHooks
        .readBlobFromHandle(file.id)
        .then((browserFile) =>
          paintFrame.contentWindow.open_from_file(browserFile, file.id),
        );
      paintWindow.pendingFile = null;
    }
  } else if (event.data?.type === "xp-paint-close") {
    closeGameWindow("__paint");
  } else if (event.data?.type === "xp-paint-wallpaper") {
    const desktop = document.getElementById("desktop");
    desktop.style.backgroundImage = `url(${event.data.dataUrl})`;
    desktop.style.backgroundRepeat =
      event.data.mode === "tile" ? "repeat" : "no-repeat";
    desktop.style.backgroundPosition = "center";
    desktop.style.backgroundSize = "auto";
  }
});

for (const extension of [".bmp", ".dib", ".gif", ".jpg", ".jpeg", ".png"])
  fs.registerFileType(extension, openPaintFile);

const openSystemWindow = (shortcutId) => {
  const existing = openWindows.get(shortcutId);
  if (existing) {
    restoreWindow(shortcutId);
    focusWindow(shortcutId);
    return;
  }

  const { width: desktopWidth, height: desktopHeight } = getDesktopSize();
  const el = createWindowElement(shortcutId);
  el.classList.add("explorer-window");
  el.querySelectorAll(".game-menu-bar, .game-menu").forEach((node) =>
    node.remove(),
  );
  const isProjectSettings = shortcutId === "__astro-settings";
  const isInternetGames = shortcutId === "__internet-games";
  const isDisplayProperties = shortcutId === "__display-properties";
  const isControlPanel = shortcutId === "__control-panel";
  const isUserAccounts = shortcutId === "__user-accounts";
  const isAddRemovePrograms = shortcutId === "__add-remove-programs";
  const isSecurityCenter = shortcutId === "__security-center";
  const isSearch = shortcutId === "__search";
  const isPrinters = shortcutId === "__printers";
  const isHelp = shortcutId === "__help";
  if (isDisplayProperties) el.classList.add("display-properties-window");
  if (isUserAccounts) el.classList.add("user-accounts-window");
  if (isAddRemovePrograms) el.classList.add("add-remove-programs-window");
  const windowWidth = Math.min(
    isProjectSettings
      ? 540
      : isInternetGames
        ? 760
        : isControlPanel
          ? 800
          : isUserAccounts
            ? 729
            : isAddRemovePrograms
              ? 729
              : isSecurityCenter
                ? 748
                : isHelp
                  ? 768
                  : isDisplayProperties
                    ? 404
                    : 800,
    desktopWidth - 16,
  );
  const windowHeight = Math.min(
    isProjectSettings
      ? 420
      : isInternetGames
        ? 540
        : isControlPanel
          ? 600
          : isUserAccounts
            ? 530
            : isAddRemovePrograms
              ? 530
              : isSecurityCenter
                ? 600
                : isHelp
                  ? 650
                  : isDisplayProperties
                    ? 454
                    : 600,
    desktopHeight - 16,
  );
  el.style.width = `${windowWidth}px`;
  el.style.height = `${windowHeight}px`;
  el.style.left = `${
    isControlPanel
      ? Math.min(44, Math.max(8, desktopWidth - windowWidth))
      : isUserAccounts
        ? Math.min(147, Math.max(8, desktopWidth - windowWidth))
        : isAddRemovePrograms
          ? Math.min(147, Math.max(8, desktopWidth - windowWidth))
          : isSecurityCenter
            ? Math.min(138, Math.max(8, desktopWidth - windowWidth))
            : isPrinters
              ? Math.min(22, Math.max(8, desktopWidth - windowWidth))
              : isHelp
                ? Math.min(66, Math.max(8, desktopWidth - windowWidth))
                : isSearch
                  ? Math.min(66, Math.max(8, desktopWidth - windowWidth))
                  : isDisplayProperties
                    ? Math.min(22, Math.max(8, desktopWidth - windowWidth))
                    : Math.max(8, (desktopWidth - windowWidth) / 2)
  }px`;
  el.style.top = `${
    isControlPanel
      ? Math.min(58, Math.max(8, desktopHeight - windowHeight))
      : isUserAccounts
        ? Math.min(52, Math.max(8, desktopHeight - windowHeight))
        : isAddRemovePrograms
          ? Math.min(104, Math.max(8, desktopHeight - windowHeight))
          : isSecurityCenter
            ? Math.min(70, Math.max(8, desktopHeight - windowHeight))
            : isPrinters
              ? Math.min(29, Math.max(8, desktopHeight - windowHeight))
              : isHelp
                ? Math.min(45, Math.max(8, desktopHeight - windowHeight))
                : isSearch
                  ? Math.min(88, Math.max(8, desktopHeight - windowHeight))
                  : isDisplayProperties
                    ? Math.min(30, Math.max(8, desktopHeight - windowHeight))
                    : Math.max(8, (desktopHeight - windowHeight) / 2)
  }px`;
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
  };
  openWindows.set(shortcutId, win);
  const content = el.querySelector(".window-content");
  content.replaceWith(createSystemWindowContent(shortcutId, win));
  if (win.currentFolderId) renderExplorerItems(win);
  wireSystemWindowControls(win);
  if (isDisplayProperties) {
    const helpBtn = document.createElement("button");
    helpBtn.type = "button";
    helpBtn.className = "tb-btn help-btn";
    helpBtn.title = "Help";
    helpBtn.setAttribute("aria-label", "Help");
    el.querySelector(".title-buttons").prepend(helpBtn);
    el.querySelector(".minimize-btn").remove();
    el.querySelector(".maximize-btn").remove();
  }
  if (shortcutId === "__display-properties") wireDisplayProperties(win);
  if (shortcutId === "__astro-settings") wireProjectSettings(win);
  if (shortcutId === "__search") wireSearchCompanion(win);
  if (shortcutId === "__internet-games") wireInternetGames(win);
  if (shortcutId === "__control-panel") wireControlPanel(win);
  if (shortcutId === "__printers") wirePrintersAndFaxes(win);
  if (shortcutId === "__help") wireHelpAndSupport(win);
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
