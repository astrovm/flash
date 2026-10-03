// @ts-nocheck -- Start menu layout details compared against the XP SP3 VM.
import { afterEach, expect, test } from "bun:test";
import { cleanupShells, loadShell, login } from "./helpers/shell-harness";
afterEach(cleanupShells);

const press = (s, key) =>
  s.document.dispatchEvent(
    new s.window.KeyboardEvent("keydown", { key, bubbles: true }),
  );
const pointerDown = (s) =>
  s.document.dispatchEvent(
    new s.window.PointerEvent("pointerdown", { bubbles: true }),
  );

test("access-key underlines appear only after the keyboard is used", async () => {
  const s = await login(await loadShell());
  const menu = s.document.getElementById("start-menu");
  const flyouts = s.document.getElementById("start-menu-flyouts");

  pointerDown(s);
  s.document.getElementById("start-button").click();
  expect(menu.classList.contains("keyboard-cues")).toBeFalse();
  press(s, "ArrowDown");
  expect(menu.classList.contains("keyboard-cues")).toBeTrue();
  expect(flyouts.classList.contains("keyboard-cues")).toBeTrue();

  s.document.getElementById("start-button").click();
  pointerDown(s);
  s.document.getElementById("start-button").click();
  expect(menu.classList.contains("keyboard-cues")).toBeFalse();

  s.document.getElementById("start-button").click();
  press(s, "Shift");
  s.document.getElementById("start-button").click();
  expect(menu.classList.contains("keyboard-cues")).toBeTrue();
});

test("the right column groups places like XP", async () => {
  const s = await login(await loadShell());
  s.document.getElementById("start-button").click();
  const places = s.document.getElementById("start-menu-places");
  const groups = [...places.children].map((item) =>
    item.classList.contains("sm-place-separator")
      ? "|"
      : `${item.dataset.startAction}${item.classList.contains("sm-place-primary") ? "*" : ""}`,
  );
  expect(groups).toEqual([
    "documents*",
    "recent*",
    "pictures*",
    "music*",
    "computer*",
    "|",
    "controlPanel",
    "|",
    "search",
    "run",
  ]);
  expect(
    places
      .querySelector('[data-start-action="recent"]')
      .getAttribute("aria-haspopup"),
  ).toBe("menu");
});

test("Internet Games is pinned with its source and a separator", async () => {
  const s = await login(await loadShell());
  s.document.getElementById("start-button").click();
  const pinned = s.document.querySelector("#start-menu-pinned .sm-pinned");
  expect(pinned.querySelector(".sm-game-title").textContent).toBe(
    "Internet Games",
  );
  expect(pinned.querySelector(".sm-pinned-subtitle").textContent).toBe(
    "Flashpoint Archive",
  );
  expect(
    pinned.nextElementSibling.classList.contains("sm-pinned-separator"),
  ).toBeTrue();
});

test("All Programs grows upward from its button", async () => {
  const s = await login(await loadShell());
  s.document.getElementById("start-button").click();
  const button = s.document.getElementById("all-programs-button");
  button.getBoundingClientRect = () => ({
    top: 668,
    bottom: 692,
    left: 8,
    right: 145,
    width: 137,
    height: 24,
  });
  s.document.getElementById("taskbar").getBoundingClientRect = () => ({
    top: 738,
  });
  Object.defineProperty(s.window.HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return this.classList.contains("start-program-flyout") ? 100 : 0;
    },
  });
  try {
    button.click();
    const panel = s.document.querySelector(".start-program-flyout");
    expect(panel.style.top).toBe("592px");
    expect(panel.style.left).toBe("145px");
  } finally {
    delete s.window.HTMLElement.prototype.offsetHeight;
  }
});
