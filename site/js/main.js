"use strict";

// Constants
const DEFAULT_ASPECT_RATIO = 4 / 3;
const WINDOW_CHROME_HEIGHT = 53; // title bar + command bar
const MIN_WINDOW_WIDTH = 340;
const MIN_WINDOW_HEIGHT = 240;
const RESIZE_DIRECTIONS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
const MOVE_SIZE_STEP = 8;
const BOOT_DURATION_MS = 2600;
const WELCOME_DURATION_MS = 1200;
const APP_VERSION = "26.07.28-2";
const offlineManager = window.AstroOffline.createManager({
  currentVersion: APP_VERSION,
});

let bootTimeout = null;
let shutdownTimeout = null;
let loggedIn = false;
let shellInitialized = false;
let suspended = false;
let iconsBuilt = false;
let placesBuilt = false;
let screenSaverTimeout = null;
let screenSaverWired = false;

const gamesList = { ...window.FLASH_GAMES };
const installedGameIds = new Set();
let gameLibrary = null;
let gameLibraryError = null;
let gameLibraryReady = false;
let gameLibraryInitialization = Promise.resolve();

const DISPLAY_SETTINGS_KEY = "displaySettings";
const USER_STORAGE_KEYS = Object.freeze([
  DISPLAY_SETTINGS_KEY,
  "clockOffsetMs",
  "desktopIconPositions",
  "desktopLayoutSettings",
  "favorites",
  "gameStats",
  "gameVolumes",
  "isMuted",
  "runHistory",
  "volume",
]);
const MAX_CUSTOM_WALLPAPER_BYTES = 1024 * 1024;
const DISPLAY_WALLPAPERS = {
  bliss: 'url("../assets/xp/bliss.jpg")',
  blue: "linear-gradient(135deg, #1e5799, #7db9e8)",
  olive: "linear-gradient(135deg, #586b2f, #b7c878)",
};
const DEFAULT_DISPLAY_SETTINGS = Object.freeze({
  theme: "windows-xp",
  wallpaper: "bliss",
  customWallpaper: "",
  position: "stretch",
  backgroundColor: "#3a6ea5",
  appearance: "blue",
  screenSaver: "none",
  screenSaverWait: 10,
  resolution: "auto",
});
const SIMULATED_RESOLUTIONS = Object.freeze({
  "800x600": { width: 800, height: 600 },
  "1024x768": { width: 1024, height: 768 },
});
const TASKBAR_HEIGHT = 30;
let activeMonitorResolution = "auto";

const categoryIcons = {
  Racing: "🏁",
  Action: "💥",
  Adventure: "🗺️",
  Puzzle: "🧩",
  Arcade: "👾",
  Misc: "⭐",
  Favorites: "★",
  "Recently Played": "🕒",
  Other: "🎮",
};

const systemShortcuts = {
  "__my-documents": {
    title: "My Documents",
    icon: "assets/xp/icons/mydocuments.png",
  },
  "__my-computer": {
    title: "My Computer",
    icon: "assets/xp/icons/mycomputer.png",
  },
  "__my-pictures": {
    title: "My Pictures",
    icon: "assets/xp/icons/MyPictures.png",
    desktop: false,
  },
  "__my-music": {
    title: "My Music",
    icon: "assets/xp/icons/MyMusic.png",
    desktop: false,
  },
  "__recycle-bin": {
    title: "Recycle Bin",
    icon: "assets/xp/icons/recycler-empty.png",
  },
  "__display-properties": {
    title: "Display Properties",
    icon: "assets/xp/icons/mycomputer.png",
    desktop: false,
  },
  __notepad: {
    title: "Notepad",
    glyph: "notepad",
    desktop: false,
  },
  __search: {
    title: "Search Results",
    icon: "assets/xp/icons/Search.png",
    desktop: false,
  },
  "__astro-settings": {
    title: "Astro Flash Settings",
    icon: "assets/xp/icons/ControlPanel.png",
  },
  "__internet-games": {
    title: "Internet Games",
    icon: "assets/xp/icons/Programs.png",
  },
};

// ============================================
// Helper Functions
// ============================================

const formatGameTitle = (gameId) =>
  systemShortcuts[gameId]?.title ||
  gamesList[gameId]?.title ||
  gameId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const getGameIcon = (gameId) =>
  categoryIcons[gamesList[gameId]?.category] || categoryIcons["Other"];

const createGameIconElement = (gameId, className) => {
  const icon = document.createElement("span");
  icon.className = className;

  const imagePath = systemShortcuts[gameId]?.icon || gamesList[gameId]?.icon;
  if (imagePath) {
    const image = document.createElement("img");
    image.className = "game-icon-image";
    image.src = imagePath;
    image.alt = "";
    // A native image drag would cancel the pointer stream used by the
    // desktop icon drag, so the browser must not start one.
    image.draggable = false;
    icon.classList.add("has-image");
    if (systemShortcuts[gameId]) {
      icon.classList.add("system-icon");
    }
    if (
      gameId === "__recycle-bin" &&
      window.VirtualFS?.getChildren(window.VirtualFS.RECYCLE_BIN).length
    ) {
      icon.classList.add("recycle-full");
    }
    icon.appendChild(image);
  } else {
    const systemGlyph = systemShortcuts[gameId]?.glyph;
    if (systemGlyph) {
      icon.classList.add("system-glyph", `system-glyph-${systemGlyph}`);
    } else {
      icon.textContent = getGameIcon(gameId);
    }
  }

  return icon;
};

const getHashGameId = () => {
  const id = window.location.hash.slice(1);
  return id && gamesList[id] ? id : null;
};

const readJsonStorage = (key, fallbackValue, validator) => {
  const rawValue = localStorage.getItem(key);
  if (!rawValue) {
    return fallbackValue;
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    if (typeof validator === "function" && !validator(parsedValue)) {
      return fallbackValue;
    }
    return parsedValue;
  } catch (error) {
    console.error(`Error parsing ${key} from localStorage:`, error);
    return fallbackValue;
  }
};

const writeJsonStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error storing ${key} in localStorage:`, error);
  }
};

const isDisplaySettings = (value) =>
  value &&
  typeof value === "object" &&
  ["windows-xp", "classic", "olive"].includes(value.theme) &&
  Object.hasOwn(DISPLAY_WALLPAPERS, value.wallpaper) &&
  typeof value.customWallpaper === "string" &&
  (value.customWallpaper === "" ||
    (/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(
      value.customWallpaper,
    ) &&
      value.customWallpaper.length <= MAX_CUSTOM_WALLPAPER_BYTES * 1.4)) &&
  ["center", "tile", "stretch"].includes(value.position) &&
  /^#[0-9a-f]{6}$/i.test(value.backgroundColor) &&
  ["blue", "olive", "silver"].includes(value.appearance) &&
  ["none", "marquee", "stars"].includes(value.screenSaver) &&
  Number.isInteger(value.screenSaverWait) &&
  value.screenSaverWait >= 1 &&
  value.screenSaverWait <= 60 &&
  ["auto", "800x600", "1024x768"].includes(value.resolution);

const getDisplaySettings = () => ({
  ...DEFAULT_DISPLAY_SETTINGS,
  ...readJsonStorage(DISPLAY_SETTINGS_KEY, {}, isDisplaySettings),
});

const saveDisplaySettings = (settings) => {
  try {
    localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error("Error storing display settings:", error);
    return false;
  }
};

const displayBackground = (settings) =>
  settings.customWallpaper
    ? `url("${settings.customWallpaper}")`
    : DISPLAY_WALLPAPERS[settings.wallpaper];

const getSimulatedMonitorSize = (resolution = activeMonitorResolution) => {
  const requested = SIMULATED_RESOLUTIONS[resolution];
  if (!requested)
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      limited: false,
    };
  return {
    width: Math.min(requested.width, window.innerWidth),
    height: Math.min(requested.height, window.innerHeight),
    limited:
      requested.width > window.innerWidth ||
      requested.height > window.innerHeight,
  };
};

// The selected XP resolution becomes a real, bounded monitor inside the
// browser. On a smaller browser it is honestly limited to the available
// viewport instead of pretending that off-screen space is usable.
const applySimulatedMonitor = (resolution, { reflow = true } = {}) => {
  activeMonitorResolution = resolution;
  const desktop = document.getElementById("desktop");
  const taskbar = document.getElementById("taskbar");
  if (!desktop || !taskbar) return;
  if (resolution === "auto") {
    desktop.style.removeProperty("width");
    desktop.style.removeProperty("height");
    desktop.style.removeProperty("left");
    desktop.style.removeProperty("top");
    taskbar.style.removeProperty("width");
    taskbar.style.removeProperty("left");
    taskbar.style.removeProperty("bottom");
    desktop.dataset.monitorResolution = "auto";
    delete desktop.dataset.monitorLimited;
  } else {
    const monitor = getSimulatedMonitorSize(resolution);
    const left = Math.max(
      0,
      Math.round((window.innerWidth - monitor.width) / 2),
    );
    const top = Math.max(
      0,
      Math.round((window.innerHeight - monitor.height) / 2),
    );
    desktop.style.width = `${monitor.width}px`;
    desktop.style.height = `${Math.max(1, monitor.height - TASKBAR_HEIGHT)}px`;
    desktop.style.left = `${left}px`;
    desktop.style.top = `${top}px`;
    taskbar.style.width = `${monitor.width}px`;
    taskbar.style.left = `${left}px`;
    taskbar.style.bottom = `${Math.max(0, window.innerHeight - top - monitor.height)}px`;
    desktop.dataset.monitorResolution = resolution;
    desktop.dataset.monitorLimited = String(monitor.limited);
  }
  if (reflow && iconsBuilt) layoutDesktopIcons();
  if (reflow && loggedIn) {
    keepWindowsInWorkArea();
    renderTaskButtons();
  }
};

const applyDisplaySettings = (settings) => {
  const desktop = document.getElementById("desktop");
  if (!desktop) return;
  desktop.style.setProperty(
    "--desktop-background",
    displayBackground(settings),
  );
  desktop.style.setProperty("--desktop-color", settings.backgroundColor);
  desktop.dataset.wallpaperPosition = settings.position;
  document.documentElement.dataset.xpAppearance = settings.appearance;
  applySimulatedMonitor(settings.resolution);
  scheduleScreenSaver(settings);
};

const scheduleScreenSaver = (settings = getDisplaySettings()) => {
  clearTimeout(screenSaverTimeout);
  const desktop = document.getElementById("desktop");
  const saver = document.getElementById("screen-saver-overlay");
  if (!desktop || !saver) return;
  saver.hidden = true;
  saver.dataset.saver = settings.screenSaver;
  if (settings.screenSaver === "none" || !loggedIn) return;
  screenSaverTimeout = setTimeout(
    () => {
      saver.hidden = false;
    },
    settings.screenSaverWait * 60 * 1000,
  );
};

const setupScreenSaver = () => {
  if (screenSaverWired) return;
  screenSaverWired = true;
  const overlay = document.createElement("div");
  overlay.id = "screen-saver-overlay";
  overlay.hidden = true;
  overlay.setAttribute("aria-label", "Screen saver");
  document.getElementById("desktop")?.appendChild(overlay);
  const wake = () => scheduleScreenSaver();
  ["pointerdown", "keydown", "mousemove", "touchstart"].forEach((eventName) => {
    document.addEventListener(eventName, wake, { passive: true });
  });
};

const getFavorites = () => readJsonStorage("favorites", [], Array.isArray);

const setFavorites = (favorites) => {
  const normalizedFavorites = Array.isArray(favorites) ? favorites : [];
  writeJsonStorage("favorites", normalizedFavorites);
};

const getGameStats = () =>
  readJsonStorage(
    "gameStats",
    {},
    (stats) => stats && typeof stats === "object",
  );

const getGameVolume = (gameId) => {
  const gameVolumes = readJsonStorage(
    "gameVolumes",
    {},
    (volumes) => volumes && typeof volumes === "object",
  );

  if (gameId in gameVolumes) {
    return {
      volume: parseInt(gameVolumes[gameId].volume, 10),
      isMuted: gameVolumes[gameId].isMuted,
    };
  }
  // Fall back to global settings if no game-specific settings exist
  return {
    volume: parseInt(localStorage.getItem("volume") || "100", 10),
    isMuted: localStorage.getItem("isMuted") === "true",
  };
};

const setGameVolume = (gameId, volume, isMuted) => {
  const gameVolumes = readJsonStorage(
    "gameVolumes",
    {},
    (volumes) => volumes && typeof volumes === "object",
  );
  gameVolumes[gameId] = {
    volume: volume,
    isMuted: isMuted,
  };
  writeJsonStorage("gameVolumes", gameVolumes);
};

const normalizeGameVolume = (gameId) => {
  if (!gameId) {
    return 0;
  }

  const { volume, isMuted } = getGameVolume(gameId);
  const numericVolume = parseInt(volume, 10);
  const clampedVolume = Number.isFinite(numericVolume)
    ? Math.min(Math.max(numericVolume, 0), 100)
    : 100;

  return isMuted ? 0 : clampedVolume / 100;
};

const setPlayerVolume = (player, type, normalizedVolume) => {
  if (!player) {
    return;
  }

  const resolvedVolume = Number.isFinite(normalizedVolume)
    ? normalizedVolume
    : 0;
  const resolvedType =
    type || (player instanceof HTMLIFrameElement ? "iframe" : "swf");

  if (resolvedType === "iframe") {
    player.contentWindow?.postMessage(
      {
        type: "setVolume",
        volume: resolvedVolume,
      },
      window.location.origin,
    );
  } else {
    try {
      player.volume = resolvedVolume;
    } catch (error) {
      console.error("Error setting SWF volume:", error);
    }
  }
};

const toggleFullscreen = (element) => {
  if (!document.fullscreenElement) {
    element.requestFullscreen().catch((err) => {
      console.error(`Error attempting to enable fullscreen: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
};

const setAccessKeyText = (element, label) => {
  const { text, key } = XPDialogs.parseAccessKey(label);
  const marker = label.indexOf("&");
  element.replaceChildren();
  if (!key || marker < 0) {
    element.textContent = text;
    return { text, key };
  }
  element.append(label.slice(0, marker));
  const underlined = document.createElement("span");
  underlined.className = "menu-accesskey";
  underlined.textContent = label[marker + 1];
  element.append(underlined, label.slice(marker + 2));
  return { text, key };
};

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

// Keep at least part of the title bar reachable inside the work area,
// matching how Windows XP constrains window positions.
const clampWindowPosition = (win, left, top) => {
  const { width: desktopWidth, height: desktopHeight } = getDesktopSize();
  return {
    left: Math.min(Math.max(left, 60 - win.el.offsetWidth), desktopWidth - 60),
    top: Math.min(Math.max(top, 0), desktopHeight - 28),
  };
};

const keepWindowsInWorkArea = () => {
  const { width: desktopWidth, height: desktopHeight } = getDesktopSize();
  if (desktopWidth === 0 || desktopHeight === 0) return;

  openWindows.forEach((win) => {
    if (win.maximized) return;
    const el = win.el;
    el.style.width = `${Math.min(el.offsetWidth, desktopWidth)}px`;
    el.style.height = `${Math.min(el.offsetHeight, desktopHeight)}px`;
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
    makeMenuItem("&Properties", "properties", { disabled: true }),
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
  const config = {
    url:
      game.url ||
      (game.spoofUrl ? `${game.spoofUrl}/main.swf` : `swf/${gameId}/main.swf`),
    base: game.base || (game.spoofUrl ? `${game.spoofUrl}/` : `swf/${gameId}/`),
    letterbox: "on",
    scale: "showAll",
    forceScale: true,
    openUrlMode: "confirm",
    showSwfDownload: true,
    frameRate: game.frameRate,
    volume: gameId === focusedGameId ? normalizeGameVolume(gameId) : 0,
    allowScriptAccess: false,
    autoplay: "on",
    unmuteOverlay: "hidden",
  };

  player.load(config);
};

const loadIframe = (gameId, win) => {
  const player = document.createElement("iframe");
  player.allow = "fullscreen";
  player.src = `iframe/${gameId}/`;
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

const focusWindow = (gameId) => {
  const win = openWindows.get(gameId);
  if (!win) return;

  focusedGameId = gameId;
  win.needsAttention = false;
  win.lastUsed = Date.now();
  win.zIndex = ++zIndexCounter;
  win.el.style.zIndex = win.zIndex;

  openWindows.forEach((w, id) => {
    w.el.classList.toggle("active", id === gameId);
  });

  applyFocusVolumes();
  syncWindowVolumeUI(win);
  renderTaskButtons();
  updateDocumentTitle();

  if (gamesList[gameId] && window.location.hash !== `#${gameId}`) {
    history.replaceState(null, "", `#${gameId}`);
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

const minimizeWindow = (gameId) => {
  const win = openWindows.get(gameId);
  if (!win || win.minimized) return;

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

const restoreWindow = (gameId) => {
  const win = openWindows.get(gameId);
  if (!win || !win.minimized) return;

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

const toggleMaximize = (gameId) => {
  const win = openWindows.get(gameId);
  if (!win) return;

  if (!win.maximized) {
    win.prevRect = {
      left: win.el.style.left,
      top: win.el.style.top,
      width: win.el.style.width,
      height: win.el.style.height,
    };
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
  }
  updateMaximizeButton(win);
  focusWindow(gameId);
};

const closeGameWindow = (gameId, { skipBeforeClose = false } = {}) => {
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

    const offsetX = win.el.offsetLeft - e.clientX;
    const offsetY = win.el.offsetTop - e.clientY;

    const onMove = (ev) => {
      const position = clampWindowPosition(
        win,
        ev.clientX + offsetX,
        ev.clientY + offsetY,
      );
      win.el.style.left = `${position.left}px`;
      win.el.style.top = `${position.top}px`;
    };

    const onUp = () => {
      bar.removeEventListener("pointermove", onMove);
      bar.removeEventListener("pointerup", onUp);
      bar.removeEventListener("pointercancel", onUp);
      if (restoredFromMaximized) {
        // The dragged position becomes the new restore geometry.
        win.prevRect = {
          left: win.el.style.left,
          top: win.el.style.top,
          width: win.el.style.width,
          height: win.el.style.height,
        };
      }
    };

    try {
      bar.setPointerCapture(e.pointerId);
    } catch (error) {
      /* pointer capture unsupported */
    }

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

const applyResize = (win, direction, start, deltaX, deltaY) => {
  const { width: desktopWidth, height: desktopHeight } = getDesktopSize();
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
      const start = {
        x: e.clientX,
        y: e.clientY,
        left: win.el.offsetLeft,
        top: win.el.offsetTop,
        width: win.el.offsetWidth,
        height: win.el.offsetHeight,
      };

      const onMove = (ev) => {
        applyResize(
          win,
          direction,
          start,
          ev.clientX - start.x,
          ev.clientY - start.y,
        );
      };

      const onUp = () => {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
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

const createSystemWindowContent = (shortcutId, win) => {
  const content = document.createElement("div");
  content.className = "explorer-content";

  if (shortcutId === "__astro-settings") {
    content.className = "project-settings-content";
    return content;
  }

  if (shortcutId === "__display-properties") {
    content.className = "display-properties-content";
    content.innerHTML = `
            <div class="display-tabs" role="tablist" aria-label="Display Properties">
                <button type="button" role="tab" id="display-tab-themes" aria-controls="display-panel-themes" aria-selected="false" tabindex="-1">Themes</button>
                <button type="button" role="tab" id="display-tab-desktop" aria-controls="display-panel-desktop" aria-selected="true">Desktop</button>
                <button type="button" role="tab" id="display-tab-saver" aria-controls="display-panel-saver" aria-selected="false" tabindex="-1">Screen Saver</button>
                <button type="button" role="tab" id="display-tab-appearance" aria-controls="display-panel-appearance" aria-selected="false" tabindex="-1">Appearance</button>
                <button type="button" role="tab" id="display-tab-settings" aria-controls="display-panel-settings" aria-selected="false" tabindex="-1">Settings</button>
            </div>
            <div class="display-panel active" id="display-panel-desktop" role="tabpanel" aria-labelledby="display-tab-desktop">
                <div class="display-preview" aria-label="Desktop preview">
                    <div class="display-preview-surface"><span>start</span></div>
                </div>
                <label class="display-wallpaper-label" for="display-wallpaper">Background:</label>
                <select id="display-wallpaper" aria-label="Desktop background">
                    <option value="bliss">Bliss</option>
                    <option value="blue">Windows Blue</option>
                    <option value="olive">Olive Green</option>
                </select>
                <div class="display-form-row">
                    <label for="display-position">Position:</label>
                    <select id="display-position"><option value="center">Center</option><option value="tile">Tile</option><option value="stretch">Stretch</option></select>
                </div>
                <div class="display-form-row">
                    <label for="display-color">Color:</label>
                    <input id="display-color" type="color" value="#3a6ea5">
                </div>
                <label class="display-upload" for="display-image">Browse for a picture…</label>
                <input id="display-image" type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden>
                <button type="button" class="display-clear-image" hidden>Remove custom picture</button>
                <p class="display-status" aria-live="polite"></p>
            </div>
            <div class="display-panel" id="display-panel-themes" role="tabpanel" aria-labelledby="display-tab-themes" hidden>
                <fieldset><legend>Theme</legend>
                    <label for="display-theme">Choose a theme:</label>
                    <select id="display-theme"><option value="windows-xp">Windows XP</option><option value="classic">Windows Classic</option><option value="olive">Windows XP Olive</option></select>
                    <p>A theme changes the color scheme and suggested desktop background.</p>
                </fieldset>
            </div>
            <div class="display-panel" id="display-panel-saver" role="tabpanel" aria-labelledby="display-tab-saver" hidden>
                <fieldset><legend>Screen saver</legend>
                    <label for="display-saver">Screen saver:</label>
                    <select id="display-saver"><option value="none">(None)</option><option value="marquee">Marquee</option><option value="stars">Starfield</option></select>
                    <label class="display-form-row" for="display-saver-wait">Wait <input id="display-saver-wait" type="number" min="1" max="60"> minutes</label>
                    <div class="screen-saver-preview" aria-label="Screen saver preview"></div>
                </fieldset>
            </div>
            <div class="display-panel" id="display-panel-appearance" role="tabpanel" aria-labelledby="display-tab-appearance" hidden>
                <fieldset><legend>Windows and buttons</legend>
                    <label for="display-appearance">Color scheme:</label>
                    <select id="display-appearance"><option value="blue">Default (blue)</option><option value="olive">Olive green</option><option value="silver">Silver</option></select>
                    <div class="appearance-preview"><span>Active Window</span><button type="button" tabindex="-1">×</button></div>
                </fieldset>
            </div>
            <div class="display-panel" id="display-panel-settings" role="tabpanel" aria-labelledby="display-tab-settings" hidden>
                <fieldset><legend>Display</legend>
                    <p>Monitor: Astro Flash Display</p>
                    <label for="display-resolution">Screen resolution:</label>
                    <select id="display-resolution"><option value="auto">Use browser size</option><option value="800x600">800 by 600 pixels</option><option value="1024x768">1024 by 768 pixels</option></select>
                    <div class="display-resolution-preview" aria-label="Resolution preview"><span></span></div>
                    <p class="display-resolution-value"></p>
                    <p class="display-settings-note">Changes are previewed on the simulated monitor. The monitor is limited to the available browser viewport when necessary.</p>
                </fieldset>
            </div>
            <div class="display-dialog-buttons">
                <button type="button" data-display-action="ok">OK</button>
                <button type="button" data-display-action="cancel">Cancel</button>
                <button type="button" data-display-action="apply" disabled>Apply</button>
            </div>
        `;
    return content;
  }

  if (shortcutId === "__internet-games") {
    content.className = "internet-games-content";
    content.innerHTML = `
      <header class="internet-games-header">
        <div>
          <h1>Internet Games</h1>
          <p>Find and install playable Flash games from Flashpoint Archive.</p>
        </div>
        <img src="assets/xp/icons/Programs.png" alt="">
      </header>
      <div class="internet-games-tabs" role="tablist" aria-label="Internet Games">
        <button type="button" role="tab" aria-selected="true" data-internet-tab="browse">Find Games</button>
        <button type="button" role="tab" aria-selected="false" tabindex="-1" data-internet-tab="installed">Installed</button>
      </div>
      <section class="internet-games-panel" data-internet-panel="browse">
        <form class="internet-games-search" role="search">
          <label for="internet-games-query">Search Flashpoint:</label>
          <span>
            <input id="internet-games-query" class="xp-input" type="search" maxlength="100" autocomplete="off" placeholder="Try Bike Mania">
            <button class="xp-btn default" type="submit">Search</button>
          </span>
        </form>
        <p class="internet-games-status" aria-live="polite">Enter a game title to search the archive.</p>
        <div class="internet-games-results" aria-label="Game results"></div>
      </section>
      <section class="internet-games-panel" data-internet-panel="installed" hidden>
        <p class="internet-games-installed-status" aria-live="polite"></p>
        <div class="internet-games-installed"></div>
      </section>
    `;
    return content;
  }

  if (shortcutId === "__search") {
    content.className = "search-companion-content";
    content.innerHTML = `
            <aside class="search-companion-panel">
                <h2>Search Companion</h2>
                <label for="search-filename">All or part of the file name:</label>
                <input id="search-filename" class="xp-input" type="search" autocomplete="off">
                <label for="search-location">Look in:</label>
                <select id="search-location" class="xp-input"></select>
                <label for="search-type">What do you want to find?</label>
                <select id="search-type" class="xp-input">
                    <option value="all">All files and folders</option>
                    <option value="files">Files</option>
                    <option value="folders">Folders</option>
                    <option value="games">Games</option>
                    <option value="applications">Applications</option>
                </select>
                <button type="button" class="xp-btn default" data-search-action="search">&nbsp;Search</button>
            </aside>
            <main class="search-results-pane">
                <h2>Search Results</h2>
                <p class="search-results-status" aria-live="polite">Enter a name and click Search.</p>
                <div class="search-results-list" role="listbox" aria-label="Search results"></div>
            </main>
        `;
    return content;
  }

  const taskTitles = {
    "__my-documents": "File and Folder Tasks",
    "__my-pictures": "Picture Tasks",
    "__my-music": "Music Tasks",
    "__my-computer": "System Tasks",
    "__recycle-bin": "Recycle Bin Tasks",
  };

  const sidebar = document.createElement("aside");
  sidebar.className = "explorer-sidebar";

  const tasksSection = document.createElement("section");
  const tasksTitle = document.createElement("h3");
  tasksTitle.innerHTML = `<button type="button" class="explorer-section-toggle" aria-expanded="true"><span class="explorer-section-label">${taskTitles[shortcutId]}</span><span aria-hidden="true">⌃</span></button>`;
  const tasksBody = document.createElement("div");
  tasksBody.className = "explorer-section-body";
  tasksSection.append(tasksTitle, tasksBody);
  const appendSidebarAction = (container, label, icon, onClick, place = "") => {
    const button = document.createElement("button");
    button.type = "button";
    if (place) button.dataset.place = place;
    const image = document.createElement("img");
    image.src = `assets/xp/icons/${icon}`;
    image.alt = "";
    const text = document.createElement("span");
    text.textContent = label;
    button.append(image, text);
    if (onClick) button.addEventListener("click", onClick);
    container.appendChild(button);
    return button;
  };

  if (shortcutId === "__recycle-bin") {
    const emptyBin = document.createElement("button");
    emptyBin.type = "button";
    emptyBin.className = "recycle-task";
    emptyBin.textContent = "Empty Recycle Bin";
    emptyBin.addEventListener("click", () => {
      const count = fs.getChildren(fs.RECYCLE_BIN).length;
      if (!count) return;
      const single = count === 1;
      XPDialogs.confirm(
        single
          ? "Are you sure you want to delete this item?"
          : `Are you sure you want to delete these ${count} items?`,
        single ? "Confirm File Delete" : "Confirm Multiple File Delete",
        "warning",
      ).then((yes) => {
        if (!yes) return;
        try {
          fileOps.emptyRecycleBin();
        } catch (error) {
          console.error(error);
        }
      });
    });

    const restoreAll = document.createElement("button");
    restoreAll.type = "button";
    restoreAll.className = "recycle-task";
    restoreAll.textContent = "Restore all items";
    restoreAll.addEventListener("click", () => {
      fs.getChildren(fs.RECYCLE_BIN).forEach((node) => {
        try {
          fileOps.restore([node.id]);
        } catch (error) {
          console.error(error);
        }
      });
    });

    tasksBody.append(emptyBin, restoreAll);
    const restoreSelected = document.createElement("button");
    restoreSelected.type = "button";
    restoreSelected.className = "recycle-task";
    restoreSelected.textContent = "Restore selected items";
    restoreSelected.addEventListener("click", () => {
      const ids = selectedExplorerNodes(win);
      if (ids.length) fileOps.restore(ids);
    });
    const deleteSelected = document.createElement("button");
    deleteSelected.type = "button";
    deleteSelected.className = "recycle-task";
    deleteSelected.textContent = "Delete selected items";
    deleteSelected.addEventListener("click", () => {
      const ids = selectedExplorerNodes(win);
      if (!ids.length) return;
      XPDialogs.confirm(
        "Are you sure you want to permanently delete the selected items?",
        "Confirm File Delete",
        "warning",
      ).then((yes) => yes && fileOps.permanentlyDelete(ids));
    });
    tasksBody.append(restoreSelected, deleteSelected);
  } else {
    [
      [
        "View System Information",
        "explorerproperties.png",
        openProjectSettings,
      ],
      ["Add or remove programs", "Programs.png", openControlPanel],
      ["Change a setting", "ControlPanel.png", openControlPanel],
    ].forEach(([label, icon, action]) =>
      appendSidebarAction(tasksBody, label, icon, action),
    );
  }

  const placesSection = document.createElement("section");
  placesSection.innerHTML =
    '<h3><button type="button" class="explorer-section-toggle" aria-expanded="true">Other Places<span aria-hidden="true">⌃</span></button></h3>';
  const placesBody = document.createElement("div");
  placesBody.className = "explorer-section-body";
  if (shortcutId === "__my-computer") {
    appendSidebarAction(
      placesBody,
      "My Computer",
      "MyComputer.png",
      () => navigateExplorer(win, fs.MY_COMPUTER),
      "computer",
    );
    appendSidebarAction(
      placesBody,
      "My Pictures",
      "MyPictures.png",
      () => navigateExplorer(win, fs.MY_PICTURES),
      "pictures",
    );
    appendSidebarAction(
      placesBody,
      "My Music",
      "MyMusic.png",
      () => navigateExplorer(win, fs.MY_MUSIC),
      "music",
    );
    appendSidebarAction(
      placesBody,
      "My Network Places",
      "MyNetworkPlaces.png",
      openNetworkStatus,
      "network",
    );
  } else {
    appendSidebarAction(
      placesBody,
      "My Computer",
      "MyComputer.png",
      () => navigateExplorer(win, fs.MY_COMPUTER),
      "computer",
    );
    appendSidebarAction(
      placesBody,
      "My Documents",
      "mydocuments.png",
      () => navigateExplorer(win, fs.MY_DOCUMENTS),
      "documents",
    );
    appendSidebarAction(
      placesBody,
      "Control Panel",
      "ControlPanel.png",
      openControlPanel,
      "control-panel",
    );
  }
  placesSection.appendChild(placesBody);

  sidebar.append(tasksSection, placesSection);
  const treeSection = document.createElement("section");
  treeSection.className = "explorer-tree-section";
  treeSection.innerHTML = "<h3>Folders</h3>";
  const tree = document.createElement("div");
  tree.className = "explorer-tree";
  tree.setAttribute("role", "tree");
  treeSection.appendChild(tree);
  sidebar.appendChild(treeSection);
  sidebar.querySelectorAll(".explorer-section-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const section = toggle.closest("section");
      const collapsed = section.classList.toggle("collapsed");
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.querySelector("[aria-hidden]").textContent = collapsed ? "⌄" : "⌃";
    });
  });
  const main = document.createElement("main");
  main.className = "explorer-main";

  const heading = document.createElement("h2");
  main.appendChild(heading);

  const items = document.createElement("div");
  items.className = "explorer-items";
  main.appendChild(items);

  const chrome = document.createElement("div");
  chrome.className = "explorer-chrome";
  chrome.innerHTML = `
        <div class="explorer-menu-row">
            <div class="explorer-menu-bar" role="menubar"><button data-explorer-menu="file">File</button><button data-explorer-menu="edit">Edit</button><button data-explorer-menu="view">View</button><button data-explorer-menu="favorites">Favorites</button><button data-explorer-menu="tools">Tools</button><button data-explorer-menu="help">Help</button></div>
            <div class="explorer-brand" aria-hidden="true"><img src="assets/xp/ms.png" alt=""></div>
        </div>
        <div class="explorer-toolbar">
            <button data-explorer-action="back"><img src="assets/xp/icons/Back.png" alt=""> Back <span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
            <button data-explorer-action="forward" aria-label="Forward"><img src="assets/xp/icons/Forward.png" alt=""><span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
            <button data-explorer-action="up" aria-label="Up"><img src="assets/xp/icons/Up.png" alt=""></button>
            <span class="explorer-toolbar-separator" aria-hidden="true"></span>
            <button data-explorer-action="search"><img src="assets/xp/icons/Search.png" alt=""> Search</button>
            <button data-explorer-action="folders" aria-pressed="false"><img src="assets/xp/icons/FolderView.png" alt=""> Folders</button>
            <span class="explorer-toolbar-separator" aria-hidden="true"></span>
            <button data-explorer-action="view" aria-label="Views"><img src="assets/xp/icons/FolderView-Classic.png" alt=""><span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
        </div>
        <label class="explorer-address"><span>Address</span><span class="explorer-address-field"><img src="assets/xp/icons/MyComputer.png" alt=""><input type="text" aria-label="Address"></span><button type="button" data-explorer-action="go" aria-label="Go"><img src="assets/xp/icons/Go.png" alt=""></button></label>
    `;
  const body = document.createElement("div");
  body.className = "explorer-body";
  body.append(sidebar, main);
  const status = document.createElement("div");
  status.className = "explorer-status";
  content.append(chrome, body, status);
  const explorerMenu = document.createElement("div");
  explorerMenu.className = "game-menu explorer-menu";
  explorerMenu.setAttribute("role", "menu");
  explorerMenu.hidden = true;
  chrome.appendChild(explorerMenu);
  const explorerMenuLabels = {
    file: "&File",
    edit: "&Edit",
    view: "&View",
    favorites: "F&avorites",
    tools: "&Tools",
    help: "&Help",
  };
  const explorerMenuButtons = [
    ...chrome.querySelectorAll("[data-explorer-menu]"),
  ];
  explorerMenuButtons.forEach((button) => {
    const { key } = setAccessKeyText(
      button,
      explorerMenuLabels[button.dataset.explorerMenu],
    );
    button.dataset.accessKey = key;
    button.setAttribute("role", "menuitem");
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
  });
  const showExplorerMenu = (name, button) => {
    const selected = selectedExplorerNodes(win);
    const protectedSelection = selected.some((id) => fs.isProtected(id));
    const writable = ![fs.RECYCLE_BIN, fs.MY_COMPUTER].includes(
      win.currentFolderId,
    );
    const actions = {
      file: [
        ["New Folder", "new", !writable],
        ["Close", "close"],
      ],
      edit: [
        ["Cut", "cut", !selected.length || protectedSelection],
        ["Copy", "copy", !selected.length],
        ["Paste", "paste", !writable || !fileOps.canPaste(win.currentFolderId)],
        ["Delete", "delete", !selected.length || protectedSelection],
        ["Rename", "rename", selected.length !== 1 || protectedSelection],
      ],
      view: [
        ["Thumbnails", "thumbnails"],
        ["Tiles", "tiles"],
        ["Icons", "icons"],
        ["List", "list"],
        ["Details", "details"],
      ],
      favorites: [["My Documents", "documents"]],
      tools: [["Properties", "properties", selected.length !== 1]],
      help: [["About Astro Flash", "about"]],
    }[name];
    explorerMenu.replaceChildren();
    actions.forEach(([label, action, disabled]) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "game-menu-item";
      item.textContent = label;
      item.dataset.explorerCommand = action;
      item.disabled = !!disabled;
      item.setAttribute("role", "menuitem");
      explorerMenu.appendChild(item);
    });
    explorerMenu.hidden = false;
    explorerMenuButtons.forEach((entry) =>
      entry.setAttribute("aria-expanded", String(entry === button)),
    );
    explorerMenu.style.left = `${button.offsetLeft}px`;
    explorerMenu.style.top = `${button.offsetTop + button.offsetHeight}px`;
    explorerMenu.querySelector("button:not(:disabled)")?.focus();
  };
  chrome.addEventListener("click", (event) => {
    const menuButton = event.target.closest("[data-explorer-menu]");
    const menuName = menuButton?.dataset.explorerMenu;
    if (menuName) {
      showExplorerMenu(menuName, menuButton);
      return;
    }
    const commandButton = event.target.closest("[data-explorer-command]");
    const command = commandButton?.dataset.explorerCommand;
    if (command) {
      const selected = selectedExplorerNodes(win);
      if (
        command === "new" &&
        ![fs.RECYCLE_BIN, fs.MY_COMPUTER].includes(win.currentFolderId)
      )
        fileOps.createFolder(win.currentFolderId, "New Folder");
      if (command === "close") closeGameWindow(win.gameId);
      if (command === "cut") fileOps.cut(selected);
      if (command === "copy") fileOps.copy(selected);
      if (
        command === "paste" &&
        ![fs.RECYCLE_BIN, fs.MY_COMPUTER].includes(win.currentFolderId)
      )
        pasteIntoFolder(win.currentFolderId);
      if (command === "delete") confirmRecycleDelete(selected);
      if (command === "rename") {
        const name = window.prompt("Rename", fs.getNode(selected[0]).name);
        if (name !== null) fileOps.rename(selected[0], name);
      }
      if (
        ["thumbnails", "tiles", "icons", "list", "details"].includes(command)
      ) {
        win.explorerView = command;
        renderExplorerItems(win);
      }
      if (command === "documents") openSystemWindow("__my-documents");
      if (command === "properties") XPDialogs.properties(selected[0]);
      if (command === "about") openProjectSettings();
      explorerMenu.hidden = true;
      explorerMenuButtons.forEach((button) =>
        button.setAttribute("aria-expanded", "false"),
      );
      return;
    }
    const actionButton = event.target.closest("[data-explorer-action]");
    const action = actionButton?.dataset.explorerAction;
    if (!action) return;
    if (action === "back") explorerBack(win);
    if (action === "forward") explorerForward(win);
    if (action === "up") {
      const parent = fs.getParent(win.currentFolderId);
      if (parent) navigateExplorer(win, parent.id);
    }
    if (action === "folders") {
      const foldersVisible = content.classList.toggle("folders-visible");
      actionButton.setAttribute("aria-pressed", String(foldersVisible));
    }
    if (action === "view") {
      const views = ["tiles", "thumbnails", "icons", "list", "details"];
      win.explorerView =
        views[(views.indexOf(win.explorerView || "tiles") + 1) % views.length];
      renderExplorerItems(win);
    }
    if (action === "search") openSearchDialog();
    if (action === "go") {
      const input = chrome.querySelector(".explorer-address input");
      const destination = fs.resolvePath(input.value);
      if (destination && fs.getNode(destination)?.type === "folder")
        navigateExplorer(win, destination);
      else input.value = fs.getPath(win.currentFolderId);
    }
  });
  chrome.querySelector("input").addEventListener("change", (event) => {
    const destination = fs.resolvePath(event.target.value);
    if (destination && fs.getNode(destination)?.type === "folder")
      navigateExplorer(win, destination);
    else event.target.value = fs.getPath(win.currentFolderId);
  });
  chrome.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const activeButton = explorerMenuButtons.find(
        (button) => button.getAttribute("aria-expanded") === "true",
      );
      explorerMenu.hidden = true;
      explorerMenuButtons.forEach((button) =>
        button.setAttribute("aria-expanded", "false"),
      );
      activeButton?.focus();
      return;
    }
    const heading = document.activeElement?.closest?.("[data-explorer-menu]");
    if (event.altKey) {
      const target = explorerMenuButtons.find(
        (button) => button.dataset.accessKey === event.key.toLowerCase(),
      );
      if (target) {
        event.preventDefault();
        showExplorerMenu(target.dataset.explorerMenu, target);
      }
      return;
    }
    if (
      heading &&
      ["ArrowLeft", "ArrowRight", "ArrowDown", "Home", "End"].includes(
        event.key,
      )
    ) {
      event.preventDefault();
      const index = explorerMenuButtons.indexOf(heading);
      const target =
        event.key === "Home"
          ? explorerMenuButtons[0]
          : event.key === "End"
            ? explorerMenuButtons.at(-1)
            : event.key === "ArrowDown"
              ? heading
              : explorerMenuButtons[
                  (index +
                    (event.key === "ArrowRight" ? 1 : -1) +
                    explorerMenuButtons.length) %
                    explorerMenuButtons.length
                ];
      if (event.key === "ArrowDown")
        showExplorerMenu(heading.dataset.explorerMenu, heading);
      else {
        target.focus();
        showExplorerMenu(target.dataset.explorerMenu, target);
      }
      return;
    }
    const menuItems = [
      ...explorerMenu.querySelectorAll("button:not(:disabled)"),
    ];
    if (
      !explorerMenu.hidden &&
      ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
    ) {
      event.preventDefault();
      const index = menuItems.indexOf(document.activeElement);
      const target =
        event.key === "Home"
          ? menuItems[0]
          : event.key === "End"
            ? menuItems.at(-1)
            : menuItems[
                (index +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  menuItems.length) %
                  menuItems.length
              ];
      target?.focus();
    }
    if (
      event.key === "Enter" &&
      !explorerMenu.hidden &&
      document.activeElement?.matches("[data-explorer-command]")
    ) {
      event.preventDefault();
      document.activeElement.click();
    }
  });
  renderExplorerItems(win, content);
  renderExplorerTree(win);
  return content;
};

const wireDisplayProperties = (win) => {
  const content = win.el.querySelector(".display-properties-content");
  if (!content) return;

  let current = getDisplaySettings();
  let pending = { ...current };
  let resolutionPreviewActive = false;
  let resolutionPreviewSnapshot = null;
  const tabs = [...content.querySelectorAll('[role="tab"]')];
  const panels = [...content.querySelectorAll('[role="tabpanel"]')];
  const controls = {
    theme: content.querySelector("#display-theme"),
    wallpaper: content.querySelector("#display-wallpaper"),
    position: content.querySelector("#display-position"),
    color: content.querySelector("#display-color"),
    image: content.querySelector("#display-image"),
    clearImage: content.querySelector(".display-clear-image"),
    saver: content.querySelector("#display-saver"),
    saverWait: content.querySelector("#display-saver-wait"),
    appearance: content.querySelector("#display-appearance"),
    resolution: content.querySelector("#display-resolution"),
    preview: content.querySelector(".display-preview-surface"),
    saverPreview: content.querySelector(".screen-saver-preview"),
    appearancePreview: content.querySelector(".appearance-preview"),
    resolutionPreview: content.querySelector(".display-resolution-preview"),
    resolutionValue: content.querySelector(".display-resolution-value"),
    status: content.querySelector(".display-status"),
    apply: content.querySelector('[data-display-action="apply"]'),
  };
  const themes = {
    "windows-xp": {
      appearance: "blue",
      wallpaper: "bliss",
      backgroundColor: "#3a6ea5",
    },
    classic: {
      appearance: "silver",
      wallpaper: "blue",
      backgroundColor: "#4b6f8f",
    },
    olive: {
      appearance: "olive",
      wallpaper: "olive",
      backgroundColor: "#586b2f",
    },
  };
  const sync = () => {
    controls.theme.value = pending.theme;
    controls.wallpaper.value = pending.wallpaper;
    controls.position.value = pending.position;
    controls.color.value = pending.backgroundColor;
    controls.saver.value = pending.screenSaver;
    controls.saverWait.value = String(pending.screenSaverWait);
    controls.appearance.value = pending.appearance;
    controls.resolution.value = pending.resolution;
    controls.clearImage.hidden = !pending.customWallpaper;
    controls.preview.style.backgroundColor = pending.backgroundColor;
    controls.preview.style.backgroundImage = displayBackground(pending);
    controls.preview.dataset.position = pending.position;
    controls.saverPreview.dataset.saver = pending.screenSaver;
    controls.appearancePreview.dataset.appearance = pending.appearance;
    controls.resolutionPreview.dataset.resolution = pending.resolution;
    const monitor = getSimulatedMonitorSize(pending.resolution);
    controls.resolutionValue.textContent =
      pending.resolution === "auto"
        ? `Current browser size: ${window.innerWidth} by ${window.innerHeight} pixels`
        : `${pending.resolution.replace("x", " by ")} pixels${monitor.limited ? ` (limited to ${monitor.width} by ${monitor.height})` : ""}`;
    controls.apply.disabled =
      JSON.stringify(pending) === JSON.stringify(current);
  };
  const showTab = (tab) => {
    const panelId = tab.getAttribute("aria-controls");
    tabs.forEach((item) => {
      const active = item === tab;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
      item.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => {
      const active = panel.id === panelId;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
    });
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => showTab(tab));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      event.preventDefault();
      const target =
        event.key === "Home"
          ? tabs[0]
          : event.key === "End"
            ? tabs.at(-1)
            : tabs[
                (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
                  tabs.length
              ];
      showTab(target);
      target.focus();
    });
  });
  controls.theme.addEventListener("change", () => {
    pending = {
      ...pending,
      theme: controls.theme.value,
      customWallpaper: "",
      ...themes[controls.theme.value],
    };
    sync();
  });
  controls.wallpaper.addEventListener("change", () => {
    pending = {
      ...pending,
      wallpaper: controls.wallpaper.value,
      customWallpaper: "",
    };
    sync();
  });
  ["position", "appearance", "saver"].forEach((name) => {
    controls[name].addEventListener("change", () => {
      pending = {
        ...pending,
        [name === "saver" ? "screenSaver" : name]: controls[name].value,
      };
      sync();
    });
  });
  controls.resolution.addEventListener("change", () => {
    pending = { ...pending, resolution: controls.resolution.value };
    if (pending.resolution === current.resolution) {
      applySimulatedMonitor(current.resolution, { reflow: false });
      restoreWindowState(resolutionPreviewSnapshot);
      resolutionPreviewSnapshot = null;
      resolutionPreviewActive = false;
    } else {
      resolutionPreviewSnapshot ||= snapshotWindowState();
      resolutionPreviewActive = true;
      applySimulatedMonitor(pending.resolution);
    }
    sync();
  });
  controls.color.addEventListener("input", () => {
    pending = { ...pending, backgroundColor: controls.color.value };
    sync();
  });
  controls.saverWait.addEventListener("change", () => {
    const wait = Math.min(
      60,
      Math.max(1, Number.parseInt(controls.saverWait.value, 10) || 1),
    );
    pending = { ...pending, screenSaverWait: wait };
    sync();
  });
  controls.image.addEventListener("change", () => {
    const [file] = controls.image.files;
    if (!file) return;
    const supportedTypes = [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
    ];
    if (
      !supportedTypes.includes(file.type) ||
      file.size > MAX_CUSTOM_WALLPAPER_BYTES
    ) {
      controls.status.textContent =
        "Choose a PNG, JPEG, GIF, or WebP image smaller than 1 MB.";
      controls.image.value = "";
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (
        typeof reader.result !== "string" ||
        !reader.result.startsWith("data:image/")
      )
        return;
      pending = { ...pending, customWallpaper: reader.result };
      controls.status.textContent = `${file.name} will be used after you apply changes.`;
      sync();
    });
    reader.readAsDataURL(file);
  });
  controls.clearImage.addEventListener("click", () => {
    pending = { ...pending, customWallpaper: "" };
    controls.image.value = "";
    sync();
  });
  content
    .querySelector('[data-display-action="apply"]')
    .addEventListener("click", () => {
      if (!isDisplaySettings(pending)) return;
      if (!saveDisplaySettings(pending)) {
        controls.status.textContent =
          "Windows could not save this picture. Try a smaller image.";
        return;
      }
      current = { ...pending };
      applyDisplaySettings(current);
      resolutionPreviewActive = false;
      resolutionPreviewSnapshot = null;
      controls.status.textContent = "Settings applied.";
      sync();
    });
  content
    .querySelector('[data-display-action="ok"]')
    .addEventListener("click", () => {
      if (!controls.apply.disabled) controls.apply.click();
      if (controls.apply.disabled) closeGameWindow(win.gameId);
    });
  const rollbackResolutionPreview = () => {
    if (resolutionPreviewActive) {
      applySimulatedMonitor(current.resolution, { reflow: false });
      restoreWindowState(resolutionPreviewSnapshot);
    }
    resolutionPreviewActive = false;
    resolutionPreviewSnapshot = null;
  };
  win.beforeClose = rollbackResolutionPreview;
  content
    .querySelector('[data-display-action="cancel"]')
    .addEventListener("click", () => closeGameWindow(win.gameId));
  sync();
};

// ============================================
// Virtual Filesystem integration
// ============================================

const fs = window.VirtualFS;
const fileOps = window.FileOperations;

const refreshInstalledGames = (installedGames) => {
  const nextIds = new Set(Object.keys(installedGames));
  installedGameIds.forEach((gameId) => {
    if (nextIds.has(gameId)) return;
    closeGameWindow(gameId);
    fs.findByApp(gameId).forEach((node) => fs.destroy(node.id));
    delete gamesList[gameId];
    const favorites = getFavorites().filter((id) => id !== gameId);
    setFavorites(favorites);
  });
  Object.entries(installedGames).forEach(([gameId, game]) => {
    gamesList[gameId] = game;
  });
  installedGameIds.clear();
  nextIds.forEach((gameId) => installedGameIds.add(gameId));

  if (!shellInitialized) return;
  syncGameFiles();
  buildDesktopIcons();
  if (!document.getElementById("start-menu").hidden) buildPinnedPrograms();
  const internetWindow = openWindows.get("__internet-games");
  if (internetWindow) renderInstalledInternetGames(internetWindow);
};

const initializeGameLibrary = async () => {
  try {
    gameLibrary = window.AstroGameLibrary.createManager();
    gameLibrary.subscribe(refreshInstalledGames);
    refreshInstalledGames(await gameLibrary.initialize());
    gameLibraryReady = true;
  } catch (error) {
    console.error("Internet Games initialization failed:", error);
    gameLibraryError = error;
  }
};

// Shared names understood by Run, Search, and the shell. Keep these routes in
// one place so adding a simulated application does not create another parser.
const SHELL_COMMANDS = [
  {
    id: "documents",
    title: "My Documents",
    aliases: ["documents", "my documents"],
    run: () => openSystemWindow("__my-documents"),
  },
  {
    id: "pictures",
    title: "My Pictures",
    aliases: ["pictures", "my pictures"],
    run: () => openSystemWindow("__my-pictures"),
  },
  {
    id: "music",
    title: "My Music",
    aliases: ["music", "my music"],
    run: () => openSystemWindow("__my-music"),
  },
  {
    id: "computer",
    title: "My Computer",
    aliases: ["computer", "my computer"],
    run: () => openSystemWindow("__my-computer"),
  },
  {
    id: "control-panel",
    title: "Control Panel",
    aliases: ["control panel"],
    run: () => openControlPanel(),
  },
  {
    id: "printers",
    title: "Printers and Faxes",
    aliases: ["printers", "printers and faxes"],
    run: () => openPrintersAndFaxes(),
  },
  {
    id: "help",
    title: "Help and Support",
    aliases: ["help", "help and support"],
    run: () => openHelpAndSupport(),
  },
  {
    id: "notepad",
    title: "Notepad",
    aliases: ["notepad"],
    run: () => openNotepad(),
  },
  {
    id: "search",
    title: "Search",
    aliases: ["search"],
    run: () => openSystemWindow("__search"),
  },
  {
    id: "internet-games",
    title: "Internet Games",
    aliases: ["internet games", "game store", "games online"],
    run: () => openSystemWindow("__internet-games"),
  },
  { id: "run", title: "Run", aliases: ["run"], run: () => openRunDialog() },
];

const normalizeShellCommand = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
const resolveShellCommand = (value) => {
  const command = normalizeShellCommand(value);
  if (!command) return null;
  const shell = SHELL_COMMANDS.find((entry) => entry.aliases.includes(command));
  if (shell) return { kind: "application", title: shell.title, run: shell.run };
  const gameId = Object.keys(gamesList).find(
    (id) =>
      id.toLowerCase() === command ||
      formatGameTitle(id).toLowerCase() === command,
  );
  if (gameId)
    return {
      kind: "game",
      title: formatGameTitle(gameId),
      run: () => openGameWindow(gameId),
    };
  const nodeId = fs.resolvePath(String(value).trim());
  const node = nodeId && fs.getNode(nodeId);
  if (node)
    return {
      kind: node.type === "folder" ? "folder" : "file",
      title: node.name,
      run: () => fs.open(node.id),
    };
  return null;
};

const RUN_HISTORY_KEY = "runHistory";
const getRunHistory = () =>
  readJsonStorage(
    RUN_HISTORY_KEY,
    [],
    (history) =>
      Array.isArray(history) &&
      history.every((entry) => typeof entry === "string"),
  ).slice(0, 10);
const rememberRunCommand = (value) => {
  const text = String(value).trim();
  if (!text) return;
  const history = getRunHistory().filter(
    (entry) => entry.toLowerCase() !== text.toLowerCase(),
  );
  writeJsonStorage(RUN_HISTORY_KEY, [text, ...history].slice(0, 10));
};

const searchVirtualNodes = ({
  query = "",
  locationId = fs.MY_COMPUTER,
  type = "all",
} = {}) => {
  const wanted = normalizeShellCommand(query);
  const matches = (name) => !wanted || name.toLowerCase().includes(wanted);
  const results = [];
  const representedGameIds = new Set();
  const pending = [locationId];
  const seen = new Set();
  while (pending.length) {
    const id = pending.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    const node = fs.getNode(id);
    if (!node) continue;
    if (
      id !== locationId &&
      matches(node.name) &&
      (type === "all" ||
        (type === "files" && node.type === "file") ||
        (type === "folders" && node.type === "folder") ||
        (type === "games" && !!node.app))
    ) {
      results.push({ kind: node.app ? "game-file" : node.type, node });
      if (node.app) representedGameIds.add(node.app);
    }
    if (node.type === "folder")
      fs.getChildren(id).forEach((child) => pending.push(child.id));
  }
  if (type === "all" || type === "games") {
    Object.keys(gamesList)
      .filter(
        (id) => !representedGameIds.has(id) && matches(formatGameTitle(id)),
      )
      .forEach((gameId) => {
        results.push({ kind: "game", gameId, title: formatGameTitle(gameId) });
      });
  }
  if (type === "all" || type === "applications") {
    SHELL_COMMANDS.filter((entry) => matches(entry.title)).forEach((entry) => {
      results.push({ kind: "application", command: entry, title: entry.title });
    });
  }
  return results.sort((a, b) =>
    (a.title || a.node.name).localeCompare(b.title || b.node.name),
  );
};

const wireSearchCompanion = (win) => {
  const content = win.el.querySelector(".search-companion-content");
  if (!content) return;
  const query = content.querySelector("#search-filename");
  const location = content.querySelector("#search-location");
  const type = content.querySelector("#search-type");
  const status = content.querySelector(".search-results-status");
  const list = content.querySelector(".search-results-list");
  [
    [fs.MY_COMPUTER, "My Computer"],
    [fs.DESKTOP, "Desktop"],
    [fs.MY_DOCUMENTS, "My Documents"],
    [fs.MY_PICTURES, "My Pictures"],
    [fs.MY_MUSIC, "My Music"],
  ]
    .filter(([id]) => fs.getNode(id))
    .forEach(([id, label]) => {
      const option = new Option(label, id);
      location.appendChild(option);
    });
  const openResult = (result) => {
    if (result.gameId) return openGameWindow(result.gameId);
    if (result.command) return result.command.run();
    return fs.open(result.node.id);
  };
  const render = () => {
    const results = searchVirtualNodes({
      query: query.value,
      locationId: location.value,
      type: type.value,
    });
    list.replaceChildren();
    status.textContent = results.length
      ? `${results.length} result${results.length === 1 ? "" : "s"} found.`
      : "No results found.";
    results.forEach((result) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "explorer-item";
      item.setAttribute("role", "option");
      const label = document.createElement("span");
      const name = document.createElement("b");
      name.textContent = result.title || result.node.name;
      const description = document.createElement("small");
      description.textContent = result.command
        ? "Application"
        : result.gameId
          ? "Game"
          : `${result.kind === "folder" ? "File folder" : explorerItemDescription(result.node)} — ${fs.getPath(result.node.id)}`;
      label.append(name, description);
      item.append(
        result.gameId
          ? createGameIconElement(result.gameId, "explorer-item-icon")
          : result.command
            ? createGameIconElement("__search", "explorer-item-icon")
            : createExplorerIcon(result.node),
        label,
      );
      item.addEventListener("dblclick", () => openResult(result));
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          openResult(result);
        }
      });
      item.addEventListener("click", () => {
        list
          .querySelectorAll(".selected")
          .forEach((entry) => entry.classList.remove("selected"));
        item.classList.add("selected");
      });
      list.appendChild(item);
    });
  };
  content
    .querySelector('[data-search-action="search"]')
    .addEventListener("click", render);
  query.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      render();
    }
  });
  [location, type].forEach((control) =>
    control.addEventListener("change", render),
  );
  query.focus();
};

const findBundledGameByTitle = (title) => {
  const wanted = String(title || "")
    .trim()
    .toLowerCase();
  if (!wanted) return null;
  return (
    Object.keys(window.FLASH_GAMES).find(
      (gameId) => formatGameTitle(gameId).toLowerCase() === wanted,
    ) || null
  );
};

const createInternetGameCard = (game, win, { installed = false } = {}) => {
  const card = document.createElement("article");
  card.className = "internet-game-card";

  const artwork = document.createElement("div");
  artwork.className = "internet-game-artwork";
  const image = document.createElement("img");
  image.src = game.icon || game.logoUrl || "";
  image.alt = "";
  image.loading = "lazy";
  image.addEventListener("error", () => {
    image.hidden = true;
    artwork.classList.add("missing");
  });
  artwork.appendChild(image);

  const body = document.createElement("div");
  body.className = "internet-game-card-body";
  const title = document.createElement("h2");
  title.textContent = game.title || "Untitled game";
  const developer = document.createElement("p");
  developer.className = "internet-game-developer";
  developer.textContent = game.developer || "Unknown developer";
  const tags = document.createElement("p");
  tags.className = "internet-game-tags";
  tags.textContent = Array.isArray(game.tags)
    ? game.tags.slice(0, 4).join(" · ")
    : "Flash";
  body.append(title, developer, tags);

  const actions = document.createElement("div");
  actions.className = "internet-game-actions";
  const action = document.createElement("button");
  action.type = "button";
  action.className = "xp-btn";

  if (installed) {
    action.textContent = "Play";
    action.addEventListener("click", () =>
      openGameWindow(`flashpoint:${game.uuid}`),
    );
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "xp-btn";
    remove.textContent = "Uninstall";
    remove.addEventListener("click", async () => {
      const confirmed = await XPDialogs.confirm(
        `Remove ${game.title || "this game"} from this computer?`,
        "Uninstall Game",
        "warning",
      );
      if (!confirmed) return;
      action.disabled = true;
      remove.disabled = true;
      try {
        await gameLibrary.uninstall(game.uuid);
      } catch (error) {
        XPDialogs.alert(
          error.message || "The game could not be uninstalled.",
          "Internet Games",
          "error",
        );
        action.disabled = false;
        remove.disabled = false;
      }
    });
    actions.append(action, remove);
  } else {
    const gameId = `flashpoint:${game.uuid}`;
    const includedGameId = findBundledGameByTitle(game.title);
    let availableGameId = gamesList[gameId] ? gameId : includedGameId;
    action.textContent = availableGameId
      ? "Play"
      : game.potentiallyCompatible === false
        ? "Not compatible"
        : "Install";
    if (includedGameId && !gamesList[gameId]) {
      action.title = "This game is already included with Astro Flash.";
    }
    action.disabled = game.potentiallyCompatible === false;
    action.addEventListener("click", async () => {
      if (availableGameId) {
        openGameWindow(availableGameId);
        return;
      }
      const status = win.el.querySelector(".internet-games-status");
      action.disabled = true;
      action.textContent = "Checking...";
      try {
        const details = await gameLibrary.details(game.uuid);
        if (!details.compatible) {
          throw new Error(
            details.incompatibleReason || "This game is not compatible.",
          );
        }
        action.textContent = "Downloading...";
        await gameLibrary.install(details, {
          onProgress: ({ loaded, total }) => {
            if (total) {
              const percent = Math.min(100, Math.round((loaded / total) * 100));
              action.textContent = `Downloading ${percent}%`;
            } else {
              action.textContent = `Downloading ${XPDialogs.formatBytes(loaded)}`;
            }
          },
        });
        availableGameId = gameId;
        action.textContent = "Play";
        action.disabled = false;
        status.textContent = `${details.title} was installed successfully.`;
      } catch (error) {
        action.textContent = "Install";
        action.disabled = false;
        status.textContent =
          error.message || "The game could not be installed.";
      }
    });
    actions.appendChild(action);
  }

  card.append(artwork, body, actions);
  return card;
};

const renderInstalledInternetGames = (win) => {
  if (!win?.el) return;
  const container = win.el.querySelector(".internet-games-installed");
  const status = win.el.querySelector(".internet-games-installed-status");
  if (!container || !status) return;
  container.replaceChildren();
  const records = gameLibrary
    ? [...installedGameIds]
        .map((id) => gameLibrary.getRecord(id))
        .filter(Boolean)
        .sort((a, b) => (a.title || "").localeCompare(b.title || ""))
    : [];
  status.textContent = records.length
    ? `${records.length} installed game${records.length === 1 ? "" : "s"}.`
    : "No internet games are installed yet.";
  records.forEach((record) =>
    container.appendChild(
      createInternetGameCard(record, win, { installed: true }),
    ),
  );
};

const wireInternetGames = (win) => {
  const content = win.el.querySelector(".internet-games-content");
  if (!content) return;
  const tabs = [...content.querySelectorAll("[data-internet-tab]")];
  const panels = [...content.querySelectorAll("[data-internet-panel]")];
  const query = content.querySelector("#internet-games-query");
  const form = content.querySelector(".internet-games-search");
  const status = content.querySelector(".internet-games-status");
  const results = content.querySelector(".internet-games-results");

  const selectTab = (name) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.internetTab === name;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.internetPanel !== name;
    });
    if (name === "installed") renderInstalledInternetGames(win);
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab.dataset.internetTab));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const offset = event.key === "ArrowRight" ? 1 : -1;
      const next = tabs[(index + offset + tabs.length) % tabs.length];
      selectTab(next.dataset.internetTab);
      next.focus();
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const term = query.value.trim();
    if (!term) {
      status.textContent = "Enter a game title.";
      query.focus();
      return;
    }
    if (!gameLibrary || gameLibraryError) {
      status.textContent =
        gameLibraryError?.message ||
        "The Internet Games service is unavailable.";
      return;
    }
    const submit = form.querySelector("button");
    submit.disabled = true;
    status.textContent = `Searching for “${term}”...`;
    results.replaceChildren();
    try {
      const games = await gameLibrary.search(term);
      status.textContent = games.length
        ? `${games.length} result${games.length === 1 ? "" : "s"} found.`
        : "No games found.";
      games.forEach((game) =>
        results.appendChild(createInternetGameCard(game, win)),
      );
    } catch (error) {
      status.textContent =
        error.message || "The Flashpoint catalog could not be searched.";
    } finally {
      submit.disabled = false;
    }
  });

  renderInstalledInternetGames(win);
  query.focus();
};

const confirmRecycleDelete = (ids) =>
  XPDialogs.confirm(
    ids.length === 1
      ? "Are you sure you want to send this item to the Recycle Bin?"
      : "Are you sure you want to send these items to the Recycle Bin?",
    "Confirm File Delete",
    "warning",
  ).then((yes) => yes && fileOps.removeToBin(ids));
const choosePasteConflict = ({ existing }) =>
  new Promise((resolve) => {
    const dialog = XPDialogs.createDialog({
      title: "Confirm File Replace",
      onCancel: () => dialog.close("cancel"),
    });
    const text = document.createElement("p");
    text.className = "dlg-text";
    text.textContent = `${existing.name} already exists. What do you want to do?`;
    const row = document.createElement("div");
    row.className = "dlg-buttons";
    [
      ["Replace", "replace"],
      ["Keep Both", "rename"],
      ["Cancel", "cancel"],
    ].forEach(([label, value]) => {
      row.appendChild(
        XPDialogs.createDialogButton({ id: value, label }, () =>
          dialog.close(value),
        ),
      );
    });
    dialog.body.append(text, row);
    dialog.onResult(resolve);
    dialog.defaultButton = row.firstChild;
    row.firstChild.focus();
  });
let pasteBusy = false;
const pasteIntoFolder = async (destinationId) => {
  if (pasteBusy) return null;
  const clipboard = fileOps.getClipboard();
  if (!clipboard) return;
  pasteBusy = true;
  let cancelled = false;
  const progress =
    clipboard.ids.length > 1
      ? XPDialogs.progress({
          title: clipboard.mode === "cut" ? "Moving..." : "Copying...",
          text: "Preparing file operation...",
          cancellable: true,
          onCancel: () => {
            cancelled = true;
          },
        })
      : null;
  try {
    const result = await fileOps.pasteWithConflicts(
      destinationId,
      choosePasteConflict,
      {
        isCancelled: () => cancelled,
        onProgress: ({ completed, total, mode }) =>
          progress?.update(
            completed / total,
            `${mode === "cut" ? "Moving" : "Copying"} ${completed} of ${total}...`,
          ),
      },
    );
    progress?.close?.(result.cancelled ? "cancelled" : "complete");
    return result;
  } catch (error) {
    progress?.close?.("error");
    console.error(error);
    XPDialogs.alert(
      error.message || "The file operation could not be completed.",
      "File Operation Error",
      "error",
    );
    return null;
  } finally {
    pasteBusy = false;
  }
};
// Browser DataTransfer exposes file bytes, but directory traversal is only
// available through the non-standard webkitGetAsEntry API. Unsupported
// browsers import the flat FileList and cannot preserve directory structure.
const readAllDirectoryEntries = (reader) =>
  new Promise((resolve, reject) => {
    const entries = [];
    const read = () =>
      reader.readEntries((batch) => {
        if (!batch.length) resolve(entries);
        else {
          entries.push(...batch);
          read();
        }
      }, reject);
    read();
  });
const importFileEntry = (entry, destinationId, state = {}) =>
  new Promise((resolve, reject) =>
    entry.file(async (file) => {
      try {
        if (state.cancelled) return resolve(false);
        const content = file.type.startsWith("text/") ? await file.text() : "";
        const existing = fs.findChild(destinationId, file.name);
        if (existing) {
          const choice = await choosePasteConflict({ existing });
          if (choice === "cancel") {
            state.cancelled = true;
            return resolve(false);
          }
          if (choice === "replace" && existing.type === "file")
            fs.destroy(existing.id);
        }
        fileOps.createFile(destinationId, file.name, {
          content,
          size: file.size,
        });
        state.completed = (state.completed || 0) + 1;
        state.progress?.update(0, `Imported ${state.completed} item(s)...`);
        resolve(true);
      } catch (error) {
        reject(error);
      }
    }, reject),
  );
const importDirectoryEntry = async (entry, destinationId, state = {}) => {
  if (state.cancelled) return;
  const created = [];
  try {
    const existing = fs.findChild(destinationId, entry.name);
    if (existing) {
      const choice = await choosePasteConflict({ existing });
      if (choice === "cancel") {
        state.cancelled = true;
        return;
      }
      if (choice === "replace" && existing.type === "folder")
        fs.destroy(existing.id);
    }
    const folder = fileOps.createFolder(destinationId, entry.name);
    created.push(folder.id);
    const entries = await readAllDirectoryEntries(entry.createReader());
    for (const child of entries) {
      if (state.cancelled) throw new Error("Directory import cancelled");
      if (child.isDirectory)
        await importDirectoryEntry(child, folder.id, state);
      else if (child.isFile) await importFileEntry(child, folder.id, state);
    }
  } catch (error) {
    created.reverse().forEach((id) => {
      if (fs.getNode(id)) fs.destroy(id);
    });
    if (error.message === "Directory import cancelled") return;
    throw error;
  }
};
const importDroppedFiles = async (destinationId, dataTransfer) => {
  if ([fs.RECYCLE_BIN, fs.MY_COMPUTER].includes(destinationId)) {
    XPDialogs.alert(
      "This location cannot accept dropped files.",
      "File Operation Error",
      "error",
    );
    return;
  }
  const progress = XPDialogs.progress({
    title: "Importing...",
    text: "Preparing dropped files...",
    cancellable: true,
  });
  const state = { cancelled: false, completed: 0, progress };
  const cancelButton = progress.el.querySelector("button");
  cancelButton?.addEventListener("click", () => {
    state.cancelled = true;
  });
  try {
    const entries = [...(dataTransfer.items || [])]
      .map((item) => item.webkitGetAsEntry?.())
      .filter(Boolean);
    if (entries.length) {
      for (const entry of entries) {
        if (state.cancelled) break;
        if (entry.isDirectory)
          await importDirectoryEntry(entry, destinationId, state);
        else if (entry.isFile)
          await importFileEntry(entry, destinationId, state);
      }
      return;
    }
    for (const file of [...(dataTransfer.files || [])]) {
      if (state.cancelled) break;
      await importFileEntry({ file: (ok) => ok(file) }, destinationId, state);
    }
  } finally {
    progress.close();
  }
};
const wireFolderDropTarget = (element, destinationId) => {
  element.addEventListener("dragover", (event) => {
    const internal = event.dataTransfer?.types?.includes(
      "application/x-astro-vfs-ids",
    );
    if (
      internal ||
      fileOps.canPaste(destinationId) ||
      event.dataTransfer?.files?.length
    ) {
      event.preventDefault();
      element.classList.add("drop-target");
    }
  });
  element.addEventListener("dragleave", () =>
    element.classList.remove("drop-target"),
  );
  element.addEventListener("drop", async (event) => {
    event.preventDefault();
    element.classList.remove("drop-target");
    try {
      const payload = event.dataTransfer?.getData(
        "application/x-astro-vfs-ids",
      );
      const ids = payload ? JSON.parse(payload) : [];
      if (!Array.isArray(ids)) throw new Error("Invalid dropped item list");
      if (ids.length) {
        fileOps.cut(ids);
        await pasteIntoFolder(destinationId);
      } else await importDroppedFiles(destinationId, event.dataTransfer);
    } catch (error) {
      XPDialogs.alert(
        error.message || "The dropped files could not be imported.",
        "File Operation Error",
        "error",
      );
    }
  });
};
const closeExplorerMenu = (root = document) => {
  root.querySelectorAll(".explorer-menu").forEach((menu) => {
    menu.hidden = true;
  });
  root
    .querySelectorAll('[data-explorer-menu][aria-expanded="true"]')
    .forEach((button) => button.setAttribute("aria-expanded", "false"));
};

const systemFolderShortcuts = {
  "__my-documents": () => fs.MY_DOCUMENTS,
  "__my-computer": () => fs.MY_COMPUTER,
  "__my-pictures": () => fs.MY_PICTURES,
  "__my-music": () => fs.MY_MUSIC,
  "__recycle-bin": () => fs.RECYCLE_BIN,
};

const explorerDescriptions = {
  "__my-documents": "Files stored on this computer",
  "__my-computer": "",
  "__my-pictures": "Files stored in My Pictures",
  "__my-music": "Files stored in My Music",
};

const navigateExplorer = (win, folderId, { history = true } = {}) => {
  const folder = fs.getNode(folderId);
  if (!folder || folder.type !== "folder") return false;
  if (history) {
    const entries = (win.history || []).slice(0, (win.historyIndex ?? -1) + 1);
    if (entries.at(-1) !== folderId) entries.push(folderId);
    win.history = entries;
    win.historyIndex = entries.length - 1;
  }
  win.currentFolderId = folderId;
  renderExplorerItems(win);
  return true;
};

const explorerBack = (win) => {
  if ((win.historyIndex ?? 0) <= 0) return;
  win.historyIndex -= 1;
  navigateExplorer(win, win.history[win.historyIndex], { history: false });
};

const explorerForward = (win) => {
  if ((win.historyIndex ?? -1) >= (win.history?.length ?? 0) - 1) return;
  win.historyIndex += 1;
  navigateExplorer(win, win.history[win.historyIndex], { history: false });
};

const selectedExplorerNodes = (win) =>
  [...win.el.querySelectorAll(".explorer-item.selected")]
    .map((item) => item.dataset.nodeId)
    .filter((id) => !!fs.getNode(id));

const renderExplorerTaskPane = (win) => {
  if (win.currentFolderId === fs.RECYCLE_BIN) return;
  const title = win.el.querySelector(
    ".explorer-sidebar > section:first-child .explorer-section-label",
  );
  const body = win.el.querySelector(
    ".explorer-sidebar > section:first-child .explorer-section-body",
  );
  if (!title || !body) return;

  const isComputer = win.currentFolderId === fs.MY_COMPUTER;
  const isPictures = win.currentFolderId === fs.MY_PICTURES;
  const isMusic = win.currentFolderId === fs.MY_MUSIC;
  title.textContent = isComputer
    ? "System Tasks"
    : isPictures
      ? "Picture Tasks"
      : isMusic
        ? "Music Tasks"
        : "File and Folder Tasks";
  body.replaceChildren();

  const addTask = (label, icon, action, disabled = false) => {
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = disabled;
    const image = document.createElement("img");
    image.src = `assets/xp/icons/${icon}`;
    image.alt = "";
    const text = document.createElement("span");
    text.textContent = label;
    button.append(image, text);
    if (action) button.addEventListener("click", action);
    body.appendChild(button);
  };

  if (isComputer) {
    addTask(
      "View System Information",
      "explorerproperties.png",
      openProjectSettings,
    );
    addTask("Add or remove programs", "Programs.png", openControlPanel);
    addTask("Change a setting", "ControlPanel.png", openControlPanel);
    return;
  }

  if (isPictures) {
    addTask("View as a slide show", "MyPictures.png", null, true);
    addTask("Order prints online", "MyPictures.png", null, true);
    addTask("Print pictures", "PrintersandFaxes.png", null, true);
    return;
  }

  if (isMusic) {
    addTask("Play all", "MyMusic.png", null, true);
    addTask("Shop for music online", "MyMusic.png", null, true);
    addTask("Copy all items to audio CD", "MyMusic.png", null, true);
    return;
  }

  const writable = ![fs.RECYCLE_BIN, fs.MY_COMPUTER].includes(
    win.currentFolderId,
  );
  addTask(
    "Make a new folder",
    "NewFolder.png",
    () => fileOps.createFolder(win.currentFolderId, "New Folder"),
    !writable,
  );
  addTask("Publish this folder to the Web", "Publishtoweb.png", null, true);
  addTask("Share this folder", "SharedFolder.png", null, true);
};

const renderExplorerTree = (win) => {
  const tree = win.el.querySelector(".explorer-tree");
  if (!tree) return;
  tree.replaceChildren();
  const expanded =
    win.expandedFolders ||
    new Set([
      fs.MY_COMPUTER,
      fs.DRIVE_C,
      fs.DOCUMENTS_AND_SETTINGS,
      fs.USER_PROFILE,
    ]);
  win.expandedFolders = expanded;
  const addNode = (id, depth = 0) => {
    const node = fs.getNode(id);
    if (!node || node.type !== "folder") return;
    const row = document.createElement("button");
    row.type = "button";
    row.className = "explorer-tree-item";
    row.dataset.nodeId = id;
    row.style.paddingLeft = `${6 + depth * 14}px`;
    const hasFolders = fs
      .getChildren(id)
      .some((child) => child.type === "folder");
    row.textContent = `${hasFolders ? (expanded.has(id) ? "− " : "+ ") : "  "}${node.name}`;
    row.classList.toggle("active", id === win.currentFolderId);
    row.addEventListener("click", () => {
      if (hasFolders) expanded.add(id);
      navigateExplorer(win, id);
    });
    row.addEventListener("dblclick", () => {
      if (expanded.has(id)) expanded.delete(id);
      else expanded.add(id);
      renderExplorerTree(win);
    });
    tree.appendChild(row);
    if (expanded.has(id))
      fs.getChildren(id)
        .filter((child) => child.type === "folder")
        .forEach((child) => addNode(child.id, depth + 1));
  };
  addNode(fs.MY_COMPUTER);
  addNode(fs.RECYCLE_BIN);
};

const openExplorerContextMenu = (win, clientX, clientY) => {
  const selected = selectedExplorerNodes(win);
  const recycle = win.currentFolderId === fs.RECYCLE_BIN;
  const protectedSelection = selected.some((id) => fs.isProtected(id));
  const menu = document.createElement("div");
  menu.className = "xp-context-menu explorer-context-menu";
  menu.setAttribute("role", "menu");
  const close = () => menu.remove();
  const add = (label, command, disabled = false) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.command = command;
    button.disabled = disabled;
    button.setAttribute("role", "menuitem");
    menu.appendChild(button);
  };
  if (recycle) {
    add("Restore", "restore", !selected.length);
    add("Delete Permanently", "permanent", !selected.length);
    add("Properties", "properties", selected.length !== 1);
  } else {
    add("Open", "open", selected.length !== 1);
    add("Cut", "cut", !selected.length || protectedSelection);
    add("Copy", "copy", !selected.length);
    add("Delete", "delete", !selected.length || protectedSelection);
    add("Rename", "rename", selected.length !== 1 || protectedSelection);
    add("Properties", "properties", selected.length !== 1);
  }
  win.el.appendChild(menu);
  const rect = win.el.getBoundingClientRect();
  menu.style.left = `${Math.max(0, Math.min(clientX - rect.left, rect.width - menu.offsetWidth - 2))}px`;
  menu.style.top = `${Math.max(25, Math.min(clientY - rect.top, rect.height - menu.offsetHeight - 2))}px`;
  menu.querySelector("button:not(:disabled)")?.focus();
  menu.addEventListener("click", (event) => {
    const command = event.target.dataset.command;
    if (!command) return;
    if (command === "open") fs.open(selected[0]);
    if (command === "cut") fileOps.cut(selected);
    if (command === "copy") fileOps.copy(selected);
    if (command === "restore") fileOps.restore(selected);
    if (command === "properties") XPDialogs.properties(selected[0]);
    if (command === "rename") {
      const name = window.prompt("Rename", fs.getNode(selected[0]).name);
      if (name !== null) fileOps.rename(selected[0], name);
    }
    if (command === "delete" || command === "permanent")
      XPDialogs.confirm(
        command === "permanent"
          ? "Are you sure you want to permanently delete the selected items?"
          : "Are you sure you want to send the selected items to the Recycle Bin?",
        "Confirm File Delete",
        "warning",
      ).then(
        (yes) =>
          yes &&
          (command === "permanent"
            ? fileOps.permanentlyDelete(selected)
            : confirmRecycleDelete(selected)),
      );
    close();
  });
  menu.addEventListener("keydown", (event) => {
    const buttons = [...menu.querySelectorAll("button:not(:disabled)")];
    const index = buttons.indexOf(document.activeElement);
    if (event.key === "Escape") {
      close();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      document.activeElement?.click();
      return;
    }
    if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const target =
        event.key === "Home"
          ? buttons[0]
          : event.key === "End"
            ? buttons.at(-1)
            : buttons[
                (index +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  buttons.length) %
                  buttons.length
              ];
      target?.focus();
    }
  });
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!menu.contains(event.target)) close();
    },
    { once: true },
  );
};

const createExplorerIcon = (node) => {
  const icon = document.createElement("span");
  icon.className = "explorer-item-icon";
  const addImage = (fileName) => {
    const image = document.createElement("img");
    image.src = `assets/xp/icons/${fileName}`;
    image.alt = "";
    icon.appendChild(image);
    return icon;
  };

  if (node.id === fs.DRIVE_C || node.id === fs.DRIVE_D)
    return addImage("LocalDisk.png");
  if (node.id === fs.DRIVE_F) return addImage("RemovableMedia.png");
  if (node.id === fs.MY_MUSIC) return addImage("MyMusic.png");
  if (node.id === fs.MY_PICTURES) return addImage("MyPictures.png");
  if (node.id === fs.MY_COMPUTER) return addImage("MyComputer.png");
  if (node.type === "folder") {
    return addImage("NewFolder.png");
  }

  const game = node.app ? gamesList[node.app] : null;
  if (game) {
    if (game.icon) {
      const image = document.createElement("img");
      image.src = game.icon;
      image.alt = "";
      icon.appendChild(image);
    } else {
      icon.classList.add("explorer-item-emoji");
      icon.textContent = getGameIcon(node.app);
    }
    return icon;
  }

  icon.classList.add("explorer-item-emoji");
  icon.textContent = "📄";
  return icon;
};

const explorerItemDescription = (node) => {
  if (node.id === fs.DRIVE_C || node.id === fs.DRIVE_D) return "Local Disk";
  if (node.id === fs.DRIVE_F) return "Removable Disk";
  if (node.type === "folder") return "File folder";
  if (node.app && gamesList[node.app]) return "Game";
  return `${(node.ext || "").replace(".", "").toUpperCase() || "File"} file`;
};

const openExplorerNode = (win, node) => {
  if (node.type === "folder") {
    navigateExplorer(win, node.id);
    return;
  }
  try {
    fs.open(node.id);
  } catch (error) {
    console.error(error);
  }
};

const renderExplorerItems = (win, contentRoot = win.el) => {
  const main = contentRoot.querySelector(".explorer-main");
  if (!main || !win.currentFolderId) return;
  const folder = fs.getNode(win.currentFolderId);
  if (!folder) return;

  win.el.querySelector(".title-text").textContent =
    folder.id === fs.MY_COMPUTER ? "My Computer" : folder.name;
  const titleIcon = win.el.querySelector(".title-icon");
  if (titleIcon) {
    titleIcon.replaceChildren();
    const image = document.createElement("img");
    image.src =
      folder.id === fs.MY_COMPUTER
        ? "assets/xp/icons/MyComputer.png"
        : folder.id === fs.MY_MUSIC
          ? "assets/xp/icons/MyMusic.png"
          : folder.id === fs.MY_PICTURES
            ? "assets/xp/icons/MyPictures.png"
            : "assets/xp/icons/mydocuments.png";
    image.alt = "";
    titleIcon.appendChild(image);
  }
  renderExplorerTree(win);
  renderExplorerTaskPane(win);

  const explorerContent = main.closest(".explorer-content");
  const chrome = explorerContent?.querySelector(".explorer-chrome");
  if (chrome) {
    chrome.querySelector("input").value = fs.getPath(folder.id);
    chrome.querySelector('[data-explorer-action="back"]').disabled =
      (win.historyIndex ?? 0) <= 0;
    chrome.querySelector('[data-explorer-action="forward"]').disabled =
      (win.historyIndex ?? -1) >= (win.history?.length ?? 0) - 1;
    chrome.querySelector('[data-explorer-action="up"]').disabled =
      !folder.parent;
  }

  const heading = main.querySelector("h2");
  if (win.currentFolderId === fs.RECYCLE_BIN) {
    const count = fs.getChildren(fs.RECYCLE_BIN).length;
    heading.textContent = count
      ? `${count} ${count === 1 ? "object" : "objects"}`
      : "The Recycle Bin is empty.";
  } else if (win.currentFolderId === systemFolderShortcuts[win.gameId]?.()) {
    heading.textContent = explorerDescriptions[win.gameId] || folder.name;
  } else {
    heading.textContent = folder.name;
  }
  heading.hidden = !heading.textContent || folder.id === fs.MY_COMPUTER;

  const items = main.querySelector(".explorer-items");
  items.dataset.view = win.explorerView || "tiles";
  items.innerHTML = "";

  const myComputerGroup = (node) =>
    [fs.MY_MUSIC, fs.MY_PICTURES].includes(node.id)
      ? "Files Stored on This Computer"
      : node.id === fs.DRIVE_F
        ? "Devices with Removable Storage"
        : "Hard Disk Drives";
  const myComputerGroupOrder = [
    "Files Stored on This Computer",
    "Hard Disk Drives",
    "Devices with Removable Storage",
  ];
  const children = [
    ...(folder.id === fs.MY_COMPUTER
      ? [fs.getNode(fs.MY_MUSIC), fs.getNode(fs.MY_PICTURES)]
      : []),
    ...fs.getChildren(folder.id),
  ]
    .filter(Boolean)
    .sort((a, b) =>
      folder.id === fs.MY_COMPUTER
        ? myComputerGroupOrder.indexOf(myComputerGroup(a)) -
            myComputerGroupOrder.indexOf(myComputerGroup(b)) ||
          a.name.localeCompare(b.name)
        : a.type === b.type
          ? a.name.localeCompare(b.name)
          : a.type === "folder"
            ? -1
            : 1,
    );

  if (!children.length) {
    const empty = document.createElement("p");
    empty.className = "explorer-empty";
    empty.textContent =
      win.currentFolderId === fs.RECYCLE_BIN
        ? "The Recycle Bin is empty."
        : "There are no items to show in this view.";
    items.appendChild(empty);
    const status = explorerContent?.querySelector(".explorer-status");
    if (status) status.textContent = "0 objects";
    if (win.currentFolderId === fs.RECYCLE_BIN) {
      win.el.querySelectorAll(".recycle-task").forEach((button) => {
        button.disabled = true;
      });
    }
    return;
  }

  if (items.dataset.view === "details") {
    const header = document.createElement("div");
    header.className = "explorer-details-header";
    header.innerHTML = "<span>Name</span><span>Type</span><span>Size</span>";
    items.appendChild(header);
  }

  let currentGroup = "";
  children.forEach((node) => {
    if (folder.id === fs.MY_COMPUTER) {
      const group = myComputerGroup(node);
      if (group !== currentGroup) {
        const groupHeading = document.createElement("h3");
        groupHeading.className = "explorer-group-heading";
        groupHeading.textContent = group;
        items.appendChild(groupHeading);
        currentGroup = group;
      }
    }
    const item = document.createElement("button");
    item.type = "button";
    item.className = "explorer-item";
    item.dataset.nodeId = node.id;
    item.draggable = !node.protected;
    item.title = node.name;

    const label = document.createElement("span");
    const name = document.createElement("b");
    name.textContent = node.name;
    const description = document.createElement("small");
    description.textContent = explorerItemDescription(node);
    label.appendChild(name);
    if (folder.id !== fs.MY_COMPUTER) label.appendChild(description);

    item.append(createExplorerIcon(node), label);
    if (folder.id === fs.MY_COMPUTER) item.classList.add("my-computer-item");
    if (items.dataset.view === "details") {
      item.classList.add("explorer-details-row");
      const type = document.createElement("span");
      type.className = "explorer-detail-type";
      type.textContent = explorerItemDescription(node);
      const size = document.createElement("span");
      size.className = "explorer-detail-size";
      size.textContent =
        node.type === "folder"
          ? ""
          : XPDialogs.formatBytes(fs.getSize(node.id));
      item.append(type, size);
    }
    item.addEventListener("click", (event) => {
      if (!event.ctrlKey && !event.metaKey) {
        items
          .querySelectorAll(".selected")
          .forEach((entry) => entry.classList.remove("selected"));
      }
      item.classList.add("selected");
    });
    item.addEventListener("dragstart", (event) => {
      const ids = selectedExplorerNodes(win);
      event.dataTransfer.setData(
        "application/x-astro-vfs-ids",
        JSON.stringify(ids.includes(node.id) ? ids : [node.id]),
      );
      event.dataTransfer.effectAllowed = "move";
    });
    item.addEventListener("dblclick", () => openExplorerNode(win, node));
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        openExplorerNode(win, node);
      }
      if (e.key === "F2" && !node.protected) {
        e.preventDefault();
        const next = window.prompt("Rename", node.name);
        if (next !== null) fileOps.rename(node.id, next);
      }
    });
    item.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      item.click();
      openExplorerContextMenu(win, event.clientX, event.clientY);
    });
    if (node.type === "folder") wireFolderDropTarget(item, node.id);
    items.appendChild(item);
  });
  const status = explorerContent?.querySelector(".explorer-status");
  if (status)
    status.textContent = `${children.length} ${children.length === 1 ? "object" : "objects"}`;
  if (win.currentFolderId === fs.RECYCLE_BIN) {
    win.el.querySelectorAll(".recycle-task").forEach((button) => {
      button.disabled = false;
    });
  }
};

// Games participate in the filesystem as ".game" files on the Desktop,
// opened through the registered file association.
const gameFileName = (gameId) =>
  `${formatGameTitle(gameId)
    // eslint-disable-next-line no-control-regex -- Windows rejects ASCII control characters.
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()}.game`;

const syncGameFiles = () => {
  Object.keys(gamesList).forEach((gameId) => {
    // Managed shortcuts remain valid after the user renames, moves, or
    // recycles them. Only recreate one after it has been destroyed.
    if (fs.findByApp(gameId).length) return;
    try {
      fs.createFile(fs.DESKTOP, gameFileName(gameId), { app: gameId });
    } catch (error) {
      console.error(error);
    }
  });
};

window.addEventListener("message", (event) => {
  if (event.origin !== location.origin) return;
  const message = event.data;
  if (
    message?.event !== "astro.offline-game-ready" ||
    message.gameId !== "revcdos"
  ) {
    return;
  }
  const win = openWindows.get(message.gameId);
  if (!win || event.source !== win.player?.contentWindow) return;
  offlineManager.downloadGame(message.gameId).catch((error) => {
    console.error("Could not add reVCDOS to Offline Games:", error);
  });
});

fs.registerFileType(".game", (file) => {
  if (file.app && gamesList[file.app]) {
    openGameWindow(file.app);
  }
});

const restoreDefaultDesktop = () => {
  Object.keys(gamesList).forEach((gameId) => {
    fs.findByApp(gameId).forEach((node) => fs.destroy(node.id));
  });
  localStorage.removeItem("desktopIconPositions");
  localStorage.removeItem("desktopLayoutSettings");
  syncGameFiles();
};

const resetAstroFlash = () => {
  USER_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  fs.reset();
  syncGameFiles();
};

const NOTEPAD_ID = "__notepad";

const openNotepad = (file = null) => {
  const existing = openWindows.get(NOTEPAD_ID);
  if (existing) {
    const switchDocument = async () => {
      if (!(await existing.confirmSaveChanges())) return;
      existing.loadDocument(file);
      restoreWindow(NOTEPAD_ID);
      focusWindow(NOTEPAD_ID);
    };
    switchDocument();
    return;
  }

  const { width: desktopWidth, height: desktopHeight } = getDesktopSize();
  const el = createWindowElement(NOTEPAD_ID);
  el.classList.add("notepad-window");
  el.querySelectorAll(".game-menu-bar, .game-menu").forEach((node) =>
    node.remove(),
  );
  const windowWidth = Math.min(600, desktopWidth - 16);
  const windowHeight = Math.min(430, desktopHeight - 16);
  el.style.width = `${windowWidth}px`;
  el.style.height = `${windowHeight}px`;
  el.style.left = `${Math.max(8, (desktopWidth - windowWidth) / 2)}px`;
  el.style.top = `${Math.max(8, (desktopHeight - windowHeight) / 2)}px`;

  const content = el.querySelector(".window-content");
  content.className = "notepad-content";
  content.replaceChildren();

  const menuBar = document.createElement("div");
  menuBar.className = "notepad-menu-bar";
  menuBar.setAttribute("role", "menubar");
  const editor = document.createElement("textarea");
  editor.className = "notepad-editor";
  editor.setAttribute("aria-label", "Notepad document");
  editor.spellcheck = false;
  editor.wrap = "off";
  const status = document.createElement("div");
  status.className = "notepad-status";
  content.append(menuBar, editor, status);
  document.getElementById("desktop").appendChild(el);

  const win = {
    gameId: NOTEPAD_ID,
    el,
    type: "system",
    player: null,
    minimized: false,
    maximized: false,
    prevRect: null,
    zIndex: 0,
    lastUsed: Date.now(),
    nodeId: null,
    dirty: false,
    maximizeBtn: el.querySelector(".maximize-btn"),
    favoriteBtn: null,
    volumeBtn: null,
  };
  openWindows.set(NOTEPAD_ID, win);

  const updateTitle = () => {
    const node = win.nodeId && fs.getNode(win.nodeId);
    const documentName = node?.name || "Untitled";
    const title = `${documentName} - Notepad`;
    systemShortcuts[NOTEPAD_ID].title = title;
    el.querySelector(".title-text").textContent = title;
    renderTaskButtons();
    updateDocumentTitle();
  };

  const updateStatus = () => {
    const beforeCaret = editor.value.slice(0, editor.selectionStart);
    const lines = beforeCaret.split("\n");
    status.textContent = `Ln ${lines.length}, Col ${lines.at(-1).length + 1}`;
  };

  const loadDocument = (node) => {
    win.nodeId = node?.id || null;
    editor.value = node ? fs.getContent(node.id) || "" : "";
    win.dirty = false;
    updateTitle();
    updateStatus();
    editor.focus();
  };

  const saveAs = async () => {
    const current = win.nodeId && fs.getNode(win.nodeId);
    const result = await XPDialogs.saveFile({
      title: "Save As",
      startFolder: current?.parent || fs.MY_DOCUMENTS,
      defaultName: current?.name || "Untitled.txt",
      filter: [".txt"],
    });
    if (!result) return false;
    const name = result.name.toLowerCase().endsWith(".txt")
      ? result.name
      : `${result.name}.txt`;
    try {
      let target = result.existingId && fs.getNode(result.existingId);
      if (target && target.type !== "file") {
        throw new Error(`"${name}" is not a text file.`);
      }
      if (target && target.id !== win.nodeId) {
        fs.destroy(target.id);
        target = null;
      }
      if (!target) {
        target = fileOps.createFile(result.parentId, name, {
          content: editor.value,
        });
      } else {
        if (target.name !== name) fileOps.rename(target.id, name);
        fs.setContent(target.id, editor.value);
      }
      win.nodeId = target.id;
      win.dirty = false;
      updateTitle();
      return true;
    } catch (error) {
      XPDialogs.alert(
        error.message || "The file could not be saved.",
        "Notepad",
        "error",
      );
      return false;
    }
  };

  const save = async () => {
    const node = win.nodeId && fs.getNode(win.nodeId);
    if (!node) return saveAs();
    fs.setContent(node.id, editor.value);
    win.dirty = false;
    updateTitle();
    return true;
  };

  const confirmSaveChanges = async () => {
    if (!win.dirty) return true;
    const node = win.nodeId && fs.getNode(win.nodeId);
    const answer = await XPDialogs.message({
      title: "Notepad",
      text: `The text in the ${node?.name || "Untitled"} file has changed.\n\nDo you want to save the changes?`,
      icon: "warning",
      buttons: XPDialogs.BUTTON_SETS.yesNoCancel,
      defaultButton: "yes",
    });
    if (answer === "cancel") return false;
    if (answer === "no") return true;
    return save();
  };

  Object.assign(win, { loadDocument, confirmSaveChanges });
  win.beforeClose = confirmSaveChanges;

  const insertText = (text) => {
    editor.setRangeText(
      text,
      editor.selectionStart,
      editor.selectionEnd,
      "end",
    );
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const commands = {
    new: async () => {
      if (await confirmSaveChanges()) loadDocument(null);
    },
    open: async () => {
      if (!(await confirmSaveChanges())) return;
      const chosen = await XPDialogs.openFile({
        title: "Open",
        startFolder: fs.MY_DOCUMENTS,
        filter: [".txt"],
      });
      if (chosen) loadDocument(chosen);
    },
    save,
    "save-as": saveAs,
    exit: () => closeGameWindow(NOTEPAD_ID),
    undo: () => {
      editor.focus();
      document.execCommand("undo");
    },
    cut: async () => {
      const selected = editor.value.slice(
        editor.selectionStart,
        editor.selectionEnd,
      );
      if (selected) {
        await navigator.clipboard?.writeText(selected);
        insertText("");
      }
    },
    copy: () =>
      navigator.clipboard?.writeText(
        editor.value.slice(editor.selectionStart, editor.selectionEnd),
      ),
    paste: async () => {
      const text = await navigator.clipboard?.readText();
      if (typeof text === "string") insertText(text);
    },
    delete: () => insertText(""),
    "select-all": () => {
      editor.focus();
      editor.select();
      updateStatus();
    },
    "time-date": () => insertText(new Date().toLocaleString()),
    "word-wrap": (item) => {
      const enabled = editor.wrap === "off";
      editor.wrap = enabled ? "soft" : "off";
      editor.classList.toggle("word-wrap", enabled);
      item.classList.toggle("checked", enabled);
      item.setAttribute("aria-checked", String(enabled));
    },
    "status-bar": (item) => {
      status.hidden = !status.hidden;
      item.classList.toggle("checked", !status.hidden);
      item.setAttribute("aria-checked", String(!status.hidden));
    },
    about: () =>
      XPDialogs.alert("Microsoft Windows XP\nNotepad", "About Notepad", "info"),
  };

  const menuDefinitions = [
    [
      "&File",
      [
        ["&New", "new", "Ctrl+N"],
        ["&Open...", "open", "Ctrl+O"],
        ["&Save", "save", "Ctrl+S"],
        ["Save &As...", "save-as", ""],
        ["-", "", ""],
        ["E&xit", "exit", ""],
      ],
    ],
    [
      "&Edit",
      [
        ["&Undo", "undo", "Ctrl+Z"],
        ["-", "", ""],
        ["Cu&t", "cut", "Ctrl+X"],
        ["&Copy", "copy", "Ctrl+C"],
        ["&Paste", "paste", "Ctrl+V"],
        ["De&lete", "delete", "Del"],
        ["-", "", ""],
        ["Select &All", "select-all", "Ctrl+A"],
        ["Time/&Date", "time-date", "F5"],
      ],
    ],
    ["F&ormat", [["&Word Wrap", "word-wrap", ""]]],
    ["&View", [["&Status Bar", "status-bar", "", true]]],
    ["&Help", [["&About Notepad", "about", ""]]],
  ];

  const closeMenus = () => {
    menuBar.querySelectorAll(".notepad-menu").forEach((menu) => {
      menu.hidden = true;
    });
    menuBar.querySelectorAll(".notepad-menu-button").forEach((button) => {
      button.setAttribute("aria-expanded", "false");
    });
  };

  menuDefinitions.forEach(([label, items]) => {
    const group = document.createElement("div");
    group.className = "notepad-menu-group";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "notepad-menu-button";
    button.setAttribute("role", "menuitem");
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
    setAccessKeyText(button, label);
    const menu = document.createElement("div");
    menu.className = "notepad-menu";
    menu.setAttribute("role", "menu");
    menu.hidden = true;
    items.forEach(([itemLabel, command, shortcut, checked]) => {
      if (itemLabel === "-") {
        const separator = document.createElement("div");
        separator.className = "notepad-menu-separator";
        menu.appendChild(separator);
        return;
      }
      const item = document.createElement("button");
      item.type = "button";
      item.className = "notepad-menu-item";
      item.dataset.command = command;
      item.setAttribute("role", checked ? "menuitemcheckbox" : "menuitem");
      if (checked) {
        item.classList.add("checked");
        item.setAttribute("aria-checked", "true");
      }
      const check = document.createElement("span");
      check.className = "notepad-menu-check";
      check.textContent = "✓";
      const text = document.createElement("span");
      setAccessKeyText(text, itemLabel);
      const key = document.createElement("span");
      key.className = "notepad-menu-shortcut";
      key.textContent = shortcut;
      item.append(check, text, key);
      item.addEventListener("click", () => {
        closeMenus();
        commands[command]?.(item);
      });
      menu.appendChild(item);
    });
    button.addEventListener("click", () => {
      const shouldOpen = menu.hidden;
      closeMenus();
      menu.hidden = !shouldOpen;
      button.setAttribute("aria-expanded", String(shouldOpen));
      if (shouldOpen) menu.querySelector("button")?.focus();
    });
    group.append(button, menu);
    menuBar.appendChild(group);
  });

  editor.addEventListener("input", () => {
    win.dirty = true;
    updateStatus();
  });
  ["click", "keyup", "select"].forEach((eventName) =>
    editor.addEventListener(eventName, updateStatus),
  );
  el.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".notepad-menu-group")) closeMenus();
  });
  el.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      save();
    } else if (event.ctrlKey && event.key.toLowerCase() === "o") {
      event.preventDefault();
      commands.open();
    } else if (event.ctrlKey && event.key.toLowerCase() === "n") {
      event.preventDefault();
      commands.new();
    } else if (event.key === "F5") {
      event.preventDefault();
      commands["time-date"]();
    }
  });

  wireSystemWindowControls(win);
  loadDocument(file);
  focusWindow(NOTEPAD_ID);
};

fs.registerFileType(".txt", (file) => openNotepad(file));

fs.registerFolderHandler((folder) => {
  openSystemWindow("__my-documents");
  const win = openWindows.get("__my-documents");
  if (win) navigateExplorer(win, folder.id);
});

// Keep open explorer windows in sync with filesystem changes.
fs.subscribe(() => {
  openWindows.forEach((win) => {
    if (win.type !== "system" || !win.currentFolderId) return;
    if (!fs.getNode(win.currentFolderId)) {
      win.currentFolderId = fs.MY_COMPUTER;
    }
    renderExplorerItems(win);
  });
  if (iconsBuilt) buildDesktopIcons();
});

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
  const windowWidth = Math.min(
    isProjectSettings ? 540 : isInternetGames ? 760 : 700,
    desktopWidth - 16,
  );
  const windowHeight = Math.min(
    isProjectSettings ? 420 : isInternetGames ? 540 : 500,
    desktopHeight - 16,
  );
  el.style.width = `${windowWidth}px`;
  el.style.height = `${windowHeight}px`;
  el.style.left = `${Math.max(8, (desktopWidth - windowWidth) / 2)}px`;
  el.style.top = `${Math.max(8, (desktopHeight - windowHeight) / 2)}px`;
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
  if (shortcutId === "__display-properties") wireDisplayProperties(win);
  if (shortcutId === "__astro-settings") wireProjectSettings(win);
  if (shortcutId === "__search") wireSearchCompanion(win);
  if (shortcutId === "__internet-games") wireInternetGames(win);
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

  wireWindowControls(win);
  focusWindow(gameId);

  if (window.location.hash !== `#${gameId}`) {
    window.location.hash = gameId;
  }
};

// ============================================
// Taskbar
// ============================================

const closeTaskbarMenus = () => {
  document.getElementById("taskbar-context-menu").hidden = true;
  document.getElementById("taskbar-overflow-menu").hidden = true;
};

// Public shell hook for windows that need to notify the user without stealing
// focus (for example, an app that has finished loading).
const setWindowAttention = (gameId, needsAttention = true) => {
  const win = openWindows.get(gameId);
  if (!win) return false;
  win.needsAttention = Boolean(needsAttention) && gameId !== focusedGameId;
  renderTaskButtons();
  return true;
};
window.XPShell = Object.assign(window.XPShell || {}, { setWindowAttention });

const positionTaskbarMenu = (menu, clientX, clientY) => {
  menu.hidden = false;
  menu.style.left = "0";
  menu.style.top = "0";
  menu.style.left = `${Math.max(2, Math.min(clientX, innerWidth - menu.offsetWidth - 2))}px`;
  menu.style.top = `${Math.max(2, Math.min(clientY - menu.offsetHeight, innerHeight - menu.offsetHeight - 2))}px`;
  menu.querySelector("button:not(:disabled)")?.focus();
};

const wireTaskbarMenuKeyboard = (menu) => {
  menu.addEventListener("keydown", (event) => {
    const items = [...menu.querySelectorAll("button:not(:disabled)")];
    if (!items.length) return;
    const current = items.indexOf(document.activeElement);
    let target = null;
    if (event.key === "ArrowDown") {
      target = items[(current + 1 + items.length) % items.length];
    } else if (event.key === "ArrowUp") {
      target = items[(current - 1 + items.length) % items.length];
    } else if (event.key === "Home") {
      target = items[0];
    } else if (event.key === "End") {
      target = items.at(-1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeTaskbarMenus();
      return;
    } else if (
      (event.key === "Enter" || event.key === " ") &&
      document.activeElement?.matches("button:not(:disabled)")
    ) {
      event.preventDefault();
      document.activeElement.click();
      return;
    }
    if (target) {
      event.preventDefault();
      target.focus();
    }
  });
};

const activateTaskButton = (gameId) => {
  const win = openWindows.get(gameId);
  if (!win) return;
  if (gameId === focusedGameId && !win.minimized) minimizeWindow(gameId);
  else {
    restoreWindow(gameId);
    focusWindow(gameId);
  }
};

const renderTaskButtons = () => {
  const container = document.getElementById("task-buttons");
  const windows = [...openWindows.entries()];
  const styles = getComputedStyle(container);
  const taskMinWidth =
    Number.parseFloat(styles.getPropertyValue("--task-button-min-width")) || 52;
  const overflowMinWidth =
    Number.parseFloat(styles.getPropertyValue("--task-overflow-min-width")) ||
    68;
  const taskGap = Number.parseFloat(styles.gap) || 0;
  const contentWidth = Math.max(
    0,
    container.clientWidth -
      (Number.parseFloat(styles.paddingLeft) || 0) -
      (Number.parseFloat(styles.paddingRight) || 0),
  );
  const allTasksWidth =
    windows.length * taskMinWidth + Math.max(0, windows.length - 1) * taskGap;
  const hasOverflow = allTasksWidth > contentWidth;
  // The overflow control has a larger minimum than a normal task. Account
  // for that control and its separating gap up front so it cannot be clipped.
  const visibleCapacity = hasOverflow
    ? Math.max(
        0,
        Math.floor(
          (contentWidth - overflowMinWidth - taskGap) /
            (taskMinWidth + taskGap),
        ),
      )
    : windows.length;
  const visible = windows.slice(0, visibleCapacity);
  const hidden = windows.slice(visible.length);
  container.innerHTML = "";

  const appendTaskButton = ([gameId, win]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "task-button" +
      (gameId === focusedGameId && !win.minimized ? " active" : "") +
      (win.needsAttention ? " needs-attention" : "");
    btn.dataset.game = gameId;
    btn.title = formatGameTitle(gameId);
    btn.setAttribute(
      "aria-label",
      `${formatGameTitle(gameId)}${win.minimized ? ", minimized" : ""}${win.needsAttention ? ", needs attention" : ""}`,
    );
    btn.setAttribute(
      "aria-pressed",
      String(gameId === focusedGameId && !win.minimized),
    );

    const icon = createGameIconElement(gameId, "task-icon");

    const label = document.createElement("span");
    label.className = "task-label";
    label.textContent = formatGameTitle(gameId);

    btn.append(icon, label);
    btn.addEventListener("click", () => activateTaskButton(gameId));
    btn.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      closeTaskbarMenus();
      openWindowSystemMenu(win, event.clientX, event.clientY);
    });
    container.appendChild(btn);
  };
  visible.forEach(appendTaskButton);

  if (hidden.length) {
    const overflow = document.createElement("button");
    overflow.type = "button";
    const hiddenNeedsAttention = hidden.some(([, win]) => win.needsAttention);
    overflow.className =
      "task-button task-button-grouped" +
      (hiddenNeedsAttention ? " needs-attention" : "");
    overflow.textContent = `${hidden.length} windows`;
    overflow.setAttribute(
      "aria-label",
      `Open menu for ${hidden.length} additional windows${hiddenNeedsAttention ? ", including a window that needs attention" : ""}`,
    );
    overflow.setAttribute("aria-haspopup", "menu");
    overflow.addEventListener("click", () => {
      const menu = document.getElementById("taskbar-overflow-menu");
      menu.innerHTML = "";
      const explorerWindows = hidden.filter(
        ([, win]) => win.type === "system" && win.currentFolderId,
      );
      const appendWindowItem = ([gameId, win]) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className =
          "taskbar-overflow-item" +
          (win.needsAttention ? " needs-attention" : "");
        item.setAttribute("role", "menuitem");
        item.textContent = formatGameTitle(gameId);
        item.setAttribute(
          "aria-label",
          `${formatGameTitle(gameId)}${win.minimized ? ", minimized" : ""}${win.needsAttention ? ", needs attention" : ""}`,
        );
        item.addEventListener("click", () => {
          closeTaskbarMenus();
          activateTaskButton(gameId);
        });
        item.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          closeTaskbarMenus();
          openWindowSystemMenu(win, event.clientX, event.clientY);
        });
        menu.appendChild(item);
      };
      // Group only genuinely similar windows. Other applications stay
      // separate menu items rather than being presented as one app.
      if (explorerWindows.length > 1) {
        const heading = document.createElement("span");
        heading.className = "taskbar-group-heading";
        heading.setAttribute("role", "presentation");
        heading.textContent = `Windows Explorer (${explorerWindows.length})`;
        menu.appendChild(heading);
        explorerWindows.forEach(appendWindowItem);
      }
      hidden
        .filter(
          (entry) =>
            !explorerWindows.includes(entry) || explorerWindows.length <= 1,
        )
        .forEach(appendWindowItem);
      const rect = overflow.getBoundingClientRect();
      positionTaskbarMenu(menu, rect.left, rect.top);
    });
    container.appendChild(overflow);
  }
};

const arrangeTaskbarWindows = (mode) => {
  const windows = [...openWindows.values()].filter((win) => !win.minimized);
  if (!windows.length) return;
  const { width, height } = getDesktopSize();
  windows.forEach((win, index) => {
    if (win.maximized) toggleMaximize(win.gameId);
    if (mode === "cascade") {
      const offset = index * 26;
      Object.assign(win.el.style, {
        left: `${Math.min(offset, width - 340)}px`,
        top: `${Math.min(offset, height - 240)}px`,
        width: `${Math.max(340, width - Math.min(offset, 130))}px`,
        height: `${Math.max(240, height - Math.min(offset, 130))}px`,
      });
    } else {
      const horizontal = mode === "tile-horizontal";
      const count = windows.length;
      Object.assign(
        win.el.style,
        horizontal
          ? {
              left: "0px",
              top: `${(index * height) / count}px`,
              width: `${width}px`,
              height: `${height / count}px`,
            }
          : {
              left: `${(index * width) / count}px`,
              top: "0px",
              width: `${width / count}px`,
              height: `${height}px`,
            },
      );
    }
  });
  focusWindow(windows[windows.length - 1].gameId);
};

const openTaskManager = () => {
  const dialog = XPDialogs.createDialog({ title: "Windows Task Manager" });
  const heading = document.createElement("p");
  heading.textContent = `${openWindows.size} application${openWindows.size === 1 ? "" : "s"} running`;
  const list = document.createElement("ul");
  [...openWindows.values()].forEach((win) => {
    const item = document.createElement("li");
    item.textContent = `${formatGameTitle(win.gameId)}${win.minimized ? " (Minimized)" : ""}`;
    list.appendChild(item);
  });
  dialog.body.append(heading, list);
};

const openTaskbarProperties = () => {
  const dialog = XPDialogs.createDialog({
    title: "Taskbar and Start Menu Properties",
  });
  const label = document.createElement("label");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = true;
  input.disabled = true;
  input.title = "The taskbar is fixed in this shell.";
  label.append(input, " Lock the taskbar (taskbar position is fixed)");
  dialog.body.appendChild(label);
};

const setupTaskbarContextMenu = () => {
  const taskbar = document.getElementById("taskbar");
  const menu = document.getElementById("taskbar-context-menu");
  wireTaskbarMenuKeyboard(menu);
  wireTaskbarMenuKeyboard(document.getElementById("taskbar-overflow-menu"));
  taskbar.addEventListener("contextmenu", (event) => {
    if (event.target.closest(".task-button, #tray-volume-popup")) return;
    event.preventDefault();
    closeWindowSystemMenu();
    closeTaskbarMenus();
    positionTaskbarMenu(menu, event.clientX, event.clientY);
  });
  menu.addEventListener("click", (event) => {
    const action = event.target.closest("[data-taskbar-action]")?.dataset
      .taskbarAction;
    if (!action || event.target.disabled) return;
    closeTaskbarMenus();
    if (action === "show-desktop") toggleShowDesktop();
    else if (action === "cascade" || action.startsWith("tile-"))
      arrangeTaskbarWindows(action);
    else if (action === "task-manager") openTaskManager();
    else if (action === "properties") openTaskbarProperties();
  });
};

const CLOCK_OFFSET_KEY = "clockOffsetMs";

const getClockOffset = () => {
  const offset = parseInt(localStorage.getItem(CLOCK_OFFSET_KEY) || "0", 10);
  return Number.isFinite(offset) ? offset : 0;
};

const getShellTime = () => new Date(Date.now() + getClockOffset());

let updateClockDisplay = () => {};

const startClock = () => {
  const clock = document.getElementById("taskbar-clock");
  const update = () => {
    const now = getShellTime();
    clock.textContent = now.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    // XP tooltip: hovering the clock shows the full date.
    clock.title = now.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };
  updateClockDisplay = update;
  update();
  setInterval(update, 5000);
};

// ============================================
// System Tray
// ============================================

const getMasterVolume = () => ({
  volume: parseInt(localStorage.getItem("volume") || "100", 10),
  isMuted: localStorage.getItem("isMuted") === "true",
});

const syncTrayVolumeUI = () => {
  const { volume, isMuted } = getMasterVolume();
  const button = document.getElementById("tray-volume-button");
  const slider = document.getElementById("tray-volume-slider");
  const muteBox = document.getElementById("tray-mute-checkbox");
  button.classList.toggle("muted", isMuted || volume === 0);
  button.title = isMuted ? "Volume (muted)" : "Volume";
  slider.value = String(volume);
  muteBox.checked = isMuted;
};

const setMasterVolume = (volume, isMuted) => {
  localStorage.setItem("volume", String(volume));
  localStorage.setItem("isMuted", String(isMuted));
  applyFocusVolumes();
  openWindows.forEach((win) => syncWindowVolumeUI(win));
  syncTrayVolumeUI();
};

const closeTrayVolumePopup = () => {
  const popup = document.getElementById("tray-volume-popup");
  popup.hidden = true;
  document.getElementById("tray-volume-button").classList.remove("pressed");
};

const openTrayVolumePopup = () => {
  const popup = document.getElementById("tray-volume-popup");
  const button = document.getElementById("tray-volume-button");
  syncTrayVolumeUI();
  popup.hidden = false;
  button.classList.add("pressed");
  const rect = button.getBoundingClientRect();
  const left = Math.max(
    4,
    Math.min(
      rect.left + rect.width / 2 - popup.offsetWidth / 2,
      window.innerWidth - popup.offsetWidth - 4,
    ),
  );
  popup.style.left = `${left}px`;
  popup.style.top = `${rect.top - popup.offsetHeight - 4}px`;
  document.getElementById("tray-volume-slider").focus();
};

const toggleTrayVolumePopup = () => {
  if (document.getElementById("tray-volume-popup").hidden) {
    openTrayVolumePopup();
  } else {
    closeTrayVolumePopup();
  }
};

// Connection "duration" counts from logon, like an XP dial-up/LAN session.
let networkConnectedAt = Date.now();

const formatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
};

const openNetworkStatus = () => {
  const dialog = XPDialogs.createDialog({
    title: "Local Area Connection Status",
  });

  const header = document.createElement("div");
  header.className = "dlg-props-header";
  const icon = document.createElement("img");
  icon.className = "dlg-network-icon";
  icon.src = "assets/xp/icons/NetworkConnection.png";
  icon.alt = "";
  icon.draggable = false;
  const name = document.createElement("span");
  name.className = "dlg-props-name";
  name.textContent = "Local Area Connection";
  header.append(icon, name);

  const table = document.createElement("dl");
  table.className = "dlg-props-table";
  const cells = {};
  const addRow = (label, id, value) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.id = id;
    dd.textContent = value;
    table.append(dt, dd);
    cells[id] = dd;
  };
  addRow("Status:", "network-status-state", "Connected");
  addRow("Duration:", "network-status-duration", "00:00:00");
  addRow("Speed:", "network-status-speed", "100.0 Mbps");
  addRow("Packets Sent:", "network-status-sent", "0");
  addRow("Packets Received:", "network-status-received", "0");

  dialog.body.append(header, table);
  XPDialogs.addButtonRow(dialog, [
    { id: "close", label: "Close", isDefault: true, isCancel: true },
  ]);

  let sent = Math.floor(1000 + Math.random() * 9000);
  let received = Math.floor(sent * (1.4 + Math.random()));
  const tick = () => {
    sent += Math.floor(Math.random() * 40);
    received += Math.floor(Math.random() * 60);
    cells["network-status-duration"].textContent = formatDuration(
      Date.now() - networkConnectedAt,
    );
    cells["network-status-sent"].textContent = sent.toLocaleString("en-US");
    cells["network-status-received"].textContent =
      received.toLocaleString("en-US");
  };
  tick();
  const timer = setInterval(tick, 1000);
  dialog.onResult(() => clearInterval(timer));
};

let offlineManagerInitialized = false;
let promptedUpdateVersion = null;

const offlineStatusText = (state) => {
  const messages = {
    starting: "Preparing Windows XP system files...",
    downloading: "Downloading Windows XP system files...",
    ready: "Windows XP system files are available offline.",
    checking: "Checking for updates...",
    updating: "Downloading the latest update...",
    "update-available": state.enabled
      ? "An update is downloading..."
      : "An update is available.",
    "update-ready": "An update is ready. Restart Astro Flash to apply it.",
    "repair-required":
      "The installed update is incomplete. Repair the system files.",
    applying: "Applying the update...",
    repairing: "Clearing and downloading system files again...",
    error: "Offline system files are incomplete.",
  };
  const message = messages[state.phase] || "Offline status is unavailable.";
  return state.error ? `${message} ${state.error}` : message;
};

const formatUpdateCheckTime = (timestamp) =>
  timestamp ? new Date(timestamp).toLocaleString() : "Never";

const formatProjectBytes = (bytes) =>
  XPDialogs.formatBytes(bytes).replace(/\s+\([^)]*\)$/, "");

const projectStorageText = (state) => {
  if (state.usage === null) return "Unavailable";
  return formatProjectBytes(state.usage);
};

const formatProjectState = (value) =>
  value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : "Unavailable";

const maybePromptForUpdate = (state) => {
  if (
    !loggedIn ||
    !state.updateReady ||
    !state.availableVersion ||
    promptedUpdateVersion === state.availableVersion
  ) {
    return;
  }
  promptedUpdateVersion = state.availableVersion;
  XPDialogs.confirm(
    `Astro Flash ${state.availableVersion} is ready.\nRestart now to apply the update?`,
    "Astro Flash Update",
    "info",
  ).then((accepted) => {
    if (!accepted) return;
    offlineManager.applyUpdate().catch((error) => {
      XPDialogs.alert(error.message, "Astro Flash Update", "error");
    });
  });
};

const initializeOfflineMode = () => {
  if (offlineManagerInitialized) return;
  offlineManagerInitialized = true;
  offlineManager.subscribe(maybePromptForUpdate);
  offlineManager.initialize().catch((error) => {
    console.error("Offline mode initialization failed:", error);
  });
};

const wireProjectSettings = (win) => {
  const content = win.el.querySelector(".project-settings-content");
  const bundledGameCount = Object.keys(window.FLASH_GAMES).length;
  content.innerHTML = `
    <div class="project-settings-tabs" role="tablist" aria-label="Astro Flash Settings">
      <button type="button" role="tab" class="active" id="project-tab-general" aria-controls="project-panel-general" aria-selected="true">General</button>
      <button type="button" role="tab" id="project-tab-offline" aria-controls="project-panel-offline" aria-selected="false" tabindex="-1">Offline</button>
      <button type="button" role="tab" id="project-tab-updates" aria-controls="project-panel-updates" aria-selected="false" tabindex="-1">Updates</button>
      <button type="button" role="tab" id="project-tab-recovery" aria-controls="project-panel-recovery" aria-selected="false" tabindex="-1">Recovery</button>
    </div>
    <section class="project-settings-panel active" id="project-panel-general" role="tabpanel" aria-labelledby="project-tab-general">
      <div class="project-settings-product">
        <img src="assets/xp/icons/ControlPanel.png" alt="">
        <div>
          <h2>Astro Flash</h2>
          <p data-project-value="connection"></p>
        </div>
      </div>
      <fieldset>
        <legend>Game library</legend>
        <dl class="dlg-props-table project-settings-details">
          <dt>Included games:</dt><dd data-project-value="includedGames"></dd>
          <dt>Downloaded games:</dt><dd data-project-value="downloadedGames"></dd>
        </dl>
        <button type="button" class="xp-btn" data-project-action="manage-games">Manage Games...</button>
      </fieldset>
      <fieldset>
        <legend>Storage</legend>
        <p>Astro Flash is using <strong data-project-value="storage"></strong> of browser storage.</p>
      </fieldset>
      <a class="project-suggestions-link" href="https://github.com/astrovm/flash/issues" target="_blank" rel="noopener noreferrer">Send suggestions or report a problem</a>
    </section>
    <section class="project-settings-panel" id="project-panel-offline" role="tabpanel" aria-labelledby="project-tab-offline" hidden>
      <fieldset>
        <legend>Windows XP system files</legend>
        <p class="project-settings-description">The desktop, settings, artwork, fonts, and sounds are saved automatically for offline use.</p>
        <dl class="dlg-props-table project-settings-details">
          <dt>System download:</dt><dd data-project-value="downloadSize"></dd>
          <dt>Offline status:</dt><dd data-project-value="offlineFiles"></dd>
        </dl>
        <p class="project-settings-status" data-project-status="offline" aria-live="polite"></p>
        <progress class="project-settings-progress" aria-label="Offline download progress" hidden></progress>
        <div class="project-settings-actions">
          <button type="button" class="xp-btn" data-project-action="repair">Repair System Files</button>
        </div>
      </fieldset>
      <fieldset>
        <legend>Included games</legend>
        <p class="project-settings-description">Choose which of the ${bundledGameCount} included games should work offline. The shared Flash runtime is downloaded once when needed.</p>
        <dl class="dlg-props-table project-settings-details">
          <dt>Downloaded:</dt><dd data-project-value="offlineGames"></dd>
          <dt>Game storage:</dt><dd data-project-value="offlineGameStorage"></dd>
        </dl>
        <div class="project-offline-game-list" data-project-offline-games role="group" aria-label="Included games available offline"></div>
        <progress class="project-settings-progress" data-project-game-progress aria-label="Included game download progress" hidden></progress>
        <p class="project-settings-status" data-project-status="offline-games" aria-live="polite"></p>
        <div class="project-settings-actions">
          <button type="button" class="xp-btn" data-project-action="download-all-games">Download All Games</button>
          <button type="button" class="xp-btn" data-project-action="remove-all-games">Remove Offline Games</button>
        </div>
      </fieldset>
      <p class="project-settings-description">Games installed from Internet Games use separate storage and remain available after installation. Legacy games may fetch additional files the first time they are used.</p>
    </section>
    <section class="project-settings-panel" id="project-panel-updates" role="tabpanel" aria-labelledby="project-tab-updates" hidden>
      <fieldset>
        <legend>Astro Flash updates</legend>
        <dl class="dlg-props-table project-settings-details">
          <dt>Installed version:</dt><dd data-project-value="version"></dd>
          <dt>Available version:</dt><dd data-project-value="availableVersion"></dd>
          <dt>Last checked:</dt><dd data-project-value="lastChecked"></dd>
        </dl>
        <p class="project-settings-status" data-project-status="updates" aria-live="polite"></p>
        <div class="project-settings-actions">
          <button type="button" class="xp-btn" data-project-action="check">Check for Updates</button>
          <button type="button" class="xp-btn" data-project-action="apply">Restart to Update</button>
        </div>
      </fieldset>
    </section>
    <section class="project-settings-panel" id="project-panel-recovery" role="tabpanel" aria-labelledby="project-tab-recovery" hidden>
      <fieldset class="project-recovery-group">
        <legend>Restore the desktop</legend>
        <p>Restore all game shortcuts and their default positions. Personal files, downloaded games, and preferences are preserved.</p>
        <button type="button" class="xp-btn" data-project-action="restore-desktop">Restore Default Desktop</button>
      </fieldset>
      <fieldset class="project-recovery-group project-recovery-danger">
        <legend>Reset Astro Flash</legend>
        <p>Permanently delete personal files and reset all preferences. Downloaded games and offline files are preserved.</p>
        <button type="button" class="xp-btn" data-project-action="reset">Reset Astro Flash</button>
      </fieldset>
    </section>
  `;

  const tabs = [...content.querySelectorAll('[role="tab"]')];
  const panels = [...content.querySelectorAll('[role="tabpanel"]')];
  const value = (name) =>
    content.querySelector(`[data-project-value="${name}"]`);
  const offlineStatus = content.querySelector(
    '[data-project-status="offline"]',
  );
  const offlineGamesStatus = content.querySelector(
    '[data-project-status="offline-games"]',
  );
  const offlineGamesList = content.querySelector(
    "[data-project-offline-games]",
  );
  const updateStatus = content.querySelector('[data-project-status="updates"]');
  const downloadProgress = content.querySelector(".project-settings-progress");
  const gameDownloadProgress = content.querySelector(
    "[data-project-game-progress]",
  );
  const checkButton = content.querySelector('[data-project-action="check"]');
  const applyButton = content.querySelector('[data-project-action="apply"]');
  const repairButton = content.querySelector('[data-project-action="repair"]');
  const downloadAllGamesButton = content.querySelector(
    '[data-project-action="download-all-games"]',
  );
  const removeAllGamesButton = content.querySelector(
    '[data-project-action="remove-all-games"]',
  );
  const restoreDesktopButton = content.querySelector(
    '[data-project-action="restore-desktop"]',
  );
  const resetButton = content.querySelector('[data-project-action="reset"]');

  const showTab = (tab) => {
    const panelId = tab.getAttribute("aria-controls");
    tabs.forEach((item) => {
      const active = item === tab;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
      item.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => {
      const active = panel.id === panelId;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
    });
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => showTab(tab));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      event.preventDefault();
      const target =
        event.key === "Home"
          ? tabs[0]
          : event.key === "End"
            ? tabs.at(-1)
            : tabs[
                (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
                  tabs.length
              ];
      showTab(target);
      target.focus();
    });
  });

  const transientPhases = new Set([
    "starting",
    "downloading",
    "checking",
    "updating",
    "applying",
    "repairing",
  ]);
  let offlineListSignature = "";
  const renderOfflineGameList = (state) => {
    const downloaded = new Set(state.downloadedGameIds);
    const busy = ["downloading", "removing"].includes(state.gamePhase);
    const signature = JSON.stringify([
      state.bundledGames.map((game) => [
        game.id,
        game.bytes,
        downloaded.has(game.id),
      ]),
      busy,
      state.activeGameId,
    ]);
    if (signature === offlineListSignature) return;
    offlineListSignature = signature;
    offlineGamesList.replaceChildren();
    if (!state.bundledGames.length) {
      const empty = document.createElement("p");
      empty.className = "project-settings-description";
      empty.textContent = "Loading the included-game catalog...";
      offlineGamesList.appendChild(empty);
      return;
    }
    const games = [...state.bundledGames].sort((left, right) => {
      const leftTitle = gamesList[left.id]?.title || formatGameTitle(left.id);
      const rightTitle =
        gamesList[right.id]?.title || formatGameTitle(right.id);
      return leftTitle.localeCompare(rightTitle);
    });
    games.forEach((game) => {
      const label = document.createElement("label");
      label.className = "project-offline-game";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = downloaded.has(game.id);
      checkbox.disabled = busy;
      checkbox.dataset.offlineGame = game.id;
      const title = document.createElement("span");
      title.textContent = gamesList[game.id]?.title || formatGameTitle(game.id);
      const size = document.createElement("span");
      size.className = "project-offline-game-size";
      size.textContent = formatProjectBytes(game.bytes);
      label.append(checkbox, title, size);
      offlineGamesList.appendChild(label);
    });
  };

  offlineGamesList.addEventListener("change", (event) => {
    const control = event.target.closest("[data-offline-game]");
    if (!control) return;
    const action = control.checked
      ? offlineManager.downloadGame(control.dataset.offlineGame)
      : offlineManager.removeGame(control.dataset.offlineGame);
    action.catch((error) => {
      offlineGamesStatus.textContent = error.message;
    });
  });

  const render = (state) => {
    value("version").textContent = APP_VERSION;
    value("availableVersion").textContent = state.availableVersion
      ? state.availableVersion
      : state.lastChecked
        ? "Up to date"
        : "Not checked";
    value("includedGames").textContent = String(bundledGameCount);
    value("downloadedGames").textContent = String(installedGameIds.size);
    value("downloadSize").textContent =
      state.downloadBytes === null
        ? state.downloadMetadataError
          ? "Unavailable"
          : "Checking..."
        : formatProjectBytes(state.downloadBytes);
    value("connection").textContent = state.online
      ? "Connected to the internet"
      : "Working offline";
    value("offlineFiles").textContent =
      state.workerState === "active"
        ? "Ready for offline use"
        : formatProjectState(state.workerState);
    value("offlineGames").textContent =
      `${state.downloadedGameIds.length} of ${state.bundledGames.length || bundledGameCount}`;
    value("offlineGameStorage").textContent = formatProjectBytes(
      state.downloadedGameBytes,
    );
    value("storage").textContent = projectStorageText(state);
    value("lastChecked").textContent = formatUpdateCheckTime(state.lastChecked);
    offlineStatus.textContent = offlineStatusText(state);
    const activeGameTitle = state.activeGameId
      ? gamesList[state.activeGameId]?.title ||
        formatGameTitle(state.activeGameId)
      : "included games";
    offlineGamesStatus.textContent = state.gameError
      ? state.gameError
      : state.gamePhase === "downloading"
        ? `Downloading ${activeGameTitle}...`
        : state.gamePhase === "removing"
          ? "Removing offline game files..."
          : state.downloadedGameIds.length
            ? "Selected games are ready for offline use."
            : "No included games are downloaded for offline use.";
    updateStatus.textContent =
      state.phase === "checking"
        ? "Checking for updates..."
        : state.updateReady
          ? `Astro Flash ${state.availableVersion || "update"} is ready to install.`
          : state.availableVersion
            ? `Astro Flash ${state.availableVersion} is available.`
            : state.lastChecked
              ? "Astro Flash is up to date."
              : "Updates have not been checked yet.";
    if (state.error) {
      updateStatus.textContent = state.error;
    }
    downloadProgress.hidden = ![
      "starting",
      "downloading",
      "updating",
      "repairing",
    ].includes(state.phase);
    gameDownloadProgress.hidden = state.gamePhase !== "downloading";
    if (state.gameProgressTotal > 0) {
      gameDownloadProgress.max = state.gameProgressTotal;
      gameDownloadProgress.value = state.gameProgressLoaded;
    } else {
      gameDownloadProgress.removeAttribute("value");
    }
    checkButton.disabled = !state.online || transientPhases.has(state.phase);
    applyButton.hidden = !state.availableVersion;
    applyButton.disabled = state.enabled
      ? !state.updateReady
      : transientPhases.has(state.phase);
    repairButton.disabled = !state.online || transientPhases.has(state.phase);
    const gameBusy = ["downloading", "removing"].includes(state.gamePhase);
    downloadAllGamesButton.disabled =
      !state.online ||
      gameBusy ||
      !state.bundledGames.length ||
      state.downloadedGameIds.length === state.bundledGames.length;
    removeAllGamesButton.disabled =
      gameBusy || state.downloadedGameIds.length === 0;
    renderOfflineGameList(state);
  };
  const unsubscribe = offlineManager.subscribe(render);
  const unsubscribeGames = gameLibrary?.subscribe(() => {
    render(offlineManager.getSnapshot());
    void offlineManager.refreshStorageEstimate();
  });
  win.beforeClose = () => {
    unsubscribe();
    unsubscribeGames?.();
    return true;
  };

  checkButton.addEventListener("click", () => {
    offlineManager.checkForUpdates().catch(() => {});
  });
  applyButton.addEventListener("click", () => {
    offlineManager.applyUpdate().catch((error) => {
      updateStatus.textContent = error.message;
    });
  });
  repairButton.addEventListener("click", async () => {
    const accepted = await XPDialogs.confirm(
      "Clear and download the Windows XP system files again?",
      "Repair System Files",
      "question",
    );
    if (!accepted) return;
    offlineManager.repair().catch((error) => {
      offlineStatus.textContent = error.message;
    });
  });
  downloadAllGamesButton.addEventListener("click", () => {
    offlineManager.downloadAllGames().catch((error) => {
      offlineGamesStatus.textContent = error.message;
    });
  });
  removeAllGamesButton.addEventListener("click", async () => {
    const accepted = await XPDialogs.confirm(
      "Remove the offline copies of all included games? Internet Games installations will be preserved.",
      "Remove Offline Games",
      "question",
    );
    if (!accepted) return;
    offlineManager.removeAllGames().catch((error) => {
      offlineGamesStatus.textContent = error.message;
    });
  });
  content
    .querySelector('[data-project-action="manage-games"]')
    .addEventListener("click", () => {
      openSystemWindow("__internet-games");
      openWindows
        .get("__internet-games")
        ?.el.querySelector('[data-internet-tab="installed"]')
        ?.click();
    });
  restoreDesktopButton.addEventListener("click", async () => {
    const accepted = await XPDialogs.confirm(
      "Restore all game shortcuts and the default desktop layout?\n\nYour personal files and other settings will be preserved.",
      "Restore Default Desktop",
      "question",
    );
    if (!accepted) return;
    restoreDefaultDesktop();
    window.location.reload();
  });
  resetButton.addEventListener("click", async () => {
    const accepted = await XPDialogs.confirm(
      "Reset Astro Flash to its original state?\n\nThis will permanently delete your personal files and reset all preferences. This cannot be undone.",
      "Reset Astro Flash",
      "warning",
    );
    if (!accepted) return;
    resetAstroFlash();
    window.location.reload();
  });
};

const openProjectSettings = () => openSystemWindow("__astro-settings");

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

const openDateTimeProperties = () => {
  const dialog = XPDialogs.createDialog({
    title: "Date and Time Properties",
    wide: true,
  });

  const shellNow = getShellTime();
  const state = {
    year: shellNow.getFullYear(),
    month: shellNow.getMonth(),
    day: shellNow.getDate(),
  };

  // ---- Date group ----
  const dateGroup = document.createElement("fieldset");
  dateGroup.className = "dlg-group";
  const dateLegend = document.createElement("legend");
  dateLegend.textContent = "Date";
  dateGroup.appendChild(dateLegend);

  const monthSelect = document.createElement("select");
  monthSelect.className = "xp-select dlg-month-select";
  monthSelect.setAttribute("aria-label", "Month");
  MONTH_NAMES.forEach((monthName, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = monthName;
    monthSelect.appendChild(option);
  });
  monthSelect.value = String(state.month);

  const yearInput = document.createElement("input");
  yearInput.type = "number";
  yearInput.min = "1901";
  yearInput.max = "2099";
  yearInput.className = "xp-input dlg-year-input";
  yearInput.setAttribute("aria-label", "Year");
  yearInput.value = String(state.year);

  const monthYearRow = document.createElement("div");
  monthYearRow.className = "dlg-month-year";
  monthYearRow.append(monthSelect, yearInput);

  const calendar = document.createElement("div");
  calendar.className = "dlg-calendar";
  dateGroup.append(monthYearRow, calendar);

  // ---- Time group ----
  const timeGroup = document.createElement("fieldset");
  timeGroup.className = "dlg-group";
  const timeLegend = document.createElement("legend");
  timeLegend.textContent = "Time";
  timeGroup.appendChild(timeLegend);

  const timeRow = document.createElement("div");
  timeRow.className = "dlg-time-row";
  const makeTimeInput = (id, label, min, max, value) => {
    const input = document.createElement("input");
    input.type = "number";
    input.id = id;
    input.min = String(min);
    input.max = String(max);
    input.className = "xp-input dlg-time-input";
    input.setAttribute("aria-label", label);
    input.value = String(value);
    return input;
  };
  const hour24 = shellNow.getHours();
  const hourInput = makeTimeInput(
    "dlg-time-hour",
    "Hour",
    1,
    12,
    hour24 % 12 || 12,
  );
  const minuteInput = makeTimeInput(
    "dlg-time-minute",
    "Minute",
    0,
    59,
    shellNow.getMinutes(),
  );
  const secondInput = makeTimeInput(
    "dlg-time-second",
    "Second",
    0,
    59,
    shellNow.getSeconds(),
  );
  const ampmSelect = document.createElement("select");
  ampmSelect.className = "xp-select";
  ampmSelect.setAttribute("aria-label", "AM or PM");
  ["AM", "PM"].forEach((text) => {
    const option = document.createElement("option");
    option.value = text;
    option.textContent = text;
    ampmSelect.appendChild(option);
  });
  ampmSelect.value = hour24 < 12 ? "AM" : "PM";

  const colon1 = document.createElement("span");
  colon1.textContent = ":";
  const colon2 = document.createElement("span");
  colon2.textContent = ":";
  timeRow.append(
    hourInput,
    colon1,
    minuteInput,
    colon2,
    secondInput,
    ampmSelect,
  );
  timeGroup.appendChild(timeRow);

  const groups = document.createElement("div");
  groups.className = "dlg-datetime";
  groups.append(dateGroup, timeGroup);
  dialog.body.appendChild(groups);

  const renderCalendar = () => {
    calendar.innerHTML = "";
    DAY_LETTERS.forEach((letter) => {
      const head = document.createElement("span");
      head.className = "dlg-calendar-head";
      head.textContent = letter;
      calendar.appendChild(head);
    });
    const today = getShellTime();
    const firstWeekday = new Date(state.year, state.month, 1).getDay();
    for (let i = 0; i < firstWeekday; i += 1) {
      const blank = document.createElement("span");
      calendar.appendChild(blank);
    }
    const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dayButton = document.createElement("button");
      dayButton.type = "button";
      dayButton.className = "dlg-calendar-day";
      dayButton.textContent = String(day);
      if (day === state.day) {
        dayButton.classList.add("selected");
      }
      if (
        day === today.getDate() &&
        state.month === today.getMonth() &&
        state.year === today.getFullYear()
      ) {
        dayButton.classList.add("today");
      }
      dayButton.addEventListener("click", () => {
        state.day = day;
        renderCalendar();
      });
      calendar.appendChild(dayButton);
    }
  };

  monthSelect.addEventListener("change", () => {
    state.month = parseInt(monthSelect.value, 10);
    state.day = Math.min(
      state.day,
      new Date(state.year, state.month + 1, 0).getDate(),
    );
    renderCalendar();
  });
  yearInput.addEventListener("change", () => {
    const year = parseInt(yearInput.value, 10);
    state.year = Number.isFinite(year)
      ? Math.min(Math.max(year, 1901), 2099)
      : state.year;
    yearInput.value = String(state.year);
    state.day = Math.min(
      state.day,
      new Date(state.year, state.month + 1, 0).getDate(),
    );
    renderCalendar();
  });

  const readTimeField = (input, min, max, fallback) => {
    const value = parseInt(input.value, 10);
    return Number.isFinite(value)
      ? Math.min(Math.max(value, min), max)
      : fallback;
  };

  const applyDateTime = () => {
    let hours = readTimeField(hourInput, 1, 12, 12) % 12;
    if (ampmSelect.value === "PM") hours += 12;
    const minutes = readTimeField(minuteInput, 0, 59, 0);
    const seconds = readTimeField(secondInput, 0, 59, 0);
    const chosen = new Date(
      state.year,
      state.month,
      state.day,
      hours,
      minutes,
      seconds,
    );
    localStorage.setItem(
      CLOCK_OFFSET_KEY,
      String(chosen.getTime() - Date.now()),
    );
    updateClockDisplay();
  };

  const row = document.createElement("div");
  row.className = "dlg-buttons";
  const okButton = XPDialogs.createDialogButton(
    { id: "ok", label: "OK", isDefault: true },
    () => {
      applyDateTime();
      dialog.close("ok");
    },
  );
  const cancelButton = XPDialogs.createDialogButton(
    { id: "cancel", label: "Cancel" },
    () => dialog.close(null),
  );
  const applyButton = XPDialogs.createDialogButton(
    { id: "apply", label: "Apply" },
    applyDateTime,
  );
  row.append(okButton, cancelButton, applyButton);
  dialog.body.appendChild(row);
  dialog.defaultButton = okButton;

  renderCalendar();
  okButton.focus();
};

const setupSystemTray = () => {
  document
    .getElementById("tray-volume-button")
    .addEventListener("click", toggleTrayVolumePopup);
  document
    .getElementById("tray-network-button")
    .addEventListener("click", openNetworkStatus);
  document
    .getElementById("taskbar-clock")
    .addEventListener("click", openDateTimeProperties);

  document
    .getElementById("tray-volume-slider")
    .addEventListener("input", (event) => {
      const volume = parseInt(event.target.value, 10);
      if (Number.isFinite(volume)) {
        // Moving the XP volume slider clears the mute flag.
        setMasterVolume(volume, false);
      }
    });
  document
    .getElementById("tray-mute-checkbox")
    .addEventListener("change", (event) => {
      setMasterVolume(getMasterVolume().volume, event.target.checked);
    });

  syncTrayVolumeUI();
};

// ============================================
// Desktop Icons
// ============================================

const DESKTOP_ICON_METRICS = Object.freeze({
  regular: { width: 76, height: 74, gap: 6, margin: 8 },
  compact: { width: 60, height: 58, gap: 4, margin: 4 },
});
let desktopDragged = false;

const getDesktopIconMetrics = (container) =>
  container.clientWidth <= 480
    ? DESKTOP_ICON_METRICS.compact
    : DESKTOP_ICON_METRICS.regular;

const getDesktopIconPositions = () => {
  const positions = readJsonStorage(
    "desktopIconPositions",
    {},
    (positions) => positions && typeof positions === "object",
  );
  let migrated = false;
  fs.getChildren(fs.DESKTOP).forEach((node) => {
    if (!node.app || !gamesList[node.app] || !positions[node.app]) return;
    if (!positions[node.id]) positions[node.id] = positions[node.app];
    delete positions[node.app];
    migrated = true;
  });
  if (migrated) writeJsonStorage("desktopIconPositions", positions);
  return positions;
};

const saveDesktopIconPosition = (icon) => {
  const positions = getDesktopIconPositions();
  positions[icon.dataset.desktopId] = {
    left: icon.offsetLeft,
    top: icon.offsetTop,
  };
  writeJsonStorage("desktopIconPositions", positions);
};

const selectDesktopIcon = (desktopId, additive = false) => {
  document.querySelectorAll(".desktop-icon").forEach((el) => {
    const shouldSelect = el.dataset.desktopId === desktopId;
    el.classList.toggle(
      "selected",
      additive
        ? el.classList.contains("selected") || shouldSelect
        : shouldSelect,
    );
  });
};

const clearDesktopSelection = () => {
  document.querySelectorAll(".desktop-icon.selected").forEach((icon) => {
    icon.classList.remove("selected");
  });
};

const getSelectedDesktopIds = () =>
  [...document.querySelectorAll(".desktop-icon.selected")].map(
    (icon) => icon.dataset.desktopId,
  );

const getSelectedFilesystemIds = () =>
  getSelectedDesktopIds().filter((id) => !!fs.getNode(id));

const getDesktopSelectionEligibility = () => {
  const selectedIds = getSelectedDesktopIds();
  const filesystemIds = selectedIds.filter((id) => !!fs.getNode(id));
  const allFilesystem =
    filesystemIds.length > 0 && filesystemIds.length === selectedIds.length;
  const movable =
    allFilesystem && filesystemIds.every((id) => !fs.isProtected(id));
  return { selectedIds, filesystemIds, allFilesystem, movable };
};

const layoutDesktopIcons = (force = false) => {
  const container = document.getElementById("desktop-icons");
  if (!container) return;

  const positions = force ? {} : getDesktopIconPositions();
  const metrics = getDesktopIconMetrics(container);
  const { width, height, gap, margin } = metrics;
  const usableWidth = Math.max(container.clientWidth - margin * 2, width);
  const usableHeight = Math.max(container.clientHeight - margin * 2, height);
  const columns = Math.max(1, Math.floor((usableWidth + gap) / (width + gap)));
  const rows = Math.max(1, Math.floor((usableHeight + gap) / (height + gap)));
  const icons = Array.from(container.querySelectorAll(".desktop-icon"));
  const overflowsViewport = icons.length > columns * rows;
  const requiredRows = overflowsViewport
    ? Math.ceil(icons.length / columns)
    : rows;
  const maxTop = Math.max(
    container.clientHeight - height,
    margin + (requiredRows - 1) * (height + gap),
  );
  const placed = [];
  const overlapsPlaced = (left, top) =>
    placed.some(
      (rect) =>
        left < rect.left + width &&
        left + width > rect.left &&
        top < rect.top + height &&
        top + height > rect.top,
    );
  const firstFreeGridSlot = () => {
    for (let row = 0; row < requiredRows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const left = margin + column * (width + gap);
        const top = margin + row * (height + gap);
        if (!overlapsPlaced(left, top)) return { left, top };
      }
    }
    return { left: margin, top: margin + requiredRows * (height + gap) };
  };
  container.classList.toggle("desktop-icons-overflow", overflowsViewport);
  container.style.setProperty(
    "--desktop-icon-overflow-height",
    `${margin + requiredRows * (height + gap)}px`,
  );

  icons.forEach((icon, index) => {
    const saved = positions[icon.dataset.desktopId];
    const column = overflowsViewport
      ? index % columns
      : Math.floor(index / rows);
    const row = overflowsViewport ? Math.floor(index / columns) : index % rows;
    let fallbackLeft = margin + column * (width + gap);
    let fallbackTop = margin + row * (height + gap);
    // The Recycle Bin anchors to the bottom-right corner unless the
    // user has dragged it somewhere else.
    if (icon.dataset.desktopId === "__recycle-bin") {
      if (!overflowsViewport) {
        fallbackLeft = container.clientWidth - width - margin;
        fallbackTop = container.clientHeight - height - margin;
      }
    }
    const savedLeft = saved?.left;
    const savedTop = saved?.top;
    const savedIsValid =
      Number.isFinite(savedLeft) &&
      Number.isFinite(savedTop) &&
      savedLeft >= 0 &&
      savedLeft <= container.clientWidth - width &&
      savedTop >= 0 &&
      savedTop <= maxTop &&
      !overlapsPlaced(savedLeft, savedTop);
    let left = savedIsValid ? savedLeft : fallbackLeft;
    let top = savedIsValid ? savedTop : fallbackTop;
    left = Math.max(0, Math.min(left, container.clientWidth - width));
    top = Math.max(0, Math.min(top, maxTop));
    if (overlapsPlaced(left, top)) ({ left, top } = firstFreeGridSlot());
    placed.push({ left, top });
    icon.style.left = `${left}px`;
    icon.style.top = `${top}px`;
  });

  if (force) {
    localStorage.removeItem("desktopIconPositions");
  }
};

const wireDesktopIconDrag = (icon) => {
  icon.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    const additive = event.ctrlKey || event.metaKey;
    if (!icon.classList.contains("selected")) {
      selectDesktopIcon(icon.dataset.desktopId, additive);
    }

    const startX = event.clientX;
    const startY = event.clientY;
    const selected = [
      ...document.querySelectorAll(".desktop-icon.selected"),
    ].map((item) => ({
      item,
      left: item.offsetLeft,
      top: item.offsetTop,
    }));
    const container = document.getElementById("desktop-icons");
    desktopDragged = false;

    const onMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      if (!desktopDragged && Math.hypot(deltaX, deltaY) < 4) return;

      desktopDragged = true;
      const groupLeft = Math.min(...selected.map(({ left }) => left));
      const groupTop = Math.min(...selected.map(({ top }) => top));
      const groupRight = Math.max(
        ...selected.map(({ item, left }) => left + item.offsetWidth),
      );
      const groupBottom = Math.max(
        ...selected.map(({ item, top }) => top + item.offsetHeight),
      );
      const clampedX = Math.max(
        -groupLeft,
        Math.min(deltaX, container.clientWidth - groupRight),
      );
      const clampedY = Math.max(
        -groupTop,
        Math.min(deltaY, container.clientHeight - groupBottom),
      );
      selected.forEach(({ item, left: startLeft, top: startTop }) => {
        const left = startLeft + clampedX;
        const top = startTop + clampedY;
        item.style.left = `${left}px`;
        item.style.top = `${top}px`;
      });
    };

    const onUp = () => {
      icon.removeEventListener("pointermove", onMove);
      icon.removeEventListener("pointerup", onUp);
      icon.removeEventListener("pointercancel", onUp);
      if (desktopDragged) {
        const { alignToGrid } = getDesktopLayoutSettings();
        selected.forEach(({ item }) => {
          if (alignToGrid) {
            const metrics = getDesktopIconMetrics(container);
            item.style.left = `${metrics.margin + Math.round((item.offsetLeft - metrics.margin) / (metrics.width + metrics.gap)) * (metrics.width + metrics.gap)}px`;
            item.style.top = `${metrics.margin + Math.round((item.offsetTop - metrics.margin) / (metrics.height + metrics.gap)) * (metrics.height + metrics.gap)}px`;
          }
          saveDesktopIconPosition(item);
        });
      }
    };

    try {
      icon.setPointerCapture(event.pointerId);
    } catch (error) {
      /* pointer capture unsupported */
    }

    icon.addEventListener("pointermove", onMove);
    icon.addEventListener("pointerup", onUp);
    icon.addEventListener("pointercancel", onUp);
  });
};

const wireDesktopSelectionRectangle = () => {
  const container = document.getElementById("desktop-icons");
  const rectangle = document.getElementById("desktop-selection");

  container.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target !== container) return;

    closeDesktopContextMenu();
    const additive = event.ctrlKey || event.metaKey;
    const initialSelection = new Set(
      Array.from(document.querySelectorAll(".desktop-icon.selected")).map(
        (icon) => icon.dataset.desktopId,
      ),
    );
    if (!additive) {
      clearDesktopSelection();
    }

    const bounds = container.getBoundingClientRect();
    const startX = event.clientX - bounds.left;
    const startY = event.clientY - bounds.top;
    rectangle.hidden = false;
    rectangle.style.left = `${startX}px`;
    rectangle.style.top = `${startY}px`;
    rectangle.style.width = "0";
    rectangle.style.height = "0";

    const onMove = (moveEvent) => {
      const currentX = Math.max(
        0,
        Math.min(moveEvent.clientX - bounds.left, bounds.width),
      );
      const currentY = Math.max(
        0,
        Math.min(moveEvent.clientY - bounds.top, bounds.height),
      );
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      Object.assign(rectangle.style, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
      });

      document.querySelectorAll(".desktop-icon").forEach((icon) => {
        const intersects =
          icon.offsetLeft < left + width &&
          icon.offsetLeft + icon.offsetWidth > left &&
          icon.offsetTop < top + height &&
          icon.offsetTop + icon.offsetHeight > top;
        icon.classList.toggle(
          "selected",
          intersects ||
            (additive && initialSelection.has(icon.dataset.desktopId)),
        );
      });
    };

    const onUp = () => {
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerup", onUp);
      container.removeEventListener("pointercancel", onUp);
      rectangle.hidden = true;
    };

    try {
      container.setPointerCapture(event.pointerId);
    } catch (error) {
      /* pointer capture unsupported */
    }

    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerup", onUp);
    container.addEventListener("pointercancel", onUp);
    event.preventDefault();
  });
};

const buildDesktopIcons = () => {
  const wasBuilt = iconsBuilt;
  iconsBuilt = true;

  const container = document.getElementById("desktop-icons");
  container.replaceChildren();
  // System places stay available even though regular desktop files are
  // rendered directly from VirtualFS.DESKTOP.
  const desktopItems = [
    "__my-computer",
    "__my-documents",
    "__internet-games",
    "__astro-settings",
  ].filter((id) => systemShortcuts[id]?.desktop !== false);
  const recycleBinItems = ["__recycle-bin"].filter(
    (id) => systemShortcuts[id]?.desktop !== false,
  );
  const desktopSort = getDesktopLayoutSettings().sort;
  const compareDesktopNodes = (a, b) => {
    if (desktopSort === "size")
      return a.size - b.size || a.name.localeCompare(b.name);
    if (desktopSort === "type")
      return (
        (a.ext || a.type).localeCompare(b.ext || b.type) ||
        a.name.localeCompare(b.name)
      );
    if (desktopSort === "modified")
      return b.modified - a.modified || a.name.localeCompare(b.name);
    return a.name.localeCompare(b.name);
  };
  const entries = [
    ...desktopItems.map((id) => ({ id, system: true })),
    ...fs
      .getChildren(fs.DESKTOP)
      .slice()
      .sort(compareDesktopNodes)
      .map((node) => ({ id: node.id, node })),
    // Recycle Bin is anchored independently, so keep it after flowing
    // entries to avoid leaving an unused grid slot near the first game.
    ...recycleBinItems.map((id) => ({ id, system: true })),
  ];

  entries.forEach(({ id, system, node }) => {
    const icon = document.createElement("button");
    icon.type = "button";
    icon.className = "desktop-icon";
    icon.dataset.desktopId = id;
    if (system) icon.dataset.systemId = id;
    if (node && !node.protected) {
      icon.title = "Alt+drag to move this item to a folder";
      icon.setAttribute(
        "aria-description",
        "Hold Alt while dragging to move this file or folder.",
      );
      icon.addEventListener("pointerdown", (event) => {
        icon.draggable = event.altKey;
      });
      icon.addEventListener("pointerup", () => {
        icon.draggable = false;
      });
      icon.addEventListener("dragstart", (event) => {
        const eligibility = getDesktopSelectionEligibility();
        if (!event.altKey || !eligibility.movable) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData(
          "application/x-astro-vfs-ids",
          JSON.stringify(eligibility.filesystemIds),
        );
        event.dataTransfer.effectAllowed = "move";
      });
      icon.addEventListener("dragend", () => {
        icon.draggable = false;
      });
    }

    const glyph = system
      ? createGameIconElement(id, "icon-glyph")
      : node.app && gamesList[node.app]
        ? createGameIconElement(node.app, "icon-glyph")
        : createExplorerIcon(node);
    glyph.classList.add("icon-glyph");

    const label = document.createElement("span");
    label.className = "icon-label";
    label.textContent = system
      ? formatGameTitle(id)
      : node.ext === ".game"
        ? node.name.slice(0, -node.ext.length)
        : node.name;

    icon.append(glyph, label);
    icon.addEventListener("click", (event) => {
      if (!desktopDragged) {
        selectDesktopIcon(id, event.ctrlKey || event.metaKey);
      }
    });
    icon.addEventListener("dblclick", () => {
      if (!desktopDragged) {
        openDesktopItem(id);
      }
    });
    icon.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        openDesktopItem(id);
      }
    });
    wireDesktopIconDrag(icon);
    container.appendChild(icon);
  });

  if (!wasBuilt) wireDesktopSelectionRectangle();
  if (!wasBuilt) wireFolderDropTarget(container, fs.DESKTOP);
  requestAnimationFrame(() =>
    layoutDesktopIcons(getDesktopLayoutSettings().autoArrange),
  );
};

const closeDesktopContextMenu = () => {
  const menu = document.getElementById("desktop-context-menu");
  if (menu) menu.hidden = true;
};

const getDesktopLayoutSettings = () =>
  readJsonStorage("desktopLayoutSettings", {
    sort: "name",
    autoArrange: false,
    alignToGrid: true,
  });

const saveDesktopLayoutSettings = (settings) =>
  writeJsonStorage("desktopLayoutSettings", settings);

const refreshDesktop = () => {
  const icons = document.getElementById("desktop-icons");
  icons.classList.remove("desktop-refresh");
  requestAnimationFrame(() => icons.classList.add("desktop-refresh"));
  buildDesktopIcons();
};

const beginDesktopRename = (id) => {
  const icon = document.querySelector(
    `.desktop-icon[data-desktop-id="${CSS.escape(id)}"]`,
  );
  const node = fs.getNode(id);
  if (!icon || !node || node.protected) return;
  const label = icon.querySelector(".icon-label");
  const input = document.createElement("input");
  input.className = "desktop-rename";
  input.value = node.name;
  label.replaceWith(input);
  input.focus();
  input.select();
  let finished = false;
  const finish = (save) => {
    if (finished) return;
    finished = true;
    if (save) {
      try {
        fileOps.rename(id, input.value);
      } catch (error) {
        console.error(error);
      }
    }
    refreshDesktop();
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") finish(true);
    if (event.key === "Escape") finish(false);
  });
  input.addEventListener("blur", () => finish(true), { once: true });
};

const addDesktopMenuItem = (
  menu,
  label,
  action,
  { disabled = false, checked = false } = {},
) => {
  const button = document.createElement("button");
  button.type = "button";
  button.role = "menuitem";
  button.dataset.action = action;
  button.disabled = disabled;
  button.textContent = `${checked ? "✓ " : ""}${label}`;
  menu.appendChild(button);
};

const addDesktopSubmenu = (menu, label, buildItems) => {
  const parent = document.createElement("div");
  parent.className = "context-parent";
  const button = document.createElement("button");
  button.type = "button";
  button.role = "menuitem";
  button.className = "context-submenu-button";
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-expanded", "false");
  button.textContent = label;
  const arrow = document.createElement("span");
  arrow.className = "context-arrow";
  button.appendChild(arrow);
  const child = document.createElement("div");
  child.className = "xp-context-menu context-submenu";
  child.setAttribute("role", "menu");
  buildItems(child);
  const open = () => {
    parent.classList.add("open");
    button.setAttribute("aria-expanded", "true");
    child.style.left = "100%";
    child.style.top = "-2px";
    const rect = child.getBoundingClientRect();
    if (rect.right > window.innerWidth)
      child.style.left = `${-child.offsetWidth + 2}px`;
  };
  const close = () => {
    parent.classList.remove("open");
    button.setAttribute("aria-expanded", "false");
  };
  parent.addEventListener("pointerenter", open);
  parent.addEventListener("pointerleave", close);
  button.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      open();
      child.querySelector("button:not(:disabled)")?.focus();
    }
  });
  child.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      close();
      button.focus();
    }
  });
  parent.append(button, child);
  menu.appendChild(parent);
};

const addDesktopSeparator = (menu) => {
  const separator = document.createElement("span");
  separator.className = "context-separator";
  separator.setAttribute("aria-hidden", "true");
  menu.appendChild(separator);
};

const renderDesktopContextMenu = (menu, itemId = null) => {
  const {
    filesystemIds: selectedFsIds,
    allFilesystem,
    movable,
  } = getDesktopSelectionEligibility();
  const settings = getDesktopLayoutSettings();
  menu.replaceChildren();
  menu.dataset.itemId = itemId || "";

  if (itemId) {
    addDesktopMenuItem(menu, "Open", "open");
    addDesktopSeparator(menu);
    addDesktopMenuItem(menu, "Cut", "cut", { disabled: !movable });
    addDesktopMenuItem(menu, "Copy", "copy", { disabled: !allFilesystem });
    addDesktopMenuItem(menu, "Delete", "delete", { disabled: !movable });
    addDesktopMenuItem(menu, "Rename", "rename", {
      disabled: !movable || selectedFsIds.length !== 1,
    });
    addDesktopSeparator(menu);
    addDesktopMenuItem(menu, "Properties", "item-properties", {
      disabled: selectedFsIds.length !== 1,
    });
  } else {
    addDesktopSubmenu(menu, "Arrange Icons By", (submenu) => {
      addDesktopMenuItem(submenu, "Name", "sort-name", {
        checked: settings.sort === "name",
      });
      addDesktopMenuItem(submenu, "Size", "sort-size", {
        checked: settings.sort === "size",
      });
      addDesktopMenuItem(submenu, "Type", "sort-type", {
        checked: settings.sort === "type",
      });
      addDesktopMenuItem(submenu, "Modified", "sort-modified", {
        checked: settings.sort === "modified",
      });
    });
    addDesktopMenuItem(menu, "Auto Arrange", "auto-arrange", {
      checked: settings.autoArrange,
    });
    addDesktopMenuItem(menu, "Align to Grid", "align-grid", {
      checked: settings.alignToGrid,
    });
    addDesktopSeparator(menu);
    addDesktopMenuItem(menu, "Refresh", "refresh");
    addDesktopSeparator(menu);
    addDesktopMenuItem(menu, "Paste", "paste", {
      disabled: !fileOps.canPaste(fs.DESKTOP),
    });
    addDesktopMenuItem(menu, "Paste Shortcut", "paste-shortcut", {
      disabled: true,
    });
    addDesktopSeparator(menu);
    addDesktopSubmenu(menu, "New", (submenu) => {
      addDesktopMenuItem(submenu, "Folder", "new-folder");
      addDesktopMenuItem(submenu, "Text Document", "new-text");
    });
    addDesktopSeparator(menu);
    addDesktopMenuItem(menu, "Properties", "properties");
  }
};

const openDesktopContextMenu = (clientX, clientY, itemId = null) => {
  const desktop = document.getElementById("desktop");
  const menu = document.getElementById("desktop-context-menu");
  const bounds = desktop.getBoundingClientRect();

  closeStartMenu();
  renderDesktopContextMenu(menu, itemId);
  menu.hidden = false;
  menu.style.left = "0";
  menu.style.top = "0";

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

const setupDesktopContextMenu = () => {
  const desktop = document.getElementById("desktop");
  const menu = document.getElementById("desktop-context-menu");

  desktop.addEventListener("contextmenu", (event) => {
    if (event.target.closest(".xp-window, #start-menu")) return;
    event.preventDefault();
    const icon = event.target.closest(".desktop-icon");
    if (!icon) {
      clearDesktopSelection();
    } else if (!icon.classList.contains("selected")) {
      selectDesktopIcon(icon.dataset.desktopId);
    }
    openDesktopContextMenu(
      event.clientX,
      event.clientY,
      icon?.dataset.desktopId || null,
    );
  });

  menu.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;

    const itemId = menu.dataset.itemId || null;
    const selectedFsIds = getSelectedFilesystemIds();
    if (action.startsWith("sort-")) {
      saveDesktopLayoutSettings({
        ...getDesktopLayoutSettings(),
        sort: action.slice(5),
        autoArrange: true,
      });
      layoutDesktopIcons(true);
    } else if (action === "auto-arrange") {
      const settings = getDesktopLayoutSettings();
      saveDesktopLayoutSettings({
        ...settings,
        autoArrange: !settings.autoArrange,
      });
      if (!settings.autoArrange) layoutDesktopIcons(true);
    } else if (action === "align-grid") {
      const settings = getDesktopLayoutSettings();
      saveDesktopLayoutSettings({
        ...settings,
        alignToGrid: !settings.alignToGrid,
      });
    } else if (action === "refresh") {
      refreshDesktop();
    } else if (action === "new-folder" || action === "new-text") {
      const node =
        action === "new-folder"
          ? fileOps.createFolder(fs.DESKTOP, "New Folder")
          : fileOps.createFile(fs.DESKTOP, "New Text Document.txt");
      refreshDesktop();
      selectDesktopIcon(node.id);
      beginDesktopRename(node.id);
    } else if (action === "paste") {
      pasteIntoFolder(fs.DESKTOP);
    } else if (action === "open" && itemId) {
      openDesktopItem(itemId);
    } else if (action === "cut") {
      fileOps.cut(selectedFsIds);
    } else if (action === "copy") {
      fileOps.copy(selectedFsIds);
    } else if (action === "delete") {
      XPDialogs.confirm(
        selectedFsIds.length === 1
          ? "Are you sure you want to send this item to the Recycle Bin?"
          : "Are you sure you want to send these items to the Recycle Bin?",
        "Confirm File Delete",
        "warning",
      ).then((yes) => yes && confirmRecycleDelete(selectedFsIds));
    } else if (action === "rename" && selectedFsIds[0]) {
      beginDesktopRename(selectedFsIds[0]);
    } else if (action === "item-properties" && selectedFsIds[0]) {
      XPDialogs.properties(selectedFsIds[0]);
    } else if (action === "properties") {
      openSystemWindow("__display-properties");
    }
    closeDesktopContextMenu();
  });
  menu.addEventListener("keydown", (event) => {
    const items = [...menu.querySelectorAll("button:not(:disabled)")];
    const current = items.indexOf(document.activeElement);
    if (event.key === "Escape") {
      closeDesktopContextMenu();
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const target =
        event.key === "Home"
          ? items[0]
          : event.key === "End"
            ? items.at(-1)
            : items[
                (current +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  items.length) %
                  items.length
              ];
      target?.focus();
    }
  });
};

// ============================================
// Start Menu
// ============================================

const createMenuGameItem = (gameId) => {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "sm-game";

  const icon = createGameIconElement(gameId, "sm-game-icon");

  const title = document.createElement("span");
  title.className = "sm-game-title";
  title.textContent = formatGameTitle(gameId);

  item.append(icon, title);

  const stats = getGameStats()[gameId];
  if (stats) {
    const playCount = document.createElement("span");
    playCount.className = "play-count";
    playCount.textContent = `${stats.plays} ${stats.plays === 1 ? "play" : "plays"}`;
    item.appendChild(playCount);
  }

  item.addEventListener("click", () => {
    closeStartMenu();
    openGameWindow(gameId);
  });
  return item;
};

const getProgramGroups = () => {
  const groups = {};
  const addToGroup = (category, gameId) => {
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(gameId);
  };

  const gameStats = getGameStats();
  Object.entries(gameStats)
    .sort((a, b) => b[1].lastPlayed - a[1].lastPlayed)
    .slice(0, 8)
    .forEach(([gameId]) => {
      if (gamesList[gameId]) addToGroup("Recently Played", gameId);
    });

  getFavorites().forEach((gameId) => {
    if (gamesList[gameId]) addToGroup("Favorites", gameId);
  });

  Object.entries(gamesList).forEach(([gameId, game]) => {
    addToGroup(game.category || "Other", gameId);
  });

  return Object.keys(groups)
    .sort((catA, catB) => {
      if (catA === "Recently Played") return -1;
      if (catB === "Recently Played") return 1;
      if (catA === "Favorites") return -1;
      if (catB === "Favorites") return 1;
      return catA.localeCompare(catB);
    })
    .map((category) => [
      category,
      groups[category]
        .slice()
        .sort((a, b) => formatGameTitle(a).localeCompare(formatGameTitle(b))),
    ]);
};

const getUniqueCategoryMnemonics = (groups) => {
  const used = new Set();
  return new Map(
    groups.map(([category]) => {
      const index = [...category].findIndex(
        (character) =>
          /[\p{L}\p{N}]/u.test(character) && !used.has(character.toLowerCase()),
      );
      const marker = index < 0 ? 0 : index;
      const key = category[marker].toLowerCase();
      used.add(key);
      return [
        category,
        `${category.slice(0, marker)}&${category.slice(marker)}`,
      ];
    }),
  );
};

const openRecentDocuments = () => {
  const dialog = XPDialogs.createDialog({ title: "My Recent Documents" });
  const recentGames = Object.entries(getGameStats())
    .filter(([gameId]) => gamesList[gameId])
    .sort(([, a], [, b]) => b.lastPlayed - a.lastPlayed)
    .slice(0, 10)
    .map(([gameId]) => gameId);

  const heading = document.createElement("p");
  heading.textContent = "Documents you have opened recently:";
  dialog.body.appendChild(heading);

  if (!recentGames.length) {
    const empty = document.createElement("p");
    empty.textContent = "There are no recent documents.";
    dialog.body.appendChild(empty);
  } else {
    const list = document.createElement("div");
    list.className = "shell-dialog-list";
    recentGames.forEach((gameId) => {
      const item = document.createElement("button");
      item.type = "button";
      item.textContent = formatGameTitle(gameId);
      item.addEventListener("click", () => {
        dialog.close();
        openGameWindow(gameId);
      });
      list.appendChild(item);
    });
    dialog.body.appendChild(list);
  }
  XPDialogs.addButtonRow(dialog, [
    { id: "close", label: "Close", isDefault: true, isCancel: true },
  ]);
};

const openControlPanel = () => {
  const dialog = XPDialogs.createDialog({ title: "Control Panel" });
  const heading = document.createElement("p");
  heading.textContent = "Pick a category to change a setting.";
  const list = document.createElement("div");
  list.className = "shell-dialog-list";
  [
    ["Internet Games", () => openSystemWindow("__internet-games")],
    ["Display", () => openSystemWindow("__display-properties")],
    ["Date and Time", openDateTimeProperties],
    ["Astro Flash Settings", openProjectSettings],
  ].forEach(([label, action]) => {
    const item = document.createElement("button");
    item.type = "button";
    item.textContent = label;
    item.addEventListener("click", () => {
      dialog.close();
      action();
    });
    list.appendChild(item);
  });
  dialog.body.append(heading, list);
  XPDialogs.addButtonRow(dialog, [
    { id: "close", label: "Close", isDefault: true, isCancel: true },
  ]);
};

const openPrintersAndFaxes = () => {
  const dialog = XPDialogs.createDialog({ title: "Printers and Faxes" });
  const message = document.createElement("p");
  message.textContent = "No printers are installed.";
  const addPrinter = XPDialogs.createDialogButton(
    { id: "add", label: "Add a &Printer" },
    () => {
      dialog.close();
      XPDialogs.message({
        title: "Add Printer Wizard",
        text: "Printer setup is not available in Astro Flash.",
        icon: "info",
      });
    },
  );
  dialog.body.append(message, addPrinter);
  XPDialogs.addButtonRow(dialog, [
    { id: "close", label: "Close", isDefault: true, isCancel: true },
  ]);
};

const openHelpAndSupport = () => {
  const dialog = XPDialogs.createDialog({
    title: "Help and Support Center",
    wide: true,
  });
  const heading = document.createElement("h2");
  heading.textContent = "Astro Flash Help and Support";
  const help = document.createElement("p");
  help.textContent =
    "Open games from the desktop or Start menu. Use F11 for full screen, and the taskbar to switch between open windows.";
  const support = document.createElement("a");
  support.href = "https://github.com/astrovm/flash/issues";
  support.target = "_blank";
  support.rel = "noopener noreferrer";
  support.textContent = "Get support or send feedback";
  dialog.body.append(heading, help, support);
  XPDialogs.addButtonRow(dialog, [
    { id: "close", label: "Close", isDefault: true, isCancel: true },
  ]);
};

const openSearchDialog = () => openSystemWindow("__search");

const openRunDialog = () => {
  const dialog = XPDialogs.createDialog({ title: "Run" });
  const intro = document.createElement("p");
  intro.textContent =
    "Type the name of a program, folder, document, or Internet resource, and Windows will open it for you.";
  const prompt = document.createElement("label");
  setAccessKeyText(prompt, "&Open:");
  const input = document.createElement("input");
  input.type = "text";
  input.className = "shell-dialog-input";
  input.setAttribute("list", "run-command-history");
  input.id = "run-command";
  const history = document.createElement("datalist");
  history.id = "run-command-history";
  getRunHistory().forEach((entry) =>
    history.appendChild(new Option(entry, entry)),
  );
  prompt.appendChild(input);
  const status = document.createElement("p");
  status.className = "shell-dialog-status";
  const run = () => {
    const resolved = resolveShellCommand(input.value);
    if (!resolved || resolved.run() === false) {
      status.textContent = `Windows cannot find "${input.value}". Make sure you typed the name correctly, and then try again.`;
      XPDialogs.alert(status.textContent, "Run", "error");
      return;
    }
    rememberRunCommand(input.value);
    dialog.close();
  };
  const runButton = XPDialogs.createDialogButton(
    { id: "run", label: "&OK" },
    run,
  );
  const browseButton = XPDialogs.createDialogButton(
    { id: "browse", label: "&Browse..." },
    async () => {
      const node = await XPDialogs.openFile({ title: "Browse" });
      if (node) input.value = fs.getPath(node.id);
      input.focus();
    },
  );
  const cancelButton = XPDialogs.createDialogButton(
    { id: "cancel", label: "Cancel" },
    () => dialog.close(),
  );
  const row = document.createElement("div");
  row.className = "dlg-buttons";
  row.append(runButton, cancelButton, browseButton);
  dialog.body.append(intro, prompt, history, status, row);
  dialog.defaultButton = runButton;
  [
    [runButton, "&OK"],
    [cancelButton, "Cancel"],
    [browseButton, "&Browse..."],
  ].forEach(([button, label]) => {
    const { key } = XPDialogs.parseAccessKey(label);
    if (key && !dialog.accessKeys.has(key)) dialog.accessKeys.set(key, button);
  });
  dialog.accessKeys.set("o", { disabled: false, click: () => input.focus() });
  input.focus();
};

const startDestinationActions = {
  documents: () => openSystemWindow("__my-documents"),
  recent: openRecentDocuments,
  pictures: () => openSystemWindow("__my-pictures"),
  music: () => openSystemWindow("__my-music"),
  computer: () => openSystemWindow("__my-computer"),
  controlPanel: openControlPanel,
  printers: openPrintersAndFaxes,
  help: openHelpAndSupport,
  search: openSearchDialog,
  run: openRunDialog,
};

const buildPlaces = () => {
  if (placesBuilt) return;
  placesBuilt = true;

  const container = document.getElementById("start-menu-places");
  const createPlace = ({ id, label, icon, title = label }) => {
    const { key } = XPDialogs.parseAccessKey(label);
    const item = document.createElement("button");
    item.className = "sm-place";
    item.type = "button";
    item.dataset.startAction = id;
    item.dataset.accessKey = key;
    item.title = XPDialogs.parseAccessKey(title).text;

    const glyph = document.createElement("span");
    glyph.className = "sm-place-icon";
    if (icon.endsWith(".png")) {
      const image = document.createElement("img");
      image.src = `assets/xp/icons/${icon}`;
      image.alt = "";
      glyph.appendChild(image);
    } else {
      glyph.textContent = icon;
    }

    const text = document.createElement("span");
    setAccessKeyText(text, label);
    item.append(glyph, text);
    item.addEventListener("click", () => {
      closeStartMenu();
      startDestinationActions[id]();
    });
    return item;
  };

  container.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const item = container.querySelector(
      `[data-access-key="${event.key.toLowerCase()}"]`,
    );
    if (!item) return;
    event.preventDefault();
    item.click();
  });

  [
    ["documents", "My &Documents", "MyDocuments.png"],
    ["recent", "My &Recent Documents", "RecentDocuments.png"],
    ["pictures", "My &Pictures", "MyPictures.png"],
    ["music", "My &Music", "MyMusic.png"],
    ["computer", "My &Computer", "MyComputer.png"],
  ].forEach(([id, label, icon]) =>
    container.appendChild(createPlace({ id, label, icon })),
  );

  const separatorOne = document.createElement("div");
  separatorOne.className = "sm-place-separator";
  container.appendChild(separatorOne);

  [
    ["controlPanel", "&Control Panel", "ControlPanel.png"],
    ["printers", "&Printers and Faxes", "PrintersandFaxes.png"],
    ["help", "&Help and Support", "HelpandSupport.png"],
  ].forEach(([id, label, icon]) =>
    container.appendChild(createPlace({ id, label, icon })),
  );

  [
    ["search", "&Search", "Search.png"],
    ["run", "&Run...", "Run.png"],
  ].forEach(([id, label, icon]) =>
    container.appendChild(createPlace({ id, label, icon })),
  );
};

const buildPinnedPrograms = () => {
  const container = document.getElementById("start-menu-pinned");
  container.innerHTML = "";

  const internetGames = document.createElement("button");
  internetGames.type = "button";
  internetGames.className = "sm-game";
  const internetIcon = createGameIconElement(
    "__internet-games",
    "sm-game-icon",
  );
  const internetTitle = document.createElement("span");
  internetTitle.className = "sm-game-title";
  internetTitle.textContent = "Internet Games";
  internetGames.append(internetIcon, internetTitle);
  internetGames.addEventListener("click", () => {
    closeStartMenu();
    openSystemWindow("__internet-games");
  });
  container.appendChild(internetGames);

  const gameStats = getGameStats();
  const recentGames = Object.entries(gameStats)
    .filter(([gameId]) => gamesList[gameId])
    .sort((a, b) => b[1].lastPlayed - a[1].lastPlayed)
    .map(([gameId]) => gameId);

  const pinned = [
    ...getFavorites().filter((gameId) => gamesList[gameId]),
    ...recentGames,
    ...Object.keys(gamesList).sort((a, b) =>
      formatGameTitle(a).localeCompare(formatGameTitle(b)),
    ),
  ]
    .filter((gameId, index, all) => all.indexOf(gameId) === index)
    .slice(0, 6);

  pinned.forEach((gameId) => container.appendChild(createMenuGameItem(gameId)));
};

let startFlyoutTimer = null;
const closeAllPrograms = () => {
  clearTimeout(startFlyoutTimer);
  const host = document.getElementById("start-menu-flyouts");
  host.replaceChildren();
  host.hidden = true;
  document.getElementById("all-programs-button").classList.remove("active");
};

const positionStartFlyout = (panel, anchor) => {
  const rect = anchor.getBoundingClientRect();
  const taskbarTop =
    document.getElementById("taskbar")?.getBoundingClientRect().top ??
    innerHeight;
  panel.style.visibility = "hidden";
  panel.style.left = "0px";
  panel.style.top = "0px";
  panel.style.maxHeight = `${Math.max(80, taskbarTop - 4)}px`;
  const width = panel.offsetWidth;
  const height = panel.offsetHeight;
  const right = rect.right + width <= innerWidth - 2;
  panel.style.left = `${Math.max(2, Math.min(right ? rect.right : rect.left - width, innerWidth - width - 2))}px`;
  panel.style.top = `${Math.max(2, Math.min(rect.top, taskbarTop - height - 2))}px`;
  panel.style.visibility = "";
};

const wireStartFlyoutKeyboard = (panel, parentButton) => {
  panel.addEventListener("keydown", (event) => {
    const items = [...panel.querySelectorAll("button")];
    const index = items.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      closeAllPrograms();
      parentButton.focus();
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next =
        event.key === "Home"
          ? items[0]
          : event.key === "End"
            ? items.at(-1)
            : items[
                (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
                  items.length
              ];
      next?.focus();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      parentButton.focus();
      return;
    }
    const item = items.find(
      (entry) => entry.dataset.accessKey === event.key.toLowerCase(),
    );
    if (item) {
      event.preventDefault();
      item.click();
    }
  });
};

const openProgramsFolder = (category, games, anchor) => {
  const host = document.getElementById("start-menu-flyouts");
  [...host.querySelectorAll(".start-program-flyout")]
    .slice(1)
    .forEach((panel) => panel.remove());
  const panel = document.createElement("div");
  panel.className = "start-program-flyout";
  panel.setAttribute("role", "menu");
  games.forEach((gameId) => {
    const item = createMenuGameItem(gameId);
    item.setAttribute("role", "menuitem");
    panel.appendChild(item);
  });
  host.appendChild(panel);
  positionStartFlyout(panel, anchor);
  wireStartFlyoutKeyboard(panel, anchor);
  panel.addEventListener("pointerenter", () => clearTimeout(startFlyoutTimer));
  panel.addEventListener("pointerleave", () => {
    startFlyoutTimer = setTimeout(closeAllPrograms, 420);
  });
};

const openAllPrograms = (focusFirst = false) => {
  clearTimeout(startFlyoutTimer);
  const host = document.getElementById("start-menu-flyouts");
  const button = document.getElementById("all-programs-button");
  host.replaceChildren();
  host.hidden = false;
  button.classList.add("active");
  const panel = document.createElement("div");
  panel.className = "start-program-flyout";
  panel.setAttribute("role", "menu");
  const groups = getProgramGroups();
  const mnemonics = getUniqueCategoryMnemonics(groups);
  groups.forEach(([category, games]) => {
    const folder = document.createElement("button");
    folder.type = "button";
    folder.className = "start-program-folder";
    folder.dataset.category = category;
    folder.setAttribute("role", "menuitem");
    folder.setAttribute("aria-haspopup", "menu");
    const label = document.createElement("span");
    const mnemonic = mnemonics.get(category);
    const { key } = setAccessKeyText(label, mnemonic);
    folder.dataset.accessKey = key;
    const icon = document.createElement("span");
    icon.textContent = categoryIcons[category] || categoryIcons.Other;
    folder.append(
      icon,
      label,
      Object.assign(document.createElement("span"), {
        className: "start-program-arrow",
        textContent: "▶",
      }),
    );
    const open = (withFocus = false) => {
      openProgramsFolder(category, games, folder);
      if (withFocus)
        host
          .querySelectorAll(".start-program-flyout")[1]
          ?.querySelector("button")
          ?.focus();
    };
    folder.addEventListener("pointerenter", () => {
      clearTimeout(startFlyoutTimer);
      startFlyoutTimer = setTimeout(open, 220);
    });
    folder.addEventListener("click", () => open(true));
    folder.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        open(true);
      }
    });
    panel.appendChild(folder);
  });
  host.appendChild(panel);
  positionStartFlyout(panel, button);
  wireStartFlyoutKeyboard(panel, button);
  panel.addEventListener("pointerenter", () => clearTimeout(startFlyoutTimer));
  panel.addEventListener("pointerleave", () => {
    startFlyoutTimer = setTimeout(closeAllPrograms, 420);
  });
  if (focusFirst) panel.querySelector("button")?.focus();
};

const toggleAllPrograms = () => {
  const host = document.getElementById("start-menu-flyouts");
  if (host.hidden) openAllPrograms(true);
  else closeAllPrograms();
};

const openStartMenu = () => {
  buildPinnedPrograms();
  closeAllPrograms();
  document.getElementById("start-menu").hidden = false;
  document.getElementById("start-button").classList.add("active");
};

const closeStartMenu = () => {
  closeAllPrograms();
  document.getElementById("start-menu").hidden = true;
  document.getElementById("start-button").classList.remove("active");
};

const toggleStartMenu = () => {
  const startMenu = document.getElementById("start-menu");
  if (startMenu.hidden) {
    openStartMenu();
  } else {
    closeStartMenu();
  }
};

const setupSearch = () => {
  const button = document.getElementById("all-programs-button");
  button.addEventListener("click", toggleAllPrograms);
  button.addEventListener("pointerenter", () => {
    if (!document.getElementById("start-menu").hidden) {
      clearTimeout(startFlyoutTimer);
      startFlyoutTimer = setTimeout(openAllPrograms, 220);
    }
  });
  button.addEventListener("keydown", (event) => {
    if (["ArrowRight", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      openAllPrograms(true);
    }
  });
};

// ============================================
// Screen Flow (boot -> welcome -> desktop)
// ============================================

// Original Windows XP system sounds (playback is skipped if the
// browser still blocks audio before the user's first interaction)
const playXPSound = (name) => {
  const { volume, isMuted } = getMasterVolume();
  const audio = new Audio(`assets/xp/sounds/${name}.mp3`);
  audio.volume = isMuted ? 0 : Math.min(Math.max(volume, 0), 100) / 100;
  audio.play().catch(() => {});
};

let startupSoundPending = true;

const setScreen = (...visibleIds) => {
  [
    "boot-screen",
    "welcome-screen",
    "desktop",
    "taskbar",
    "shutdown-screen",
    "turn-off-screen",
  ].forEach((id) => {
    document.getElementById(id).hidden = !visibleIds.includes(id);
  });
};

const setSuspended = (value) => {
  suspended = value;
  const standbyScreen = document.getElementById("standby-screen");
  standbyScreen.hidden = !value;

  if (value) {
    closeStartMenu();
    closeDesktopContextMenu();
    closeWindowSystemMenu();
    closeTaskbarMenus();
    closeTrayVolumePopup();
    muteAllWindows();
    document.getElementById("standby-resume").focus();
  } else if (loggedIn) {
    applyFocusVolumes();
  }
};

const hideSystemDialogs = () => {
  document.getElementById("logoff-dialog").hidden = true;
  document.getElementById("shutdown-dialog").hidden = true;
};

const showLogoffDialog = () => {
  closeStartMenu();
  document.getElementById("logoff-dialog").hidden = false;
};

const showShutdownDialog = () => {
  closeStartMenu();
  document.getElementById("shutdown-dialog").hidden = false;
};

const muteAllWindows = () => {
  openWindows.forEach((win) => setPlayerVolume(win.player, win.type, 0));
};

const showBootScreen = () => {
  setSuspended(false);
  hideSystemDialogs();
  clearTimeout(shutdownTimeout);
  muteAllWindows();
  setScreen("boot-screen");
  document.getElementById("boot-screen").focus({ preventScroll: true });
  startupSoundPending = true;
  clearTimeout(bootTimeout);
  bootTimeout = setTimeout(() => showWelcomeScreen(true), BOOT_DURATION_MS);
};

const showWelcomeScreen = (autoLogin = false) => {
  setSuspended(false);
  hideSystemDialogs();
  clearTimeout(bootTimeout);
  muteAllWindows();
  const welcomeScreen = document.getElementById("welcome-screen");
  const loginUser = document.getElementById("login-user");
  welcomeScreen.classList.toggle("auto-login", autoLogin);
  if (autoLogin) {
    welcomeScreen.setAttribute("role", "button");
    welcomeScreen.setAttribute("tabindex", "0");
    welcomeScreen.setAttribute("aria-label", "Continue to the desktop");
  } else {
    welcomeScreen.removeAttribute("role");
    welcomeScreen.removeAttribute("tabindex");
    welcomeScreen.removeAttribute("aria-label");
  }
  setScreen("welcome-screen");
  const focusTarget = autoLogin ? welcomeScreen : loginUser;
  focusTarget.focus({ preventScroll: true });
  // Keyboard activation can finish after this handler moves focus.
  requestAnimationFrame(() => {
    if (!welcomeScreen.hidden) focusTarget.focus({ preventScroll: true });
  });
  if (startupSoundPending) {
    startupSoundPending = false;
    playXPSound("startup");
  }
  if (autoLogin) {
    bootTimeout = setTimeout(() => login(), WELCOME_DURATION_MS);
  }
};

const showDesktop = () => {
  setScreen("desktop", "taskbar");
  closeStartMenu();
};

const showTurnOffScreen = () => {
  muteAllWindows();
  setScreen("turn-off-screen");
};

const startShutdown = (restart = false) => {
  setSuspended(false);
  hideSystemDialogs();
  muteAllWindows();
  playXPSound("shutdown");
  setScreen("shutdown-screen");
  clearTimeout(shutdownTimeout);
  shutdownTimeout = setTimeout(
    restart ? showBootScreen : showTurnOffScreen,
    1800,
  );
};

const closeCurrentSession = () => {
  clearTimeout(screenSaverTimeout);
  const saver = document.getElementById("screen-saver-overlay");
  if (saver) saver.hidden = true;
  showDesktopSnapshot = null;
  closeStartMenu();
  closeDesktopContextMenu();
  closeWindowSystemMenu();
  closeTaskbarMenus();
  closeTrayVolumePopup();
  Array.from(openWindows.keys()).forEach(closeGameWindow);
  focusedGameId = null;
  zIndexCounter = 100;
  cascadeCount = 0;
  loggedIn = false;
  history.replaceState(
    null,
    "",
    window.location.pathname + window.location.search,
  );
};

const logOff = () => {
  closeCurrentSession();
  playXPSound("logoff");
  showWelcomeScreen(false);
};

const switchUser = () => {
  // Fast User Switching leaves this session intact. The desktop is simply
  // hidden behind the logon screen until this user signs in again.
  playXPSound("logoff");
  showWelcomeScreen(false);
};

const restart = () => {
  closeCurrentSession();
  startShutdown(true);
};

const turnOff = () => {
  closeCurrentSession();
  startShutdown(false);
};

let loginPromise = null;
const login = (playSound = true) => {
  if (loginPromise) return loginPromise;
  loginPromise = (async () => {
    await gameLibraryInitialization;
    clearTimeout(bootTimeout);
    loggedIn = true;
    showDesktop();
    applyDisplaySettings(getDisplaySettings());
    applyFocusVolumes();
    if (playSound) {
      playXPSound("logon");
    }

    networkConnectedAt = Date.now();
    if (!shellInitialized) {
      shellInitialized = true;
      syncGameFiles();
      buildDesktopIcons();
      buildPlaces();
      setupSearch();
      setupScreenSaver();
      startClock();

      // Deep link: #game-id opens that game's window
      const gameId = getHashGameId();
      if (gameId) {
        openGameWindow(gameId);
      }
    }
    maybePromptForUpdate(offlineManager.getSnapshot());
    scheduleScreenSaver();
  })().finally(() => {
    loginPromise = null;
  });
  return loginPromise;
};

const setupScreenFlow = () => {
  const bootScreen = document.getElementById("boot-screen");
  const skipBootScreen = () => showWelcomeScreen(true);
  bootScreen.addEventListener("click", skipBootScreen);
  bootScreen.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    skipBootScreen();
  });
  document
    .getElementById("welcome-screen")
    .addEventListener("click", (event) => {
      if (event.target.closest("#welcome-turn-off")) return;
      login();
    });
  document
    .getElementById("welcome-screen")
    .addEventListener("keydown", (event) => {
      if (
        event.target !== event.currentTarget ||
        !["Enter", " "].includes(event.key)
      ) {
        return;
      }
      event.preventDefault();
      login();
    });
  document
    .getElementById("turn-off-screen")
    .addEventListener("click", showBootScreen);

  document.getElementById("welcome-turn-off").addEventListener("click", () => {
    showShutdownDialog();
  });

  document.getElementById("log-off-button").addEventListener("click", () => {
    showLogoffDialog();
  });

  document.getElementById("turn-off-button").addEventListener("click", () => {
    showShutdownDialog();
  });

  document
    .getElementById("logoff-cancel")
    .addEventListener("click", hideSystemDialogs);
  document
    .getElementById("shutdown-cancel")
    .addEventListener("click", hideSystemDialogs);
  document
    .getElementById("switch-user-confirm")
    .addEventListener("click", switchUser);
  document.getElementById("logoff-confirm").addEventListener("click", logOff);
  document
    .getElementById("shutdown-confirm")
    .addEventListener("click", turnOff);
  document.getElementById("restart-confirm").addEventListener("click", restart);
  document.getElementById("standby-confirm").addEventListener("click", () => {
    hideSystemDialogs();
    setSuspended(true);
  });
  document
    .getElementById("standby-resume")
    .addEventListener("click", () => setSuspended(false));
  document
    .getElementById("standby-screen")
    .addEventListener("pointerdown", () => setSuspended(false));

  if (getHashGameId()) {
    startupSoundPending = false;
    login(false);
  } else {
    showBootScreen();
  }
};

// ============================================
// URL spoofing https://github.com/ruffle-rs/ruffle/issues/1486
// ============================================

const getSpoofedGameId = (hostname) => {
  for (const [gameId, game] of Object.entries(gamesList)) {
    const spoofHostname = game.spoofUrl
      ? new URL(game.spoofUrl).hostname
      : null;
    if (spoofHostname === hostname || game.externalHosts?.includes(hostname)) {
      return gameId;
    }
  }
  return null;
};

const changeUrl = (request) => {
  if (!request.url) return request;

  const parsedUrl = new URL(request.url);
  if (parsedUrl.hostname !== window.location.hostname) {
    const gameId = getSpoofedGameId(parsedUrl.hostname);
    if (gameId && gamesList[gameId].type === "swf") {
      const file = parsedUrl.pathname.split("/").pop();
      return `swf/${gameId}/${file}`;
    }
  }
  return request;
};

const interceptResponse = (response, request) => {
  const url =
    typeof request === "string"
      ? new URL(request, window.location.href).href
      : request.url;
  Object.defineProperty(response, "url", { value: url });
  return response;
};

const { fetch: originalFetch } = window;
window.fetch = async (...args) => {
  const originalRequest = args[0];
  if (gameLibraryReady && gameLibrary && !gameLibraryError) {
    try {
      const installedResponse = await gameLibrary.match(originalRequest);
      if (installedResponse) {
        return interceptResponse(installedResponse, originalRequest);
      }
    } catch (error) {
      console.error("Installed game resource lookup failed:", error);
    }
  }
  args[0] = changeUrl(originalRequest);

  const response = await originalFetch(...args);
  if (args[0] !== originalRequest) {
    console.log(`URL spoofed: ${originalRequest.url} => ${args[0]}`);
    return interceptResponse(response, originalRequest);
  }
  return response;
};

// ============================================
// Global Event Listeners
// ============================================

let altTabOrder = null;
let altTabIndex = 0;
const getMruWindows = () =>
  [...openWindows.values()].sort((a, b) => b.zIndex - a.zIndex);
const cycleShellWindow = (direction = 1, showSwitcher = false) => {
  const windows = showSwitcher && altTabOrder ? altTabOrder : getMruWindows();
  if (!windows.length) return;
  if (showSwitcher && !altTabOrder) {
    altTabOrder = windows;
    altTabIndex = windows.findIndex((win) => win.gameId === focusedGameId);
  }
  const order = altTabOrder || windows;
  if (!showSwitcher)
    altTabIndex = order.findIndex((win) => win.gameId === focusedGameId);
  altTabIndex = (altTabIndex + direction + order.length) % order.length;
  const win = order[altTabIndex];
  restoreWindow(win.gameId);
  focusWindow(win.gameId);
  if (showSwitcher) {
    let switcher = document.getElementById("window-switcher");
    if (!switcher) {
      switcher = document.createElement("div");
      switcher.id = "window-switcher";
      document.body.appendChild(switcher);
    }
    switcher.textContent = formatGameTitle(win.gameId);
    switcher.hidden = false;
  }
};
const finishAltTab = () => {
  altTabOrder = null;
  altTabIndex = 0;
  document.getElementById("window-switcher")?.setAttribute("hidden", "");
};
const isEditableTarget = (target) =>
  /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName || "") ||
  target?.isContentEditable;
const confirmPermanentDelete = (ids) =>
  XPDialogs.confirm(
    ids.length === 1
      ? "Are you sure you want to permanently delete this item?"
      : "Are you sure you want to permanently delete these items?",
    "Confirm File Delete",
    "warning",
  ).then((yes) => yes && ids.forEach((id) => fs.destroy(id)));

gameLibraryInitialization = initializeGameLibrary();

window.addEventListener("load", async () => {
  initializeOfflineMode();
  await gameLibraryInitialization;
  setupScreenFlow();
  setupDesktopContextMenu();
  setupWindowSystemMenu();
  setupTaskbarContextMenu();
  setupSystemTray();
  document
    .getElementById("start-button")
    .addEventListener("click", toggleStartMenu);
});

window.addEventListener("resize", () => {
  closeTrayVolumePopup();
  applySimulatedMonitor(activeMonitorResolution);
  if (iconsBuilt) {
    layoutDesktopIcons();
  }
  if (loggedIn) {
    keepWindowsInWorkArea();
    renderTaskButtons();
  }
});

window.addEventListener("hashchange", () => {
  if (!loggedIn) return;

  const gameId = getHashGameId();
  if (gameId) {
    openGameWindow(gameId);
  } else {
    // Empty hash means "back to desktop"
    minimizeAllWindows();
  }
});

// Close the start menu when clicking outside of it
document.addEventListener("pointerdown", (e) => {
  if (suspended) return;
  if (!e.target.closest(".explorer-chrome")) closeExplorerMenu();
  if (!e.target.closest("#desktop-context-menu")) {
    closeDesktopContextMenu();
  }

  if (
    !e.target.closest("#window-system-menu") &&
    !e.target.closest(".title-icon")
  ) {
    closeWindowSystemMenu();
  }

  if (
    !e.target.closest("#taskbar-context-menu") &&
    !e.target.closest("#taskbar-overflow-menu") &&
    !e.target.closest(".task-button")
  ) {
    closeTaskbarMenus();
  }

  if (
    !e.target.closest("#tray-volume-popup") &&
    !e.target.closest("#tray-volume-button")
  ) {
    closeTrayVolumePopup();
  }

  if (!e.target.closest(".game-menu-bar") && !e.target.closest(".game-menu")) {
    document.querySelectorAll(".game-menu:not([hidden])").forEach((menu) => {
      menu.hidden = true;
      menu.parentElement
        ?.querySelector(
          `.game-menu-button[data-game-menu="${menu.dataset.gameMenu}"]`,
        )
        ?.setAttribute("aria-expanded", "false");
    });
  }
  const startMenu = document.getElementById("start-menu");
  if (startMenu.hidden) return;
  if (
    !e.target.closest("#start-menu") &&
    !e.target.closest("#start-menu-flyouts") &&
    !e.target.closest("#start-button")
  ) {
    closeStartMenu();
  }
});

document.addEventListener("keydown", (e) => {
  if (suspended) {
    if (!["Alt", "Control", "Meta", "Shift"].includes(e.key)) {
      e.preventDefault();
      setSuspended(false);
    }
    return;
  }

  // Dialogs and editable controls own their keyboard semantics. Do not
  // steal browser text editing or modal access keys for shell shortcuts.
  if (
    e.defaultPrevented ||
    document.querySelector(
      ".xp-dialog-overlay, .system-dialog-overlay:not([hidden])",
    ) ||
    isEditableTarget(e.target)
  )
    return;

  if (e.altKey && e.key === "Tab") {
    e.preventDefault();
    cycleShellWindow(e.shiftKey ? -1 : 1, true);
    return;
  }
  if (e.altKey && e.key === "Escape") {
    e.preventDefault();
    cycleShellWindow(1, false);
    return;
  }

  const desktopIcon = document.activeElement?.closest?.(".desktop-icon");
  const desktopHasFocus =
    desktopIcon || document.activeElement?.id === "desktop-icons";
  if (desktopHasFocus) {
    const {
      filesystemIds: selectedFsIds,
      allFilesystem,
      movable,
    } = getDesktopSelectionEligibility();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      document
        .querySelectorAll(".desktop-icon")
        .forEach((icon) => icon.classList.add("selected"));
      return;
    }
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "c" &&
      allFilesystem
    ) {
      e.preventDefault();
      fileOps.copy(selectedFsIds);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x" && movable) {
      e.preventDefault();
      fileOps.cut(selectedFsIds);
      return;
    }
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "v" &&
      fileOps.canPaste(fs.DESKTOP)
    ) {
      e.preventDefault();
      pasteIntoFolder(fs.DESKTOP);
      return;
    }
    if (e.key === "Delete" && movable) {
      e.preventDefault();
      if (e.shiftKey) confirmPermanentDelete(selectedFsIds);
      else confirmRecycleDelete(selectedFsIds);
      return;
    }
    if (e.key === "F2" && movable && selectedFsIds.length === 1) {
      e.preventDefault();
      beginDesktopRename(selectedFsIds[0]);
      return;
    }
    if (e.shiftKey && e.key === "F10") {
      e.preventDefault();
      const rect =
        desktopIcon?.getBoundingClientRect() ||
        document.getElementById("desktop").getBoundingClientRect();
      openDesktopContextMenu(
        rect.left + 8,
        rect.top + 8,
        desktopIcon?.dataset.desktopId || null,
      );
      return;
    }
    if (
      desktopIcon &&
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
    ) {
      const icons = [...document.querySelectorAll(".desktop-icon")];
      const current = icons.indexOf(desktopIcon);
      const direction = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
      const target = icons[(current + direction + icons.length) % icons.length];
      e.preventDefault();
      if (!e.ctrlKey && !e.shiftKey)
        selectDesktopIcon(target.dataset.desktopId);
      if (e.shiftKey) target.classList.add("selected");
      target.focus();
      return;
    }
  }

  const explorerItem = document.activeElement?.closest?.(".explorer-item");
  const explorerWin =
    explorerItem &&
    [...openWindows.values()].find((win) => win.el.contains(explorerItem));
  if (explorerWin) {
    const selected = selectedExplorerNodes(explorerWin);
    const protectedSelection = selected.some((id) => fs.isProtected(id));
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      explorerWin.el
        .querySelectorAll(".explorer-item")
        .forEach((item) => item.classList.add("selected"));
      return;
    }
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "c" &&
      selected.length
    ) {
      e.preventDefault();
      fileOps.copy(selected);
      return;
    }
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "x" &&
      selected.length &&
      !protectedSelection
    ) {
      e.preventDefault();
      fileOps.cut(selected);
      return;
    }
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "v" &&
      fileOps.canPaste(explorerWin.currentFolderId)
    ) {
      e.preventDefault();
      pasteIntoFolder(explorerWin.currentFolderId);
      return;
    }
    if (e.key === "F2" && selected.length === 1 && !protectedSelection) {
      e.preventDefault();
      const name = window.prompt("Rename", fs.getNode(selected[0]).name);
      if (name !== null) fileOps.rename(selected[0], name);
      return;
    }
    if (e.key === "Delete" && selected.length && !protectedSelection) {
      e.preventDefault();
      if (e.shiftKey) confirmPermanentDelete(selected);
      else if (explorerWin.currentFolderId === fs.RECYCLE_BIN)
        XPDialogs.confirm(
          "Are you sure you want to permanently delete the selected items?",
          "Confirm File Delete",
          "warning",
        ).then((yes) => yes && fileOps.permanentlyDelete(selected));
      else confirmRecycleDelete(selected);
      return;
    }
    if (e.shiftKey && e.key === "F10") {
      e.preventDefault();
      const rect = explorerItem.getBoundingClientRect();
      openExplorerContextMenu(explorerWin, rect.left, rect.bottom);
      return;
    }
  }

  if (e.key === "F11" && focusedGameId) {
    const win = openWindows.get(focusedGameId);
    if (win?.type !== "system" && win?.player) {
      e.preventDefault();
      toggleFullscreen(win.player);
    }
    return;
  }

  const taskButton = document.activeElement?.closest?.(".task-button");
  if (
    taskButton &&
    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
  ) {
    const buttons = [
      ...document.querySelectorAll("#task-buttons .task-button"),
    ];
    const current = buttons.indexOf(taskButton);
    const target =
      e.key === "Home"
        ? buttons[0]
        : e.key === "End"
          ? buttons.at(-1)
          : buttons[
              (current + (e.key === "ArrowLeft" ? -1 : 1) + buttons.length) %
                buttons.length
            ];
    e.preventDefault();
    target?.focus();
    return;
  }

  if ((e.ctrlKey && e.key === "Escape") || e.key === "Meta") {
    e.preventDefault();
    toggleStartMenu();
    return;
  }

  if (e.altKey && e.key === "F4" && focusedGameId) {
    e.preventDefault();
    closeGameWindow(focusedGameId);
    return;
  }

  if (e.altKey && e.key === "F4" && !focusedGameId) {
    e.preventDefault();
    showShutdownDialog();
    return;
  }

  if (e.altKey && (e.key === " " || e.code === "Space") && focusedGameId) {
    e.preventDefault();
    const win = openWindows.get(focusedGameId);
    if (win && !win.minimized) {
      const rect = win.el.getBoundingClientRect();
      openWindowSystemMenu(win, rect.left + 6, rect.top + 28);
    }
    return;
  }

  if (e.key === "Escape") {
    closeWindowSystemMenu();
    closeTaskbarMenus();
    hideSystemDialogs();
    closeStartMenu();
    closeTrayVolumePopup();
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === "Alt") finishAltTab();
});
