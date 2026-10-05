import { createRandom } from "../freecell/game.js";

// Solitaire's rules, as sol.exe plays them. Cards use cards.dll's numbering
// (rank * 4 + suit, suits clubs, diamonds, hearts, spades). Each pile is a
// list of { card, up } from bottom to top: 0 is the deck, 1 the waste, 2 to
// 5 the foundations, and 6 to 12 the tableau.
export const DECK = 0;
export const WASTE = 1;
export const FOUNDATIONS = [2, 3, 4, 5];
export const TABLEAU = [6, 7, 8, 9, 10, 11, 12];

export const rankOf = (card) => card >> 2;
export const suitOf = (card) => card & 3;
const isRed = (card) => suitOf(card) === 1 || suitOf(card) === 2;

// sol.exe seeds each deal with the clock's low 15 bits, shuffles 52 cards
// with five passes of swaps, then deals the tableau row by row.
export const seedFromTime = (now = Date.now()) =>
  Math.floor(now / 1000) & 0x7fff;

export const deal = (seed) => {
  const random = createRandom(seed);
  const deck = Array.from({ length: 52 }, (_, card) => card);
  for (let pass = 0; pass < 5; pass += 1)
    for (let index = 0; index < 52; index += 1) {
      const other = random() % 52;
      [deck[index], deck[other]] = [deck[other], deck[index]];
    }
  const piles = Array.from({ length: 13 }, () => []);
  piles[DECK] = deck.map((card) => ({ card, up: false }));
  for (let row = 0; row < 7; row += 1)
    for (let column = row; column < 7; column += 1) {
      const { card } = piles[DECK].pop();
      piles[TABLEAU[column]].push({ card, up: column === row });
    }
  return piles;
};

export const clonePiles = (piles) =>
  piles.map((pile) => pile.map((entry) => ({ ...entry })));

const top = (pile) => pile.at(-1);

// A tableau pile takes a king when empty, or a card one lower in the other
// color.
export const canBuildTableau = (pile, card) => {
  const last = top(pile);
  if (!last) return rankOf(card) === 12;
  return (
    last.up &&
    rankOf(last.card) === rankOf(card) + 1 &&
    isRed(last.card) !== isRed(card)
  );
};

// A foundation takes one card: an ace when empty, then its suit upward.
export const canBuildFoundation = (pile, cards) => {
  if (cards.length !== 1) return false;
  const [card] = cards;
  const last = top(pile);
  if (!last) return rankOf(card) === 0;
  return (
    suitOf(last.card) === suitOf(card) && rankOf(card) === rankOf(last.card) + 1
  );
};

export const canDrop = (piles, target, cards) => {
  if (FOUNDATIONS.includes(target))
    return canBuildFoundation(piles[target], cards);
  if (TABLEAU.includes(target)) return canBuildTableau(piles[target], cards[0]);
  return false;
};

// The score each move earns. Standard and Vegas use sol.exe's tables;
// "none" keeps no score.
export const SCORES = {
  standard: {
    timer: -2,
    recycle: -20,
    foundation: 10,
    wasteToTableau: 5,
    turnOver: 5,
    foundationToTableau: -15,
    deal: 0,
  },
  vegas: {
    timer: 0,
    recycle: 0,
    foundation: 5,
    wasteToTableau: 0,
    turnOver: 0,
    foundationToTableau: -5,
    deal: -52,
  },
};

// The event a move from one pile to another scores.
export const moveEvent = (source, target) => {
  if (FOUNDATIONS.includes(target))
    return source === WASTE || TABLEAU.includes(source) ? "foundation" : null;
  if (TABLEAU.includes(target)) {
    if (source === WASTE) return "wasteToTableau";
    if (FOUNDATIONS.includes(source)) return "foundationToTableau";
  }
  return null;
};

// Points for an event. Standard scores never drop below zero; Vegas does.
export const scoreAfter = ({ score, scoring, draw, passes }, event) => {
  if (scoring === "none") return score;
  let points = SCORES[scoring][event];
  if (scoring === "standard" && event === "recycle") {
    if (draw === 1) points = passes >= 1 ? -100 : 0;
    else points = passes >= 4 ? -20 : 0;
  }
  const next = score + points;
  return scoring === "standard" ? Math.max(0, next) : next;
};

// The bonus a timed Standard game earns when won after 30 seconds.
export const timeBonus = (seconds) =>
  seconds < 30 ? 0 : Math.trunc(20000 / seconds) * 35;

// Whether the deck may be turned over again. Vegas allows one pass with
// Draw One and three with Draw Three.
export const canRecycle = ({ scoring, draw, passes }) =>
  !(scoring === "vegas" && passes === draw - 1);

// Whether clicking the empty deck turns the waste over: there must be a
// waste, and Vegas must have a pass left.
export const canTurnDeckOver = (state, wasteCount) =>
  wasteCount > 0 && canRecycle(state);

export const isWon = (piles) =>
  FOUNDATIONS.every((pile) => piles[pile].length === 13);

// Draws from the deck: up to `count` cards turn over onto the waste, the
// top deck card last, so the last card drawn ends on top.
export const drawCards = (piles, count) => {
  const taken = piles[DECK].splice(Math.max(0, piles[DECK].length - count));
  piles[WASTE].push(...taken.reverse().map(({ card }) => ({ card, up: true })));
  return taken.length;
};

// Turns the waste back over into the deck.
export const recycle = (piles) => {
  piles[DECK] = piles[WASTE].reverse().map(({ card }) => ({ card, up: false }));
  piles[WASTE] = [];
};

export const moveCards = (piles, source, index, target) => {
  const cards = piles[source].splice(index);
  piles[target].push(...cards);
  return cards;
};

// The first foundation that takes a card, as double-clicks and the right
// button pick it.
export const foundationFor = (piles, card) =>
  FOUNDATIONS.find((pile) => canBuildFoundation(piles[pile], [card]));
