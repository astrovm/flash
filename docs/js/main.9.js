"use strict";

const gamesList = {
    "big-truck-adventures": {
        type: "swf",
        frameRate: 45,
    },
    "big-truck-adventures-2": {
        type: "swf",
        frameRate: 45,
    },
    "bike-mania": {
        type: "swf",
        frameRate: 60,
    },
    "bike-mania-2": {
        type: "swf",
        frameRate: 60,
    },
    "bike-mania-3": {
        type: "swf",
        frameRate: 60,
    },
    "captain-usa": {
        type: "swf",
    },
    "dark-cut": {
        type: "swf",
    },
    "dirt-bike": {
        type: "swf",
    },
    "dirt-bike-2": {
        type: "swf",
    },
    "inside-the-firewall": {
        aspectRatio: 480 / 360,
        type: "iframe",
    },
    "knd-numbuh-generator": {
        type: "swf",
        frameRate: 45,
    },
    "knd-operation-startup": {
        type: "swf",
        frameRate: 30,
    },
    "la-isla-de-lo-mono": {
        type: "swf",
    },
    "metal-slug-brutal": {
        type: "swf",
    },
    "portal-flash": {
        type: "swf",
    },
    "simpsons-wrecking-ball": {
        type: "swf",
    },
    "super-smash-flash": {
        type: "swf",
    },
    "ultimate-flash-sonic": {
        type: "swf",
    },
    "whack-a-kass": {
        type: "swf",
    },
    "stunt-dirt-bike": {
        type: "swf",
    },
    "bike-mania-4": {
        type: "swf",
        frameRate: 60,
    },
    "bike-mania-5": {
        type: "swf",
        frameRate: 60,
    },
    "bike-mania-arena": {
        type: "swf",
        frameRate: 60,
    },
    "bike-mania-arena-2": {
        type: "swf",
        frameRate: 60,
    },
    "bike-mania-arena-3": {
        type: "swf",
        frameRate: 60,
    },
    "bike-mania-arena-4": {
        type: "swf",
        frameRate: 60,
    },
    "bike-mania-arena-5": {
        type: "swf",
        frameRate: 60,
    },
    "eds-candy-machine": {
        type: "swf",
    },
    "dexter-runaway-robot": {
        type: "swf",
    },
    "do-not-press": {
        type: "swf",
    },
    "learn-to-fly": {
        type: "swf",
    },
    "learn-to-fly-2": {
        type: "swf",
    },
    "learn-to-fly-3": {
        type: "swf",
    },
    "riddle-school": {
        type: "swf",
    },
    "riddle-school-2": {
        type: "swf",
    },
    "sugar-sugar": {
        type: "swf",
        spoofUrl: "https://www.friv.com/z/games/sugarsugar",
    },
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
};

window.addEventListener("resize", () => {
    const player = document.getElementById("player");
    if (player) {
        scaleGame(player);
    }
});

window.RufflePlayer = window.RufflePlayer || {};
const loadRuffleSWF = (gameId) => {
    const ruffle = window.RufflePlayer.newest();
    const player = ruffle.createPlayer();
    player.setAttribute("id", "player");
    scaleGame(player);

    const flashContainer = document.getElementById("flash-container");
    flashContainer.innerHTML = "";
    flashContainer.appendChild(player);

    player.load({
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
    });

    player.addEventListener("loadedmetadata", () => {
        scaleGame(player);
    });
};

const loadIframe = (gameId) => {
    const player = document.createElement("iframe");
    player.setAttribute("id", "player");
    player.allow = "fullscreen";
    player.src = `iframe/${gameId}/`;
    scaleGame(player);

    const flashContainer = document.getElementById("flash-container");
    flashContainer.innerHTML = "";
    flashContainer.appendChild(player);
};

const scrollTo = (id) => {
    const element = document.getElementById(id);
    element.scrollIntoView();
};

const updateDocumentTitle = () => {
    if (window.location.hash && gamesList[window.location.hash.substring(1)]) {
        const hashElement = document.querySelector(
            `a[href="${window.location.hash}"]`
        );
        document.title = `${hashElement.textContent}`;
    } else {
        const titleElement = document.getElementById("title");
        document.title = `${titleElement.textContent}`;
    }
};

const updateFlashContainer = () => {
    if (window.location.hash && gamesList[window.location.hash.substring(1)]) {
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
    } else {
        const flashContainer = document.getElementById("flash-container");
        flashContainer.innerHTML = "";
    }
};

const moveGameLink = () => {
    if (window.location.hash && gamesList[window.location.hash.substring(1)]) {
        const gameLink = document.querySelector(
            `a[href="${window.location.hash}"]`
        );
        const gameList = document.getElementById("list-container");
        gameList.prepend(gameLink);
    }
};

window.addEventListener("load", () => {
    updateDocumentTitle();
    updateFlashContainer();
    moveGameLink();
    offlineModeService();
});

window.addEventListener("hashchange", () => {
    updateDocumentTitle();
    scrollTo("title");
    updateFlashContainer();
    moveGameLink();
});

// url spoofing https://github.com/ruffle-rs/ruffle/issues/1486
((originalFetch) => {
    const changeUrl = (url) => {
        if (!url) {
            return url;
        }

        const parseUrl = new URL(url);
        if (parseUrl.hostname !== window.location.hostname) {
            const gameId = window.location.hash.substring(1);
            const gameType = gamesList[gameId].type;

            switch (gameType) {
                case "swf":
                    const file = url.split("?")[0].split("/").pop();
                    const spoofUrl = `swf/${gameId}/${file}`;
                    return spoofUrl;
                default:
                    break;
            }
        }
        return url;
    };

    window.fetch = async (...args) => {
        const argsArray = Array.from(args);
        const originalUrl = argsArray[0]?.url;
        const changedUrl = changeUrl(originalUrl);
        if (changedUrl !== originalUrl) {
            argsArray[0] = changedUrl;
            const response = await originalFetch.apply(window, argsArray);
            const modifiedResponse = new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
            });
            Object.defineProperty(modifiedResponse, "url", { value: originalUrl });
            console.log(`URL spoofed: ${originalUrl} => ${changedUrl}`);
            return modifiedResponse;
        }
        return originalFetch.apply(window, argsArray);
    };
})(window.fetch);

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
