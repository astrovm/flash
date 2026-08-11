import { createProgramRoot } from "../ui.js";

export const renderIdFreecell = (context, program, programId) => {
  const content = createProgramRoot(program);

  content.className += " xp-freecell";
  content.innerHTML = `<div class="xp-freecell-menu"><button type="button" data-freecell-new>Game</button><button type="button">Help</button><span data-freecell-status>Game in progress</span></div><div class="xp-freecell-board"><div class="xp-freecell-cells" aria-label="Free cells"></div><div class="xp-freecell-foundations" aria-label="Foundations"></div><div class="xp-freecell-cascades" aria-label="Cascades"></div></div>`;
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
  const freeCellElement = content.querySelector(".xp-freecell-cells");
  const foundationElement = content.querySelector(".xp-freecell-foundations");
  const cascadeElement = content.querySelector(".xp-freecell-cascades");
  const status = content.querySelector("[data-freecell-status]");
  let freeCells = Array(4).fill(null);
  let foundations = new Map();
  let cascades = [];
  let selected = null;
  const renderCard = (button, card) => {
    button.className = `xp-playing-card face-up${redSuits.has(card.suit) ? " red" : ""}`;
    button.innerHTML = `<span>${rankLabel(card.rank)}</span><b>${card.suit}</b>`;
    button.setAttribute(
      "aria-label",
      `${rankLabel(card.rank)} of ${card.suit}`,
    );
  };
  const selectedCard = () =>
    selected?.source === "cell"
      ? freeCells[selected.index]
      : cascades[selected?.index]?.at(-1);
  const removeSelected = () => {
    const card = selectedCard();
    if (selected.source === "cell") freeCells[selected.index] = null;
    else cascades[selected.index].pop();
    return card;
  };
  const validCascadeMove = (card, destination) => {
    const top = destination.at(-1);
    return (
      !top ||
      (top.rank === card.rank + 1 &&
        redSuits.has(top.suit) !== redSuits.has(card.suit))
    );
  };
  const render = () => {
    freeCellElement.replaceChildren();
    freeCells.forEach((card, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.cell = String(index);
      button.className = "xp-freecell-slot empty";
      if (card) renderCard(button, card);
      else button.setAttribute("aria-label", `Empty free cell ${index + 1}`);
      if (selected?.source === "cell" && selected.index === index)
        button.classList.add("selected");
      freeCellElement.appendChild(button);
    });
    foundationElement.replaceChildren();
    suits.forEach((suit) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.suit = suit;
      button.className = "xp-freecell-foundation empty";
      const pile = foundations.get(suit) || [];
      if (pile.length) renderCard(button, pile.at(-1));
      else button.textContent = suit;
      foundationElement.appendChild(button);
    });
    cascadeElement.replaceChildren();
    cascades.forEach((cascade, cascadeIndex) => {
      const column = document.createElement("div");
      column.className = "xp-freecell-cascade";
      column.dataset.cascade = String(cascadeIndex);
      cascade.forEach((card, cardIndex) => {
        const button = document.createElement("button");
        button.type = "button";
        button.style.setProperty("--card-index", cardIndex);
        renderCard(button, card);
        if (
          selected?.source === "cascade" &&
          selected.index === cascadeIndex &&
          cardIndex === cascade.length - 1
        )
          button.classList.add("selected");
        column.appendChild(button);
      });
      cascadeElement.appendChild(column);
    });
    const remaining = cascades.reduce((total, pile) => total + pile.length, 0);
    if (!remaining && freeCells.every((card) => !card))
      status.textContent = "You won!";
  };
  freeCellElement.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cell]");
    if (!button) return;
    const index = Number(button.dataset.cell);
    if (selected && !freeCells[index]) {
      freeCells[index] = removeSelected();
      selected = null;
    } else if (freeCells[index]) {
      selected = { source: "cell", index };
    }
    render();
  });
  cascadeElement.addEventListener("click", (event) => {
    const column = event.target.closest("[data-cascade]");
    if (!column) return;
    const index = Number(column.dataset.cascade);
    if (selected) {
      const card = selectedCard();
      if (card && validCascadeMove(card, cascades[index])) {
        cascades[index].push(removeSelected());
        selected = null;
        render();
        return;
      }
    }
    if (cascades[index].length) selected = { source: "cascade", index };
    render();
  });
  foundationElement.addEventListener("click", (event) => {
    const button = event.target.closest("[data-suit]");
    if (!button || !selected) return;
    const card = selectedCard();
    const pile = foundations.get(button.dataset.suit) || [];
    if (card?.suit === button.dataset.suit && card.rank === pile.length + 1) {
      pile.push(removeSelected());
      foundations.set(button.dataset.suit, pile);
      selected = null;
      render();
    }
  });
  const newGame = () => {
    const deck = suits.flatMap((suit) =>
      Array.from({ length: 13 }, (_, index) => ({
        suit,
        rank: index + 1,
      })),
    );
    for (let index = deck.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [deck[index], deck[target]] = [deck[target], deck[index]];
    }
    cascades = Array.from({ length: 8 }, () => []);
    deck.forEach((card, index) => cascades[index % 8].push(card));
    freeCells = Array(4).fill(null);
    foundations = new Map();
    selected = null;
    status.textContent = "Game in progress";
    render();
  };
  content
    .querySelector("[data-freecell-new]")
    .addEventListener("click", newGame);
  newGame();
  return content;
};
