window.RufflePlayer = window.RufflePlayer || {};

function loadRuffleSWF(file) {
    const ruffle = window.RufflePlayer.newest();
    const player = ruffle.createPlayer();
    const flashContainer = document.getElementById("flash-container");
    flashContainer.innerHTML = ""
    flashContainer.appendChild(player);
    player.load(file);
};
