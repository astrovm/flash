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

function loadRuffleSWF(file) {
    const ruffle = window.RufflePlayer.newest();
    const player = ruffle.createPlayer();
    const flashContainer = document.getElementById("flash-container");
    flashContainer.innerHTML = "";
    flashContainer.appendChild(player);
    player.load(file);
    const element_to_scroll_to = document.getElementById("title");
    element_to_scroll_to.scrollIntoView();
};

window.addEventListener("load", (event) => {
    const listContainer = document.getElementById("list-container");
    listContainer.innerHTML = "";

    gamesList.forEach((game) => {
        const p = document.createElement("p");
        const a = document.createElement("a");

        a.href = `#${game.id}`;
        a.onclick = () => loadRuffleSWF(`swf/${game.id}.swf`);
        a.textContent = game.name;

        p.appendChild(a);
        listContainer.appendChild(p);
    });

    if (window.location.hash) {
        const game = window.location.hash.substring(1);
        loadRuffleSWF(`swf/${game}.swf`);
    };
});
