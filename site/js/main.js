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
  gameManifestUrl: window.ASTRO_OFFLINE_MANIFEST_URL || "offline-games.json",
});
const gameDataManager = window.AstroGameData.createManager();

let bootTimeout = null;
let shutdownTimeout = null;
let loggedIn = false;
let shellInitialized = false;
let suspended = false;
let iconsBuilt = false;
let renderedPlacesStyle = null;
let screenSaverTimeout = null;
let screenSaverWired = false;

const gamesList = { ...window.FLASH_GAMES };
const installedGameIds = new Set();
let gameLibrary = null;
let gameLibraryError = null;
let gameLibraryReady = false;
let gameLibraryInitialization = Promise.resolve();
let offlineManagerInitialization = Promise.resolve();
let automaticOfflineDownloadQueue = Promise.resolve();

const DISPLAY_SETTINGS_KEY = "displaySettings";
const START_MENU_STYLE_KEY = "startMenuStyle";
const WINDOW_PLACEMENTS_KEY = "windowPlacements";
const DESKTOP_SYSTEM_ICONS_KEY = "desktopSystemIcons";
const DESKTOP_SYSTEM_NAMES_KEY = "desktopSystemNames";
const GAME_PLAYBACK_SETTINGS_KEY = "gamePlaybackSettings";
const USER_STORAGE_KEYS = Object.freeze([
  DISPLAY_SETTINGS_KEY,
  START_MENU_STYLE_KEY,
  "clockOffsetMs",
  "desktopIconPositions",
  "desktopLayoutSettings",
  DESKTOP_SYSTEM_ICONS_KEY,
  DESKTOP_SYSTEM_NAMES_KEY,
  "favorites",
  "gameStats",
  GAME_PLAYBACK_SETTINGS_KEY,
  WINDOW_PLACEMENTS_KEY,
  "gameVolumes",
  "isMuted",
  "runHistory",
  "volume",
]);
const DISPLAY_WALLPAPERS = {
  none: "none",
  bliss: 'url("/assets/xp/bliss.jpg")',
  ascent: 'url("/assets/xp/wallpapers/ascent.jpg")',
  autumn: 'url("/assets/xp/wallpapers/autumn.jpg")',
  azul: 'url("/assets/xp/wallpapers/azul.jpg")',
  "blue-lace": 'url("/assets/xp/wallpapers/blue-lace-16.bmp")',
  coffee: 'url("/assets/xp/wallpapers/coffee-bean.bmp")',
  crystal: 'url("/assets/xp/wallpapers/crystal.jpg")',
  follow: 'url("/assets/xp/wallpapers/follow.jpg")',
  friend: 'url("/assets/xp/wallpapers/friend.jpg")',
  greenstone: 'url("/assets/xp/wallpapers/greenstone.bmp")',
  home: 'url("/assets/xp/wallpapers/home.jpg")',
  "moon-flower": 'url("/assets/xp/wallpapers/moon-flower.jpg")',
  peace: 'url("/assets/xp/wallpapers/peace.jpg")',
  power: 'url("/assets/xp/wallpapers/power.jpg")',
  "prairie-wind": 'url("/assets/xp/wallpapers/prairie-wind.bmp")',
  "purple-flower": 'url("/assets/xp/wallpapers/purple-flower.jpg")',
  radiance: 'url("/assets/xp/wallpapers/radiance.jpg")',
  "red-moon-desert": 'url("/assets/xp/wallpapers/red-moon-desert.jpg")',
  ripple: 'url("/assets/xp/wallpapers/ripple.jpg")',
  stonehenge: 'url("/assets/xp/wallpapers/stonehenge.jpg")',
  tulips: 'url("/assets/xp/wallpapers/tulips.jpg")',
  "vortec-space": 'url("/assets/xp/wallpapers/vortec-space.jpg")',
  wind: 'url("/assets/xp/wallpapers/wind.jpg")',
  "windows-xp": 'url("/assets/xp/wallpapers/windows-xp.jpg")',
  zapotec: 'url("/assets/xp/wallpapers/zapotec.bmp")',
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
  "AccessibilitySound.png": "assets/xp/icons/AccessibilitySound.png",
  "AddressBook.png": "assets/xp/icons/AddressBook.png",
  "AddRemovePrograms.png": "assets/xp/icons/AddRemovePrograms.png",
  "AppearanceAndThemes.png": "assets/xp/icons/AppearanceAndThemes.png",
  "Back.png": "assets/xp/icons/Back.png",
  "Calculator.png": "assets/xp/icons/Calculator.png",
  "CommandPrompt.png": "assets/xp/icons/CommandPrompt.png",
  "ControlPanel.png": "assets/xp/icons/ControlPanel.png",
  "DateTimeRegional.png": "assets/xp/icons/DateTimeRegional.png",
  "Exit.png": "assets/xp/icons/Exit.png",
  "FolderViewClassic.png": "assets/xp/icons/FolderViewClassic.png",
  "FolderView.png": "assets/xp/icons/FolderView.png",
  "Forward.png": "assets/xp/icons/Forward.png",
  "Fonts.png": "assets/xp/icons/Fonts.png",
  "Go.png": "assets/xp/icons/Go.png",
  "HelpAndSupport.png": "assets/xp/icons/HelpAndSupport.png",
  "InternetOptions.png": "assets/xp/icons/InternetOptions.png",
  "InternetExplorer.png": "assets/xp/icons/InternetExplorer.png",
  "InternetBackgammon.png": "assets/xp/icons/InternetBackgammon.png",
  "InternetCheckers.png": "assets/xp/icons/InternetCheckers.png",
  "InternetHearts.png": "assets/xp/icons/InternetHearts.png",
  "InternetReversi.png": "assets/xp/icons/InternetReversi.png",
  "InternetSpades.png": "assets/xp/icons/InternetSpades.png",
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
  "NetworkConnections.png": "assets/xp/icons/NetworkConnections.png",
  "NetworkSetupWizard.png": "assets/xp/icons/NetworkSetupWizard.png",
  "NewFolder.png": "assets/xp/icons/NewFolder.png",
  "Power.png": "assets/xp/icons/Power.png",
  "PerformanceAndMaintenance.png":
    "assets/xp/icons/PerformanceAndMaintenance.png",
  "Paint.png": "assets/xp/icons/Paint.png",
  "PrintersAndHardware.png": "assets/xp/icons/PrintersAndHardware.png",
  "PrintersAndFaxes.png": "assets/xp/icons/PrintersAndFaxes.png",
  "Programs.png": "assets/xp/icons/Programs.png",
  "ProgramAccessDefaultsSmall.png":
    "assets/xp/icons/ProgramAccessDefaultsSmall.png",
  "ProgramAccessDefaultsMenu.png":
    "assets/xp/icons/ProgramAccessDefaultsMenu.png",
  "ProgramCompatibilityWizard.png":
    "assets/xp/icons/ProgramCompatibilityWizard.png",
  "ProgramFolder.png": "assets/xp/icons/ProgramFolder.png",
  "PublishToWeb.png": "assets/xp/icons/PublishToWeb.png",
  "RecentDocuments.png": "assets/xp/icons/RecentDocuments.png",
  "RemoteDesktopConnection.png": "assets/xp/icons/RemoteDesktopConnection.png",
  "RemoteDesktop.png": "assets/xp/icons/RemoteDesktop.png",
  "RemoteAssistance.png": "assets/xp/icons/RemoteAssistance.png",
  "RemovableMedia.png": "assets/xp/icons/RemovableMedia.png",
  "Restore.png": "assets/xp/icons/Restore.png",
  "Run.png": "assets/xp/icons/Run.png",
  "Search.png": "assets/xp/icons/Search.png",
  "WindowsFirewall.png": "assets/xp/icons/WindowsFirewall.png",
  "WirelessNetworkSetupWizard.png":
    "assets/xp/icons/WirelessNetworkSetupWizard.png",
  "SecurityCenter.png": "assets/xp/icons/SecurityCenter.png",
  "SharedFolder.png": "assets/xp/icons/SharedFolder.png",
  "Up.png": "assets/xp/icons/Up.png",
  "SoundsSpeechAudio.png": "assets/xp/icons/SoundsSpeechAudio.png",
  "SoundsAudioSmall.png": "assets/xp/icons/SoundsAudioSmall.png",
  "Synchronize.png": "assets/xp/icons/Synchronize.png",
  "System.png": "assets/xp/icons/System.png",
  "TourWindowsXP.png": "assets/xp/icons/TourWindowsXP.png",
  "UserAccounts.png": "assets/xp/icons/UserAccounts.png",
  "Volume.png": "assets/xp/icons/Volume.png",
  "WindowsCatalog.png": "assets/xp/icons/WindowsCatalog.png",
  "WindowsCatalogMenu.png": "assets/xp/icons/WindowsCatalogMenu.png",
  "WindowsExplorer.png": "assets/xp/icons/WindowsExplorer.png",
  "WindowsUpdate.png": "assets/xp/icons/WindowsUpdate.png",
  "WindowsUpdateMenu.png": "assets/xp/icons/WindowsUpdateMenu.png",
  "WindowsMediaPlayer.png": "assets/xp/icons/WindowsMediaPlayer.png",
  "WindowsMessenger.png": "assets/xp/icons/WindowsMessenger.png",
  "WindowsMessengerLarge.png": "assets/xp/icons/WindowsMessengerLarge.png",
  "WindowsMovieMaker.png": "assets/xp/icons/WindowsMovieMaker.png",
  "WordPad.png": "assets/xp/icons/WordPad.png",
  "Display.png": "assets/xp/icons/Display.png",
  "Magnifier.png": "assets/xp/icons/Magnifier.png",
  "Minesweeper.png": "assets/xp/icons/Minesweeper.png",
  "MSN.png": "assets/xp/icons/MSN.png",
  "Notepad.png": "assets/xp/icons/Notepad.png",
  "OnScreenKeyboard.png": "assets/xp/icons/OnScreenKeyboard.png",
  "OutlookExpress.png": "assets/xp/icons/OutlookExpress.png",
  "FreeCell.png": "assets/xp/icons/FreeCell.png",
  "Hearts.png": "assets/xp/icons/Hearts.png",
  "Pinball.png": "assets/xp/icons/Pinball.png",
  "ScheduledTasks.png": "assets/xp/icons/ScheduledTasks.png",
  "Solitaire.png": "assets/xp/icons/Solitaire.png",
  "SpiderSolitaire.png": "assets/xp/icons/SpiderSolitaire.png",
  "TaskbarAndStartMenu.png": "assets/xp/icons/TaskbarAndStartMenu.png",
  "ExplorerProperties.png": "assets/xp/icons/ExplorerProperties.png",
  "MyComputer.png": "assets/xp/icons/MyComputer.png",
  "MyDocuments.png": "assets/xp/icons/MyDocuments.png",
  "RecyclerEmpty.png": "assets/xp/icons/RecyclerEmpty.png",
  "RecyclerFull.png": "assets/xp/icons/RecyclerFull.png",
  "Shortcut.png": "assets/xp/icons/Shortcut.png",
});
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
  "__user-accounts": {
    title: "User Accounts",
    icon: "assets/xp/icons/UserAccounts.png",
    desktop: false,
  },
  "__add-remove-programs": {
    title: "Add or Remove Programs",
    icon: "assets/xp/icons/AddRemovePrograms.png",
    desktop: false,
  },
  "__security-center": {
    title: "Windows Security Center",
    icon: "assets/xp/icons/SecurityCenter.png",
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

window.AstroShellApplications = Object.freeze({
  install(registry) {
    window.XPApplicationRegistry = registry;
    registry.entries().forEach(([id, application]) => {
      const existing = systemShortcuts[id];
      systemShortcuts[id] = {
        title: application.title,
        icon: application.icon.includes("/")
          ? application.icon
          : XP_ICON_PATHS[application.icon],
        ...(existing && Object.hasOwn(existing, "desktop")
          ? { desktop: existing.desktop }
          : {}),
      };
    });
    window.AstroApplicationHost.installFileAssociations(registry);
  },
});

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
  if (id && gamesList[id]) return id;
  const application = window.XPApplicationRegistry?.values().find(
    (candidate) =>
      candidate.kind === "native-game" && candidate.deepLinkId === id,
  );
  return application?.id || null;
};

const openLinkedGame = (gameId) => {
  const application = window.XPApplicationRegistry?.get(gameId);
  if (application?.kind === "native-game") {
    openXPProgram(gameId);
  } else {
    openGameWindow(gameId);
  }
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
  ["blue", "olive", "silver", "classic"].includes(value.appearance) &&
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

const getDesktopSystemNames = () =>
  readJsonStorage(DESKTOP_SYSTEM_NAMES_KEY, {}, (value) =>
    Object.values(value || {}).every(
      (name) => typeof name === "string" && name.trim().length > 0,
    ),
  );

const saveDesktopSystemNames = (settings) =>
  writeJsonStorage(DESKTOP_SYSTEM_NAMES_KEY, settings);

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

const getTaskbarHeight = () =>
  document.documentElement.dataset.xpAppearance === "classic" ? 28 : 30;

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
    desktop.style.height = `${Math.max(1, monitor.height - getTaskbarHeight())}px`;
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
