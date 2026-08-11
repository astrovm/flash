import { describe, expect, test } from "bun:test";

import {
  MINESWEEPER_LEVELS,
  adjacentMineCount,
  createMinefield,
  neighborsOf,
} from "../site/apps/minesweeper/game.js";

describe("Minesweeper game rules", () => {
  test("the first opened square and its neighbors are always safe", () => {
    const level = MINESWEEPER_LEVELS.beginner;
    const mines = createMinefield(level, 40, () => 0.25);
    const safe = new Set([40, ...neighborsOf(40, level.rows, level.columns)]);

    expect(mines.size).toBe(10);
    expect([...safe].some((index) => mines.has(index))).toBeFalse();
  });

  test("adjacent counts obey row and column boundaries", () => {
    const level = { rows: 3, columns: 3, mines: 2 };
    const mines = new Set([1, 3]);

    expect(neighborsOf(0, level.rows, level.columns)).toEqual([1, 3, 4]);
    expect(adjacentMineCount(0, level, mines)).toBe(2);
    expect(adjacentMineCount(8, level, mines)).toBe(0);
  });
});
