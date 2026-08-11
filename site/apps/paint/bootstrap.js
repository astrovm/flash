"use strict";

try {
  localStorage.setItem("jspaint language", "en");
} catch (_error) {
  // Paint still works when storage is unavailable.
}

window.systemHooks = {
  setWallpaperCentered(canvas) {
    window.parent.postMessage(
      {
        type: "xp-paint-wallpaper",
        mode: "center",
        dataUrl: canvas.toDataURL(),
      },
      window.location.origin,
    );
  },
  setWallpaperTiled(canvas) {
    window.parent.postMessage(
      { type: "xp-paint-wallpaper", mode: "tile", dataUrl: canvas.toDataURL() },
      window.location.origin,
    );
  },
};

window.close = () => {
  window.parent.postMessage({ type: "xp-paint-close" }, window.location.origin);
};
