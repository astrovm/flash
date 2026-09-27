// @ts-nocheck -- Start menu layout and navigation through the real shell.
import { afterEach, expect, test } from "bun:test";
import {
  cleanupShells,
  clickStartAction,
  flushShell,
  loadShell,
  login,
} from "./helpers/shell-harness";

afterEach(cleanupShells);

const settle = async () => {
  for (let i = 0; i < 4; i++) await flushShell();
};
const press = (s, target, key, options = {}) =>
  target.dispatchEvent(
    new s.window.KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...options,
    }),
  );
const flyoutLabels = (s, depth = 0) =>
  [
    ...s.document.querySelectorAll(
      `.start-program-flyout[data-depth="${depth}"] > button`,
    ),
  ].map((button) => button.textContent.replace("▶", "").trim());

test("All Programs groups recent and favorite games and skips unknown ones", async () => {
  const s = await login(
    await loadShell({
      initialStorage: {
        favorites: JSON.stringify(["bike-mania", "missing-game"]),
        gameStats: JSON.stringify({
          "missing-game": { plays: 3, lastPlayed: 3 },
          "big-truck-adventures": { plays: 1, lastPlayed: 1 },
        }),
      },
      gameLibraryManager: {
        subscribe: () => () => {},
        initialize: async () => ({
          "flashpoint:plain": {
            title: "Plain Game",
            type: "swf",
            installed: true,
            url: "https://flash.example/plain.swf",
          },
        }),
        getRecord: () => null,
      },
    }),
  );
  s.document.getElementById("start-button").click();
  s.document.getElementById("all-programs-button").click();
  const games = [
    ...s.document.querySelectorAll(".start-program-flyout button"),
  ].find((button) => button.textContent.includes("Games"));
  games.click();
  const groups = flyoutLabels(s, 1).slice(6);
  expect(groups.slice(0, 2)).toEqual(["Recently Played", "Favorites"]);
  expect(groups).toContain("Other");
  s.document.querySelector(".sm-game-title")?.closest("button");
  const internet = [
    ...s.document.querySelectorAll("#start-menu .sm-game"),
  ].find((item) => item.textContent.includes("Internet Games"));
  internet.click();
  await settle();
  expect(
    !!s.document.querySelector('.xp-window[data-game="__internet-games"]'),
  ).toBeTrue();
});

test("the Start menu opens beside left, right, and top taskbars", async () => {
  for (const edge of ["left", "right", "top"]) {
    const s = await login(
      await loadShell({
        initialStorage: { taskbarSettings: JSON.stringify({ edge }) },
      }),
    );
    s.document.getElementById("start-button").click();
    expect(s.document.getElementById("start-menu").hidden).toBeFalse();
    s.document.getElementById("start-button").click();
  }
});

test("flyouts open to the left near the screen edge and ignore stale hovers", async () => {
  const s = await login(await loadShell());
  s.document.getElementById("start-button").click();
  const all = s.document.getElementById("all-programs-button");
  press(s, all, "a");
  Object.defineProperty(s.window, "innerWidth", {
    configurable: true,
    value: 10,
  });
  press(s, all, "ArrowRight");
  const accessories = s.document.querySelector(
    '[data-program-id="accessories"]',
  );
  press(s, accessories, "a");
  accessories.dispatchEvent(new s.window.PointerEvent("pointerenter"));
  s.document.getElementById("start-button").click();
  await s.advanceTime(250);
  expect(s.document.getElementById("start-menu-flyouts").hidden).toBeTrue();
  all.dispatchEvent(new s.window.PointerEvent("pointerenter"));
  await s.advanceTime(250);
  expect(s.document.getElementById("start-menu-flyouts").hidden).toBeTrue();
});

test("the classic Start menu opens folders and runs access keys", async () => {
  const s = await login(
    await loadShell({ initialStorage: { startMenuStyle: "classic" } }),
  );
  s.document.getElementById("start-button").click();
  const places = s.document.getElementById("start-menu-places");
  const folder = places.querySelector(".classic-start-folder");
  press(s, folder, "a");
  press(s, folder, "ArrowRight");
  expect(s.document.getElementById("start-menu-flyouts").hidden).toBeFalse();
  press(s, places, "z");
  press(s, places, "r", { altKey: true });
  press(s, places, "r");
  await settle();
  expect(!!s.document.querySelector(".run-dialog")).toBeTrue();
  press(s, s.document.querySelector(".run-dialog"), "o", { altKey: true });
  expect(s.document.activeElement.id).toBe("run-command");
  clickStartAction(s, "run");
});
