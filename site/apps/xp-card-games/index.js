import { defineBoxedWineCardGame } from "../core/boxedwine-card-game.js";

export const xpCardGameApplications = [
  defineBoxedWineCardGame({
    id: "freecell",
    title: "FreeCell",
    icon: "FreeCell.png",
    archive: "xp-freecell",
    width: 646,
    height: 479,
    nativeWidth: 640,
    nativeHeight: 448,
  }),
  defineBoxedWineCardGame({
    id: "spider-solitaire",
    title: "Spider Solitaire",
    icon: "SpiderSolitaire.png",
    archive: "xp-spider-solitaire",
    width: 800,
    height: 600,
    nativeHeight: 569,
  }),
];
