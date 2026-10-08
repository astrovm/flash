import { createRandom } from "../freecell/game.js";

// Hearts' rules and computer players, as mshearts.exe plays them. Cards use
// cards.dll's numbering: rank * 4 + suit, suits clubs, diamonds, hearts,
// spades, with the ace stored as rank 0. Seat 0 is the human at the bottom,
// then Pauline at the left, Michele at the top and Ben at the right.
export const CLUBS = 0;
export const DIAMONDS = 1;
export const HEARTS = 2;
export const SPADES = 3;
export const TWO_OF_CLUBS = 4;
export const QUEEN_OF_SPADES = 47;
export const PLAYERS = 4;
export const HAND_SIZE = 13;

// A hand keeps 13 slots for the whole round. Played cards leave gaps.
export const IN_HAND = 0;
export const SELECTED = 1;
export const ON_TABLE = 2;
export const GONE = 3;

// Passing goes left, right, across, then not at all. A seat passes to the
// seat this many places after it.
export const PASS_OFFSETS = [1, 3, 2, 0];
export const NO_PASS = 3;
export const PASS_LABELS = ["Pass Left", "Pass Right", "Pass Across"];

export const DEFAULT_NAMES = ["Pauline", "Michele", "Ben"];
export const SUIT_NAMES = ["club", "diamond", "heart", "spade"];

export const suitOf = (card) => card & 3;
// Ranks for comparing: two is 1, king 12 and ace 13.
export const rankOf = (card) => card >> 2 || 13;
export const isPointCard = (card) =>
  suitOf(card) === HEARTS || card === QUEEN_OF_SPADES;
export const pointsOf = (cards) =>
  cards.reduce(
    (total, card) =>
      total +
      (card === QUEEN_OF_SPADES ? 13 : suitOf(card) === HEARTS ? 1 : 0),
    0,
  );

// The C runtime's generator, reseeded the way srand() is.
export const createGenerator = (seed) => {
  const generator = {
    next: createRandom(seed),
    seed(value) {
      generator.next = createRandom(value);
    },
  };
  return generator;
};

// Each draw takes rand() % remaining from the pool and fills the hole with
// the pool's last card. The first 13 cards go to seat 0, the next 13 to
// seat 1, and so on.
export const dealHands = (random) => {
  const pool = Array.from({ length: 52 }, (_, card) => card);
  const hands = Array.from({ length: PLAYERS }, () => []);
  for (let dealt = 0; dealt < 52; dealt += 1) {
    const remaining = 52 - dealt;
    const index = random() % remaining;
    hands[Math.floor(dealt / HAND_SIZE)].push(pool[index]);
    pool[index] = pool[remaining - 1];
  }
  return hands;
};

export const inHand = (slot) => slot.state === IN_HAND || slot.state === SELECTED;
export const handCards = (slots) =>
  slots.filter((slot) => slot.card !== -1).map((slot) => slot.card);

// The human's hand is sorted by suit, clubs, diamonds, spades, then hearts,
// low to high with the ace high. Cards no longer in hand go to the end.
const suitOrder = [0, 1, 3, 2];
export const compareSlots = (a, b) => {
  const aIn = inHand(a);
  const bIn = inHand(b);
  if (!aIn || !bIn) return aIn === bIn ? 0 : aIn ? -1 : 1;
  if (suitOf(a.card) !== suitOf(b.card))
    return suitOrder[suitOf(a.card)] - suitOrder[suitOf(b.card)];
  return rankOf(a.card) - rankOf(b.card);
};
export const sortSlots = (slots) => [...slots].sort(compareSlots);

// ---- Passing ----

// A computer picks its three cards in this order: the ace, king and queen
// of spades; the ace down to the jack of hearts; high cards (eight and up)
// in a suit with fewer than two cards from two to seven; any whole suit
// that fits; then its highest cards. Suits go hearts, spades, diamonds,
// clubs, and cards from the ace down.
const PASS_SUITS = [HEARTS, SPADES, DIAMONDS, CLUBS];
const PASS_RANKS = [0, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const LOW_CARDS = [1, 2, 3, 4, 5, 6];
const HIGH_CARDS = [0, 7, 8, 9, 10, 11, 12];

export const choosePass = (slots) => {
  // The ranks still unchosen in each suit, as card >> 2.
  const ranks = [new Set(), new Set(), new Set(), new Set()];
  slots.forEach((slot) => {
    if (inHand(slot)) ranks[suitOf(slot.card)].add(slot.card >> 2);
  });
  const chosen = [];
  const take = (suit, allowed) => {
    for (const rank of PASS_RANKS) {
      if (chosen.length === 3) return;
      if (!allowed.includes(rank) || !ranks[suit].has(rank)) continue;
      ranks[suit].delete(rank);
      chosen.push(
        slots.findIndex(
          (slot) => inHand(slot) && slot.card === rank * 4 + suit,
        ),
      );
    }
  };
  take(SPADES, [0, 12, 11]);
  take(HEARTS, [0, 12, 11, 10]);
  for (const suit of PASS_SUITS) {
    if (suit === SPADES) continue;
    const low = LOW_CARDS.filter((rank) => ranks[suit].has(rank)).length;
    if (low < 2) take(suit, HIGH_CARDS);
  }
  for (const suit of PASS_SUITS)
    if (ranks[suit].size <= 3 - chosen.length) take(suit, PASS_RANKS);
  for (const suit of PASS_SUITS) take(suit, PASS_RANKS);
  return chosen;
};

// ---- What a computer remembers ----

// Which cards it hasn't seen: everything but its own hand after the pass,
// less each trick's cards once the trick is taken. Indexed by suit, then
// rank from 1 (two) to 13 (ace).
export const createMemory = (slots) => {
  const unseen = Array.from({ length: 4 }, () => Array(14).fill(true));
  slots.forEach(({ card }) => {
    if (card !== -1) unseen[suitOf(card)][rankOf(card)] = false;
  });
  return unseen;
};
export const forgetCards = (unseen, cards) =>
  cards.forEach((card) => {
    unseen[suitOf(card)][rankOf(card)] = false;
  });

const unseenBetween = (unseen, suit, from, to) => {
  let count = 0;
  for (let rank = from; rank <= to; rank += 1) if (unseen[suit][rank]) count += 1;
  return count;
};
const unseenAbove = (unseen, suit, rank) =>
  unseenBetween(unseen, suit, rank + 1, 13);
const unseenBelow = (unseen, suit, rank) =>
  unseenBetween(unseen, suit, 1, rank - 1);

// ---- The trick ----

export const createTrick = (leader) => ({
  leader,
  current: leader,
  played: [null, null, null, null],
});
export const leadCard = (trick) => trick.played[trick.leader];
export const isFirstTrick = (trick) => leadCard(trick) === TWO_OF_CLUBS;

// The highest card of the suit led takes the trick.
export const trickWinner = (trick) => {
  const lead = leadCard(trick);
  let winner = trick.leader;
  for (let offset = 1; offset < PLAYERS; offset += 1) {
    const seat = (trick.leader + offset) % PLAYERS;
    const card = trick.played[seat];
    if (
      suitOf(card) === suitOf(lead) &&
      rankOf(card) > rankOf(trick.played[winner])
    )
      winner = seat;
  }
  return winner;
};

// ---- The human's moves ----

// Returns null for a legal card, or the status bar's complaint.
export const checkMove = (slots, index, round, seat = 0) => {
  const { trick } = round;
  const card = slots[index].card;
  const held = slots.filter((slot) => slot.card !== -1).map((slot) => slot.card);
  const lead = leadCard(trick);
  if (trick.leader === seat) {
    if (
      card !== TWO_OF_CLUBS &&
      slots.some((slot, other) => other !== index && slot.card === TWO_OF_CLUBS)
    )
      return { id: 314, text: "You must lead the two of clubs." };
    if (
      suitOf(card) === HEARTS &&
      !round.heartsBroken &&
      held.some((other) => suitOf(other) !== HEARTS)
    )
      return {
        id: 313,
        text: "Hearts has not been broken.  Choose another suit.",
      };
    return null;
  }
  if (lead === null || suitOf(card) === suitOf(lead)) return null;
  if (held.some((other) => suitOf(other) === suitOf(lead)))
    return {
      id: 312,
      text: `You must follow suit.  Play a ${SUIT_NAMES[suitOf(lead)]}.`,
      followSuit: true,
    };
  if (
    lead === TWO_OF_CLUBS &&
    isPointCard(card) &&
    held.some((other) => !isPointCard(other))
  )
    return {
      id: 338,
      text: "You cannot play a point card on the first trick.  Select again.",
    };
  return null;
};

// ---- The computers' moves ----

// What a computer sees before it plays: its lowest and highest card in
// each suit, its lowest and highest rank overall, the suit and highest
// rank on the table, and the points there.
const survey = (slots, round, seat) => {
  const { trick } = round;
  const lead = leadCard(trick);
  const info = {
    slots,
    seat,
    lead,
    leadSuit: lead === null ? -1 : suitOf(lead),
    tableHigh: lead === null ? -1 : rankOf(lead),
    points: 0,
    amLast: (trick.leader + 3) % PLAYERS === seat,
    queen: -1,
    low: [-1, -1, -1, -1],
    lowRank: [14, 14, 14, 14],
    high: [-1, -1, -1, -1],
    highRank: [-1, -1, -1, -1],
    lowestRank: 14,
    count: 0,
  };
  trick.played.forEach((card) => {
    if (card === null) return;
    info.points += pointsOf([card]);
    if (suitOf(card) === info.leadSuit && rankOf(card) > info.tableHigh)
      info.tableHigh = rankOf(card);
  });
  slots.forEach(({ card }, index) => {
    if (card === -1) return;
    const suit = suitOf(card);
    const rank = rankOf(card);
    info.count += 1;
    if (card === QUEEN_OF_SPADES) info.queen = index;
    if (rank < info.lowRank[suit]) {
      info.lowRank[suit] = rank;
      info.low[suit] = index;
    }
    if (rank > info.highRank[suit]) {
      info.highRank[suit] = rank;
      info.high[suit] = index;
    }
    info.lowestRank = Math.min(info.lowestRank, rank);
  });
  return info;
};

const cardAt = (info, index) => info.slots[index].card;

// The highest card of the same suit below the one at `index`, or -1.
const nextLower = (info, index) => {
  const card = cardAt(info, index);
  let best = -1;
  let bestRank = -1;
  info.slots.forEach((slot, other) => {
    if (slot.card === -1 || suitOf(slot.card) !== suitOf(card)) return;
    const rank = rankOf(slot.card);
    if (rank < rankOf(card) && rank > bestRank) {
      best = other;
      bestRank = rank;
    }
  });
  return best;
};

// The suit whose lowest card has the most unseen cards below it: the one
// most likely to win a trick, so the first to throw away.
const riskiestSuit = (info, unseen, heartsAllowed) => {
  let best = -1;
  let bestCount = -1;
  for (let suit = 0; suit < 4; suit += 1) {
    if (info.low[suit] === -1 || (suit === HEARTS && !heartsAllowed)) continue;
    const count = unseenBelow(unseen, suit, info.lowRank[suit]);
    if (
      count > bestCount ||
      (count === bestCount && info.lowRank[suit] > info.lowRank[best])
    ) {
      best = suit;
      bestCount = count;
    }
  }
  return best === -1 ? HEARTS : best;
};

// The suit whose lowest card has the most unseen cards above it.
const safestSuit = (info, unseen, heartsAllowed) => {
  let best = -1;
  let bestCount = -1;
  for (let suit = 0; suit < 4; suit += 1) {
    if (info.low[suit] === -1 || (suit === HEARTS && !heartsAllowed)) continue;
    const count = unseenAbove(unseen, suit, info.lowRank[suit]);
    if (
      count > bestCount ||
      (count === bestCount && info.lowRank[suit] < info.lowRank[best])
    ) {
      best = suit;
      bestCount = count;
    }
  }
  return best === -1 ? HEARTS : best;
};

// A suit, spades first, whose lowest card can't win: nothing unseen below
// it and something unseen above.
const sureLoserSuit = (info, unseen, heartsAllowed) => {
  for (let suit = SPADES; suit >= 0; suit -= 1) {
    if (info.low[suit] === -1 || (suit === HEARTS && !heartsAllowed)) continue;
    if (
      unseenAbove(unseen, suit, info.lowRank[suit]) >= 1 &&
      unseenBelow(unseen, suit, info.lowRank[suit]) === 0
    )
      return suit;
  }
  return -1;
};

// A card a little above the lowest of the suit, keeping more than half of
// the lowest card's unseen higher cards above it.
const middleCard = (info, unseen, suit) => {
  const lowest = info.low[suit];
  const start = unseenAbove(unseen, suit, rankOf(cardAt(info, lowest)));
  let best = lowest;
  let bestCount = start;
  info.slots.forEach(({ card }, index) => {
    if (card === -1 || suitOf(card) !== suit || index === lowest) return;
    const count = unseenAbove(unseen, suit, rankOf(card));
    if (count < bestCount && count > Math.trunc(start / 2)) {
      best = index;
      bestCount = count;
    }
  });
  return best;
};

// The highest card that stays under the table's best card. With the ace
// of spades out, the queen goes under it.
const underCard = (info) => {
  if (info.queen !== -1 && info.leadSuit === SPADES && info.tableHigh === 13)
    return info.queen;
  let best = -1;
  let bestRank = -1;
  info.slots.forEach(({ card }, index) => {
    if (card === -1 || suitOf(card) !== info.leadSuit) return;
    const rank = rankOf(card);
    if (rank < info.tableHigh && rank > bestRank) {
      best = index;
      bestRank = rank;
    }
  });
  return best;
};

// Someone else might take every point: keep a high card to stop them.
const moonWatch = (round, seat) =>
  round.moonPossible && round.moonByHuman && round.moonPlayer !== seat;

const chooseLead = (info, unseen, round) => {
  const twoOfClubs = info.slots.findIndex(({ card }) => card === TWO_OF_CLUBS);
  if (twoOfClubs !== -1) return twoOfClubs;
  // Fish for the queen with a low spade while every spade is a jack or less.
  if (
    !round.queenPlayed &&
    info.low[SPADES] !== -1 &&
    info.highRank[SPADES] <= 10
  )
    return info.low[SPADES];
  let suit = sureLoserSuit(info, unseen, round.heartsBroken);
  if (suit === -1) suit = safestSuit(info, unseen, round.heartsBroken);
  if (info.count < 9 || suit === HEARTS || !round.queenPlayed)
    return info.low[suit];
  return middleCard(info, unseen, suit);
};

const chooseDiscard = (info, unseen, round) => {
  const firstTrick = info.lead === TWO_OF_CLUBS;
  if (!firstTrick && info.queen !== -1) return info.queen;
  if (!round.queenPlayed && info.highRank[SPADES] > 11) return info.high[SPADES];
  let suit = riskiestSuit(info, unseen, !firstTrick);
  // The queen can't go on the first trick.
  if (
    firstTrick &&
    suit === SPADES &&
    cardAt(info, info.high[SPADES]) === QUEEN_OF_SPADES
  ) {
    if (info.high[DIAMONDS] !== -1) suit = DIAMONDS;
    else if (info.low[SPADES] !== info.high[SPADES]) return info.low[SPADES];
    else suit = HEARTS;
  }
  const highest = info.high[suit];
  if (!moonWatch(round, info.seat) || highest === info.low[suit]) return highest;
  // The suit holds a lower card, since its lowest isn't its highest.
  return nextLower(info, highest);
};

const chooseFollow = (info, unseen, round) => {
  const suit = info.leadSuit;
  const highest = info.high[suit];
  if (highest === -1) return chooseDiscard(info, unseen, round);
  const lowest = info.low[suit];
  if (highest === lowest || info.lead === TWO_OF_CLUBS) return highest;
  if (info.amLast && info.lowRank[suit] > info.tableHigh)
    return highest === info.queen ? lowest : highest;
  if (
    info.amLast &&
    info.tableHigh < info.highRank[suit] &&
    info.lowestRank < 7
  ) {
    if (info.points === 0 && highest !== info.queen) return highest;
    if (
      !round.queenPlayed &&
      suit === SPADES &&
      info.points < 4 &&
      info.highRank[SPADES] > 11
    )
      return info.high[SPADES];
  }
  const under = underCard(info);
  if (under !== -1) {
    if (!moonWatch(round, info.seat)) return under;
    const lower = nextLower(info, under);
    return lower === -1 ? under : lower;
  }
  return lowest === info.queen ? highest : lowest;
};

// The slot a computer plays.
export const choosePlay = (slots, unseen, round, seat) => {
  const info = survey(slots, round, seat);
  return round.trick.leader === seat
    ? chooseLead(info, unseen, round)
    : chooseFollow(info, unseen, round);
};

// ---- Rounds and games ----

// One hand of 13 tricks: the seats' slots, the trick, what each computer
// remembers, the point cards each seat took, and whether hearts are broken,
// the queen is out and someone could still shoot the moon.
// The deal sorts only the human's hand.
export const createRound = (hands, passMode) => ({
  slots: hands.map((cards, seat) => {
    const slots = cards.map((card) => ({ card, state: IN_HAND }));
    return seat === 0 ? sortSlots(slots) : slots;
  }),
  passMode,
  memory: [],
  taken: [[], [], [], []],
  trick: createTrick(-1),
  tricksLeft: HAND_SIZE,
  heartsBroken: false,
  queenPlayed: false,
  moonPossible: true,
  moonPlayer: -1,
  moonByHuman: false,
});

// Every seat but the human marks the cards it means to pass.
export const chooseComputerPasses = (round) => {
  for (let seat = 1; seat < PLAYERS; seat += 1)
    choosePass(round.slots[seat]).forEach((index) => {
      round.slots[seat][index].state = SELECTED;
    });
};

export const selectedCount = (slots) =>
  slots.filter((slot) => slot.state === SELECTED).length;

// Each seat hands its three marked cards to the seat it passes to; they
// land in that seat's marked slots. The human's received cards stay
// marked until accepted, and its hand is sorted.
export const exchangeCards = (round) => {
  const offset = PASS_OFFSETS[round.passMode];
  const given = round.slots.map((slots) =>
    slots.filter((slot) => slot.state === SELECTED).map((slot) => slot.card),
  );
  given.forEach((cards, seat) => {
    const target = (seat + offset) % PLAYERS;
    round.slots[target]
      .filter((slot) => slot.state === SELECTED)
      .forEach((slot, index) => {
        slot.card = cards[index];
        if (target !== 0) slot.state = IN_HAND;
      });
  });
  round.slots[0] = sortSlots(round.slots[0]);
  return given;
};

// The holder of the two of clubs leads the first trick.
export const startPlay = (round) => {
  round.slots[0].forEach((slot) => {
    if (slot.state === SELECTED) slot.state = IN_HAND;
  });
  round.memory = round.slots.map((slots) => createMemory(slots));
  const leader = round.slots.findIndex((slots) =>
    slots.some((slot) => slot.card === TWO_OF_CLUBS),
  );
  round.trick = createTrick(leader);
  round.heartsBroken = false;
  round.queenPlayed = false;
  round.moonPossible = true;
  round.moonPlayer = -1;
  round.moonByHuman = false;
  round.tricksLeft = HAND_SIZE;
  round.taken = [[], [], [], []];
  return leader;
};

// Puts a seat's card on the table. Returns what it set off: hearts broken
// for the first heart, the queen for the queen of spades.
export const playCard = (round, seat, index) => {
  const slot = round.slots[seat][index];
  slot.state = ON_TABLE;
  round.trick.played[seat] = slot.card;
  const events = [];
  if (!round.heartsBroken && suitOf(slot.card) === HEARTS) {
    round.heartsBroken = true;
    events.push("hearts");
  }
  if (slot.card === QUEEN_OF_SPADES) {
    round.queenPlayed = true;
    events.push("queen");
  }
  round.trick.current = (seat + 1) % PLAYERS;
  return events;
};

export const trickComplete = (round) =>
  round.trick.current === round.trick.leader;

// The trick's winner. Each computer notes the cards, and the first seat
// to take points is the only one who can still shoot the moon.
export const finishTrick = (round) => {
  const winner = trickWinner(round.trick);
  const cards = round.trick.played;
  round.memory.forEach((unseen) => forgetCards(unseen, cards));
  if (round.moonPossible && cards.some(isPointCard)) {
    if (round.moonPlayer === -1) {
      round.moonPlayer = winner;
      round.moonByHuman = winner === 0;
    } else if (round.moonPlayer !== winner) round.moonPossible = false;
  }
  return winner;
};

// The winner gathers the trick, last card first, keeping its point cards.
// Returns the order the cards leave the table, by seat.
export const collectTrick = (round, winner) => {
  const { trick } = round;
  const order = [];
  for (let offset = PLAYERS - 1; offset >= 0; offset -= 1) {
    const seat = (trick.leader + offset) % PLAYERS;
    order.push(seat);
    const card = trick.played[seat];
    if (isPointCard(card)) round.taken[winner].push(card);
    const slot = round.slots[seat].find(
      (entry) => entry.state === ON_TABLE && entry.card === card,
    );
    slot.card = -1;
    slot.state = GONE;
  }
  round.trick = createTrick(winner);
  round.tricksLeft -= 1;
  return order;
};

// Adds the hand's points to the running scores. Taking every heart and
// the queen gives everyone else 26 instead.
export const scoreRound = (round, scores) => {
  const next = scores.map(
    (score, seat) => score + pointsOf(round.taken[seat]),
  );
  const shooter = round.taken.findIndex((cards) => cards.length === 14);
  if (shooter === -1) return { scores: next, shooter };
  return {
    scores: next.map((score, seat) =>
      seat === shooter ? score - 26 : score + 26,
    ),
    shooter,
  };
};

// The Score Sheet keeps the running totals of the last 12 hands.
export const SHEET_ROWS = 12;
export const addToSheet = (sheet, scores) =>
  [...sheet, [...scores]].slice(-SHEET_ROWS);

export const GAME_OVER_SCORE = 100;
export const isGameOver = (scores) =>
  Math.max(...scores) >= GAME_OVER_SCORE;
export const lowestScore = (scores) => Math.min(...scores);

// Places count the opponents with fewer points; ties share the better one.
export const PLACES = ["First Place", "Second Place", "Third Place", "Last Place"];
export const placeOf = (scores, seat = 0) =>
  scores.filter((score, other) => other !== seat && score < scores[seat])
    .length;

// ---- Card motion ----

// Newton's square root, stopping within 3, as mshearts.exe computes a
// card's travel distance.
export const roughRoot = (value) => {
  let root = Math.min(Math.trunc(value / 2), 1024);
  let change = Math.abs(root - value);
  while (change > 3) {
    const next = root + Math.trunc((root * root - value) / (root * -2));
    change = Math.abs(next - root);
    root = next;
  }
  return root;
};

// The positions a card passes through moving `speed` pixels a step, an
// even number of steps, ending exactly on the target.
export const glidePath = (from, to, speed) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let steps = Math.trunc(roughRoot(dx * dx + dy * dy) / speed);
  if (steps % 2 === 1) steps += 1;
  const path = [];
  for (let step = 1; step < steps; step += 1)
    path.push({
      x: from.x + Math.trunc((dx * step) / steps),
      y: from.y + Math.trunc((dy * step) / steps),
    });
  path.push({ x: to.x, y: to.y });
  return path;
};

// Pixels per step: a played card moves 5, 15 or 60; a gathered trick 5
// when Slow and 30 otherwise.
export const PLAY_SPEEDS = { slow: 5, normal: 15, fast: 60 };
export const gatherSpeed = (speed) => (speed === "slow" ? 5 : 30);

// ---- Starting games ----

// A new game draws its number from the running generator and reseeds it
// with that number before the first deal.
export const newGameSeed = (generator) => {
  const seed = generator.next();
  generator.seed(seed);
  return seed;
};
