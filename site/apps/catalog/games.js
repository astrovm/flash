import { defineProgram } from "../programs/define-program.js";

const game = (id, title, icon, window) =>
  defineProgram({ id, title, icon, kind: "native-game", window });

export const nativeGameApplications = [
  game("__freecell", "FreeCell", "FreeCell.png", { width: 760, height: 540 }),
];
