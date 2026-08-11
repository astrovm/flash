import { defineApplication } from "../core/application.js";

const GAME_WIDTH = 586;
const GAME_HEIGHT = 406;

const runtimeUrl = () => {
  const configuredRoot = window.ASTRO_GAME_ROOTS?.solitaire;
  const root = configuredRoot || "iframe/solitaire/";
  const normalizedRoot = root.endsWith("/") ? root : `${root}/`;
  const url = new URL(`${normalizedRoot}index.html`, document.baseURI);
  url.search = new URLSearchParams({
    root: "boxedwine",
    app: "xp-solitaire",
    p: "sol.exe",
    sound: "false",
    resolution: "800x600",
  });
  return url.href;
};

const mountSolitaire = () => {
  const host = document.createElement("div");
  host.className = "window-content boxedwine-solitaire-host";

  const frame = document.createElement("iframe");
  frame.className = "boxedwine-solitaire-frame";
  frame.title = "Windows XP Solitaire";
  frame.allow = "fullscreen";
  frame.src = runtimeUrl();
  host.appendChild(frame);

  const updateLayout = () => {
    const availableWidth = host.clientWidth || GAME_WIDTH;
    const availableHeight = host.clientHeight || GAME_HEIGHT;
    const scale = Math.min(
      availableWidth / GAME_WIDTH,
      availableHeight / GAME_HEIGHT,
    );
    const left = (availableWidth - GAME_WIDTH * scale) / 2;
    const top = (availableHeight - GAME_HEIGHT * scale) / 2;
    frame.style.setProperty("--solitaire-scale", String(scale));
    frame.style.setProperty("--solitaire-left", `${left}px`);
    frame.style.setProperty("--solitaire-top", `${top}px`);
  };
  const resizeObserver = window.ResizeObserver
    ? new ResizeObserver(updateLayout)
    : null;
  resizeObserver?.observe(host);
  updateLayout();

  return {
    element: host,
    unmount() {
      resizeObserver?.disconnect();
      frame.src = "about:blank";
      frame.remove();
    },
  };
};

export const solitaireApplication = defineApplication({
  id: "__solitaire",
  title: "Solitaire",
  icon: "Solitaire.png",
  kind: "native-game",
  window: {
    width: 592,
    height: 438,
    className: "xp-native-solitaire-window",
    resizable: true,
    maximizable: true,
  },
  mount: mountSolitaire,
});
