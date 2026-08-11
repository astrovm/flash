import { defineApplication } from "../core/application.js";
import { showXPAboutDialog } from "../core/about-dialog.js";
import { createSolitaireGame, SUITS } from "./model.js";

const CARD_BACKS = [54, 55, 60, 61, 58, 59, 56, 57, 62, 63, 64, 65];
const CARD_IMAGES = [
  null,
  "/assets/xp/solitaire/cards/1.png",
  "/assets/xp/solitaire/cards/2.png",
  "/assets/xp/solitaire/cards/3.png",
  "/assets/xp/solitaire/cards/4.png",
  "/assets/xp/solitaire/cards/5.png",
  "/assets/xp/solitaire/cards/6.png",
  "/assets/xp/solitaire/cards/7.png",
  "/assets/xp/solitaire/cards/8.png",
  "/assets/xp/solitaire/cards/9.png",
  "/assets/xp/solitaire/cards/10.png",
  "/assets/xp/solitaire/cards/11.png",
  "/assets/xp/solitaire/cards/12.png",
  "/assets/xp/solitaire/cards/13.png",
  "/assets/xp/solitaire/cards/14.png",
  "/assets/xp/solitaire/cards/15.png",
  "/assets/xp/solitaire/cards/16.png",
  "/assets/xp/solitaire/cards/17.png",
  "/assets/xp/solitaire/cards/18.png",
  "/assets/xp/solitaire/cards/19.png",
  "/assets/xp/solitaire/cards/20.png",
  "/assets/xp/solitaire/cards/21.png",
  "/assets/xp/solitaire/cards/22.png",
  "/assets/xp/solitaire/cards/23.png",
  "/assets/xp/solitaire/cards/24.png",
  "/assets/xp/solitaire/cards/25.png",
  "/assets/xp/solitaire/cards/26.png",
  "/assets/xp/solitaire/cards/27.png",
  "/assets/xp/solitaire/cards/28.png",
  "/assets/xp/solitaire/cards/29.png",
  "/assets/xp/solitaire/cards/30.png",
  "/assets/xp/solitaire/cards/31.png",
  "/assets/xp/solitaire/cards/32.png",
  "/assets/xp/solitaire/cards/33.png",
  "/assets/xp/solitaire/cards/34.png",
  "/assets/xp/solitaire/cards/35.png",
  "/assets/xp/solitaire/cards/36.png",
  "/assets/xp/solitaire/cards/37.png",
  "/assets/xp/solitaire/cards/38.png",
  "/assets/xp/solitaire/cards/39.png",
  "/assets/xp/solitaire/cards/40.png",
  "/assets/xp/solitaire/cards/41.png",
  "/assets/xp/solitaire/cards/42.png",
  "/assets/xp/solitaire/cards/43.png",
  "/assets/xp/solitaire/cards/44.png",
  "/assets/xp/solitaire/cards/45.png",
  "/assets/xp/solitaire/cards/46.png",
  "/assets/xp/solitaire/cards/47.png",
  "/assets/xp/solitaire/cards/48.png",
  "/assets/xp/solitaire/cards/49.png",
  "/assets/xp/solitaire/cards/50.png",
  "/assets/xp/solitaire/cards/51.png",
  "/assets/xp/solitaire/cards/52.png",
];
const CARD_BACK_IMAGES = Object.freeze({
  54: "/assets/xp/solitaire/backs/54.png",
  55: "/assets/xp/solitaire/backs/55.png",
  56: "/assets/xp/solitaire/backs/56.png",
  57: "/assets/xp/solitaire/backs/57.png",
  58: "/assets/xp/solitaire/backs/58.png",
  59: "/assets/xp/solitaire/backs/59.png",
  60: "/assets/xp/solitaire/backs/60.png",
  61: "/assets/xp/solitaire/backs/61.png",
  62: "/assets/xp/solitaire/backs/62.png",
  63: "/assets/xp/solitaire/backs/63.png",
  64: "/assets/xp/solitaire/backs/64.png",
  65: "/assets/xp/solitaire/backs/65.png",
});
const DEFAULT_OPTIONS = Object.freeze({
  drawCount: 3,
  scoring: "standard",
  timed: true,
  statusBar: true,
  outlineDragging: false,
  cumulative: false,
  cardBack: 58,
});
const STORAGE_KEY = "xp.solitaire.options";

const readOptions = () => {
  try {
    return {
      ...DEFAULT_OPTIONS,
      ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"),
    };
  } catch {
    return { ...DEFAULT_OPTIONS };
  }
};

const writeOptions = (options) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch {
    // The game remains fully usable when browser storage is unavailable.
  }
};

const cardName = (card) => {
  const ranks = [
    "",
    "Ace",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Jack",
    "Queen",
    "King",
  ];
  return `${ranks[card.rank]} of ${card.suit}`;
};

const sourceFromElement = (element) => {
  const card = element.closest("[data-solitaire-source]");
  if (!card) return null;
  try {
    return JSON.parse(card.dataset.solitaireSource);
  } catch {
    return null;
  }
};

const destinationFromElement = (element) => {
  const pile = element.closest("[data-solitaire-destination]");
  if (!pile) return null;
  try {
    return JSON.parse(pile.dataset.solitaireDestination);
  } catch {
    return null;
  }
};

const addHelpButton = (dialog, text) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tb-btn help-btn";
  button.title = "Help";
  button.setAttribute("aria-label", "Help");
  button.addEventListener("click", () =>
    window.XPDialogs.alert(text, "Solitaire Help", "info"),
  );
  dialog.el.querySelector(".title-buttons").prepend(button);
};

const createOptionsDialog = (dialogs, options, apply) => {
  const dialog = dialogs.createDialog({ title: "Options" });
  dialog.el.classList.add("solitaire-options-dialog");
  addHelpButton(dialog, "Choose how cards are drawn and scored.");
  const controls = document.createElement("div");
  controls.className = "solitaire-options-controls";
  const draw = document.createElement("fieldset");
  draw.innerHTML = `<legend>Draw</legend>
    <label><input type="radio" name="solitaire-draw" value="1"> Draw One</label>
    <label><input type="radio" name="solitaire-draw" value="3"> Draw Three</label>`;
  const scoring = document.createElement("fieldset");
  scoring.innerHTML = `<legend>Scoring</legend>
    <label><input type="radio" name="solitaire-scoring" value="standard"> Standard</label>
    <label><input type="radio" name="solitaire-scoring" value="vegas"> Vegas</label>
    <label><input type="radio" name="solitaire-scoring" value="none"> None</label>`;
  controls.append(draw, scoring);
  const checks = document.createElement("div");
  checks.className = "solitaire-option-checks";
  checks.innerHTML = `<label><input type="checkbox" data-option="timed"> Timed game</label>
    <label><input type="checkbox" data-option="statusBar"> Status bar</label>
    <label><input type="checkbox" data-option="outlineDragging"> Outline dragging</label>
    <label class="solitaire-cumulative"><input type="checkbox" data-option="cumulative"> Cumulative<br><span>Score</span></label>`;
  dialog.body.append(controls, checks);
  dialog.body.querySelector(
    `input[name="solitaire-draw"][value="${options.drawCount}"]`,
  ).checked = true;
  dialog.body.querySelector(
    `input[name="solitaire-scoring"][value="${options.scoring}"]`,
  ).checked = true;
  for (const input of dialog.body.querySelectorAll("[data-option]")) {
    input.checked = Boolean(options[input.dataset.option]);
  }
  const cumulative = dialog.body.querySelector('[data-option="cumulative"]');
  const updateCumulative = () => {
    const vegas =
      dialog.body.querySelector('input[name="solitaire-scoring"]:checked')
        ?.value === "vegas";
    cumulative.disabled = !vegas;
    cumulative.closest("label").classList.toggle("disabled", !vegas);
  };
  dialog.body
    .querySelectorAll('input[name="solitaire-scoring"]')
    .forEach((input) => input.addEventListener("change", updateCumulative));
  updateCumulative();
  dialogs.addButtonRow(dialog, dialogs.BUTTON_SETS.okCancel);
  dialog.onResult((result) => {
    if (result !== "ok") return;
    apply({
      ...options,
      drawCount: Number(
        dialog.body.querySelector('input[name="solitaire-draw"]:checked').value,
      ),
      scoring: dialog.body.querySelector(
        'input[name="solitaire-scoring"]:checked',
      ).value,
      timed: dialog.body.querySelector('[data-option="timed"]').checked,
      statusBar: dialog.body.querySelector('[data-option="statusBar"]').checked,
      outlineDragging: dialog.body.querySelector(
        '[data-option="outlineDragging"]',
      ).checked,
      cumulative: cumulative.checked && !cumulative.disabled,
    });
  });
  return dialog;
};

const createDeckDialog = (dialogs, selectedBack, apply) => {
  const dialog = dialogs.createDialog({ title: "Select Card Back" });
  dialog.el.classList.add("solitaire-deck-dialog");
  addHelpButton(dialog, "Select the picture shown on face-down cards.");
  const choices = document.createElement("div");
  choices.className = "solitaire-deck-choices";
  let nextBack = selectedBack;
  for (const back of CARD_BACKS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "solitaire-deck-choice";
    button.classList.toggle("selected", back === selectedBack);
    button.dataset.cardBack = String(back);
    button.setAttribute("aria-label", `Card back ${back}`);
    const image = document.createElement("img");
    image.src = CARD_BACK_IMAGES[back];
    image.alt = "";
    button.append(image);
    button.addEventListener("click", () => {
      nextBack = back;
      choices
        .querySelectorAll("button")
        .forEach((choice) =>
          choice.classList.toggle("selected", choice === button),
        );
    });
    choices.append(button);
  }
  dialog.body.append(choices);
  dialogs.addButtonRow(dialog, dialogs.BUTTON_SETS.okCancel);
  dialog.onResult((result) => {
    if (result === "ok") apply(nextBack);
  });
  return dialog;
};

const createMenuBar = (run, status) => {
  const bar = document.createElement("div");
  bar.className = "solitaire-menu-bar";
  bar.setAttribute("role", "menubar");
  const definitions = [
    [
      "Game",
      [
        ["Deal", "deal", "F2"],
        ["Undo", "undo", "", "undo"],
        ["-"],
        ["Deck...", "deck"],
        ["Options...", "options"],
        ["-"],
        ["Exit", "exit"],
      ],
    ],
    [
      "Help",
      [
        ["Contents", "contents", "F1"],
        ["Search for Help on...", "search"],
        ["How to Use Help", "how-to"],
        ["-"],
        ["About Solitaire", "about"],
      ],
    ],
  ];
  const closeMenus = () => {
    bar.querySelectorAll(".solitaire-menu").forEach((menu) => {
      menu.hidden = true;
    });
    bar
      .querySelectorAll(".solitaire-menu-trigger")
      .forEach((button) => button.setAttribute("aria-expanded", "false"));
  };
  for (const [label, entries] of definitions) {
    const group = document.createElement("div");
    group.className = "solitaire-menu-group";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "solitaire-menu-trigger";
    trigger.textContent = label;
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", "false");
    const menu = document.createElement("div");
    menu.className = "solitaire-menu";
    menu.hidden = true;
    menu.setAttribute("role", "menu");
    for (const [itemLabel, command, shortcut = "", dynamic] of entries) {
      if (itemLabel === "-") {
        menu.append(document.createElement("hr"));
        continue;
      }
      const item = document.createElement("button");
      item.type = "button";
      item.dataset.solitaireCommand = command;
      if (dynamic) item.dataset.solitaireDynamic = dynamic;
      item.innerHTML = "<span></span><span></span>";
      item.children[0].textContent = itemLabel;
      item.children[1].textContent = shortcut;
      item.addEventListener("mouseenter", () => status(command));
      item.addEventListener("mouseleave", () => status(""));
      item.addEventListener("click", () => {
        closeMenus();
        run(command);
      });
      menu.append(item);
    }
    trigger.addEventListener("click", () => {
      const opening = menu.hidden;
      closeMenus();
      menu.hidden = !opening;
      trigger.setAttribute("aria-expanded", String(opening));
    });
    group.append(trigger, menu);
    bar.append(group);
  }
  const closeOnOutsidePointer = (event) => {
    if (!bar.contains(event.target)) closeMenus();
  };
  document.addEventListener("pointerdown", closeOnOutsidePointer);
  bar.update = (game) => {
    const undo = bar.querySelector('[data-solitaire-dynamic="undo"]');
    undo.disabled = game.history.length === 0;
  };
  bar.dispose = () =>
    document.removeEventListener("pointerdown", closeOnOutsidePointer);
  return bar;
};

const mountSolitaire = (context) => {
  let options = readOptions();
  const createGame = (carry = 0) => {
    const next = createSolitaireGame(options);
    if (options.scoring === "vegas" && options.cumulative) {
      next.score = carry - 52;
    }
    return next;
  };
  let game = createGame();
  let selected = null;
  let elapsed = 0;
  let started = false;
  let won = false;
  context.setTitle("Solitaire");

  const root = document.createElement("div");
  root.className = "xp-native-program xp-solitaire";
  root.tabIndex = 0;
  const board = document.createElement("div");
  board.className = "solitaire-board";
  board.setAttribute("aria-label", "Solitaire playing area");
  const statusBar = document.createElement("div");
  statusBar.className = "solitaire-status-bar";
  const hint = document.createElement("span");
  const score = document.createElement("span");
  statusBar.append(hint, score);
  const statusMessages = {
    deal: "Deal a new game",
    undo: "Undo the last move",
    deck: "Select a card back",
    options: "Change Solitaire options",
    exit: "Exit Solitaire",
    contents: "Display Help Contents",
    search: "Search Help",
    "how-to": "Display help for using Help",
    about: "Display program information, version number and copyright",
  };
  const setHint = (command) => {
    hint.textContent = statusMessages[command] || "";
  };

  const resetTimer = () => {
    elapsed = 0;
    started = false;
  };
  const saveAndRenderOptions = (nextOptions) => {
    const redeal =
      nextOptions.drawCount !== options.drawCount ||
      nextOptions.scoring !== options.scoring;
    options = nextOptions;
    writeOptions(options);
    if (redeal) {
      const carry =
        options.scoring === "vegas" &&
        options.cumulative &&
        game.scoring === "vegas"
          ? game.score
          : 0;
      game = createGame(carry);
      resetTimer();
    }
    selected = null;
    render();
  };

  const commands = {
    deal: () => {
      const carry =
        options.scoring === "vegas" && options.cumulative ? game.score : 0;
      game = createGame(carry);
      selected = null;
      won = false;
      resetTimer();
      render();
    },
    undo: () => {
      if (game.undo()) {
        selected = null;
        won = false;
        render();
      }
    },
    deck: () =>
      createDeckDialog(context.dialogs, options.cardBack, (cardBack) =>
        saveAndRenderOptions({ ...options, cardBack }),
      ),
    options: () =>
      createOptionsDialog(context.dialogs, options, saveAndRenderOptions),
    exit: () => context.close(),
    contents: () =>
      context.dialogs.alert(
        "Move all cards to the four suit stacks, from Ace through King.",
        "Solitaire Help",
        "info",
      ),
    search: () =>
      context.dialogs.alert(
        "Search is not available in this Help viewer.",
        "Solitaire Help",
        "info",
      ),
    "how-to": () =>
      context.dialogs.alert(
        "Click a menu command or press F1 to display help.",
        "Windows Help",
        "info",
      ),
    about: () =>
      showXPAboutDialog(context.dialogs, {
        title: "About Solitaire",
        product: "Microsoft® Solitaire",
        version: "Version 5.1 (Build 2600.xpsp.080413-2111 : Service Pack 3)",
        copyright:
          "Copyright © 2007 Microsoft Corporation\nDeveloped for Microsoft by WPS Cherry",
        icon: "/assets/xp/icons/Solitaire.png",
      }),
  };
  const menuBar = createMenuBar((command) => commands[command]?.(), setHint);
  root.append(menuBar, board, statusBar);

  const createFaceCard = (card, source, className = "") => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `solitaire-card face-up ${className}`.trim();
    button.dataset.cardId = String(card.id);
    button.dataset.solitaireSource = JSON.stringify(source);
    button.setAttribute("aria-label", cardName(card));
    button.draggable = true;
    const image = document.createElement("img");
    image.src = CARD_IMAGES[card.id];
    image.alt = "";
    button.append(image);
    if (selected && JSON.stringify(selected) === JSON.stringify(source)) {
      button.classList.add("selected");
    }
    return button;
  };
  const createBackCard = (label = "Face-down card") => {
    const card = document.createElement("div");
    card.className = "solitaire-card face-down";
    card.setAttribute("aria-label", label);
    const image = document.createElement("img");
    image.src = CARD_BACK_IMAGES[options.cardBack];
    image.alt = "";
    card.append(image);
    return card;
  };

  const finishAction = (changed) => {
    if (!changed) return false;
    started = true;
    selected = null;
    render();
    return true;
  };
  const chooseOrMove = (source, destination = null) => {
    if (
      selected &&
      destination &&
      finishAction(game.move(selected, destination))
    ) {
      return;
    }
    selected = source;
    render();
  };

  const playWinAnimation = () => {
    const boardRect = board.getBoundingClientRect();
    const suits = [...board.querySelectorAll(".solitaire-foundation")];
    SUITS.forEach((suit, suitIndex) => {
      const pile = game.foundations[suit];
      const sourceRect = suits[suitIndex]?.getBoundingClientRect();
      if (!sourceRect) return;
      pile.toReversed().forEach((card, index) => {
        const image = document.createElement("img");
        image.className = "solitaire-win-card";
        image.src = CARD_IMAGES[card.id];
        image.alt = "";
        image.style.left = `${sourceRect.left - boardRect.left}px`;
        image.style.top = `${sourceRect.top - boardRect.top}px`;
        board.append(image);
        const direction = (card.id + suitIndex) % 2 ? 1 : -1;
        const distance = 180 + ((card.id * 17) % 190);
        const delay = (suitIndex * 13 + index) * 35;
        const animation = image.animate(
          [
            { transform: "translate(0, 0)" },
            {
              offset: 0.48,
              transform: `translate(${direction * distance * 0.55}px, ${110 + (card.id % 5) * 12}px)`,
            },
            {
              transform: `translate(${direction * distance}px, ${boardRect.height + 110}px)`,
            },
          ],
          { duration: 1150, delay, easing: "cubic-bezier(.22,.7,.3,1)" },
        );
        animation.addEventListener("finish", () => image.remove(), {
          once: true,
        });
      });
    });
  };

  const render = () => {
    board.replaceChildren();
    statusBar.hidden = !options.statusBar;
    root.classList.toggle("without-status", !options.statusBar);
    menuBar.update(game);
    score.textContent = options.statusBar
      ? `Score: ${game.score} Time: ${elapsed}`
      : "";

    const topRow = document.createElement("div");
    topRow.className = "solitaire-top-row";
    const stock = document.createElement("button");
    stock.type = "button";
    stock.className = "solitaire-pile solitaire-stock";
    stock.setAttribute(
      "aria-label",
      game.stock.length ? "Stock" : "Recycle waste",
    );
    stock.dataset.solitaireDestination = JSON.stringify({ type: "stock" });
    if (game.stock.length) stock.append(createBackCard("Stock"));
    else stock.classList.add("empty");
    stock.addEventListener("click", () => finishAction(game.draw()));

    const waste = document.createElement("div");
    waste.className = "solitaire-pile solitaire-waste";
    waste.dataset.solitaireDestination = JSON.stringify({ type: "waste" });
    const visibleWaste = game.waste.slice(-Math.min(options.drawCount, 3));
    visibleWaste.forEach((card, index) => {
      const source = { type: "waste" };
      const element = createFaceCard(card, source);
      element.style.left = `${index * 14}px`;
      element.style.zIndex = String(index + 1);
      if (index !== visibleWaste.length - 1) {
        element.disabled = true;
        element.removeAttribute("data-solitaire-source");
      }
      waste.append(element);
    });
    if (!visibleWaste.length) waste.classList.add("empty");
    topRow.append(stock, waste);
    const spacer = document.createElement("div");
    spacer.className = "solitaire-top-spacer";
    topRow.append(spacer);
    for (const suit of SUITS) {
      const foundation = document.createElement("div");
      foundation.className = "solitaire-pile solitaire-foundation empty-slot";
      foundation.dataset.suit = suit;
      foundation.dataset.solitaireDestination = JSON.stringify({
        type: "foundation",
        suit,
      });
      const cards = game.foundations[suit];
      if (cards.length) {
        foundation.classList.remove("empty-slot");
        foundation.append(
          createFaceCard(cards.at(-1), { type: "foundation", suit }),
        );
      }
      topRow.append(foundation);
    }

    const tableau = document.createElement("div");
    tableau.className = "solitaire-tableau";
    tableau.setAttribute("role", "group");
    tableau.setAttribute("aria-label", "Tableau");
    game.tableau.forEach((pile, column) => {
      const element = document.createElement("div");
      element.className = "solitaire-tableau-pile";
      element.dataset.column = String(column);
      element.dataset.solitaireDestination = JSON.stringify({
        type: "tableau",
        column,
      });
      let top = 0;
      pile.forEach((card, index) => {
        let cardElement;
        if (card.faceUp) {
          cardElement = createFaceCard(card, {
            type: "tableau",
            column,
            index,
          });
        } else {
          cardElement = createBackCard();
          cardElement.dataset.solitaireSource = JSON.stringify({
            type: "tableau",
            column,
            index,
          });
        }
        cardElement.style.top = `${top}px`;
        cardElement.style.zIndex = String(index + 1);
        element.append(cardElement);
        top += card.faceUp ? 18 : 4;
      });
      tableau.append(element);
    });
    board.append(topRow, tableau);
    const justWon = !won && game.isWon();
    won = won || justWon;
    root.classList.toggle("solitaire-won", won);
    if (justWon) window.setTimeout(playWinAnimation, 0);
  };

  board.addEventListener("click", (event) => {
    if (event.target.closest(".solitaire-stock")) return;
    const source = sourceFromElement(event.target);
    const destination = destinationFromElement(event.target);
    if (source?.type === "tableau") {
      const card = game.tableau[source.column]?.[source.index];
      if (card && !card.faceUp) {
        if (source.index === game.tableau[source.column].length - 1) {
          finishAction(game.flip(source.column));
        }
        return;
      }
    }
    chooseOrMove(source, destination);
  });
  board.addEventListener("dblclick", (event) => {
    const source = sourceFromElement(event.target);
    if (source) finishAction(game.autoMove(source));
  });
  board.addEventListener("dragstart", (event) => {
    const source = sourceFromElement(event.target);
    if (!source) return event.preventDefault();
    selected = source;
    event.dataTransfer?.setData("text/plain", JSON.stringify(source));
    if (options.outlineDragging) root.classList.add("outline-dragging");
  });
  board.addEventListener("dragover", (event) => {
    if (destinationFromElement(event.target)) event.preventDefault();
  });
  board.addEventListener("drop", (event) => {
    const destination = destinationFromElement(event.target);
    if (!destination || !selected) return;
    event.preventDefault();
    finishAction(game.move(selected, destination));
  });
  board.addEventListener("dragend", () => {
    root.classList.remove("outline-dragging");
    if (selected) render();
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "F2") {
      event.preventDefault();
      commands.deal();
    } else if (event.key === "F1") {
      event.preventDefault();
      commands.contents();
    } else if (event.ctrlKey && event.key.toLowerCase() === "z") {
      event.preventDefault();
      commands.undo();
    } else if (event.key === "Escape" && selected) {
      selected = null;
      render();
    }
  });

  const timer = window.setInterval(() => {
    if (!started || !options.timed || won) return;
    elapsed += 1;
    if (options.scoring === "standard" && elapsed % 10 === 0) {
      game.score = Math.max(0, game.score - 2);
    }
    score.textContent = `Score: ${game.score} Time: ${elapsed}`;
  }, 1000);
  render();
  return {
    element: root,
    unmount() {
      window.clearInterval(timer);
      menuBar.dispose();
    },
  };
};

export const solitaireApplication = defineApplication({
  id: "__solitaire",
  title: "Solitaire",
  icon: "Solitaire.png",
  kind: "native-game",
  window: {
    width: 592,
    height: 438,
    className: "xp-native-solitaire-window",
  },
  mount: mountSolitaire,
});
