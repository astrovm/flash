// @ts-nocheck -- The Command Prompt window driven through the real shell.
import { afterEach, expect, test } from "bun:test";
import {
  cleanupShells,
  flushShell,
  loadShell,
  login,
} from "./helpers/shell-harness";

afterEach(cleanupShells);

const settle = async () => {
  for (let i = 0; i < 4; i++) await flushShell();
};

async function openCommandPrompt() {
  const s = await login(await loadShell());
  s.document.getElementById("start-button").click();
  s.document.getElementById("all-programs-button").click();
  const button = (label) =>
    [...s.document.querySelectorAll(".start-program-flyout button")].find(
      (item) => item.textContent.replace("▶", "").trim() === label,
    );
  button("Accessories").click();
  button("Command Prompt").click();
  await settle();
  const win = s.document.querySelector(
    '.xp-window[data-game="__command-prompt"]',
  );
  const input = win.querySelector(".xp-terminal-prompt input");
  const output = win.querySelector(".xp-terminal-output");
  const press = async (key) => {
    input.dispatchEvent(
      new s.window.KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
  };
  const enter = async (command) => {
    input.value = command;
    await press("Enter");
  };
  return { s, win, input, output, press, enter };
}

test("the Command Prompt runs commands, recalls history, and clears the screen", async () => {
  const h = await openCommandPrompt();
  await h.press("ArrowUp");
  expect(h.input.value).toBe("");
  await h.press("a");
  await h.enter("   ");
  await h.enter("ver");
  expect(h.output.textContent).toContain("Microsoft Windows XP");
  await h.enter("echo hello");
  await h.press("ArrowUp");
  expect(h.input.value).toBe("echo hello");
  await h.press("ArrowUp");
  await h.press("ArrowUp");
  expect(h.input.value).toBe("ver");
  await h.press("ArrowDown");
  await h.press("ArrowDown");
  expect(h.input.value).toBe("");
  await h.enter("cls");
  expect(h.output.textContent).toBe("");
  h.win
    .querySelector(".xp-terminal-screen")
    .dispatchEvent(
      new h.s.window.PointerEvent("pointerdown", { bubbles: true }),
    );
  h.win
    .querySelector(".title-buttons")
    .dispatchEvent(
      new h.s.window.PointerEvent("pointerdown", { bubbles: true }),
    );
});

test("the Command Prompt reports thrown errors and closes on exit", async () => {
  const h = await openCommandPrompt();
  const fs = h.s.window.VirtualFS;
  const transaction = fs.transaction;
  fs.transaction = () => {
    throw new Error("storage offline");
  };
  try {
    await h.enter("dir");
  } finally {
    fs.transaction = transaction;
  }
  expect(h.output.textContent).toContain("storage offline");
  await h.enter("exit");
  expect(h.win.isConnected).toBeFalse();
});
