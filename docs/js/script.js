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
