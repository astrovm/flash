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
const APP_VERSION = "26.07.28-1";

let bootTimeout = null;
let shutdownTimeout = null;
let loggedIn = false;
let shellInitialized = false;
let suspended = false;
let iconsBuilt = false;
let placesBuilt = false;
let screenSaverTimeout = null;
let screenSaverWired = false;

const gamesList = window.FLASH_GAMES;

const DISPLAY_SETTINGS_KEY = "displaySettings";
const MAX_CUSTOM_WALLPAPER_BYTES = 1024 * 1024;
const DISPLAY_WALLPAPERS = {
    bliss: "url(\"../assets/xp/bliss.jpg\")",
    blue: "linear-gradient(135deg, #1e5799, #7db9e8)",
    olive: "linear-gradient(135deg, #586b2f, #b7c878)"
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
    resolution: "auto"
});

const categoryIcons = {
    "Racing": "🏁",
    "Action": "💥",
    "Adventure": "🗺️",
    "Puzzle": "🧩",
    "Arcade": "👾",
    "Misc": "⭐",
    "Favorites": "★",
    "Recently Played": "🕒",
    "Other": "🎮"
};

const systemShortcuts = {
    "__my-documents": {
        title: "My Documents",
        icon: "assets/xp/icons/mydocuments.png"
    },
    "__my-computer": {
        title: "My Computer",
        icon: "assets/xp/icons/mycomputer.png"
    },
    "__my-pictures": {
        title: "My Pictures",
        icon: "assets/xp/icons/MyPictures.png",
        desktop: false
    },
    "__my-music": {
        title: "My Music",
        icon: "assets/xp/icons/MyMusic.png",
        desktop: false
    },
    "__recycle-bin": {
        title: "Recycle Bin",
        icon: "assets/xp/icons/recycler-empty.png"
    },
    "__display-properties": {
        title: "Display Properties",
        icon: "assets/xp/icons/mycomputer.png",
        desktop: false
    }
};

// ============================================
// Helper Functions
// ============================================

const formatGameTitle = (gameId) => (
    systemShortcuts[gameId]?.title
    || gamesList[gameId]?.title
    || gameId
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
);

const getGameIcon = (gameId) => (
    categoryIcons[gamesList[gameId]?.category] || categoryIcons["Other"]
);

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
        if (typeof validator === 'function' && !validator(parsedValue)) {
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

const isDisplaySettings = (value) => (
    value && typeof value === "object"
    && ["windows-xp", "classic", "olive"].includes(value.theme)
    && Object.hasOwn(DISPLAY_WALLPAPERS, value.wallpaper)
    && typeof value.customWallpaper === "string"
    && (value.customWallpaper === "" || (
        /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(value.customWallpaper)
        && value.customWallpaper.length <= MAX_CUSTOM_WALLPAPER_BYTES * 1.4
    ))
    && ["center", "tile", "stretch"].includes(value.position)
    && /^#[0-9a-f]{6}$/i.test(value.backgroundColor)
    && ["blue", "olive", "silver"].includes(value.appearance)
    && ["none", "marquee", "stars"].includes(value.screenSaver)
    && Number.isInteger(value.screenSaverWait)
    && value.screenSaverWait >= 1 && value.screenSaverWait <= 60
    && ["auto", "800x600", "1024x768"].includes(value.resolution)
);

const getDisplaySettings = () => ({
    ...DEFAULT_DISPLAY_SETTINGS,
    ...readJsonStorage(DISPLAY_SETTINGS_KEY, {}, isDisplaySettings)
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

const displayBackground = (settings) => (
    settings.customWallpaper
        ? `url("${settings.customWallpaper}")`
        : DISPLAY_WALLPAPERS[settings.wallpaper]
);

const applyDisplaySettings = (settings) => {
    const desktop = document.getElementById("desktop");
    if (!desktop) return;
    desktop.style.setProperty("--desktop-background", displayBackground(settings));
    desktop.style.setProperty("--desktop-color", settings.backgroundColor);
    desktop.dataset.wallpaperPosition = settings.position;
    document.documentElement.dataset.xpAppearance = settings.appearance;
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
    screenSaverTimeout = setTimeout(() => {
        saver.hidden = false;
    }, settings.screenSaverWait * 60 * 1000);
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

const getFavorites = () => (
    readJsonStorage('favorites', [], Array.isArray)
);

const setFavorites = (favorites) => {
    const normalizedFavorites = Array.isArray(favorites) ? favorites : [];
    writeJsonStorage('favorites', normalizedFavorites);
};

const getGameStats = () => (
    readJsonStorage(
        'gameStats',
        {},
        (stats) => stats && typeof stats === 'object'
    )
);

const getGameVolume = (gameId) => {
    const gameVolumes = readJsonStorage(
        'gameVolumes',
        {},
        (volumes) => volumes && typeof volumes === 'object'
    );

    if (gameId in gameVolumes) {
        return {
            volume: parseInt(gameVolumes[gameId].volume, 10),
            isMuted: gameVolumes[gameId].isMuted
        };
    }
    // Fall back to global settings if no game-specific settings exist
    return {
        volume: parseInt(localStorage.getItem('volume') || '100', 10),
        isMuted: localStorage.getItem('isMuted') === 'true'
    };
};

const setGameVolume = (gameId, volume, isMuted) => {
    const gameVolumes = readJsonStorage(
        'gameVolumes',
        {},
        (volumes) => volumes && typeof volumes === 'object'
    );
    gameVolumes[gameId] = {
        volume: volume,
        isMuted: isMuted
    };
    writeJsonStorage('gameVolumes', gameVolumes);
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

    const resolvedVolume = Number.isFinite(normalizedVolume) ? normalizedVolume : 0;
    const resolvedType = type || (player instanceof HTMLIFrameElement ? 'iframe' : 'swf');

    if (resolvedType === 'iframe') {
        player.contentWindow?.postMessage({
            type: 'setVolume',
            volume: resolvedVolume
        }, window.location.origin);
    } else {
        try {
            player.volume = resolvedVolume;
        } catch (error) {
            console.error('Error setting SWF volume:', error);
        }
    }
};

const toggleFullscreen = (element) => {
    if (!document.fullscreenElement) {
        element.requestFullscreen().catch(err => {
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
        left: Math.min(
            Math.max(left, 60 - win.el.offsetWidth),
            desktopWidth - 60
        ),
        top: Math.min(Math.max(top, 0), desktopHeight - 28)
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
    if (!win.volumeBtn || !win.volumeSlider) return;
    const { volume, isMuted } = getGameVolume(win.gameId);
    const numericVolume = Number.isFinite(volume) ? volume : 100;
    const muted = isMuted || numericVolume === 0;
    [win.volumeBtn, win.volumeMenuItem].filter(Boolean).forEach((button) => {
        button.classList.toggle("checked", muted);
        button.classList.toggle("active", muted);
        button.setAttribute("aria-pressed", String(muted));
        button.setAttribute("aria-checked", String(muted));
    });
    win.volumeBtn.title = muted ? "Unmute" : "Mute";
    const label = win.volumeMenuItem?.querySelector(".menu-item-label");
    if (label) setAccessKeyText(label, muted ? "&Unmute" : "&Mute");
    [win.volumeSlider, win.volumeMenuSlider].filter(Boolean).forEach((slider) => {
        slider.value = isMuted ? 0 : numericVolume;
    });
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
    const label = win.favoriteMenuItem?.querySelector(".menu-item-label");
    if (label) {
        setAccessKeyText(
            label,
            isFavorite ? "&Remove from Favorites" : "&Add to Favorites"
        );
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
        buildProgramsList(document.getElementById("game-search").value);
    }
};

const trackGamePlay = (gameId) => {
    const gameStats = getGameStats();
    const timestamp = Date.now();

    if (!gameStats[gameId]) {
        gameStats[gameId] = {
            plays: 0,
            lastPlayed: null
        };
    }

    gameStats[gameId].plays += 1;
    gameStats[gameId].lastPlayed = timestamp;

    writeJsonStorage('gameStats', gameStats);

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
    menuBar.setAttribute("role", "menubar");
    menuBar.setAttribute("aria-label", "Game menu");

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
        item.setAttribute("role", options.checkbox ? "menuitemcheckbox" : "menuitem");
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
        makeMenuItem("&Close", "close", { shortcut: "Alt+F4" }),
        Object.assign(document.createElement("div"), { className: "game-menu-separator" }),
        makeMenuItem("&Properties", "properties", { disabled: true })
    );

    const helpMenu = makeMenu("help");
    helpMenu.append(makeMenuItem("&About Astro Flash", "project"));

    const toolbar = document.createElement("div");
    toolbar.className = "window-toolbar";

    const fullscreenBtn = document.createElement("button");
    fullscreenBtn.type = "button";
    fullscreenBtn.className = "toolbar-btn fullscreen-btn";
    fullscreenBtn.title = "Full Screen (F11)";
    fullscreenBtn.textContent = "Full Screen";

    const toolbarFavoriteBtn = document.createElement("button");
    toolbarFavoriteBtn.type = "button";
    toolbarFavoriteBtn.className = "toolbar-btn favorite-btn";
    toolbarFavoriteBtn.title = "Add to Favorites";
    toolbarFavoriteBtn.textContent = "Favorite";
    toolbarFavoriteBtn.setAttribute("aria-pressed", "false");

    const separator = document.createElement("span");
    separator.className = "toolbar-separator";
    separator.setAttribute("aria-hidden", "true");

    const toolbarVolumeBtn = document.createElement("button");
    toolbarVolumeBtn.type = "button";
    toolbarVolumeBtn.className = "toolbar-btn volume-btn";
    toolbarVolumeBtn.title = "Mute";
    toolbarVolumeBtn.textContent = "Sound";
    toolbarVolumeBtn.setAttribute("aria-pressed", "false");

    const toolbarVolumeSlider = document.createElement("input");
    toolbarVolumeSlider.type = "range";
    toolbarVolumeSlider.className = "volume-slider";
    toolbarVolumeSlider.min = "0";
    toolbarVolumeSlider.max = "100";
    toolbarVolumeSlider.value = "100";
    toolbarVolumeSlider.setAttribute("aria-label", "Game volume");

    toolbar.append(
        fullscreenBtn,
        toolbarFavoriteBtn,
        separator,
        toolbarVolumeBtn,
        toolbarVolumeSlider
    );
    menuBar.append(fileButton, helpButton, toolbar);

    const content = document.createElement("div");
    content.className = "window-content";

    win.append(
        titleBar,
        menuBar,
        fileMenu,
        helpMenu,
        content
    );

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

    const config = {
        url: gamesList[gameId].spoofUrl
            ? `${gamesList[gameId].spoofUrl}/main.swf`
            : `swf/${gameId}/main.swf`,
        base: gamesList[gameId].spoofUrl
            ? `${gamesList[gameId].spoofUrl}/`
            : `swf/${gameId}/`,
        letterbox: "on",
        scale: "showAll",
        forceScale: true,
        openUrlMode: "confirm",
        showSwfDownload: true,
        frameRate: gamesList[gameId].frameRate,
        volume: gameId === focusedGameId ? normalizeGameVolume(gameId) : 0,
        allowScriptAccess: false,
        autoplay: "on",
        unmuteOverlay: "hidden"
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

    player.addEventListener("load", () => {
        const volume = gameId === focusedGameId ? normalizeGameVolume(gameId) : 0;
        setPlayerVolume(player, "iframe", volume);
    }, { once: true });
};

const focusWindow = (gameId) => {
    const win = openWindows.get(gameId);
    if (!win) return;

    focusedGameId = gameId;
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
        history.replaceState(null, "", window.location.pathname + window.location.search);
    }
};

const minimizeWindow = (gameId) => {
    const win = openWindows.get(gameId);
    if (!win || win.minimized) return;

    win.minimized = true;
    const taskButton = document.querySelector(`.task-button[data-game="${gameId}"]`);
    const target = taskButton?.getBoundingClientRect();
    const source = win.el.getBoundingClientRect();
    const deltaX = target ? target.left + target.width / 2 - (source.left + source.width / 2) : 0;
    const deltaY = target ? target.top - source.bottom : 32;
    const animation = win.el.animate(
        [
            { transform: "translate(0, 0) scale(1)", opacity: 1 },
            { transform: `translate(${deltaX}px, ${deltaY}px) scale(0.12, 0.05)`, opacity: 0.35 }
        ],
        { duration: 170, easing: "ease-in", fill: "forwards" }
    );
    animation.addEventListener("finish", () => {
        if (win.minimized) {
            win.el.style.display = "none";
        }
        animation.cancel();
    }, { once: true });

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
            { transform: "scale(1)", opacity: 1 }
        ],
        { duration: 130, easing: "ease-out" }
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
        }
        else focusTopWindow();
        return;
    }

    showDesktopSnapshot = {
        focusedGameId,
        windows: [...openWindows.values()].map((win) => ({
            gameId: win.gameId,
            minimized: win.minimized
        }))
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
            height: win.el.style.height
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
                win.el.offsetTop
            );
            win.el.style.left = `${position.left}px`;
            win.el.style.top = `${position.top}px`;
        }
        win.maximized = false;
    }
    updateMaximizeButton(win);
    focusWindow(gameId);
};

const closeGameWindow = (gameId) => {
    const win = openWindows.get(gameId);
    if (!win) return;

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
        if (e.button !== 0 || e.target.closest(".title-buttons, .title-icon")) return;

        closeWindowSystemMenu();
        let restoredFromMaximized = false;
        if (win.maximized) {
            // Restore the window under the pointer before dragging, keeping
            // the pointer at the same relative position on the title bar.
            const rect = win.el.getBoundingClientRect();
            const ratio = Math.min(
                Math.max((e.clientX - rect.left) / rect.width, 0),
                1
            );
            toggleMaximize(win.gameId);
            const position = clampWindowPosition(
                win,
                e.clientX - win.el.offsetWidth * ratio,
                e.clientY - 14
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
                ev.clientY + offsetY
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
                    height: win.el.style.height
                };
            }
        };

        try {
            bar.setPointerCapture(e.pointerId);
        } catch (error) { /* pointer capture unsupported */ }

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
            desktopWidth - start.left
        );
    }
    if (direction.includes("w")) {
        width = Math.min(Math.max(start.width - deltaX, MIN_WINDOW_WIDTH), right);
        left = right - width;
    }
    if (direction.includes("s")) {
        height = Math.min(
            Math.max(start.height + deltaY, MIN_WINDOW_HEIGHT),
            desktopHeight - start.top
        );
    }
    if (direction.includes("n")) {
        height = Math.min(Math.max(start.height - deltaY, MIN_WINDOW_HEIGHT), bottom);
        top = bottom - height;
    }

    Object.assign(win.el.style, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`
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
                height: win.el.offsetHeight
            };

            const onMove = (ev) => {
                applyResize(
                    win,
                    direction,
                    start,
                    ev.clientX - start.x,
                    ev.clientY - start.y
                );
            };

            const onUp = () => {
                handle.removeEventListener("pointermove", onMove);
                handle.removeEventListener("pointerup", onUp);
                handle.removeEventListener("pointercancel", onUp);
            };

            try {
                handle.setPointerCapture(e.pointerId);
            } catch (error) { /* pointer capture unsupported */ }

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
        close: true
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
        Math.min(clientX - bounds.left, bounds.width - menu.offsetWidth - 2)
    );
    const top = Math.max(
        0,
        Math.min(clientY - bounds.top, bounds.height - menu.offsetHeight - 2)
    );
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.querySelector("button:not(:disabled)")?.focus();
};

const nudgeWindow = (win, deltaX, deltaY) => {
    const position = clampWindowPosition(
        win,
        win.el.offsetLeft + deltaX,
        win.el.offsetTop + deltaY
    );
    win.el.style.left = `${position.left}px`;
    win.el.style.top = `${position.top}px`;
};

const nudgeResize = (win, deltaX, deltaY) => {
    const { width: desktopWidth, height: desktopHeight } = getDesktopSize();
    const width = Math.min(
        Math.max(win.el.offsetWidth + deltaX, MIN_WINDOW_WIDTH),
        desktopWidth - win.el.offsetLeft
    );
    const height = Math.min(
        Math.max(win.el.offsetHeight + deltaY, MIN_WINDOW_HEIGHT),
        desktopHeight - win.el.offsetTop
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
        height: el.style.height
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
            "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "Escape"
        ];
        if (!keys.includes(e.key)) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.key === "Enter") return finish(true);
        if (e.key === "Escape") return finish(false);

        const deltaX = e.key === "ArrowLeft" ? -MOVE_SIZE_STEP
            : e.key === "ArrowRight" ? MOVE_SIZE_STEP : 0;
        const deltaY = e.key === "ArrowUp" ? -MOVE_SIZE_STEP
            : e.key === "ArrowDown" ? MOVE_SIZE_STEP : 0;
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
        menus.forEach((menu) => { menu.hidden = true; });
        menuButtons.forEach((button) => button.setAttribute("aria-expanded", "false"));
    };

    const openGameMenu = (name, focusFirstItem = false) => {
        const menu = menus.find((item) => item.dataset.gameMenu === name);
        const button = menuButtons.find((item) => item.dataset.gameMenu === name);
        if (!menu || !button) return;
        closeGameMenus();
        menu.hidden = false;
        button.setAttribute("aria-expanded", "true");
        if (focusFirstItem) {
            menu.querySelector('button:not(:disabled), input:not(:disabled)')?.focus();
        }
    };

    const switchGameMenu = (currentName, direction) => {
        const currentIndex = menuButtons.findIndex((button) => button.dataset.gameMenu === currentName);
        const next = menuButtons[(currentIndex + direction + menuButtons.length) % menuButtons.length];
        next.focus();
        openGameMenu(next.dataset.gameMenu, true);
    };

    win.el.addEventListener("pointerdown", () => focusWindow(gameId));

    win.el.querySelector(".close-btn").addEventListener("click", () => closeGameWindow(gameId));
    win.el.querySelector(".minimize-btn").addEventListener("click", () => minimizeWindow(gameId));
    win.el.querySelector(".maximize-btn").addEventListener("click", () => toggleMaximize(gameId));
    win.el.querySelector(".fullscreen-btn").addEventListener("click", () => {
        if (win.player) toggleFullscreen(win.player);
    });
    win.favoriteBtn.addEventListener("click", () => toggleFavorite(gameId));
    win.volumeBtn.addEventListener("click", () => toggleWindowMute(win));

    menuBar.addEventListener("click", (event) => {
        const button = event.target.closest(".game-menu-button");
        if (!button) return;
        const menu = menus.find((item) => item.dataset.gameMenu === button.dataset.gameMenu);
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
            menuButtons[(index + direction + menuButtons.length) % menuButtons.length].focus();
        } else if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openGameMenu(button.dataset.gameMenu, true);
        } else if (event.key === "Escape") {
            closeGameMenus();
            button.focus();
        }
    });
    win.el.addEventListener("keydown", (event) => {
        if (!event.altKey || event.ctrlKey || event.metaKey) return;
        const button = menuButtons.find((item) => item.dataset.accessKey === event.key.toLowerCase());
        if (!button) return;
        event.preventDefault();
        button.focus();
        openGameMenu(button.dataset.gameMenu, true);
    });
    menus.forEach((menu) => {
        menu.addEventListener("keydown", (event) => {
            const items = [...menu.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
            const index = items.indexOf(document.activeElement);
            if (event.target.matches("input") && event.key.startsWith("Arrow")) return;
            if (event.key === "Escape") {
                event.preventDefault();
                const button = menuButtons.find((item) => item.dataset.gameMenu === menu.dataset.gameMenu);
                closeGameMenus();
                button?.focus();
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
            } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                switchGameMenu(menu.dataset.gameMenu, event.key === "ArrowRight" ? 1 : -1);
            } else {
                const item = menu.querySelector(`[data-access-key="${event.key.toLowerCase()}"]:not(:disabled)`);
                if (item) {
                    event.preventDefault();
                    item.click();
                }
            }
        });
        menu.addEventListener("click", (event) => {
            const item = event.target.closest("[data-game-action]");
            if (!item || item.disabled) return;
            switch (item.dataset.gameAction) {
                case "close": closeGameWindow(gameId); break;
                case "project": openProjectSettings(); break;
            }
            closeGameMenus();
        });
    });
    win.volumeSlider.addEventListener("input", (e) => setWindowVolume(win, e.target.value));

    syncWindowVolumeUI(win);
    updateFavoriteUI(win);
    updateMaximizeButton(win);
    wireDrag(win);
    wireResize(win);
};

const createSystemWindowContent = (shortcutId, win) => {
    const content = document.createElement("div");
    content.className = "explorer-content";

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
                    <p class="display-settings-note">This changes the simulated monitor preview; browser windows keep their actual size.</p>
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

    const taskTitles = {
        "__my-documents": "File and Folder Tasks",
        "__my-pictures": "Picture Tasks",
        "__my-music": "Music Tasks",
        "__my-computer": "System Tasks",
        "__recycle-bin": "Recycle Bin Tasks"
    };

    const sidebar = document.createElement("aside");
    sidebar.className = "explorer-sidebar";

    const tasksSection = document.createElement("section");
    const tasksTitle = document.createElement("h3");
    tasksTitle.textContent = taskTitles[shortcutId];
    tasksSection.appendChild(tasksTitle);

    if (shortcutId === "__recycle-bin") {
        const emptyBin = document.createElement("button");
        emptyBin.type = "button";
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
                "warning"
            ).then((yes) => {
                if (!yes) return;
                try {
                    fs.emptyRecycleBin();
                } catch (error) {
                    console.error(error);
                }
            });
        });

        const restoreAll = document.createElement("button");
        restoreAll.type = "button";
        restoreAll.textContent = "Restore all items";
        restoreAll.addEventListener("click", () => {
            fs.getChildren(fs.RECYCLE_BIN).forEach((node) => {
                try {
                    fs.restore(node.id);
                } catch (error) {
                    console.error(error);
                }
            });
        });

        tasksSection.append(emptyBin, restoreAll);
    } else {
        ["View system information", "Add or remove programs", "Change a setting"]
            .forEach((label) => {
                const button = document.createElement("button");
                button.type = "button";
                button.textContent = label;
                tasksSection.appendChild(button);
            });
    }

    const placesSection = document.createElement("section");
    placesSection.innerHTML = `
        <h3>Other Places</h3>
        <button type="button">My Network Places</button>
        <button type="button">My Documents</button>
        <button type="button">Control Panel</button>
    `;

    sidebar.append(tasksSection, placesSection);

    const main = document.createElement("main");
    main.className = "explorer-main";

    const heading = document.createElement("h2");
    main.appendChild(heading);

    const items = document.createElement("div");
    items.className = "explorer-items";
    main.appendChild(items);

    content.append(sidebar, main);
    renderExplorerItems(win, content);
    return content;
};

const wireDisplayProperties = (win) => {
    const content = win.el.querySelector(".display-properties-content");
    if (!content) return;

    let current = getDisplaySettings();
    let pending = { ...current };
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
        apply: content.querySelector('[data-display-action="apply"]')
    };
    const themes = {
        "windows-xp": { appearance: "blue", wallpaper: "bliss", backgroundColor: "#3a6ea5" },
        classic: { appearance: "silver", wallpaper: "blue", backgroundColor: "#4b6f8f" },
        olive: { appearance: "olive", wallpaper: "olive", backgroundColor: "#586b2f" }
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
        controls.resolutionValue.textContent = pending.resolution === "auto"
            ? `Current browser size: ${window.innerWidth} by ${window.innerHeight} pixels`
            : `${pending.resolution.replace("x", " by ")} pixels`;
        controls.apply.disabled = JSON.stringify(pending) === JSON.stringify(current);
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
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const target = event.key === "Home" ? tabs[0]
                : event.key === "End" ? tabs.at(-1)
                : tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
            showTab(target);
            target.focus();
        });
    });
    controls.theme.addEventListener("change", () => {
        pending = { ...pending, theme: controls.theme.value, customWallpaper: "", ...themes[controls.theme.value] };
        sync();
    });
    controls.wallpaper.addEventListener("change", () => {
        pending = { ...pending, wallpaper: controls.wallpaper.value, customWallpaper: "" };
        sync();
    });
    ["position", "appearance", "resolution", "saver"].forEach((name) => {
        controls[name].addEventListener("change", () => {
            pending = { ...pending, [name === "saver" ? "screenSaver" : name]: controls[name].value };
            sync();
        });
    });
    controls.color.addEventListener("input", () => {
        pending = { ...pending, backgroundColor: controls.color.value };
        sync();
    });
    controls.saverWait.addEventListener("change", () => {
        const wait = Math.min(60, Math.max(1, Number.parseInt(controls.saverWait.value, 10) || 1));
        pending = { ...pending, screenSaverWait: wait };
        sync();
    });
    controls.image.addEventListener("change", () => {
        const [file] = controls.image.files;
        if (!file) return;
        const supportedTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
        if (!supportedTypes.includes(file.type) || file.size > MAX_CUSTOM_WALLPAPER_BYTES) {
            controls.status.textContent = "Choose a PNG, JPEG, GIF, or WebP image smaller than 1 MB.";
            controls.image.value = "";
            return;
        }
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            if (typeof reader.result !== "string" || !reader.result.startsWith("data:image/")) return;
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
    content.querySelector('[data-display-action="apply"]').addEventListener("click", () => {
        if (!isDisplaySettings(pending)) return;
        if (!saveDisplaySettings(pending)) {
            controls.status.textContent = "Windows could not save this picture. Try a smaller image.";
            return;
        }
        current = { ...pending };
        applyDisplaySettings(current);
        controls.status.textContent = "Settings applied.";
        sync();
    });
    content.querySelector('[data-display-action="ok"]').addEventListener("click", () => {
        if (!controls.apply.disabled) controls.apply.click();
        if (controls.apply.disabled) closeGameWindow(win.gameId);
    });
    content.querySelector('[data-display-action="cancel"]').addEventListener("click", () => closeGameWindow(win.gameId));
    sync();
};

// ============================================
// Virtual Filesystem integration
// ============================================

const fs = window.VirtualFS;

const systemFolderShortcuts = {
    "__my-documents": () => fs.MY_DOCUMENTS,
    "__my-computer": () => fs.MY_COMPUTER,
    "__my-pictures": () => fs.MY_PICTURES,
    "__my-music": () => fs.MY_MUSIC,
    "__recycle-bin": () => fs.RECYCLE_BIN
};

const explorerDescriptions = {
    "__my-documents": "Files stored on this computer",
    "__my-computer": "Files Stored on This Computer",
    "__my-pictures": "Files stored in My Pictures",
    "__my-music": "Files stored in My Music"
};

const createExplorerIcon = (node) => {
    const icon = document.createElement("span");
    icon.className = "explorer-item-icon";

    if (node.id === fs.DRIVE_C) {
        icon.classList.add("drive-icon");
        return icon;
    }
    if (node.id === fs.DRIVE_D) {
        icon.classList.add("disc-icon");
        return icon;
    }
    if (node.type === "folder") {
        const image = document.createElement("img");
        image.src = "assets/xp/icons/mydocuments.png";
        image.alt = "";
        icon.appendChild(image);
        return icon;
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
    if (node.id === fs.DRIVE_C) return "Game files and Windows XP";
    if (node.id === fs.DRIVE_D) return "Flash Collection";
    if (node.type === "folder") return "File folder";
    if (node.app && gamesList[node.app]) return "Game";
    return `${(node.ext || "").replace(".", "").toUpperCase() || "File"} file`;
};

const openExplorerNode = (win, node) => {
    if (node.type === "folder") {
        win.currentFolderId = node.id;
        renderExplorerItems(win);
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

    const items = main.querySelector(".explorer-items");
    items.innerHTML = "";

    const children = fs.getChildren(folder.id)
        .slice()
        .sort((a, b) => (
            a.type === b.type
                ? a.name.localeCompare(b.name)
                : a.type === "folder" ? -1 : 1
        ));

    if (!children.length) {
        const empty = document.createElement("p");
        empty.className = "explorer-empty";
        empty.textContent = win.currentFolderId === fs.RECYCLE_BIN
            ? "The Recycle Bin is empty."
            : "There are no items to show in this view.";
        items.appendChild(empty);
        return;
    }

    children.forEach((node) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "explorer-item";
        item.title = node.name;

        const label = document.createElement("span");
        const name = document.createElement("b");
        name.textContent = node.name;
        const description = document.createElement("small");
        description.textContent = explorerItemDescription(node);
        label.append(name, description);

        item.append(createExplorerIcon(node), label);
        item.addEventListener("dblclick", () => openExplorerNode(win, node));
        item.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                openExplorerNode(win, node);
            }
        });
        items.appendChild(item);
    });
};

// Games participate in the filesystem as ".game" files on the Desktop,
// opened through the registered file association.
const syncGameFiles = () => {
    fs.getChildren(fs.DESKTOP)
        .filter((node) => node.ext === ".game" && !gamesList[node.app])
        .forEach((stale) => {
            try {
                fs.destroy(stale.id);
            } catch (error) {
                console.error(error);
            }
        });

    Object.keys(gamesList).forEach((gameId) => {
        const title = formatGameTitle(gameId);
        const existing = fs
            .getChildren(fs.DESKTOP)
            .find((node) => node.ext === ".game" && node.app === gameId);
        if (existing) {
            if (existing.name !== `${title}.game`) {
                try {
                    fs.rename(existing.id, `${title}.game`);
                } catch (error) {
                    console.error(error);
                }
            }
            return;
        }
        try {
            fs.createFile(fs.DESKTOP, `${title}.game`, { app: gameId });
        } catch (error) {
            console.error(error);
        }
    });
};

fs.registerFileType(".game", (file) => {
    if (file.app && gamesList[file.app]) {
        openGameWindow(file.app);
    }
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
});

const wireSystemWindowControls = (win) => {
    win.el.addEventListener("pointerdown", () => focusWindow(win.gameId));
    win.el.querySelector(".close-btn").addEventListener("click", () => closeGameWindow(win.gameId));
    win.el.querySelector(".minimize-btn").addEventListener("click", () => minimizeWindow(win.gameId));
    win.el.querySelector(".maximize-btn").addEventListener("click", () => toggleMaximize(win.gameId));
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
    el.querySelectorAll(".game-menu-bar, .game-menu, .window-toolbar")
        .forEach((node) => node.remove());
    el.style.width = `${Math.min(590, desktopWidth - 16)}px`;
    el.style.height = `${Math.min(410, desktopHeight - 16)}px`;
    el.style.left = `${Math.max(8, (desktopWidth - Math.min(590, desktopWidth - 16)) / 2)}px`;
    el.style.top = `${Math.max(8, (desktopHeight - Math.min(410, desktopHeight - 16)) / 2)}px`;
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
        maximizeBtn: el.querySelector(".maximize-btn"),
        favoriteBtn: null,
        volumeBtn: null,
        volumeSlider: null
    };
    openWindows.set(shortcutId, win);
    const content = el.querySelector(".window-content");
    content.replaceWith(createSystemWindowContent(shortcutId, win));
    wireSystemWindowControls(win);
    if (shortcutId === "__display-properties") wireDisplayProperties(win);
    focusWindow(shortcutId);
};

const openDesktopItem = (itemId) => {
    if (systemShortcuts[itemId]) {
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
    let winHeight = (winWidth / aspectRatio) + WINDOW_CHROME_HEIGHT;
    const maxHeight = availableHeight * 0.92;
    if (winHeight > maxHeight) {
        winHeight = maxHeight;
        winWidth = (winHeight - WINDOW_CHROME_HEIGHT) * aspectRatio;
    }
    winWidth = Math.min(Math.max(winWidth, minWidth), availableWidth);
    winHeight = Math.min(Math.max(winHeight, minHeight), availableHeight);

    const offset = (cascadeCount++ % 6) * 28;
    const left = Math.max(4, Math.min((desktopWidth - winWidth) / 2 + offset - 56, desktopWidth - winWidth - 4));
    const top = Math.max(4, Math.min((desktopHeight - winHeight) / 2 + offset - 40, desktopHeight - winHeight - 4));

    const el = createWindowElement(gameId);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.width = `${winWidth}px`;
    el.style.height = `${winHeight}px`;
    document.getElementById("desktop").appendChild(el);
    el.animate(
        [
            { transform: "scale(0.94)", opacity: 0.35 },
            { transform: "scale(1)", opacity: 1 }
        ],
        { duration: 145, easing: "ease-out" }
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
        volumeBtn: el.querySelector(".volume-btn"),
        volumeSlider: el.querySelector(".volume-slider")
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
            (event.key === "Enter" || event.key === " ")
            && document.activeElement?.matches("button:not(:disabled)")
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
    // Keep each task reachable: the final compact button opens a menu for
    // windows which cannot fit between the fixed Start button and tray.
    const capacity = Math.max(1, Math.floor(container.clientWidth / 94));
    const visible = windows.slice(0, windows.length > capacity ? capacity - 1 : capacity);
    const hidden = windows.slice(visible.length);
    container.innerHTML = "";

    const appendTaskButton = ([gameId, win]) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "task-button" + (gameId === focusedGameId && !win.minimized ? " active" : "");
        btn.dataset.game = gameId;
        btn.title = formatGameTitle(gameId);
        btn.setAttribute("aria-label", `${formatGameTitle(gameId)}${win.minimized ? ", minimized" : ""}`);
        btn.setAttribute("aria-pressed", String(gameId === focusedGameId && !win.minimized));

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
        overflow.className = "task-button task-button-grouped";
        overflow.textContent = `${hidden.length} more`;
        overflow.setAttribute("aria-label", `${hidden.length} more open windows`);
        overflow.setAttribute("aria-haspopup", "menu");
        overflow.addEventListener("click", () => {
            const menu = document.getElementById("taskbar-overflow-menu");
            menu.innerHTML = "";
            hidden.forEach(([gameId, win]) => {
                const item = document.createElement("button");
                item.type = "button";
                item.setAttribute("role", "menuitem");
                item.textContent = formatGameTitle(gameId);
                item.addEventListener("click", () => {
                    closeTaskbarMenus();
                    activateTaskButton(gameId);
                });
                menu.appendChild(item);
            });
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
                height: `${Math.max(240, height - Math.min(offset, 130))}px`
            });
        } else {
            const horizontal = mode === "tile-horizontal";
            const count = windows.length;
            Object.assign(win.el.style, horizontal ? {
                left: "0px", top: `${index * height / count}px`,
                width: `${width}px`, height: `${height / count}px`
            } : {
                left: `${index * width / count}px`, top: "0px",
                width: `${width / count}px`, height: `${height}px`
            });
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
    const dialog = XPDialogs.createDialog({ title: "Taskbar and Start Menu Properties" });
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = localStorage.getItem("taskbarLocked") === "true";
    input.addEventListener("change", () => localStorage.setItem("taskbarLocked", String(input.checked)));
    label.append(input, " Lock the taskbar");
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
        const lock = menu.querySelector('[data-taskbar-action="lock"]');
        lock.setAttribute("aria-checked", localStorage.getItem("taskbarLocked") === "true" ? "true" : "false");
        positionTaskbarMenu(menu, event.clientX, event.clientY);
    });
    menu.addEventListener("click", (event) => {
        const action = event.target.closest("[data-taskbar-action]")?.dataset.taskbarAction;
        if (!action || event.target.disabled) return;
        closeTaskbarMenus();
        if (action === "show-desktop") toggleShowDesktop();
        else if (action === "cascade" || action.startsWith("tile-")) arrangeTaskbarWindows(action);
        else if (action === "task-manager") openTaskManager();
        else if (action === "properties") openTaskbarProperties();
        else if (action === "lock") {
            const locked = localStorage.getItem("taskbarLocked") !== "true";
            localStorage.setItem("taskbarLocked", String(locked));
        }
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
            minute: "2-digit"
        });
        // XP tooltip: hovering the clock shows the full date.
        clock.title = now.toLocaleDateString([], {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
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
    isMuted: localStorage.getItem("isMuted") === "true"
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
            window.innerWidth - popup.offsetWidth - 4
        )
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
        title: "Local Area Connection Status"
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
        { id: "close", label: "Close", isDefault: true, isCancel: true }
    ]);

    let sent = Math.floor(1000 + Math.random() * 9000);
    let received = Math.floor(sent * (1.4 + Math.random()));
    const tick = () => {
        sent += Math.floor(Math.random() * 40);
        received += Math.floor(Math.random() * 60);
        cells["network-status-duration"].textContent =
            formatDuration(Date.now() - networkConnectedAt);
        cells["network-status-sent"].textContent = sent.toLocaleString("en-US");
        cells["network-status-received"].textContent =
            received.toLocaleString("en-US");
    };
    tick();
    const timer = setInterval(tick, 1000);
    dialog.onResult(() => clearInterval(timer));
};

const setOfflineModeEnabled = async (enabled) => {
    if (!("serviceWorker" in navigator)) {
        throw new Error("Offline mode is not supported by this browser.");
    }

    if (enabled) {
        await navigator.serviceWorker.register("sw.js");
        localStorage.setItem("offlineModeEnabled", "true");
        return;
    }

    const registration = await navigator.serviceWorker.getRegistration("./");
    if (registration) await registration.unregister();
    if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames
                .filter((name) => name.startsWith("astro-flash"))
                .map((name) => caches.delete(name))
        );
    }
    localStorage.setItem("offlineModeEnabled", "false");
};

const initializeOfflineMode = () => {
    if (localStorage.getItem("offlineModeEnabled") !== "true") return;
    setOfflineModeEnabled(true).catch((error) => {
        console.error("Offline mode initialization failed:", error);
    });
};

const openProjectSettings = () => {
    const dialog = XPDialogs.createDialog({
        title: "Astro Flash Collection"
    });

    const heading = document.createElement("h2");
    heading.className = "project-settings-title";
    heading.textContent = "Astro Flash Collection";

    const details = document.createElement("dl");
    details.className = "dlg-props-table";
    const addDetail = (label, value) => {
        const term = document.createElement("dt");
        term.textContent = label;
        const description = document.createElement("dd");
        description.textContent = value;
        details.append(term, description);
    };
    addDetail("Version:", APP_VERSION);
    addDetail("Installed games:", String(Object.keys(gamesList).length));
    addDetail("Connection:", navigator.onLine ? "Online" : "Offline");
    addDetail(
        "Service worker:",
        "serviceWorker" in navigator ? "Supported" : "Unavailable"
    );

    const offlineLabel = document.createElement("label");
    offlineLabel.className = "project-offline-setting";
    const offlineToggle = document.createElement("input");
    offlineToggle.type = "checkbox";
    offlineToggle.checked =
        localStorage.getItem("offlineModeEnabled") === "true";
    offlineToggle.disabled = !("serviceWorker" in navigator);
    offlineLabel.append(offlineToggle, " Enable Offline Mode");

    const status = document.createElement("p");
    status.className = "project-settings-status";
    status.textContent = offlineToggle.checked
        ? "Offline caching is enabled."
        : "Offline caching is disabled.";

    offlineToggle.addEventListener("change", async () => {
        offlineToggle.disabled = true;
        status.textContent = offlineToggle.checked
            ? "Enabling offline caching..."
            : "Disabling offline caching...";
        try {
            await setOfflineModeEnabled(offlineToggle.checked);
            status.textContent = offlineToggle.checked
                ? "Offline caching is enabled."
                : "Offline caching is disabled.";
        } catch (error) {
            offlineToggle.checked = !offlineToggle.checked;
            status.textContent = error.message;
        } finally {
            offlineToggle.disabled = !("serviceWorker" in navigator);
        }
    });

    const suggestions = document.createElement("a");
    suggestions.className = "project-suggestions-link";
    suggestions.href = "https://github.com/astrovm/flash/issues";
    suggestions.target = "_blank";
    suggestions.rel = "noopener noreferrer";
    suggestions.textContent = "Send suggestions or report a problem";

    dialog.body.append(heading, details, offlineLabel, status, suggestions);
    XPDialogs.addButtonRow(dialog, [
        { id: "close", label: "Close", isDefault: true, isCancel: true }
    ]);
};

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

const openDateTimeProperties = () => {
    const dialog = XPDialogs.createDialog({
        title: "Date and Time Properties",
        wide: true
    });

    const shellNow = getShellTime();
    const state = {
        year: shellNow.getFullYear(),
        month: shellNow.getMonth(),
        day: shellNow.getDate()
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
        "dlg-time-hour", "Hour", 1, 12, hour24 % 12 || 12
    );
    const minuteInput = makeTimeInput(
        "dlg-time-minute", "Minute", 0, 59, shellNow.getMinutes()
    );
    const secondInput = makeTimeInput(
        "dlg-time-second", "Second", 0, 59, shellNow.getSeconds()
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
    timeRow.append(hourInput, colon1, minuteInput, colon2, secondInput, ampmSelect);
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
                day === today.getDate()
                && state.month === today.getMonth()
                && state.year === today.getFullYear()
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
            new Date(state.year, state.month + 1, 0).getDate()
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
            new Date(state.year, state.month + 1, 0).getDate()
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
            state.year, state.month, state.day, hours, minutes, seconds
        );
        localStorage.setItem(
            CLOCK_OFFSET_KEY,
            String(chosen.getTime() - Date.now())
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
        }
    );
    const cancelButton = XPDialogs.createDialogButton(
        { id: "cancel", label: "Cancel" },
        () => dialog.close(null)
    );
    const applyButton = XPDialogs.createDialogButton(
        { id: "apply", label: "Apply" },
        applyDateTime
    );
    row.append(okButton, cancelButton, applyButton);
    dialog.body.appendChild(row);
    dialog.defaultButton = okButton;

    renderCalendar();
    okButton.focus();
};

const setupSystemTray = () => {
    document.getElementById("tray-volume-button")
        .addEventListener("click", toggleTrayVolumePopup);
    document.getElementById("tray-network-button")
        .addEventListener("click", openNetworkStatus);
    document.getElementById("taskbar-clock")
        .addEventListener("click", openDateTimeProperties);

    document.getElementById("tray-volume-slider")
        .addEventListener("input", (event) => {
            const volume = parseInt(event.target.value, 10);
            if (Number.isFinite(volume)) {
                // Moving the XP volume slider clears the mute flag.
                setMasterVolume(volume, false);
            }
        });
    document.getElementById("tray-mute-checkbox")
        .addEventListener("change", (event) => {
            setMasterVolume(getMasterVolume().volume, event.target.checked);
        });

    syncTrayVolumeUI();
};

// ============================================
// Desktop Icons
// ============================================

const DESKTOP_ICON_WIDTH = 76;
const DESKTOP_ICON_HEIGHT = 74;
const DESKTOP_ICON_GAP = 6;
const DESKTOP_ICON_MARGIN = 8;
let desktopDragged = false;

const getDesktopIconPositions = () => (
    readJsonStorage(
        "desktopIconPositions",
        {},
        (positions) => positions && typeof positions === "object"
    )
);

const saveDesktopIconPosition = (icon) => {
    const positions = getDesktopIconPositions();
    positions[icon.dataset.game] = {
        left: icon.offsetLeft,
        top: icon.offsetTop
    };
    writeJsonStorage("desktopIconPositions", positions);
};

const selectDesktopIcon = (gameId, additive = false) => {
    document.querySelectorAll(".desktop-icon").forEach((el) => {
        const shouldSelect = el.dataset.game === gameId;
        el.classList.toggle(
            "selected",
            additive ? el.classList.contains("selected") || shouldSelect : shouldSelect
        );
    });
};

const clearDesktopSelection = () => {
    document.querySelectorAll(".desktop-icon.selected").forEach((icon) => {
        icon.classList.remove("selected");
    });
};

const layoutDesktopIcons = (force = false) => {
    const container = document.getElementById("desktop-icons");
    if (!container) return;

    const positions = force ? {} : getDesktopIconPositions();
    const usableHeight = Math.max(container.clientHeight - DESKTOP_ICON_MARGIN * 2, DESKTOP_ICON_HEIGHT);
    const rows = Math.max(1, Math.floor(usableHeight / (DESKTOP_ICON_HEIGHT + DESKTOP_ICON_GAP)));

    Array.from(container.querySelectorAll(".desktop-icon")).forEach((icon, index) => {
        const saved = positions[icon.dataset.game];
        let fallbackLeft = DESKTOP_ICON_MARGIN
            + Math.floor(index / rows) * (DESKTOP_ICON_WIDTH + DESKTOP_ICON_GAP);
        let fallbackTop = DESKTOP_ICON_MARGIN
            + (index % rows) * (DESKTOP_ICON_HEIGHT + DESKTOP_ICON_GAP);
        // The Recycle Bin anchors to the bottom-right corner unless the
        // user has dragged it somewhere else.
        if (icon.dataset.game === "__recycle-bin") {
            fallbackLeft = container.clientWidth - DESKTOP_ICON_WIDTH - DESKTOP_ICON_MARGIN;
            fallbackTop = container.clientHeight - DESKTOP_ICON_HEIGHT - DESKTOP_ICON_MARGIN;
        }
        const left = saved?.left ?? fallbackLeft;
        const top = saved?.top ?? fallbackTop;
        icon.style.left = `${Math.max(0, Math.min(left, container.clientWidth - DESKTOP_ICON_WIDTH))}px`;
        icon.style.top = `${Math.max(0, Math.min(top, container.clientHeight - DESKTOP_ICON_HEIGHT))}px`;
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
            selectDesktopIcon(icon.dataset.game, additive);
        }

        const startX = event.clientX;
        const startY = event.clientY;
        const startLeft = icon.offsetLeft;
        const startTop = icon.offsetTop;
        desktopDragged = false;

        const onMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;
            if (!desktopDragged && Math.hypot(deltaX, deltaY) < 4) return;

            desktopDragged = true;
            const container = document.getElementById("desktop-icons");
            const left = Math.max(
                0,
                Math.min(startLeft + deltaX, container.clientWidth - icon.offsetWidth)
            );
            const top = Math.max(
                0,
                Math.min(startTop + deltaY, container.clientHeight - icon.offsetHeight)
            );
            icon.style.left = `${left}px`;
            icon.style.top = `${top}px`;
        };

        const onUp = () => {
            icon.removeEventListener("pointermove", onMove);
            icon.removeEventListener("pointerup", onUp);
            icon.removeEventListener("pointercancel", onUp);
            if (desktopDragged) {
                saveDesktopIconPosition(icon);
            }
        };

        try {
            icon.setPointerCapture(event.pointerId);
        } catch (error) { /* pointer capture unsupported */ }

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
            Array.from(document.querySelectorAll(".desktop-icon.selected"))
                .map((icon) => icon.dataset.game)
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
            const currentX = Math.max(0, Math.min(moveEvent.clientX - bounds.left, bounds.width));
            const currentY = Math.max(0, Math.min(moveEvent.clientY - bounds.top, bounds.height));
            const left = Math.min(startX, currentX);
            const top = Math.min(startY, currentY);
            const width = Math.abs(currentX - startX);
            const height = Math.abs(currentY - startY);

            Object.assign(rectangle.style, {
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
                height: `${height}px`
            });

            document.querySelectorAll(".desktop-icon").forEach((icon) => {
                const intersects = (
                    icon.offsetLeft < left + width
                    && icon.offsetLeft + icon.offsetWidth > left
                    && icon.offsetTop < top + height
                    && icon.offsetTop + icon.offsetHeight > top
                );
                icon.classList.toggle(
                    "selected",
                    intersects || (additive && initialSelection.has(icon.dataset.game))
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
        } catch (error) { /* pointer capture unsupported */ }

        container.addEventListener("pointermove", onMove);
        container.addEventListener("pointerup", onUp);
        container.addEventListener("pointercancel", onUp);
        event.preventDefault();
    });
};

const buildDesktopIcons = () => {
    if (iconsBuilt) return;
    iconsBuilt = true;

    const container = document.getElementById("desktop-icons");
    const sortedGames = Object.keys(gamesList).sort((a, b) =>
        formatGameTitle(a).localeCompare(formatGameTitle(b))
    );
    // Windows XP order: My Computer first, My Documents next, then the
    // games; the Recycle Bin comes last and anchors to the corner.
    const desktopItems = [
        ...["__my-computer", "__my-documents"]
            .filter((id) => systemShortcuts[id]?.desktop !== false),
        ...sortedGames,
        ...["__recycle-bin"]
            .filter((id) => systemShortcuts[id]?.desktop !== false)
    ];

    desktopItems.forEach((gameId) => {
        const icon = document.createElement("button");
        icon.type = "button";
        icon.className = "desktop-icon";
        icon.dataset.game = gameId;

        const glyph = createGameIconElement(gameId, "icon-glyph");

        const label = document.createElement("span");
        label.className = "icon-label";
        label.textContent = formatGameTitle(gameId);

        icon.append(glyph, label);
        icon.addEventListener("click", (event) => {
            if (!desktopDragged) {
                selectDesktopIcon(gameId, event.ctrlKey || event.metaKey);
            }
        });
        icon.addEventListener("dblclick", () => {
            if (!desktopDragged) {
                openDesktopItem(gameId);
            }
        });
        icon.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                openDesktopItem(gameId);
            }
        });
        wireDesktopIconDrag(icon);
        container.appendChild(icon);
    });

    wireDesktopSelectionRectangle();
    requestAnimationFrame(() => layoutDesktopIcons());
};

const closeDesktopContextMenu = () => {
    const menu = document.getElementById("desktop-context-menu");
    if (menu) menu.hidden = true;
};

const openDesktopContextMenu = (clientX, clientY) => {
    const desktop = document.getElementById("desktop");
    const menu = document.getElementById("desktop-context-menu");
    const bounds = desktop.getBoundingClientRect();

    closeStartMenu();
    menu.hidden = false;
    menu.style.left = "0";
    menu.style.top = "0";

    const left = Math.max(
        0,
        Math.min(clientX - bounds.left, bounds.width - menu.offsetWidth - 2)
    );
    const top = Math.max(
        0,
        Math.min(clientY - bounds.top, bounds.height - menu.offsetHeight - 2)
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
        if (!event.target.closest(".desktop-icon")) {
            clearDesktopSelection();
        }
        openDesktopContextMenu(event.clientX, event.clientY);
    });

    menu.addEventListener("click", (event) => {
        const action = event.target.closest("[data-action]")?.dataset.action;
        if (!action) return;

        if (action === "arrange") {
            layoutDesktopIcons(true);
            playXPSound("logon");
        } else if (action === "refresh") {
            const icons = document.getElementById("desktop-icons");
            icons.classList.remove("desktop-refresh");
            requestAnimationFrame(() => icons.classList.add("desktop-refresh"));
        } else if (action === "properties") {
            openSystemWindow("__display-properties");
        }
        closeDesktopContextMenu();
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

const buildProgramsList = (filter) => {
    const container = document.getElementById("start-menu-programs");
    container.innerHTML = "";

    const query = filter.trim().toLowerCase();

    // Flat search results
    if (query) {
        const matches = Object.keys(gamesList)
            .filter((gameId) => formatGameTitle(gameId).toLowerCase().includes(query))
            .sort((a, b) => formatGameTitle(a).localeCompare(formatGameTitle(b)));

        if (matches.length === 0) {
            const empty = document.createElement("div");
            empty.className = "sm-empty";
            empty.textContent = "No games found";
            container.appendChild(empty);
            return;
        }
        matches.forEach((gameId) => container.appendChild(createMenuGameItem(gameId)));
        return;
    }

    // Grouped categories
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

    const orderedCategories = Object.keys(groups).sort((catA, catB) => {
        if (catA === "Recently Played") return -1;
        if (catB === "Recently Played") return 1;
        if (catA === "Favorites") return -1;
        if (catB === "Favorites") return 1;
        return catA.localeCompare(catB);
    });

    orderedCategories.forEach((category, index) => {
        const group = document.createElement("div");
        group.className = "sm-category" + (index === 0 ? " open" : "");

        const header = document.createElement("button");
        header.type = "button";
        header.className = "sm-category-header";

        const icon = document.createElement("span");
        icon.className = "sm-cat-icon";
        icon.textContent = categoryIcons[category] || categoryIcons["Other"];

        const name = document.createElement("span");
        name.textContent = category;

        const count = document.createElement("span");
        count.className = "sm-cat-count";
        count.textContent = groups[category].length;

        header.append(icon, name, count);
        header.addEventListener("click", () => group.classList.toggle("open"));

        const list = document.createElement("div");
        list.className = "sm-games";
        groups[category]
            .sort((a, b) => formatGameTitle(a).localeCompare(formatGameTitle(b)))
            .forEach((gameId) => list.appendChild(createMenuGameItem(gameId)));

        group.append(header, list);
        container.appendChild(group);
    });
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
        { id: "close", label: "Close", isDefault: true, isCancel: true }
    ]);
};

const openControlPanel = () => {
    const dialog = XPDialogs.createDialog({ title: "Control Panel" });
    const heading = document.createElement("p");
    heading.textContent = "Pick a category to change a setting.";
    const list = document.createElement("div");
    list.className = "shell-dialog-list";
    [
        ["Display", () => openSystemWindow("__display-properties")],
        ["Date and Time", openDateTimeProperties],
        ["Astro Flash Settings", openProjectSettings]
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
        { id: "close", label: "Close", isDefault: true, isCancel: true }
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
                icon: "info"
            });
        }
    );
    dialog.body.append(message, addPrinter);
    XPDialogs.addButtonRow(dialog, [
        { id: "close", label: "Close", isDefault: true, isCancel: true }
    ]);
};

const openHelpAndSupport = () => {
    const dialog = XPDialogs.createDialog({ title: "Help and Support Center", wide: true });
    const heading = document.createElement("h2");
    heading.textContent = "Astro Flash Help and Support";
    const help = document.createElement("p");
    help.textContent = "Open games from the desktop or Start menu. Use F11 for full screen, and the taskbar to switch between open windows.";
    const support = document.createElement("a");
    support.href = "https://github.com/astrovm/flash/issues";
    support.target = "_blank";
    support.rel = "noopener noreferrer";
    support.textContent = "Get support or send feedback";
    dialog.body.append(heading, help, support);
    XPDialogs.addButtonRow(dialog, [
        { id: "close", label: "Close", isDefault: true, isCancel: true }
    ]);
};

const openSearchDialog = () => {
    const dialog = XPDialogs.createDialog({ title: "Search Results" });
    const prompt = document.createElement("label");
    prompt.textContent = "Search for a game:";
    const input = document.createElement("input");
    input.type = "search";
    input.className = "shell-dialog-input";
    prompt.appendChild(input);
    const results = document.createElement("div");
    results.className = "shell-dialog-list";
    const render = () => {
        const query = input.value.trim().toLowerCase();
        results.replaceChildren();
        Object.keys(gamesList)
            .filter((gameId) => formatGameTitle(gameId).toLowerCase().includes(query))
            .sort((a, b) => formatGameTitle(a).localeCompare(formatGameTitle(b)))
            .forEach((gameId) => {
                const item = document.createElement("button");
                item.type = "button";
                item.textContent = formatGameTitle(gameId);
                item.addEventListener("click", () => {
                    dialog.close();
                    openGameWindow(gameId);
                });
                results.appendChild(item);
            });
        if (!results.childElementCount) results.textContent = "No games found.";
    };
    input.addEventListener("input", render);
    dialog.body.append(prompt, results);
    render();
    XPDialogs.addButtonRow(dialog, [
        { id: "close", label: "Close", isDefault: true, isCancel: true }
    ]);
    input.focus();
};

const openRunDialog = () => {
    const dialog = XPDialogs.createDialog({ title: "Run" });
    const prompt = document.createElement("label");
    prompt.textContent = "Type the name of a program, folder, or document.";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "shell-dialog-input";
    prompt.appendChild(input);
    const status = document.createElement("p");
    const run = () => {
        const command = input.value.trim().toLowerCase();
        const locations = {
            "my documents": () => openSystemWindow("__my-documents"),
            "my pictures": () => openSystemWindow("__my-pictures"),
            "my music": () => openSystemWindow("__my-music"),
            "my computer": () => openSystemWindow("__my-computer"),
            "control panel": openControlPanel,
            "printers": openPrintersAndFaxes,
            "help": openHelpAndSupport
        };
        const gameId = Object.keys(gamesList).find((id) => (
            id.toLowerCase() === command
            || formatGameTitle(id).toLowerCase() === command
        ));
        const action = gameId ? () => openGameWindow(gameId) : locations[command];
        if (!action) {
            status.textContent = `Windows cannot find '${input.value}'.`;
            return;
        }
        dialog.close();
        action();
    };
    const runButton = XPDialogs.createDialogButton({ id: "run", label: "&OK" }, run);
    dialog.body.append(prompt, status, runButton);
    XPDialogs.addButtonRow(dialog, [
        { id: "cancel", label: "Cancel", isCancel: true }
    ]);
    dialog.defaultButton = runButton;
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
    settings: openProjectSettings,
    search: openSearchDialog,
    run: openRunDialog
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
            `[data-access-key="${event.key.toLowerCase()}"]`
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
    ].forEach(([id, label, icon]) => container.appendChild(createPlace({ id, label, icon })));

    const separatorOne = document.createElement("div");
    separatorOne.className = "sm-place-separator";
    container.appendChild(separatorOne);

    [
        ["controlPanel", "&Control Panel", "ControlPanel.png"],
        ["printers", "&Printers and Faxes", "PrintersandFaxes.png"],
        ["help", "&Help and Support", "HelpandSupport.png"],
    ].forEach(([id, label, icon]) => container.appendChild(createPlace({ id, label, icon })));

    const settings = createPlace({ id: "settings", label: "Astro Flash Settings", icon: "ControlPanel.png" });
    container.appendChild(settings);

    [
        ["search", "&Search", "Search.png"],
        ["run", "&Run...", "Run.png"],
    ].forEach(([id, label, icon]) => container.appendChild(createPlace({ id, label, icon })));

};

const buildPinnedPrograms = () => {
    const container = document.getElementById("start-menu-pinned");
    container.innerHTML = "";

    const gameStats = getGameStats();
    const recentGames = Object.entries(gameStats)
        .filter(([gameId]) => gamesList[gameId])
        .sort((a, b) => b[1].lastPlayed - a[1].lastPlayed)
        .map(([gameId]) => gameId);

    const pinned = [
        ...getFavorites().filter((gameId) => gamesList[gameId]),
        ...recentGames,
        ...Object.keys(gamesList).sort((a, b) =>
            formatGameTitle(a).localeCompare(formatGameTitle(b))
        ),
    ].filter((gameId, index, all) => all.indexOf(gameId) === index).slice(0, 6);

    pinned.forEach((gameId) => container.appendChild(createMenuGameItem(gameId)));
};

const openAllPrograms = () => {
    const panel = document.getElementById("all-programs-panel");
    const button = document.getElementById("all-programs-button");
    panel.hidden = false;
    button.classList.add("active");
    buildProgramsList(document.getElementById("game-search").value);
};

const closeAllPrograms = () => {
    document.getElementById("all-programs-panel").hidden = true;
    document.getElementById("all-programs-button").classList.remove("active");
};

const toggleAllPrograms = () => {
    if (document.getElementById("all-programs-panel").hidden) {
        openAllPrograms();
    } else {
        closeAllPrograms();
    }
};

const openStartMenu = () => {
    const searchInput = document.getElementById("game-search");
    searchInput.value = "";
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
    const searchInput = document.getElementById("game-search");
    searchInput.addEventListener("input", (e) => {
        buildProgramsList(e.target.value);
    });
    document.getElementById("all-programs-button")
        .addEventListener("click", toggleAllPrograms);
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
    ]
        .forEach((id) => {
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
    startupSoundPending = true;
    clearTimeout(bootTimeout);
    bootTimeout = setTimeout(() => showWelcomeScreen(true), BOOT_DURATION_MS);
};

const showWelcomeScreen = (autoLogin = false) => {
    setSuspended(false);
    hideSystemDialogs();
    clearTimeout(bootTimeout);
    muteAllWindows();
    document.getElementById("welcome-screen").classList.toggle(
        "auto-login",
        autoLogin,
    );
    setScreen("welcome-screen");
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
    Array.from(openWindows.keys()).forEach(closeGameWindow);
    focusedGameId = null;
    zIndexCounter = 100;
    cascadeCount = 0;
    loggedIn = false;
    history.replaceState(null, "", window.location.pathname + window.location.search);
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

const login = (playSound = true) => {
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
        initializeOfflineMode();
        setupScreenSaver();
        startClock();

        // Deep link: #game-id opens that game's window
        const gameId = getHashGameId();
        if (gameId) {
            openGameWindow(gameId);
        }
    }
    scheduleScreenSaver();
};

const setupScreenFlow = () => {
    document.getElementById("boot-screen").addEventListener(
        "click",
        () => showWelcomeScreen(true),
    );
    document.getElementById("login-user").addEventListener("click", () => login());
    document.getElementById("turn-off-screen").addEventListener("click", showBootScreen);

    document.getElementById("welcome-turn-off").addEventListener("click", () => {
        showShutdownDialog();
    });

    document.getElementById("log-off-button").addEventListener("click", () => {
        showLogoffDialog();
    });

    document.getElementById("turn-off-button").addEventListener("click", () => {
        showShutdownDialog();
    });

    document.getElementById("logoff-cancel")
        .addEventListener("click", hideSystemDialogs);
    document.getElementById("shutdown-cancel")
        .addEventListener("click", hideSystemDialogs);
    document.getElementById("switch-user-confirm")
        .addEventListener("click", switchUser);
    document.getElementById("logoff-confirm")
        .addEventListener("click", logOff);
    document.getElementById("shutdown-confirm")
        .addEventListener("click", turnOff);
    document.getElementById("restart-confirm")
        .addEventListener("click", restart);
    document.getElementById("standby-confirm")
        .addEventListener("click", () => {
            hideSystemDialogs();
            setSuspended(true);
        });
    document.getElementById("standby-resume")
        .addEventListener("click", () => setSuspended(false));

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
        if (
            spoofHostname === hostname
            || game.externalHosts?.includes(hostname)
        ) {
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
    Object.defineProperty(response, "url", { value: request.url });
    return response;
};

const { fetch: originalFetch } = window;
window.fetch = async (...args) => {
    const originalRequest = args[0];
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

window.addEventListener("load", () => {
    setupScreenFlow();
    setupDesktopContextMenu();
    setupWindowSystemMenu();
    setupTaskbarContextMenu();
    setupSystemTray();
    document.getElementById("start-button").addEventListener("click", toggleStartMenu);
});

window.addEventListener("resize", () => {
    closeTrayVolumePopup();
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
    if (!e.target.closest("#desktop-context-menu")) {
        closeDesktopContextMenu();
    }

    if (!e.target.closest("#window-system-menu") && !e.target.closest(".title-icon")) {
        closeWindowSystemMenu();
    }

    if (!e.target.closest("#taskbar-context-menu") && !e.target.closest("#taskbar-overflow-menu") && !e.target.closest(".task-button")) {
        closeTaskbarMenus();
    }

    if (!e.target.closest("#tray-volume-popup") && !e.target.closest("#tray-volume-button")) {
        closeTrayVolumePopup();
    }

    if (!e.target.closest(".game-menu-bar") && !e.target.closest(".game-menu")) {
        document.querySelectorAll(".game-menu:not([hidden])").forEach((menu) => {
            menu.hidden = true;
            menu.parentElement?.querySelector(`.game-menu-button[data-game-menu="${menu.dataset.gameMenu}"]`)
                ?.setAttribute("aria-expanded", "false");
        });
    }

    const startMenu = document.getElementById("start-menu");
    if (startMenu.hidden) return;
    if (!e.target.closest("#start-menu") && !e.target.closest("#start-button")) {
        closeStartMenu();
    }
});

document.addEventListener("keydown", (e) => {
    if (suspended) {
        if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
            e.preventDefault();
            setSuspended(false);
        }
        return;
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
    if (taskButton && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
        const buttons = [...document.querySelectorAll("#task-buttons .task-button")];
        const current = buttons.indexOf(taskButton);
        const target = e.key === "Home" ? buttons[0]
            : e.key === "End" ? buttons.at(-1)
            : buttons[(current + (e.key === "ArrowLeft" ? -1 : 1) + buttons.length) % buttons.length];
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
