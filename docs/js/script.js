"use strict";

const gamesList = {
    "big-truck-adventures": {
        type: "swf",
    },
    "big-truck-adventures-2": {
        type: "swf",
    },
    "bike-mania": {
        type: "swf",
    },
    "bike-mania-2": {
        type: "swf",
    },
    "bike-mania-3": {
        type: "swf",
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
        aspectRatio: 1.33,
        type: "iframe",
    },
    "knd-numbuh-generator": {
        type: "swf",
    },
    "knd-operation-startup": {
        type: "swf",
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
    },
    "bike-mania-5": {
        type: "swf",
    },
    "bike-mania-arena": {
        type: "swf",
    },
    "bike-mania-arena-2": {
        type: "swf",
    },
    "bike-mania-arena-3": {
        type: "swf",
    },
    "bike-mania-arena-4": {
        type: "swf",
    },
    "bike-mania-arena-5": {
        type: "swf",
    },
    "eds-candy-machine": {
        type: "swf",
    },
    "dexter-runaway-robot": {
        type: "swf",
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
    const width = player.metadata?.width || 5;
    const height = player.metadata?.height || 4;
    const aspectRatio = gamesList[gameId].aspectRatio || width / height;
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

    const flashContainer = document.getElementById("flash-container");
    flashContainer.innerHTML = "";
    flashContainer.appendChild(player);

    scaleGame(player);

    player.load({
        url: `swf/${gameId}/main.swf`,
        base: `swf/${gameId}/`,
        scale: "exactfit",
        forceScale: true,
        openUrlMode: "confirm",
        showSwfDownload: true,
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

    const flashContainer = document.getElementById("flash-container");
    flashContainer.innerHTML = "";
    flashContainer.appendChild(player);

    scaleGame(player);
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
        console.log(`URL spoof log: ${url}`);

        const parseUrl = new URL(url);
        if (parseUrl.hostname !== window.location.hostname) {
            const gameId = window.location.hash.substring(1);
            const gameType = gamesList[gameId].type;

            switch (gameType) {
                case "swf":
                    const file = url.split("/").pop();
                    const spoofUrl = `swf/${gameId}/${file}`;
                    return spoofUrl;
                default:
                    break;
            }
        }
        return url;
    };

    window.fetch = (...args) => {
        const a = Array.from(args);
        if (typeof a[0] === "string") {
            a[0] = changeUrl(a[0]);
        } else if (a[0] && typeof a[0].url === "string") {
            const changedUrl = changeUrl(a[0].url);
            if (changedUrl !== a[0].url) {
                a[0] = changedUrl;
            }
        }
        return originalFetch.apply(window, a);
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
