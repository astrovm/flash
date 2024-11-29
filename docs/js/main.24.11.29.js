"use strict";

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
    const gameId = window.location.hash.substring(1);
    const width = player.metadata?.width;
    const height = player.metadata?.height;
    const aspectRatio = gamesList[gameId].aspectRatio || width / height || 1.25;
    setResolution(player, aspectRatio);

    setTimeout(() => checkControlsOverlap(player), 100);
};

window.addEventListener("resize", () => {
    const player = document.getElementById("player");
    if (player) {
        scaleGame(player);
        checkControlsOverlap(player);
    }
});

window.RufflePlayer = window.RufflePlayer || {};
const showLoader = () => {
    const flashContainer = document.getElementById("flash-container");
    flashContainer.innerHTML = '<div class="loader">Loading...</div>';
};

const loadRuffleSWF = (gameId) => {
    trackGamePlay(gameId);
    showLoader();
    const ruffle = window.RufflePlayer.newest();
    const player = ruffle.createPlayer();
    player.setAttribute("id", "player");
    scaleGame(player);

    const flashContainer = document.getElementById("flash-container");
    flashContainer.innerHTML = "";

    // Create controls container
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'game-controls';

    // Add fullscreen button
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'control-btn fullscreen-btn';
    fullscreenBtn.innerHTML = '⛶';
    fullscreenBtn.onclick = () => toggleFullscreen(player);
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

    // Add volume controls
    const volume = getStoredVolume();
    const isMuted = localStorage.getItem('isMuted') === 'true';

    const volumeBtn = document.createElement('button');
    volumeBtn.className = 'control-btn volume-btn';
    volumeBtn.innerHTML = isMuted ? '🔈' : '🔊';
    volumeBtn.onclick = toggleMute;

    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.className = 'volume-slider';
    volumeSlider.min = '0';
    volumeSlider.max = '100';
    volumeSlider.value = isMuted ? 0 : volume;
    volumeSlider.onchange = (e) => updateVolume(e.target.value);

    controlsContainer.appendChild(volumeBtn);
    controlsContainer.appendChild(volumeSlider);

    flashContainer.appendChild(controlsContainer);
    flashContainer.appendChild(player);

    try {
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
            volume: isMuted ? 0 : volume / 100,
            allowScriptAccess: false
        };

        player.addEventListener("loadedmetadata", () => {
            scaleGame(player);
            player.volume = isMuted ? 0 : volume / 100;
        });

        player.addEventListener("load", () => {
            player.volume = isMuted ? 0 : volume / 100;
        });

        player.load(config);

    } catch (error) {
        handleGameError(error, gameId);
    }
};

const loadIframe = (gameId) => {
    trackGamePlay(gameId);
    showLoader();
    const player = document.createElement("iframe");
    player.setAttribute("id", "player");
    player.allow = "fullscreen";
    player.src = `iframe/${gameId}/`;
    scaleGame(player);

    const flashContainer = document.getElementById("flash-container");
    flashContainer.innerHTML = "";

    // Create controls container
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'game-controls';

    // Add fullscreen button
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'control-btn fullscreen-btn';
    fullscreenBtn.innerHTML = '⛶';
    fullscreenBtn.onclick = () => toggleFullscreen(player);
    controlsContainer.appendChild(fullscreenBtn);

    // Add favorite button
    const favoriteBtn = document.createElement('button');
    favoriteBtn.className = 'control-btn favorite-btn';
    favoriteBtn.innerHTML = '★';
    favoriteBtn.dataset.game = gameId;
    favoriteBtn.onclick = () => toggleFavorite(gameId);
    // Set initial state
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    if (favorites.includes(gameId)) {
        favoriteBtn.classList.add('active');
    }
    controlsContainer.appendChild(favoriteBtn);

    // Add volume controls
    const isMuted = localStorage.getItem('isMuted') === 'true';
    const volume = getStoredVolume();

    const volumeBtn = document.createElement('button');
    volumeBtn.className = 'control-btn volume-btn';
    volumeBtn.innerHTML = isMuted ? '🔈' : '🔊';
    volumeBtn.onclick = toggleMute;

    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.className = 'volume-slider';
    volumeSlider.min = '0';
    volumeSlider.max = '100';
    volumeSlider.value = isMuted ? 0 : volume;
    volumeSlider.onchange = (e) => updateVolume(e.target.value);

    controlsContainer.appendChild(volumeBtn);
    controlsContainer.appendChild(volumeSlider);

    flashContainer.appendChild(controlsContainer);
    flashContainer.appendChild(player);

    // Set initial volume after iframe loads
    player.onload = () => {
        player.contentWindow.postMessage({
            type: 'setVolume',
            volume: isMuted ? 0 : volume / 100
        }, '*');
    };
};

const scrollTo = (id) => {
    const element = document.getElementById(id);
    element.scrollIntoView();
};

const updateDocumentTitle = () => {
    if (window.location.hash && gamesList[window.location.hash.substring(1)]) {
        const gameId = window.location.hash.substring(1);
        const gameTitle = gameId.split('-').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        document.title = gameTitle;
    } else {
        const titleElement = document.getElementById("title");
        document.title = titleElement.textContent;
    }
};

const updateFlashContainer = () => {
    const flashContainer = document.getElementById("flash-container");
    const player = document.getElementById("player");

    // Clean up existing player if any
    if (player) {
        if (player instanceof HTMLIFrameElement) {
            player.src = 'about:blank'; // Clear iframe content
        } else {
            try {
                player.remove(); // Remove Ruffle player
            } catch (error) {
                console.error("Error removing player:", error);
            }
        }
    }

    if (window.location.hash && gamesList[window.location.hash.substring(1)]) {
        // Show container when a game is selected
        flashContainer.style.display = "block";
        const gameId = window.location.hash.substring(1);
        const gameType = gamesList[gameId].type;

        switch (gameType) {
            case "swf":
                loadRuffleSWF(gameId);
                break;
            case "iframe":
                loadIframe(gameId);
                break;
            default:
                break;
        }

        // Scroll to flash container after a short delay to ensure content is loaded
        setTimeout(() => {
            flashContainer.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    } else {
        // Hide container when no game is selected
        flashContainer.innerHTML = ''; // Clear container contents
        flashContainer.style.display = "none";
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
                    title: gameId.split('-').map(word =>
                        word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')
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
                    title: gameId.split('-').map(word =>
                        word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')
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
            title: gameId.split('-').map(word =>
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ')
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
            if (window.location.hash === `#${game.id}`) {
                gameLink.classList.add('current-game');
            }

            // Add play count if available
            if (gameStats[game.id]) {
                const playCount = document.createElement('span');
                playCount.className = 'play-count';
                playCount.textContent = `${gameStats[game.id].plays} plays`;
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
    scrollTo("title");
    updateFlashContainer();
    populateGameCategories();
});

// url spoofing https://github.com/ruffle-rs/ruffle/issues/1486
const changeUrl = (request) => {
    if (!request.url) return request;

    const parsedUrl = new URL(request.url);
    if (parsedUrl.hostname !== window.location.hostname) {
        const gameId = window.location.hash.substring(1);
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
        try {
            const registration = await navigator.serviceWorker.register("sw.js");
        } catch (error) {
            console.error("Service worker registration failed:", error);
        }
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

const addFullscreenButton = (player) => {
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'fullscreen-btn';
    fullscreenBtn.innerHTML = '⛶';
    fullscreenBtn.onclick = () => toggleFullscreen(player);

    const container = document.getElementById('flash-container');
    container.appendChild(fullscreenBtn);
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

const handleGameError = (error, gameId) => {
    const flashContainer = document.getElementById("flash-container");
    flashContainer.innerHTML = `
        <div class="error-container">
            <h3>Oops! Something went wrong loading the game</h3>
            <p>${error.message}</p>
            <button onclick="retryLoad('${gameId}')">Try Again</button>
        </div>
    `;
};

const retryLoad = (gameId) => {
    updateFlashContainer();
};

const trackGamePlay = (gameId) => {
    const gameStats = JSON.parse(localStorage.getItem('gameStats') || '{}');

    if (!gameStats[gameId]) {
        gameStats[gameId] = {
            plays: 0,
            lastPlayed: null
        };
    }

    gameStats[gameId].plays += 1;
    gameStats[gameId].lastPlayed = Date.now();

    localStorage.setItem('gameStats', JSON.stringify(gameStats));
};

const checkControlsOverlap = (player) => {
    const controls = document.querySelector('.game-controls');
    if (!controls || !player) return;

    const playerRect = player.getBoundingClientRect();
    const controlsRect = controls.getBoundingClientRect();
    const windowWidth = window.innerWidth;

    // Calculate space available on the right side of the player
    const spaceOnRight = windowWidth - playerRect.right;
    
    // Check if controls are overlapping with the actual game content
    const isOverlapping = !(
        playerRect.right < controlsRect.left ||
        playerRect.left > controlsRect.right ||
        playerRect.bottom < controlsRect.top ||
        playerRect.top > controlsRect.bottom
    );

    // Remove all layout classes first
    controls.classList.remove('controls-top', 'controls-horizontal');
    document.body.classList.remove('controls-above-title');

    if (isOverlapping || spaceOnRight < 100) { // If severely constrained or overlapping
        // Move to top and make horizontal
        controls.classList.add('controls-top');
        controls.classList.add('controls-horizontal');
        document.body.classList.add('controls-above-title');
    }
    // Otherwise, leave as vertical (default state)
};

const getStoredVolume = () => {
    if (localStorage.getItem('isMuted') === 'true') {
        return 0;
    }
    const storedVolume = localStorage.getItem('volume');
    return storedVolume ? parseInt(storedVolume) : 100;
};

const updateVolume = (value) => {
    const player = document.getElementById('player');
    const volumeBtn = document.querySelector('.volume-btn');
    if (!player || !volumeBtn) return;

    // If volume is 0, treat as muted but remember previous volume
    if (parseInt(value) === 0) {
        localStorage.setItem('isMuted', 'true');
        volumeBtn.innerHTML = '🔈';
    } else {
        localStorage.setItem('isMuted', 'false');
        localStorage.setItem('previousVolume', value);
        volumeBtn.innerHTML = '🔊';
    }

    localStorage.setItem('volume', value);

    // Handle volume for both iframe and regular players
    if (player instanceof HTMLIFrameElement) {
        // Post message to iframe to update volume
        player.contentWindow.postMessage({
            type: 'setVolume',
            volume: value / 100
        }, '*');
    } else {
        player.volume = value / 100;
    }
};

const toggleMute = () => {
    const player = document.getElementById('player');
    const volumeBtn = document.querySelector('.volume-btn');
    const volumeSlider = document.querySelector('.volume-slider');
    if (!player || !volumeBtn || !volumeSlider) return;

    const isMuted = localStorage.getItem('isMuted') === 'true';

    if (isMuted) {
        // Unmuting - restore to previous volume
        const previousVolume = localStorage.getItem('previousVolume');
        const volume = previousVolume ? parseInt(previousVolume) : 100;
        localStorage.setItem('isMuted', 'false');
        localStorage.setItem('volume', volume);

        if (player instanceof HTMLIFrameElement) {
            player.contentWindow.postMessage({
                type: 'setVolume',
                volume: volume / 100
            }, '*');
        } else {
            player.volume = volume / 100;
        }

        volumeBtn.innerHTML = '🔊';
        volumeSlider.value = volume;
    } else {
        // Muting - store current volume before setting to 0
        const currentVolume = volumeSlider.value;
        if (currentVolume > 0) {
            localStorage.setItem('previousVolume', currentVolume);
        }
        localStorage.setItem('isMuted', 'true');
        localStorage.setItem('volume', '0');

        if (player instanceof HTMLIFrameElement) {
            player.contentWindow.postMessage({
                type: 'setVolume',
                volume: 0
            }, '*');
        } else {
            player.volume = 0;
        }

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
