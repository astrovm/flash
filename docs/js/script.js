window.RufflePlayer = window.RufflePlayer || {};
const loadRuffleSWF = (gameId) => {
    const ruffle = window.RufflePlayer.newest();
    const player = ruffle.createPlayer();
    player.style.width = "825px";
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

const iframeGames = {
    "inside-the-firewall": "https://4st.li/insidethefirewall/",
};

const loadIframe = (gameId) => {
    const player = document.createElement("iframe");
    player.width = "825px";
    player.height = "600px";
    player.allow = "fullscreen";
    player.src = iframeGames[gameId];
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
        const hashElement = document.querySelector(
            `a[href="${window.location.hash}"]`
        );
        const gameType = hashElement.className;

        switch (gameType) {
            case "swf":
                const parseUrl = new URL(url);
                if (parseUrl.hostname !== window.location.hostname) {
                    const file = url.split("/").pop();
                    const gameId = window.location.hash.substring(1);
                    if (gameId == "wachk-a-kass") {
                        url = `swf/${gameId}/${file}`;
                    }
                }
                break;
            default:
                break;
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
