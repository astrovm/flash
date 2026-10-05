// @ts-nocheck -- Solitaire's rules module is untyped browser JavaScript.
import { describe, expect, test } from "bun:test";

import {
  DECK,
  FOUNDATIONS,
  TABLEAU,
  WASTE,
  canBuildFoundation,
  canBuildTableau,
  canDrop,
  canRecycle,
  canTurnDeckOver,
  clonePiles,
  deal,
  drawCards,
  foundationFor,
  isWon,
  moveCards,
  moveEvent,
  recycle,
  scoreAfter,
  seedFromTime,
  timeBonus,
} from "../site/apps/solitaire/game.js";

const SUITS = "CDHS";
const RANKS = "A23456789TJQK";
const card = (name) => RANKS.indexOf(name[0]) * 4 + SUITS.indexOf(name[1]);
const name = ({ card: value }) => RANKS[value >> 2] + SUITS[value % 4];
const up = (value) => ({ card: card(value), up: true });

describe("Solitaire deals", () => {
  test("a clock seed reproduces sol.exe's shuffle and deal", () => {
    // The XP VM dealt this game at a time whose low 15 bits were 30162.
    const piles = deal(30162);
    expect(TABLEAU.map((pile) => name(piles[pile].at(-1)))).toEqual([
      "QD",
      "KC",
      "8S",
      "5S",
      "5C",
      "AS",
      "7S",
    ]);
    expect(TABLEAU.map((pile) => piles[pile].length)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(piles[TABLEAU[6]].filter((entry) => entry.up)).toHaveLength(1);
    expect(piles[DECK]).toHaveLength(24);
    // Draw Three turns three cards; the last turned ends on top.
    drawCards(piles, 3);
    expect(piles[WASTE].map(name)).toEqual(["TH", "6H", "7C"]);
    drawCards(piles, 3);
    expect(piles[WASTE].slice(3).map(name)).toEqual(["JS", "3S", "QH"]);
    expect(seedFromTime(1790014930000)).toBe(30162);
    expect(seedFromTime()).toBeLessThan(32768);
  });

  test("the waste turns back over into the deck", () => {
    const piles = deal(1);
    while (piles[DECK].length) drawCards(piles, 3);
    expect(drawCards(piles, 3)).toBe(0);
    const order = piles[WASTE].map(name);
    recycle(piles);
    expect(piles[WASTE]).toEqual([]);
    expect(piles[DECK].map(name)).toEqual(order.reverse());
    expect(piles[DECK].every((entry) => !entry.up)).toBeTrue();
    expect(clonePiles(piles)).toEqual(piles);
  });
});

describe("Solitaire moves", () => {
  test("tableau piles build down in alternating colors, kings on empty piles", () => {
    expect(canBuildTableau([], card("KS"))).toBeTrue();
    expect(canBuildTableau([], card("QS"))).toBeFalse();
    expect(canBuildTableau([up("8S")], card("7H"))).toBeTrue();
    expect(canBuildTableau([up("8S")], card("7C"))).toBeFalse();
    expect(canBuildTableau([up("8S")], card("6H"))).toBeFalse();
    expect(
      canBuildTableau([{ card: card("8S"), up: false }], card("7H")),
    ).toBeFalse();
  });

  test("foundations take one card, from the ace up its suit", () => {
    expect(canBuildFoundation([], [card("AD")])).toBeTrue();
    expect(canBuildFoundation([], [card("2D")])).toBeFalse();
    expect(canBuildFoundation([up("AD")], [card("2D")])).toBeTrue();
    expect(canBuildFoundation([up("AD")], [card("2H")])).toBeFalse();
    expect(
      canBuildFoundation([up("AD")], [card("2D"), card("AC")]),
    ).toBeFalse();
    const piles = deal(1).map(() => []);
    piles[FOUNDATIONS[1]] = [up("AH")];
    expect(canDrop(piles, FOUNDATIONS[0], [card("AS")])).toBeTrue();
    expect(canDrop(piles, TABLEAU[0], [card("KS")])).toBeTrue();
    expect(canDrop(piles, WASTE, [card("KS")])).toBeFalse();
    expect(foundationFor(piles, card("2H"))).toBe(FOUNDATIONS[1]);
    expect(foundationFor(piles, card("AC"))).toBe(FOUNDATIONS[0]);
    expect(foundationFor(piles, card("3H"))).toBeUndefined();
    moveCards(piles, FOUNDATIONS[1], 0, TABLEAU[0]);
    expect(piles[TABLEAU[0]].map(name)).toEqual(["AH"]);
  });

  test("a full set of foundations wins", () => {
    const piles = deal(1).map(() => []);
    expect(isWon(piles)).toBeFalse();
    FOUNDATIONS.forEach((pile) => {
      piles[pile] = Array.from({ length: 13 }, () => up("AS"));
    });
    expect(isWon(piles)).toBeTrue();
  });
});

describe("Solitaire scoring", () => {
  const standard = { score: 10, scoring: "standard", draw: 3, passes: 0 };

  test("moves score from sol.exe's Standard and Vegas tables", () => {
    expect(moveEvent(WASTE, FOUNDATIONS[0])).toBe("foundation");
    expect(moveEvent(TABLEAU[0], FOUNDATIONS[0])).toBe("foundation");
    expect(moveEvent(FOUNDATIONS[0], FOUNDATIONS[1])).toBeNull();
    expect(moveEvent(WASTE, TABLEAU[0])).toBe("wasteToTableau");
    expect(moveEvent(FOUNDATIONS[0], TABLEAU[0])).toBe("foundationToTableau");
    expect(moveEvent(TABLEAU[0], TABLEAU[1])).toBeNull();
    expect(moveEvent(WASTE, DECK)).toBeNull();
    expect(scoreAfter(standard, "foundation")).toBe(20);
    expect(scoreAfter(standard, "foundationToTableau")).toBe(0);
    expect(scoreAfter({ ...standard, scoring: "vegas" }, "deal")).toBe(-42);
    expect(scoreAfter({ ...standard, scoring: "none" }, "foundation")).toBe(10);
  });

  test("recycling costs 100 with Draw One and 20 after three passes with Draw Three", () => {
    expect(
      scoreAfter({ ...standard, score: 150, draw: 1, passes: 1 }, "recycle"),
    ).toBe(50);
    expect(scoreAfter({ ...standard, draw: 1, passes: 0 }, "recycle")).toBe(10);
    expect(scoreAfter({ ...standard, passes: 3 }, "recycle")).toBe(10);
    expect(scoreAfter({ ...standard, score: 30, passes: 4 }, "recycle")).toBe(
      10,
    );
    // Vegas allows one pass with Draw One and three with Draw Three.
    expect(canRecycle({ scoring: "vegas", draw: 1, passes: 0 })).toBeFalse();
    expect(canRecycle({ scoring: "vegas", draw: 3, passes: 1 })).toBeTrue();
    expect(canRecycle({ scoring: "vegas", draw: 3, passes: 2 })).toBeFalse();
    expect(canRecycle({ scoring: "standard", draw: 1, passes: 9 })).toBeTrue();
    // An empty waste has nothing to turn over.
    const state = { scoring: "standard", draw: 3, passes: 0 };
    expect(canTurnDeckOver(state, 0)).toBeFalse();
    expect(canTurnDeckOver(state, 5)).toBeTrue();
  });

  test("timed games won after 30 seconds earn a bonus", () => {
    expect(timeBonus(29)).toBe(0);
    expect(timeBonus(30)).toBe(23310);
    expect(timeBonus(200)).toBe(3500);
  });
});
