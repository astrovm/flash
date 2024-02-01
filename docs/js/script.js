const gamesList = {
    "inside-the-firewall": {
        width: "725px",
    },
    "la-isla-de-lo-mono": {
        width: "725px",
    },
    "dirt-bike": {
        width: "750px",
    },
    "dirt-bike-2": {
        width: "750px",
    },
    "dark-cut": {
        width: "825px",
    },
    "simpsons-wrecking-ball": {
        width: "800px",
    },
    "knd-numbuh-generator": {
        width: "875px",
    },
    "knd-operation-startup": {
        width: "900px",
    },
    "big-truck-adventures": {
        width: "750px",
    },
    "big-truck-adventures-2": {
        width: "750px",
    },
    "captain-usa": {
        width: "800px",
    },
    "bike-mania": {
        width: "700px",
    },
    "super-smash-flash": {
        width: "1050px",
    },
    "whack-a-kass": {
        width: "600px",
    },
};

window.RufflePlayer = window.RufflePlayer || {};
const loadRuffleSWF = (gameId) => {
    const ruffle = window.RufflePlayer.newest();
    const player = ruffle.createPlayer();
    player.style.width = gamesList[gameId]["width"];
    player.style.height = "600px";
    const flashContainer = document.getElementById("flash-container");
    flashContainer.appendChild(player);
    player.load({
        url: `swf/${gameId}/main.swf`,
        base: `swf/${gameId}`,
    });
};

const clearElement = (id) => {
    const element = document.getElementById(id);
    element.innerHTML = "";
};

const scrollTo = (id) => {
    const element = document.getElementById(id);
    element.scrollIntoView();
};

const updateDocumentTitle = () => {
    if (window.location.hash) {
        const hashElement = document.querySelector(
            `a[href="${window.location.hash}"]`
        );
        document.title = `${hashElement.textContent}`;
    } else {
        const titleElement = document.getElementById("title");
        document.title = `${titleElement.textContent}`;
    }
};

const loadIframe = (gameId) => {
    const player = document.createElement("iframe");
    player.width = gamesList[gameId]["width"];
    player.height = "600px";
    player.allow = "fullscreen";
    player.src = `iframe/${gameId}`;
    const flashContainer = document.getElementById("flash-container");
    flashContainer.appendChild(player);
};

const updateFlashContainer = () => {
    if (window.location.hash) {
        const hashElement = document.querySelector(
            `a[href="${window.location.hash}"]`
        );
        const gameType = hashElement.className;
        const gameId = window.location.hash.substring(1);

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
    }
};

window.addEventListener("load", () => {
    updateDocumentTitle();
    updateFlashContainer();
});

window.addEventListener("hashchange", () => {
    updateDocumentTitle();
    scrollTo("title");
    clearElement("flash-container");
    updateFlashContainer();
});

// url spoofing https://github.com/ruffle-rs/ruffle/issues/1486
((originalFetch) => {
    const changeUrl = (url) => {
        console.log(`URL spoof log: ${url}`);

        const parseUrl = new URL(url);
        if (parseUrl.hostname !== window.location.hostname) {
            const hashElement = document.querySelector(
                `a[href="${window.location.hash}"]`
            );
            const gameType = hashElement.className;

            switch (gameType) {
                case "swf":
                    const file = url.split("/").pop();
                    const gameId = window.location.hash.substring(1);
                    const spoofUrl = `swf/${gameId}/${file}`;
                    return spoofUrl;
                default:
                    break;
            }
        }
        return url;
    };

    window.fetch = (...args) => {
        let a = Array.from(args);
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

if ("serviceWorker" in navigator) {
    navigator.serviceWorker
        .register("sw.js")
        .then((registration) => {
            console.log("Service Worker registered with scope:", registration.scope);
        })
        .catch((error) => {
            console.error("Service Worker registration failed:", error);
        });
}
