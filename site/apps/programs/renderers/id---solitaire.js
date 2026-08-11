import { createProgramRoot } from "../ui.js";

export const renderIdSolitaire = (context, program, programId) => {
  const content = createProgramRoot(program);

  content.className += " xp-solitaire";
  content.innerHTML = `<div class="xp-solitaire-menu"><button type="button" data-new-game>Game</button><button type="button">Help</button><span>Score: <output data-score>0</output></span></div><div class="xp-solitaire-board"><button type="button" class="xp-solitaire-stock" aria-label="Draw from stock"></button><button type="button" class="xp-solitaire-waste empty" aria-label="Waste pile"></button><div class="xp-solitaire-spacer"></div><div class="xp-solitaire-foundations" aria-label="Foundations"></div><div class="xp-solitaire-tableau" aria-label="Tableau"></div></div>`;
  const suits = ["♠", "♥", "♦", "♣"];
  const redSuits = new Set(["♥", "♦"]);
  const rankLabel = (rank) =>
    rank === 1
      ? "A"
      : rank === 11
        ? "J"
        : rank === 12
          ? "Q"
          : rank === 13
            ? "K"
            : String(rank);
  const cardMarkup = (card) =>
    `<span>${rankLabel(card.rank)}</span><b>${card.suit}</b>`;
  const stockButton = content.querySelector(".xp-solitaire-stock");
  const wasteButton = content.querySelector(".xp-solitaire-waste");
  const tableauElement = content.querySelector(".xp-solitaire-tableau");
  const foundationsElement = content.querySelector(".xp-solitaire-foundations");
  const score = content.querySelector("[data-score]");
  wasteButton.dataset.baseClass = "xp-solitaire-waste";
  let stock = [];
  let waste = [];
  let tableau = [];
  let foundations = new Map();
  let selected = null;

  const renderCard = (button, card, faceUp = true) => {
    button.className = `${button.dataset.baseClass || "xp-playing-card"}${faceUp ? " face-up" : " face-down"}${redSuits.has(card.suit) ? " red" : ""}`;
    button.innerHTML = faceUp ? cardMarkup(card) : "";
    button.setAttribute(
      "aria-label",
      faceUp ? `${rankLabel(card.rank)} of ${card.suit}` : "Face-down card",
    );
  };
  const render = () => {
    stockButton.classList.toggle("empty", stock.length === 0);
    if (waste.length) renderCard(wasteButton, waste.at(-1));
    else {
      wasteButton.className = "xp-solitaire-waste empty";
      wasteButton.replaceChildren();
      wasteButton.setAttribute("aria-label", "Empty waste pile");
    }
    wasteButton.classList.toggle("selected", selected?.source === "waste");
    foundationsElement.replaceChildren();
    suits.forEach((suit) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "xp-solitaire-foundation empty";
      button.dataset.baseClass = "xp-solitaire-foundation";
      button.dataset.suit = suit;
      const cards = foundations.get(suit) || [];
      if (cards.length) renderCard(button, cards.at(-1));
      else button.textContent = suit;
      foundationsElement.appendChild(button);
    });
    tableauElement.replaceChildren();
    tableau.forEach((column, columnIndex) => {
      const pile = document.createElement("div");
      pile.className = "xp-solitaire-column";
      pile.dataset.column = String(columnIndex);
      column.forEach((card, cardIndex) => {
        const button = document.createElement("button");
        button.type = "button";
        button.style.setProperty("--card-index", cardIndex);
        renderCard(button, card, card.faceUp);
        button.dataset.card = String(cardIndex);
        if (
          selected?.source === "tableau" &&
          selected.column === columnIndex &&
          selected.card === cardIndex
        )
          button.classList.add("selected");
        pile.appendChild(button);
      });
      tableauElement.appendChild(pile);
    });
  };
  const revealTop = (column) => {
    if (column.at(-1)) column.at(-1).faceUp = true;
  };
  const selectedCard = () =>
    selected?.source === "waste"
      ? waste.at(-1)
      : tableau[selected?.column]?.[selected?.card];
  const removeSelected = () => {
    if (selected.source === "waste") return waste.pop();
    const cards = tableau[selected.column].splice(selected.card);
    revealTop(tableau[selected.column]);
    return cards;
  };
  const validTableauMove = (card, destination) => {
    const top = destination.at(-1);
    return top
      ? top.faceUp &&
          top.rank === card.rank + 1 &&
          redSuits.has(top.suit) !== redSuits.has(card.suit)
      : card.rank === 13;
  };
  stockButton.addEventListener("click", () => {
    selected = null;
    if (stock.length) {
      const card = stock.pop();
      card.faceUp = true;
      waste.push(card);
    } else if (waste.length) {
      stock = waste.reverse().map((card) => ({ ...card, faceUp: false }));
      waste = [];
    }
    render();
  });
  wasteButton.addEventListener("click", () => {
    if (!waste.length) return;
    selected = selected?.source === "waste" ? null : { source: "waste" };
    render();
  });
  tableauElement.addEventListener("click", (event) => {
    const pile = event.target.closest(".xp-solitaire-column");
    const cardButton = event.target.closest("[data-card]");
    if (!pile) return;
    const column = Number(pile.dataset.column);
    if (selected) {
      const card = selectedCard();
      if (card && validTableauMove(card, tableau[column])) {
        const moved = removeSelected();
        tableau[column].push(...(Array.isArray(moved) ? moved : [moved]));
        score.textContent = String(Number(score.textContent) + 5);
        selected = null;
        render();
        return;
      }
    }
    if (!cardButton) return;
    const cardIndex = Number(cardButton.dataset.card);
    if (!tableau[column][cardIndex].faceUp) return;
    selected = { source: "tableau", column, card: cardIndex };
    render();
  });
  foundationsElement.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || !selected) return;
    const card = selectedCard();
    const foundation = foundations.get(button.dataset.suit) || [];
    const isSingleCard =
      selected.source === "waste" ||
      selected.card === tableau[selected.column].length - 1;
    if (
      isSingleCard &&
      card?.suit === button.dataset.suit &&
      card.rank === foundation.length + 1
    ) {
      const moved = removeSelected();
      foundation.push(Array.isArray(moved) ? moved[0] : moved);
      foundations.set(card.suit, foundation);
      score.textContent = String(Number(score.textContent) + 10);
      selected = null;
      render();
    }
  });
  const newGame = () => {
    const deck = suits.flatMap((suit) =>
      Array.from({ length: 13 }, (_, index) => ({
        suit,
        rank: index + 1,
        faceUp: false,
      })),
    );
    for (let index = deck.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [deck[index], deck[target]] = [deck[target], deck[index]];
    }
    tableau = Array.from({ length: 7 }, (_, column) => {
      const cards = deck.splice(0, column + 1);
      cards.at(-1).faceUp = true;
      return cards;
    });
    stock = deck;
    waste = [];
    foundations = new Map();
    selected = null;
    score.textContent = "0";
    render();
  };
  content.querySelector("[data-new-game]").addEventListener("click", newGame);
  newGame();
  return content;
};
