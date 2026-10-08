// @ts-nocheck -- Hearts' rules module is untyped browser JavaScript.
import { describe, expect, test } from "bun:test";

import {
  GONE,
  IN_HAND,
  NO_PASS,
  ON_TABLE,
  PASS_OFFSETS,
  PLACES,
  QUEEN_OF_SPADES,
  SELECTED,
  SHEET_ROWS,
  TWO_OF_CLUBS,
  addToSheet,
  checkMove,
  chooseComputerPasses,
  choosePass,
  choosePlay,
  collectTrick,
  compareSlots,
  createGenerator,
  createMemory,
  createRound,
  createTrick,
  dealHands,
  exchangeCards,
  finishTrick,
  forgetCards,
  gatherSpeed,
  glidePath,
  handCards,
  inHand,
  isFirstTrick,
  isGameOver,
  isPointCard,
  lowestScore,
  newGameSeed,
  placeOf,
  playCard,
  pointsOf,
  rankOf,
  roughRoot,
  scoreRound,
  selectedCount,
  sortSlots,
  startPlay,
  suitOf,
  trickComplete,
  trickWinner,
} from "../site/apps/hearts/game.js";

const SUITS = "CDHS";
const RANKS = "A23456789TJQK";
const card = (name) => RANKS.indexOf(name[0]) * 4 + SUITS.indexOf(name[1]);
const name = (value) => RANKS[value >> 2] + SUITS[suitOf(value)];
const cards = (text) => text.split(" ").map(card);
const slots = (text) =>
  cards(text).map((value) => ({ card: value, state: IN_HAND }));
const names = (list) => list.map(name).join(" ");

// A round with the given hands, ready to play.
const roundOf = (hands, overrides = {}) => {
  const round = createRound(hands.map(cards), NO_PASS);
  startPlay(round);
  return Object.assign(round, overrides);
};
const indexOf = (round, seat, value) =>
  round.slots[seat].findIndex((slot) => slot.card === card(value));
const play = (round, seat, value) =>
  playCard(round, seat, indexOf(round, seat, value));

// Plays a whole hand with every seat choosing like a computer, checking each
// card against the human's rules first. `human` picks seat 0's card instead.
const playHand = (round, human) => {
  startPlay(round);
  while (round.tricksLeft) {
    for (let turn = 0; turn < 4; turn += 1) {
      const seat = round.trick.current;
      const hand = round.slots[seat];
      const index =
        seat === 0 && human
          ? human(round)
          : choosePlay(hand, round.memory[seat], round, seat);
      expect(inHand(hand[index])).toBeTrue();
      expect(checkMove(hand, index, round, seat)).toBeNull();
      playCard(round, seat, index);
    }
    expect(trickComplete(round)).toBeTrue();
    collectTrick(round, finishTrick(round));
  }
};

// Space plays the leftmost card the rules allow.
const leftmostLegal = (round) =>
  round.slots[0].findIndex(
    (slot, index) => inHand(slot) && !checkMove(round.slots[0], index, round),
  );

describe("Hearts deals", () => {
  test("a game number reproduces mshearts.exe's deal from the XP VM", () => {
    const generator = createGenerator(0);
    generator.seed(714);
    const hands = dealHands(generator.next);
    const human = sortSlots(
      hands[0].map((value) => ({ card: value, state: IN_HAND })),
    );
    // The VM's first hand, left to right.
    expect(names(human.map((slot) => slot.card))).toBe(
      "2C 8C KC 3D 7D 9D TD KD 7S TS KS 8H TH",
    );
    expect(hands.flat().sort((a, b) => a - b)).toEqual(
      Array.from({ length: 52 }, (_, index) => index),
    );
  });

  test("each draw takes rand() % remaining and fills the hole from the end", () => {
    const draws = [0, 0, ...Array(50).fill(0)];
    const hands = dealHands(() => draws.shift());
    // Slot 0 is refilled with the pool's last card every time.
    expect(hands[0].slice(0, 3)).toEqual([0, 51, 50]);
    expect(dealHands(() => 51)[0][0]).toBe(51);
  });

  test("a new game reseeds the generator with the number it draws", () => {
    const generator = createGenerator(1);
    const seed = newGameSeed(generator);
    const copy = createGenerator(seed);
    expect(generator.next()).toBe(copy.next());
    expect(seed).toBe(createGenerator(1).next());
  });

  test("the human's hand sorts clubs, diamonds, spades, hearts, ace high", () => {
    const sorted = sortSlots([
      ...slots("AH 2H QS AC 3D 2C"),
      { card: -1, state: GONE },
    ]);
    expect(names(sorted.slice(0, 6).map((slot) => slot.card))).toBe(
      "2C AC 3D QS 2H AH",
    );
    expect(sorted.at(-1).state).toBe(GONE);
    const gone = { card: -1, state: GONE };
    expect(compareSlots(gone, gone)).toBe(0);
    expect(compareSlots(gone, slots("2C")[0])).toBe(1);
  });

  test("card helpers", () => {
    expect(rankOf(card("AS"))).toBe(13);
    expect(rankOf(card("2S"))).toBe(1);
    expect(isPointCard(QUEEN_OF_SPADES)).toBeTrue();
    expect(isPointCard(card("KS"))).toBeFalse();
    expect(pointsOf(cards("QS AH 2H KS"))).toBe(15);
    expect(
      handCards([...slots("2C"), { card: -1, state: GONE }]).map(name),
    ).toEqual(["2C"]);
  });
});

describe("Hearts passing", () => {
  test("passes go left, right, across, then not at all", () => {
    expect(PASS_OFFSETS).toEqual([1, 3, 2, 0]);
    for (const [mode, target] of [
      [0, 1],
      [1, 3],
      [2, 2],
    ]) {
      const generator = createGenerator(7);
      const round = createRound(dealHands(generator.next), mode);
      chooseComputerPasses(round);
      [0, 1, 2].forEach((index) => (round.slots[0][index].state = SELECTED));
      const mine = round.slots[0].slice(0, 3).map((slot) => slot.card);
      const given = exchangeCards(round);
      expect(given[0]).toEqual(mine);
      const received = round.slots[target].map((slot) => slot.card);
      for (const value of mine) expect(received).toContain(value);
      // Each hand still holds 13 cards, all different.
      expect(
        round.slots
          .flatMap((hand) => hand.map((slot) => slot.card))
          .sort((a, b) => a - b),
      ).toEqual(Array.from({ length: 52 }, (_, index) => index));
      // The human's new cards stay raised until accepted.
      expect(selectedCount(round.slots[0])).toBe(3);
      startPlay(round);
      expect(selectedCount(round.slots[0])).toBe(0);
      for (let seat = 1; seat < 4; seat += 1)
        expect(selectedCount(round.slots[seat])).toBe(0);
    }
  });

  test("a computer passes the high spades, high hearts, then short suits", () => {
    const pass = (text) =>
      names(choosePass(slots(text)).map((index) => card(text.split(" ")[index])));
    expect(pass("AS KS QS 2C 3C 4C 5C 6C 7C 8C 2D 3D 4D")).toBe("AS KS QS");
    expect(pass("AH KH 2S 2C 3C 4C 5C 6C 7C 8C 2D 3D 4D")).toBe("AH KH 2S");
    // Diamonds hold a single low card, so their high cards go, then the
    // lone heart as a whole suit.
    expect(pass("2S 3S 4S 5S 2C 3C 4C 5C 6C KD QD 2D 7H")).toBe("KD QD 7H");
    // A whole suit that fits, then the highest cards left.
    expect(pass("2S 3S 4S 5S 6S 2C 3C 4C 5C 6C 7C 2D 3H")).toBe("3H 2D 6S");
    // A card on the table is no longer in hand; the lone jack is a
    // whole suit.
    const hand = slots("AS KS QS JS 2C 3C 4C 5C 6C 7C 8C 9C TC");
    hand[0].state = ON_TABLE;
    expect(choosePass(hand).map((index) => name(hand[index].card))).toEqual([
      "KS",
      "QS",
      "JS",
    ]);
  });
});

describe("Hearts moves", () => {
  const blank = (overrides) =>
    roundOf(
      [
        "2C 3C AH 2H 3H 4H 5H 6H 7H 8H 9H TH JH",
        "4C 5C 2D 3D 4D 5D 6D 7D 8D 9D TD JD QD",
        "6C 7C 2S 3S 4S 5S 6S 7S 8S 9S TS JS QS",
        "8C 9C TC JC QC KC AC KD AD KS AS KH QH",
      ],
      overrides,
    );

  test("the two of clubs leads the first trick", () => {
    const round = blank();
    expect(round.trick.leader).toBe(0);
    expect(checkMove(round.slots[0], indexOf(round, 0, "3C"), round)).toEqual({
      id: 314,
      text: "You must lead the two of clubs.",
    });
    expect(
      checkMove(round.slots[0], indexOf(round, 0, "2C"), round),
    ).toBeNull();
    play(round, 0, "2C");
    expect(isFirstTrick(round.trick)).toBeTrue();
  });

  test("hearts can't lead until broken, unless only hearts are left", () => {
    const round = blank({ trick: createTrick(0) });
    round.slots[0][indexOf(round, 0, "2C")].card = -1;
    expect(checkMove(round.slots[0], indexOf(round, 0, "2H"), round)).toEqual({
      id: 313,
      text: "Hearts has not been broken.  Choose another suit.",
    });
    round.heartsBroken = true;
    expect(
      checkMove(round.slots[0], indexOf(round, 0, "2H"), round),
    ).toBeNull();
    round.heartsBroken = false;
    round.slots[0][indexOf(round, 0, "3C")].card = -1;
    expect(
      checkMove(round.slots[0], indexOf(round, 0, "2H"), round),
    ).toBeNull();
  });

  test("players follow suit and name the suit led", () => {
    for (const [lead, suit] of [
      ["4D", "diamond"],
      ["4S", "spade"],
      ["4C", "club"],
      ["4H", "heart"],
    ]) {
      const round = roundOf(
        [
          "9C 2D 2S 3H 5H 6H 7H 8H 9H TH JH QH KH",
          "4C 5C 3D 4D 5D 6D 7D 8D 9D TD JD QD AH",
          "6C 7C 3S 4S 5S 6S 7S 8S 9S TS JS QS 2H",
          "8C 2C TC JC QC KC AC KD AD KS AS 3C 4H",
        ],
        { trick: createTrick(3) },
      );
      round.trick.played[3] = card(lead);
      const other = lead === "4H" ? "2D" : "3H";
      expect(
        checkMove(round.slots[0], indexOf(round, 0, other), round),
      ).toEqual({
        id: 312,
        text: `You must follow suit.  Play a ${suit}.`,
        followSuit: true,
      });
    }
  });

  test("no point cards on the first trick, unless the hand holds nothing else", () => {
    const round = roundOf([
      "3C AH 2H 3H 4H 5H 6H 7H 8H 9H TH JH QS",
      "2C 5C 2D 3D 4D 5D 6D 7D 8D 9D TD JD QD",
      "6C 7C 2S 3S 4S 5S 6S 7S 8S 9S TS JS KS",
      "8C 9C TC JC QC KC AC KD AD 4C AS KH QH",
    ]);
    play(round, 1, "2C");
    play(round, 2, "6C");
    play(round, 3, "8C");
    // The human holds a club and must play it.
    expect(
      checkMove(round.slots[0], indexOf(round, 0, "AH"), round).id,
    ).toBe(312);
    round.slots[0][indexOf(round, 0, "3C")].card = card("2S");
    // A spade is no point card, so hearts and the queen must wait.
    for (const value of ["AH", "QS"])
      expect(
        checkMove(round.slots[0], indexOf(round, 0, value), round),
      ).toEqual({
        id: 338,
        text: "You cannot play a point card on the first trick.  Select again.",
      });
    expect(
      checkMove(round.slots[0], indexOf(round, 0, "2S"), round),
    ).toBeNull();
    // With only hearts and the queen, either may go.
    round.slots[0][indexOf(round, 0, "2S")].card = card("KH");
    expect(
      checkMove(round.slots[0], indexOf(round, 0, "QS"), round),
    ).toBeNull();
    expect(
      checkMove(round.slots[0], indexOf(round, 0, "AH"), round),
    ).toBeNull();
  });

  test("any card goes before a trick has a lead", () => {
    const round = blank({ trick: createTrick(2) });
    expect(checkMove(round.slots[0], 5, round)).toBeNull();
  });

  test("the highest card of the suit led takes the trick, ace high", () => {
    const trick = createTrick(1);
    // Cards are by seat; seat 1 led the five of clubs.
    trick.played = cards("AC 5C KH 4C");
    expect(trickWinner(trick)).toBe(0);
    trick.played = cards("2C 5C KH 4C");
    expect(trickWinner(trick)).toBe(1);
    trick.played = cards("AS 5C KH AC");
    expect(trickWinner(trick)).toBe(3);
  });

  test("the first heart breaks hearts and the queen is noted", () => {
    const round = blank({ trick: createTrick(0) });
    expect(play(round, 0, "2H")).toEqual(["hearts"]);
    expect(round.heartsBroken).toBeTrue();
    expect(play(round, 1, "QD")).toEqual([]);
    expect(play(round, 2, "QS")).toEqual(["queen"]);
    expect(play(round, 3, "KH")).toEqual([]);
    expect(round.queenPlayed).toBeTrue();
    const winner = finishTrick(round);
    expect(winner).toBe(3);
    expect(collectTrick(round, winner)).toEqual([3, 2, 1, 0]);
    expect(names(round.taken[3])).toBe("KH QS 2H");
    expect(round.trick.leader).toBe(3);
    expect(round.tricksLeft).toBe(12);
  });

  test("each computer forgets the cards it has seen", () => {
    const unseen = createMemory(slots("2C AS"));
    expect(unseen[0][1]).toBeFalse();
    expect(unseen[3][13]).toBeFalse();
    expect(unseen[2][13]).toBeTrue();
    forgetCards(unseen, cards("AH"));
    expect(unseen[2][13]).toBeFalse();
    expect(createMemory([{ card: -1 }])[0][1]).toBeTrue();
  });
});

describe("Hearts scoring", () => {
  test("hearts are one point and the queen of spades thirteen", () => {
    const round = { taken: [cards("QS 2H"), cards("3H"), [], []] };
    expect(scoreRound(round, [10, 0, 0, 0])).toEqual({
      scores: [24, 1, 0, 0],
      shooter: -1,
    });
  });

  test("shooting the moon gives everyone else 26", () => {
    const all = cards(
      "QS AH 2H 3H 4H 5H 6H 7H 8H 9H TH JH QH KH",
    );
    const round = { taken: [[], all, [], []] };
    expect(scoreRound(round, [5, 50, 0, 0])).toEqual({
      scores: [31, 50, 26, 26],
      shooter: 1,
    });
  });

  test("the moon stays possible only while one player takes the points", () => {
    const round = roundOf([
      "2C 3C AH 2H 3H 4H 5H 6H 7H 8H 9H TH JH",
      "4C 5C 2D 3D 4D 5D 6D 7D 8D 9D TD JD QD",
      "6C 7C 2S 3S 4S 5S 6S 7S 8S 9S TS JS QS",
      "8C 9C TC JC QC KC AC KD AD KS AS KH QH",
    ]);
    const trick = (leader, played) => {
      round.trick = createTrick(leader);
      round.trick.played = cards(played);
      return finishTrick(round);
    };
    expect(trick(0, "2C 4C 6C 8C")).toBe(3);
    expect(round.moonPlayer).toBe(-1);
    expect(trick(0, "AH 2D 2S KH")).toBe(0);
    expect(round.moonPlayer).toBe(0);
    expect(round.moonByHuman).toBeTrue();
    expect(trick(0, "5H 3D 3S 4H")).toBe(0);
    expect(round.moonPossible).toBeTrue();
    expect(trick(3, "3H 4D 4S QH")).toBe(3);
    expect(round.moonPossible).toBeFalse();
  });

  test("the game ends when someone reaches 100; ties share a place", () => {
    expect(isGameOver([99, 0, 0, 0])).toBeFalse();
    expect(isGameOver([20, 100, 0, 0])).toBeTrue();
    expect(lowestScore([20, 100, 5, 5])).toBe(5);
    expect(PLACES[placeOf([5, 100, 5, 20])]).toBe("First Place");
    expect(PLACES[placeOf([20, 100, 5, 5])]).toBe("Third Place");
    expect(PLACES[placeOf([120, 39, 26, 23])]).toBe("Last Place");
    expect(placeOf([120, 39, 26, 23], 3)).toBe(0);
  });

  test("the Score Sheet keeps the last 12 hands", () => {
    let sheet = [];
    for (let hand = 1; hand <= 14; hand += 1)
      sheet = addToSheet(sheet, [hand, 0, 0, 0]);
    expect(sheet).toHaveLength(SHEET_ROWS);
    expect(sheet[0][0]).toBe(3);
    expect(sheet.at(-1)[0]).toBe(14);
  });
});

describe("Hearts games", () => {
  // The XP VM's game 714: the human passed K♣ K♦ K♠ first, then its three
  // rightmost cards, and pressed Space for every card. These are the Score
  // Sheet's rows in the VM.
  test("replays the XP VM's game 714 to the same scores", () => {
    const generator = createGenerator(0);
    generator.seed(714);
    const rows = [];
    let scores = [0, 0, 0, 0];
    let passMode = 0;
    for (let hand = 1; !isGameOver(scores); hand += 1) {
      const round = createRound(dealHands(generator.next), passMode);
      if (passMode !== NO_PASS) {
        chooseComputerPasses(round);
        (hand === 1 ? [2, 7, 10] : [10, 11, 12]).forEach((index) => {
          round.slots[0][index].state = SELECTED;
        });
        exchangeCards(round);
        passMode += 1;
      } else passMode = 0;
      playHand(round, leftmostLegal);
      ({ scores } = scoreRound(round, scores));
      rows.push(scores);
    }
    expect(rows).toEqual([
      [20, 6, 0, 0],
      [38, 13, 0, 1],
      [47, 27, 0, 4],
      [60, 27, 0, 17],
      [61, 27, 24, 18],
      [83, 29, 26, 18],
      [99, 36, 26, 21],
      [120, 39, 26, 23],
    ]);
  });

  test("computers play only legal cards through whole games", () => {
    let moons = 0;
    for (let seed = 1; seed <= 60; seed += 1) {
      const generator = createGenerator(seed);
      let scores = [0, 0, 0, 0];
      let passMode = 0;
      let hands = 0;
      while (!isGameOver(scores)) {
        const round = createRound(dealHands(generator.next), passMode);
        if (passMode !== NO_PASS) {
          chooseComputerPasses(round);
          choosePass(round.slots[0]).forEach((index) => {
            round.slots[0][index].state = SELECTED;
          });
          exchangeCards(round);
          passMode += 1;
        } else passMode = 0;
        playHand(round);
        expect(round.slots.flat().every((slot) => slot.state === GONE)).toBe(
          true,
        );
        const before = scores;
        const result = scoreRound(round, scores);
        scores = result.scores;
        if (result.shooter !== -1) moons += 1;
        expect(
          scores.reduce((sum, score) => sum + score, 0) -
            before.reduce((sum, score) => sum + score, 0),
        ).toBe(result.shooter === -1 ? 26 : 78);
        hands += 1;
        expect(hands).toBeLessThan(60);
      }
    }
    expect(moons).toBeGreaterThanOrEqual(0);
  });

  test("a hand with only point cards may play them on the first trick", () => {
    const round = roundOf([
      "2C 3C 4C 5C 6C 7C 8C 9C TC JC QC KC AC",
      "AH 2H 3H 4H 5H 6H 7H 8H 9H TH JH QH QS",
      "2D 3D 4D 5D 6D 7D 8D 9D TD JD QD KD AD",
      "2S 3S 4S 5S 6S 7S 8S 9S TS JS KS AS KH",
    ]);
    play(round, 0, "2C");
    const seat = 1;
    const index = choosePlay(
      round.slots[seat],
      round.memory[seat],
      round,
      seat,
    );
    expect(checkMove(round.slots[seat], index, round, seat)).toBeNull();
    expect(name(round.slots[seat][index].card)).toBe("AH");
  });
});

describe("Hearts card motion", () => {
  test("a rough square root, as mshearts.exe computes distances", () => {
    expect(roughRoot(0)).toBe(0);
    expect(Math.abs(roughRoot(10000) - 100)).toBeLessThanOrEqual(3);
    expect(Math.abs(roughRoot(9_000_000) - 3000)).toBeLessThanOrEqual(3);
  });

  test("cards glide an even number of steps and land on the target", () => {
    const path = glidePath({ x: 0, y: 0 }, { x: 150, y: 0 }, 15);
    expect(path).toHaveLength(10);
    expect(path[0]).toEqual({ x: 15, y: 0 });
    expect(path.at(-1)).toEqual({ x: 150, y: 0 });
    expect(glidePath({ x: 0, y: 0 }, { x: 135, y: 0 }, 15)).toHaveLength(10);
    expect(glidePath({ x: 4, y: 4 }, { x: 4, y: 4 }, 60)).toEqual([
      { x: 4, y: 4 },
    ]);
    expect(gatherSpeed("slow")).toBe(5);
    expect(gatherSpeed("fast")).toBe(30);
  });
});

test("the two of clubs is card 4", () => {
  expect(TWO_OF_CLUBS).toBe(card("2C"));
  expect(QUEEN_OF_SPADES).toBe(card("QS"));
});
