export const applicationMetadata = {
  id: "__spider-solitaire",
  title: "Spider Solitaire",
  icon: "SpiderSolitaire.png",
  kind: "native-game",
  deepLinkId: "spider-solitaire",
  // spider.exe opens maximized; restored, it keeps at least a 600 by 400
  // client area.
  window: {
    width: 608,
    height: 454,
    startMaximized: true,
    className: "xp-spider-window",
  },
};
