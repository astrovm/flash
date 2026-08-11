// @ts-nocheck -- the browser game model is intentionally authored as native JavaScript.
import { describe, expect, test } from "bun:test";

import {
  canPlaceOnFoundation,
  canPlaceOnTableau,
  createDeck,
  createSolitaireGame,
} from "../site/apps/solitaire/model.js";

const card = (rank: number, suit: string, faceUp = true) => ({
  id: 1,
  rank,
  suit,
  faceUp,
});

describe("Windows XP Solitaire rules", () => {
  test("builds and deals a complete 52-card deck", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map(({ id }) => id)).size).toBe(52);
    expect(deck[0]).toMatchObject({ rank: 1, suit: "clubs" });
    expect(deck[51]).toMatchObject({ rank: 13, suit: "spades" });

    const game = createSolitaireGame({ random: () => 0.25 });
    expect(game.stock).toHaveLength(24);
    expect(game.tableau.map((pile) => pile.length)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(
      game.tableau.every(
        (pile) =>
          pile.at(-1)?.faceUp && pile.slice(0, -1).every((c) => !c.faceUp),
      ),
    ).toBeTrue();
  });

  test("uses XP tableau and foundation placement rules", () => {
    expect(canPlaceOnTableau(card(6, "hearts"), [card(7, "clubs")])).toBeTrue();
    expect(
      canPlaceOnTableau(card(6, "diamonds"), [card(7, "hearts")]),
    ).toBeFalse();
    expect(canPlaceOnTableau(card(13, "spades"), [])).toBeTrue();
    expect(canPlaceOnTableau(card(12, "spades"), [])).toBeFalse();
    expect(canPlaceOnFoundation(card(1, "hearts"), [], "hearts")).toBeTrue();
    expect(
      canPlaceOnFoundation(card(2, "hearts"), [card(1, "hearts")], "hearts"),
    ).toBeTrue();
    expect(canPlaceOnFoundation(card(1, "clubs"), [], "hearts")).toBeFalse();
  });

  test("draws three cards and recycles the waste in the same order", () => {
    const game = createSolitaireGame({ random: () => 0.5, drawCount: 3 });
    const firstDraw = game.stock
      .slice(-3)
      .toReversed()
      .map(({ id }) => id);
    expect(game.draw()).toBeTrue();
    expect(game.waste.slice(-3).map(({ id }) => id)).toEqual(firstDraw);
    while (game.stock.length) game.draw();
    const topBeforeRecycle = game.waste[0].id;
    expect(game.draw()).toBeTrue();
    expect(game.waste).toHaveLength(0);
    expect(game.stock.at(-1)?.id).toBe(topBeforeRecycle);
  });

  test("moves legal runs, reveals covered cards, scores, and undoes", () => {
    const game = createSolitaireGame({ random: () => 0.1 });
    game.stock = [];
    game.waste = [];
    game.foundations = { clubs: [], diamonds: [], hearts: [], spades: [] };
    game.tableau = [
      [card(2, "clubs", false), card(12, "spades")],
      [card(13, "hearts")],
      [],
      [],
      [],
      [],
      [],
    ];
    game.score = 0;
    game.history = [];
    expect(
      game.move(
        { type: "tableau", column: 0, index: 1 },
        { type: "tableau", column: 1 },
      ),
    ).toBeTrue();
    expect(game.tableau[0][0].faceUp).toBeTrue();
    expect(game.score).toBe(5);
    expect(game.undo()).toBeTrue();
    expect(game.tableau[0]).toHaveLength(2);
    expect(game.tableau[0][0].faceUp).toBeFalse();
    expect(game.score).toBe(0);
  });

  test("moves only exposed waste cards to a matching foundation", () => {
    const game = createSolitaireGame({ random: () => 0.75 });
    game.waste = [card(1, "diamonds")];
    game.foundations = { clubs: [], diamonds: [], hearts: [], spades: [] };
    game.score = 0;
    game.history = [];
    expect(
      game.move({ type: "waste" }, { type: "foundation", suit: "diamonds" }),
    ).toBeTrue();
    expect(game.foundations.diamonds).toHaveLength(1);
    expect(game.score).toBe(10);
    expect(
      game.move(
        { type: "foundation", suit: "diamonds" },
        { type: "foundation", suit: "hearts" },
      ),
    ).toBeFalse();
  });
});
