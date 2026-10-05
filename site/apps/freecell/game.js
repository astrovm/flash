// FreeCell's rules, as freecell.exe plays them. A card is rank * 4 + suit,
// with ranks 0 (ace) to 12 (king) and suits in cards.dll's order: clubs,
// diamonds, hearts, spades. The board keeps XP's layout: row 0 holds the
// four free cells and four home cells, and columns 1 to 8 hold the
// tableau. Home cells keep only their top card.

export const EMPTY = -1;
export const COLUMNS = 8;
export const FREE_CELLS = 4;
export const MAX_GAME = 1000000;

export const rankOf = (card) => Math.floor(card / 4);
export const suitOf = (card) => card % 4;
export const isRed = (card) => suitOf(card) === 1 || suitOf(card) === 2;

// The C runtime's rand(), which seeds every numbered deal.
export const createRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 214013) + 2531011) >>> 0;
    return (state >>> 16) & 0x7fff;
  };
};

// A new game's suggested number: srand(time), two discarded values, then
// the first value from 1 to 1000000.
export const randomGameNumber = (now = Date.now()) => {
  const random = createRandom(Math.floor(now / 1000));
  random();
  random();
  let value;
  do value = random();
  while (value === 0);
  return value;
};

export const isValidGameNumber = (number) =>
  Number.isInteger(number) && number >= -2 && number <= MAX_GAME && number;

const emptyBoard = () => ({
  cells: Array(8).fill(EMPTY),
  columns: Array.from({ length: COLUMNS }, () => []),
  // The home cell each suit has claimed, or EMPTY.
  homeSlots: Array(4).fill(EMPTY),
});

// Deals a numbered game. Games -1 and -2 are freecell.exe's hidden deals.
export const deal = (number) => {
  const board = emptyBoard();
  const place = (column, card) => board.columns[column].push(card);
  if (number === -1) {
    for (let row = 0; row < 7; row += 1)
      for (let column = 0; column < 4; column += 1)
        place(column, row * 8 + column);
    for (let row = 0; row < 6; row += 1)
      for (let column = 4; column < 8; column += 1)
        place(column, 44 - row * 8 + column - 4);
  } else if (number === -2) {
    for (let column = 0; column < 4; column += 1) place(column, 3 - column);
    let card = 51;
    for (let row = 0; row < 6; row += 1)
      for (let column = 0; column < 4; column += 1) place(column, card--);
    for (let row = 0; row < 6; row += 1)
      for (let column = 4; column < 8; column += 1) place(column, card--);
  } else {
    const random = createRandom(number);
    const deck = Array.from({ length: 52 }, (_, index) => index);
    for (let index = 0, left = 52; index < 52; index += 1) {
      const pick = random() % left;
      left -= 1;
      place(index % 8, deck[pick]);
      deck[pick] = deck[left];
    }
  }
  return board;
};

export const cloneBoard = (board) => ({
  cells: [...board.cells],
  columns: board.columns.map((column) => [...column]),
  homeSlots: [...board.homeSlots],
});

// A place is { column: 0, row } for a cell (rows 0-3 free, 4-7 home) or
// { column: 1-8 } for the bottom of a tableau column.
export const cardAt = (board, place) =>
  place.column === 0
    ? board.cells[place.row]
    : (board.columns[place.column - 1].at(-1) ?? EMPTY);

export const homeRank = (board, suit) =>
  board.homeSlots[suit] === EMPTY
    ? EMPTY
    : rankOf(board.cells[board.homeSlots[suit]]);

// Cards still on the table, in the free cells and columns.
export const cardsLeft = (board) =>
  board.cells.slice(0, FREE_CELLS).filter((card) => card !== EMPTY).length +
  board.columns.reduce((total, cards) => total + cards.length, 0);

export const canStack = (card, onto) =>
  rankOf(onto) - rankOf(card) === 1 && isRed(card) !== isRed(onto);

export const freeCellCount = (board) =>
  board.cells.slice(0, FREE_CELLS).filter((card) => card === EMPTY).length;

export const emptyColumnCount = (board) =>
  board.columns.filter((column) => !column.length).length;

// How many cards one move can carry: each free cell adds one, and each
// empty column repeats that.
export const maxMovable = (freeCells, emptyColumns) =>
  (freeCells + 1) * (emptyColumns + 1);

// How many cards moving from one column to another takes, or 0 when the
// move isn't legal. To an empty column it's the whole ordered run.
export const runLength = (board, from, to) => {
  if (from === to) return 1;
  const source = board.columns[from - 1];
  const target = board.columns[to - 1];
  let index = source.length - 1;
  if (!target.length) {
    let count = 1;
    while (index > 0 && canStack(source[index], source[index - 1])) {
      index -= 1;
      count += 1;
    }
    return count;
  }
  const onto = target.at(-1);
  let count = 1;
  while (!canStack(source[index], onto)) {
    if (!index || !canStack(source[index], source[index - 1])) return 0;
    index -= 1;
    count += 1;
  }
  return count;
};

// Whether the selected card may go to a cell. Free cells take any card
// when empty; home cells take the next card of their suit.
export const canMoveToCell = (board, card, row) => {
  if (row < FREE_CELLS) return board.cells[row] === EMPTY;
  const top = board.cells[row];
  if (top === EMPTY) return rankOf(card) === 0;
  return suitOf(card) === suitOf(top) && rankOf(card) === rankOf(top) + 1;
};

// The automatic move freecell.exe makes after every move: aces and twos
// always go home, and higher cards once both opposite-color suits are home
// up to the rank below.
export const isSafeHomeMove = (board, card, everything = false) => {
  if (card === EMPTY) return false;
  if (everything) return true;
  const rank = rankOf(card);
  const suit = suitOf(card);
  if (rank === 0) return true;
  if (rank === 1) return homeRank(board, suit) === 0;
  if (homeRank(board, suit) !== rank - 1) return false;
  const opposite = isRed(card) ? [0, 3] : [1, 2];
  return opposite.every((other) => {
    const home = homeRank(board, other);
    return home !== EMPTY && home >= rank - 1;
  });
};

const homeRowFor = (board, card) =>
  board.homeSlots[suitOf(card)] !== EMPTY
    ? board.homeSlots[suitOf(card)]
    : [4, 5, 6, 7].find((row) => board.cells[row] === EMPTY);

// Moves one card. Steps are { from, to } places; a home cell receives the
// card on top of its suit.
export const applyStep = (board, { from, to }) => {
  const card =
    from.column === 0
      ? board.cells[from.row]
      : board.columns[from.column - 1].pop();
  if (from.column === 0) board.cells[from.row] = EMPTY;
  if (to.column === 0) {
    board.cells[to.row] = card;
    if (to.row >= FREE_CELLS) board.homeSlots[suitOf(card)] = to.row;
  } else board.columns[to.column - 1].push(card);
  return card;
};

// Reverses a step. A card leaving home uncovers the one below it.
export const revertStep = (board, { from, to }) => {
  let card;
  if (to.column === 0) {
    card = board.cells[to.row];
    if (to.row >= FREE_CELLS) {
      if (rankOf(card) === 0) {
        board.cells[to.row] = EMPTY;
        board.homeSlots[suitOf(card)] = EMPTY;
      } else board.cells[to.row] = card - 4;
    } else board.cells[to.row] = EMPTY;
  } else card = board.columns[to.column - 1].pop();
  if (from.column === 0) board.cells[from.row] = card;
  else board.columns[from.column - 1].push(card);
};

const cell = (row) => ({ column: 0, row });
const column = (index) => ({ column: index });

// Splits a column-to-column move into single-card steps through the free
// cells, the way freecell.exe animates it. It carries at most one card per
// free cell plus one.
const moveThroughFreeCells = (board, from, to, steps) => {
  const free = [0, 1, 2, 3].filter((row) => board.cells[row] === EMPTY);
  const count = Math.min(runLength(board, from, to), free.length + 1);
  const record = (step) => {
    applyStep(board, step);
    steps.push(step);
  };
  for (let index = 0; index < count - 1; index += 1)
    record({ from: column(from), to: cell(free[index]) });
  record({ from: column(from), to: column(to) });
  for (let index = count - 2; index >= 0; index -= 1)
    record({ from: cell(free[index]), to: column(to) });
};

// Plans a legal column move. Longer runs onto a card park parts of the run
// in empty columns first. A run to an empty column takes only what the free
// cells allow, or one card with `single`.
export const planColumnMove = (board, from, to, { single = false } = {}) => {
  const work = cloneBoard(board);
  const steps = [];
  if (single) {
    const step = { from: column(from), to: column(to) };
    applyStep(work, step);
    return [step];
  }
  const capacity = freeCellCount(work) + 1;
  let total = runLength(work, from, to);
  if (work.columns[to - 1].length && total > capacity) {
    const parking = work.columns
      .map((cards, index) => (cards.length ? 0 : index + 1))
      .filter(Boolean);
    let used = 0;
    while (total > capacity) {
      moveThroughFreeCells(work, from, parking[used], steps);
      total -= capacity;
      used += 1;
    }
    moveThroughFreeCells(work, from, to, steps);
    for (let index = used - 1; index >= 0; index -= 1)
      moveThroughFreeCells(work, parking[index], to, steps);
  } else moveThroughFreeCells(work, from, to, steps);
  return steps;
};

// Plays every safe move home until none is left, returning the steps.
// `everything` is the hidden winning mode, which sends any card home.
export const planAutoMoves = (board, everything = false) => {
  const work = cloneBoard(board);
  const steps = [];
  let moved = true;
  while (moved) {
    moved = false;
    const sources = [
      ...[0, 1, 2, 3].map((row) => cell(row)),
      ...Array.from({ length: COLUMNS }, (_, index) => column(index + 1)),
    ];
    for (const from of sources) {
      const card = cardAt(work, from);
      if (!isSafeHomeMove(work, card, everything)) continue;
      const step = { from, to: cell(homeRowFor(work, card)) };
      applyStep(work, step);
      steps.push(step);
      moved = true;
    }
  }
  return steps;
};

// How many moves are left once every free cell and column is full: 0 ends
// the game, and 1 makes freecell.exe flash its window as a warning.
export const remainingMoves = (board) => {
  if (freeCellCount(board) || emptyColumnCount(board)) return Infinity;
  const bottoms = board.columns.map((cards) => cards.at(-1));
  const free = board.cells.slice(0, FREE_CELLS);
  const goesHome = (card) => homeRank(board, suitOf(card)) === rankOf(card) - 1;
  let moves = 0;
  for (const card of bottoms) {
    if (rankOf(card) === 0) moves += 1;
    if (goesHome(card)) moves += 1;
  }
  for (const card of free) if (goesHome(card)) moves += 1;
  for (const card of free)
    for (const bottom of bottoms) if (canStack(card, bottom)) moves += 1;
  bottoms.forEach((card, index) =>
    bottoms.forEach((other, otherIndex) => {
      if (index !== otherIndex && canStack(card, other)) moves += 1;
    }),
  );
  return moves;
};
