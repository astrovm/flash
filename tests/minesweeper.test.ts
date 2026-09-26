// @ts-nocheck -- the Minesweeper module is untyped browser JavaScript.
import { describe, expect, test } from "bun:test";

import {
  MINESWEEPER_LEVELS,
  adjacentMineCount,
  createMinefield,
  neighborsOf,
} from "../site/apps/minesweeper/game.js";

describe("Minesweeper rules", () => {
  test("keeps the first opened square and its neighbors free of mines", () => {
    const level = MINESWEEPER_LEVELS.beginner;
    const mines = createMinefield(level, 40, () => 0.25);
    const safe = new Set([40, ...neighborsOf(40, level.rows, level.columns)]);

    expect(mines.size).toBe(10);
    expect([...safe].some((index) => mines.has(index))).toBeFalse();
  });

  test("counts adjacent mines within row and column boundaries", () => {
    const level = { rows: 3, columns: 3, mines: 2 };
    const mines = new Set([1, 3]);

    expect(neighborsOf(0, level.rows, level.columns)).toEqual([1, 3, 4]);
    expect(adjacentMineCount(0, level, mines)).toBe(2);
    expect(adjacentMineCount(8, level, mines)).toBe(0);
  });

  test("places exactly the configured mines at every difficulty", () => {
    for (const level of Object.values(MINESWEEPER_LEVELS)) {
      let seed = 1;
      const random = () =>
        ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
      const mines = createMinefield(level, 0, random);
      expect(mines.size).toBe(level.mines);
      for (const index of mines) {
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(level.rows * level.columns);
      }
      expect(mines.has(0)).toBeFalse();
    }
  });
});
