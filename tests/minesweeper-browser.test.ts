// @ts-nocheck -- Browser-level Minesweeper actions use Happy DOM.
import { afterEach, expect, test } from "bun:test";
import {
  createMinefield,
  MINESWEEPER_LEVELS,
} from "../site/apps/minesweeper/game.js";
import {
  cleanupShells,
  loadShell,
  login,
  flushShell,
} from "./helpers/shell-harness";
afterEach(cleanupShells);
async function setup(initialStorage = {}) {
  const s = await login(await loadShell({ initialStorage }));
  s.window.history.replaceState(null, "", "#minesweeper");
  s.window.dispatchEvent(new s.window.HashChangeEvent("hashchange"));
  await flushShell();
  const win = s.document.querySelector('.xp-window[data-game="__minesweeper"]'),
    root = win.querySelector(".xp-minesweeper");
  const cells = () => [...win.querySelectorAll('[role="gridcell"]')],
    command = (id) => win.querySelector(`[data-command="${id}"]`).click(),
    mark = (cell) =>
      cell.dispatchEvent(
        new s.window.MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
        }),
      );
  return { s, win, root, cells, command, mark };
}
test("Minesweeper cycles marks, preferences, custom bounds, help and restart", async () => {
  const h = await setup(),
    cell = h.cells()[0];
  h.mark(cell);
  expect(cell.dataset.mark).toBe("flag");
  h.mark(cell);
  expect(cell.dataset.mark).toBe("question");
  h.command("marks");
  expect(cell.dataset.mark).toBe("");
  h.mark(cell);
  h.mark(cell);
  expect(cell.dataset.mark).toBe("");
  h.command("color");
  expect(h.root.classList.contains("monochrome")).toBeTrue();
  h.command("sound");
  h.command("custom");
  const dialog = h.s.document.querySelector(".minesweeper-custom-dialog");
  for (const [name, value] of [
    ["rows", 1000],
    ["columns", 10.5],
    ["mines", 1000],
  ])
    dialog.querySelector(`[name="${name}"]`).value = String(value);
  dialog.querySelector('[data-action="ok"]').click();
  const settings = JSON.parse(
    h.s.window.localStorage.getItem("minesweeperSettings"),
  );
  expect(settings.customLevel).toEqual({ rows: 24, columns: 10, mines: 231 });
  expect(h.cells().length).toBe(240);
  h.command("beginner");
  expect(h.cells().length).toBe(81);
  for (const command of [
    "best-times",
    "about",
    "contents",
    "search-help",
    "using-help",
  ]) {
    h.command(command);
    expect(!!h.s.document.querySelector(".xp-dialog")).toBeTrue();
    h.s.document.querySelector('.xp-dialog [data-action="ok"]').click();
  }
  h.root.dispatchEvent(
    new h.s.window.KeyboardEvent("keydown", { key: "F1", bubbles: true }),
  );
  h.s.document.querySelector('.xp-dialog [data-action="ok"]').click();
  h.root.dispatchEvent(
    new h.s.window.KeyboardEvent("keydown", { key: "F2", bubbles: true }),
  );
  expect(h.cells().every((c) => c.dataset.tile === "covered")).toBeTrue();
  h.win.querySelector(".minesweeper-menu-trigger").click();
  h.s.document.body.dispatchEvent(
    new h.s.window.PointerEvent("pointerdown", { bubbles: true }),
  );
  expect(h.win.querySelector(".minesweeper-popup").hidden).toBeTrue();
  h.command("exit");
  expect(h.win.isConnected).toBeFalse();
});
test("Minesweeper wins a deterministic field, reveals a loss, and resets its timer", async () => {
  const h = await setup({
    minesweeperSettings: JSON.stringify({ sound: false }),
  });
  const random = Math.random;
  let mines;
  try {
    Math.random = () => 0.5;
    mines = createMinefield(MINESWEEPER_LEVELS.beginner, 40);
    h.cells()[40].click();
  } finally {
    Math.random = random;
  }
  const cells = h.cells();
  expect(cells[40].dataset.open).toBe("true");
  await h.s.advanceTime(1000);
  expect(h.win.querySelector('[aria-label="Elapsed time"]').dataset.value).toBe(
    "1",
  );
  for (const index of mines) h.mark(cells[index]);
  const numbered = cells.find((c) => c.dataset.tile?.startsWith("number-"));
  numbered?.dispatchEvent(
    new h.s.window.MouseEvent("dblclick", { bubbles: true }),
  );
  cells.forEach((cell, index) => {
    if (!mines.has(index)) cell.click();
  });
  expect(h.win.querySelector(".minesweeper-face").dataset.face).toBe("won");
  expect(
    h.win.querySelector('[aria-label="Mines remaining"]').dataset.value,
  ).toBe("0");
  h.win.querySelector(".minesweeper-face").click();
  try {
    Math.random = () => 0.5;
    h.cells()[40].click();
  } finally {
    Math.random = random;
  }
  const target = h.cells()[[...mines][0]];
  target.dispatchEvent(
    new h.s.window.MouseEvent("mousedown", { button: 0, bubbles: true }),
  );
  target.dispatchEvent(new h.s.window.MouseEvent("mouseup", { bubbles: true }));
  target.click();
  expect(target.dataset.tile).toBe("exploded");
  expect(h.win.querySelector(".minesweeper-face").dataset.face).toBe("lost");
  h.cells()[0].click();
  h.mark(h.cells()[0]);
  h.command("new");
  expect(h.win.querySelector('[aria-label="Elapsed time"]').dataset.value).toBe(
    "0",
  );
});
