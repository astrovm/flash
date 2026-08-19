"use strict";

// ============================================
// Window Manager
// ============================================

const openWindows = new Map();
let focusedGameId = null;
let zIndexCounter = 100;
let cascadeCount = 0;

const getDesktopSize = () => {
  const desktop = document.getElementById("desktop");
  return { width: desktop.clientWidth, height: desktop.clientHeight };
};

const XP_TASKBAR_HEIGHT = 30;
const sameWorkAreaBand = (left, right) => Math.abs(left - right) <= 1;

const getVisibleWorkArea = () => {
  let { width: desktopWidth, height: desktopHeight } = getDesktopSize();
  const viewportWidth =
    Number(window.visualViewport?.width) || Number(window.innerWidth) || 0;
  const viewportHeight =
    Number(window.visualViewport?.height) || Number(window.innerHeight) || 0;
  if (desktopWidth <= 0) desktopWidth = viewportWidth;
  if (desktopHeight <= 0) desktopHeight = viewportHeight;
  const measuredTaskbar = Number(
    document.getElementById("taskbar")?.getBoundingClientRect().height,
  );
  const taskbarHeight =
    measuredTaskbar > 0 && measuredTaskbar <= XP_TASKBAR_HEIGHT + 8
      ? measuredTaskbar
      : 0;
  let width = desktopWidth;
  let height = desktopHeight;
  const alignedWidth =
    viewportWidth > 0 && sameWorkAreaBand(desktopWidth, viewportWidth);
  const alignedHeight =
    viewportHeight > 0 && sameWorkAreaBand(desktopHeight, viewportHeight);
  if (alignedWidth && alignedHeight) {
    height = Math.max(0, height - (taskbarHeight || XP_TASKBAR_HEIGHT));
  } else if (
    alignedWidth &&
    viewportHeight > 0 &&
    viewportHeight < desktopHeight
  ) {
    height = Math.max(0, Math.floor(viewportHeight - taskbarHeight));
  } else if (
    alignedHeight &&
    viewportWidth > 0 &&
    viewportWidth < desktopWidth
  ) {
    width = Math.floor(viewportWidth);
  } else if (
    Number(window.visualViewport?.scale) > 1 &&
    viewportWidth > 0 &&
    viewportHeight > 0
  ) {
    // Pinch zoom shrinks both axes at once, so neither aligns with the
    // desktop; clamp to what the reader can actually reach.
    width = Math.min(width, Math.floor(viewportWidth));
    height = Math.min(
      height,
      Math.max(0, Math.floor(viewportHeight - taskbarHeight)),
    );
  }
  return {
    width: width > 0 ? width : desktopWidth,
    height: height > 0 ? height : desktopHeight,
  };
};

const isWindowPlacement = (value) =>
  value &&
  typeof value === "object" &&
  Number.isFinite(value.left) &&
  Number.isFinite(value.top) &&
  Number.isFinite(value.width) &&
  value.width > 0 &&
  Number.isFinite(value.height) &&
  value.height > 0;

const isWindowPlacementMap = (value) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.values(value).every(isWindowPlacement);

const getWindowPlacements = () =>
  readJsonStorage(WINDOW_PLACEMENTS_KEY, {}, isWindowPlacementMap);

const parseWindowLength = (value, fallback) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const persistWindowPlacement = (win) => {
  const source = win.maximized && win.prevRect ? win.prevRect : win.el.style;
  const placement = {
    left: parseWindowLength(source.left, win.el.offsetLeft),
    top: parseWindowLength(source.top, win.el.offsetTop),
    width: parseWindowLength(source.width, win.el.offsetWidth),
    height: parseWindowLength(source.height, win.el.offsetHeight),
  };
  if (!isWindowPlacement(placement)) return;
  writeJsonStorage(WINDOW_PLACEMENTS_KEY, {
    ...getWindowPlacements(),
    [win.gameId]: placement,
  });
};

const restoreWindowPlacement = (win) => {
  const saved = getWindowPlacements()[win.gameId];
  if (!saved) return;
  const { width: desktopWidth, height: desktopHeight } = getVisibleWorkArea();
  const width =
    desktopWidth > 0 ? Math.min(saved.width, desktopWidth) : saved.width;
  const height =
    desktopHeight > 0 ? Math.min(saved.height, desktopHeight) : saved.height;
  Object.assign(win.el.style, {
    width: `${width}px`,
    height: `${height}px`,
    left: `${saved.left}px`,
    top: `${saved.top}px`,
  });
  if (desktopWidth > 0 && desktopHeight > 0) {
    const position = clampWindowPosition(win, saved.left, saved.top);
    win.el.style.left = `${position.left}px`;
    win.el.style.top = `${position.top}px`;
  }
};

// Keep at least part of the title bar reachable inside the work area,
// matching how Windows XP constrains window positions.
const clampWindowPosition = (win, left, top) => {
  const { width: desktopWidth, height: desktopHeight } = getVisibleWorkArea();
  const width = parseWindowLength(win.el.style.width, win.el.offsetWidth);
  const height = parseWindowLength(win.el.style.height, win.el.offsetHeight);
  if (win.application?.window.nativeMetadata) {
    return {
      left: Math.min(Math.max(left, 0), Math.max(0, desktopWidth - width)),
      top: Math.min(Math.max(top, 0), Math.max(0, desktopHeight - height)),
    };
  }
  return {
    left: Math.min(Math.max(left, 60 - width), desktopWidth - 60),
    top: Math.min(Math.max(top, 0), desktopHeight - 28),
  };
};

const fitNativeProgramToWorkArea = (win) => {
  const preferred = win.application?.window;
  if (!(preferred?.fitToWorkArea || preferred?.nativeMetadata) || win.maximized)
    return false;

  const { width: visibleWidth, height: visibleHeight } = getVisibleWorkArea();
  if (visibleWidth <= 0 || visibleHeight <= 0) return false;
  const actualWidth = parseWindowLength(
    win.el.style.width,
    win.el.offsetWidth || preferred.width,
  );
  const actualHeight = parseWindowLength(
    win.el.style.height,
    win.el.offsetHeight || preferred.height,
  );
  if (win.workAreaFitRect) {
    const originalWidth = parseWindowLength(
      win.workAreaFitRect.width,
      preferred.width,
    );
    const originalHeight = parseWindowLength(
      win.workAreaFitRect.height,
      preferred.height,
    );
    if (originalWidth <= visibleWidth && originalHeight <= visibleHeight) {
      Object.assign(win.el.style, win.workAreaFitRect);
      win.workAreaFitRect = null;
      return true;
    }
    // The original size still does not fit, so keep filling the work area
    // instead of leaving the window at the size measured for the old one.
  } else if (actualWidth <= visibleWidth && actualHeight <= visibleHeight) {
    return false;
  }

  // Remembering the size measured at this exact moment (rather than the
  // application's own stable declared size) let it capture a value already
  // corrupted by a mid-update read. Since a metadata echo can retrigger this
  // same capture-then-restore path on every resize confirmation, a corrupted
  // capture becomes a new, larger "original" each cycle instead of ever
  // converging back to the true size - unbounded growth on every echo.
  win.workAreaFitRect ||= {
    left: win.el.style.left,
    top: win.el.style.top,
    width: `${preferred.width || actualWidth}px`,
    height: `${preferred.height || actualHeight}px`,
    minWidth: win.el.style.minWidth,
    minHeight: win.el.style.minHeight,
  };

  Object.assign(win.el.style, {
    left: "0px",
    top: "0px",
    width: `${visibleWidth}px`,
    height: `${visibleHeight}px`,
    minWidth: "0px",
    minHeight: "0px",
  });
  return true;
};

const keepWindowsInWorkArea = () => {
  const { width: desktopWidth, height: desktopHeight } = getDesktopSize();
  if (desktopWidth === 0 || desktopHeight === 0) return;

  openWindows.forEach((win) => {
    if (win.maximized) return;
    if (fitNativeProgramToWorkArea(win)) return;
    const el = win.el;
    const width = parseWindowLength(el.style.width, el.offsetWidth);
    const height = parseWindowLength(el.style.height, el.offsetHeight);
    el.style.width = `${Math.min(width, desktopWidth)}px`;
    el.style.height = `${Math.min(height, desktopHeight)}px`;
    const position = clampWindowPosition(win, el.offsetLeft, el.offsetTop);
    el.style.left = `${position.left}px`;
    el.style.top = `${position.top}px`;
  });
};

const snapshotWindowState = () => ({
  focusedGameId,
  zIndexCounter,
  windows: [...openWindows.values()].map((win) => ({
    gameId: win.gameId,
    minimized: win.minimized,
    maximized: win.maximized,
    zIndex: win.zIndex,
    lastUsed: win.lastUsed,
    prevRect: win.prevRect ? { ...win.prevRect } : null,
    styles: Object.fromEntries(
      ["left", "top", "width", "height", "display", "zIndex"].map((name) => [
        name,
        win.el.style[name],
      ]),
    ),
  })),
});

const restoreWindowState = (snapshot) => {
  if (!snapshot) return;
  snapshot.windows.forEach((saved) => {
    const win = openWindows.get(saved.gameId);
    if (!win) return;
    Object.assign(win, {
      minimized: saved.minimized,
      maximized: saved.maximized,
      zIndex: saved.zIndex,
      lastUsed: saved.lastUsed,
      prevRect: saved.prevRect ? { ...saved.prevRect } : null,
    });
    Object.assign(win.el.style, saved.styles);
    win.el.classList.toggle("maximized", saved.maximized);
  });
  focusedGameId = openWindows.has(snapshot.focusedGameId)
    ? snapshot.focusedGameId
    : null;
  zIndexCounter = Math.max(
    snapshot.zIndexCounter,
    ...[...openWindows.values()].map((win) => win.zIndex || 0),
  );
  openWindows.forEach((win, gameId) =>
    win.el.classList.toggle("active", gameId === focusedGameId),
  );
  // A bounded selected monitor is not a physical viewport constraint. Only
  // clamp a restored snapshot when the browser itself is the limiting edge.
  const monitor = getSimulatedMonitorSize();
  if (activeMonitorResolution === "auto" || monitor.limited)
    keepWindowsInWorkArea();
  if (iconsBuilt) layoutDesktopIcons();
  applyFocusVolumes();
  renderTaskButtons();
  updateDocumentTitle();
};

const updateDocumentTitle = () => {
  document.title = focusedGameId
    ? formatGameTitle(focusedGameId)
    : "Astro Flash Collection";
};

const applyFocusVolumes = () => {
  openWindows.forEach((win, gameId) => {
    const volume = gameId === focusedGameId ? normalizeGameVolume(gameId) : 0;
    setPlayerVolume(win.player, win.type, volume);
  });
};

const syncWindowVolumeUI = (win) => {
  if (!win.volumeBtn) return;
  const { volume, isMuted } = getGameVolume(win.gameId);
  const numericVolume = Number.isFinite(volume) ? volume : 100;
  const muted = isMuted || numericVolume === 0;
  [win.volumeBtn, win.volumeMenuItem].filter(Boolean).forEach((button) => {
    button.classList.toggle("checked", muted);
    button.classList.toggle("active", muted);
    button.setAttribute("aria-pressed", String(muted));
    button.setAttribute("aria-checked", String(muted));
  });
  win.volumeBtn.title = muted ? "Unmute / Volume" : "Mute / Volume";
  win.volumeBtn.setAttribute("aria-label", win.volumeBtn.title);
  const label = win.volumeMenuItem?.querySelector(".menu-item-label");
  if (label) {
    const menuLabel = muted ? "&Unmute" : "&Mute";
    win.volumeMenuItem.dataset.accessKey =
      XPDialogs.parseAccessKey(menuLabel).key;
    setAccessKeyText(label, menuLabel);
  }
  if (win.volumeSlider) {
    win.volumeSlider.value = String(numericVolume);
    win.volumeSlider.setAttribute(
      "aria-valuetext",
      muted ? `Muted, volume ${numericVolume}%` : `${numericVolume}%`,
    );
  }
};

const setWindowVolume = (win, value) => {
  const numericValue = parseInt(value, 10);
  if (!Number.isFinite(numericValue)) return;

  const isMuted = numericValue === 0;
  setGameVolume(win.gameId, numericValue, isMuted);

  if (win.gameId === focusedGameId) {
    setPlayerVolume(win.player, win.type, isMuted ? 0 : numericValue / 100);
  }
  syncWindowVolumeUI(win);
};

const toggleWindowMute = (win) => {
  const gameSettings = getGameVolume(win.gameId);

  if (gameSettings.isMuted) {
    // Unmuting - restore to previous volume
    const volume = gameSettings.volume || 100;
    setGameVolume(win.gameId, volume, false);
    if (win.gameId === focusedGameId) {
      setPlayerVolume(win.player, win.type, volume / 100);
    }
  } else {
    // Muting - store current volume before setting to 0
    setGameVolume(win.gameId, gameSettings.volume, true);
    if (win.gameId === focusedGameId) {
      setPlayerVolume(win.player, win.type, 0);
    }
  }
  syncWindowVolumeUI(win);
};

const updateFavoriteUI = (win) => {
  if (!win.favoriteBtn) return;
  const isFavorite = getFavorites().includes(win.gameId);
  [win.favoriteBtn, win.favoriteMenuItem].filter(Boolean).forEach((button) => {
    button.classList.toggle("active", isFavorite);
    button.classList.toggle("checked", isFavorite);
    button.setAttribute("aria-pressed", String(isFavorite));
    button.setAttribute("aria-checked", String(isFavorite));
  });
  win.favoriteBtn.title = isFavorite
    ? "Remove from Favorites"
    : "Add to Favorites";
  win.favoriteBtn.setAttribute("aria-label", win.favoriteBtn.title);
  const label = win.favoriteMenuItem?.querySelector(".menu-item-label");
  if (label) {
    const menuLabel = isFavorite
      ? "&Remove from Favorites"
      : "Add to &Favorites";
    win.favoriteMenuItem.dataset.accessKey =
      XPDialogs.parseAccessKey(menuLabel).key;
    setAccessKeyText(label, menuLabel);
  }
};

const toggleFavorite = (gameId) => {
  const favorites = getFavorites();
  const index = favorites.indexOf(gameId);

  if (index === -1) {
    favorites.push(gameId);
  } else {
    favorites.splice(index, 1);
  }

  setFavorites(favorites);

  const win = openWindows.get(gameId);
  if (win) {
    updateFavoriteUI(win);
  }

  // Refresh start menu if it's open
  const startMenu = document.getElementById("start-menu");
  if (!startMenu.hidden) {
    buildPinnedPrograms();
    if (!document.getElementById("start-menu-flyouts").hidden) {
      openAllPrograms();
    }
  }
};

const trackGamePlay = (gameId) => {
  const gameStats = getGameStats();
  const timestamp = Date.now();

  if (!gameStats[gameId]) {
    gameStats[gameId] = {
      plays: 0,
      lastPlayed: null,
    };
  }

  gameStats[gameId].plays += 1;
  gameStats[gameId].lastPlayed = timestamp;

  writeJsonStorage("gameStats", gameStats);

  const win = openWindows.get(gameId);
  if (win) {
    win.lastUsed = timestamp;
  }
};

const createWindowElement = (gameId) => {
  const win = document.createElement("div");
  win.className = "xp-window";
  win.dataset.game = gameId;

  const titleBar = document.createElement("div");
  titleBar.className = "title-bar";

  const titleIcon = createGameIconElement(gameId, "title-icon");

  const titleText = document.createElement("span");
  titleText.className = "title-text";
  titleText.textContent = formatGameTitle(gameId);

  const titleButtons = document.createElement("div");
  titleButtons.className = "title-buttons";

  const minimizeBtn = document.createElement("button");
  minimizeBtn.type = "button";
  minimizeBtn.className = "tb-btn minimize-btn";
  minimizeBtn.title = "Minimize";
  minimizeBtn.setAttribute("aria-label", "Minimize");

  const maximizeBtn = document.createElement("button");
  maximizeBtn.type = "button";
  maximizeBtn.className = "tb-btn maximize-btn";
  maximizeBtn.title = "Maximize";
  maximizeBtn.setAttribute("aria-label", "Maximize");

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "tb-btn close-btn";
  closeBtn.title = "Close";
  closeBtn.setAttribute("aria-label", "Close");

  titleButtons.append(minimizeBtn, maximizeBtn, closeBtn);
  titleBar.append(titleIcon, titleText, titleButtons);

  const menuBar = document.createElement("div");
  menuBar.className = "game-menu-bar";
  menuBar.setAttribute("role", "toolbar");
  menuBar.setAttribute("aria-label", "Game controls");

  const menuItems = document.createElement("div");
  menuItems.className = "game-menu-items";
  menuItems.setAttribute("role", "menubar");
  menuItems.setAttribute("aria-label", "Game menu");

  const makeMenuButton = (label) => {
    const { text, key } = XPDialogs.parseAccessKey(label);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "game-menu-button";
    button.dataset.gameMenu = text.toLowerCase();
    button.dataset.accessKey = key;
    button.setAttribute("role", "menuitem");
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
    setAccessKeyText(button, label);
    return button;
  };

  const makeMenuItem = (label, action, options = {}) => {
    const { key } = XPDialogs.parseAccessKey(label);
    const item = document.createElement("button");
    item.type = "button";
    item.className = "game-menu-item";
    item.dataset.gameAction = action;
    if (key) item.dataset.accessKey = key;
    item.setAttribute(
      "role",
      options.checkbox ? "menuitemcheckbox" : "menuitem",
    );
    if (options.checkbox) item.setAttribute("aria-checked", "false");
    if (options.disabled) item.disabled = true;
    if (options.checkbox) {
      const check = document.createElement("span");
      check.className = "menu-check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = "✓";
      item.appendChild(check);
    }
    const itemLabel = document.createElement("span");
    itemLabel.className = "menu-item-label";
    setAccessKeyText(itemLabel, label);
    item.appendChild(itemLabel);
    if (options.shortcut) {
      const shortcut = document.createElement("span");
      shortcut.className = "menu-shortcut";
      shortcut.textContent = options.shortcut;
      item.appendChild(shortcut);
    }
    return item;
  };

  const makeMenu = (name) => {
    const menu = document.createElement("div");
    menu.className = "game-menu";
    menu.dataset.gameMenu = name;
    menu.setAttribute("role", "menu");
    menu.hidden = true;
    return menu;
  };

  const fileButton = makeMenuButton("&File");
  const helpButton = makeMenuButton("&Help");

  const fileMenu = makeMenu("file");
  fileMenu.append(
    makeMenuItem("&Full Screen", "fullscreen", { shortcut: "F11" }),
    makeMenuItem("Add to &Favorites", "favorite", { checkbox: true }),
    makeMenuItem("&Mute", "mute", { checkbox: true }),
    makeMenuItem("&Volume", "volume-popup"),
    Object.assign(document.createElement("div"), {
      className: "game-menu-separator",
    }),
    makeMenuItem("&Close", "close", { shortcut: "Alt+F4" }),
    Object.assign(document.createElement("div"), {
      className: "game-menu-separator",
    }),
    makeMenuItem("&Properties", "properties", {
      disabled: gamesList[gameId]?.type !== "swf",
    }),
  );

  const helpMenu = makeMenu("help");
  helpMenu.append(makeMenuItem("&About Astro Flash", "project"));

  const quickActions = document.createElement("div");
  quickActions.className = "game-quick-actions";

  const fullscreenBtn = document.createElement("button");
  fullscreenBtn.type = "button";
  fullscreenBtn.className = "quick-access-btn fullscreen-btn";
  fullscreenBtn.title = "Full Screen (F11)";
  fullscreenBtn.setAttribute("aria-label", "Full Screen (F11)");
  fullscreenBtn.textContent = "⛶";

  const quickFavoriteBtn = document.createElement("button");
  quickFavoriteBtn.type = "button";
  quickFavoriteBtn.className = "quick-access-btn favorite-btn";
  quickFavoriteBtn.title = "Add to Favorites";
  quickFavoriteBtn.setAttribute("aria-label", "Add to Favorites");
  quickFavoriteBtn.textContent = "★";
  quickFavoriteBtn.setAttribute("aria-pressed", "false");

  const quickVolumeBtn = document.createElement("button");
  quickVolumeBtn.type = "button";
  quickVolumeBtn.className = "quick-access-btn volume-btn";
  quickVolumeBtn.title = "Mute";
  quickVolumeBtn.setAttribute("aria-label", "Mute");
  quickVolumeBtn.textContent = "🔊";
  quickVolumeBtn.setAttribute("aria-pressed", "false");

  const volumeSlider = document.createElement("input");
  volumeSlider.className = "volume-slider game-volume-slider";
  volumeSlider.type = "range";
  volumeSlider.min = "0";
  volumeSlider.max = "100";
  volumeSlider.step = "1";
  volumeSlider.value = "100";
  volumeSlider.setAttribute("aria-label", "Game volume");

  quickActions.append(
    quickFavoriteBtn,
    quickVolumeBtn,
    volumeSlider,
    fullscreenBtn,
  );
  menuItems.append(fileButton, helpButton);
  menuBar.append(menuItems, quickActions);

  const content = document.createElement("div");
  content.className = "window-content";

  win.append(titleBar, menuBar, fileMenu, helpMenu, content);

  RESIZE_DIRECTIONS.forEach((direction) => {
    const handle = document.createElement("div");
    handle.className = `resize-handle resize-${direction}`;
    handle.dataset.dir = direction;
    win.appendChild(handle);
  });

  return win;
};

const updateMaximizeButton = (win) => {
  const button = win.maximizeBtn || win.el.querySelector(".maximize-btn");
  if (!button) return;

  button.classList.toggle("restore-btn", win.maximized);
  button.title = win.maximized ? "Restore" : "Maximize";
  button.setAttribute("aria-label", button.title);
};

const bundledGameRoot = (gameId, type) =>
  new URL(
    window.ASTRO_GAME_ROOTS?.[gameId] || `${type}/${gameId}/`,
    document.baseURI,
  ).href;

const loadRuffleSWF = (gameId, win) => {
  const ruffle = window.RufflePlayer.newest();
  const player = ruffle.createPlayer();
  player.id = `player-${gameId}`;
  win.content.appendChild(player);
  win.player = player;

  const applyVolume = () => {
    const volume = gameId === focusedGameId ? normalizeGameVolume(gameId) : 0;
    setPlayerVolume(player, "swf", volume);
  };
  player.addEventListener("loadedmetadata", applyVolume, { once: true });

  const game = gamesList[gameId];
  const gameRoot = bundledGameRoot(gameId, "swf");
  const archiveUrl = game.archive?.launchUrl;
  const frameRate = resolveGameFrameRate(gameId);
  const config = {
    url: game.url || archiveUrl || `${gameRoot}main.swf`,
    base: game.base || (archiveUrl ? new URL(".", archiveUrl).href : gameRoot),
    letterbox: "on",
    scale: "showAll",
    forceScale: true,
    openUrlMode: "confirm",
    showSwfDownload: true,
    ...(frameRate === null ? {} : { frameRate }),
    volume: gameId === focusedGameId ? normalizeGameVolume(gameId) : 0,
    allowScriptAccess: false,
    autoplay: "on",
    unmuteOverlay: "hidden",
  };

  player.load(config);
};

const reloadRuffleSWF = (win) => {
  win.player?.remove();
  win.player = null;
  loadRuffleSWF(win.gameId, win);
};

const getLoadedMovieFrameRate = (player) => {
  try {
    return (
      player?.ruffle?.(1)?.metadata?.frameRate ?? player?.metadata?.frameRate
    );
  } catch {
    return null;
  }
};

const openGameProperties = (win) => {
  if (win.type !== "swf") return;

  const currentSetting = getGameFrameRateSetting(win.gameId);
  const defaultFrameRate = normalizeFrameRate(gamesList[win.gameId]?.frameRate);
  const nativeFrameRate = getLoadedMovieFrameRate(win.player);
  const dialog = XPDialogs.createDialog({
    title: `${formatGameTitle(win.gameId)} Properties`,
    onCancel: () => dialog.close("cancel"),
  });

  const group = document.createElement("fieldset");
  group.className = "dlg-group game-playback-settings";
  const legend = document.createElement("legend");
  legend.textContent = "Playback";

  const row = document.createElement("div");
  row.className = "game-playback-row";
  const label = document.createElement("label");
  label.htmlFor = "game-frame-rate";
  label.textContent = "Frame rate:";
  const select = document.createElement("select");
  select.id = "game-frame-rate";
  select.className = "xp-select";
  [
    [
      "default",
      defaultFrameRate === null
        ? "Default (native)"
        : `Default (${defaultFrameRate} FPS)`,
    ],
    ["native", "Native (from SWF)"],
    ["30", "30 FPS"],
    ["45", "45 FPS"],
    ["60", "60 FPS"],
    ["custom", "Custom"],
  ].forEach(([value, text]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
  });

  const customInput = document.createElement("input");
  customInput.className = "xp-input game-fps-custom";
  customInput.type = "number";
  customInput.min = "1";
  customInput.max = "240";
  customInput.step = "0.01";
  customInput.setAttribute("aria-label", "Custom frames per second");
  customInput.value =
    typeof currentSetting === "number" ? String(currentSetting) : "60";
  const presetFrameRates = [30, 45, 60];
  select.value =
    typeof currentSetting === "number"
      ? presetFrameRates.includes(currentSetting)
        ? String(currentSetting)
        : "custom"
      : currentSetting;

  const suffix = document.createElement("span");
  suffix.textContent = "FPS";
  const nativeDescription = document.createElement("p");
  nativeDescription.className = "game-playback-note";
  nativeDescription.textContent = Number.isFinite(nativeFrameRate)
    ? `This movie's native frame rate is ${nativeFrameRate} FPS.`
    : "Native uses the frame rate stored in the movie.";
  const warning = document.createElement("p");
  warning.className = "game-playback-note";
  warning.textContent =
    "Changing the frame rate may affect gameplay speed and audio timing.";
  const status = document.createElement("p");
  status.className = "game-playback-status";
  status.setAttribute("role", "alert");

  const syncCustomInput = () => {
    const custom = select.value === "custom";
    customInput.hidden = !custom;
    suffix.hidden = !custom;
    if (custom) customInput.focus();
  };
  select.addEventListener("change", syncCustomInput);
  syncCustomInput();

  row.append(label, select, customInput, suffix);
  group.append(legend, row, nativeDescription, warning, status);

  const buttons = document.createElement("div");
  buttons.className = "dlg-buttons";
  const okButton = XPDialogs.createDialogButton(
    { id: "ok", label: "OK", isDefault: true },
    () => {
      const selectedSetting =
        select.value === "default" || select.value === "native"
          ? select.value
          : normalizeFrameRate(
              select.value === "custom" ? customInput.value : select.value,
            );
      if (
        select.value !== "default" &&
        select.value !== "native" &&
        selectedSetting === null
      ) {
        status.textContent = "Enter a frame rate from 1 to 240 FPS.";
        customInput.focus();
        customInput.select();
        return;
      }
      setGameFrameRate(win.gameId, selectedSetting);
      dialog.close("ok");
      if (selectedSetting !== currentSetting) reloadRuffleSWF(win);
    },
  );
  const cancelButton = XPDialogs.createDialogButton(
    { id: "cancel", label: "Cancel", isCancel: true },
    () => dialog.close("cancel"),
  );
  buttons.append(okButton, cancelButton);
  dialog.body.append(group, buttons);
  dialog.defaultButton = okButton;
  select.focus();
};

const loadIframe = (gameId, win) => {
  const player = document.createElement("iframe");
  player.allow = "fullscreen";
  player.src = bundledGameRoot(gameId, "iframe");
  player.id = `player-${gameId}`;
  win.content.appendChild(player);
  win.player = player;

  player.addEventListener(
    "load",
    () => {
      const volume = gameId === focusedGameId ? normalizeGameVolume(gameId) : 0;
      setPlayerVolume(player, "iframe", volume);
    },
    { once: true },
  );
};

const focusWindow = (gameId, { notifyApplication = true } = {}) => {
  const win = openWindows.get(gameId);
  if (!win) return;

  focusedGameId = gameId;
  win.needsAttention = false;
  win.lastUsed = Date.now();
  win.zIndex = ++zIndexCounter;
  win.el.style.zIndex = win.zIndex;
  if (notifyApplication) win.mountedApplication?.focus?.();

  openWindows.forEach((w, id) => {
    w.el.classList.toggle("active", id === gameId);
  });

  applyFocusVolumes();
  syncWindowVolumeUI(win);
  renderTaskButtons();
  updateDocumentTitle();

  const deepLinkId = gamesList[gameId]
    ? gameId
    : window.XPApplicationRegistry?.get(gameId)?.deepLinkId;
  if (deepLinkId && window.location.hash !== `#${deepLinkId}`) {
    const deepLinkUrl = new URL("/", window.location.origin);
    deepLinkUrl.search = window.location.search;
    deepLinkUrl.hash = deepLinkId;
    history.replaceState(null, "", deepLinkUrl);
  }
};

const focusTopWindow = () => {
  let topWin = null;
  openWindows.forEach((win) => {
    if (!win.minimized && (!topWin || win.zIndex > topWin.zIndex)) {
      topWin = win;
    }
  });

  if (topWin) {
    focusWindow(topWin.gameId);
  } else {
    focusedGameId = null;
    applyFocusVolumes();
    renderTaskButtons();
    updateDocumentTitle();
    history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
  }
};

const minimizeWindow = (gameId, { notifyApplication = true } = {}) => {
  const win = openWindows.get(gameId);
  if (!win || win.minimized) return;

  if (notifyApplication && win.mountedApplication?.minimize?.() === false)
    return;
  win.minimized = true;
  const taskButton = document.querySelector(
    `.task-button[data-game="${gameId}"]`,
  );
  const target = taskButton?.getBoundingClientRect();
  const source = win.el.getBoundingClientRect();
  const deltaX = target
    ? target.left + target.width / 2 - (source.left + source.width / 2)
    : 0;
  const deltaY = target ? target.top - source.bottom : 32;
  const animation = win.el.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      {
        transform: `translate(${deltaX}px, ${deltaY}px) scale(0.12, 0.05)`,
        opacity: 0.35,
      },
    ],
    { duration: 170, easing: "ease-in", fill: "forwards" },
  );
  animation.addEventListener(
    "finish",
    () => {
      if (win.minimized) {
        win.el.style.display = "none";
      }
      animation.cancel();
    },
    { once: true },
  );

  if (focusedGameId === gameId) {
    focusedGameId = null;
    focusTopWindow();
  } else {
    renderTaskButtons();
  }
};

const restoreWindow = (gameId, { notifyApplication = true } = {}) => {
  const win = openWindows.get(gameId);
  if (!win || !win.minimized) return;

  if (notifyApplication && win.mountedApplication?.restore?.() === false)
    return;
  win.minimized = false;
  win.el.style.display = "flex";
  win.el.animate(
    [
      { transform: "scale(0.92)", opacity: 0.45 },
      { transform: "scale(1)", opacity: 1 },
    ],
    { duration: 130, easing: "ease-out" },
  );
};

const minimizeAllWindows = () => {
  openWindows.forEach((win) => {
    win.minimized = true;
    win.el.style.display = "none";
  });
  focusedGameId = null;
  applyFocusVolumes();
  renderTaskButtons();
  updateDocumentTitle();
};

let showDesktopSnapshot = null;
const toggleShowDesktop = () => {
  if (showDesktopSnapshot) {
    showDesktopSnapshot.windows.forEach(({ gameId, minimized }) => {
      const win = openWindows.get(gameId);
      if (win && !minimized) restoreWindow(gameId);
    });
    const activeGameId = showDesktopSnapshot.focusedGameId;
    showDesktopSnapshot = null;
    if (activeGameId && openWindows.has(activeGameId)) {
      focusWindow(activeGameId);
    } else focusTopWindow();
    return;
  }

  showDesktopSnapshot = {
    focusedGameId,
    windows: [...openWindows.values()].map((win) => ({
      gameId: win.gameId,
      minimized: win.minimized,
    })),
  };
  minimizeAllWindows();
};

const toggleMaximize = (gameId, { notifyApplication = true } = {}) => {
  const win = openWindows.get(gameId);
  if (!win) return;

  if (notifyApplication) {
    const handled = win.maximized
      ? win.mountedApplication?.restore?.()
      : win.mountedApplication?.maximize?.();
    if (handled === false) return;
  }
  if (!win.maximized) {
    win.prevRect = {
      left: win.el.style.left,
      top: win.el.style.top,
      width: win.el.style.width,
      height: win.el.style.height,
    };
    persistWindowPlacement(win);
    win.el.classList.add("maximized");
    win.maximized = true;
  } else {
    win.el.classList.remove("maximized");
    if (win.prevRect) {
      Object.assign(win.el.style, win.prevRect);
      const position = clampWindowPosition(
        win,
        win.el.offsetLeft,
        win.el.offsetTop,
      );
      win.el.style.left = `${position.left}px`;
      win.el.style.top = `${position.top}px`;
    }
    win.maximized = false;
    fitNativeProgramToWorkArea(win);
  }
  updateMaximizeButton(win);
  focusWindow(gameId, { notifyApplication });
};

const closeGameWindow = (
  gameId,
  { skipBeforeClose = false, skipUnmount = false } = {},
) => {
  const win = openWindows.get(gameId);
  if (!win) return;

  if (!skipBeforeClose && win.beforeClose) {
    const result = win.beforeClose();
    if (result && typeof result.then === "function") {
      result.then((shouldClose) => {
        if (shouldClose !== false) {
          closeGameWindow(gameId, { skipBeforeClose: true });
        }
      });
      return;
    }
    if (result === false) return;
  }
  if (!skipBeforeClose && win.removeGameDataOnClose) {
    const temporaryData = win.removeGameDataOnClose;
    win.removeGameDataOnClose = false;
    gameDataManager
      .removeTemporary(temporaryData.storageId, temporaryData.fileName)
      .catch((error) =>
        console.error("Could not remove temporary %s data:", gameId, error),
      )
      .finally(() => {
        window.postMessage(
          { event: "astro.game-data-changed" },
          location.origin,
        );
        closeGameWindow(gameId, { skipBeforeClose: true });
      });
    return;
  }
  persistWindowPlacement(win);
  if (!skipUnmount) win.mountedApplication?.unmount?.();
  win.el.remove();
  openWindows.delete(gameId);

  if (focusedGameId === gameId) {
    focusedGameId = null;
    focusTopWindow();
  } else {
    renderTaskButtons();
  }
};

const wireDrag = (win) => {
  restoreWindowPlacement(win);
  const bar = win.el.querySelector(".title-bar");
  const titleIcon = bar.querySelector(".title-icon");

  bar.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest(".title-buttons, .title-icon"))
      return;

    closeWindowSystemMenu();
    let restoredFromMaximized = false;
    if (win.maximized) {
      // Restore the window under the pointer before dragging, keeping
      // the pointer at the same relative position on the title bar.
      const rect = win.el.getBoundingClientRect();
      const ratio = Math.min(
        Math.max((e.clientX - rect.left) / rect.width, 0),
        1,
      );
      toggleMaximize(win.gameId);
      const position = clampWindowPosition(
        win,
        e.clientX - win.el.offsetWidth * ratio,
        e.clientY - 14,
      );
      win.el.style.left = `${position.left}px`;
      win.el.style.top = `${position.top}px`;
      restoredFromMaximized = true;
    } else {
      focusWindow(win.gameId);
    }

    const start = {
      x: e.clientX,
      y: e.clientY,
      left: win.el.offsetLeft,
      top: win.el.offsetTop,
      width: win.el.offsetWidth,
      desktop: getDesktopSize(),
    };
    let frame = 0;
    let nextPosition = { left: start.left, top: start.top };

    const getPosition = (clientX, clientY) => ({
      left: Math.min(
        Math.max(start.left + clientX - start.x, 60 - start.width),
        start.desktop.width - 60,
      ),
      top: Math.min(
        Math.max(start.top + clientY - start.y, 0),
        start.desktop.height - 28,
      ),
    });
    const renderPosition = () => {
      win.el.style.transform = `translate3d(${nextPosition.left - start.left}px, ${nextPosition.top - start.top}px, 0)`;
    };

    const onMove = (ev) => {
      nextPosition = getPosition(ev.clientX, ev.clientY);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(renderPosition);
    };

    const onUp = (ev) => {
      bar.removeEventListener("pointermove", onMove);
      bar.removeEventListener("pointerup", onUp);
      bar.removeEventListener("pointercancel", onUp);
      cancelAnimationFrame(frame);
      if (ev.type === "pointerup") {
        nextPosition = getPosition(ev.clientX, ev.clientY);
      }
      win.el.style.left = `${nextPosition.left}px`;
      win.el.style.top = `${nextPosition.top}px`;
      win.el.style.transform = "";
      win.el.classList.remove("moving");
      if (restoredFromMaximized) {
        // The dragged position becomes the new restore geometry.
        win.prevRect = {
          left: win.el.style.left,
          top: win.el.style.top,
          width: win.el.style.width,
          height: win.el.style.height,
        };
      }
      persistWindowPlacement(win);
    };

    try {
      bar.setPointerCapture(e.pointerId);
    } catch (error) {
      /* pointer capture unsupported */
    }

    win.el.getAnimations().forEach((animation) => animation.cancel());
    win.el.classList.add("moving");
    bar.addEventListener("pointermove", onMove);
    bar.addEventListener("pointerup", onUp);
    bar.addEventListener("pointercancel", onUp);
    e.preventDefault();
  });

  bar.addEventListener("dblclick", (e) => {
    if (e.target.closest(".title-buttons, .title-icon")) return;
    toggleMaximize(win.gameId);
  });

  // Right-clicking the title bar opens the window system menu.
  bar.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openWindowSystemMenu(win, e.clientX, e.clientY);
  });

  // Windows XP: clicking the title-bar icon opens the system menu,
  // double-clicking it closes the window.
  titleIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    const rect = titleIcon.getBoundingClientRect();
    openWindowSystemMenu(win, rect.left, rect.bottom + 2);
  });
  titleIcon.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    closeGameWindow(win.gameId);
  });
};

const applyResize = (win, direction, start, deltaX, deltaY, desktopSize) => {
  const { width: desktopWidth, height: desktopHeight } = desktopSize;
  const right = start.left + start.width;
  const bottom = start.top + start.height;
  let { left, top, width, height } = start;

  if (direction.includes("e")) {
    width = Math.min(
      Math.max(start.width + deltaX, MIN_WINDOW_WIDTH),
      desktopWidth - start.left,
    );
  }
  if (direction.includes("w")) {
    width = Math.min(Math.max(start.width - deltaX, MIN_WINDOW_WIDTH), right);
    left = right - width;
  }
  if (direction.includes("s")) {
    height = Math.min(
      Math.max(start.height + deltaY, MIN_WINDOW_HEIGHT),
      desktopHeight - start.top,
    );
  }
  if (direction.includes("n")) {
    height = Math.min(
      Math.max(start.height - deltaY, MIN_WINDOW_HEIGHT),
      bottom,
    );
    top = bottom - height;
  }

  Object.assign(win.el.style, {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
  });
};

const wireResize = (win) => {
  win.el.querySelectorAll(".resize-handle").forEach((handle) => {
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || win.maximized) return;
      focusWindow(win.gameId);
      e.preventDefault();

      const direction = handle.dataset.dir;
      // Native windows echo their new client size back as metadata; ignore it
      // while dragging so the frame does not fight the pointer.
      win.resizing = true;
      const start = {
        x: e.clientX,
        y: e.clientY,
        left: win.el.offsetLeft,
        top: win.el.offsetTop,
        width: win.el.offsetWidth,
        height: win.el.offsetHeight,
      };
      const desktopSize = getDesktopSize();
      let frame = 0;
      let nextPointer = { x: e.clientX, y: e.clientY };

      const updateSize = () =>
        applyResize(
          win,
          direction,
          start,
          nextPointer.x - start.x,
          nextPointer.y - start.y,
          desktopSize,
        );

      const onMove = (ev) => {
        nextPointer = { x: ev.clientX, y: ev.clientY };
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(updateSize);
      };

      const onUp = (ev) => {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        cancelAnimationFrame(frame);
        if (ev.type === "pointerup") {
          nextPointer = { x: ev.clientX, y: ev.clientY };
        }
        updateSize();
        win.resizing = false;
        persistWindowPlacement(win);
        win.mountedApplication?.bounds?.(
          win.el.offsetLeft,
          win.el.offsetTop,
          win.el.offsetWidth,
          win.el.offsetHeight,
        );
      };

      try {
        handle.setPointerCapture(e.pointerId);
      } catch (error) {
        /* pointer capture unsupported */
      }

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    });
  });
};

// ============================================
// Window System Menu (Restore / Move / Size / ...)
// ============================================

let systemMenuWin = null;

const closeWindowSystemMenu = () => {
  const menu = document.getElementById("window-system-menu");
  if (menu) menu.hidden = true;
  systemMenuWin = null;
};

const openWindowSystemMenu = (win, clientX, clientY) => {
  const desktop = document.getElementById("desktop");
  const menu = document.getElementById("window-system-menu");
  systemMenuWin = win;

  const enabled = {
    restore: win.maximized || win.minimized,
    move: !win.maximized && !win.minimized,
    size: !win.maximized && !win.minimized,
    minimize: !win.minimized,
    maximize: !win.maximized && !win.minimized,
    close: true,
  };
  menu.querySelectorAll("[data-command]").forEach((button) => {
    button.disabled = !enabled[button.dataset.command];
  });

  closeDesktopContextMenu();
  closeStartMenu();
  menu.hidden = false;
  menu.style.left = "0";
  menu.style.top = "0";

  const bounds = desktop.getBoundingClientRect();
  const left = Math.max(
    0,
    Math.min(clientX - bounds.left, bounds.width - menu.offsetWidth - 2),
  );
  const top = Math.max(
    0,
    Math.min(clientY - bounds.top, bounds.height - menu.offsetHeight - 2),
  );
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.querySelector("button:not(:disabled)")?.focus();
};

const nudgeWindow = (win, deltaX, deltaY) => {
  const position = clampWindowPosition(
    win,
    win.el.offsetLeft + deltaX,
    win.el.offsetTop + deltaY,
  );
  win.el.style.left = `${position.left}px`;
  win.el.style.top = `${position.top}px`;
};

const nudgeResize = (win, deltaX, deltaY) => {
  const { width: desktopWidth, height: desktopHeight } = getDesktopSize();
  const width = Math.min(
    Math.max(win.el.offsetWidth + deltaX, MIN_WINDOW_WIDTH),
    desktopWidth - win.el.offsetLeft,
  );
  const height = Math.min(
    Math.max(win.el.offsetHeight + deltaY, MIN_WINDOW_HEIGHT),
    desktopHeight - win.el.offsetTop,
  );
  win.el.style.width = `${width}px`;
  win.el.style.height = `${height}px`;
};

// Windows XP Move/Size commands: the window follows the pointer or the
// arrow keys until Enter (or a click) commits or Escape cancels.
const startMoveSizeMode = (win, mode) => {
  if (win.maximized || win.minimized) return;
  focusWindow(win.gameId);

  const el = win.el;
  const original = {
    left: el.style.left,
    top: el.style.top,
    width: el.style.width,
    height: el.style.height,
  };
  el.classList.add(`${mode}-mode`);
  let lastPointer = null;

  const finish = (commit) => {
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("pointermove", onPointerMove, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    el.classList.remove(`${mode}-mode`);
    if (!commit) {
      Object.assign(el.style, original);
    }
  };

  const onKey = (e) => {
    const keys = [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Enter",
      "Escape",
    ];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Enter") return finish(true);
    if (e.key === "Escape") return finish(false);

    const deltaX =
      e.key === "ArrowLeft"
        ? -MOVE_SIZE_STEP
        : e.key === "ArrowRight"
          ? MOVE_SIZE_STEP
          : 0;
    const deltaY =
      e.key === "ArrowUp"
        ? -MOVE_SIZE_STEP
        : e.key === "ArrowDown"
          ? MOVE_SIZE_STEP
          : 0;
    if (mode === "move") {
      nudgeWindow(win, deltaX, deltaY);
    } else {
      nudgeResize(win, deltaX, deltaY);
    }
  };

  const onPointerMove = (e) => {
    if (lastPointer === null) {
      lastPointer = { x: e.clientX, y: e.clientY };
      return;
    }
    const deltaX = e.clientX - lastPointer.x;
    const deltaY = e.clientY - lastPointer.y;
    lastPointer = { x: e.clientX, y: e.clientY };
    if (mode === "move") {
      nudgeWindow(win, deltaX, deltaY);
    } else {
      nudgeResize(win, deltaX, deltaY);
    }
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    finish(true);
  };

  document.addEventListener("keydown", onKey, true);
  document.addEventListener("pointermove", onPointerMove, true);
  document.addEventListener("pointerdown", onPointerDown, true);
};

const runSystemMenuCommand = (win, command) => {
  switch (command) {
    case "restore":
      if (win.minimized) {
        restoreWindow(win.gameId);
        focusWindow(win.gameId);
        break;
      }
      toggleMaximize(win.gameId);
      break;
    case "maximize":
      toggleMaximize(win.gameId);
      break;
    case "minimize":
      minimizeWindow(win.gameId);
      break;
    case "close":
      closeGameWindow(win.gameId);
      break;
    case "move":
    case "size":
      startMoveSizeMode(win, command);
      break;
  }
};

const setupWindowSystemMenu = () => {
  const menu = document.getElementById("window-system-menu");
  menu.addEventListener("click", (e) => {
    const button = e.target.closest("[data-command]");
    if (!button || button.disabled || !systemMenuWin) return;
    const win = systemMenuWin;
    closeWindowSystemMenu();
    runSystemMenuCommand(win, button.dataset.command);
  });
};

const wireWindowControls = (win) => {
  const gameId = win.gameId;
  const menuBar = win.el.querySelector(".game-menu-bar");
  const menus = [...win.el.querySelectorAll(".game-menu")];
  const menuButtons = [...menuBar.querySelectorAll(".game-menu-button")];

  const closeGameMenus = () => {
    menus.forEach((menu) => {
      menu.hidden = true;
    });
    menuButtons.forEach((button) =>
      button.setAttribute("aria-expanded", "false"),
    );
  };

  const openGameMenu = (name, focusFirstItem = false) => {
    const menu = menus.find((item) => item.dataset.gameMenu === name);
    const button = menuButtons.find((item) => item.dataset.gameMenu === name);
    if (!menu || !button) return;
    closeGameMenus();
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    if (focusFirstItem) {
      menu
        .querySelector("button:not(:disabled), input:not(:disabled)")
        ?.focus();
    }
  };

  const switchGameMenu = (currentName, direction) => {
    const currentIndex = menuButtons.findIndex(
      (button) => button.dataset.gameMenu === currentName,
    );
    const next =
      menuButtons[
        (currentIndex + direction + menuButtons.length) % menuButtons.length
      ];
    next.focus();
    openGameMenu(next.dataset.gameMenu, true);
  };

  win.el.addEventListener("pointerdown", () => focusWindow(gameId));

  win.el
    .querySelector(".close-btn")
    .addEventListener("click", () => closeGameWindow(gameId));
  win.el
    .querySelector(".minimize-btn")
    .addEventListener("click", () => minimizeWindow(gameId));
  win.el
    .querySelector(".maximize-btn")
    .addEventListener("click", () => toggleMaximize(gameId));
  win.el.querySelector(".fullscreen-btn").addEventListener("click", () => {
    if (win.player) toggleFullscreen(win.player);
  });
  win.favoriteBtn.addEventListener("click", () => toggleFavorite(gameId));
  win.volumeBtn.addEventListener("click", () => toggleWindowMute(win));
  win.volumeSlider.addEventListener("input", () => {
    setWindowVolume(win, win.volumeSlider.value);
  });

  menuBar.addEventListener("click", (event) => {
    const button = event.target.closest(".game-menu-button");
    if (!button) return;
    const menu = menus.find(
      (item) => item.dataset.gameMenu === button.dataset.gameMenu,
    );
    if (menu.hidden) openGameMenu(button.dataset.gameMenu);
    else closeGameMenus();
  });
  menuBar.addEventListener("keydown", (event) => {
    const button = event.target.closest(".game-menu-button");
    if (!button) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const index = menuButtons.indexOf(button);
      menuButtons[
        (index + direction + menuButtons.length) % menuButtons.length
      ].focus();
    } else if (
      event.key === "ArrowDown" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openGameMenu(button.dataset.gameMenu, true);
    } else if (event.key === "Escape") {
      closeGameMenus();
      button.focus();
    }
  });
  win.el.addEventListener("keydown", (event) => {
    if (!event.altKey || event.ctrlKey || event.metaKey) return;
    const button = menuButtons.find(
      (item) => item.dataset.accessKey === event.key.toLowerCase(),
    );
    if (!button) return;
    event.preventDefault();
    button.focus();
    openGameMenu(button.dataset.gameMenu, true);
  });
  menus.forEach((menu) => {
    menu.addEventListener("keydown", (event) => {
      const items = [
        ...menu.querySelectorAll("button:not(:disabled), input:not(:disabled)"),
      ];
      const index = items.indexOf(document.activeElement);
      if (event.target.matches("input") && event.key.startsWith("Arrow"))
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        const button = menuButtons.find(
          (item) => item.dataset.gameMenu === menu.dataset.gameMenu,
        );
        closeGameMenus();
        button?.focus();
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        items[
          (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
            items.length
        ]?.focus();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        switchGameMenu(
          menu.dataset.gameMenu,
          event.key === "ArrowRight" ? 1 : -1,
        );
      } else {
        const item = menu.querySelector(
          `[data-access-key="${event.key.toLowerCase()}"]:not(:disabled)`,
        );
        if (item) {
          event.preventDefault();
          item.click();
        }
      }
    });
    menu.addEventListener("click", (event) => {
      const item = event.target.closest("[data-game-action]");
      if (!item || item.disabled) return;
      if (item.dataset.gameAction === "volume-popup") {
        closeGameMenus();
        win.volumeSlider.focus();
        return;
      }
      switch (item.dataset.gameAction) {
        case "close":
          closeGameWindow(gameId);
          break;
        case "project":
          openProjectSettings();
          break;
        case "favorite":
          toggleFavorite(gameId);
          break;
        case "mute":
          toggleWindowMute(win);
          break;
        case "fullscreen":
          if (win.player) toggleFullscreen(win.player);
          break;
        case "properties":
          openGameProperties(win);
          break;
      }
      closeGameMenus();
    });
  });
  syncWindowVolumeUI(win);
  updateFavoriteUI(win);
  updateMaximizeButton(win);
  wireDrag(win);
  wireResize(win);
};
