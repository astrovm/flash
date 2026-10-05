import { createRandom } from "../freecell/game.js";

// Spider Solitaire's rules, as spider.exe plays them. Cards use cards.dll's
// numbering (rank * 4 + suit, suits clubs, diamonds, hearts, spades). Each
// of the ten columns is a list of { card, up } from bottom to top.
export const COLUMNS = 10;
export const MAX_UNDO = 150;
export const START_SCORE = 500;
export const RUN_BONUS = 100;

export const rankOf = (card) => card >> 2;
export const suitOf = (card) => card & 3;

// spider.exe seeds each game with the clock in whole seconds.
export const seedFromTime = (now = Date.now()) => Math.floor(now / 1000);

// Two decks go into 104 slots. Each card, deck by deck, suit by suit and
// rank by rank, takes the first free slot rand() % 104 finds. One suit
// plays all spades; two suits play spades and hearts.
export const shuffle = (seed, suits) => {
  const random = createRandom(seed);
  const slots = new Array(104).fill(-1);
  for (let deck = 0; deck < 2; deck += 1)
    for (let suit = 0; suit < 4; suit += 1)
      for (let rank = 0; rank < 13; rank += 1) {
        let slot;
        do slot = random() % 104;
        while (slots[slot] !== -1);
        let played = suit;
        if (suits === 1) played = 3;
        else if (suits === 2) played = suit === 0 || suit === 3 ? 3 : 2;
        slots[slot] = rank * 4 + played;
      }
  return slots;
};

// Deals five face-down rows (four in the last six columns) and a face-up
// row. The other 50 cards wait in the stock, ten per deal.
export const deal = (seed, suits) => {
  const slots = shuffle(seed, suits);
  const columns = Array.from({ length: COLUMNS }, () => []);
  let next = 0;
  for (let row = 0; row < 5; row += 1)
    for (let column = 0; column < COLUMNS; column += 1)
      if (row < 4 || column < 4)
        columns[column].push({ card: slots[next++], up: false });
  for (let column = 0; column < COLUMNS; column += 1)
    columns[column].push({ card: slots[next++], up: true });
  return { columns, stock: slots.slice(next) };
};

export const cloneColumns = (columns) =>
  columns.map((cards) => cards.map((entry) => ({ ...entry })));

// Face-down cards sit at the bottom of a column.
export const faceDownCount = (cards) => {
  const index = cards.findIndex(({ up }) => up);
  return index === -1 ? cards.length : index;
};

// A face-up card can be picked up with the cards on it when they all
// follow it down in its suit.
export const canPickUp = (cards, index) => {
  if (index < 0 || index >= cards.length || !cards[index].up) return false;
  for (let next = index + 1; next < cards.length; next += 1) {
    const below = cards[next - 1].card;
    const { card } = cards[next];
    if (suitOf(card) !== suitOf(below) || rankOf(card) !== rankOf(below) - 1)
      return false;
  }
  return true;
};

// Any card goes on an empty column, or on a face-up card one rank higher
// in any suit.
export const canDrop = (columns, source, index, target) => {
  if (source === target || !columns[source].length) return false;
  const cards = columns[target];
  if (!cards.length) return true;
  const top = cards.at(-1);
  const moving = columns[source][index];
  return top.up && moving.up && rankOf(top.card) === rankOf(moving.card) + 1;
};

// Where the same-suit run at the top of a column starts.
export const runStart = (cards) => {
  let index = cards.length - 1;
  while (index > 0) {
    const below = cards[index - 1];
    const { card } = cards[index];
    if (
      !below.up ||
      suitOf(below.card) !== suitOf(card) ||
      rankOf(below.card) !== rankOf(card) + 1
    )
      break;
    index -= 1;
  }
  return index;
};

// The moves Show An Available Move cycles through: each column's whole
// top run onto every column that takes it, best first. A move within the
// suit ranks 3, onto another suit 2, and into an empty column 1.
export const findHints = (columns) => {
  const hints = [];
  for (let source = 0; source < COLUMNS; source += 1)
    for (let target = 0; target < COLUMNS; target += 1) {
      if (source === target) continue;
      const index = runStart(columns[source]);
      if (!canDrop(columns, source, index, target)) continue;
      const top = columns[target].at(-1);
      const moving = columns[source][index].card;
      let priority = 2;
      if (top && suitOf(top.card) === suitOf(moving)) priority = 3;
      else if (!top) priority = 1;
      // spider.exe keeps at most 31 hints.
      if (hints.length < 31)
        hints.push({
          source,
          index,
          target,
          targetIndex: columns[target].length - 1,
          priority,
        });
    }
  // A stable sort, like spider.exe's insertion sort.
  return hints.sort((first, second) => second.priority - first.priority);
};

// A column ends in a full run when its top 13 cards go from king down to
// ace in one suit.
export const hasCompleteRun = (cards) => {
  if (cards.length < 13) return false;
  const top = cards.at(-1).card;
  if (rankOf(top) !== 0) return false;
  for (let offset = 1; offset < 13; offset += 1) {
    const entry = cards[cards.length - 1 - offset];
    if (
      !entry.up ||
      suitOf(entry.card) !== suitOf(top) ||
      rankOf(entry.card) !== offset
    )
      return false;
  }
  return true;
};

// Moves cards and turns over the card they uncover. Returns the undo
// record: where the cards went and whether a card was turned.
export const moveCards = (columns, source, index, target) => {
  const targetIndex = columns[target].length;
  columns[target].push(...columns[source].splice(index));
  const uncovered = columns[source].at(-1);
  const turned = Boolean(uncovered && !uncovered.up);
  if (turned) uncovered.up = true;
  return { source, target, targetIndex, turned };
};

// Puts a move back, turning the uncovered card face down again.
export const undoMove = (columns, { source, target, targetIndex, turned }) => {
  if (turned) columns[source].at(-1).up = false;
  columns[source].push(...columns[target].splice(targetIndex));
};

// Deals the next ten stock cards, one face up on each column.
export const dealRow = (columns, stock) => {
  const cards = stock.splice(0, COLUMNS);
  cards.forEach((card, column) => columns[column].push({ card, up: true }));
  return cards.length;
};

// Scores never drop below zero.
export const addScore = (score, points) => Math.max(0, score + points);
