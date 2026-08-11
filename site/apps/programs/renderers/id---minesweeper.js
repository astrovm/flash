import { createProgramRoot } from "../ui.js";

export const renderIdMinesweeper = (context, program, programId) => {
  const content = createProgramRoot(program);

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
    if (finished || cell.classList.contains("revealed") || cell.dataset.flagged)
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
      const desktop = context.getDesktopSize();
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
        mineCounter.textContent = String(level.mines - flags).padStart(3, "0");
      });
      board.appendChild(cell);
    }
  };
  reset.addEventListener("click", initialize);
  difficulty.addEventListener("change", initialize);
  initialize();
  return content;
};
