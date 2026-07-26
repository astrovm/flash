"use strict";

// Constants
const MAX_OPEN_WINDOWS = 4;
const DEFAULT_ASPECT_RATIO = 4 / 3;
const WINDOW_CHROME_HEIGHT = 58; // title bar + toolbar
const MIN_WINDOW_WIDTH = 340;
const MIN_WINDOW_HEIGHT = 240;
const BOOT_DURATION_MS = 2600;

let bootTimeout = null;
let loggedIn = false;
let iconsBuilt = false;
let placesBuilt = false;
let offlineInitialized = false;

const gamesList = {
    "big-truck-adventures": {
        type: "swf",
        frameRate: 45,
        category: "Racing"
    },
    "big-truck-adventures-2": {
        type: "swf",
        frameRate: 45,
        category: "Racing"
    },
    "bike-mania": {
        type: "swf",
        frameRate: 60,
        category: "Racing"
    },
    "bike-mania-2": {
        type: "swf",
        frameRate: 60,
        category: "Racing"
    },
    "bike-mania-3": {
        type: "swf",
        frameRate: 60,
        category: "Racing"
    },
    "bike-mania-4": {
        type: "swf",
        frameRate: 60,
        category: "Racing"
    },
    "bike-mania-5": {
        type: "swf",
        frameRate: 60,
        category: "Racing"
    },
    "bike-mania-arena": {
        type: "swf",
        frameRate: 60,
        category: "Racing"
    },
    "bike-mania-arena-2": {
        type: "swf",
        frameRate: 60,
        category: "Racing"
    },
    "bike-mania-arena-3": {
        type: "swf",
        frameRate: 60,
        category: "Racing"
    },
    "bike-mania-arena-4": {
        type: "swf",
        frameRate: 60,
        category: "Racing"
    },
    "bike-mania-arena-5": {
        type: "swf",
        frameRate: 60,
        category: "Racing"
    },
    "dirt-bike": {
        type: "swf",
        category: "Racing"
    },
    "dirt-bike-2": {
        type: "swf",
        category: "Racing"
    },
    "dirt-bike-3": {
        type: "swf",
        category: "Racing"
    },
    "stunt-dirt-bike": {
        type: "swf",
        category: "Racing"
    },
    "captain-usa": {
        type: "swf",
        category: "Action"
    },
    "dark-cut": {
        type: "swf",
        category: "Action"
    },
    "metal-slug-brutal": {
        type: "swf",
        category: "Action"
    },
    "simpsons-wrecking-ball": {
        type: "swf",
        externalHosts: ["files.gamezhero.com"],
        category: "Action"
    },
    "super-smash-flash": {
        type: "swf",
        category: "Action"
    },
    "ultimate-flash-sonic": {
        type: "swf",
        category: "Action"
    },
    "inside-the-firewall": {
        aspectRatio: 480 / 360,
        type: "iframe",
        category: "Adventure"
    },
    "knd-operation-startup": {
        type: "swf",
        frameRate: 30,
        category: "Adventure"
    },
    "knd-operation-startup-final": {
        type: "swf",
        frameRate: 30,
        category: "Adventure"
    },
    "la-isla-de-lo-mono": {
        type: "swf",
        category: "Adventure"
    },
    "dexter-runaway-robot": {
        type: "swf",
        category: "Adventure"
    },
    "riddle-school": {
        type: "swf",
        category: "Adventure"
    },
    "riddle-school-2": {
        type: "swf",
        category: "Adventure"
    },
    "portal-flash": {
        type: "swf",
        category: "Puzzle"
    },
    "do-not-press": {
        type: "swf",
        category: "Puzzle"
    },
    "doom": {
        aspectRatio: 4 / 3,
        type: "iframe",
        category: "Action"
    },
    "sugar-sugar": {
        type: "swf",
        spoofUrl: "https://www.friv.com/z/games/sugarsugar",
        category: "Puzzle"
    },
    "learn-to-fly": {
        type: "swf",
        category: "Arcade"
    },
    "learn-to-fly-2": {
        type: "swf",
        category: "Arcade"
    },
    "learn-to-fly-3": {
        type: "swf",
        category: "Arcade"
    },
    "whack-a-kass": {
        type: "swf",
        category: "Arcade"
    },
    "eds-candy-machine": {
        type: "swf",
        category: "Arcade"
    },
    "knd-numbuh-generator": {
        type: "swf",
        frameRate: 45,
        category: "Misc"
    }
};

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

// ============================================
// Helper Functions
// ============================================

const formatGameTitle = (gameId) => (
    gameId
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
);

const getGameIcon = (gameId) => (
    categoryIcons[gamesList[gameId]?.category] || categoryIcons["Other"]
);

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
        }, '*');
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
    const { volume, isMuted } = getGameVolume(win.gameId);
    const numericVolume = Number.isFinite(volume) ? volume : 100;
    win.volumeBtn.textContent = (isMuted || numericVolume === 0) ? '🔈' : '🔊';
    win.volumeSlider.value = isMuted ? 0 : numericVolume;
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
    win.favoriteBtn.classList.toggle('active', getFavorites().includes(win.gameId));
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
        win.lastOpened = timestamp;
    }
};

const createWindowElement = (gameId) => {
    const win = document.createElement("div");
    win.className = "xp-window";
    win.dataset.game = gameId;

    const titleBar = document.createElement("div");
    titleBar.className = "title-bar";

    const titleIcon = document.createElement("span");
    titleIcon.className = "title-icon";
    titleIcon.textContent = getGameIcon(gameId);

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

    const toolbar = document.createElement("div");
    toolbar.className = "window-toolbar";

    const fullscreenBtn = document.createElement("button");
    fullscreenBtn.type = "button";
    fullscreenBtn.className = "toolbar-btn fullscreen-btn";
    fullscreenBtn.title = "Fullscreen";
    fullscreenBtn.textContent = "⛶";

    const favoriteBtn = document.createElement("button");
    favoriteBtn.type = "button";
    favoriteBtn.className = "toolbar-btn favorite-btn";
    favoriteBtn.title = "Favorite";
    favoriteBtn.textContent = "★";

    const separator = document.createElement("span");
    separator.className = "toolbar-separator";

    const volumeBtn = document.createElement("button");
    volumeBtn.type = "button";
    volumeBtn.className = "toolbar-btn volume-btn";
    volumeBtn.title = "Mute";
    volumeBtn.textContent = "🔊";

    const volumeSlider = document.createElement("input");
    volumeSlider.type = "range";
    volumeSlider.className = "volume-slider";
    volumeSlider.min = "0";
    volumeSlider.max = "100";
    volumeSlider.value = "100";

    toolbar.append(fullscreenBtn, favoriteBtn, separator, volumeBtn, volumeSlider);

    const content = document.createElement("div");
    content.className = "window-content";

    const resizeHandle = document.createElement("div");
    resizeHandle.className = "resize-handle";

    win.append(titleBar, toolbar, content, resizeHandle);
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
    player.setAttribute("id", "player");
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
    player.setAttribute("id", "player");
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
    win.zIndex = ++zIndexCounter;
    win.el.style.zIndex = win.zIndex;

    openWindows.forEach((w, id) => {
        w.el.classList.toggle("active", id === gameId);
    });

    applyFocusVolumes();
    syncWindowVolumeUI(win);
    renderTaskButtons();
    updateDocumentTitle();

    if (window.location.hash !== `#${gameId}`) {
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
    win.el.style.display = "none";

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

    bar.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 || e.target.closest(".title-buttons")) return;

        if (win.maximized) {
            // Restore the window under the cursor before dragging
            const ratio = e.clientX / window.innerWidth;
            toggleMaximize(win.gameId);
            win.el.style.left = `${Math.max(0, e.clientX - win.el.offsetWidth * ratio)}px`;
            win.el.style.top = `${Math.max(0, e.clientY - 14)}px`;
        } else {
            focusWindow(win.gameId);
        }

        const offsetX = win.el.offsetLeft - e.clientX;
        const offsetY = win.el.offsetTop - e.clientY;

        const onMove = (ev) => {
            const { width: desktopWidth, height: desktopHeight } = getDesktopSize();
            const left = Math.min(
                Math.max(ev.clientX + offsetX, 60 - win.el.offsetWidth),
                desktopWidth - 60
            );
            const top = Math.min(
                Math.max(ev.clientY + offsetY, 0),
                desktopHeight - 28
            );
            win.el.style.left = `${left}px`;
            win.el.style.top = `${top}px`;
        };

        const onUp = () => {
            bar.removeEventListener("pointermove", onMove);
            bar.removeEventListener("pointerup", onUp);
            bar.removeEventListener("pointercancel", onUp);
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
        if (e.target.closest(".title-buttons")) return;
        toggleMaximize(win.gameId);
    });
};

const wireResize = (win) => {
    const handle = win.el.querySelector(".resize-handle");

    handle.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 || win.maximized) return;
        focusWindow(win.gameId);
        e.preventDefault();

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = win.el.offsetWidth;
        const startHeight = win.el.offsetHeight;

        const onMove = (ev) => {
            const { width: desktopWidth, height: desktopHeight } = getDesktopSize();
            const width = Math.min(
                Math.max(startWidth + ev.clientX - startX, MIN_WINDOW_WIDTH),
                desktopWidth - win.el.offsetLeft
            );
            const height = Math.min(
                Math.max(startHeight + ev.clientY - startY, MIN_WINDOW_HEIGHT),
                desktopHeight - win.el.offsetTop
            );
            win.el.style.width = `${width}px`;
            win.el.style.height = `${height}px`;
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
};

const wireWindowControls = (win) => {
    const gameId = win.gameId;

    win.el.addEventListener("pointerdown", () => focusWindow(gameId));

    win.el.querySelector(".close-btn").addEventListener("click", () => closeGameWindow(gameId));
    win.el.querySelector(".minimize-btn").addEventListener("click", () => minimizeWindow(gameId));
    win.el.querySelector(".maximize-btn").addEventListener("click", () => toggleMaximize(gameId));

    win.el.querySelector(".fullscreen-btn").addEventListener("click", () => {
        if (win.player) {
            toggleFullscreen(win.player);
        }
    });

    win.favoriteBtn.addEventListener("click", () => toggleFavorite(gameId));
    win.volumeBtn.addEventListener("click", () => toggleWindowMute(win));
    win.volumeSlider.addEventListener("input", (e) => setWindowVolume(win, e.target.value));

    syncWindowVolumeUI(win);
    updateFavoriteUI(win);
    updateMaximizeButton(win);
    wireDrag(win);
    wireResize(win);
};

const openGameWindow = (gameId) => {
    if (!gamesList[gameId]) return;

    const existing = openWindows.get(gameId);
    if (existing) {
        restoreWindow(gameId);
        focusWindow(gameId);
        return;
    }

    // Evict the least recently opened window when the limit is reached
    if (openWindows.size >= MAX_OPEN_WINDOWS) {
        let oldestId = null;
        let oldestTime = Infinity;
        for (const [id, win] of openWindows.entries()) {
            if (win.lastOpened < oldestTime) {
                oldestTime = win.lastOpened;
                oldestId = id;
            }
        }
        if (oldestId) {
            closeGameWindow(oldestId);
        }
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

    const win = {
        gameId,
        el,
        type: game.type,
        player: null,
        minimized: false,
        maximized: false,
        prevRect: null,
        zIndex: 0,
        lastOpened: Date.now(),
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

const renderTaskButtons = () => {
    const container = document.getElementById("task-buttons");
    container.innerHTML = "";

    openWindows.forEach((win, gameId) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "task-button" + (gameId === focusedGameId && !win.minimized ? " active" : "");
        btn.title = formatGameTitle(gameId);

        const icon = document.createElement("span");
        icon.className = "task-icon";
        icon.textContent = getGameIcon(gameId);

        const label = document.createElement("span");
        label.className = "task-label";
        label.textContent = formatGameTitle(gameId);

        btn.append(icon, label);
        btn.addEventListener("click", () => {
            if (gameId === focusedGameId && !win.minimized) {
                minimizeWindow(gameId);
            } else {
                restoreWindow(gameId);
                focusWindow(gameId);
            }
        });
        container.appendChild(btn);
    });
};

const startClock = () => {
    const clock = document.getElementById("taskbar-clock");
    const update = () => {
        clock.textContent = new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit"
        });
    };
    update();
    setInterval(update, 5000);
};

// ============================================
// Desktop Icons
// ============================================

const selectDesktopIcon = (gameId) => {
    document.querySelectorAll(".desktop-icon").forEach((el) => {
        el.classList.toggle("selected", el.dataset.game === gameId);
    });
};

const buildDesktopIcons = () => {
    if (iconsBuilt) return;
    iconsBuilt = true;

    const container = document.getElementById("desktop-icons");
    const sortedGames = Object.keys(gamesList).sort((a, b) =>
        formatGameTitle(a).localeCompare(formatGameTitle(b))
    );

    sortedGames.forEach((gameId) => {
        const icon = document.createElement("button");
        icon.type = "button";
        icon.className = "desktop-icon";
        icon.dataset.game = gameId;

        const glyph = document.createElement("span");
        glyph.className = "icon-glyph";
        if (gameId === "doom") {
            const image = document.createElement("img");
            image.src = "assets/icons/doom.png";
            image.alt = "";
            glyph.classList.add("has-image");
            glyph.appendChild(image);
        } else {
            glyph.textContent = getGameIcon(gameId);
        }

        const label = document.createElement("span");
        label.className = "icon-label";
        label.textContent = formatGameTitle(gameId);

        icon.append(glyph, label);
        icon.addEventListener("click", () => {
            if (icon.classList.contains("selected")) {
                openGameWindow(gameId);
            } else {
                selectDesktopIcon(gameId);
            }
        });
        container.appendChild(icon);
    });

    container.addEventListener("pointerdown", (e) => {
        if (e.target === container) {
            selectDesktopIcon(null);
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

    const icon = document.createElement("span");
    icon.className = "sm-game-icon";
    icon.textContent = getGameIcon(gameId);

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

const buildPlaces = () => {
    if (placesBuilt) return;
    placesBuilt = true;

    const container = document.getElementById("start-menu-places");

    const info = document.createElement("div");
    info.className = "sm-place sm-place-info";
    info.textContent = `🕹️ ${Object.keys(gamesList).length} games installed`;

    const offlineLabel = document.createElement("label");
    offlineLabel.className = "sm-place";
    offlineLabel.id = "offline-mode-label";

    const offlineToggle = document.createElement("input");
    offlineToggle.type = "checkbox";
    offlineToggle.id = "offline-mode-toggle";
    offlineLabel.append(offlineToggle, " Offline Mode");

    const github = document.createElement("a");
    github.className = "sm-place";
    github.href = "https://github.com/astrovm/flash";
    github.textContent = "💡 Send suggestions";

    const credits = document.createElement("div");
    credits.className = "sm-place sm-place-info";
    credits.textContent = "Made with <3 by astro";

    container.append(info, offlineLabel, github, credits);
};

const openStartMenu = () => {
    const searchInput = document.getElementById("game-search");
    searchInput.value = "";
    buildProgramsList("");
    document.getElementById("start-menu").hidden = false;
    document.getElementById("start-button").classList.add("active");
};

const closeStartMenu = () => {
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
};

// ============================================
// Offline Mode (service worker)
// ============================================

const updateOfflineModePreference = async () => {
    const offlineModeToggle = document.getElementById("offline-mode-toggle");
    localStorage.setItem("offlineModeEnabled", offlineModeToggle.checked);

    if (offlineModeToggle.checked) {
        navigator.serviceWorker.register("sw.js").then(registration => {
            // Listen for updates to the service worker
            registration.onupdatefound = () => {
                const installingWorker = registration.installing;
                installingWorker.onstatechange = () => {
                    if (installingWorker.state === 'installed') {
                        if (navigator.serviceWorker.controller) {
                            // New update available, reload the page to activate
                            window.location.reload();
                        } else {
                            // Service worker installed for the first time
                            console.log('Service worker installed for offline use.');
                        }
                    }
                };
            };
        }).catch(error => {
            console.error("Service worker registration failed:", error);
        });
    } else {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
                const cachesKeys = await caches.keys();

                for (const cacheKey of cachesKeys) {
                    await caches.delete(cacheKey);
                    console.log("Cache removed successfully:", cacheKey);
                }

                window.location.reload(true);
            }
        } catch (error) {
            console.error("Service worker unregistration failed:", error);
        }
    }
};

const offlineModeService = () => {
    if ("serviceWorker" in navigator) {
        const offlineModeToggle = document.getElementById("offline-mode-toggle");
        const isOfflineModeEnabled =
            localStorage.getItem("offlineModeEnabled") === "true";

        offlineModeToggle.checked = isOfflineModeEnabled;
        offlineModeToggle.addEventListener("change", updateOfflineModePreference);

        if (!offlineInitialized) {
            offlineInitialized = true;
            updateOfflineModePreference();
        }
    } else {
        const offlineModeLabel = document.getElementById("offline-mode-label");
        offlineModeLabel.textContent = "Offline mode is not supported in your browser.";
    }
};

// ============================================
// Screen Flow (boot -> welcome -> desktop)
// ============================================

// Original Windows XP system sounds (playback is skipped if the
// browser still blocks audio before the user's first interaction)
const playXPSound = (name) => {
    const audio = new Audio(`assets/xp/sounds/${name}.mp3`);
    audio.play().catch(() => {});
};

let startupSoundPending = true;

const setScreen = (...visibleIds) => {
    ["boot-screen", "welcome-screen", "desktop", "taskbar", "turn-off-screen"]
        .forEach((id) => {
            document.getElementById(id).hidden = !visibleIds.includes(id);
        });
};

const muteAllWindows = () => {
    openWindows.forEach((win) => setPlayerVolume(win.player, win.type, 0));
};

const showBootScreen = () => {
    muteAllWindows();
    setScreen("boot-screen");
    startupSoundPending = true;
    clearTimeout(bootTimeout);
    bootTimeout = setTimeout(showWelcomeScreen, BOOT_DURATION_MS);
};

const showWelcomeScreen = () => {
    clearTimeout(bootTimeout);
    muteAllWindows();
    setScreen("welcome-screen");
    if (startupSoundPending) {
        startupSoundPending = false;
        playXPSound("startup");
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

const login = (playSound = true) => {
    showDesktop();
    applyFocusVolumes();
    if (playSound) {
        playXPSound("logon");
    }

    if (!loggedIn) {
        loggedIn = true;
        buildDesktopIcons();
        buildPlaces();
        setupSearch();
        offlineModeService();
        startClock();

        // Deep link: #game-id opens that game's window
        const gameId = getHashGameId();
        if (gameId) {
            openGameWindow(gameId);
        }
    }
};

const setupScreenFlow = () => {
    document.getElementById("boot-screen").addEventListener("click", showWelcomeScreen);
    document.getElementById("login-user").addEventListener("click", () => login());
    document.getElementById("turn-off-screen").addEventListener("click", showBootScreen);

    document.getElementById("welcome-turn-off").addEventListener("click", () => {
        playXPSound("shutdown");
        showTurnOffScreen();
    });

    document.getElementById("log-off-button").addEventListener("click", () => {
        closeStartMenu();
        playXPSound("logoff");
        showWelcomeScreen();
    });

    document.getElementById("turn-off-button").addEventListener("click", () => {
        closeStartMenu();
        playXPSound("shutdown");
        showTurnOffScreen();
    });

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
    document.getElementById("start-button").addEventListener("click", toggleStartMenu);
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
    const startMenu = document.getElementById("start-menu");
    if (startMenu.hidden) return;
    if (!e.target.closest("#start-menu") && !e.target.closest("#start-button")) {
        closeStartMenu();
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeStartMenu();
    }
});

// Add message event listener to handle iframe responses
window.addEventListener('message', (event) => {
    if (event.data.type === 'volumeUpdate') {
        // Handle any volume update confirmations from iframe if needed
        console.log('Volume update confirmed by iframe:', event.data.volume);
    }
});
