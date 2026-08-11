"use strict";

const wireSystemWindowControls = (win) => {
  win.el.addEventListener("pointerdown", () => focusWindow(win.gameId));
  win.el
    .querySelector(".close-btn")
    .addEventListener("click", () => closeGameWindow(win.gameId));
  win.el
    .querySelector(".minimize-btn")
    .addEventListener("click", () => minimizeWindow(win.gameId));
  win.el
    .querySelector(".maximize-btn")
    .addEventListener("click", () => toggleMaximize(win.gameId));
  updateMaximizeButton(win);
  wireDrag(win);
  wireResize(win);
};

const createXPProgramContent = (programId) => {
  const program = XPApplicationRegistry.get(programId);
  const content = document.createElement("div");
  content.className = `xp-native-program xp-native-${program.kind}`;

  if (program.kind === "calculator") {
    content.innerHTML = `<input class="xp-calculator-display" value="0" aria-label="Calculator display" readonly><div class="xp-calculator-keys" aria-label="Calculator keypad"></div>`;
    const display = content.querySelector(".xp-calculator-display");
    const keys = content.querySelector(".xp-calculator-keys");
    let accumulator = 0;
    let operator = null;
    let freshValue = true;
    const calculate = (value) => {
      if (operator === "+") accumulator += value;
      else if (operator === "−") accumulator -= value;
      else if (operator === "×") accumulator *= value;
      else if (operator === "÷")
        accumulator = value === 0 ? 0 : accumulator / value;
      else accumulator = value;
      display.value = String(Number(accumulator.toFixed(10)));
    };
    [
      "Back",
      "CE",
      "C",
      "7",
      "8",
      "9",
      "÷",
      "4",
      "5",
      "6",
      "×",
      "1",
      "2",
      "3",
      "−",
      "0",
      ".",
      "=",
      "+",
    ].forEach((label) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => {
        if (/^\d$/.test(label) || label === ".") {
          display.value = freshValue
            ? label === "."
              ? "0."
              : label
            : `${display.value}${label}`;
          freshValue = false;
        } else if (label === "Back") {
          display.value =
            display.value.length > 1 ? display.value.slice(0, -1) : "0";
        } else if (label === "C" || label === "CE") {
          display.value = "0";
          if (label === "C") {
            accumulator = 0;
            operator = null;
          }
          freshValue = true;
        } else if (label === "=") {
          calculate(Number(display.value));
          operator = null;
          freshValue = true;
        } else {
          calculate(Number(display.value));
          operator = label;
          freshValue = true;
        }
      });
      keys.appendChild(button);
    });
    return content;
  }

  if (program.kind === "terminal") {
    content.innerHTML = `<div class="xp-terminal-output" aria-live="polite">Microsoft Windows XP [Version 5.1.2600]\n(C) Copyright 1985-2001 Microsoft Corp.\n\nC:\\Documents and Settings\\Administrator&gt;</div><label class="xp-terminal-prompt">C:\\Documents and Settings\\Administrator&gt;<input aria-label="Command"></label>`;
    const output = content.querySelector(".xp-terminal-output");
    const input = content.querySelector("input");
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const command = input.value.trim();
      const normalized = command.toLowerCase();
      if (normalized === "cls") output.textContent = "";
      else {
        const response =
          normalized === "help"
            ? "Supported commands: CLS, DIR, ECHO, HELP, VER"
            : normalized === "dir"
              ? " Directory of C:\\Documents and Settings\\Administrator\n\nMy Documents    My Pictures    My Music"
              : normalized === "ver"
                ? "Microsoft Windows XP [Version 5.1.2600]"
                : normalized.startsWith("echo ")
                  ? command.slice(5)
                  : command
                    ? `'${command}' is not recognized as an internal or external command.`
                    : "";
        output.textContent += `\nC:\\Documents and Settings\\Administrator>${command}\n${response}`;
      }
      input.value = "";
      output.scrollTop = output.scrollHeight;
    });
    setTimeout(() => input.focus(), 0);
    return content;
  }

  if (program.kind === "hyperterminal") {
    content.innerHTML = `<form class="xp-hyperterminal-connect"><fieldset><legend>Connect To</legend><label>Name: <input name="name" value="My Connection" aria-label="Connection name"></label><label>Country/region: <select name="country" aria-label="Country or region"><option>Argentina (54)</option><option>United States of America (1)</option></select></label><label>Area code: <input name="area" aria-label="Area code"></label><label>Phone number: <input name="phone" aria-label="Phone number" required></label></fieldset><div><button type="submit">Dial</button><button type="button" data-hyperterminal-cancel>Cancel</button></div><p class="xp-program-status" aria-live="polite"></p></form>`;
    const form = content.querySelector("form");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const phone = form.elements.phone.value.trim();
      if (!phone) return;
      content.innerHTML = `<div class="xp-hyperterminal-toolbar"><span>Connected to </span><b></b><button type="button" data-disconnect>Disconnect</button></div><div class="xp-hyperterminal-screen" aria-live="polite">ATDT${phone}\nCONNECT 57600\n</div><form class="xp-hyperterminal-prompt"><input aria-label="Terminal input" autocomplete="off"><button type="submit">Send</button></form>`;
      content.querySelector(".xp-hyperterminal-toolbar b").textContent =
        form.elements.name.value || phone;
      const screen = content.querySelector(".xp-hyperterminal-screen");
      const prompt = content.querySelector(".xp-hyperterminal-prompt");
      prompt.addEventListener("submit", (promptEvent) => {
        promptEvent.preventDefault();
        const input = prompt.querySelector("input");
        if (!input.value) return;
        screen.textContent += `${input.value}\n`;
        input.value = "";
      });
      content
        .querySelector("[data-disconnect]")
        .addEventListener("click", () => {
          screen.textContent += "\nNO CARRIER";
          prompt.querySelector("input").disabled = true;
          prompt.querySelector("button").disabled = true;
        });
      prompt.querySelector("input").focus();
    });
    form
      .querySelector("[data-hyperterminal-cancel]")
      .addEventListener("click", () => {
        form.querySelector(".xp-program-status").textContent =
          "The connection was cancelled.";
      });
    return content;
  }

  if (program.kind === "editor") {
    content.innerHTML = `<div class="xp-editor-toolbar"><button type="button" data-editor-command="bold"><b>B</b></button><button type="button" data-editor-command="italic"><i>I</i></button><button type="button" data-editor-command="underline"><u>U</u></button></div><div class="xp-editor-page" contenteditable="true" role="textbox" aria-label="Document"></div>`;
    const page = content.querySelector(".xp-editor-page");
    content
      .querySelector(".xp-editor-toolbar")
      .addEventListener("click", (event) => {
        const command = event.target.closest("button")?.dataset.editorCommand;
        if (command) document.execCommand(command);
        page.focus();
      });
    return content;
  }

  if (program.kind === "paint") {
    const frame = document.createElement("iframe");
    frame.className = "xp-paint-frame";
    frame.src = "apps/paint/index.html";
    frame.title = "Microsoft Paint drawing area";
    content.appendChild(frame);
    return content;
  }

  if (program.kind === "keyboard") {
    content.innerHTML = `<input class="xp-keyboard-output" aria-label="Typed text"><div class="xp-keyboard-keys"></div>`;
    const output = content.querySelector("input");
    "1234567890QWERTYUIOPASDFGHJKLZXCVBNM".split("").forEach((key) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = key;
      button.addEventListener("click", () => {
        output.value += key;
        output.focus();
      });
      content.querySelector(".xp-keyboard-keys").appendChild(button);
    });
    return content;
  }

  if (program.kind === "address-book") {
    content.innerHTML = `<div class="xp-program-toolbar"><button type="button">New Contact</button></div><form class="xp-address-form" hidden><input name="name" aria-label="Name" placeholder="Name" required><input name="email" type="email" aria-label="E-mail" placeholder="E-mail"><button type="submit">Add</button></form><table class="xp-address-list"><thead><tr><th>Name</th><th>E-mail Address</th></tr></thead><tbody><tr><td>Administrator</td><td>administrator@localhost</td></tr></tbody></table>`;
    const form = content.querySelector("form");
    content
      .querySelector(".xp-program-toolbar button")
      .addEventListener("click", () => {
        form.hidden = false;
        form.elements.name.focus();
      });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const row = document.createElement("tr");
      [form.elements.name.value, form.elements.email.value].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      content.querySelector("tbody").appendChild(row);
      form.reset();
      form.hidden = true;
    });
    return content;
  }

  if (program.kind === "character-map") {
    content.innerHTML = `<label>Font: <select><option>Arial</option><option>Courier New</option><option>Tahoma</option></select></label><div class="xp-character-grid" aria-label="Characters"></div><label>Characters to copy: <input></label>`;
    const target = content.querySelector("input");
    for (let code = 33; code <= 126; code += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String.fromCharCode(code);
      button.addEventListener(
        "click",
        () => (target.value += button.textContent),
      );
      content.querySelector(".xp-character-grid").appendChild(button);
    }
    return content;
  }

  if (programId === "__minesweeper") {
    content.className += " xp-minesweeper";
    content.innerHTML = `<div class="xp-minesweeper-menu"><label>Game <select aria-label="Difficulty"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="expert">Expert</option></select></label><button type="button">Help</button></div><div class="xp-minesweeper-panel"><output data-mines aria-label="Mines remaining">010</output><button type="button" data-reset aria-label="New game">🙂</button><output data-time aria-label="Elapsed time">000</output></div><div class="xp-minesweeper-board" role="grid" aria-label="Minesweeper board"></div>`;
    const board = content.querySelector(".xp-minesweeper-board");
    const mineCounter = content.querySelector("[data-mines]");
    const timeCounter = content.querySelector("[data-time]");
    const reset = content.querySelector("[data-reset]");
    const difficulty = content.querySelector("[aria-label='Difficulty']");
    const levels = {
      beginner: { rows: 9, columns: 9, mines: 10 },
      intermediate: { rows: 16, columns: 16, mines: 40 },
      expert: { rows: 16, columns: 30, mines: 99 },
    };
    let level = levels.beginner;
    let mineIndexes = null;
    let flags = 0;
    let elapsed = 0;
    let timer = null;
    let finished = false;
    const neighbors = (index) => {
      const row = Math.floor(index / level.columns);
      const column = index % level.columns;
      const result = [];
      for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
          if (!rowOffset && !columnOffset) continue;
          const nextRow = row + rowOffset;
          const nextColumn = column + columnOffset;
          if (
            nextRow < 0 ||
            nextRow >= level.rows ||
            nextColumn < 0 ||
            nextColumn >= level.columns
          )
            continue;
          result.push(nextRow * level.columns + nextColumn);
        }
      }
      return result;
    };
    const stopTimer = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const startTimer = () => {
      if (timer || finished) return;
      timer = setInterval(() => {
        if (!content.isConnected) return stopTimer();
        elapsed = Math.min(999, elapsed + 1);
        timeCounter.textContent = String(elapsed).padStart(3, "0");
      }, 1000);
    };
    const placeMines = (firstIndex) => {
      const excluded = new Set([firstIndex, ...neighbors(firstIndex)]);
      mineIndexes = new Set();
      while (mineIndexes.size < level.mines) {
        const candidate = Math.floor(
          Math.random() * (level.rows * level.columns),
        );
        if (!excluded.has(candidate)) mineIndexes.add(candidate);
      }
    };
    const reveal = (index) => {
      const cell = board.children[index];
      if (
        finished ||
        cell.classList.contains("revealed") ||
        cell.dataset.flagged
      )
        return;
      if (!mineIndexes) placeMines(index);
      startTimer();
      cell.classList.add("revealed");
      if (mineIndexes.has(index)) {
        cell.textContent = "✹";
        cell.classList.add("mine");
        reset.textContent = "☹";
        finished = true;
        stopTimer();
        mineIndexes.forEach((mine) => {
          board.children[mine].textContent = "✹";
          board.children[mine].classList.add("revealed", "mine");
        });
        return;
      }
      const nearby = neighbors(index).filter((neighbor) =>
        mineIndexes.has(neighbor),
      ).length;
      if (nearby) {
        cell.textContent = String(nearby);
        cell.dataset.count = String(nearby);
      } else {
        neighbors(index).forEach(reveal);
      }
      if (
        board.querySelectorAll(".revealed:not(.mine)").length ===
        level.rows * level.columns - level.mines
      ) {
        reset.textContent = "😎";
        finished = true;
        stopTimer();
      }
    };
    const initialize = () => {
      stopTimer();
      elapsed = 0;
      flags = 0;
      finished = false;
      mineIndexes = null;
      level = levels[difficulty.value];
      timeCounter.textContent = "000";
      mineCounter.textContent = String(level.mines).padStart(3, "0");
      reset.textContent = "🙂";
      board.replaceChildren();
      board.style.gridTemplateColumns = `repeat(${level.columns}, 18px)`;
      const owner = content.closest(".xp-window");
      if (owner) {
        const desktop = getDesktopSize();
        owner.style.width = `${Math.min(level.columns * 18 + 22, desktop.width - 16)}px`;
        owner.style.height = `${Math.min(level.rows * 18 + 108, desktop.height - 16)}px`;
      }
      for (let index = 0; index < level.rows * level.columns; index += 1) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-label", `Covered cell ${index + 1}`);
        cell.addEventListener("click", () => reveal(index));
        cell.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          if (finished || cell.classList.contains("revealed")) return;
          const flagged = cell.dataset.flagged === "true";
          if (!flagged && flags === level.mines) return;
          cell.dataset.flagged = flagged ? "" : "true";
          cell.textContent = flagged ? "" : "⚑";
          flags += flagged ? -1 : 1;
          mineCounter.textContent = String(level.mines - flags).padStart(
            3,
            "0",
          );
        });
        board.appendChild(cell);
      }
    };
    reset.addEventListener("click", initialize);
    difficulty.addEventListener("change", initialize);
    initialize();
    return content;
  }

  if (programId === "__solitaire") {
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
    const foundationsElement = content.querySelector(
      ".xp-solitaire-foundations",
    );
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
  }

  if (programId === "__freecell") {
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
      const remaining = cascades.reduce(
        (total, pile) => total + pile.length,
        0,
      );
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
  }

  if (program.kind === "volume") {
    const { volume, isMuted } = getMasterVolume();
    content.innerHTML = `<div class="xp-volume-console"><div class="xp-volume-heading">Volume Control</div><label>Volume<input type="range" min="0" max="100" value="${volume}" orient="vertical" aria-label="Volume level"></label><label><input type="checkbox" ${isMuted ? "checked" : ""}> Mute all</label></div>`;
    const slider = content.querySelector('input[type="range"]');
    const mute = content.querySelector('input[type="checkbox"]');
    const apply = () => setMasterVolume(Number(slider.value), mute.checked);
    slider.addEventListener("input", apply);
    mute.addEventListener("change", apply);
    return content;
  }

  if (program.kind === "recorder") {
    content.innerHTML = `<div class="xp-recorder-display"><output aria-label="Recording time">0.00 sec</output><div class="xp-recorder-wave" aria-hidden="true"></div></div><div class="xp-recorder-controls"><button type="button" data-action="record" aria-label="Record">●</button><button type="button" data-action="stop" aria-label="Stop">■</button><button type="button" data-action="play" aria-label="Play">▶</button></div><p class="xp-program-status" aria-live="polite">Stopped</p>`;
    const output = content.querySelector("output");
    const status = content.querySelector(".xp-program-status");
    let elapsed = 0;
    let timer = null;
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
      status.textContent = "Stopped";
    };
    content
      .querySelector('[data-action="record"]')
      .addEventListener("click", () => {
        stop();
        elapsed = 0;
        status.textContent = "Recording";
        content.querySelector(".xp-recorder-wave").classList.add("active");
        timer = setInterval(() => {
          if (!content.isConnected) return stop();
          elapsed += 0.1;
          output.textContent = `${elapsed.toFixed(2)} sec`;
        }, 100);
      });
    content
      .querySelector('[data-action="stop"]')
      .addEventListener("click", () => {
        stop();
        content.querySelector(".xp-recorder-wave").classList.remove("active");
      });
    content
      .querySelector('[data-action="play"]')
      .addEventListener("click", () => {
        stop();
        status.textContent = elapsed
          ? "Playing recorded sound"
          : "No recorded sound";
      });
    return content;
  }

  if (program.kind === "media") {
    content.innerHTML = `<div class="xp-media-screen"><div class="xp-media-logo">Windows Media Player</div><p data-track>Windows XP Startup</p></div><div class="xp-media-controls"><button type="button" data-media="play" aria-label="Play">▶</button><button type="button" data-media="stop" aria-label="Stop">■</button><input type="range" min="0" max="100" value="70" aria-label="Player volume"></div>`;
    const audio = new Audio("assets/xp/sounds/startup.wav");
    const volume = content.querySelector('input[type="range"]');
    volume.addEventListener(
      "input",
      () => (audio.volume = Number(volume.value) / 100),
    );
    content
      .querySelector('[data-media="play"]')
      .addEventListener("click", () => audio.play());
    content
      .querySelector('[data-media="stop"]')
      .addEventListener("click", () => {
        audio.pause();
        audio.currentTime = 0;
      });
    return content;
  }

  if (programId === "__disk-defragmenter") {
    content.innerHTML = `<div class="xp-defrag-volume"><table><thead><tr><th>Volume</th><th>File System</th><th>Capacity</th><th>Free Space</th><th>% Free Space</th></tr></thead><tbody><tr class="selected"><td>(C:)</td><td>NTFS</td><td>20.00 GB</td><td>12.34 GB</td><td>61%</td></tr></tbody></table></div><div class="xp-defrag-legend"><span><i class="fragmented"></i> Fragmented files</span><span><i class="contiguous"></i> Contiguous files</span><span><i class="system"></i> System files</span><span><i class="free"></i> Free space</span></div><section class="xp-defrag-map"><h3>Estimated disk usage before defragmentation:</h3><div data-defrag-before></div><h3>Estimated disk usage after defragmentation:</h3><div data-defrag-after></div></section><p class="xp-program-status" aria-live="polite">Select a volume and click Analyze.</p><div class="xp-defrag-actions"><button type="button" data-defrag-analyze>Analyze</button><button type="button" data-defrag-run disabled>Defragment</button></div>`;
    const before = content.querySelector("[data-defrag-before]");
    const after = content.querySelector("[data-defrag-after]");
    const status = content.querySelector(".xp-program-status");
    const runButton = content.querySelector("[data-defrag-run]");
    const blocks = [
      "contiguous",
      "contiguous",
      "fragmented",
      "free",
      "system",
      "fragmented",
      "contiguous",
      "free",
      "fragmented",
      "free",
      "contiguous",
      "free",
      "system",
      "free",
      "free",
      "contiguous",
    ];
    const renderMap = (target, layout) => {
      target.replaceChildren(
        ...layout.map((type) => {
          const block = document.createElement("i");
          block.className = type;
          return block;
        }),
      );
    };
    renderMap(before, blocks);
    renderMap(after, Array(16).fill("free"));
    content
      .querySelector("[data-defrag-analyze]")
      .addEventListener("click", () => {
        status.textContent =
          "Analysis is complete. You should defragment this volume.";
        runButton.disabled = false;
      });
    runButton.addEventListener("click", () => {
      renderMap(after, [
        ...Array(7).fill("contiguous"),
        ...Array(2).fill("system"),
        ...Array(7).fill("free"),
      ]);
      status.textContent = "Defragmentation is complete for Local Disk (C:).";
      runButton.disabled = true;
    });
    return content;
  }

  if (program.kind === "disk") {
    content.innerHTML = `<div class="xp-disk-header"><img src="${XP_ICON_PATHS[program.icon]}" alt=""><div><b>${program.title}</b><p>Local Disk (C:)</p></div></div><fieldset><legend>Files to delete</legend><label><input type="checkbox" data-size="18" checked> Downloaded Program Files <span>18 KB</span></label><label><input type="checkbox" data-size="1536" checked> Temporary Internet Files <span>1,536 KB</span></label><label><input type="checkbox" data-size="64"> Recycle Bin <span>64 KB</span></label><label><input type="checkbox" data-size="2944" checked> Temporary files <span>2,944 KB</span></label></fieldset><p>You can free up <b data-disk-total>4,498 KB</b> of disk space.</p><button type="button" data-disk-clean>OK</button><p class="xp-program-status" aria-live="polite"></p>`;
    const updateTotal = () => {
      const total = [
        ...content.querySelectorAll('input[type="checkbox"]:checked'),
      ].reduce((sum, checkbox) => sum + Number(checkbox.dataset.size), 0);
      content.querySelector("[data-disk-total]").textContent =
        `${total.toLocaleString()} KB`;
    };
    content
      .querySelectorAll('input[type="checkbox"]')
      .forEach((checkbox) => checkbox.addEventListener("change", updateTotal));
    content.querySelector("[data-disk-clean]").addEventListener("click", () => {
      const total = content.querySelector("[data-disk-total]").textContent;
      content.querySelector(".xp-program-status").textContent =
        `${total} of temporary data was cleaned.`;
    });
    return content;
  }

  if (program.kind === "tasks") {
    content.innerHTML = `<div class="xp-program-toolbar"><button type="button" data-task-new>Add Scheduled Task</button></div><form class="xp-task-form" hidden><label>Task name: <input name="name" aria-label="Task name" required></label><label>Program: <select name="program" aria-label="Program"><option>Disk Cleanup</option><option>Notepad</option><option>System Information</option></select></label><label>Schedule: <select name="schedule" aria-label="Schedule"><option>Daily</option><option>Weekly</option><option>When I log on</option></select></label><div><button type="submit">Finish</button><button type="button" data-task-cancel>Cancel</button></div></form><table class="xp-task-list"><thead><tr><th>Name</th><th>Schedule</th><th>Next Run Time</th><th></th></tr></thead><tbody></tbody></table><p class="xp-program-status" aria-live="polite">Use Add Scheduled Task to schedule a program.</p>`;
    const form = content.querySelector(".xp-task-form");
    const body = content.querySelector("tbody");
    const status = content.querySelector(".xp-program-status");
    const tasks = [];
    const renderTasks = () => {
      body.replaceChildren();
      tasks.forEach((task, index) => {
        const row = document.createElement("tr");
        row.dataset.task = String(index);
        [task.name, task.schedule, task.nextRun].forEach((value) => {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.appendChild(cell);
        });
        const actions = document.createElement("td");
        actions.innerHTML = `<button type="button" data-task-run>Run</button><button type="button" data-task-delete>Delete</button>`;
        row.appendChild(actions);
        body.appendChild(row);
      });
    };
    content.querySelector("[data-task-new]").addEventListener("click", () => {
      form.hidden = false;
      form.elements.name.focus();
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      tasks.push({
        name: form.elements.name.value.trim(),
        program: form.elements.program.value,
        schedule: form.elements.schedule.value,
        nextRun:
          form.elements.schedule.value === "When I log on"
            ? "At next logon"
            : "Tomorrow at 9:00 AM",
      });
      status.textContent = `${form.elements.name.value.trim()} was scheduled.`;
      form.reset();
      form.hidden = true;
      renderTasks();
    });
    form.querySelector("[data-task-cancel]").addEventListener("click", () => {
      form.reset();
      form.hidden = true;
    });
    body.addEventListener("click", (event) => {
      const row = event.target.closest("[data-task]");
      if (!row) return;
      const index = Number(row.dataset.task);
      if (event.target.closest("[data-task-run]")) {
        status.textContent = `${tasks[index].name} ran ${tasks[index].program}.`;
      } else if (event.target.closest("[data-task-delete]")) {
        const [removed] = tasks.splice(index, 1);
        status.textContent = `${removed.name} was deleted.`;
        renderTasks();
      }
    });
    renderTasks();
    return content;
  }

  if (program.kind === "information") {
    content.innerHTML = `<div class="xp-system-information"><aside><button type="button" class="selected" data-info-section="summary">System Summary</button><button type="button" data-info-section="hardware">Hardware Resources</button><button type="button" data-info-section="components">Components</button><button type="button" data-info-section="software">Software Environment</button></aside><table><tbody></tbody></table></div>`;
    const sections = {
      summary: [
        ["OS Name", "Microsoft Windows XP Professional"],
        ["Version", "5.1.2600 Service Pack 3 Build 2600"],
        ["System Manufacturer", "Astro VM"],
        ["System Type", "X86-based PC"],
        ["Total Physical Memory", "512.00 MB"],
        ["Display", `${window.innerWidth} × ${window.innerHeight}`],
      ],
      hardware: [
        ["Conflicts/Sharing", "No hardware conflicts detected"],
        ["DMA", "Direct memory access controller"],
        ["IRQs", "System timer — IRQ 0"],
        ["Memory", "0x00000000–0x1FFFFFFF"],
      ],
      components: [
        ["Display", "Standard VGA Graphics Adapter"],
        ["Multimedia", "Audio Codecs"],
        ["Network", "Local Area Connection"],
        ["Storage", "Local Disk (C:)"],
      ],
      software: [
        ["System Drivers", "All drivers are running"],
        ["Environment Variables", "TEMP, PATH, USERPROFILE"],
        ["Running Tasks", "explorer.exe, services.exe"],
        ["Startup Programs", "Windows Messenger"],
      ],
    };
    const body = content.querySelector("tbody");
    const renderSection = (section) => {
      body.replaceChildren();
      sections[section].forEach(([name, value]) => {
        const row = document.createElement("tr");
        const heading = document.createElement("th");
        const cell = document.createElement("td");
        heading.textContent = name;
        cell.textContent = value;
        row.append(heading, cell);
        body.appendChild(row);
      });
      content
        .querySelectorAll("[data-info-section]")
        .forEach((button) =>
          button.classList.toggle(
            "selected",
            button.dataset.infoSection === section,
          ),
        );
    };
    content.querySelector("aside").addEventListener("click", (event) => {
      const button = event.target.closest("[data-info-section]");
      if (button) renderSection(button.dataset.infoSection);
    });
    renderSection("summary");
    return content;
  }

  if (program.kind === "remote") {
    content.innerHTML = `<div class="xp-program-panel"><img src="${XP_ICON_PATHS[program.icon]}" alt=""><p>Enter the name of the remote computer.</p><label>Computer: <input aria-label="Computer"></label><button type="button">Connect</button><p class="xp-program-status" aria-live="polite"></p></div>`;
    content.querySelector("button").addEventListener("click", () => {
      const computer = content.querySelector("input").value.trim();
      content.querySelector(".xp-program-status").textContent = computer
        ? `The computer ${computer} is not available on this local network.`
        : "Enter a computer name.";
    });
    return content;
  }

  if (program.kind === "browser") {
    const homeAddress =
      programId === "__msn" ? "http://www.msn.com/" : "about:home";
    content.innerHTML = `<div class="xp-browser-toolbar"><button type="button" data-browser-back disabled>Back</button><button type="button" data-browser-forward disabled>Forward</button><button type="button" data-browser-home>Home</button><button type="button" data-browser-refresh>Refresh</button><label>Address <input value="${homeAddress}" aria-label="Address"></label><button type="button" data-go>Go</button></div><div class="xp-browser-page"></div>`;
    const input = content.querySelector("input");
    const page = content.querySelector(".xp-browser-page");
    const back = content.querySelector("[data-browser-back]");
    const forward = content.querySelector("[data-browser-forward]");
    let history = [homeAddress];
    let historyIndex = 0;
    const render = (address) => {
      input.value = address;
      page.replaceChildren();
      const heading = document.createElement("h1");
      const message = document.createElement("p");
      if (address === "about:home") {
        heading.textContent = "Welcome to Internet Explorer";
        message.textContent = "Browse local pages or enter an address.";
      } else if (address === "http://www.msn.com/") {
        heading.textContent = "MSN";
        message.textContent = "MSN is not available while offline.";
      } else {
        heading.textContent = address;
        message.textContent =
          "The requested page is not available while offline.";
      }
      page.append(heading, message);
      back.disabled = historyIndex === 0;
      forward.disabled = historyIndex === history.length - 1;
    };
    const navigate = (address = input.value.trim()) => {
      if (!address) return;
      history = history.slice(0, historyIndex + 1);
      history.push(address);
      historyIndex = history.length - 1;
      render(address);
    };
    content
      .querySelector("[data-go]")
      .addEventListener("click", () => navigate());
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") navigate();
    });
    back.addEventListener("click", () => {
      if (historyIndex > 0) render(history[--historyIndex]);
    });
    forward.addEventListener("click", () => {
      if (historyIndex < history.length - 1) render(history[++historyIndex]);
    });
    content
      .querySelector("[data-browser-home]")
      .addEventListener("click", () => navigate(homeAddress));
    content
      .querySelector("[data-browser-refresh]")
      .addEventListener("click", () => render(history[historyIndex]));
    render(homeAddress);
    return content;
  }

  if (program.kind === "mail") {
    content.innerHTML = `<div class="xp-mail-toolbar"><button type="button" data-mail-new>New Mail</button><button type="button" data-mail-reply disabled>Reply</button><button type="button" data-mail-delete disabled>Delete</button></div><div class="xp-mail-layout"><aside class="xp-mail-folders" aria-label="Folders"></aside><main class="xp-mail-workspace"></main></div>`;
    const folders = {
      Inbox: [
        {
          from: "Outlook Express Team",
          email: "outlook-express@example.com",
          subject: "Welcome to Outlook Express 6",
          body: "Outlook Express is ready to manage mail stored on this computer.",
        },
      ],
      Outbox: [],
      "Sent Items": [],
      "Deleted Items": [],
      Drafts: [],
    };
    const folderPane = content.querySelector(".xp-mail-folders");
    const workspace = content.querySelector(".xp-mail-workspace");
    const replyButton = content.querySelector("[data-mail-reply]");
    const deleteButton = content.querySelector("[data-mail-delete]");
    let currentFolder = "Inbox";
    let selectedMessage = null;
    const updateMailActions = () => {
      replyButton.disabled = !selectedMessage;
      deleteButton.disabled = !selectedMessage;
    };
    const renderFolders = () => {
      folderPane.replaceChildren();
      Object.entries(folders).forEach(([name, messages]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = name === currentFolder ? "selected" : "";
        button.dataset.folder = name;
        button.textContent = `${name}${messages.length ? ` (${messages.length})` : ""}`;
        folderPane.appendChild(button);
      });
    };
    const renderFolder = () => {
      selectedMessage = null;
      updateMailActions();
      renderFolders();
      workspace.innerHTML = `<table class="xp-mail-list"><thead><tr><th>From</th><th>Subject</th></tr></thead><tbody></tbody></table><article class="xp-mail-preview"><p>Select a message to read it.</p></article>`;
      const body = workspace.querySelector("tbody");
      folders[currentFolder].forEach((message, index) => {
        const row = document.createElement("tr");
        row.dataset.message = String(index);
        const from = document.createElement("td");
        const subject = document.createElement("td");
        from.textContent = message.from || message.to;
        subject.textContent = message.subject || "(no subject)";
        row.append(from, subject);
        body.appendChild(row);
      });
    };
    const openComposer = (initial = {}) => {
      workspace.innerHTML = `<form class="xp-mail-compose"><label>To: <input name="to" type="email" aria-label="To" required></label><label>Subject: <input name="subject" aria-label="Subject"></label><textarea name="body" aria-label="Message body"></textarea><div><button type="submit">Send</button><button type="button" data-save-draft>Save Draft</button></div></form>`;
      const form = workspace.querySelector("form");
      form.elements.to.value = initial.to || "";
      form.elements.subject.value = initial.subject || "";
      form.elements.body.value = initial.body || "";
      const storeMessage = (folder) => {
        folders[folder].push({
          from: "Administrator",
          to: form.elements.to.value,
          subject: form.elements.subject.value,
          body: form.elements.body.value,
        });
        currentFolder = folder;
        renderFolder();
      };
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        storeMessage("Sent Items");
      });
      form
        .querySelector("[data-save-draft]")
        .addEventListener("click", () => storeMessage("Drafts"));
      form.elements.to.focus();
    };
    folderPane.addEventListener("click", (event) => {
      const button = event.target.closest("[data-folder]");
      if (!button) return;
      currentFolder = button.dataset.folder;
      renderFolder();
    });
    workspace.addEventListener("click", (event) => {
      const row = event.target.closest("[data-message]");
      if (!row) return;
      selectedMessage = {
        index: Number(row.dataset.message),
        message: folders[currentFolder][Number(row.dataset.message)],
      };
      workspace
        .querySelectorAll("[data-message]")
        .forEach((candidate) =>
          candidate.classList.toggle("selected", candidate === row),
        );
      updateMailActions();
      const { message } = selectedMessage;
      workspace.querySelector(".xp-mail-preview").innerHTML =
        `<h3></h3><p class="xp-mail-from"></p><div class="xp-mail-body"></div>`;
      workspace.querySelector("h3").textContent = message.subject;
      workspace.querySelector(".xp-mail-from").textContent =
        `From: ${message.from || "Administrator"}`;
      workspace.querySelector(".xp-mail-body").textContent = message.body;
    });
    content
      .querySelector("[data-mail-new]")
      .addEventListener("click", () => openComposer());
    replyButton.addEventListener("click", () => {
      if (!selectedMessage) return;
      const { message } = selectedMessage;
      openComposer({
        to: message.email || message.to || "",
        subject: message.subject?.startsWith("Re:")
          ? message.subject
          : `Re: ${message.subject || ""}`,
        body: `\n\n----- Original Message -----\n${message.body || ""}`,
      });
    });
    deleteButton.addEventListener("click", () => {
      if (!selectedMessage) return;
      const [message] = folders[currentFolder].splice(selectedMessage.index, 1);
      if (currentFolder !== "Deleted Items")
        folders["Deleted Items"].push(message);
      renderFolder();
    });
    renderFolder();
    return content;
  }

  if (program.kind === "messenger") {
    content.innerHTML = `<div class="xp-messenger-account"><img src="${XP_ICON_PATHS["WindowsMessengerLarge.png"]}" alt=""><div><b>Administrator</b><label>Status: <select aria-label="Status"><option>Online</option><option>Busy</option><option>Appear Offline</option></select></label></div></div><div class="xp-messenger-body"><aside><h3>My Contacts</h3><button type="button" data-contact="Windows XP Support">● Windows XP Support</button><button type="button" data-add-contact>Add a Contact</button></aside><main><div class="xp-messenger-history" aria-live="polite"><p>Select a contact to start a conversation.</p></div><form><input aria-label="Message" disabled><button type="submit" disabled>Send</button></form></main></div>`;
    const history = content.querySelector(".xp-messenger-history");
    const form = content.querySelector("form");
    const input = form.querySelector("input");
    const send = form.querySelector("button");
    let contact = null;
    content
      .querySelector("[data-contact]")
      .addEventListener("click", (event) => {
        contact = event.currentTarget.dataset.contact;
        history.innerHTML = `<h3></h3><p class="system-message">This contact is offline. Messages remain on this computer.</p>`;
        history.querySelector("h3").textContent = contact;
        input.disabled = false;
        send.disabled = false;
        input.focus();
      });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const message = input.value.trim();
      if (!message || !contact) return;
      const paragraph = document.createElement("p");
      const name = document.createElement("b");
      name.textContent = "Administrator says: ";
      paragraph.append(name, message);
      history.appendChild(paragraph);
      input.value = "";
      history.scrollTop = history.scrollHeight;
    });
    content
      .querySelector("[data-add-contact]")
      .addEventListener("click", () => {
        const address = window.prompt?.("Enter the contact's e-mail address:");
        if (!address) return;
        history.textContent = `${address} was added to your local contact list.`;
      });
    return content;
  }

  if (program.kind === "defaults") {
    content.innerHTML = `<div class="xp-program-panel"><h2>Choose a configuration</h2><label><input type="radio" name="defaults" checked> Microsoft Windows</label><label><input type="radio" name="defaults"> Non-Microsoft</label><label><input type="radio" name="defaults"> Custom</label><button type="button">OK</button><p class="xp-program-status" aria-live="polite"></p></div>`;
    content.querySelector("button").addEventListener("click", () => {
      content.querySelector(".xp-program-status").textContent =
        "The selected program access settings have been applied.";
    });
    return content;
  }

  const isWizard = program.kind === "wizard";
  content.innerHTML = `<div class="xp-program-panel"><img src="${XP_ICON_PATHS[program.icon]}" alt=""><h2>${program.title}</h2><p>${program.description || `Use ${program.title} on this computer.`}</p><div class="xp-program-workspace"></div><p class="xp-program-status" aria-live="polite"></p><div class="xp-program-actions"><button type="button" data-primary>${isWizard ? "Next >" : "Start"}</button>${isWizard ? '<button type="button" data-cancel>Cancel</button>' : ""}</div></div>`;
  const status = content.querySelector(".xp-program-status");
  content.querySelector("[data-primary]").addEventListener("click", (event) => {
    status.textContent = isWizard
      ? `${program.title} completed its local configuration check.`
      : `${program.title} is running.`;
    event.target.disabled = true;
  });
  content.querySelector("[data-cancel]")?.addEventListener("click", () => {
    status.textContent = `${program.title} was cancelled.`;
  });
  return content;
};
