"use strict";

// Constants
const MAX_OPEN_WINDOWS = 4;
const DEFAULT_ASPECT_RATIO = 4 / 3;
const WINDOW_CHROME_HEIGHT = 58; // title bar + toolbar
const MIN_WINDOW_WIDTH = 340;
const MIN_WINDOW_HEIGHT = 240;
const BOOT_DURATION_MS = 2600;
const WELCOME_DURATION_MS = 1200;

let bootTimeout = null;
let shutdownTimeout = null;
let loggedIn = false;
let iconsBuilt = false;
let placesBuilt = false;
let offlineInitialized = false;

const gamesList = window.FLASH_GAMES;

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
    if (!win.volumeBtn || !win.volumeSlider) return;
    const { volume, isMuted } = getGameVolume(win.gameId);
    const numericVolume = Number.isFinite(volume) ? volume : 100;
    const muted = isMuted || numericVolume === 0;
    win.volumeBtn.textContent = muted ? "Unmute" : "Sound";
    win.volumeBtn.classList.toggle("active", muted);
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

    const toolbar = document.createElement("div");
    toolbar.className = "window-toolbar";

    const fullscreenBtn = document.createElement("button");
    fullscreenBtn.type = "button";
    fullscreenBtn.className = "toolbar-btn fullscreen-btn";
    fullscreenBtn.title = "Fullscreen";
    fullscreenBtn.textContent = "Full Screen";

    const favoriteBtn = document.createElement("button");
    favoriteBtn.type = "button";
    favoriteBtn.className = "toolbar-btn favorite-btn";
    favoriteBtn.title = "Favorite";
    favoriteBtn.textContent = "Favorite";

    const separator = document.createElement("span");
    separator.className = "toolbar-separator";

    const volumeBtn = document.createElement("button");
    volumeBtn.type = "button";
    volumeBtn.className = "toolbar-btn volume-btn";
    volumeBtn.title = "Mute";
    volumeBtn.textContent = "Sound";

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

const createSystemWindowContent = (shortcutId) => {
    const content = document.createElement("div");
    content.className = "explorer-content";

    if (shortcutId === "__display-properties") {
        content.className = "display-properties-content";
        content.innerHTML = `
            <div class="display-tabs" role="tablist" aria-label="Display Properties">
                <button type="button" role="tab">Themes</button>
                <button type="button" role="tab" class="active" aria-selected="true">Desktop</button>
                <button type="button" role="tab">Screen Saver</button>
                <button type="button" role="tab">Appearance</button>
                <button type="button" role="tab">Settings</button>
            </div>
            <div class="display-preview" aria-label="Desktop preview">
                <div><span>start</span></div>
            </div>
            <label class="display-wallpaper-label">Background:</label>
            <select aria-label="Desktop background">
                <option selected>Bliss</option>
            </select>
            <div class="display-dialog-buttons">
                <button type="button" data-display-action="ok">OK</button>
                <button type="button" data-display-action="cancel">Cancel</button>
                <button type="button" disabled>Apply</button>
            </div>
        `;
        return content;
    }

    const taskTitles = {
        "__my-documents": "File and Folder Tasks",
        "__my-computer": "System Tasks",
        "__recycle-bin": "Recycle Bin Tasks"
    };
    const descriptions = {
        "__my-documents": "Files stored on this computer",
        "__my-computer": "Files Stored on This Computer",
        "__recycle-bin": "The Recycle Bin is empty."
    };

    const sidebar = document.createElement("aside");
    sidebar.className = "explorer-sidebar";
    sidebar.innerHTML = `
        <section>
            <h3>${taskTitles[shortcutId]}</h3>
            <button type="button">View system information</button>
            <button type="button">Add or remove programs</button>
            <button type="button">Change a setting</button>
        </section>
        <section>
            <h3>Other Places</h3>
            <button type="button">My Network Places</button>
            <button type="button">My Documents</button>
            <button type="button">Control Panel</button>
        </section>
    `;

    const main = document.createElement("main");
    main.className = "explorer-main";

    const heading = document.createElement("h2");
    heading.textContent = descriptions[shortcutId];
    main.appendChild(heading);

    const items = document.createElement("div");
    items.className = "explorer-items";
    if (shortcutId === "__my-computer") {
        items.innerHTML = `
            <div class="explorer-item"><span class="drive-icon"></span><span><b>Local Disk (C:)</b><small>Game files and Windows XP</small></span></div>
            <div class="explorer-item"><span class="disc-icon"></span><span><b>CD Drive (D:)</b><small>Flash Collection</small></span></div>
        `;
    } else if (shortcutId === "__my-documents") {
        items.innerHTML = `
            <div class="explorer-item"><img src="assets/xp/icons/mydocuments.png" alt=""><span><b>My Pictures</b><small>Picture folder</small></span></div>
            <div class="explorer-item"><img src="assets/xp/icons/mydocuments.png" alt=""><span><b>My Music</b><small>Music folder</small></span></div>
        `;
    } else {
        const empty = document.createElement("p");
        empty.className = "explorer-empty";
        empty.textContent = "There are no items to show in this view.";
        items.appendChild(empty);
    }
    main.appendChild(items);
    content.append(sidebar, main);
    return content;
};

const wireSystemWindowControls = (win) => {
    win.el.addEventListener("pointerdown", () => focusWindow(win.gameId));
    win.el.querySelector(".close-btn").addEventListener("click", () => closeGameWindow(win.gameId));
    win.el.querySelector(".minimize-btn").addEventListener("click", () => minimizeWindow(win.gameId));
    win.el.querySelector(".maximize-btn").addEventListener("click", () => toggleMaximize(win.gameId));
    updateMaximizeButton(win);
    wireDrag(win);
    wireResize(win);
};

const ensureWindowCapacity = () => {
    if (openWindows.size < MAX_OPEN_WINDOWS) return;

    let oldestId = null;
    let oldestTime = Infinity;
    for (const [id, win] of openWindows.entries()) {
        if (win.lastUsed < oldestTime) {
            oldestTime = win.lastUsed;
            oldestId = id;
        }
    }
    if (oldestId) {
        closeGameWindow(oldestId);
    }
};

const openSystemWindow = (shortcutId) => {
    const existing = openWindows.get(shortcutId);
    if (existing) {
        restoreWindow(shortcutId);
        focusWindow(shortcutId);
        return;
    }

    ensureWindowCapacity();
    const { width: desktopWidth, height: desktopHeight } = getDesktopSize();
    const el = createWindowElement(shortcutId);
    el.classList.add("explorer-window");
    el.querySelector(".window-toolbar").remove();
    const content = el.querySelector(".window-content");
    content.replaceWith(createSystemWindowContent(shortcutId));
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
        maximizeBtn: el.querySelector(".maximize-btn"),
        favoriteBtn: null,
        volumeBtn: null,
        volumeSlider: null
    };
    openWindows.set(shortcutId, win);
    wireSystemWindowControls(win);
    el.querySelectorAll("[data-display-action]").forEach((button) => {
        button.addEventListener("click", () => closeGameWindow(shortcutId));
    });
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

    ensureWindowCapacity();
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

const renderTaskButtons = () => {
    const container = document.getElementById("task-buttons");
    container.innerHTML = "";

    openWindows.forEach((win, gameId) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "task-button" + (gameId === focusedGameId && !win.minimized ? " active" : "");
        btn.dataset.game = gameId;
        btn.title = formatGameTitle(gameId);

        const icon = createGameIconElement(gameId, "task-icon");

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
        const fallbackLeft = DESKTOP_ICON_MARGIN
            + Math.floor(index / rows) * (DESKTOP_ICON_WIDTH + DESKTOP_ICON_GAP);
        const fallbackTop = DESKTOP_ICON_MARGIN
            + (index % rows) * (DESKTOP_ICON_HEIGHT + DESKTOP_ICON_GAP);
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
    const desktopItems = [
        ...Object.keys(systemShortcuts).filter((id) => systemShortcuts[id].desktop !== false),
        ...sortedGames
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

const buildPlaces = () => {
    if (placesBuilt) return;
    placesBuilt = true;

    const container = document.getElementById("start-menu-places");
    const createPlace = (label, icon, elementName = "button") => {
        const item = document.createElement(elementName);
        item.className = "sm-place";
        if (item instanceof HTMLButtonElement) {
            item.type = "button";
        }

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
        text.textContent = label;
        item.append(glyph, text);
        return item;
    };

    [
        ["My Documents", "MyDocuments.png"],
        ["My Recent Documents", "RecentDocuments.png"],
        ["My Pictures", "MyPictures.png"],
        ["My Music", "MyMusic.png"],
        ["My Computer", "MyComputer.png"],
    ].forEach(([label, icon]) => container.appendChild(createPlace(label, icon)));

    const separatorOne = document.createElement("div");
    separatorOne.className = "sm-place-separator";
    container.appendChild(separatorOne);

    [
        ["Control Panel", "ControlPanel.png"],
        ["Printers and Faxes", "PrintersandFaxes.png"],
        ["Help and Support", "HelpandSupport.png"],
    ].forEach(([label, icon]) => container.appendChild(createPlace(label, icon)));

    const search = createPlace("Search", "Search.png");
    search.addEventListener("click", () => {
        openAllPrograms();
        document.getElementById("game-search").focus();
    });
    container.appendChild(search);

    const run = createPlace("Run...", "Run.png");
    run.addEventListener("click", openAllPrograms);
    container.appendChild(run);

    const separatorTwo = document.createElement("div");
    separatorTwo.className = "sm-place-separator";
    container.appendChild(separatorTwo);

    const offlineLabel = document.createElement("label");
    offlineLabel.className = "sm-place";
    offlineLabel.id = "offline-mode-label";

    const offlineToggle = document.createElement("input");
    offlineToggle.type = "checkbox";
    offlineToggle.id = "offline-mode-toggle";
    offlineLabel.append(offlineToggle, " Offline Mode");

    const github = createPlace("Send suggestions", "✦", "a");
    github.href = "https://github.com/astrovm/flash";

    const credits = document.createElement("div");
    credits.className = "sm-place sm-place-info";
    credits.textContent = `${Object.keys(gamesList).length} games installed`;

    container.append(offlineLabel, github, credits);
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
            let stateChanged = false;
            const registration = await navigator.serviceWorker.getRegistration("./");
            if (registration) {
                await registration.unregister();
                stateChanged = true;
            }

            const cacheKeys = await caches.keys();
            for (const cacheKey of cacheKeys) {
                if (cacheKey.startsWith("astro-flash")) {
                    await caches.delete(cacheKey);
                    stateChanged = true;
                }
            }

            if (stateChanged) {
                window.location.reload();
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
    hideSystemDialogs();
    clearTimeout(shutdownTimeout);
    muteAllWindows();
    setScreen("boot-screen");
    startupSoundPending = true;
    clearTimeout(bootTimeout);
    bootTimeout = setTimeout(() => showWelcomeScreen(true), BOOT_DURATION_MS);
};

const showWelcomeScreen = (autoLogin = false) => {
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
        bootTimeout = setTimeout(() => login(false), WELCOME_DURATION_MS);
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

const login = (playSound = true) => {
    clearTimeout(bootTimeout);
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
        .addEventListener("click", () => {
            playXPSound("logoff");
            showWelcomeScreen(false);
        });
    document.getElementById("logoff-confirm")
        .addEventListener("click", () => {
            playXPSound("logoff");
            showWelcomeScreen(false);
        });
    document.getElementById("shutdown-confirm")
        .addEventListener("click", () => startShutdown(false));
    document.getElementById("restart-confirm")
        .addEventListener("click", () => startShutdown(true));
    document.getElementById("standby-confirm")
        .addEventListener("click", () => {
            hideSystemDialogs();
            minimizeAllWindows();
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
    setupDesktopContextMenu();
    document.getElementById("start-button").addEventListener("click", toggleStartMenu);
});

window.addEventListener("resize", () => {
    if (iconsBuilt) {
        layoutDesktopIcons();
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
    if (!e.target.closest("#desktop-context-menu")) {
        closeDesktopContextMenu();
    }

    const startMenu = document.getElementById("start-menu");
    if (startMenu.hidden) return;
    if (!e.target.closest("#start-menu") && !e.target.closest("#start-button")) {
        closeStartMenu();
    }
});

document.addEventListener("keydown", (e) => {
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

    if (e.key === "Escape") {
        hideSystemDialogs();
        closeStartMenu();
    }
});
