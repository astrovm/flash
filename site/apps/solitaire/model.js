const SUITS = ["clubs", "diamonds", "hearts", "spades"];
const RED_SUITS = new Set(["diamonds", "hearts"]);

export const createDeck = () =>
  SUITS.flatMap((suit, suitIndex) =>
    Array.from({ length: 13 }, (_, rankIndex) => ({
      id: suitIndex * 13 + rankIndex + 1,
      suit,
      rank: rankIndex + 1,
      faceUp: false,
    })),
  );

export const shuffledDeck = (random = Math.random) => {
  const deck = createDeck();
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [deck[index], deck[target]] = [deck[target], deck[index]];
  }
  return deck;
};

const cloneCard = (card) => ({ ...card });
const cloneState = (game) => ({
  stock: game.stock.map(cloneCard),
  waste: game.waste.map(cloneCard),
  tableau: game.tableau.map((pile) => pile.map(cloneCard)),
  foundations: Object.fromEntries(
    SUITS.map((suit) => [suit, game.foundations[suit].map(cloneCard)]),
  ),
  score: game.score,
  moves: game.moves,
});

const restoreState = (game, snapshot) => {
  game.stock = snapshot.stock;
  game.waste = snapshot.waste;
  game.tableau = snapshot.tableau;
  game.foundations = snapshot.foundations;
  game.score = snapshot.score;
  game.moves = snapshot.moves;
};

const isRed = (card) => RED_SUITS.has(card.suit);

export const canPlaceOnTableau = (card, destination) => {
  const top = destination.at(-1);
  return top
    ? top.faceUp && top.rank === card.rank + 1 && isRed(top) !== isRed(card)
    : card.rank === 13;
};

export const canPlaceOnFoundation = (card, foundation, suit) =>
  card.suit === suit && card.rank === foundation.length + 1;

export const createSolitaireGame = ({
  random = Math.random,
  drawCount = 3,
  scoring = "standard",
} = {}) => {
  const game = {
    stock: [],
    waste: [],
    tableau: [],
    foundations: Object.fromEntries(SUITS.map((suit) => [suit, []])),
    score: 0,
    moves: 0,
    drawCount,
    scoring,
    history: [],
  };

  const addScore = (standard, vegas = 0) => {
    if (game.scoring === "standard") game.score += standard;
    if (game.scoring === "vegas") game.score += vegas;
  };
  const remember = () => game.history.push(cloneState(game));
  const finishMove = () => {
    game.moves += 1;
    return true;
  };
  const revealTop = (pile) => {
    const top = pile.at(-1);
    if (top && !top.faceUp) {
      top.faceUp = true;
      addScore(5);
    }
  };
  const sourceCards = (source) => {
    if (source.type === "waste") {
      return game.waste.length ? [game.waste.at(-1)] : [];
    }
    if (source.type === "foundation") {
      const pile = game.foundations[source.suit];
      return pile?.length ? [pile.at(-1)] : [];
    }
    if (source.type === "tableau") {
      const pile = game.tableau[source.column];
      const cards = pile?.slice(source.index) || [];
      if (!cards.length || cards.some((card) => !card.faceUp)) return [];
      for (let index = 1; index < cards.length; index += 1) {
        if (!canPlaceOnTableau(cards[index], [cards[index - 1]])) return [];
      }
      return cards;
    }
    return [];
  };
  const removeSource = (source) => {
    if (source.type === "waste") return [game.waste.pop()];
    if (source.type === "foundation") {
      return [game.foundations[source.suit].pop()];
    }
    const pile = game.tableau[source.column];
    const cards = pile.splice(source.index);
    revealTop(pile);
    return cards;
  };

  game.deal = () => {
    const deck = shuffledDeck(random);
    game.stock = [];
    game.waste = [];
    game.tableau = Array.from({ length: 7 }, () => []);
    game.foundations = Object.fromEntries(SUITS.map((suit) => [suit, []]));
    for (let row = 0; row < 7; row += 1) {
      for (let column = row; column < 7; column += 1) {
        const card = deck.pop();
        card.faceUp = column === row;
        game.tableau[column].push(card);
      }
    }
    game.stock = deck;
    game.score = scoring === "vegas" ? -52 : 0;
    game.moves = 0;
    game.history = [];
    return game;
  };

  game.draw = () => {
    if (!game.stock.length && !game.waste.length) return false;
    remember();
    if (!game.stock.length) {
      game.stock = game.waste.reverse().map((card) => ({
        ...card,
        faceUp: false,
      }));
      game.waste = [];
      if (game.drawCount === 1) addScore(-100);
      return finishMove();
    }
    for (
      let count = 0;
      count < game.drawCount && game.stock.length;
      count += 1
    ) {
      const card = game.stock.pop();
      card.faceUp = true;
      game.waste.push(card);
    }
    return finishMove();
  };

  game.flip = (column) => {
    const pile = game.tableau[column];
    const top = pile?.at(-1);
    if (!top || top.faceUp) return false;
    remember();
    top.faceUp = true;
    addScore(5);
    return finishMove();
  };

  game.move = (source, destination) => {
    const cards = sourceCards(source);
    if (!cards.length) return false;
    const first = cards[0];
    if (destination.type === "tableau") {
      const pile = game.tableau[destination.column];
      if (!pile || !canPlaceOnTableau(first, pile)) return false;
    } else if (destination.type === "foundation") {
      const pile = game.foundations[destination.suit];
      if (
        cards.length !== 1 ||
        !pile ||
        !canPlaceOnFoundation(first, pile, destination.suit)
      )
        return false;
    } else {
      return false;
    }
    remember();
    const moved = removeSource(source);
    if (destination.type === "tableau") {
      game.tableau[destination.column].push(...moved);
      if (source.type === "waste") addScore(5);
      if (source.type === "foundation") addScore(-15);
    } else {
      game.foundations[destination.suit].push(moved[0]);
      addScore(10, 5);
    }
    return finishMove();
  };

  game.autoMove = (source) => {
    const card = sourceCards(source)[0];
    return card
      ? game.move(source, { type: "foundation", suit: card.suit })
      : false;
  };

  game.undo = () => {
    const snapshot = game.history.pop();
    if (!snapshot) return false;
    restoreState(game, snapshot);
    return true;
  };

  game.isWon = () =>
    SUITS.every((suit) => game.foundations[suit].length === 13);

  return game.deal();
};

export { SUITS };
