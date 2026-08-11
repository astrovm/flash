export const MINESWEEPER_LEVELS = Object.freeze({
  beginner: Object.freeze({ rows: 9, columns: 9, mines: 10 }),
  intermediate: Object.freeze({ rows: 16, columns: 16, mines: 40 }),
  expert: Object.freeze({ rows: 16, columns: 30, mines: 99 }),
});

export const neighborsOf = (index, rows, columns) => {
  const row = Math.floor(index / columns);
  const column = index % columns;
  const neighbors = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) continue;
      const nextRow = row + rowOffset;
      const nextColumn = column + columnOffset;
      if (
        nextRow >= 0 &&
        nextRow < rows &&
        nextColumn >= 0 &&
        nextColumn < columns
      ) {
        neighbors.push(nextRow * columns + nextColumn);
      }
    }
  }
  return neighbors;
};

export const createMinefield = (level, firstIndex, random = Math.random) => {
  const size = level.rows * level.columns;
  const excluded = new Set([
    firstIndex,
    ...neighborsOf(firstIndex, level.rows, level.columns),
  ]);
  const available = Array.from({ length: size }, (_, index) => index).filter(
    (index) => !excluded.has(index),
  );
  for (let index = available.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [available[index], available[target]] = [
      available[target],
      available[index],
    ];
  }
  return new Set(available.slice(0, Math.min(level.mines, available.length)));
};

export const adjacentMineCount = (index, level, mines) =>
  neighborsOf(index, level.rows, level.columns).filter((neighbor) =>
    mines.has(neighbor),
  ).length;
