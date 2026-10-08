export const applicationMetadata = {
  id: "__hearts",
  title: "Hearts",
  icon: "Hearts.png",
  kind: "native-game",
  deepLinkId: "hearts",
  // mshearts.exe opens 540 by 480 with a fixed frame and no maximize box.
  window: {
    width: 540,
    height: 480,
    maximizable: false,
    resizable: false,
    className: "xp-hearts-window",
  },
};
