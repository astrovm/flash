import { defineProgram } from "../programs/define-program.js";

const game = (id, title, icon, window) =>
  defineProgram({ id, title, icon, kind: "native-game", window });

export const nativeGameApplications = [
  game("__freecell", "FreeCell", "FreeCell.png", { width: 760, height: 540 }),
  game("__hearts", "Hearts", "Hearts.png"),
  game(
    "__internet-backgammon",
    "Internet Backgammon",
    "InternetBackgammon.png",
  ),
  game("__internet-checkers", "Internet Checkers", "InternetCheckers.png"),
  game("__internet-hearts", "Internet Hearts", "InternetHearts.png"),
  game("__internet-reversi", "Internet Reversi", "InternetReversi.png"),
  game("__internet-spades", "Internet Spades", "InternetSpades.png"),
  game("__minesweeper", "Minesweeper", "Minesweeper.png", {
    width: 184,
    height: 250,
  }),
  game("__pinball", "Pinball", "Pinball.png"),
  game("__solitaire", "Solitaire", "Solitaire.png", {
    width: 720,
    height: 520,
  }),
  game("__spider-solitaire", "Spider Solitaire", "SpiderSolitaire.png"),
];
