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
const gameDataManager = window.AstroGameData.createManager();

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
const DESKTOP_SYSTEM_ICONS_KEY = "desktopSystemIcons";
const GAME_PLAYBACK_SETTINGS_KEY = "gamePlaybackSettings";
const USER_STORAGE_KEYS = Object.freeze([
  DISPLAY_SETTINGS_KEY,
  "clockOffsetMs",
  "desktopIconPositions",
  "desktopLayoutSettings",
  DESKTOP_SYSTEM_ICONS_KEY,
  "favorites",
  "gameStats",
  GAME_PLAYBACK_SETTINGS_KEY,
  "gameVolumes",
  "isMuted",
  "runHistory",
  "volume",
]);
const DISPLAY_WALLPAPERS = {
  none: "none",
  bliss: 'url("../assets/xp/bliss.jpg")',
  ascent: 'url("../assets/xp/wallpapers/ascent.jpg")',
  autumn: 'url("../assets/xp/wallpapers/autumn.jpg")',
  azul: 'url("../assets/xp/wallpapers/azul.jpg")',
  "blue-lace": 'url("../assets/xp/wallpapers/blue-lace-16.bmp")',
  coffee: 'url("../assets/xp/wallpapers/coffee-bean.bmp")',
  crystal: 'url("../assets/xp/wallpapers/crystal.jpg")',
  follow: 'url("../assets/xp/wallpapers/follow.jpg")',
  friend: 'url("../assets/xp/wallpapers/friend.jpg")',
  greenstone: 'url("../assets/xp/wallpapers/greenstone.bmp")',
  home: 'url("../assets/xp/wallpapers/home.jpg")',
  "moon-flower": 'url("../assets/xp/wallpapers/moon-flower.jpg")',
  peace: 'url("../assets/xp/wallpapers/peace.jpg")',
  power: 'url("../assets/xp/wallpapers/power.jpg")',
  "prairie-wind": 'url("../assets/xp/wallpapers/prairie-wind.bmp")',
  "purple-flower": 'url("../assets/xp/wallpapers/purple-flower.jpg")',
  radiance: 'url("../assets/xp/wallpapers/radiance.jpg")',
  "red-moon-desert": 'url("../assets/xp/wallpapers/red-moon-desert.jpg")',
  ripple: 'url("../assets/xp/wallpapers/ripple.jpg")',
  stonehenge: 'url("../assets/xp/wallpapers/stonehenge.jpg")',
  tulips: 'url("../assets/xp/wallpapers/tulips.jpg")',
  "vortec-space": 'url("../assets/xp/wallpapers/vortec-space.jpg")',
  wind: 'url("../assets/xp/wallpapers/wind.jpg")',
  "windows-xp": 'url("../assets/xp/wallpapers/windows-xp.jpg")',
  zapotec: 'url("../assets/xp/wallpapers/zapotec.bmp")',
};
const DEFAULT_DISPLAY_SETTINGS = Object.freeze({
  theme: "windows-xp",
  wallpaper: "bliss",
  customWallpaper: "",
  position: "stretch",
  backgroundColor: "#3a6ea5",
  appearance: "blue",
  fontSize: "normal",
  screenSaver: "windows-xp",
  screenSaverWait: 10,
  requireLoginOnResume: false,
  transitionEffect: "fade",
  fontSmoothing: "standard",
  largeIcons: false,
  menuShadows: true,
  showWindowContents: true,
  hideKeyboardCues: true,
  resolution: "auto",
});
const SIMULATED_RESOLUTIONS = Object.freeze({
  "800x600": { width: 800, height: 600 },
  "1024x768": { width: 1024, height: 768 },
  "1440x900": { width: 1440, height: 900 },
});
const XP_ICON_PATHS = Object.freeze({
  "AccessibilityOptions.png": "assets/xp/icons/AccessibilityOptions.png",
  "AddRemovePrograms.png": "assets/xp/icons/AddRemovePrograms.png",
  "AppearanceAndThemes.png": "assets/xp/icons/AppearanceAndThemes.png",
  "Back.png": "assets/xp/icons/Back.png",
  "ControlPanel.png": "assets/xp/icons/ControlPanel.png",
  "DateTimeRegional.png": "assets/xp/icons/DateTimeRegional.png",
  "Exit.png": "assets/xp/icons/Exit.png",
  "FolderViewClassic.png": "assets/xp/icons/FolderViewClassic.png",
  "FolderView.png": "assets/xp/icons/FolderView.png",
  "Forward.png": "assets/xp/icons/Forward.png",
  "Go.png": "assets/xp/icons/Go.png",
  "HelpAndSupport.png": "assets/xp/icons/HelpAndSupport.png",
  "LocalDisk.png": "assets/xp/icons/LocalDisk.png",
  "OpticalDrive.png": "assets/xp/icons/OpticalDrive.png",
  "Logout.png": "assets/xp/icons/Logout.png",
  "Maximize.png": "assets/xp/icons/Maximize.png",
  "Minimize.png": "assets/xp/icons/Minimize.png",
  "Mute.png": "assets/xp/icons/Mute.png",
  "MyMusic.png": "assets/xp/icons/MyMusic.png",
  "MyNetworkPlaces.png": "assets/xp/icons/MyNetworkPlaces.png",
  "MyPictures.png": "assets/xp/icons/MyPictures.png",
  "NetworkAndInternet.png": "assets/xp/icons/NetworkAndInternet.png",
  "NetworkConnection.png": "assets/xp/icons/NetworkConnection.png",
  "NewFolder.png": "assets/xp/icons/NewFolder.png",
  "Power.png": "assets/xp/icons/Power.png",
  "PerformanceAndMaintenance.png":
    "assets/xp/icons/PerformanceAndMaintenance.png",
  "PrintersAndHardware.png": "assets/xp/icons/PrintersAndHardware.png",
  "PrintersAndFaxes.png": "assets/xp/icons/PrintersAndFaxes.png",
  "Programs.png": "assets/xp/icons/Programs.png",
  "PublishToWeb.png": "assets/xp/icons/PublishToWeb.png",
  "RecentDocuments.png": "assets/xp/icons/RecentDocuments.png",
  "RemovableMedia.png": "assets/xp/icons/RemovableMedia.png",
  "Restore.png": "assets/xp/icons/Restore.png",
  "Run.png": "assets/xp/icons/Run.png",
  "Search.png": "assets/xp/icons/Search.png",
  "SecurityCenter.png": "assets/xp/icons/SecurityCenter.png",
  "SharedFolder.png": "assets/xp/icons/SharedFolder.png",
  "Up.png": "assets/xp/icons/Up.png",
  "SoundsSpeechAudio.png": "assets/xp/icons/SoundsSpeechAudio.png",
  "UserAccounts.png": "assets/xp/icons/UserAccounts.png",
  "Volume.png": "assets/xp/icons/Volume.png",
  "ExplorerProperties.png": "assets/xp/icons/ExplorerProperties.png",
  "MyComputer.png": "assets/xp/icons/MyComputer.png",
  "MyDocuments.png": "assets/xp/icons/MyDocuments.png",
  "RecyclerEmpty.png": "assets/xp/icons/RecyclerEmpty.png",
  "RecyclerFull.png": "assets/xp/icons/RecyclerFull.png",
  "Shortcut.png": "assets/xp/icons/Shortcut.png",
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
    icon: "assets/xp/icons/MyDocuments.png",
  },
  "__my-computer": {
    title: "My Computer",
    icon: "assets/xp/icons/MyComputer.png",
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
    icon: "assets/xp/icons/RecyclerEmpty.png",
  },
  "__display-properties": {
    title: "Display Properties",
    icon: "assets/xp/icons/MyComputer.png",
    desktop: false,
  },
  "__control-panel": {
    title: "Control Panel",
    icon: "assets/xp/icons/ControlPanel.png",
    desktop: false,
  },
  __printers: {
    title: "Printers and Faxes",
    icon: "assets/xp/icons/PrintersAndFaxes.png",
    desktop: false,
  },
  __help: {
    title: "Help and Support Center",
    icon: "assets/xp/icons/HelpAndSupport.png",
    desktop: false,
  },
  __notepad: {
    title: "Notepad",
    icon: "assets/xp/icons/Notepad.png",
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
    icon: "assets/xp/icons/AddRemovePrograms.png",
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

const getRecycleBinIconPath = () =>
  window.VirtualFS?.getChildren(window.VirtualFS.RECYCLE_BIN).length
    ? XP_ICON_PATHS["RecyclerFull.png"]
    : XP_ICON_PATHS["RecyclerEmpty.png"];

const createGameIconElement = (gameId, className) => {
  const icon = document.createElement("span");
  icon.className = className;

  const imagePath =
    gameId === "__recycle-bin"
      ? getRecycleBinIconPath()
      : systemShortcuts[gameId]?.icon || gamesList[gameId]?.icon;
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
    /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(
      value.customWallpaper,
    )) &&
  ["center", "tile", "stretch"].includes(value.position) &&
  /^#[0-9a-f]{6}$/i.test(value.backgroundColor) &&
  ["blue", "olive", "silver"].includes(value.appearance) &&
  (value.fontSize === undefined ||
    ["normal", "large", "extra-large"].includes(value.fontSize)) &&
  [
    "none",
    "flowerbox",
    "flying-objects",
    "pipes",
    "text",
    "beziers",
    "blank",
    "marquee",
    "pictures",
    "mystify",
    "stars",
    "windows-xp",
  ].includes(value.screenSaver) &&
  Number.isInteger(value.screenSaverWait) &&
  value.screenSaverWait >= 1 &&
  value.screenSaverWait <= 60 &&
  (value.requireLoginOnResume === undefined ||
    typeof value.requireLoginOnResume === "boolean") &&
  (value.transitionEffect === undefined ||
    ["none", "fade", "scroll"].includes(value.transitionEffect)) &&
  (value.fontSmoothing === undefined ||
    ["none", "standard", "cleartype"].includes(value.fontSmoothing)) &&
  (value.largeIcons === undefined || typeof value.largeIcons === "boolean") &&
  (value.menuShadows === undefined || typeof value.menuShadows === "boolean") &&
  (value.showWindowContents === undefined ||
    typeof value.showWindowContents === "boolean") &&
  (value.hideKeyboardCues === undefined ||
    typeof value.hideKeyboardCues === "boolean") &&
  ["auto", "800x600", "1024x768", "1440x900"].includes(value.resolution);

const getDisplaySettings = () => ({
  ...DEFAULT_DISPLAY_SETTINGS,
  ...readJsonStorage(DISPLAY_SETTINGS_KEY, {}, isDisplaySettings),
});

const DEFAULT_DESKTOP_SYSTEM_ICONS = Object.freeze({
  "__my-computer": true,
  "__my-documents": true,
});

const getDesktopSystemIcons = () => ({
  ...DEFAULT_DESKTOP_SYSTEM_ICONS,
  ...readJsonStorage(DESKTOP_SYSTEM_ICONS_KEY, {}, (value) =>
    Object.values(value || {}).every((visible) => typeof visible === "boolean"),
  ),
});

const saveDesktopSystemIcons = (settings) =>
  writeJsonStorage(DESKTOP_SYSTEM_ICONS_KEY, settings);

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
  document.documentElement.dataset.xpFontSize = settings.fontSize;
  document.documentElement.dataset.xpLargeIcons = String(settings.largeIcons);
  document.documentElement.dataset.xpMenuShadows = String(settings.menuShadows);
  document.documentElement.dataset.xpKeyboardCues = String(
    settings.hideKeyboardCues,
  );
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

const normalizeFrameRate = (value) => {
  const frameRate = Number(value);
  return Number.isFinite(frameRate) && frameRate >= 1 && frameRate <= 240
    ? frameRate
    : null;
};

const getGameFrameRateSetting = (gameId) => {
  const settings = readJsonStorage(
    GAME_PLAYBACK_SETTINGS_KEY,
    {},
    (value) => value && typeof value === "object" && !Array.isArray(value),
  );
  const frameRate = settings[gameId]?.frameRate;
  if (frameRate === "native") return "native";
  return normalizeFrameRate(frameRate) ?? "default";
};

const setGameFrameRate = (gameId, frameRate) => {
  const settings = readJsonStorage(
    GAME_PLAYBACK_SETTINGS_KEY,
    {},
    (value) => value && typeof value === "object" && !Array.isArray(value),
  );
  if (frameRate === "default") {
    delete settings[gameId];
  } else if (frameRate === "native") {
    settings[gameId] = { frameRate: "native" };
  } else {
    settings[gameId] = { frameRate: normalizeFrameRate(frameRate) };
  }
  writeJsonStorage(GAME_PLAYBACK_SETTINGS_KEY, settings);
};

const resolveGameFrameRate = (gameId) => {
  const setting = getGameFrameRateSetting(gameId);
  if (setting === "native") return null;
  if (setting === "default")
    return normalizeFrameRate(gamesList[gameId]?.frameRate);
  return setting;
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
  window.ASTRO_GAME_ROOTS?.[gameId] || `${type}/${gameId}/`;

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

const createControlPanelContent = () => {
  const content = document.createElement("div");
  content.className = "control-panel-content";
  content.innerHTML = `
    <div class="explorer-chrome control-panel-chrome">
      <div class="explorer-menu-row">
        <div class="explorer-menu-bar" role="menubar">
          <button type="button" role="menuitem">File</button>
          <button type="button" role="menuitem">Edit</button>
          <button type="button" role="menuitem">View</button>
          <button type="button" role="menuitem">Favorites</button>
          <button type="button" role="menuitem">Tools</button>
          <button type="button" role="menuitem">Help</button>
        </div>
        <div class="explorer-brand" aria-hidden="true"><img src="assets/xp/WindowsFlag.png" alt=""></div>
      </div>
      <div class="explorer-toolbar">
        <button type="button" disabled><img src="assets/xp/icons/Back.png" alt=""> Back <span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
        <button type="button" disabled aria-label="Forward"><img src="assets/xp/icons/Forward.png" alt=""><span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
        <button type="button" disabled aria-label="Up"><img src="assets/xp/icons/Up.png" alt=""></button>
        <span class="explorer-toolbar-separator" aria-hidden="true"></span>
        <button type="button" data-control-panel-action="search"><img src="assets/xp/icons/Search.png" alt=""> Search</button>
        <button type="button" data-control-panel-action="folders" aria-pressed="false"><img src="assets/xp/icons/NewFolder.png" alt=""> Folders</button>
        <span class="explorer-toolbar-separator" aria-hidden="true"></span>
        <button type="button" aria-label="Views"><img src="assets/xp/icons/FolderViewClassic.png" alt=""><span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
      </div>
      <label class="explorer-address"><span>Address</span><span class="explorer-address-field"><img src="assets/xp/icons/ControlPanel.png" alt=""><input type="text" aria-label="Address" value="Control Panel" readonly></span><button type="button" aria-label="Go"><img src="assets/xp/icons/Go.png" alt=""></button></label>
    </div>
    <div class="control-panel-body">
      <aside class="explorer-sidebar control-panel-sidebar">
        <section>
          <h3><button type="button" class="explorer-section-toggle" aria-expanded="true"><img src="assets/xp/icons/ControlPanel.png" alt=""><span>Control Panel</span><b aria-hidden="true">⌃</b></button></h3>
          <div class="explorer-section-body"><button type="button" data-control-panel-action="classic"><img src="assets/xp/icons/FolderViewClassic.png" alt=""><span>Switch to Classic View</span></button></div>
        </section>
        <section>
          <h3><button type="button" class="explorer-section-toggle" aria-expanded="true"><span>See Also</span><b aria-hidden="true">⌃</b></button></h3>
          <div class="explorer-section-body">
            <button type="button" data-control-panel-action="updates"><span class="control-panel-see-icon windows-update" aria-hidden="true"></span><span>Windows Update</span></button>
            <button type="button" data-control-panel-action="help"><img src="assets/xp/icons/HelpAndSupport.png" alt=""><span>Help and Support</span></button>
          </div>
        </section>
      </aside>
      <main class="control-panel-main">
        <h1>Pick a category</h1>
        <div class="control-panel-categories"></div>
      </main>
    </div>
  `;

  const categories = [
    ["appearance", "Appearance and Themes", "AppearanceAndThemes.png", "left"],
    [
      "printers",
      "Printers and Other Hardware",
      "PrintersAndHardware.png",
      "right",
    ],
    [
      "network",
      "Network and Internet Connections",
      "NetworkAndInternet.png",
      "left",
    ],
    ["users", "User Accounts", "UserAccounts.png", "right"],
    ["programs", "Add or Remove Programs", "AddRemovePrograms.png", "left"],
    [
      "datetime",
      "Date, Time, Language, and Regional Options",
      "DateTimeRegional.png",
      "right",
    ],
    [
      "sounds",
      "Sounds, Speech, and Audio Devices",
      "SoundsSpeechAudio.png",
      "left",
    ],
    [
      "accessibility",
      "Accessibility Options",
      "AccessibilityOptions.png",
      "right",
    ],
    [
      "performance",
      "Performance and Maintenance",
      "PerformanceAndMaintenance.png",
      "left",
    ],
    ["security", "Security Center", "SecurityCenter.png", "right"],
  ];
  const categoryGrid = content.querySelector(".control-panel-categories");
  categories.forEach(([id, label, icon, column]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.controlPanelCategory = id;
    button.dataset.column = column;
    const image = document.createElement("img");
    image.src = XP_ICON_PATHS[icon];
    image.alt = "";
    const text = document.createElement("span");
    text.textContent = label;
    button.append(image, text);
    categoryGrid.appendChild(button);
  });
  return content;
};

const wireControlPanel = (win) => {
  const content = win.el.querySelector(".control-panel-content");
  const titleText = win.el.querySelector(".title-text");
  const titleIcon = win.el.querySelector(".title-icon img");
  const address = content.querySelector(".explorer-address input");
  const addressIcon = content.querySelector(".explorer-address-field img");
  const backButton = content.querySelector(
    '.explorer-toolbar button[aria-label="Back"], .explorer-toolbar button:first-child',
  );
  const upButton = content.querySelector(
    '.explorer-toolbar button[aria-label="Up"]',
  );
  backButton.dataset.controlPanelAction = "back";
  upButton.dataset.controlPanelAction = "back";

  const setWindowIdentity = (title, icon) => {
    win.title = title;
    win.icon = icon;
    titleText.textContent = title;
    titleIcon.src = icon;
    address.value = title;
    addressIcon.src = icon;
    renderTaskButtons();
  };

  const openDisplayTab = (tab) => {
    openSystemWindow("__display-properties");
    openWindows
      .get("__display-properties")
      ?.el.querySelector(`#display-tab-${tab}`)
      ?.click();
  };

  const renderAppearanceCategory = () => {
    content.classList.add("control-panel-category-page");
    content.classList.remove("classic-view", "folders-visible");
    setWindowIdentity(
      "Appearance and Themes",
      XP_ICON_PATHS["AppearanceAndThemes.png"],
    );
    backButton.disabled = false;
    upButton.disabled = false;
    content.querySelector(".control-panel-sidebar").innerHTML = `
      <section>
        <h3><button type="button" class="explorer-section-toggle" aria-expanded="true"><span>See Also</span><b aria-hidden="true">⌃</b></button></h3>
        <div class="explorer-section-body">
          <button type="button" data-control-panel-action="fonts"><img src="assets/xp/icons/FolderOptions.png" alt=""><span>Fonts</span></button>
          <button type="button" data-control-panel-action="mouse"><span class="control-panel-small-glyph mouse-glyph" aria-hidden="true"></span><span>Mouse Pointers</span></button>
          <button type="button" data-control-panel-action="contrast"><span class="control-panel-small-glyph contrast-glyph" aria-hidden="true"></span><span>High Contrast</span></button>
          <button type="button" data-control-panel-action="user-picture"><img src="assets/xp/icons/UserAccounts.png" alt=""><span>User Account Picture</span></button>
        </div>
      </section>
      <section>
        <h3><button type="button" class="explorer-section-toggle" aria-expanded="true"><span>Troubleshooters</span><b aria-hidden="true">⌃</b></button></h3>
        <div class="explorer-section-body">
          <button type="button" data-control-panel-action="display-help"><span class="control-panel-help-glyph" aria-hidden="true">?</span><span>Display</span></button>
          <button type="button" data-control-panel-action="sound-help"><span class="control-panel-help-glyph" aria-hidden="true">?</span><span>Sound</span></button>
        </div>
      </section>`;
    content.querySelector(".control-panel-main").innerHTML = `
      <div class="control-panel-category-heading"><img src="assets/xp/icons/AppearanceAndThemes.png" alt=""><strong>Appearance and Themes</strong></div>
      <h1>Pick a task...</h1>
      <div class="control-panel-task-links">
        <button type="button" data-control-panel-action="theme"><img src="assets/xp/icons/Go.png" alt=""><span>Change the computer's theme</span></button>
        <button type="button" data-control-panel-action="desktop"><img src="assets/xp/icons/Go.png" alt=""><span>Change the desktop background</span></button>
        <button type="button" data-control-panel-action="screen-saver"><img src="assets/xp/icons/Go.png" alt=""><span>Choose a screen saver</span></button>
        <button type="button" data-control-panel-action="resolution"><img src="assets/xp/icons/Go.png" alt=""><span>Change the screen resolution</span></button>
      </div>
      <h2>or pick a Control Panel icon</h2>
      <div class="control-panel-category-icons">
        <button type="button" data-control-panel-action="display"><img src="assets/xp/icons/Display.png" alt=""><span>Display</span></button>
        <button type="button" data-control-panel-action="folder-options"><img src="assets/xp/icons/FolderOptions.png" alt=""><span>Folder Options</span></button>
        <button type="button" data-control-panel-action="taskbar-properties"><img src="assets/xp/icons/TaskbarAndStartMenu.png" alt=""><span>Taskbar and Start Menu</span></button>
      </div>`;
  };

  const actions = {
    appearance: renderAppearanceCategory,
    printers: openPrintersAndFaxes,
    network: openNetworkStatus,
    users: openProjectSettings,
    programs: () => openSystemWindow("__internet-games"),
    datetime: openDateTimeProperties,
    sounds: toggleTrayVolumePopup,
    accessibility: openProjectSettings,
    performance: openProjectSettings,
    security: () =>
      XPDialogs.alert(
        "Firewall, Automatic Updates, and Virus Protection are monitored by Security Center.",
        "Windows Security Center",
        "info",
      ),
  };
  content.addEventListener("click", (event) => {
    const category = event.target.closest("[data-control-panel-category]");
    if (category) {
      actions[category.dataset.controlPanelCategory]?.();
      return;
    }
    const action = event.target.closest("[data-control-panel-action]")?.dataset
      .controlPanelAction;
    if (action === "classic") {
      const classic = content.classList.toggle("classic-view");
      content.querySelector(".control-panel-main h1").textContent = classic
        ? "Pick a Control Panel icon"
        : "Pick a category";
      event.target.closest("button").querySelector("span").textContent = classic
        ? "Switch to Category View"
        : "Switch to Classic View";
    } else if (action === "search") {
      openSearchDialog();
    } else if (action === "folders") {
      const pressed = content.classList.toggle("folders-visible");
      event.target
        .closest("button")
        .setAttribute("aria-pressed", String(pressed));
    } else if (action === "help") {
      openHelpAndSupport();
    } else if (action === "updates") {
      XPDialogs.alert(
        "This offline Windows XP recreation does not connect to Windows Update.",
        "Windows Update",
        "info",
      );
    } else if (action === "back") {
      closeGameWindow("__control-panel");
      setTimeout(openControlPanel, 0);
    } else if (action === "theme" || action === "display") {
      openDisplayTab("themes");
    } else if (action === "desktop") {
      openDisplayTab("desktop");
    } else if (action === "screen-saver") {
      openDisplayTab("saver");
    } else if (action === "resolution") {
      openDisplayTab("settings");
    } else if (action === "taskbar-properties") {
      openTaskbarProperties();
    } else if (action === "folder-options") {
      XPDialogs.alert(
        "Folder Options will be available from this Control Panel page.",
        "Folder Options",
        "info",
      );
    } else if (
      [
        "fonts",
        "mouse",
        "contrast",
        "user-picture",
        "display-help",
        "sound-help",
      ].includes(action)
    ) {
      openHelpAndSupport();
    }
  });
  content.querySelectorAll(".explorer-section-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const collapsed = toggle.closest("section").classList.toggle("collapsed");
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.querySelector("b").textContent = collapsed ? "⌄" : "⌃";
    });
  });
};

const createSystemWindowContent = (shortcutId, win) => {
  const content = document.createElement("div");
  content.className = "explorer-content";

  if (shortcutId === "__control-panel") return createControlPanelContent();

  if (shortcutId === "__printers") {
    content.className = "explorer-content printers-content";
    content.innerHTML = `
      <div class="explorer-chrome printers-chrome">
        <div class="explorer-menu-row">
          <div class="explorer-menu-bar" role="menubar"><button data-printers-menu="file">File</button><button data-printers-menu="edit">Edit</button><button data-printers-menu="view">View</button><button data-printers-menu="favorites">Favorites</button><button data-printers-menu="tools">Tools</button><button data-printers-menu="help">Help</button></div>
          <div class="explorer-brand" aria-hidden="true"><img src="assets/xp/WindowsFlag.png" alt=""></div>
        </div>
        <div class="explorer-toolbar">
          <button disabled><img src="assets/xp/icons/Back.png" alt=""> Back <span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
          <button disabled aria-label="Forward"><img src="assets/xp/icons/Forward.png" alt=""><span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
          <button data-printers-action="control-panel" aria-label="Up"><img src="assets/xp/icons/Up.png" alt=""></button>
          <span class="explorer-toolbar-separator" aria-hidden="true"></span>
          <button data-printers-action="search"><img src="assets/xp/icons/Search.png" alt=""> Search</button>
          <button data-printers-action="folders"><img src="assets/xp/icons/NewFolder.png" alt=""> Folders</button>
          <span class="explorer-toolbar-separator" aria-hidden="true"></span>
          <button aria-label="Views"><img src="assets/xp/icons/FolderViewClassic.png" alt=""><span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
        </div>
        <label class="explorer-address"><span>Address</span><span class="explorer-address-field"><img src="assets/xp/icons/PrintersAndFaxes.png" alt=""><input type="text" aria-label="Address" value="Printers and Faxes" readonly></span><button type="button" aria-label="Go"><img src="assets/xp/icons/Go.png" alt=""></button></label>
        <div class="game-menu explorer-menu printers-menu" role="menu" hidden></div>
      </div>
      <div class="printers-body">
        <aside class="explorer-sidebar printers-sidebar">
          <section><h3><button type="button" class="explorer-section-toggle">Printer Tasks<span aria-hidden="true">⌃</span></button></h3><div class="explorer-section-body"><button data-printers-action="add"><img src="assets/xp/icons/PrintersAndFaxes.png" alt=""><span>Add a printer</span></button><button data-printers-action="fax"><img src="assets/xp/icons/PrintersAndFaxes.png" alt=""><span>Set up faxing</span></button></div></section>
          <section><h3><button type="button" class="explorer-section-toggle">See Also<span aria-hidden="true">⌃</span></button></h3><div class="explorer-section-body"><button data-printers-action="troubleshoot"><span>Troubleshoot printing</span></button><button data-printers-action="help"><span>Get help with printing</span></button></div></section>
          <section><h3><button type="button" class="explorer-section-toggle">Other Places<span aria-hidden="true">⌃</span></button></h3><div class="explorer-section-body"><button data-printers-action="control-panel"><img src="assets/xp/icons/ControlPanel.png" alt=""><span>Control Panel</span></button><button data-printers-action="scanners"><img src="assets/xp/icons/MyPictures.png" alt=""><span>Scanners and Cameras</span></button><button data-printers-action="documents"><img src="assets/xp/icons/MyDocuments.png" alt=""><span>My Documents</span></button><button data-printers-action="pictures"><img src="assets/xp/icons/MyPictures.png" alt=""><span>My Pictures</span></button><button data-printers-action="computer"><img src="assets/xp/icons/MyComputer.png" alt=""><span>My Computer</span></button></div></section>
          <section class="collapsed"><h3><button type="button" class="explorer-section-toggle">Details<span aria-hidden="true">⌄</span></button></h3></section>
        </aside>
        <main class="printers-main"></main>
      </div>`;
    return content;
  }

  if (shortcutId === "__help") {
    content.className = "help-center-content";
    content.innerHTML = `
      <nav class="help-center-toolbar" aria-label="Help navigation">
        <button type="button" disabled><span class="help-toolbar-icon help-toolbar-back"></span><span>Back</span><b aria-hidden="true">⌄</b></button>
        <button type="button" disabled aria-label="Forward"><span class="help-toolbar-icon help-toolbar-forward"></span></button>
        <button type="button" data-help-action="home" aria-label="Home"><span class="help-toolbar-icon help-toolbar-home"></span></button>
        <button type="button" data-help-action="index"><span class="help-toolbar-icon help-toolbar-index"></span><span>Index</span></button>
        <button type="button" data-help-action="favorites"><span class="help-toolbar-icon help-toolbar-favorites"></span><span>Favorites</span></button>
        <button type="button" data-help-action="history"><span class="help-toolbar-icon help-toolbar-history"></span><span>History</span></button>
        <button type="button" data-help-action="support"><span class="help-toolbar-icon help-toolbar-support"></span><span>Support</span></button>
        <button type="button" data-help-action="options"><span class="help-toolbar-icon help-toolbar-options"></span><span>Options</span></button>
      </nav>
      <header class="help-center-search">
        <form><label for="help-query">Search</label><input id="help-query" type="search"><button type="submit" aria-label="Search"><img src="assets/xp/icons/Go.png" alt=""></button><button type="button" class="help-search-options" data-help-action="search-options">Set search options</button></form>
        <div class="help-center-brand"><img src="assets/xp/icons/HelpAndSupport.png" alt=""><strong>Help and Support Center</strong><small>Windows XP Professional</small></div>
      </header>
      <main class="help-center-home">
        <section class="help-topic-column">
          <h1>Pick a Help topic</h1>
          <div class="help-topic-group"><img src="assets/xp/help/TopicComputer.png" alt=""><div><button data-help-topic>What's new in Windows XP</button><button data-help-topic>Music, video, games, and photos</button><button data-help-topic>Windows basics</button><button data-help-topic>Protecting your PC: security basics</button></div></div>
          <div class="help-topic-group"><img src="assets/xp/help/TopicNetwork.png" alt=""><div><button data-help-topic>Networking and the Web</button><button data-help-topic>Working remotely</button><button data-help-topic>System administration</button></div></div>
          <div class="help-topic-group"><img src="assets/xp/help/TopicAccessibility.png" alt=""><div><button data-help-topic>Customizing your computer</button><button data-help-topic>Accessibility</button></div></div>
          <div class="help-topic-group"><img src="assets/xp/help/TopicHardware.png" alt=""><div><button data-help-topic>Printing and faxing</button><button data-help-topic>Performance and maintenance</button><button data-help-topic>Hardware</button><button data-help-topic>Fixing a problem</button><button data-help-topic>Send your feedback to Microsoft</button></div></div>
        </section>
        <section class="help-task-column">
          <h1>Ask for assistance</h1>
          <button data-help-topic><img src="assets/xp/icons/Go.png" alt="">Invite a friend to connect to your computer with <strong>Remote Assistance</strong></button>
          <button data-help-topic><img src="assets/xp/icons/Go.png" alt="">Get support, or find information in Windows XP <strong>newsgroups</strong></button>
          <h1>Pick a task</h1>
          <button data-help-topic><img src="assets/xp/icons/Go.png" alt="">Keep your computer up-to-date with <strong>Windows Update</strong></button>
          <button data-help-topic><img src="assets/xp/icons/Go.png" alt="">Find compatible hardware and software for Windows XP</button>
          <button data-help-topic><img src="assets/xp/icons/Go.png" alt="">Undo changes to your computer with <strong>System Restore</strong></button>
          <button data-help-topic><img src="assets/xp/icons/Go.png" alt="">Use <strong>Tools</strong> to view your computer information and diagnose problems</button>
          <div class="help-did-you-know"><h1>Did you know?</h1><span>Updating...</span></div>
        </section>
      </main>`;
    return content;
  }

  if (shortcutId === "__astro-settings") {
    content.className = "project-settings-content";
    return content;
  }

  if (shortcutId === "__display-properties") {
    content.className = "display-properties-content";
    content.innerHTML = `
            <div class="display-tabs" role="tablist" aria-label="Display Properties">
                <button type="button" role="tab" id="display-tab-themes" aria-controls="display-panel-themes" aria-selected="true">Themes</button>
                <button type="button" role="tab" id="display-tab-desktop" aria-controls="display-panel-desktop" aria-selected="false" tabindex="-1">Desktop</button>
                <button type="button" role="tab" id="display-tab-saver" aria-controls="display-panel-saver" aria-selected="false" tabindex="-1">Screen Saver</button>
                <button type="button" role="tab" id="display-tab-appearance" aria-controls="display-panel-appearance" aria-selected="false" tabindex="-1">Appearance</button>
                <button type="button" role="tab" id="display-tab-settings" aria-controls="display-panel-settings" aria-selected="false" tabindex="-1">Settings</button>
            </div>
            <div class="display-panel" id="display-panel-desktop" role="tabpanel" aria-labelledby="display-tab-desktop" hidden>
                <div class="display-preview" aria-label="Desktop preview">
                    <img src="assets/xp/DisplaySettings.png" alt="">
                    <div class="display-preview-surface"></div>
                </div>
                <div class="display-desktop-controls">
                    <div class="display-background-column">
                        <label class="display-wallpaper-label" for="display-wallpaper">Background:</label>
                        <select id="display-wallpaper" aria-label="Desktop background" hidden>
                            <option value="none">None</option>
                            <option value="ascent">Ascent</option>
                            <option value="autumn">Autumn</option>
                            <option value="azul">Azul</option>
                            <option value="bliss">Bliss</option>
                            <option value="blue-lace">Blue Lace 16</option>
                            <option value="coffee">Coffee Bean</option>
                            <option value="crystal">Crystal</option>
                            <option value="follow">Follow</option>
                            <option value="friend">Friend</option>
                            <option value="greenstone">Greenstone</option>
                            <option value="home">Home</option>
                            <option value="moon-flower">Moon flower</option>
                            <option value="peace">Peace</option>
                            <option value="power">Power</option>
                            <option value="prairie-wind">Prairie Wind</option>
                            <option value="purple-flower">Purple flower</option>
                            <option value="radiance">Radiance</option>
                            <option value="red-moon-desert">Red moon desert</option>
                            <option value="ripple">Ripple</option>
                            <option value="stonehenge">Stonehenge</option>
                            <option value="tulips">Tulips</option>
                            <option value="vortec-space">Vortec space</option>
                            <option value="wind">Wind</option>
                            <option value="windows-xp">Windows XP</option>
                            <option value="zapotec">Zapotec</option>
                        </select>
                        <div class="display-wallpaper-list" role="listbox" aria-label="Desktop background">
                            <div class="display-wallpaper-items">
                                <button type="button" role="option" data-wallpaper="none"><span class="wallpaper-icon none"></span>(None)</button>
                                <button type="button" role="option" data-wallpaper="ascent"><span class="wallpaper-icon"></span>Ascent</button>
                                <button type="button" role="option" data-wallpaper="autumn"><span class="wallpaper-icon"></span>Autumn</button>
                                <button type="button" role="option" data-wallpaper="azul"><span class="wallpaper-icon"></span>Azul</button>
                                <button type="button" role="option" data-wallpaper="bliss"><span class="wallpaper-icon"></span>Bliss</button>
                                <button type="button" role="option" data-wallpaper="blue-lace"><span class="wallpaper-icon"></span>Blue Lace 16</button>
                                <button type="button" role="option" data-wallpaper="coffee"><span class="wallpaper-icon"></span>Coffee Bean</button>
                                <button type="button" role="option" data-wallpaper="crystal"><span class="wallpaper-icon"></span>Crystal</button>
                                <button type="button" role="option" data-wallpaper="follow"><span class="wallpaper-icon"></span>Follow</button>
                                <button type="button" role="option" data-wallpaper="friend"><span class="wallpaper-icon"></span>Friend</button>
                                <button type="button" role="option" data-wallpaper="greenstone"><span class="wallpaper-icon"></span>Greenstone</button>
                                <button type="button" role="option" data-wallpaper="home"><span class="wallpaper-icon"></span>Home</button>
                                <button type="button" role="option" data-wallpaper="moon-flower"><span class="wallpaper-icon"></span>Moon flower</button>
                                <button type="button" role="option" data-wallpaper="peace"><span class="wallpaper-icon"></span>Peace</button>
                                <button type="button" role="option" data-wallpaper="power"><span class="wallpaper-icon"></span>Power</button>
                                <button type="button" role="option" data-wallpaper="prairie-wind"><span class="wallpaper-icon"></span>Prairie Wind</button>
                                <button type="button" role="option" data-wallpaper="purple-flower"><span class="wallpaper-icon"></span>Purple flower</button>
                                <button type="button" role="option" data-wallpaper="radiance"><span class="wallpaper-icon"></span>Radiance</button>
                                <button type="button" role="option" data-wallpaper="red-moon-desert"><span class="wallpaper-icon"></span>Red moon desert</button>
                                <button type="button" role="option" data-wallpaper="ripple"><span class="wallpaper-icon"></span>Ripple</button>
                                <button type="button" role="option" data-wallpaper="stonehenge"><span class="wallpaper-icon"></span>Stonehenge</button>
                                <button type="button" role="option" data-wallpaper="tulips"><span class="wallpaper-icon"></span>Tulips</button>
                                <button type="button" role="option" data-wallpaper="vortec-space"><span class="wallpaper-icon"></span>Vortec space</button>
                                <button type="button" role="option" data-wallpaper="wind"><span class="wallpaper-icon"></span>Wind</button>
                                <button type="button" role="option" data-wallpaper="windows-xp"><span class="wallpaper-icon"></span>Windows XP</button>
                                <button type="button" role="option" data-wallpaper="zapotec"><span class="wallpaper-icon"></span>Zapotec</button>
                            </div>
                            <div class="display-scrollbar" aria-hidden="true">
                                <span class="scroll-arrow up"></span>
                                <span class="scroll-track">
                                    <span class="scroll-thumb"><i></i><i></i><i></i></span>
                                </span>
                                <span class="scroll-arrow down"></span>
                            </div>
                        </div>
                        <button type="button" class="display-customize">Customize Desktop...</button>
                    </div>
                    <div class="display-background-actions">
                        <button type="button" class="display-browse">Browse...</button>
                        <input id="display-image" type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden>
                        <label for="display-position">Position:</label>
                        <select id="display-position"><option value="center">Center</option><option value="tile">Tile</option><option value="stretch">Stretch</option></select>
                        <label for="display-color">Color:</label>
                        <label class="display-color-button" for="display-color"><span></span><b>▼</b></label>
                        <input id="display-color" type="color" value="#3a6ea5" hidden>
                    </div>
                </div>
                <button type="button" class="display-clear-image" hidden>Remove custom picture</button>
                <p class="display-status" aria-live="polite" hidden></p>
            </div>
            <div class="display-panel active" id="display-panel-themes" role="tabpanel" aria-labelledby="display-tab-themes">
                <p class="display-theme-description">A theme is a background plus a set of sounds, icons, and other elements<br>to help you personalize your computer with one click.</p>
                <label class="display-control-label" for="display-theme">Theme:</label>
                <div class="display-theme-row">
                    <select id="display-theme"><option value="windows-xp">Windows XP</option><option value="classic">Windows Classic</option><option value="online">More themes online...</option><option value="browse">Browse...</option></select>
                    <button type="button" class="xp-property-button display-theme-save">Save As...</button>
                    <button type="button" class="xp-property-button" disabled>Delete</button>
                </div>
                <span class="display-sample-label">Sample:</span>
                <div class="display-theme-sample" aria-label="Theme sample">
                    <div class="display-sample-window">
                        <strong>Active Window</strong><i>—</i><i>□</i><i>×</i>
                        <span>Window Text</span>
                        <b class="sample-scroll-up">▲</b><b class="sample-scroll-thumb">≡</b><b class="sample-scroll-down">▼</b>
                    </div>
                    <img src="assets/xp/icons/RecyclerFull.png" alt="">
                </div>
            </div>
            <div class="display-panel" id="display-panel-saver" role="tabpanel" aria-labelledby="display-tab-saver" hidden>
                <div class="display-saver-monitor" aria-label="Screen saver preview">
                    <img src="assets/xp/DisplaySettings.png" alt="">
                    <div class="screen-saver-preview"></div>
                </div>
                <fieldset class="display-saver-group"><legend>Screen saver</legend>
                    <div class="display-saver-row">
                        <select id="display-saver" aria-label="Screen saver"><option value="none">(None)</option><option value="flowerbox">3D FlowerBox</option><option value="flying-objects">3D Flying Objects</option><option value="pipes">3D Pipes</option><option value="text">3D Text</option><option value="beziers">Beziers</option><option value="blank">Blank</option><option value="marquee">Marquee</option><option value="pictures">My Pictures Slideshow</option><option value="mystify">Mystify</option><option value="stars">Starfield</option><option value="windows-xp">Windows XP</option></select>
                        <button type="button" class="xp-property-button display-saver-settings">Settings</button>
                        <button type="button" class="xp-property-button display-saver-preview-button">Preview</button>
                    </div>
                    <div class="display-saver-wait-row">
                        <label for="display-saver-wait">Wait:</label>
                        <input id="display-saver-wait" type="number" min="1" max="60">
                        <span>minutes</span>
                        <label><input type="checkbox" class="display-saver-login"> On resume, password protect</label>
                    </div>
                </fieldset>
                <fieldset class="display-power-group"><legend>Monitor power</legend>
                    <p>To adjust monitor power settings and save energy,<br>click <u>Power</u>.</p>
                    <button type="button" class="xp-property-button display-power-button">Power...</button>
                </fieldset>
            </div>
            <div class="display-panel" id="display-panel-appearance" role="tabpanel" aria-labelledby="display-tab-appearance" hidden>
                <div class="appearance-preview" aria-label="Appearance sample">
                    <div class="appearance-window inactive"><strong>Inactive Window</strong><i>—</i><i>□</i><i>×</i></div>
                    <div class="appearance-window active"><strong>Active Window</strong><i>—</i><i>□</i><i>×</i><span>Window Text</span></div>
                    <div class="appearance-message"><strong>Message Box</strong><i>×</i><button type="button" tabindex="-1">OK</button></div>
                </div>
                <label class="display-control-label" for="display-window-style">Windows and buttons:</label>
                <select id="display-window-style" disabled><option>Windows XP style</option></select>
                <label class="display-control-label" for="display-appearance">Color scheme:</label>
                <select id="display-appearance"><option value="blue">Default (blue)</option><option value="olive">Olive green</option><option value="silver">Silver</option></select>
                <label class="display-control-label" for="display-font-size">Font size:</label>
                        <select id="display-font-size"><option value="normal">Normal</option><option value="large">Large Fonts</option><option value="extra-large">Extra Large Fonts</option></select>
                <div class="display-appearance-actions">
                    <button type="button" class="xp-property-button display-effects">Effects...</button>
                    <button type="button" class="xp-property-button display-advanced-appearance">Advanced</button>
                </div>
            </div>
            <div class="display-panel" id="display-panel-settings" role="tabpanel" aria-labelledby="display-tab-settings" hidden>
                <div class="display-settings-monitor" aria-label="Display preview">
                    <img src="assets/xp/DisplaySettings.png" alt="">
                    <div class="display-resolution-preview"><span></span></div>
                </div>
                <p class="display-device-label">Display:<br>Default Monitor on Cirrus Logic 5446 Compatible Graphics Adapter</p>
                <div class="display-settings-groups">
                    <fieldset class="display-resolution-group"><legend>Screen resolution</legend>
                        <div class="resolution-endpoints"><span>Less</span><span>More</span></div>
                        <input id="display-resolution-slider" type="range" min="0" max="3" step="1" aria-label="Screen resolution">
                        <select id="display-resolution" hidden><option value="800x600">800 by 600 pixels</option><option value="1024x768">1024 by 768 pixels</option><option value="1440x900">1440 by 900 pixels</option><option value="auto">Use browser size</option></select>
                        <p class="display-resolution-value"></p>
                    </fieldset>
                    <fieldset class="display-color-quality"><legend>Color quality</legend>
                        <select disabled><option>High (24 bit)</option></select>
                        <div class="display-color-spectrum"></div>
                    </fieldset>
                </div>
                <div class="display-settings-actions">
                    <button type="button" class="xp-property-button display-troubleshoot">Troubleshoot...</button>
                    <button type="button" class="xp-property-button display-monitor-advanced">Advanced</button>
                </div>
                <p class="display-settings-note" hidden>Changes are previewed on the simulated monitor and limited to the available browser viewport.</p>
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
        <img src="assets/xp/icons/AddRemovePrograms.png" alt="">
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
            <div class="explorer-chrome search-explorer-chrome">
                <div class="explorer-menu-row">
                    <div class="explorer-menu-bar" role="menubar"><button>File</button><button>Edit</button><button>View</button><button>Favorites</button><button>Tools</button><button>Help</button></div>
                    <div class="explorer-brand" aria-hidden="true"><img src="assets/xp/WindowsFlag.png" alt=""></div>
                </div>
                <div class="explorer-toolbar">
                    <button disabled><img src="assets/xp/icons/Back.png" alt=""> Back <span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
                    <button disabled aria-label="Forward"><img src="assets/xp/icons/Forward.png" alt=""><span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
                    <button disabled aria-label="Up"><img src="assets/xp/icons/Up.png" alt=""></button>
                    <span class="explorer-toolbar-separator" aria-hidden="true"></span>
                    <button class="search-toolbar-active"><img src="assets/xp/icons/Search.png" alt=""> Search</button>
                    <button><img src="assets/xp/icons/NewFolder.png" alt=""> Folders</button>
                    <span class="explorer-toolbar-separator" aria-hidden="true"></span>
                    <button aria-label="Views"><img src="assets/xp/icons/FolderViewClassic.png" alt=""><span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
                </div>
                <label class="explorer-address"><span>Address</span><span class="explorer-address-field"><img src="assets/xp/icons/Search.png" alt=""><input type="text" aria-label="Address" value="Search Results" readonly></span><button type="button" aria-label="Go"><img src="assets/xp/icons/Go.png" alt=""></button></label>
            </div>
            <div class="search-column-header"><span>Search Companion</span><span><b>Name</b><b>In Folder</b><b>Size</b><b>Type</b></span></div>
            <div class="search-companion-body">
                <aside class="search-companion-panel">
                    <section class="search-start-panel">
                        <strong>What do you want to search for?</strong>
                        <button type="button" data-search-kind="media">Pictures, music, or video</button>
                        <button type="button" data-search-kind="documents">Documents (word processing, spreadsheet, etc.)</button>
                        <button type="button" data-search-kind="all">All files and folders</button>
                        <button type="button" data-search-kind="people">Computers or people</button>
                        <button type="button" data-search-kind="help">Information in Help and Support Center</button>
                        <span>You may also want to...</span>
                        <button type="button" data-search-extra>Search the Internet</button>
                        <button type="button" data-search-extra>Change preferences</button>
                        <button type="button" data-search-extra>Turn off animated character</button>
                    </section>
                    <section class="search-form-panel" hidden>
                        <button type="button" class="search-back" data-search-action="back">Back</button>
                        <strong>Search by any or all of the criteria below.</strong>
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
                        <button type="button" class="xp-btn default" data-search-action="search">Search</button>
                    </section>
                    <img class="search-dog" src="assets/xp/SearchDog.bmp" alt="">
                </aside>
                <main class="search-results-pane">
                    <p class="search-results-status" aria-live="polite">To start your search, follow the instructions in the left pane.</p>
                    <div class="search-results-list" role="listbox" aria-label="Search results"></div>
                </main>
            </div>
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
    image.src = XP_ICON_PATHS[icon];
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
    emptyBin.addEventListener("click", confirmEmptyRecycleBin);

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
        "ExplorerProperties.png",
        openProjectSettings,
      ],
      ["Add or remove programs", "AddRemovePrograms.png", openControlPanel],
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
      "MyDocuments.png",
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
  items.tabIndex = 0;
  main.appendChild(items);
  main.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".explorer-item")) {
      items.focus({ preventScroll: true });
    }
  });

  const chrome = document.createElement("div");
  chrome.className = "explorer-chrome";
  chrome.innerHTML = `
        <div class="explorer-menu-row">
            <div class="explorer-menu-bar" role="menubar"><button data-explorer-menu="file">File</button><button data-explorer-menu="edit">Edit</button><button data-explorer-menu="view">View</button><button data-explorer-menu="favorites">Favorites</button><button data-explorer-menu="tools">Tools</button><button data-explorer-menu="help">Help</button></div>
            <div class="explorer-brand" aria-hidden="true"><img src="assets/xp/WindowsFlag.png" alt=""></div>
        </div>
        <div class="explorer-toolbar">
            <button data-explorer-action="back"><img src="assets/xp/icons/Back.png" alt=""> Back <span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
            <button data-explorer-action="forward" aria-label="Forward"><img src="assets/xp/icons/Forward.png" alt=""><span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
            <button data-explorer-action="up" aria-label="Up"><img src="assets/xp/icons/Up.png" alt=""></button>
            <span class="explorer-toolbar-separator" aria-hidden="true"></span>
            <button data-explorer-action="search"><img src="assets/xp/icons/Search.png" alt=""> Search</button>
            <button data-explorer-action="folders" aria-pressed="false"><img src="assets/xp/icons/NewFolder.png" alt=""> Folders</button>
            <span class="explorer-toolbar-separator" aria-hidden="true"></span>
            <button data-explorer-action="view" aria-label="Views"><img src="assets/xp/icons/FolderViewClassic.png" alt=""><span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
        </div>
        <label class="explorer-address"><span>Address</span><span class="explorer-address-field"><img src="assets/xp/icons/MyComputer.png" alt=""><input type="text" aria-label="Address"></span><button type="button" data-explorer-action="go" aria-label="Go"><img src="assets/xp/icons/Go.png" alt=""></button></label>
    `;
  const body = document.createElement("div");
  body.className = "explorer-body";
  body.append(sidebar, main);
  const status = document.createElement("div");
  status.className = "explorer-status";
  status.hidden = true;
  content.append(chrome, body, status);
  const explorerMenu = document.createElement("div");
  explorerMenu.className = "game-menu explorer-menu";
  explorerMenu.setAttribute("role", "menu");
  explorerMenu.hidden = true;
  chrome.appendChild(explorerMenu);
  const explorerSubmenu = document.createElement("div");
  explorerSubmenu.className = "game-menu explorer-menu explorer-submenu";
  explorerSubmenu.setAttribute("role", "menu");
  explorerSubmenu.hidden = true;
  chrome.appendChild(explorerSubmenu);
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
  const explorerSubmenus = {
    "folder-menu": [
      { label: "Explore", action: "explore", default: true },
      { label: "Open", action: "open-current" },
      { label: "Search...", action: "search-current" },
      { label: "Manage", action: "manage" },
      { separator: true },
      { label: "Map Network Drive...", action: "map-network-drive" },
      {
        label: "Disconnect Network Drive...",
        action: "disconnect-network-drive",
      },
      { separator: true },
      { label: "Create Shortcut", action: "create-shortcut-current" },
      { label: "Delete", action: "delete-current" },
      { separator: true },
      { label: "Properties", action: "properties-current" },
    ],
    toolbars: [
      { label: "Standard Buttons", action: "standard-buttons", checked: true },
      { label: "Address Bar", action: "address-bar", checked: true },
      { label: "Links", action: "links-toolbar" },
      { separator: true },
      { label: "Lock the Toolbars", action: "lock-toolbars", checked: true },
      { label: "Customize...", action: "customize-toolbar" },
    ],
    "explorer-bar": [
      { label: "Search", action: "search-current", shortcut: "Ctrl+E" },
      { label: "Favorites", action: "favorites-bar", shortcut: "Ctrl+I" },
      { label: "History", action: "history-bar", shortcut: "Ctrl+H" },
      { label: "Folders", action: "folders-bar", checked: true },
      { separator: true },
      { label: "Tip of the Day", action: "tip-of-day" },
    ],
    "arrange-icons": [
      { label: "Name", action: "arrange-name" },
      { label: "Type", action: "arrange-type", radio: true, checked: true },
      { label: "Total Size", action: "arrange-total-size" },
      { label: "Free Space", action: "arrange-free-space" },
      { label: "Comments", action: "arrange-comments" },
      { separator: true },
      { label: "Show in Groups", action: "show-groups", checked: true },
      { label: "Auto Arrange", action: "auto-arrange", disabled: true },
      { label: "Align to Grid", action: "align-grid", disabled: true },
    ],
    "go-to": [
      {
        label: "Back",
        action: "back",
        shortcut: "Alt+Left Arrow",
        disabled: true,
      },
      {
        label: "Forward",
        action: "forward",
        shortcut: "Alt+Right Arrow",
        disabled: true,
      },
      { label: "Up One Level", action: "up-one-level" },
      { separator: true },
      { label: "Home Page", action: "home-page", shortcut: "Alt+Home" },
      { separator: true },
      { label: "My Computer", action: "my-computer", checked: true },
    ],
  };
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
  const renderExplorerMenuEntries = (menu, entries, commandAttribute) => {
    menu.replaceChildren();
    entries.forEach((entry) => {
      if (entry.separator) {
        const separator = document.createElement("div");
        separator.className = "game-menu-separator";
        separator.setAttribute("role", "separator");
        menu.appendChild(separator);
        return;
      }
      const item = document.createElement("button");
      item.type = "button";
      item.className = "game-menu-item";
      item.dataset[commandAttribute] = entry.action;
      item.disabled = !!entry.disabled;
      item.setAttribute("role", "menuitem");
      if (entry.default) item.classList.add("explorer-menu-default");
      if (entry.checked) item.classList.add("checked");
      if (entry.radio || entry.checked) {
        const check = document.createElement("span");
        check.className = "menu-check explorer-menu-radio";
        check.textContent = entry.checked ? (entry.radio ? "•" : "✓") : "";
        item.appendChild(check);
      }
      const label = document.createElement("span");
      label.textContent = entry.label;
      item.appendChild(label);
      if (entry.shortcut) {
        const shortcut = document.createElement("span");
        shortcut.className = "menu-shortcut";
        shortcut.textContent = entry.shortcut;
        item.appendChild(shortcut);
      }
      if (entry.submenu) {
        item.classList.add("has-submenu");
        item.setAttribute("aria-haspopup", "menu");
        const arrow = document.createElement("span");
        arrow.className = "explorer-menu-arrow";
        arrow.textContent = "▶";
        item.appendChild(arrow);
      }
      menu.appendChild(item);
    });
  };
  const showExplorerSubmenu = (name, parentItem, focusFirst = false) => {
    const entries = explorerSubmenus[name];
    if (!entries) return false;
    renderExplorerMenuEntries(explorerSubmenu, entries, "explorerSubcommand");
    explorerSubmenu.dataset.explorerSubmenuName = name;
    explorerSubmenu.dataset.parentCommand = name;
    explorerSubmenu.style.left = `${explorerMenu.offsetLeft + explorerMenu.offsetWidth - 3}px`;
    explorerSubmenu.style.top = `${explorerMenu.offsetTop + parentItem.offsetTop - 1}px`;
    explorerSubmenu.hidden = false;
    if (focusFirst)
      explorerSubmenu.querySelector("button:not(:disabled)")?.focus();
    return true;
  };
  const showExplorerMenu = (name, button, focusFirst = false) => {
    const selected = selectedExplorerNodes(win);
    const protectedSelection = selected.some((id) => fs.isProtected(id));
    const writable = ![fs.RECYCLE_BIN, fs.MY_COMPUTER].includes(
      win.currentFolderId,
    );
    const currentFolderName = fs.getNode(win.currentFolderId)?.name || "Folder";
    const actions = {
      file: [
        { label: "Create Shortcut", action: "create-shortcut", disabled: true },
        {
          label: "Delete",
          action:
            win.currentFolderId === fs.MY_COMPUTER
              ? "delete-current"
              : "delete",
          disabled:
            win.currentFolderId !== fs.MY_COMPUTER &&
            (!selected.length || protectedSelection),
        },
        {
          label: "Rename",
          action:
            win.currentFolderId === fs.MY_COMPUTER
              ? "rename-current"
              : "rename",
          disabled:
            win.currentFolderId !== fs.MY_COMPUTER &&
            (selected.length !== 1 || protectedSelection),
        },
        { label: "Properties", action: "properties-current" },
        { separator: true },
        { label: currentFolderName, action: "folder-menu", submenu: true },
        { separator: true },
        { label: "Close", action: "close" },
      ],
      edit: [
        { label: "Undo", action: "undo", shortcut: "Ctrl+Z", disabled: true },
        { separator: true },
        {
          label: "Cut",
          action: "cut",
          shortcut: "Ctrl+X",
          disabled: !selected.length || protectedSelection,
        },
        {
          label: "Copy",
          action: "copy",
          shortcut: "Ctrl+C",
          disabled: !selected.length,
        },
        {
          label: "Paste",
          action: "paste",
          shortcut: "Ctrl+V",
          disabled: !writable || !fileOps.canPaste(win.currentFolderId),
        },
        { label: "Paste Shortcut", action: "paste-shortcut", disabled: true },
        { separator: true },
        { label: "Select All", action: "select-all", shortcut: "Ctrl+A" },
        { label: "Invert Selection", action: "invert-selection" },
      ],
      view: [
        { label: "Toolbars", action: "toolbars", submenu: true },
        { label: "Status Bar", action: "status-bar" },
        { label: "Explorer Bar", action: "explorer-bar", submenu: true },
        { separator: true },
        {
          label: "Thumbnails",
          action: "thumbnails",
          radio: true,
          checked: win.explorerView === "thumbnails",
        },
        {
          label: "Tiles",
          action: "tiles",
          radio: true,
          checked: (win.explorerView || "tiles") === "tiles",
        },
        {
          label: "Icons",
          action: "icons",
          radio: true,
          checked: win.explorerView === "icons",
        },
        {
          label: "List",
          action: "list",
          radio: true,
          checked: win.explorerView === "list",
        },
        {
          label: "Details",
          action: "details",
          radio: true,
          checked: win.explorerView === "details",
        },
        { separator: true },
        { label: "Arrange Icons By", action: "arrange-icons", submenu: true },
        { separator: true },
        { label: "Choose Details...", action: "choose-details" },
        { label: "Go To", action: "go-to", submenu: true },
        { label: "Refresh", action: "refresh" },
      ],
      favorites: [
        { label: "Add to Favorites...", action: "add-favorite" },
        { label: "Organize Favorites...", action: "organize-favorites" },
        { separator: true },
        { label: "Links", action: "links", submenu: true },
        { label: "MSN.com", action: "msn" },
        { label: "Radio Station Guide", action: "radio-guide" },
      ],
      tools: [
        { label: "Map Network Drive...", action: "map-network-drive" },
        {
          label: "Disconnect Network Drive...",
          action: "disconnect-network-drive",
        },
        { label: "Synchronize...", action: "synchronize" },
        { separator: true },
        { label: "Folder Options...", action: "folder-options" },
      ],
      help: [
        { label: "Help and Support Center", action: "help-center" },
        { separator: true },
        { label: "Is this copy of Windows legal?", action: "windows-legal" },
        { label: "About Windows", action: "about-windows" },
      ],
    }[name];
    explorerMenu.dataset.explorerMenuName = name;
    renderExplorerMenuEntries(explorerMenu, actions, "explorerCommand");
    explorerSubmenu.hidden = true;
    explorerMenu.hidden = false;
    explorerMenuButtons.forEach((entry) =>
      entry.setAttribute("aria-expanded", String(entry === button)),
    );
    explorerMenu.style.left = `${button.offsetLeft}px`;
    explorerMenu.style.top = `${button.offsetTop + button.offsetHeight}px`;
    if (focusFirst)
      explorerMenu.querySelector("button:not(:disabled)")?.focus();
  };
  chrome.addEventListener("click", (event) => {
    const menuButton = event.target.closest("[data-explorer-menu]");
    const menuName = menuButton?.dataset.explorerMenu;
    if (menuName) {
      showExplorerMenu(menuName, menuButton, false);
      return;
    }
    const commandButton = event.target.closest("[data-explorer-command]");
    const command = commandButton?.dataset.explorerCommand;
    if (command) {
      if (commandButton.classList.contains("has-submenu")) {
        showExplorerSubmenu(command, commandButton, false);
        return;
      }
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
      if (command === "delete-current" || command === "rename-current")
        XPDialogs.alert(
          `Cannot ${command === "delete-current" ? "delete" : "rename"} My Computer.`,
          "Windows Explorer",
          "info",
        );
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
      if (command === "properties-current")
        openShellProperties(selected[0] || win.currentFolderId);
      if (command === "select-all")
        win.el
          .querySelectorAll(".explorer-item")
          .forEach((item) => item.classList.add("selected"));
      if (command === "invert-selection")
        win.el
          .querySelectorAll(".explorer-item")
          .forEach((item) => item.classList.toggle("selected"));
      if (command === "refresh") renderExplorerItems(win);
      if (command === "help-center") openHelpAndSupport();
      if (command === "about-windows") openAboutWindows();
      if (
        [
          "add-favorite",
          "organize-favorites",
          "msn",
          "radio-guide",
          "map-network-drive",
          "disconnect-network-drive",
          "synchronize",
          "folder-options",
          "windows-legal",
          "choose-details",
        ].includes(command)
      )
        XPDialogs.alert(
          "This Windows XP feature is not available in Astro Flash.",
          commandButton.textContent.trim() || "Windows Explorer",
          "info",
        );
      explorerMenu.hidden = true;
      explorerSubmenu.hidden = true;
      explorerMenuButtons.forEach((button) =>
        button.setAttribute("aria-expanded", "false"),
      );
      return;
    }
    const subcommandButton = event.target.closest("[data-explorer-subcommand]");
    const subcommand = subcommandButton?.dataset.explorerSubcommand;
    if (subcommand) {
      if (subcommand === "search-current") openSearchDialog();
      if (subcommand === "folders-bar") {
        content.classList.add("folders-visible");
        chrome
          .querySelector('[data-explorer-action="folders"]')
          ?.setAttribute("aria-pressed", "true");
      }
      if (subcommand === "up-one-level") {
        const parent =
          fs.getParent(win.currentFolderId) || fs.getNode(fs.DESKTOP);
        if (parent) navigateExplorer(win, parent.id);
      }
      if (subcommand === "my-computer") navigateExplorer(win, fs.MY_COMPUTER);
      if (subcommand === "properties-current")
        openShellProperties(win.currentFolderId);
      if (
        [
          "manage",
          "map-network-drive",
          "disconnect-network-drive",
          "create-shortcut-current",
          "delete-current",
          "standard-buttons",
          "address-bar",
          "links-toolbar",
          "lock-toolbars",
          "customize-toolbar",
          "favorites-bar",
          "history-bar",
          "tip-of-day",
          "home-page",
        ].includes(subcommand)
      )
        XPDialogs.alert(
          "This Windows XP feature is not available in Astro Flash.",
          subcommandButton.textContent.trim() || "Windows Explorer",
          "info",
        );
      explorerMenu.hidden = true;
      explorerSubmenu.hidden = true;
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
      const parent =
        fs.getParent(win.currentFolderId) ||
        ([fs.MY_COMPUTER, fs.RECYCLE_BIN].includes(win.currentFolderId)
          ? fs.getNode(fs.DESKTOP)
          : null);
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
  explorerMenu.addEventListener("pointerover", (event) => {
    const parentItem = event.target.closest(".has-submenu");
    if (parentItem)
      showExplorerSubmenu(
        parentItem.dataset.explorerCommand,
        parentItem,
        false,
      );
    else if (event.target.closest(".game-menu-item"))
      explorerSubmenu.hidden = true;
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
      explorerSubmenu.hidden = true;
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
        showExplorerMenu(target.dataset.explorerMenu, target, true);
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
        showExplorerMenu(heading.dataset.explorerMenu, heading, true);
      else {
        target.focus();
        showExplorerMenu(target.dataset.explorerMenu, target, true);
      }
      return;
    }
    const menuItems = [
      ...explorerMenu.querySelectorAll("button:not(:disabled)"),
    ];
    const activeMenuItem = document.activeElement?.closest?.(
      "[data-explorer-command]",
    );
    if (
      event.key === "ArrowRight" &&
      activeMenuItem?.classList.contains("has-submenu")
    ) {
      event.preventDefault();
      showExplorerSubmenu(
        activeMenuItem.dataset.explorerCommand,
        activeMenuItem,
        true,
      );
      return;
    }
    const activeSubmenuItem = document.activeElement?.closest?.(
      "[data-explorer-subcommand]",
    );
    if (event.key === "ArrowLeft" && activeSubmenuItem) {
      event.preventDefault();
      const parent = explorerMenu.querySelector(
        `[data-explorer-command="${CSS.escape(explorerSubmenu.dataset.parentCommand)}"]`,
      );
      explorerSubmenu.hidden = true;
      parent?.focus();
      return;
    }
    const submenuItems = [
      ...explorerSubmenu.querySelectorAll("button:not(:disabled)"),
    ];
    if (
      !explorerSubmenu.hidden &&
      activeSubmenuItem &&
      ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
    ) {
      event.preventDefault();
      const index = submenuItems.indexOf(activeSubmenuItem);
      const target =
        event.key === "Home"
          ? submenuItems[0]
          : event.key === "End"
            ? submenuItems.at(-1)
            : submenuItems[
                (index +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  submenuItems.length) %
                  submenuItems.length
              ];
      target?.focus();
      return;
    }
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

const openDesktopItemsDialog = (ownerWindow) => {
  const current = getDesktopSystemIcons();
  const dialog = XPDialogs.createDialog({
    title: "Desktop Items",
    onCancel: () => dialog.close("cancel"),
  });
  dialog.el.classList.add("desktop-items-dialog");
  ownerWindow.el.classList.remove("active");

  const titleButtons = dialog.el.querySelector(".title-buttons");
  const help = document.createElement("button");
  help.type = "button";
  help.className = "tb-btn help-btn";
  help.title = "Help";
  help.setAttribute("aria-label", "Help");
  titleButtons.prepend(help);

  const tabs = document.createElement("div");
  tabs.className = "desktop-items-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.innerHTML = `
    <button type="button" role="tab" aria-selected="true" data-desktop-items-tab="general">General</button>
    <button type="button" role="tab" aria-selected="false" tabindex="-1" data-desktop-items-tab="web">Web</button>
  `;
  const panels = document.createElement("div");
  panels.className = "desktop-items-panels";
  panels.innerHTML = `
    <section role="tabpanel" data-desktop-items-panel="general">
      <fieldset class="desktop-icons-group"><legend>Desktop icons</legend>
        <label><input type="checkbox" data-system-icon="__my-documents"> My Documents</label>
        <label><input type="checkbox" data-system-icon="__my-computer"> My Computer</label>
        <label><input type="checkbox" disabled> My Network Places</label>
      </fieldset>
      <div class="desktop-icon-choices" role="listbox" aria-label="Desktop icons">
        <button type="button" class="selected"><img src="assets/xp/icons/MyComputer.png" alt=""><span>My Computer</span></button>
        <button type="button"><img src="assets/xp/icons/MyDocuments.png" alt=""><span>My Documents</span></button>
        <button type="button"><img src="assets/xp/icons/MyNetworkPlaces.png" alt=""><span>My Network<br>Places</span></button>
        <button type="button"><img src="assets/xp/icons/RecyclerFull.png" alt=""><span>Recycle Bin<br>(full)</span></button>
        <button type="button"><img src="assets/xp/icons/RecyclerEmpty.png" alt=""><span>Recycle Bin<br>(empty)</span></button>
      </div>
      <div class="desktop-icon-actions"><button type="button" class="xp-btn">Change Icon...</button><button type="button" class="xp-btn">Restore Default</button></div>
      <fieldset class="desktop-cleanup-group"><legend>Desktop cleanup</legend>
        <p>Desktop Cleanup moves unused desktop items to a folder.</p>
        <label><input type="checkbox"> Run Desktop Cleanup Wizard every 60 days</label>
        <button type="button" class="xp-btn">Clean Desktop Now</button>
      </fieldset>
    </section>
    <section role="tabpanel" data-desktop-items-panel="web" hidden>
      <p>Web pages can be shown directly on your desktop.</p>
      <div class="desktop-web-empty">No Web pages are currently displayed.</div>
    </section>
  `;

  panels.querySelectorAll("[data-system-icon]").forEach((checkbox) => {
    checkbox.checked = current[checkbox.dataset.systemIcon] !== false;
  });
  tabs.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-desktop-items-tab]");
    if (!tab) return;
    tabs.querySelectorAll('[role="tab"]').forEach((item) => {
      const active = item === tab;
      item.setAttribute("aria-selected", String(active));
      item.tabIndex = active ? 0 : -1;
    });
    panels.querySelectorAll('[role="tabpanel"]').forEach((panel) => {
      panel.hidden =
        panel.dataset.desktopItemsPanel !== tab.dataset.desktopItemsTab;
    });
    tab.focus();
  });
  panels
    .querySelector(".desktop-icon-choices")
    .addEventListener("click", (event) => {
      const item = event.target.closest("button");
      if (!item) return;
      panels
        .querySelectorAll(".desktop-icon-choices button")
        .forEach((button) =>
          button.classList.toggle("selected", button === item),
        );
    });

  const buttons = document.createElement("div");
  buttons.className = "dlg-buttons";
  const ok = XPDialogs.createDialogButton(
    { id: "ok", label: "OK", isDefault: true },
    () => {
      const next = { ...current };
      panels.querySelectorAll("[data-system-icon]").forEach((checkbox) => {
        next[checkbox.dataset.systemIcon] = checkbox.checked;
      });
      saveDesktopSystemIcons(next);
      buildDesktopIcons();
      dialog.close("ok");
    },
  );
  const cancel = XPDialogs.createDialogButton(
    { id: "cancel", label: "Cancel", isCancel: true },
    () => dialog.close("cancel"),
  );
  buttons.append(ok, cancel);
  dialog.body.append(tabs, panels, buttons);
  dialog.defaultButton = ok;
  dialog.onResult(() => {
    ownerWindow.el.classList.add("active");
    focusWindow(ownerWindow.gameId);
  });
  panels.querySelector("[data-system-icon]").focus();
};

const setDisplayDialogOwnerActive = (ownerWindow, active) => {
  ownerWindow.el.classList.toggle("active", active);
  if (active) focusWindow(ownerWindow.gameId);
};

const openDisplayNotice = (ownerWindow, title, message) => {
  setDisplayDialogOwnerActive(ownerWindow, false);
  XPDialogs.alert(message, title, "info").finally(() =>
    setDisplayDialogOwnerActive(ownerWindow, true),
  );
};

const addDisplayDialogHelpButton = (dialog) => {
  const help = document.createElement("button");
  help.type = "button";
  help.className = "tb-btn help-btn";
  help.title = "Help";
  help.setAttribute("aria-label", "Help");
  dialog.el.querySelector(".title-buttons").prepend(help);
};

const openDisplayEffectsDialog = (ownerWindow, settings, onCommit) => {
  const draft = { ...settings };
  const dialog = XPDialogs.createDialog({
    title: "Effects",
    onCancel: () => dialog.close("cancel"),
  });
  dialog.el.classList.add("display-effects-dialog");
  setDisplayDialogOwnerActive(ownerWindow, false);
  addDisplayDialogHelpButton(dialog);
  dialog.body.innerHTML = `
    <div class="effects-option"><label><input type="checkbox" data-effect-enabled="transition"> Use the following transition effect for menus and tooltips:</label><select class="xp-select" data-effect="transitionEffect"><option value="fade">Fade effect</option><option value="scroll">Scroll effect</option></select></div>
    <div class="effects-option"><label><input type="checkbox" data-effect-enabled="smoothing"> Use the following method to smooth edges of screen fonts:</label><select class="xp-select" data-effect="fontSmoothing"><option value="standard">Standard</option><option value="cleartype">ClearType</option></select></div>
    <label class="effects-check"><input type="checkbox" data-effect="largeIcons"> Use large icons</label>
    <label class="effects-check"><input type="checkbox" data-effect="menuShadows"> Show shadows under menus</label>
    <label class="effects-check"><input type="checkbox" data-effect="showWindowContents"> Show window contents while dragging</label>
    <label class="effects-check"><input type="checkbox" data-effect="hideKeyboardCues"> Hide underlined letters for keyboard navigation until I press the Alt key</label>
  `;
  const transitionEnabled = dialog.body.querySelector(
    '[data-effect-enabled="transition"]',
  );
  const smoothingEnabled = dialog.body.querySelector(
    '[data-effect-enabled="smoothing"]',
  );
  const transition = dialog.body.querySelector(
    '[data-effect="transitionEffect"]',
  );
  const smoothing = dialog.body.querySelector('[data-effect="fontSmoothing"]');
  transitionEnabled.checked = draft.transitionEffect !== "none";
  smoothingEnabled.checked = draft.fontSmoothing !== "none";
  transition.value = draft.transitionEffect === "scroll" ? "scroll" : "fade";
  smoothing.value =
    draft.fontSmoothing === "cleartype" ? "cleartype" : "standard";
  [
    "largeIcons",
    "menuShadows",
    "showWindowContents",
    "hideKeyboardCues",
  ].forEach((key) => {
    dialog.body.querySelector(`[data-effect="${key}"]`).checked = !!draft[key];
  });
  const syncEnabled = () => {
    transition.disabled = !transitionEnabled.checked;
    smoothing.disabled = !smoothingEnabled.checked;
  };
  transitionEnabled.addEventListener("change", syncEnabled);
  smoothingEnabled.addEventListener("change", syncEnabled);
  syncEnabled();

  const buttons = document.createElement("div");
  buttons.className = "dlg-buttons";
  const ok = XPDialogs.createDialogButton(
    { id: "ok", label: "OK", isDefault: true },
    () => {
      draft.transitionEffect = transitionEnabled.checked
        ? transition.value
        : "none";
      draft.fontSmoothing = smoothingEnabled.checked ? smoothing.value : "none";
      [
        "largeIcons",
        "menuShadows",
        "showWindowContents",
        "hideKeyboardCues",
      ].forEach((key) => {
        draft[key] = dialog.body.querySelector(
          `[data-effect="${key}"]`,
        ).checked;
      });
      onCommit(draft);
      dialog.close("ok");
    },
  );
  const cancel = XPDialogs.createDialogButton(
    { id: "cancel", label: "Cancel", isCancel: true },
    () => dialog.close("cancel"),
  );
  buttons.append(ok, cancel);
  dialog.body.append(buttons);
  dialog.defaultButton = ok;
  dialog.onResult(() => setDisplayDialogOwnerActive(ownerWindow, true));
  transitionEnabled.focus();
};

const openAdvancedAppearanceDialog = (ownerWindow, settings, onCommit) => {
  const dialog = XPDialogs.createDialog({
    title: "Advanced Appearance",
    onCancel: () => dialog.close("cancel"),
  });
  dialog.el.classList.add("advanced-appearance-dialog");
  setDisplayDialogOwnerActive(ownerWindow, false);
  addDisplayDialogHelpButton(dialog);
  dialog.body.innerHTML = `
    <div class="advanced-appearance-preview">
      <div class="advanced-inactive">Inactive Window <b>_</b><b>□</b><b>×</b></div>
      <div class="advanced-active">Active Window <b>_</b><b>□</b><b>×</b></div>
      <div class="advanced-menu">Normal &nbsp;&nbsp; <span>Disabled</span> &nbsp;&nbsp; Selected</div>
      <div class="advanced-window-text">Window Text</div>
      <div class="advanced-message"><strong>Message Box</strong><b>×</b><span>Message Text</span><button type="button" tabindex="-1">OK</button></div>
    </div>
    <p class="advanced-appearance-copy">If you select a windows and buttons setting other than Windows Classic,<br>it will override the following settings, except in some older programs.</p>
    <div class="advanced-controls">
      <label>Item:<select class="xp-select" disabled><option>Desktop</option></select></label>
      <label class="advanced-size">Size:<input class="xp-input" disabled></label>
      <label>Color 1:<input type="color" data-advanced-color></label>
      <label class="advanced-disabled">Color 2:<input disabled></label>
      <label class="advanced-disabled">Font:<select class="xp-select" disabled></select></label>
      <label class="advanced-disabled">Size:<input class="xp-input" disabled></label>
      <label class="advanced-disabled">Color:<input disabled></label>
    </div>
  `;
  dialog.body.querySelector(".advanced-appearance-preview").dataset.appearance =
    settings.appearance;
  dialog.body.querySelector("[data-advanced-color]").value =
    settings.backgroundColor;
  const buttons = document.createElement("div");
  buttons.className = "dlg-buttons";
  const ok = XPDialogs.createDialogButton(
    { id: "ok", label: "OK", isDefault: true },
    () => {
      onCommit({
        ...settings,
        backgroundColor: dialog.body.querySelector("[data-advanced-color]")
          .value,
      });
      dialog.close("ok");
    },
  );
  const cancel = XPDialogs.createDialogButton(
    { id: "cancel", label: "Cancel", isCancel: true },
    () => dialog.close("cancel"),
  );
  buttons.append(ok, cancel);
  dialog.body.append(buttons);
  dialog.defaultButton = ok;
  dialog.onResult(() => setDisplayDialogOwnerActive(ownerWindow, true));
  dialog.body.querySelector("[data-advanced-color]").focus();
};

const openMonitorPropertiesDialog = (ownerWindow) => {
  const dialog = XPDialogs.createDialog({
    title: "(Default Monitor) and Properties",
    onCancel: () => dialog.close("cancel"),
  });
  dialog.el.classList.add("monitor-properties-dialog");
  setDisplayDialogOwnerActive(ownerWindow, false);
  addDisplayDialogHelpButton(dialog);
  dialog.body.innerHTML = `
    <div class="monitor-property-tabs" role="tablist" aria-label="Monitor properties">
      <button type="button" class="selected" role="tab" aria-selected="true" aria-controls="monitor-general-panel" data-monitor-tab="general">General</button>
      <button type="button" role="tab" aria-selected="false" aria-controls="monitor-adapter-panel" data-monitor-tab="adapter" tabindex="-1">Adapter</button>
      <button type="button" role="tab" aria-selected="false" aria-controls="monitor-monitor-panel" data-monitor-tab="monitor" tabindex="-1">Monitor</button>
      <button type="button" role="tab" aria-selected="false" aria-controls="monitor-troubleshoot-panel" data-monitor-tab="troubleshoot" tabindex="-1">Troubleshoot</button>
    </div>
    <section class="monitor-property-panel" id="monitor-general-panel" role="tabpanel" data-monitor-panel="general">
      <fieldset><legend>Display</legend><p>If your screen resolution makes screen items too small to view<br>comfortably, you can increase the DPI to compensate. To change<br>font sizes only, click Cancel and go to the Appearance tab.</p><label>DPI setting:<select class="xp-select" disabled><option>Normal size (96 DPI)</option></select></label><p>Normal size (96 dpi)</p></fieldset>
      <fieldset><legend>Compatibility</legend><p>Some programs might not operate properly unless you restart the<br>computer after changing display settings.</p><p>After I change display settings:</p><label><input type="radio" name="display-compatibility"> Restart the computer before applying the new display settings</label><label><input type="radio" name="display-compatibility" checked> Apply the new display settings without restarting</label><label><input type="radio" name="display-compatibility"> Ask me before applying the new display settings</label><p>Some games and other programs must be run in 256-color mode.<br>Learn more about <u>running programs in 256-color mode</u>.</p></fieldset>
    </section>
    <section class="monitor-property-panel" id="monitor-adapter-panel" role="tabpanel" data-monitor-panel="adapter" hidden>
      <fieldset><legend>Adapter Information</legend><p>Chip Type: Browser display adapter</p><p>DAC Type: Internal</p><p>Memory Size: Not available</p><p>Adapter String: Astro Flash virtual display</p></fieldset>
      <fieldset><legend>Adapter</legend><p>This desktop uses the browser's active graphics adapter.</p><button type="button" class="xp-property-button" disabled>List All Modes...</button></fieldset>
    </section>
    <section class="monitor-property-panel" id="monitor-monitor-panel" role="tabpanel" data-monitor-panel="monitor" hidden>
      <fieldset><legend>Monitor type</legend><p>(Default Monitor)</p><button type="button" class="xp-property-button" disabled>Properties</button></fieldset>
      <fieldset><legend>Monitor settings</legend><label>Screen refresh rate:<select class="xp-select" disabled><option>Use hardware default setting</option></select></label><label><input type="checkbox" checked disabled> Hide modes that this monitor cannot display</label></fieldset>
    </section>
    <section class="monitor-property-panel" id="monitor-troubleshoot-panel" role="tabpanel" data-monitor-panel="troubleshoot" hidden>
      <fieldset><legend>Hardware acceleration</legend><p>If your computer is having problems with graphics, move the slider toward None.</p><label class="monitor-acceleration"><span>None</span><input type="range" min="0" max="5" value="5"><span>Full</span></label><p>All cursor and advanced drawing accelerations are enabled.</p></fieldset>
      <label><input type="checkbox" checked> Enable write combining</label>
    </section>
  `;
  const tabs = [...dialog.body.querySelectorAll("[data-monitor-tab]")];
  const panels = [...dialog.body.querySelectorAll("[data-monitor-panel]")];
  const selectTab = (tab) => {
    tabs.forEach((candidate) => {
      const selected = candidate === tab;
      candidate.classList.toggle("selected", selected);
      candidate.setAttribute("aria-selected", String(selected));
      candidate.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.monitorPanel !== tab.dataset.monitorTab;
    });
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (event) => {
      const direction =
        event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (!direction && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      const nextIndex =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : (index + direction + tabs.length) % tabs.length;
      selectTab(tabs[nextIndex]);
      tabs[nextIndex].focus();
    });
  });
  const buttons = document.createElement("div");
  buttons.className = "dlg-buttons";
  const ok = XPDialogs.createDialogButton(
    { id: "ok", label: "OK", isDefault: true },
    () => dialog.close("ok"),
  );
  const cancel = XPDialogs.createDialogButton(
    { id: "cancel", label: "Cancel", isCancel: true },
    () => dialog.close("cancel"),
  );
  const apply = XPDialogs.createDialogButton(
    { id: "apply", label: "Apply" },
    () => {},
  );
  apply.disabled = true;
  buttons.append(ok, cancel, apply);
  dialog.body.append(buttons);
  dialog.defaultButton = ok;
  dialog.onResult(() => setDisplayDialogOwnerActive(ownerWindow, true));
  tabs[0].focus();
};

const openWallpaperBrowseDialog = (ownerWindow, fileInput) => {
  const dialog = XPDialogs.createDialog({
    title: "Browse",
    onCancel: () => dialog.close("cancel"),
  });
  dialog.el.classList.add("wallpaper-browse-dialog");
  setDisplayDialogOwnerActive(ownerWindow, false);
  addDisplayDialogHelpButton(dialog);
  dialog.body.innerHTML = `
    <div class="browse-location"><label>Look in:</label><span><img src="assets/xp/icons/MyPictures.png" alt="">My Pictures</span><button type="button" disabled>◀</button><button type="button" disabled>↥</button><button type="button" disabled>☆</button><button type="button" disabled>▦</button></div>
    <div class="browse-body"><aside><button><img src="assets/xp/icons/RecentDocuments.png" alt="">My Recent<br>Documents</button><button><img src="assets/xp/icons/Programs.png" alt="">Desktop</button><button><img src="assets/xp/icons/MyDocuments.png" alt="">My Documents</button><button><img src="assets/xp/icons/MyComputer.png" alt="">My Computer</button><button><img src="assets/xp/icons/MyNetworkPlaces.png" alt="">My Network</button></aside><main><button type="button" class="sample-pictures-folder"><span><i></i><i></i><i></i><i></i></span>Sample Pictures</button></main></div>
    <div class="browse-fields"><label>File name:<input class="xp-input browse-file-name" readonly></label><label>Files of type:<select class="xp-select" disabled><option>Background Files</option></select></label></div>
  `;
  const buttons = document.createElement("div");
  buttons.className = "browse-buttons";
  const open = XPDialogs.createDialogButton(
    { id: "open", label: "Open", isDefault: true },
    () => fileInput.click(),
  );
  const cancel = XPDialogs.createDialogButton(
    { id: "cancel", label: "Cancel", isCancel: true },
    () => dialog.close("cancel"),
  );
  buttons.append(open, cancel);
  dialog.body.append(buttons);
  dialog.defaultButton = open;
  dialog.onResult(() => setDisplayDialogOwnerActive(ownerWindow, true));
  dialog.setChosenFile = (name) => {
    if (!dialog.el.isConnected) return;
    dialog.body.querySelector(".browse-file-name").value = name;
    dialog.close("open");
  };
  dialog.body.querySelector(".sample-pictures-folder").focus();
  return dialog;
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
    saverSettings: content.querySelector(".display-saver-settings"),
    saverPreviewButton: content.querySelector(".display-saver-preview-button"),
    saverWait: content.querySelector("#display-saver-wait"),
    saverLogin: content.querySelector(".display-saver-login"),
    appearance: content.querySelector("#display-appearance"),
    fontSize: content.querySelector("#display-font-size"),
    resolution: content.querySelector("#display-resolution"),
    resolutionSlider: content.querySelector("#display-resolution-slider"),
    preview: content.querySelector(".display-preview-surface"),
    saverPreview: content.querySelector(".screen-saver-preview"),
    appearancePreview: content.querySelector(".appearance-preview"),
    resolutionPreview: content.querySelector(".display-resolution-preview"),
    resolutionValue: content.querySelector(".display-resolution-value"),
    status: content.querySelector(".display-status"),
    customize: content.querySelector(".display-customize"),
    browse: content.querySelector(".display-browse"),
    apply: content.querySelector('[data-display-action="apply"]'),
  };
  const setStatus = (message = "") => {
    controls.status.textContent = message;
    controls.status.hidden = !message;
  };
  const themes = {
    "windows-xp": {
      appearance: "blue",
      wallpaper: "bliss",
      backgroundColor: "#3a6ea5",
    },
    classic: {
      appearance: "silver",
      wallpaper: "ascent",
      backgroundColor: "#4b6f8f",
    },
    olive: {
      appearance: "olive",
      wallpaper: "autumn",
      backgroundColor: "#586b2f",
    },
  };
  const sync = () => {
    controls.theme.value = pending.theme;
    controls.wallpaper.value = pending.wallpaper;
    content.querySelectorAll("[data-wallpaper]").forEach((item) => {
      const selected = item.dataset.wallpaper === pending.wallpaper;
      item.classList.toggle("selected", selected);
      item.setAttribute("aria-selected", String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    controls.position.value = pending.position;
    controls.color.value = pending.backgroundColor;
    controls.saver.value = pending.screenSaver;
    controls.saverSettings.disabled = pending.screenSaver === "none";
    controls.saverPreviewButton.disabled = pending.screenSaver === "none";
    controls.saverWait.value = String(pending.screenSaverWait);
    controls.saverLogin.checked = pending.requireLoginOnResume;
    controls.appearance.value = pending.appearance;
    controls.fontSize.value = pending.fontSize;
    controls.resolution.value = pending.resolution;
    controls.resolutionSlider.value = String(
      pending.resolution === "auto"
        ? 1
        : ["800x600", "1024x768", "1440x900"].indexOf(pending.resolution),
    );
    controls.clearImage.hidden = !pending.customWallpaper;
    controls.preview.style.backgroundColor = pending.backgroundColor;
    controls.preview.style.backgroundImage = displayBackground(pending);
    controls.preview.dataset.position = pending.position;
    content.querySelector(".display-color-button span").style.backgroundColor =
      pending.backgroundColor;
    controls.saverPreview.dataset.saver = pending.screenSaver;
    controls.appearancePreview.dataset.appearance = pending.appearance;
    controls.resolutionPreview.dataset.resolution = pending.resolution;
    const monitor = getSimulatedMonitorSize(pending.resolution);
    controls.resolutionValue.textContent =
      pending.resolution === "auto"
        ? `${window.innerWidth} by ${window.innerHeight} pixels`
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
    if (panelId === "display-panel-desktop")
      requestAnimationFrame(syncWallpaperScrollbar);
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
    if (!Object.hasOwn(themes, controls.theme.value)) {
      openDisplayNotice(
        win,
        controls.theme.value === "online" ? "Windows Themes" : "Open Theme",
        controls.theme.value === "online"
          ? "More themes are not available in this offline desktop."
          : "Select Windows XP or Windows Classic to change the current theme.",
      );
      controls.theme.value = pending.theme;
      return;
    }
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
  const wallpaperList = content.querySelector(".display-wallpaper-list");
  const wallpaperItems = [
    ...wallpaperList.querySelectorAll("[data-wallpaper]"),
  ];
  const wallpaperScroller = wallpaperList.querySelector(
    ".display-wallpaper-items",
  );
  const wallpaperScrollbar = wallpaperList.querySelector(".display-scrollbar");
  const wallpaperScrollTrack =
    wallpaperScrollbar.querySelector(".scroll-track");
  const wallpaperScrollThumb =
    wallpaperScrollbar.querySelector(".scroll-thumb");
  const syncWallpaperScrollbar = () => {
    const maxScroll = Math.max(
      0,
      wallpaperScroller.scrollHeight - wallpaperScroller.clientHeight,
    );
    const trackHeight = wallpaperScrollTrack.clientHeight;
    const thumbHeight =
      maxScroll === 0
        ? trackHeight
        : Math.max(
            22,
            Math.round(
              trackHeight *
                (wallpaperScroller.clientHeight /
                  wallpaperScroller.scrollHeight),
            ),
          );
    const thumbTravel = Math.max(0, trackHeight - thumbHeight);
    const thumbTop =
      maxScroll === 0
        ? 0
        : Math.round((wallpaperScroller.scrollTop / maxScroll) * thumbTravel);
    wallpaperScrollThumb.style.height = `${thumbHeight}px`;
    wallpaperScrollThumb.style.transform = `translateY(${thumbTop}px)`;
    wallpaperScrollbar.classList.toggle("disabled", maxScroll === 0);
  };
  wallpaperScroller.addEventListener("scroll", syncWallpaperScrollbar);
  wallpaperScrollbar
    .querySelector(".scroll-arrow.up")
    .addEventListener("pointerdown", (event) => {
      event.preventDefault();
      wallpaperScroller.scrollBy({ top: -18 });
    });
  wallpaperScrollbar
    .querySelector(".scroll-arrow.down")
    .addEventListener("pointerdown", (event) => {
      event.preventDefault();
      wallpaperScroller.scrollBy({ top: 18 });
    });
  wallpaperScrollTrack.addEventListener("pointerdown", (event) => {
    if (event.target === wallpaperScrollThumb) return;
    event.preventDefault();
    const thumbBounds = wallpaperScrollThumb.getBoundingClientRect();
    const direction = event.clientY < thumbBounds.top ? -1 : 1;
    wallpaperScroller.scrollBy({
      top: direction * wallpaperScroller.clientHeight,
    });
  });
  wallpaperScrollThumb.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY;
    const startScrollTop = wallpaperScroller.scrollTop;
    const maxScroll =
      wallpaperScroller.scrollHeight - wallpaperScroller.clientHeight;
    const thumbTravel =
      wallpaperScrollTrack.clientHeight - wallpaperScrollThumb.offsetHeight;
    wallpaperScrollThumb.setPointerCapture(event.pointerId);
    const dragThumb = (moveEvent) => {
      if (thumbTravel <= 0) return;
      wallpaperScroller.scrollTop =
        startScrollTop +
        ((moveEvent.clientY - startY) / thumbTravel) * maxScroll;
    };
    const stopDragging = () => {
      wallpaperScrollThumb.removeEventListener("pointermove", dragThumb);
      wallpaperScrollThumb.removeEventListener("pointerup", stopDragging);
      wallpaperScrollThumb.removeEventListener("pointercancel", stopDragging);
    };
    wallpaperScrollThumb.addEventListener("pointermove", dragThumb);
    wallpaperScrollThumb.addEventListener("pointerup", stopDragging);
    wallpaperScrollThumb.addEventListener("pointercancel", stopDragging);
  });
  requestAnimationFrame(syncWallpaperScrollbar);
  const selectWallpaper = (item, { focus = false } = {}) => {
    pending = {
      ...pending,
      wallpaper: item.dataset.wallpaper,
      customWallpaper: "",
    };
    sync();
    item.scrollIntoView({ block: "nearest" });
    if (focus) item.focus();
  };
  wallpaperList.addEventListener("click", (event) => {
    const item = event.target.closest("[data-wallpaper]");
    if (!item) return;
    selectWallpaper(item);
  });
  wallpaperList.addEventListener("keydown", (event) => {
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const selectedIndex = wallpaperItems.findIndex(
      (item) => item.dataset.wallpaper === pending.wallpaper,
    );
    const targetIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? wallpaperItems.length - 1
          : Math.max(
              0,
              Math.min(
                wallpaperItems.length - 1,
                selectedIndex + (event.key === "ArrowDown" ? 1 : -1),
              ),
            );
    selectWallpaper(wallpaperItems[targetIndex], { focus: true });
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
  const setPendingResolution = (resolution) => {
    pending = { ...pending, resolution };
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
  };
  controls.resolution.addEventListener("change", () => {
    setPendingResolution(controls.resolution.value);
  });
  controls.resolutionSlider.addEventListener("input", () => {
    setPendingResolution(
      ["800x600", "1024x768", "1440x900", "auto"][
        Number(controls.resolutionSlider.value)
      ],
    );
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
  controls.saverLogin.addEventListener("change", () => {
    pending = {
      ...pending,
      requireLoginOnResume: controls.saverLogin.checked,
    };
    sync();
  });
  controls.fontSize.addEventListener("change", () => {
    pending = { ...pending, fontSize: controls.fontSize.value };
    sync();
  });
  let wallpaperBrowseDialog = null;
  controls.browse.addEventListener("click", () => {
    wallpaperBrowseDialog = openWallpaperBrowseDialog(win, controls.image);
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
    if (!supportedTypes.includes(file.type)) {
      setStatus("Choose a PNG, JPEG, GIF, or WebP image.");
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
      setStatus(`${file.name} will be used after you apply changes.`);
      sync();
      wallpaperBrowseDialog?.setChosenFile(file.name);
      wallpaperBrowseDialog = null;
    });
    reader.readAsDataURL(file);
  });
  controls.clearImage.addEventListener("click", () => {
    pending = { ...pending, customWallpaper: "" };
    controls.image.value = "";
    sync();
  });
  controls.customize.addEventListener("click", () => {
    openDesktopItemsDialog(win);
  });
  content.querySelector(".display-effects").addEventListener("click", () => {
    openDisplayEffectsDialog(win, pending, (next) => {
      pending = next;
      sync();
    });
  });
  content
    .querySelector(".display-advanced-appearance")
    .addEventListener("click", () => {
      openAdvancedAppearanceDialog(win, pending, (next) => {
        pending = next;
        sync();
      });
    });
  content
    .querySelector(".display-monitor-advanced")
    .addEventListener("click", () => openMonitorPropertiesDialog(win));
  content
    .querySelector(".display-theme-save")
    .addEventListener("click", () =>
      openDisplayNotice(
        win,
        "Save Theme",
        "The current theme settings are already saved for this desktop.",
      ),
    );
  controls.saverSettings.addEventListener("click", () =>
    openDisplayNotice(
      win,
      "Screen Saver Settings",
      "This screen saver has no options that you can set.",
    ),
  );
  content
    .querySelector(".display-power-button")
    .addEventListener("click", () =>
      openDisplayNotice(
        win,
        "Power Options Properties",
        "Power management is controlled by your browser and operating system.",
      ),
    );
  content
    .querySelector(".display-troubleshoot")
    .addEventListener("click", () =>
      openDisplayNotice(
        win,
        "Display Troubleshooter",
        "Use the screen resolution slider or restore Use browser size to return to the full desktop.",
      ),
    );
  content
    .querySelector(".display-saver-preview-button")
    .addEventListener("click", () => {
      const saver = document.getElementById("screen-saver-overlay");
      if (!saver || pending.screenSaver === "none") return;
      saver.dataset.saver = pending.screenSaver;
      saver.hidden = false;
      const closePreview = () => {
        saver.hidden = true;
        document.removeEventListener("keydown", closePreview);
        saver.removeEventListener("pointerdown", closePreview);
      };
      document.addEventListener("keydown", closePreview, { once: true });
      saver.addEventListener("pointerdown", closePreview, { once: true });
    });
  content
    .querySelector('[data-display-action="apply"]')
    .addEventListener("click", () => {
      if (!isDisplaySettings(pending)) return;
      if (!saveDisplaySettings(pending)) {
        setStatus("Windows could not save this picture. Try a smaller image.");
        return;
      }
      current = { ...pending };
      applyDisplaySettings(current);
      resolutionPreviewActive = false;
      resolutionPreviewSnapshot = null;
      setStatus();
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
    id: "system-properties",
    title: "System Properties",
    aliases: ["sysdm.cpl", "system properties"],
    run: () => openSystemProperties(),
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
  const startPanel = content.querySelector(".search-start-panel");
  const formPanel = content.querySelector(".search-form-panel");
  const query = content.querySelector("#search-filename");
  const location = content.querySelector("#search-location");
  const type = content.querySelector("#search-type");
  const status = content.querySelector(".search-results-status");
  const list = content.querySelector(".search-results-list");
  const showForm = (kind = "all") => {
    startPanel.hidden = true;
    formPanel.hidden = false;
    type.value = ["media", "documents"].includes(kind) ? "files" : "all";
    query.focus();
  };
  content.querySelectorAll("[data-search-kind]").forEach((button) => {
    button.addEventListener("click", () => showForm(button.dataset.searchKind));
  });
  content
    .querySelector('[data-search-action="back"]')
    .addEventListener("click", () => {
      formPanel.hidden = true;
      startPanel.hidden = false;
    });
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

const confirmEmptyRecycleBin = () => {
  const count = fs.getChildren(fs.RECYCLE_BIN).length;
  if (!count) return Promise.resolve(false);
  const single = count === 1;
  return XPDialogs.confirm(
    single
      ? "Are you sure you want to delete this item?"
      : `Are you sure you want to delete these ${count} items?`,
    single ? "Confirm File Delete" : "Confirm Multiple File Delete",
    "warning",
  ).then((yes) => {
    if (!yes) return false;
    fileOps.emptyRecycleBin();
    return true;
  });
};

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
  element.dataset.dropDestinationId = destinationId;
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
    image.src = XP_ICON_PATHS[icon];
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
      "ExplorerProperties.png",
      openProjectSettings,
    );
    addTask(
      "Add or remove programs",
      "AddRemovePrograms.png",
      openControlPanel,
    );
    addTask("Change a setting", "ControlPanel.png", openControlPanel);
    return;
  }

  if (isPictures) {
    addTask("View as a slide show", "MyPictures.png", null, true);
    addTask("Order prints online", "MyPictures.png", null, true);
    addTask("Print pictures", "PrintersAndFaxes.png", null, true);
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
  addTask("Publish this folder to the Web", "PublishToWeb.png", null, true);
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
    image.src = XP_ICON_PATHS[fileName];
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
  if (node.app && systemShortcuts[node.app]) {
    const shortcut = createGameIconElement(node.app, "explorer-item-icon");
    shortcut.classList.remove("system-icon");
    return shortcut;
  }
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
      folder.id === fs.RECYCLE_BIN
        ? getRecycleBinIconPath()
        : folder.id === fs.MY_COMPUTER
          ? "assets/xp/icons/MyComputer.png"
          : folder.id === fs.MY_MUSIC
            ? "assets/xp/icons/MyMusic.png"
            : folder.id === fs.MY_PICTURES
              ? "assets/xp/icons/MyPictures.png"
              : "assets/xp/icons/MyDocuments.png";
    image.alt = "";
    titleIcon.appendChild(image);
  }
  renderExplorerTree(win);
  renderExplorerTaskPane(win);

  const explorerContent = main.closest(".explorer-content");
  const chrome = explorerContent?.querySelector(".explorer-chrome");
  if (chrome) {
    chrome.querySelector("input").value = fs.getPath(folder.id);
    const addressIcon = chrome.querySelector(".explorer-address-field img");
    if (addressIcon) {
      addressIcon.src =
        folder.id === fs.RECYCLE_BIN
          ? getRecycleBinIconPath()
          : folder.id === fs.MY_COMPUTER
            ? XP_ICON_PATHS["MyComputer.png"]
            : folder.id === fs.MY_MUSIC
              ? XP_ICON_PATHS["MyMusic.png"]
              : folder.id === fs.MY_PICTURES
                ? XP_ICON_PATHS["MyPictures.png"]
                : XP_ICON_PATHS["MyDocuments.png"];
    }
    chrome.querySelector('[data-explorer-action="back"]').disabled =
      (win.historyIndex ?? 0) <= 0;
    chrome.querySelector('[data-explorer-action="forward"]').disabled =
      (win.historyIndex ?? -1) >= (win.history?.length ?? 0) - 1;
    chrome.querySelector('[data-explorer-action="up"]').disabled =
      !folder.parent &&
      ![fs.MY_COMPUTER, fs.RECYCLE_BIN].includes(win.currentFolderId);
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
      : [fs.DRIVE_D, fs.DRIVE_F].includes(node.id)
        ? "Devices with Removable Storage"
        : "Hard Disk Drives";
  const myComputerGroupOrder = [
    "Files Stored on This Computer",
    "Hard Disk Drives",
    "Devices with Removable Storage",
  ];
  const myComputerOrder = [
    fs.MY_MUSIC,
    fs.MY_PICTURES,
    fs.DRIVE_C,
    fs.DRIVE_F,
    fs.DRIVE_D,
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
          myComputerOrder.indexOf(a.id) - myComputerOrder.indexOf(b.id)
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
    const myComputerNames = {
      [fs.MY_MUSIC]: "Shared Documents",
      [fs.MY_PICTURES]: "Administrator's Documents",
      [fs.DRIVE_F]: "3½ Floppy (A:)",
      [fs.DRIVE_D]: "GRTMPVOL_EN (D:)",
    };
    name.textContent =
      folder.id === fs.MY_COMPUTER
        ? myComputerNames[node.id] || node.name
        : node.name;
    const description = document.createElement("small");
    description.textContent = explorerItemDescription(node);
    label.appendChild(name);
    if (folder.id !== fs.MY_COMPUTER) label.appendChild(description);

    const itemIcon = createExplorerIcon(node);
    if (
      folder.id === fs.MY_COMPUTER &&
      [fs.MY_MUSIC, fs.MY_PICTURES].includes(node.id)
    ) {
      itemIcon.querySelector("img").src = XP_ICON_PATHS["NewFolder.png"];
    } else if (folder.id === fs.MY_COMPUTER && node.id === fs.DRIVE_D) {
      itemIcon.querySelector("img").src = XP_ICON_PATHS["OpticalDrive.png"];
    }
    item.append(itemIcon, label);
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
  if (message?.event === "astro.game-data-retention") {
    const win = openWindows.get(message.gameId);
    if (win && event.source === win.player?.contentWindow) {
      win.removeGameDataOnClose =
        message.keep === false
          ? {
              storageId: message.storageId || message.gameId,
              fileName: message.fileName,
            }
          : false;
    }
    return;
  }
  if (message?.event !== "astro.offline-game-ready") {
    return;
  }
  const offlineGameIds = new Set([
    "revcdos",
    "pink-panther-passport-to-peril",
    "pink-panther-hokus-pokus",
  ]);
  if (!offlineGameIds.has(message.gameId)) return;
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
fs.registerFileType("app:__recycle-bin", () =>
  openSystemWindow("__recycle-bin"),
);

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
  const windowWidth = Math.min(768, desktopWidth - 16);
  const windowHeight = Math.min(530, desktopHeight - 16);
  el.style.width = `${windowWidth}px`;
  el.style.height = `${windowHeight}px`;
  el.style.left = `${Math.min(44, Math.max(8, desktopWidth - windowWidth))}px`;
  el.style.top = `${Math.min(58, Math.max(8, desktopHeight - windowHeight))}px`;

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
  status.hidden = true;
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
    ["&View", [["&Status Bar", "status-bar", ""]]],
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
  renderTaskButtons();
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
  const isDisplayProperties = shortcutId === "__display-properties";
  const isControlPanel = shortcutId === "__control-panel";
  const isSearch = shortcutId === "__search";
  const isPrinters = shortcutId === "__printers";
  const isHelp = shortcutId === "__help";
  if (isDisplayProperties) el.classList.add("display-properties-window");
  const windowWidth = Math.min(
    isProjectSettings
      ? 540
      : isInternetGames
        ? 760
        : isControlPanel
          ? 800
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
    const items = [...menu.children]
      .map((child) =>
        child.matches("button")
          ? child
          : child.matches(".context-parent")
            ? child.firstElementChild
            : null,
      )
      .filter((item) => item?.matches("button:not(:disabled)"));
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
    const taskTitle = win.title || formatGameTitle(gameId);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "task-button" +
      (gameId === focusedGameId && !win.minimized ? " active" : "") +
      (win.needsAttention ? " needs-attention" : "");
    btn.dataset.game = gameId;
    btn.title = taskTitle;
    btn.setAttribute(
      "aria-label",
      `${taskTitle}${win.minimized ? ", minimized" : ""}${win.needsAttention ? ", needs attention" : ""}`,
    );
    btn.setAttribute(
      "aria-pressed",
      String(gameId === focusedGameId && !win.minimized),
    );

    const icon = createGameIconElement(gameId, "task-icon");
    const taskImage = icon.querySelector("img");
    if (taskImage && win.icon) taskImage.src = win.icon;

    const label = document.createElement("span");
    label.className = "task-label";
    label.textContent = taskTitle;

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
  dialog.el.classList.add("taskbar-properties-dialog");
  const help = document.createElement("button");
  help.type = "button";
  help.className = "tb-btn help-btn";
  help.title = "Help";
  help.setAttribute("aria-label", "Help");
  help.addEventListener("click", openHelpAndSupport);
  dialog.el.querySelector(".title-buttons").prepend(help);
  dialog.body.innerHTML = `
    <div class="taskbar-properties-tabs" role="tablist">
      <button type="button" role="tab" data-taskbar-properties-tab="taskbar" aria-selected="true">Taskbar</button>
      <button type="button" role="tab" data-taskbar-properties-tab="start-menu">Start Menu</button>
    </div>
    <div class="taskbar-properties-panel" data-taskbar-properties-panel="taskbar">
      <div class="taskbar-properties-group taskbar-appearance-group"><span class="taskbar-properties-legend">Taskbar appearance</span>
        <img class="taskbar-properties-preview" src="assets/xp/system/TaskbarPreview.png" alt="Taskbar preview">
        <label><input type="checkbox" data-taskbar-setting="locked" ${taskbarLocked ? "checked" : ""}> Lock the taskbar</label>
        <label><input type="checkbox" data-taskbar-setting="auto-hide"> Auto-hide the taskbar</label>
        <label><input type="checkbox" data-taskbar-setting="keep-on-top" checked> Keep the taskbar on top of other windows</label>
        <label><input type="checkbox" data-taskbar-setting="group" checked> Group similar taskbar buttons</label>
        <label><input type="checkbox" data-taskbar-setting="quick-launch"> Show Quick Launch</label>
      </div>
      <div class="taskbar-properties-group notification-area-group"><span class="taskbar-properties-legend">Notification area</span>
        <img class="taskbar-properties-preview" src="assets/xp/system/NotificationAreaPreview.png" alt="Notification area preview">
        <label><input type="checkbox" data-taskbar-setting="show-clock" checked> Show the clock</label>
        <p>You can keep the notification area uncluttered by hiding icons that you<br>have not clicked recently.</p>
        <label><input type="checkbox" data-taskbar-setting="hide-inactive" checked> Hide inactive icons</label>
        <button type="button" class="xp-btn">Customize...</button>
      </div>
    </div>
    <div class="taskbar-properties-panel taskbar-start-menu-panel" data-taskbar-properties-panel="start-menu" hidden>
      <img class="taskbar-start-menu-preview" src="assets/xp/system/StartMenuPreview.png" alt="Start menu preview">
      <label class="taskbar-start-menu-choice"><input type="radio" name="taskbar-start-menu-style" value="start" checked> Start menu</label>
      <p class="taskbar-start-menu-description">Select this menu style for easy access to the<br>Internet, e-mail, and your favorite programs.</p>
      <button type="button" class="xp-btn taskbar-start-customize">Customize...</button>
      <label class="taskbar-classic-menu-choice"><input type="radio" name="taskbar-start-menu-style" value="classic"> Classic Start menu</label>
      <p class="taskbar-classic-menu-description">Select this option to use the menu style from<br>earlier versions of Windows.</p>
      <button type="button" class="xp-btn taskbar-classic-customize" disabled>Customize...</button>
    </div>
    <div class="dlg-buttons taskbar-properties-buttons"></div>
  `;
  const tabs = [
    ...dialog.body.querySelectorAll("[data-taskbar-properties-tab]"),
  ];
  const panels = [
    ...dialog.body.querySelectorAll("[data-taskbar-properties-panel]"),
  ];
  tabs.forEach((tab) =>
    tab.addEventListener("click", () => {
      tabs.forEach((entry) =>
        entry.setAttribute(
          "aria-selected",
          String(
            entry.dataset.taskbarPropertiesTab ===
              tab.dataset.taskbarPropertiesTab,
          ),
        ),
      );
      panels.forEach((panel) => {
        panel.hidden =
          panel.dataset.taskbarPropertiesPanel !==
          tab.dataset.taskbarPropertiesTab;
      });
    }),
  );
  const buttonRow = dialog.body.querySelector(".taskbar-properties-buttons");
  const apply = XPDialogs.createDialogButton(
    { id: "apply", label: "Apply" },
    () => {
      setTaskbarLocked(
        dialog.body.querySelector('[data-taskbar-setting="locked"]').checked,
      );
      document.getElementById("taskbar-clock").hidden =
        !dialog.body.querySelector('[data-taskbar-setting="show-clock"]')
          .checked;
      apply.disabled = true;
    },
  );
  apply.disabled = true;
  const ok = XPDialogs.createDialogButton(
    { id: "ok", label: "OK", isDefault: true },
    () => {
      apply.click();
      dialog.close("ok");
    },
  );
  const cancel = XPDialogs.createDialogButton(
    { id: "cancel", label: "Cancel", isCancel: true },
    () => dialog.close("cancel"),
  );
  dialog.defaultButton = ok;
  buttonRow.append(ok, cancel, apply);
  dialog.body.addEventListener("change", (event) => {
    apply.disabled = false;
    if (event.target.name === "taskbar-start-menu-style") {
      const classic = event.target.value === "classic";
      dialog.body.querySelector(".taskbar-start-customize").disabled = classic;
      dialog.body.querySelector(".taskbar-classic-customize").disabled =
        !classic;
    }
  });
  dialog.body
    .querySelector(".notification-area-group .xp-btn")
    .addEventListener("click", () =>
      XPDialogs.alert(
        "Select which notification icons should be hidden when inactive.",
        "Customize Notifications",
        "info",
      ),
    );
  ok.focus();
};

let taskbarLocked = true;

const setTaskbarLocked = (locked) => {
  taskbarLocked = locked;
  const button = document.querySelector('[data-taskbar-action="lock"]');
  button.setAttribute("aria-checked", String(locked));
  button.querySelector(".context-check").textContent = locked ? "✓" : "";
};

const setupTaskbarContextMenu = () => {
  const taskbar = document.getElementById("taskbar");
  const menu = document.getElementById("taskbar-context-menu");
  const toolbarParent = document.getElementById("taskbar-toolbar-parent");
  const toolbarButton = toolbarParent.firstElementChild;
  const toolbarSubmenu = document.getElementById("taskbar-toolbar-submenu");
  wireTaskbarMenuKeyboard(menu);
  wireTaskbarMenuKeyboard(toolbarSubmenu);
  wireTaskbarMenuKeyboard(document.getElementById("taskbar-overflow-menu"));
  const openToolbarSubmenu = () => {
    toolbarParent.classList.add("open");
    toolbarButton.setAttribute("aria-expanded", "true");
    toolbarSubmenu.style.left = "calc(100% - 2px)";
    if (toolbarSubmenu.getBoundingClientRect().right > innerWidth)
      toolbarSubmenu.style.left = `${-toolbarSubmenu.offsetWidth + 5}px`;
  };
  const closeToolbarSubmenu = () => {
    toolbarParent.classList.remove("open");
    toolbarButton.setAttribute("aria-expanded", "false");
  };
  toolbarParent.addEventListener("pointerenter", openToolbarSubmenu);
  toolbarParent.addEventListener("pointerleave", closeToolbarSubmenu);
  toolbarButton.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight") return;
    event.preventDefault();
    event.stopPropagation();
    openToolbarSubmenu();
    toolbarSubmenu.querySelector("button")?.focus();
  });
  toolbarSubmenu.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft") return;
    event.preventDefault();
    event.stopPropagation();
    closeToolbarSubmenu();
    toolbarButton.focus();
  });
  toolbarSubmenu.addEventListener("click", closeTaskbarMenus);
  taskbar.addEventListener("contextmenu", (event) => {
    if (event.target.closest(".task-button, #tray-volume-popup")) return;
    event.preventDefault();
    closeWindowSystemMenu();
    closeTaskbarMenus();
    closeToolbarSubmenu();
    const canArrange = [...openWindows.values()].some((win) => !win.minimized);
    ["cascade", "tile-horizontal", "tile-vertical"].forEach((action) => {
      menu.querySelector(`[data-taskbar-action="${action}"]`).disabled =
        !canArrange;
    });
    positionTaskbarMenu(menu, event.clientX, event.clientY);
  });
  menu.addEventListener("click", (event) => {
    const action = event.target.closest("[data-taskbar-action]")?.dataset
      .taskbarAction;
    if (!action || event.target.closest("button")?.disabled) return;
    if (action === "toolbars") {
      openToolbarSubmenu();
      return;
    }
    closeTaskbarMenus();
    if (action === "show-desktop") toggleShowDesktop();
    else if (action === "cascade" || action.startsWith("tile-"))
      arrangeTaskbarWindows(action);
    else if (action === "task-manager") openTaskManager();
    else if (action === "lock") setTaskbarLocked(!taskbarLocked);
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
      <button type="button" role="tab" id="project-tab-game-data" aria-controls="project-panel-game-data" aria-selected="false" tabindex="-1">Game Data</button>
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
    <section class="project-settings-panel" id="project-panel-game-data" role="tabpanel" aria-labelledby="project-tab-game-data" hidden>
      <fieldset>
        <legend>Installed game data</legend>
        <p class="project-settings-description">Remove games installed from Internet Games, reVCDOS game data, or saved Pink Panther CD images. Saved games are preserved.</p>
        <div class="project-game-data-list" data-project-game-data aria-live="polite"></div>
        <p class="project-settings-status" data-project-status="game-data" aria-live="polite"></p>
      </fieldset>
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
  const gameDataList = content.querySelector("[data-project-game-data]");
  const gameDataStatus = content.querySelector(
    '[data-project-status="game-data"]',
  );
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
    if (panelId === "project-panel-game-data") void renderGameData();
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
  let gameDataRefresh = 0;
  const renderGameData = async () => {
    const refresh = ++gameDataRefresh;
    gameDataStatus.textContent = "Checking installed game data...";
    try {
      const [internetGames, externalGames] = await Promise.all([
        gameLibrary?.getInstallations?.() || [],
        gameDataManager.list(),
      ]);
      if (refresh !== gameDataRefresh) return;
      const items = [
        ...internetGames.map((item) => ({
          ...item,
          detail: "Internet Game",
          removeId: item.id,
          owner: "internet",
        })),
        ...externalGames.map((item) => ({
          ...item,
          removeId: item.id,
          owner: "external",
        })),
      ];
      gameDataList.replaceChildren();
      if (!items.length) {
        const empty = document.createElement("p");
        empty.className = "project-settings-description";
        empty.textContent = "No downloaded or stored game data was found.";
        gameDataList.appendChild(empty);
      }
      items.forEach((item) => {
        const row = document.createElement("div");
        row.className = "project-game-data";
        const text = document.createElement("span");
        const title = document.createElement("strong");
        title.textContent = item.title;
        const detail = document.createElement("small");
        detail.textContent = `${item.detail} · ${formatProjectBytes(item.bytes)}`;
        text.append(title, detail);
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "xp-btn";
        remove.textContent = "Remove";
        remove.dataset.gameDataId = item.removeId;
        remove.dataset.gameDataOwner = item.owner;
        remove.dataset.gameDataTitle = item.title;
        row.append(text, remove);
        gameDataList.appendChild(row);
      });
      gameDataStatus.textContent = items.length
        ? `${items.length} stored game ${items.length === 1 ? "item" : "items"} found.`
        : "";
    } catch (error) {
      if (refresh !== gameDataRefresh) return;
      gameDataStatus.textContent = error.message;
    }
  };

  gameDataList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-game-data-id]");
    if (!button) return;
    const accepted = await XPDialogs.confirm(
      `Remove ${button.dataset.gameDataTitle} from browser storage?\n\nSaved games will be preserved.`,
      "Remove Game Data",
      "question",
    );
    if (!accepted) return;
    button.disabled = true;
    gameDataStatus.textContent = "Removing game data...";
    try {
      if (button.dataset.gameDataOwner === "internet") {
        await gameLibrary.uninstall(button.dataset.gameDataId);
      } else {
        await gameDataManager.remove(button.dataset.gameDataId);
      }
      await offlineManager.refreshStorageEstimate();
      await renderGameData();
    } catch (error) {
      button.disabled = false;
      gameDataStatus.textContent = error.message;
    }
  });

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
    void renderGameData();
  });
  const refreshStoredGameData = (event) => {
    if (
      event.type === "storage" ||
      (event.origin === window.location.origin &&
        event.data?.event === "astro.game-data-changed")
    ) {
      void renderGameData();
    }
  };
  window.addEventListener("storage", refreshStoredGameData);
  window.addEventListener("message", refreshStoredGameData);
  win.beforeClose = () => {
    unsubscribe();
    unsubscribeGames?.();
    window.removeEventListener("storage", refreshStoredGameData);
    window.removeEventListener("message", refreshStoredGameData);
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
  dialog.el.classList.add("datetime-dialog");

  const titleButtons = dialog.el.querySelector(".title-buttons");
  const helpButton = document.createElement("button");
  helpButton.type = "button";
  helpButton.className = "tb-btn help-btn";
  helpButton.title = "Help";
  helpButton.setAttribute("aria-label", "Help");
  titleButtons.prepend(helpButton);

  const shellNow = getShellTime();
  const state = {
    year: shellNow.getFullYear(),
    month: shellNow.getMonth(),
    day: shellNow.getDate(),
  };

  const tabs = document.createElement("div");
  tabs.className = "datetime-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Date and Time Properties");
  const panelHost = document.createElement("div");
  panelHost.className = "datetime-panel-host";

  // ---- Date group ----
  const dateGroup = document.createElement("fieldset");
  dateGroup.className = "dlg-group datetime-date-group";
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
  timeGroup.className = "dlg-group datetime-time-group";
  const timeLegend = document.createElement("legend");
  timeLegend.textContent = "Time";
  timeGroup.appendChild(timeLegend);

  const analogClock = document.createElement("div");
  analogClock.className = "datetime-analog-clock";
  analogClock.setAttribute("aria-hidden", "true");
  for (let tick = 0; tick < 60; tick += 1) {
    const mark = document.createElement("i");
    mark.className = tick % 5 === 0 ? "hour-tick" : "minute-tick";
    mark.style.setProperty("--tick", tick);
    analogClock.appendChild(mark);
  }
  const hourHand = document.createElement("span");
  hourHand.className = "datetime-clock-hand hour";
  const minuteHand = document.createElement("span");
  minuteHand.className = "datetime-clock-hand minute";
  const secondHand = document.createElement("span");
  secondHand.className = "datetime-clock-hand second";
  const clockPin = document.createElement("span");
  clockPin.className = "datetime-clock-pin";
  analogClock.append(hourHand, minuteHand, secondHand, clockPin);

  const timeEdit = document.createElement("div");
  timeEdit.className = "datetime-time-edit";
  const timeInput = document.createElement("input");
  timeInput.type = "text";
  timeInput.className = "xp-input";
  timeInput.setAttribute("aria-label", "Time");
  const spinner = document.createElement("span");
  spinner.className = "datetime-spinner";
  spinner.innerHTML =
    '<button type="button" aria-label="Increase time">▲</button><button type="button" aria-label="Decrease time">▼</button>';
  timeEdit.append(timeInput, spinner);
  timeGroup.append(analogClock, timeEdit);

  const datePanel = document.createElement("section");
  datePanel.className = "datetime-panel datetime-date-panel";
  datePanel.setAttribute("role", "tabpanel");
  datePanel.append(dateGroup, timeGroup);
  const timeZoneText = document.createElement("p");
  timeZoneText.className = "datetime-current-zone";
  timeZoneText.textContent = "Current time zone:  SA Eastern Standard Time";
  datePanel.appendChild(timeZoneText);

  const timeZonePanel = document.createElement("section");
  timeZonePanel.className = "datetime-panel datetime-time-zone-panel";
  timeZonePanel.setAttribute("role", "tabpanel");
  timeZonePanel.hidden = true;
  const timeZoneSelect = document.createElement("select");
  timeZoneSelect.className = "xp-select datetime-zone-select";
  timeZoneSelect.setAttribute("aria-label", "Time zone");
  const timeZoneOption = document.createElement("option");
  timeZoneOption.textContent = "(GMT-03:00) Buenos Aires, Georgetown";
  timeZoneSelect.appendChild(timeZoneOption);
  const timeZoneMap = document.createElement("img");
  timeZoneMap.className = "datetime-zone-map";
  timeZoneMap.src = "assets/xp/TimeZoneMap.png";
  timeZoneMap.alt = "World time zone map";
  timeZoneMap.draggable = false;
  timeZonePanel.append(timeZoneSelect, timeZoneMap);

  const internetPanel = document.createElement("section");
  internetPanel.className = "datetime-panel datetime-internet-panel";
  internetPanel.setAttribute("role", "tabpanel");
  internetPanel.hidden = true;
  const syncLabel = document.createElement("label");
  syncLabel.className = "datetime-sync-label";
  const syncCheckbox = document.createElement("input");
  syncCheckbox.type = "checkbox";
  syncCheckbox.checked = true;
  syncLabel.append(
    syncCheckbox,
    "Automatically synchronize with an Internet time server",
  );
  const serverRow = document.createElement("div");
  serverRow.className = "datetime-server-row";
  const serverLabel = document.createElement("label");
  serverLabel.textContent = "Server:";
  const serverSelect = document.createElement("select");
  serverSelect.className = "xp-select";
  serverSelect.innerHTML =
    "<option>time.windows.com</option><option>time.nist.gov</option>";
  const updateNow = document.createElement("button");
  updateNow.type = "button";
  updateNow.className = "xp-btn";
  updateNow.textContent = "Update Now";
  serverRow.append(serverLabel, serverSelect, updateNow);
  const syncStatus = document.createElement("p");
  syncStatus.className = "datetime-sync-status";
  syncStatus.textContent =
    "Windows has never attempted to synchronize with an Internet time server.";
  const nextSync = document.createElement("p");
  nextSync.className = "datetime-next-sync";
  nextSync.textContent = `Next synchronization: ${shellNow.toLocaleDateString("en-US")} at ${shellNow.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  const syncNote = document.createElement("p");
  syncNote.className = "datetime-sync-note";
  syncNote.innerHTML =
    "Synchronization can occur only when your computer is connected to the Internet. Learn more about <u>time synchronization</u> in Help and Support Center.";
  internetPanel.append(syncLabel, serverRow, syncStatus, nextSync, syncNote);

  const panels = [datePanel, timeZonePanel, internetPanel];
  const tabDefinitions = [
    ["Date & Time", datePanel],
    ["Time Zone", timeZonePanel],
    ["Internet Time", internetPanel],
  ];
  tabDefinitions.forEach(([label, panel], index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(index === 0));
    tab.classList.toggle("active", index === 0);
    tab.textContent = label;
    tab.addEventListener("click", () => {
      panels.forEach((candidate) => {
        candidate.hidden = candidate !== panel;
      });
      [...tabs.children].forEach((candidate) => {
        const selected = candidate === tab;
        candidate.classList.toggle("active", selected);
        candidate.setAttribute("aria-selected", String(selected));
      });
    });
    tabs.appendChild(tab);
  });
  panelHost.append(...panels);
  dialog.body.append(tabs, panelHost);

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

  const formatTime = (date) =>
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  const renderAnalogClock = (date) => {
    const seconds = date.getSeconds();
    const minutes = date.getMinutes() + seconds / 60;
    const hours = (date.getHours() % 12) + minutes / 60;
    hourHand.style.setProperty("--angle", `${hours * 30}deg`);
    minuteHand.style.setProperty("--angle", `${minutes * 6}deg`);
    secondHand.style.setProperty("--angle", `${seconds * 6}deg`);
  };
  timeInput.value = formatTime(shellNow);
  renderAnalogClock(shellNow);

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

  const applyDateTime = () => {
    const match = /^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i.exec(
      timeInput.value.trim(),
    );
    let hours = match ? Math.min(Math.max(parseInt(match[1], 10), 1), 12) : 12;
    const minutes = match ? Math.min(parseInt(match[2], 10), 59) : 0;
    const seconds = match ? Math.min(parseInt(match[3], 10), 59) : 0;
    hours %= 12;
    if (match?.[4].toUpperCase() === "PM") hours += 12;
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
    renderAnalogClock(chosen);
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
    () => {
      applyDateTime();
      applyButton.disabled = true;
    },
  );
  applyButton.disabled = true;
  row.append(okButton, cancelButton, applyButton);
  dialog.body.appendChild(row);
  dialog.defaultButton = okButton;

  const markDirty = () => {
    applyButton.disabled = false;
  };
  [
    monthSelect,
    yearInput,
    timeInput,
    timeZoneSelect,
    syncCheckbox,
    serverSelect,
  ].forEach((control) => control.addEventListener("change", markDirty));
  calendar.addEventListener("click", markDirty);
  spinner.querySelectorAll("button").forEach((button, index) => {
    button.addEventListener("click", () => {
      const value = new Date(2000, 0, 1);
      const match = /^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i.exec(
        timeInput.value.trim(),
      );
      if (match) {
        let hours = parseInt(match[1], 10) % 12;
        if (match[4].toUpperCase() === "PM") hours += 12;
        value.setHours(hours, parseInt(match[2], 10), parseInt(match[3], 10));
      }
      value.setSeconds(value.getSeconds() + (index === 0 ? 1 : -1));
      timeInput.value = formatTime(value);
      renderAnalogClock(value);
      markDirty();
    });
  });
  syncCheckbox.addEventListener("change", () => {
    serverSelect.disabled = !syncCheckbox.checked;
    updateNow.disabled = !syncCheckbox.checked;
  });
  updateNow.addEventListener("click", () => {
    syncStatus.textContent =
      "An error occurred while Windows was synchronizing with time.windows.com.";
  });
  helpButton.addEventListener("click", () => {
    XPDialogs.alert(
      "Select a tab to change the date, time, time zone, or Internet time settings.",
      "Date and Time Help",
      "info",
    );
  });

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

const findDesktopDropTarget = (clientX, clientY, draggedIds) => {
  for (const element of document.elementsFromPoint(clientX, clientY)) {
    const target = element.closest?.(
      "[data-drop-action], [data-drop-destination-id]",
    );
    if (!target) continue;
    if (target.dataset.dropAction === "recycle") {
      return { action: "recycle", element: target };
    }
    const destinationId = target.dataset.dropDestinationId;
    if (
      destinationId === fs.DESKTOP ||
      draggedIds.has(destinationId) ||
      fs.getNode(destinationId)?.type !== "folder"
    ) {
      continue;
    }
    return { action: "move", element: target, destinationId };
  }
  return null;
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
    const eligibility = getDesktopSelectionEligibility();
    const draggedIds = new Set(eligibility.filesystemIds);
    let dropTarget = null;
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

      dropTarget?.element.classList.remove("drop-target");
      dropTarget = eligibility.movable
        ? findDesktopDropTarget(
            moveEvent.clientX,
            moveEvent.clientY,
            draggedIds,
          )
        : null;
      dropTarget?.element.classList.add("drop-target");
    };

    const onUp = async (upEvent) => {
      icon.removeEventListener("pointermove", onMove);
      icon.removeEventListener("pointerup", onUp);
      icon.removeEventListener("pointercancel", onUp);
      dropTarget?.element.classList.remove("drop-target");
      dropTarget =
        eligibility.movable && upEvent.type === "pointerup"
          ? findDesktopDropTarget(upEvent.clientX, upEvent.clientY, draggedIds)
          : null;
      if (desktopDragged) {
        if (dropTarget) {
          if (dropTarget.action === "recycle") {
            fileOps.removeToBin(eligibility.filesystemIds);
          } else {
            fileOps.cut(eligibility.filesystemIds);
            await pasteIntoFolder(dropTarget.destinationId);
          }
        } else {
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

    container.focus({ preventScroll: true });
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
  container.hidden = getDesktopLayoutSettings().showIcons === false;
  container.replaceChildren();
  // System places stay available even though regular desktop files are
  // rendered directly from VirtualFS.DESKTOP.
  const desktopItems = [
    "__my-computer",
    "__my-documents",
    "__internet-games",
    "__astro-settings",
  ].filter(
    (id) =>
      systemShortcuts[id]?.desktop !== false &&
      getDesktopSystemIcons()[id] !== false,
  );
  const recycleBinItems = ["__recycle-bin"].filter(
    (id) => systemShortcuts[id]?.desktop !== false,
  );
  const desktopSort = getDesktopLayoutSettings().sort;
  const desktopNodeSortName = (node) =>
    node.ext === ".game" ? node.name.slice(0, -node.ext.length) : node.name;
  const compareDesktopNodeNames = (a, b) =>
    desktopNodeSortName(a).localeCompare(desktopNodeSortName(b), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  const compareDesktopNodes = (a, b) => {
    if (desktopSort === "size")
      return a.size - b.size || compareDesktopNodeNames(a, b);
    if (desktopSort === "type")
      return (
        (a.ext || a.type).localeCompare(b.ext || b.type) ||
        compareDesktopNodeNames(a, b)
      );
    if (desktopSort === "modified")
      return b.modified - a.modified || compareDesktopNodeNames(a, b);
    return compareDesktopNodeNames(a, b);
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
    if (node?.type === "folder") icon.dataset.dropDestinationId = node.id;
    if (id === "__recycle-bin") icon.dataset.dropAction = "recycle";

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
    showIcons: true,
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
  function finish(save) {
    if (finished) return;
    finished = true;
    document.removeEventListener("pointerdown", onOutsidePointerDown, true);
    if (save) {
      try {
        fileOps.rename(id, input.value);
      } catch (error) {
        console.error(error);
      }
    }
    refreshDesktop();
  }
  function onOutsidePointerDown(event) {
    if (!input.contains(event.target)) finish(true);
  }
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      finish(event.key === "Enter");
    }
  });
  input.addEventListener("blur", () => finish(true), { once: true });
  document.addEventListener("pointerdown", onOutsidePointerDown, true);
};

const addDesktopMenuItem = (
  menu,
  label,
  action,
  { disabled = false, checked = false, defaultItem = false } = {},
) => {
  const button = document.createElement("button");
  button.type = "button";
  button.role = "menuitem";
  button.dataset.action = action;
  button.disabled = disabled;
  button.classList.toggle("context-default", defaultItem);
  button.setAttribute("role", checked ? "menuitemcheckbox" : "menuitem");
  if (checked) button.setAttribute("aria-checked", "true");
  const gutter = document.createElement("span");
  gutter.className = "context-check";
  gutter.textContent = checked ? "✓" : "";
  const text = document.createElement("span");
  text.className = "context-label";
  text.textContent = label;
  button.append(gutter, text);
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
  const gutter = document.createElement("span");
  gutter.className = "context-check";
  const text = document.createElement("span");
  text.className = "context-label";
  text.textContent = label;
  button.append(gutter, text);
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

  if (itemId === "__recycle-bin") {
    addDesktopMenuItem(menu, "Open", "open", { defaultItem: true });
    addDesktopMenuItem(menu, "Explore", "explore");
    addDesktopMenuItem(menu, "Empty Recycle Bin", "empty-recycle-bin", {
      disabled: !fs.getChildren(fs.RECYCLE_BIN).length,
    });
    addDesktopSeparator(menu);
    addDesktopMenuItem(menu, "Create Shortcut", "create-recycle-shortcut");
    addDesktopSeparator(menu);
    addDesktopMenuItem(menu, "Properties", "recycle-properties");
  } else if (itemId) {
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
      addDesktopSeparator(submenu);
      addDesktopMenuItem(submenu, "Auto Arrange", "auto-arrange", {
        checked: settings.autoArrange,
      });
      addDesktopMenuItem(submenu, "Align to Grid", "align-grid", {
        checked: settings.alignToGrid,
      });
      addDesktopSeparator(submenu);
      addDesktopMenuItem(submenu, "Show Desktop Icons", "show-icons", {
        checked: settings.showIcons !== false,
      });
    });
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
      addDesktopMenuItem(submenu, "Bitmap Image", "new-bitmap");
      addDesktopSeparator(submenu);
      addDesktopMenuItem(submenu, "Upload from Computer...", "upload");
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
    } else if (action === "show-icons") {
      const settings = getDesktopLayoutSettings();
      const showIcons = settings.showIcons === false;
      saveDesktopLayoutSettings({ ...settings, showIcons });
      document.getElementById("desktop-icons").hidden = !showIcons;
    } else if (action === "refresh") {
      refreshDesktop();
    } else if (
      action === "new-folder" ||
      action === "new-text" ||
      action === "new-bitmap"
    ) {
      const node =
        action === "new-folder"
          ? fileOps.createFolder(fs.DESKTOP, "New Folder")
          : fileOps.createFile(
              fs.DESKTOP,
              action === "new-bitmap"
                ? "New Bitmap Image.bmp"
                : "New Text Document.txt",
            );
      refreshDesktop();
      selectDesktopIcon(node.id);
      beginDesktopRename(node.id);
    } else if (action === "upload") {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.addEventListener(
        "change",
        async () => {
          for (const file of input.files) {
            fileOps.createFile(fs.DESKTOP, file.name, {
              content: file.type.startsWith("text/") ? await file.text() : "",
              size: file.size,
            });
          }
          refreshDesktop();
        },
        { once: true },
      );
      input.click();
    } else if (action === "paste") {
      pasteIntoFolder(fs.DESKTOP);
    } else if (action === "open" && itemId) {
      openDesktopItem(itemId);
    } else if (action === "explore" && itemId === "__recycle-bin") {
      openDesktopItem(itemId);
    } else if (action === "empty-recycle-bin") {
      confirmEmptyRecycleBin();
    } else if (action === "create-recycle-shortcut") {
      const shortcut = fileOps.createFile(
        fs.DESKTOP,
        "Shortcut to Recycle Bin.game",
        { app: "__recycle-bin" },
      );
      selectDesktopIcon(shortcut.id);
    } else if (action === "recycle-properties") {
      openShellProperties(fs.RECYCLE_BIN);
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
      openShellProperties(selectedFsIds[0]);
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

const openControlPanel = () => openSystemWindow("__control-panel");

const openPrintersAndFaxes = () => openSystemWindow("__printers");

const wirePrintersAndFaxes = (win) => {
  const content = win.el.querySelector(".printers-content");
  const menu = content.querySelector(".printers-menu");
  const closeMenu = () => {
    menu.hidden = true;
    content
      .querySelectorAll("[data-printers-menu]")
      .forEach((button) => button.setAttribute("aria-expanded", "false"));
  };
  const showMenu = (button) => {
    const labels =
      button.dataset.printersMenu === "file"
        ? [["Close", "close"]]
        : button.dataset.printersMenu === "help"
          ? [
              ["Help and Support", "help"],
              ["About Windows", "about"],
            ]
          : [["No commands available", "none"]];
    menu.replaceChildren();
    labels.forEach(([label, command]) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "game-menu-item";
      item.textContent = label;
      item.dataset.printersCommand = command;
      item.disabled = command === "none";
      menu.appendChild(item);
    });
    menu.style.left = `${button.offsetLeft}px`;
    menu.style.top = `${button.offsetTop + button.offsetHeight}px`;
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
  };
  content.addEventListener("click", (event) => {
    const menuButton = event.target.closest("[data-printers-menu]");
    if (menuButton) return showMenu(menuButton);
    const command = event.target.closest("[data-printers-command]")?.dataset
      .printersCommand;
    if (command === "close") closeGameWindow("__printers");
    if (command === "help") openHelpAndSupport();
    if (command === "about") openProjectSettings();
    if (command) return closeMenu();
    const action = event.target.closest("[data-printers-action]")?.dataset
      .printersAction;
    if (action === "add" || action === "fax") {
      XPDialogs.message({
        title: action === "add" ? "Add Printer Wizard" : "Fax Setup Wizard",
        text: "This setup wizard is not available in the offline recreation.",
        icon: "info",
      });
    } else if (action === "search") openSearchDialog();
    else if (action === "folders") content.classList.toggle("folders-visible");
    else if (action === "control-panel") openControlPanel();
    else if (action === "documents") openSystemWindow("__my-documents");
    else if (action === "pictures") openSystemWindow("__my-pictures");
    else if (action === "computer") openSystemWindow("__my-computer");
    else if (action === "scanners")
      XPDialogs.alert(
        "No scanners or cameras are installed.",
        "Scanners and Cameras",
        "info",
      );
    else if (action === "troubleshoot" || action === "help")
      openHelpAndSupport();
    const toggle = event.target.closest(".explorer-section-toggle");
    if (toggle) {
      const section = toggle.closest("section");
      section.classList.toggle("collapsed");
      toggle.querySelector("[aria-hidden]").textContent =
        section.classList.contains("collapsed") ? "⌄" : "⌃";
    }
  });
};

const wireHelpAndSupport = (win) => {
  const content = win.el.querySelector(".help-center-content");
  const query = content.querySelector("#help-query");
  const topics = [...content.querySelectorAll("[data-help-topic]")];
  const filterTopics = () => {
    const needle = query.value.trim().toLocaleLowerCase();
    topics.forEach((topic) => {
      topic.hidden =
        Boolean(needle) &&
        !topic.textContent.toLocaleLowerCase().includes(needle);
    });
  };
  content.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    filterTopics();
  });
  content.addEventListener("click", (event) => {
    const action =
      event.target.closest("[data-help-action]")?.dataset.helpAction;
    if (action === "home") {
      query.value = "";
      filterTopics();
    } else if (action === "support") {
      window.open(
        "https://github.com/astrovm/flash/issues",
        "_blank",
        "noopener",
      );
    } else if (action) {
      XPDialogs.alert(
        `${event.target.closest("[data-help-action]").textContent.trim() || "This option"} is not available in the offline recreation.`,
        "Help and Support Center",
        "info",
      );
    }
    const topic = event.target.closest("[data-help-topic]");
    if (topic)
      XPDialogs.alert(
        `Help content for “${topic.textContent.trim()}” is not available in the offline recreation.`,
        "Help and Support Center",
        "info",
      );
  });
};

const openHelpAndSupport = () => openSystemWindow("__help");

const openAboutWindows = () => {
  const dialog = XPDialogs.createDialog({ title: "About Windows" });
  dialog.el.classList.add("about-windows-dialog");
  dialog.body.innerHTML = `
    <img class="about-windows-banner" src="assets/xp/AboutWindows.png" alt="Microsoft Windows XP Professional">
    <div class="about-windows-copy">
      <p>Microsoft ® Windows<br>Version 5.1 (Build 2600.xpsp.080413-2111 : Service Pack 3)<br>Copyright © 2007 Microsoft Corporation</p>
      <p>This product is licensed under the terms of the <a href="https://www.microsoft.com/useterms/" target="_blank" rel="noreferrer">End-User<br>License Agreement</a> to:</p>
      <p class="about-windows-user">astro</p>
      <hr>
      <p>Physical memory available to Windows:&nbsp;&nbsp; 523,696 KB</p>
    </div>
  `;
  XPDialogs.addButtonRow(dialog, [
    { id: "ok", label: "OK", isDefault: true, isCancel: true },
  ]);
};

const openSystemProperties = () => {
  const dialog = XPDialogs.createDialog({ title: "System Properties" });
  dialog.el.classList.add("system-properties-dialog");
  const help = document.createElement("button");
  help.type = "button";
  help.className = "tb-btn help-btn";
  help.title = "Help";
  help.setAttribute("aria-label", "Help");
  dialog.el.querySelector(".title-buttons").prepend(help);
  dialog.body.innerHTML = `
    <div class="system-properties-tabs" role="tablist" data-active-row="lower">
      <button type="button" role="tab" data-system-tab="restore">System Restore</button>
      <button type="button" role="tab" data-system-tab="updates">Automatic Updates</button>
      <button type="button" role="tab" data-system-tab="remote">Remote</button>
      <button type="button" role="tab" data-system-tab="general" aria-selected="true">General</button>
      <button type="button" role="tab" data-system-tab="computer-name">Computer Name</button>
      <button type="button" role="tab" data-system-tab="hardware">Hardware</button>
      <button type="button" role="tab" data-system-tab="advanced">Advanced</button>
    </div>
    <div class="system-properties-panels">
      <section data-system-panel="general">
        <img class="system-properties-logo" src="assets/xp/SystemProperties.png" alt="">
        <div class="system-properties-general-copy">
          <p>System:<br><span>Microsoft Windows XP<br>Professional<br>Version 2002<br>Service Pack 3</span></p>
          <p>Registered to:<br><span>astro<br><br>76487-640-8834005-23175</span></p>
          <p>Computer:<br><span>Intel Pentium III Xeon<br>processor<br>1.00 GHz, 512 MB of RAM</span></p>
        </div>
      </section>
      <section data-system-panel="computer-name" hidden>
        <div class="system-computer-name-intro">
          <img src="assets/xp/system/ComputerName.png" alt="">
          <p>Windows uses the following information to identify your computer<br>on the network.</p>
        </div>
        <div class="system-computer-description">
          <label for="system-computer-description">Computer description:</label>
          <input id="system-computer-description" class="xp-input">
          <p>For example: "Kitchen Computer" or "Mary's<br>Computer".</p>
        </div>
        <dl class="system-computer-identity">
          <dt>Full computer name:</dt><dd>astro-295e53a14.</dd>
          <dt>Workgroup:</dt><dd>WORKGROUP</dd>
        </dl>
        <div class="system-computer-action">
          <p>To use the Network Identification Wizard to join a<br>domain and create a local user account, click Network<br>ID.</p>
          <button type="button" class="xp-btn">Network ID</button>
        </div>
        <div class="system-computer-action system-computer-change">
          <p>To rename this computer or join a domain, click Change.</p>
          <button type="button" class="xp-btn">Change...</button>
        </div>
      </section>
      <section data-system-panel="hardware" hidden>
        <div class="system-properties-group system-hardware-group system-device-manager"><span class="system-group-title">Device Manager</span>
          <img src="assets/xp/system/DeviceManager.png" alt="">
          <p>The Device Manager lists all the hardware devices installed<br>on your computer. Use the Device Manager to change the<br>properties of any device.</p>
          <button type="button" class="xp-btn">Device Manager</button>
        </div>
        <div class="system-properties-group system-hardware-group system-driver-signing"><span class="system-group-title">Drivers</span>
          <img src="assets/xp/system/DriverSigning.png" alt="">
          <p>Driver Signing lets you make sure that installed drivers are<br>compatible with Windows. Windows Update lets you set up<br>how Windows connects to Windows Update for drivers.</p>
          <button type="button" class="xp-btn">Driver Signing</button>
        </div>
      </section>
      <section data-system-panel="advanced" hidden>
        <p class="system-advanced-intro">You must be logged on as an Administrator to make most of these changes.</p>
        <div class="system-properties-group system-advanced-group"><span class="system-group-title">Performance</span><p>Visual effects, processor scheduling, memory usage, and virtual memory</p><button type="button" class="xp-btn">Settings</button></div>
        <div class="system-properties-group system-advanced-group"><span class="system-group-title">User Profiles</span><p>Desktop settings related to your logon</p><button type="button" class="xp-btn">Settings</button></div>
        <div class="system-properties-group system-advanced-group"><span class="system-group-title">Startup and Recovery</span><p>System startup, system failure, and debugging information</p><button type="button" class="xp-btn">Settings</button></div>
        <div class="system-advanced-actions"><button type="button" class="xp-btn">Environment Variables</button><button type="button" class="xp-btn">Error Reporting</button></div>
      </section>
      <section data-system-panel="restore" hidden>
        <div class="system-restore-intro"><img src="assets/xp/system/SystemRestore.png" alt=""><p>System Restore can track and reverse harmful changes to your<br>computer.</p></div>
        <label class="system-restore-off"><input type="checkbox"> Turn off System Restore</label>
        <div class="system-properties-group system-restore-space"><span class="system-group-title">Disk space usage</span>
          <p>Move the slider to the right to increase or to the left to decrease the<br>amount of disk space for System Restore. Decreasing the disk space<br>may reduce the number of available restore points.</p>
          <div class="system-restore-slider-label"><span>Disk space to use:</span><span>Min</span><span>Max</span></div>
          <input type="range" min="0" max="100" value="100" aria-label="Disk space to use">
          <output>12% (981 MB)</output>
        </div>
        <div class="system-properties-group system-restore-status"><span class="system-group-title">Status</span><p><img class="system-drive-icon" src="assets/xp/icons/LocalDisk.png" alt=""> (C:) Monitoring</p></div>
      </section>
      <section data-system-panel="updates" hidden>
        <div class="system-updates-banner"><img src="assets/xp/system/UpdateShield.png" alt=""><span>Help protect your PC</span></div>
        <p class="system-updates-copy">Windows can regularly check for important updates and install them for you.<br>(Turning on Automatic Updates may automatically update Windows Update<br>software first, before any other updates.)<br><a href="https://support.microsoft.com/windows" target="_blank" rel="noreferrer">How does Automatic Updates work?</a></p>
        <label class="system-update-option system-update-auto"><input type="radio" name="system-updates" checked> <strong>Automatic (recommended)</strong></label>
        <div class="system-update-detail"><img src="assets/xp/system/UpdateEnabled.png" alt=""><p>Automatically download recommended updates for my computer<br>and install them:</p><div><select disabled aria-label="Update frequency"><option>Every day</option></select><span>at</span><select disabled aria-label="Update time"><option>3:00 AM</option></select></div></div>
        <label class="system-update-option"><input type="radio" name="system-updates"> Download updates for me, but let me choose when to install them.</label>
        <label class="system-update-option"><input type="radio" name="system-updates"> Notify me but don't automatically download or install them.</label>
        <label class="system-update-option"><input type="radio" name="system-updates"> Turn off Automatic Updates.</label>
        <div class="system-update-warning"><img src="assets/xp/system/UpdateDisabled.png" alt=""><p>Your computer will be more vulnerable unless you install updates<br>regularly.<br>Install updates from the <a href="https://update.microsoft.com/" target="_blank" rel="noreferrer">Windows Update Web site</a>.</p></div>
        <a class="system-updates-hidden" href="#">Offer updates again that I've previously hidden</a>
      </section>
      <section data-system-panel="remote" hidden>
        <div class="system-remote-intro"><img src="assets/xp/system/RemoteSettings.png" alt=""><p>Select the ways that this computer can be used from another<br>location.</p></div>
        <div class="system-properties-group system-remote-assistance"><span class="system-group-title">Remote Assistance</span>
          <label><input type="checkbox" checked> Allow Remote Assistance invitations to be sent from this computer</label>
          <a href="https://support.microsoft.com/windows" target="_blank" rel="noreferrer">What is Remote Assistance?</a>
          <button type="button" class="xp-btn">Advanced...</button>
        </div>
        <div class="system-properties-group system-remote-desktop"><span class="system-group-title">Remote Desktop</span>
          <label><input type="checkbox"> Allow users to connect remotely to this computer</label>
          <p class="system-remote-computer">Full computer name:<br><span>astro-295e53a14</span></p>
          <a class="system-remote-help" href="https://support.microsoft.com/windows" target="_blank" rel="noreferrer">What is Remote Desktop?</a>
          <button type="button" class="xp-btn system-remote-users">Select Remote Users...</button>
          <p class="system-remote-password">For users to connect remotely to this computer, the user account must<br>have a password.</p>
          <p class="system-remote-firewall"><a href="https://support.microsoft.com/windows" target="_blank" rel="noreferrer">Windows Firewall</a> will be configured to allow Remote Desktop<br>connections to this computer.</p>
        </div>
      </section>
    </div>
  `;
  const tabs = [...dialog.body.querySelectorAll("[data-system-tab]")];
  const panels = [...dialog.body.querySelectorAll("[data-system-panel]")];
  tabs.forEach((tab) =>
    tab.addEventListener("click", () => {
      tabs.forEach((entry) =>
        entry.setAttribute(
          "aria-selected",
          String(entry.dataset.systemTab === tab.dataset.systemTab),
        ),
      );
      panels.forEach((panel) => {
        panel.hidden = panel.dataset.systemPanel !== tab.dataset.systemTab;
      });
      dialog.body.querySelector(".system-properties-tabs").dataset.activeRow = [
        "restore",
        "updates",
        "remote",
      ].includes(tab.dataset.systemTab)
        ? "upper"
        : "lower";
    }),
  );
  help.addEventListener("click", openHelpAndSupport);
  XPDialogs.addButtonRow(dialog, [
    { id: "ok", label: "OK", isDefault: true },
    { id: "cancel", label: "Cancel", isCancel: true },
    { id: "apply", label: "Apply" },
  ]);
  dialog.body.querySelector('[data-action="apply"]').disabled = true;
};

const openShellProperties = (nodeId) =>
  nodeId === fs.MY_COMPUTER
    ? openSystemProperties()
    : XPDialogs.properties(nodeId);

const openSearchDialog = () => openSystemWindow("__search");

const openRunDialog = () => {
  const dialog = XPDialogs.createDialog({ title: "Run" });
  dialog.el.classList.add("run-dialog");
  const introRow = document.createElement("div");
  introRow.className = "run-dialog-intro";
  const icon = document.createElement("img");
  icon.src = "assets/xp/icons/Run.png";
  icon.alt = "";
  const intro = document.createElement("p");
  intro.textContent =
    "Type the name of a program, folder, document, or Internet resource, and Windows will open it for you.";
  introRow.append(icon, intro);
  const prompt = document.createElement("label");
  const promptText = document.createElement("span");
  setAccessKeyText(promptText, "&Open:");
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
  prompt.append(promptText, input);
  const status = document.createElement("p");
  status.className = "shell-dialog-status";
  status.hidden = true;
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
  dialog.body.append(introRow, prompt, history, status, row);
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
      image.src = XP_ICON_PATHS[icon];
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
    ["printers", "&Printers and Faxes", "PrintersAndFaxes.png"],
    ["help", "&Help and Support", "HelpAndSupport.png"],
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
const xpSoundPaths = {
  error: "assets/xp/sounds/error.wav",
  logoff: "assets/xp/sounds/logoff.wav",
  logon: "assets/xp/sounds/logon.wav",
  shutdown: "assets/xp/sounds/shutdown.wav",
  startup: "assets/xp/sounds/startup.wav",
};

const playXPSound = (name) => {
  const { volume, isMuted } = getMasterVolume();
  const audio = new Audio(xpSoundPaths[name]);
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
// Archived URL routing https://github.com/ruffle-rs/ruffle/issues/1486
// ============================================

const flashUrlRouter = window.AstroFlashUrlRouter.create(
  window.FLASH_GAMES,
  window.location.href,
);

const { fetch: originalFetch } = window;
const routedFetch = flashUrlRouter.wrapFetch(originalFetch, (routed) => {
  console.log(`URL routed: ${routed.originalUrl} => ${routed.localUrl}`);
});
window.fetch = async (...args) => {
  const originalRequest = args[0];
  // Bundled routes are exact and authoritative. Resolve them before the
  // installed-game fallback, which may probe every legacy package remotely.
  if (flashUrlRouter.resolve(originalRequest)) {
    return routedFetch(...args);
  }
  if (gameLibraryReady && gameLibrary && !gameLibraryError) {
    try {
      const installedResponse = await gameLibrary.match(originalRequest);
      if (installedResponse) {
        const originalUrl =
          originalRequest instanceof Request
            ? new URL(originalRequest.url)
            : new URL(originalRequest, window.location.href);
        return flashUrlRouter.spoofResponseUrl(installedResponse, originalUrl);
      }
    } catch (error) {
      console.error("Installed game resource lookup failed:", error);
    }
  }
  return routedFetch(...args);
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
const typeaheadState = new WeakMap();
const normalizeTypeaheadText = (value) =>
  String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
const cycleTypeaheadItem = (event, scope, items, getLabel) => {
  if (
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.isComposing ||
    Array.from(event.key).length !== 1
  )
    return null;

  const key = normalizeTypeaheadText(event.key);
  if (!key) return null;
  const matches = items.filter((item) =>
    normalizeTypeaheadText(getLabel(item)).startsWith(key),
  );
  if (!matches.length) return null;

  const previous = typeaheadState.get(scope);
  const repeated =
    previous?.key === key &&
    matches.includes(previous.target) &&
    document.activeElement === previous.target;
  const target = repeated
    ? matches[(matches.indexOf(previous.target) + 1) % matches.length]
    : matches[0];
  typeaheadState.set(scope, { key, target });
  event.preventDefault();
  return target;
};
const typeaheadItemLabel = (item) =>
  item.getAttribute("aria-label") ||
  item.querySelector(
    ".icon-label, .menu-item-label, .context-label, .sm-game-title, b",
  )?.textContent ||
  item.textContent;
const confirmPermanentDelete = (ids) =>
  XPDialogs.confirm(
    ids.length === 1
      ? "Are you sure you want to permanently delete this item?"
      : "Are you sure you want to permanently delete these items?",
    "Confirm File Delete",
    "warning",
  ).then((yes) => yes && ids.forEach((id) => fs.destroy(id)));

document.addEventListener(
  "keydown",
  (event) => {
    if (event.defaultPrevented || isEditableTarget(event.target)) return;
    const active = document.activeElement;
    let scope = active?.closest?.('[role="menu"], [role="menubar"]');
    const startMenu = document.getElementById("start-menu");
    if (
      !scope &&
      !startMenu.hidden &&
      (startMenu.contains(active) || active?.id === "start-button")
    ) {
      scope = startMenu;
    }
    if (!scope) return;

    const items = [...scope.querySelectorAll("button:not(:disabled)")].filter(
      (item) => {
        if (!item.getClientRects().length) return false;
        if (scope === startMenu) return startMenu.contains(item);
        return item.closest('[role="menu"], [role="menubar"]') === scope;
      },
    );
    const target = cycleTypeaheadItem(event, scope, items, typeaheadItemLabel);
    if (!target) return;
    target.focus();
    event.stopImmediatePropagation();
  },
  true,
);

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
    const desktopIcons = [...document.querySelectorAll(".desktop-icon")];
    const typeaheadTarget = cycleTypeaheadItem(
      e,
      document.getElementById("desktop-icons"),
      desktopIcons,
      typeaheadItemLabel,
    );
    if (typeaheadTarget) {
      selectDesktopIcon(typeaheadTarget.dataset.desktopId);
      typeaheadTarget.focus();
      return;
    }
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
      const current = desktopIcons.indexOf(desktopIcon);
      const direction = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
      const target =
        desktopIcons[
          (current + direction + desktopIcons.length) % desktopIcons.length
        ];
      e.preventDefault();
      if (!e.ctrlKey && !e.shiftKey)
        selectDesktopIcon(target.dataset.desktopId);
      if (e.shiftKey) target.classList.add("selected");
      target.focus();
      return;
    }
  }

  const explorerSurface = document.activeElement?.closest?.(".explorer-items");
  const explorerItem = document.activeElement?.closest?.(".explorer-item");
  const explorerWin =
    explorerSurface &&
    [...openWindows.values()].find((win) => win.el.contains(explorerSurface));
  if (explorerWin) {
    const explorerItems = [
      ...explorerSurface.querySelectorAll(".explorer-item"),
    ];
    const typeaheadTarget = cycleTypeaheadItem(
      e,
      explorerSurface,
      explorerItems,
      typeaheadItemLabel,
    );
    if (typeaheadTarget) {
      explorerItems.forEach((item) => item.classList.remove("selected"));
      typeaheadTarget.classList.add("selected");
      typeaheadTarget.focus();
      return;
    }
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
