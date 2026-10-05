// @ts-nocheck -- FreeCell's rules module is untyped browser JavaScript.
import { describe, expect, test } from "bun:test";

import {
  EMPTY,
  applyStep,
  canMoveToCell,
  canStack,
  cardsLeft,
  cloneBoard,
  createRandom,
  deal,
  emptyColumnCount,
  freeCellCount,
  homeRank,
  isSafeHomeMove,
  isValidGameNumber,
  maxMovable,
  planAutoMoves,
  planColumnMove,
  randomGameNumber,
  remainingMoves,
  revertStep,
  runLength,
} from "../site/apps/freecell/game.js";

// Cards are rank * 4 + suit: clubs, diamonds, hearts, spades.
const SUITS = "CDHS";
const RANKS = "A23456789TJQK";
const card = (name) => RANKS.indexOf(name[0]) * 4 + SUITS.indexOf(name[1]);
const name = (value) => RANKS[value >> 2] + SUITS[value % 4];
const names = (cards) => cards.map(name).join(" ");
const board = ({ cells = [], columns = [], homes = {} } = {}) => {
  const result = deal(1);
  result.cells = Array(8).fill(EMPTY);
  cells.forEach((value, row) => {
    result.cells[row] = value ? card(value) : EMPTY;
  });
  result.columns = Array.from({ length: 8 }, (_, index) =>
    (columns[index] || []).map(card),
  );
  result.homeSlots = Array(4).fill(EMPTY);
  Object.entries(homes).forEach(([suit, top], index) => {
    result.cells[4 + index] = card(top);
    result.homeSlots[SUITS.indexOf(suit)] = 4 + index;
  });
  return result;
};

describe("FreeCell deals", () => {
  test("numbered games match freecell.exe's Microsoft shuffle", () => {
    expect(deal(1).columns.map(names)).toEqual([
      "JD KD 2S 4C 3S 6D 6S",
      "2D KC KS 5C TD 8S 9C",
      "9H 9S 9D TS 4S 8D 2H",
      "JC 5S QD QH TH QS 6H",
      "5D AD JS 4H 8H 6C",
      "7H QC AS AC 2C 3D",
      "7C KH AH 4D JH 8C",
      "5H 3H 3C 7S 7D TC",
    ]);
    expect(names(deal(617).columns[0])).toBe("7D TD TH KD 4C 4S JD");
  });

  test("games -1 and -2 are the hidden ordered deals", () => {
    expect(names(deal(-1).columns[0])).toBe("AC 3C 5C 7C 9C JC KC");
    expect(names(deal(-1).columns[7])).toBe("QS TS 8S 6S 4S 2S");
    expect(names(deal(-2).columns[0])).toBe("AS KS QS JS TS 9S 8S");
    expect(names(deal(-2).columns[7])).toBe("7C 6C 5C 4C 3C 2C");
  });

  test("the C runtime's rand() picks suggested games from 1 to 32767", () => {
    const random = createRandom(1);
    expect([random(), random(), random()]).toEqual([41, 18467, 6334]);
    for (const now of [0, 1_000, 86_400_000, Date.UTC(2026, 9, 5)]) {
      const number = randomGameNumber(now);
      expect(number).toBeGreaterThan(0);
      expect(number).toBeLessThan(32768);
    }
    expect(randomGameNumber(5_000)).toBe(randomGameNumber(5_999));
    expect(typeof randomGameNumber()).toBe("number");
    // A seed whose third value is 0 draws again.
    let seed = 0;
    while (createRandom(seed)() || createRandom(seed)() !== 0) seed += 1;
    expect(seed).toBeGreaterThanOrEqual(0);
  });

  test("game numbers run from -2 to 1000000, without 0", () => {
    expect(
      [-3, -2, -1, 0, 1, 1000000, 1000001, 1.5].map((value) =>
        Boolean(isValidGameNumber(value)),
      ),
    ).toEqual([false, true, true, false, true, true, false, false]);
  });
});

describe("FreeCell moves", () => {
  test("columns stack down in alternating colors", () => {
    expect(canStack(card("5H"), card("6S"))).toBeTrue();
    expect(canStack(card("5H"), card("6D"))).toBeFalse();
    expect(canStack(card("5H"), card("7S"))).toBeFalse();
  });

  test("cells take any card when free, and home takes the next of its suit", () => {
    const state = board({ cells: ["KS"], homes: { H: "4H" } });
    expect(canMoveToCell(state, card("2C"), 0)).toBeFalse();
    expect(canMoveToCell(state, card("2C"), 1)).toBeTrue();
    expect(canMoveToCell(state, card("5H"), 4)).toBeTrue();
    expect(canMoveToCell(state, card("6H"), 4)).toBeFalse();
    expect(canMoveToCell(state, card("5D"), 4)).toBeFalse();
    expect(canMoveToCell(state, card("AD"), 5)).toBeTrue();
    expect(canMoveToCell(state, card("2D"), 5)).toBeFalse();
  });

  test("runs count from the bottom until they fit, or the whole run to an empty column", () => {
    const state = board({
      columns: [["KC", "9H", "8S", "7D"], ["9C"], [], ["2S"], ["QH", "4C"]],
    });
    expect(runLength(state, 1, 1)).toBe(1);
    expect(runLength(state, 1, 3)).toBe(3);
    expect(runLength(state, 1, 4)).toBe(0);
    expect(runLength(state, 4, 3)).toBe(1);
    expect(runLength(state, 5, 3)).toBe(1);
    const onto = board({ columns: [["9H", "8S", "7D"], ["TS"], ["8C"]] });
    expect(runLength(onto, 1, 2)).toBe(3);
    expect(runLength(onto, 1, 3)).toBe(1);
    expect(maxMovable(2, 1)).toBe(6);
    expect(freeCellCount(state)).toBe(4);
    expect(emptyColumnCount(state)).toBe(4);
  });

  test("long runs park in free cells and empty columns, one card at a time", () => {
    const state = board({
      cells: ["KS", "KD", "KH"],
      columns: [["TS", "9H", "8S", "7D"], ["JH"], []],
    });
    // Two cards park in the empty column, two move, and the parked two follow.
    const steps = planColumnMove(state, 1, 2);
    expect(steps).toHaveLength(9);
    const result = cloneBoard(state);
    steps.forEach((step) => applyStep(result, step));
    expect(names(result.columns[1])).toBe("JH TS 9H 8S 7D");
    expect(result.columns[2]).toEqual([]);
    // An empty column takes only what the free cells carry, or one card.
    expect(planColumnMove(state, 1, 3)).toHaveLength(3);
    expect(
      planColumnMove(board({ columns: [["9H", "8S"], ["TC"]] }), 1, 2),
    ).toHaveLength(3);
    expect(planColumnMove(state, 1, 3, { single: true })).toEqual([
      { from: { column: 1 }, to: { column: 3 } },
    ]);
  });

  test("steps to home and back uncover the card below", () => {
    const state = board({ columns: [["2H", "AH"]] });
    const ace = { from: { column: 1 }, to: { column: 0, row: 5 } };
    applyStep(state, ace);
    expect(homeRank(state, 2)).toBe(0);
    const two = { from: { column: 1 }, to: { column: 0, row: 5 } };
    applyStep(state, two);
    expect(cardsLeft(state)).toBe(0);
    revertStep(state, two);
    expect(name(state.cells[5])).toBe("AH");
    revertStep(state, ace);
    expect(state.cells[5]).toBe(EMPTY);
    expect(homeRank(state, 2)).toBe(EMPTY);
    const free = { from: { column: 1 }, to: { column: 0, row: 0 } };
    applyStep(state, free);
    applyStep(state, { from: { column: 0, row: 0 }, to: { column: 2 } });
    expect(names(state.columns[1])).toBe("AH");
    revertStep(state, { from: { column: 0, row: 0 }, to: { column: 2 } });
    revertStep(state, free);
    expect(names(state.columns[0])).toBe("2H AH");
  });
});

describe("FreeCell automatic moves", () => {
  test("aces and twos go home, higher cards once both other colors are close", () => {
    const state = board({ homes: { C: "4C", S: "3S", H: "4H", D: "5D" } });
    expect(isSafeHomeMove(state, EMPTY)).toBeFalse();
    expect(isSafeHomeMove(board(), card("AC"))).toBeTrue();
    expect(
      isSafeHomeMove(board({ homes: { C: "AC" } }), card("2C")),
    ).toBeTrue();
    expect(isSafeHomeMove(board(), card("2C"))).toBeFalse();
    // Five of hearts waits for both black suits to reach four.
    expect(isSafeHomeMove(state, card("5H"))).toBeFalse();
    expect(
      isSafeHomeMove({ ...state, cells: [...state.cells] }, card("4H")),
    ).toBeFalse();
    expect(isSafeHomeMove(state, card("6D"))).toBeFalse();
    expect(isSafeHomeMove(state, card("5C"))).toBeTrue();
    expect(isSafeHomeMove(state, card("4S"))).toBeTrue();
    expect(
      isSafeHomeMove(board({ homes: { H: "3H" } }), card("4H")),
    ).toBeFalse();
    expect(isSafeHomeMove(state, card("KS"), true)).toBeTrue();
  });

  test("they repeat until nothing more can go home", () => {
    const state = board({
      cells: ["2C"],
      columns: [["3C", "AC"], ["2D", "AD"], ["KS"]],
    });
    const steps = planAutoMoves(state);
    const result = cloneBoard(state);
    steps.forEach((step) => applyStep(result, step));
    // The aces first, then the twos. The three of clubs waits for hearts.
    expect(steps.map(({ to }) => to.row)).toEqual([4, 5, 4, 5]);
    expect(cardsLeft(result)).toBe(2);
    // The hidden winning mode sends every card home.
    const all = cloneBoard(state);
    planAutoMoves(state, true).forEach((step) => applyStep(all, step));
    expect(cardsLeft(all)).toBe(0);
  });

  test("full tables count the moves left", () => {
    expect(remainingMoves(board())).toBe(Infinity);
    const stuck = board({
      cells: ["KS", "KH", "KD", "KC"],
      columns: [["QS"], ["QC"], ["JS"], ["JC"], ["TS"], ["TC"], ["9S"], ["9C"]],
    });
    expect(remainingMoves(stuck)).toBe(0);
    const one = cloneBoard(stuck);
    one.columns[7] = [card("8D")];
    expect(remainingMoves(one)).toBe(1);
    // A free cell card that can go home is a move.
    const home = cloneBoard(stuck);
    home.cells[0] = card("AH");
    expect(remainingMoves(home)).toBe(1);
    const many = cloneBoard(stuck);
    many.columns[0] = [card("AH")];
    many.cells[0] = card("8D");
    expect(remainingMoves(many)).toBeGreaterThan(1);
  });
});
