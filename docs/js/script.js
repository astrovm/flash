const gamesList = [
    { id: "dirt-bike", name: "Dirt Bike" },
    { id: "dirt-bike-2", name: "Dirt Bike 2" },
    { id: "dark-cut", name: "Dark Cut" },
    { id: "simpsons-wrecking-ball", name: "The Simpsons Movie: Wrecking Ball" },
    { id: "knd-numbuh-generator", name: "KND Numbuh Generator" },
    { id: "knd-operation-startup", name: "KND Operation S.T.A.R.T.U.P." },
    { id: "big-truck-adventures", name: "Big Truck Adventures" },
    { id: "big-truck-adventures-2", name: "Big Truck Adventures 2" },
    { id: "captain-usa", name: "Captain USA" },
    { id: "bike-mania", name: "Bike Mania" },
    { id: "super-smash-flash", name: "Super Smash Flash" },
];

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

const renderGamesList = () => {
    const listContainer = document.getElementById("list-container");

    gamesList.forEach((game) => {
        const p = document.createElement("p");
        const a = document.createElement("a");

        a.href = `#${game.id}`;
        a.textContent = game.name;

        p.appendChild(a);
        listContainer.appendChild(p);
    });
};

window.addEventListener("load", () => {
    checkLocationHash();
    clearElement("list-container");
    renderGamesList();
});

window.addEventListener("hashchange", () => {
    scrollTo("title");
    clearElement("flash-container");
    checkLocationHash();
});
