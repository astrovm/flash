// @ts-nocheck -- Spider Solitaire's rules module is untyped browser JavaScript.
import { describe, expect, test } from "bun:test";

import {
  COLUMNS,
  addScore,
  canDrop,
  canPickUp,
  cloneColumns,
  deal,
  dealRow,
  faceDownCount,
  findHints,
  hasCompleteRun,
  moveCards,
  rankOf,
  runStart,
  seedFromTime,
  shuffle,
  suitOf,
  undoMove,
} from "../site/apps/spider-solitaire/game.js";

const SUITS = "CDHS";
const RANKS = "A23456789TJQK";
const card = (name) => RANKS.indexOf(name[0]) * 4 + SUITS.indexOf(name[1]);
const name = (value) => RANKS[rankOf(value)] + SUITS[suitOf(value)];
const up = (value) => ({ card: card(value), up: true });
const down = (value) => ({ card: card(value), up: false });
const table = (...columns) => [
  ...columns,
  ...Array.from({ length: COLUMNS - columns.length }, () => []),
];

// The XP VM dealt this Easy game at 1791198413, its clock in seconds.
const VM_SEED = 1791198413;

describe("Spider Solitaire deals", () => {
  test("a clock seed reproduces spider.exe's shuffle, deal and stock", () => {
    const { columns, stock } = deal(VM_SEED, 1);
    expect(columns.map((cards) => name(cards.at(-1).card))).toEqual([
      "6S",
      "7S",
      "3S",
      "KS",
      "JS",
      "AS",
      "5S",
      "8S",
      "5S",
      "4S",
    ]);
    // Six cards in the first four columns, five in the rest, one face up.
    expect(columns.map((cards) => cards.length)).toEqual([
      6, 6, 6, 6, 5, 5, 5, 5, 5, 5,
    ]);
    expect(columns.map(faceDownCount)).toEqual([5, 5, 5, 5, 4, 4, 4, 4, 4, 4]);
    expect(stock).toHaveLength(50);
    // The VM's first deal from the stock.
    expect(stock.slice(0, 10).map(name)).toEqual([
      "QS",
      "TS",
      "9S",
      "TS",
      "QS",
      "8S",
      "KS",
      "KS",
      "8S",
      "7S",
    ]);
    expect(seedFromTime(VM_SEED * 1000 + 999)).toBe(VM_SEED);
    expect(seedFromTime()).toBeGreaterThan(VM_SEED - 1);
  });

  test("each difficulty plays two decks of its suits", () => {
    const suitsIn = (count) =>
      [...new Set(shuffle(7, count).map(suitOf))].sort();
    expect(suitsIn(1)).toEqual([3]);
    expect(suitsIn(2)).toEqual([2, 3]);
    expect(suitsIn(4)).toEqual([0, 1, 2, 3]);
    // Every rank shows up eight times, whatever the suits.
    for (const count of [1, 2, 4]) {
      const slots = shuffle(99, count);
      expect(slots).toHaveLength(104);
      for (let rank = 0; rank < 13; rank += 1)
        expect(slots.filter((value) => rankOf(value) === rank)).toHaveLength(8);
    }
    expect(shuffle(5, 4)).toEqual(shuffle(5, 4));
    expect(shuffle(5, 4)).not.toEqual(shuffle(6, 4));
  });
});

describe("Spider Solitaire moves", () => {
  test("a run in one suit picks up; a broken or face-down one doesn't", () => {
    const cards = [down("9H"), up("8S"), up("7S"), up("6S")];
    expect(canPickUp(cards, 1)).toBeTrue();
    expect(canPickUp(cards, 3)).toBeTrue();
    expect(canPickUp(cards, 0)).toBeFalse();
    expect(canPickUp(cards, -1)).toBeFalse();
    expect(canPickUp(cards, 4)).toBeFalse();
    expect(canPickUp([up("8S"), up("7H")], 0)).toBeFalse();
    expect(canPickUp([up("8S"), up("6S")], 0)).toBeFalse();
  });

  test("cards go on any card one rank higher, or into an empty column", () => {
    const columns = table([up("8H")], [up("7S")], [], [down("8S")]);
    expect(canDrop(columns, 1, 0, 0)).toBeTrue();
    expect(canDrop(columns, 1, 0, 2)).toBeTrue();
    expect(canDrop(columns, 0, 0, 1)).toBeFalse();
    expect(canDrop(columns, 1, 0, 1)).toBeFalse();
    expect(canDrop(columns, 2, 0, 0)).toBeFalse();
    expect(canDrop(columns, 1, 0, 3)).toBeFalse();
  });

  test("moving turns over the uncovered card, and undo turns it back", () => {
    const columns = table([down("KD"), up("7S")], [up("8H")]);
    const before = cloneColumns(columns);
    const record = moveCards(columns, 0, 1, 1);
    expect(record).toEqual({
      source: 0,
      target: 1,
      targetIndex: 1,
      turned: true,
    });
    expect(columns[0]).toEqual([up("KD")]);
    expect(columns[1].map(({ card: value }) => name(value))).toEqual([
      "8H",
      "7S",
    ]);
    undoMove(columns, record);
    expect(columns).toEqual(before);
    // Emptying a column turns nothing over, and its undo turns nothing back.
    const empty = moveCards(columns, 1, 0, 2);
    expect(empty.turned).toBeFalse();
    expect(columns[1]).toEqual([]);
    undoMove(columns, empty);
    expect(columns[1]).toEqual([up("8H")]);
  });

  test("a deal puts one face-up card on every column", () => {
    const columns = table();
    const stock = Array.from({ length: 20 }, (_, index) => index);
    expect(dealRow(columns, stock)).toBe(10);
    expect(columns.map((cards) => cards[0].card)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(columns.every((cards) => cards[0].up)).toBeTrue();
    expect(stock).toHaveLength(10);
  });

  test("a full king-to-ace run in one suit is complete", () => {
    const run = RANKS.split("")
      .reverse()
      .map((rank) => up(`${rank}S`));
    expect(hasCompleteRun(run)).toBeTrue();
    expect(hasCompleteRun([down("5D"), ...run])).toBeTrue();
    expect(hasCompleteRun(run.slice(1))).toBeFalse();
    expect(hasCompleteRun(run.slice(0, 12).concat(up("AH")))).toBeFalse();
    expect(
      hasCompleteRun([...run.slice(0, 12), up("2S"), up("AS")]),
    ).toBeFalse();
    const hidden = [...run];
    hidden[0] = down("KS");
    expect(hasCompleteRun(hidden)).toBeFalse();
    // The run must end with the ace on top.
    expect(hasCompleteRun([down("5D"), ...run.slice(0, 12)])).toBeFalse();
    expect(hasCompleteRun([...run, up("AS")].slice(1))).toBeFalse();
  });

  test("scores never drop below zero", () => {
    expect(addScore(500, -1)).toBe(499);
    expect(addScore(0, -1)).toBe(0);
    expect(addScore(10, 100)).toBe(110);
  });
});

describe("Spider Solitaire hints", () => {
  test("whole top runs move, same suit first, empty columns last", () => {
    const columns = table(
      [up("9S"), up("8S")],
      [up("9H")],
      [up("8D")],
      [],
      [down("2C"), up("5C")],
      [up("6C")],
    );
    expect(runStart(columns[0])).toBe(0);
    expect(runStart(columns[4])).toBe(1);
    expect(runStart([])).toBe(-1);
    const hints = findHints(columns);
    expect(hints[0]).toEqual({
      source: 4,
      index: 1,
      target: 5,
      targetIndex: 0,
      priority: 3,
    });
    expect(hints.map(({ priority }) => priority)).toEqual(
      [...hints.map(({ priority }) => priority)].sort((a, b) => b - a),
    );
    // The 8 of diamonds onto the 9 of hearts, another suit.
    expect(
      hints.filter(({ source, priority }) => source === 2 && priority === 2),
    ).toEqual([
      { source: 2, index: 0, target: 1, targetIndex: 0, priority: 2 },
    ]);
    // Every column's run can go to the empty column.
    expect(hints.filter(({ target }) => target === 3)).toHaveLength(5);
    expect(hints.find(({ target }) => target === 3).targetIndex).toBe(-1);
    expect(findHints(table())).toEqual([]);
  });

  test("spider.exe keeps at most 31 hints", () => {
    // Three sixes, four fives and three empty columns make 33 moves.
    const columns = Array.from({ length: COLUMNS }, (_, column) =>
      column < 3 ? [up("6S")] : column < 7 ? [up("5D")] : [],
    );
    const hints = findHints(columns);
    expect(hints).toHaveLength(31);
    expect(hints.filter(({ priority }) => priority === 2)).toHaveLength(12);
    // The last two moves found, the last five's into empty columns, drop.
    expect(
      hints.some(({ source, target }) => source === 6 && target === 9),
    ).toBeFalse();
  });
});
