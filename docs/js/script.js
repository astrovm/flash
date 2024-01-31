window.RufflePlayer = window.RufflePlayer || {};
const loadRuffleSWF = (file) => {
    const ruffle = window.RufflePlayer.newest();
    const player = ruffle.createPlayer();
    player.style.width = "825px";
    player.style.height = "600px";
    const flashContainer = document.getElementById("flash-container");
    flashContainer.appendChild(player);
    player.load(file);
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

const updateFlashContainer = () => {
    if (window.location.hash) {
        const gameId = window.location.hash.substring(1);
        loadRuffleSWF(`swf/${gameId}.swf`);
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
