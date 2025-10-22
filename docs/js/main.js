"use strict";

// Constants
const MAX_STORED_GAMES = 4;
let activeGameId = null;
let storedGames = new Map();

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

// Helper Functions
const formatGameTitle = (gameId) => (
    gameId
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
);

const getSelectedGameId = () => {
    const id = window.location.hash.slice(1);
    return id && gamesList[id] ? id : null;
};

const getActivePlayerElements = () => {
    const state = storedGames.get(activeGameId);
    if (!state) return {};

    return {
        player: state.container.querySelector('#player'),
        controls: state.container
    };
};

const handleGameStateTransition = (fromGameId, toGameId) => {
    // Handle previous game
    if (fromGameId && storedGames.has(fromGameId)) {
        const fromGame = storedGames.get(fromGameId);
        const player = fromGame.container.querySelector('#player');

        // Mute the previous game
        setPlayerVolume(player, fromGame.type, 0);

        // Reset control classes
        const fromControls = fromGame.container.querySelector('.game-controls');
        if (fromControls) {
            fromControls.classList.remove('controls-top', 'controls-horizontal');
            document.body.classList.remove('controls-above-title');
        }
        fromGame.container.style.display = 'none';
    }

    // Handle new game
    if (toGameId && storedGames.has(toGameId)) {
        const toGame = storedGames.get(toGameId);
        const player = toGame.container.querySelector('#player');

        // Set volume for new game
        if (player) {
            const volume = normalizeGameVolume(toGameId);
            setPlayerVolume(player, toGame.type, volume);

            toGame.container.style.display = 'block';
            setTimeout(() => checkControlsPosition(player), 100);
        }
    }
};

const addGameControls = (controlsContainer, gameId) => {
    // Add fullscreen button
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'control-btn fullscreen-btn';
    fullscreenBtn.innerHTML = '⛶';
    fullscreenBtn.onclick = () => {
        const { player } = getActivePlayerElements();
        if (player) {
            toggleFullscreen(player);
        }
    };
    controlsContainer.appendChild(fullscreenBtn);

    // Add favorite button
    const favoriteBtn = document.createElement('button');
    favoriteBtn.className = 'control-btn favorite-btn';
    favoriteBtn.innerHTML = '★';
    favoriteBtn.dataset.game = gameId;
    favoriteBtn.onclick = () => toggleFavorite(gameId);
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    if (favorites.includes(gameId)) {
        favoriteBtn.classList.add('active');
    }
    controlsContainer.appendChild(favoriteBtn);

    // Add volume controls with game-specific settings
    const gameSettings = getGameVolume(gameId);

    const volumeBtn = document.createElement('button');
    volumeBtn.className = 'control-btn volume-btn';
    volumeBtn.innerHTML = gameSettings.isMuted ? '🔈' : '🔊';
    volumeBtn.onclick = toggleMute;

    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.className = 'volume-slider';
    volumeSlider.min = '0';
    volumeSlider.max = '100';
    volumeSlider.value = gameSettings.isMuted ? 0 : gameSettings.volume;
    volumeSlider.oninput = (e) => updateVolume(e.target.value);

    controlsContainer.appendChild(volumeBtn);
    controlsContainer.appendChild(volumeSlider);
};

const setResolution = (player, aspectRatio) => {
    const absoluteHeight = 820;
    const absoluteWidth = absoluteHeight * aspectRatio;
    const scrollBar = window.innerWidth - document.documentElement.clientWidth;
    const relativeWidth = 100 - (scrollBar / window.innerWidth) * 100;
    player.style.width = "100%";
    player.style.height = `${relativeWidth / aspectRatio}vw`;
    player.style.maxWidth = `min(${100 * aspectRatio}vh, ${absoluteWidth}px)`;
    player.style.maxHeight = `min(100vh, ${absoluteHeight}px)`;
};

const scaleGame = (player) => {
    const gameId = getSelectedGameId();
    const width = player.metadata?.width;
    const height = player.metadata?.height;
    const aspectRatio =
        (gameId && gamesList[gameId].aspectRatio) ||
        (width && height ? width / height : null) ||
        1.25;
    setResolution(player, aspectRatio);
    checkControlsPosition(player);
};

const checkControlsPosition = (player) => {
    // Get controls for the active game specifically
    const gameContainer = player.closest('[id^="game-container-"]');
    const controls = gameContainer?.querySelector('.game-controls');
    if (!controls || !player) return;

    const playerRect = player.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const spaceOnRight = windowWidth - playerRect.right;
    const controlsWidth = controls.offsetWidth;

    // Reset to default state first
    controls.classList.remove('controls-top', 'controls-horizontal');
    document.body.classList.remove('controls-above-title');

    // Force a reflow to get accurate measurements after removing classes
    controls.offsetHeight;

    // Check if we need to switch to horizontal layout
    if (spaceOnRight < controlsWidth + 20) {
        controls.classList.add('controls-top', 'controls-horizontal');
        document.body.classList.add('controls-above-title');
    }
};

// Use a debounced resize handler
let resizeTimeout;
window.addEventListener("resize", () => {
    if (activeGameId && storedGames.has(activeGameId)) {
        const activeGame = storedGames.get(activeGameId);
        const player = activeGame.container.querySelector('#player');
        if (player) {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                scaleGame(player);
            }, 100);
        }
    }
});

window.RufflePlayer = window.RufflePlayer || {};
const loadRuffleSWF = (gameId, container) => {
    trackGamePlay(gameId);
    const ruffle = window.RufflePlayer.newest();
    const player = ruffle.createPlayer();
    player.setAttribute("id", "player");

    scaleGame(player);
    container.appendChild(player);

    const initialVolume = normalizeGameVolume(gameId);

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
        volume: initialVolume,
        allowScriptAccess: false,
        autoplay: "on",
        unmuteOverlay: "hidden"
    };

    player.addEventListener("loadedmetadata", () => {
        setPlayerVolume(player, 'swf', initialVolume);
        scaleGame(player);
    });

    player.load(config);
};

const loadIframe = (gameId, container) => {
    trackGamePlay(gameId);
    const player = document.createElement("iframe");
    player.setAttribute("id", "player");
    player.allow = "fullscreen";
    player.src = `iframe/${gameId}/`;
    scaleGame(player);

    container.appendChild(player);

    const initialVolume = normalizeGameVolume(gameId);

    player.addEventListener('load', () => {
        setPlayerVolume(player, 'iframe', initialVolume);
        scaleGame(player);
    });
};

const updateDocumentTitle = () => {
    const gameId = getSelectedGameId();
    if (gameId) {
        document.title = formatGameTitle(gameId);
    } else {
        const titleElement = document.getElementById("title");
        document.title = titleElement.textContent;
    }
};

const updateFlashContainer = () => {
    const flashContainer = document.getElementById("flash-container");

    const gameId = getSelectedGameId();

    if (gameId) {
        const gameType = gamesList[gameId].type;

        // Handle game state transition
        handleGameStateTransition(activeGameId, gameId);

        // Show container when a game is selected
        flashContainer.style.display = "block";

        if (!storedGames.has(gameId)) {
            // Create new game container
            const gameContainer = document.createElement('div');
            gameContainer.id = `game-container-${gameId}`;
            flashContainer.appendChild(gameContainer);

            // Create controls container
            const controlsContainer = document.createElement('div');
            controlsContainer.className = 'game-controls';
            gameContainer.appendChild(controlsContainer);

            // Add game controls
            addGameControls(controlsContainer, gameId);

            // Load new game
            switch (gameType) {
                case "swf":
                    loadRuffleSWF(gameId, gameContainer);
                    break;
                case "iframe":
                    loadIframe(gameId, gameContainer);
                    break;
            }

            // Store new game state
            storedGames.set(gameId, {
                container: gameContainer,
                type: gameType,
                lastPlayed: Date.now()
            });

            // Remove oldest game if limit exceeded
            if (storedGames.size > MAX_STORED_GAMES) {
                // Find the oldest game by lastPlayed timestamp
                let oldestGameId = null;
                let oldestTime = Infinity;

                for (const [id, game] of storedGames.entries()) {
                    if (game.lastPlayed < oldestTime) {
                        oldestTime = game.lastPlayed;
                        oldestGameId = id;
                    }
                }

                if (oldestGameId) {
                    handleGameStateTransition(oldestGameId, null);
                    const oldestContainer = storedGames.get(oldestGameId).container;
                    oldestContainer.remove();
                    storedGames.delete(oldestGameId);
                }
            }
        } else {
            // Track game play when restoring a game
            trackGamePlay(gameId);
            // Get the stored game's player and check controls
            const storedGame = storedGames.get(gameId);
            const player = storedGame.container.querySelector('#player');
            if (player) {
                scaleGame(player);
            }
        }

        activeGameId = gameId;

        // Scroll to flash container
        flashContainer.scrollIntoView({ behavior: 'smooth' });
    } else {
        // Pause current game if exists
        if (activeGameId) {
            handleGameStateTransition(activeGameId, null);
        }
        // Hide all games
        flashContainer.style.display = "none";
        activeGameId = null;
    }
};

const setupSearch = () => {
    const searchInput = document.getElementById('game-search');
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const gameLinks = document.querySelectorAll('#list-container a');

        gameLinks.forEach(link => {
            const gameName = link.textContent.toLowerCase();
            link.style.display = gameName.includes(searchTerm) ? '' : 'none';
        });
    });
};

const populateGameCategories = () => {
    const gamesByCategory = {};
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const gameStats = JSON.parse(localStorage.getItem('gameStats') || '{}');
    const selectedGameId = getSelectedGameId();

    // Add Recently Played category
    const recentlyPlayed = Object.entries(gameStats)
        .sort((a, b) => b[1].lastPlayed - a[1].lastPlayed)
        .slice(0, 8) // Show last 8 played games
        .map(([gameId]) => gameId);

    if (recentlyPlayed.length > 0) {
        gamesByCategory['Recently Played'] = [];
        recentlyPlayed.forEach(gameId => {
            if (gamesList[gameId]) {
                gamesByCategory['Recently Played'].push({
                    id: gameId,
                    title: formatGameTitle(gameId)
                });
            }
        });
    }

    // Add Favorites category if there are any
    if (favorites.length > 0) {
        gamesByCategory['Favorites'] = [];
        favorites.forEach(gameId => {
            if (gamesList[gameId]) {
                gamesByCategory['Favorites'].push({
                    id: gameId,
                    title: formatGameTitle(gameId)
                });
            }
        });
    }

    // Sort other games into categories
    Object.entries(gamesList).forEach(([gameId, game]) => {
        const category = game.category || 'Other';
        if (!gamesByCategory[category]) {
            gamesByCategory[category] = [];
        }
        gamesByCategory[category].push({
            id: gameId,
            title: formatGameTitle(gameId)
        });
    });

    // Clear and populate list container
    const listContainer = document.getElementById('list-container');
    listContainer.innerHTML = '';

    // Sort categories to ensure Recently Played and Favorites are at the top
    const orderedCategories = Object.entries(gamesByCategory).sort(([catA], [catB]) => {
        if (catA === 'Favorites') return -1;
        if (catB === 'Favorites') return 1;
        if (catA === 'Recently Played') return -1;
        if (catB === 'Recently Played') return 1;
        return catA.localeCompare(catB);
    });

    orderedCategories.forEach(([category, games]) => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category';
        categoryDiv.id = `${category.toLowerCase().replace(/\s+/g, '-')}-games`;

        const categoryTitle = document.createElement('h2');
        categoryTitle.textContent = category;
        categoryDiv.appendChild(categoryTitle);

        games.forEach(game => {
            const gameLink = document.createElement('a');
            gameLink.href = `#${game.id}`;
            const gameTitle = document.createElement('h3');
            gameTitle.textContent = game.title;

            // Highlight current game
            if (selectedGameId === game.id) {
                gameLink.classList.add('current-game');
            }

            // Add play count if available
            if (gameStats[game.id]) {
                const playCount = document.createElement('span');
                playCount.className = 'play-count';
                const plays = gameStats[game.id].plays;
                playCount.textContent = `${plays} ${plays === 1 ? 'play' : 'plays'}`;
                gameTitle.appendChild(playCount);
            }

            gameLink.appendChild(gameTitle);
            categoryDiv.appendChild(gameLink);
        });

        listContainer.appendChild(categoryDiv);
    });
};

window.addEventListener("load", () => {
    populateGameCategories();
    setupSearch();
    updateDocumentTitle();
    updateFlashContainer();
    offlineModeService();
});

window.addEventListener("hashchange", () => {
    updateDocumentTitle();
    updateFlashContainer();
    populateGameCategories();
});

// url spoofing https://github.com/ruffle-rs/ruffle/issues/1486
const changeUrl = (request) => {
    if (!request.url) return request;

    const parsedUrl = new URL(request.url);
    if (parsedUrl.hostname !== window.location.hostname) {
        const gameId = getSelectedGameId();
        if (!gameId) {
            return request;
        }
        const gameType = gamesList[gameId]?.type;
        switch (gameType) {
            case "swf":
                const file = parsedUrl.pathname.split("/").pop();
                return `swf/${gameId}/${file}`;
            default:
                break;
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

        updateOfflineModePreference();
    } else {
        const offlineModeLabel = document.getElementById("offline-mode-label");
        offlineModeLabel.innerHTML =
            "Offline mode is not supported in your browser.";
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

const toggleFavorite = (gameId) => {
    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const index = favorites.indexOf(gameId);

    if (index === -1) {
        favorites.push(gameId);
    } else {
        favorites.splice(index, 1);
    }

    localStorage.setItem('favorites', JSON.stringify(favorites));

    // Update favorite button state
    const favoriteBtn = document.querySelector(`.favorite-btn[data-game="${gameId}"]`);
    if (favoriteBtn) {
        favoriteBtn.classList.toggle('active');
    }

    // Refresh categories to update favorites section
    populateGameCategories();
};

const trackGamePlay = (gameId) => {
    const gameStats = JSON.parse(localStorage.getItem('gameStats') || '{}');
    const timestamp = Date.now();

    if (!gameStats[gameId]) {
        gameStats[gameId] = {
            plays: 0,
            lastPlayed: null
        };
    }

    gameStats[gameId].plays += 1;
    gameStats[gameId].lastPlayed = timestamp;

    localStorage.setItem('gameStats', JSON.stringify(gameStats));

    // Also update lastPlayed in storedGames if the game exists there
    if (storedGames.has(gameId)) {
        const gameState = storedGames.get(gameId);
        gameState.lastPlayed = timestamp;
        storedGames.set(gameId, gameState);
    }
};

const updateVolume = (value) => {
    const storedGame = storedGames.get(activeGameId);
    const { player, controls } = getActivePlayerElements();
    if (!storedGame || !player || !controls) return;

    const volumeBtn = controls.querySelector('.volume-btn');
    const volumeSlider = controls.querySelector('.volume-slider');
    if (!volumeBtn || !volumeSlider) return;

    // If volume is 0, treat as muted but remember previous volume
    const isMuted = parseInt(value) === 0;
    volumeBtn.innerHTML = isMuted ? '🔈' : '🔊';

    // Store the volume settings for this specific game
    setGameVolume(activeGameId, value, isMuted);

    // Update the actual volume
    setPlayerVolume(player, storedGame.type, value / 100);
};

const toggleMute = () => {
    const storedGame = storedGames.get(activeGameId);
    const { player, controls } = getActivePlayerElements();
    if (!storedGame || !player || !controls) return;

    const volumeBtn = controls.querySelector('.volume-btn');
    const volumeSlider = controls.querySelector('.volume-slider');
    if (!volumeBtn || !volumeSlider) return;

    const gameSettings = getGameVolume(activeGameId);
    const isMuted = gameSettings.isMuted;

    if (isMuted) {
        // Unmuting - restore to previous volume
        const volume = gameSettings.volume || 100;
        setGameVolume(activeGameId, volume, false);

        setPlayerVolume(player, storedGame.type, volume / 100);

        volumeBtn.innerHTML = '🔊';
        volumeSlider.value = volume;
    } else {
        // Muting - store current volume before setting to 0
        const currentVolume = volumeSlider.value;
        setGameVolume(activeGameId, currentVolume, true);

        setPlayerVolume(player, storedGame.type, 0);

        volumeBtn.innerHTML = '🔈';
        volumeSlider.value = 0;
    }
};

// Add message event listener to handle iframe responses
window.addEventListener('message', (event) => {
    // You can add validation here if needed
    if (event.data.type === 'volumeUpdate') {
        // Handle any volume update confirmations from iframe if needed
        console.log('Volume update confirmed by iframe:', event.data.volume);
    }
});

// Add this helper function to manage per-game volume settings
const getGameVolume = (gameId) => {
    const gameVolumes = JSON.parse(localStorage.getItem('gameVolumes') || '{}');
    if (gameId in gameVolumes) {
        return {
            volume: parseInt(gameVolumes[gameId].volume),
            isMuted: gameVolumes[gameId].isMuted
        };
    }
    // Fall back to global settings if no game-specific settings exist
    return {
        volume: parseInt(localStorage.getItem('volume') || '100'),
        isMuted: localStorage.getItem('isMuted') === 'true'
    };
};

const setGameVolume = (gameId, volume, isMuted) => {
    const gameVolumes = JSON.parse(localStorage.getItem('gameVolumes') || '{}');
    gameVolumes[gameId] = {
        volume: volume,
        isMuted: isMuted
    };
    localStorage.setItem('gameVolumes', JSON.stringify(gameVolumes));
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
