import { defineApplication } from "../core/application.js";
import { mountBoxedWineApplication } from "../core/boxedwine.js";

const defineXpCardGame = ({
  id,
  title,
  icon,
  archive,
  executable,
  width,
  height,
}) =>
  defineApplication({
    id: `__${id}`,
    title,
    icon,
    kind: "native-game",
    deepLinkId: id,
    offlineGameId: id,
    window: {
      width,
      height,
      fitToWorkArea: true,
      resizable: false,
      maximizable: false,
    },
    mount: () =>
      mountBoxedWineApplication({
        title: `Windows XP ${title}`,
        packageId: id,
        archive,
        executable,
        nativeWidth: width,
        nativeHeight: height - 32,
        frameTop: 32,
        background: "#27811f",
      }),
  });

export const xpCardGameApplications = [
  defineXpCardGame({
    id: "freecell",
    title: "FreeCell",
    icon: "FreeCell.png",
    archive: "xp-freecell",
    executable: "freecell.exe",
    width: 700,
    height: 520,
  }),
  defineXpCardGame({
    id: "spider-solitaire",
    title: "Spider Solitaire",
    icon: "SpiderSolitaire.png",
    archive: "xp-spider-solitaire",
    executable: "spider.exe",
    width: 800,
    height: 600,
  }),
];
