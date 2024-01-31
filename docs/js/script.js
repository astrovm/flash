window.RufflePlayer = window.RufflePlayer || {};
const loadRuffleSWF = (file) => {
    const ruffle = window.RufflePlayer.newest();
    const player = ruffle.createPlayer();
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

const checkLocationHash = () => {
    if (window.location.hash) {
        const gameId = window.location.hash.substring(1);
        loadRuffleSWF(`swf/${gameId}.swf`);
    }
};

window.addEventListener("load", () => {
    checkLocationHash();
});

window.addEventListener("hashchange", () => {
    scrollTo("title");
    clearElement("flash-container");
    checkLocationHash();
});
