window.RufflePlayer = window.RufflePlayer || {};
window.addEventListener("load", (event) => {
    const ruffle = window.RufflePlayer.newest();
    const player = ruffle.createPlayer();
    const container = document.getElementById("flash-container");
    container.appendChild(player);
    player.load("swf/dirtbike.swf");
});
