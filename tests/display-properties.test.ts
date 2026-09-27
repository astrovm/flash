// @ts-nocheck -- Happy DOM supplies the shell's browser objects.
import { afterEach, expect, test } from "bun:test";
import {
  cleanupShells,
  loadShell,
  login,
  clickStartAction,
  flushShell,
} from "./helpers/shell-harness";
afterEach(cleanupShells);
async function open() {
  const s = await login(await loadShell());
  clickStartAction(s, "controlPanel");
  s.document
    .querySelector('[data-control-panel-category="appearance"]')
    .click();
  s.document.querySelector('[data-control-panel-action="display"]').click();
  const d = s.document.querySelector(".display-properties-content");
  const q = (selector) => d.querySelector(selector);
  const change = (selector, value, type = "change") => {
    const el = q(selector);
    el.value = value;
    el.dispatchEvent(new s.window.Event(type, { bubbles: true }));
  };
  const key = (el, key) =>
    el.dispatchEvent(
      new s.window.KeyboardEvent("keydown", { key, bubbles: true }),
    );
  const saved = () =>
    JSON.parse(s.window.localStorage.getItem("displaySettings"));
  const dialogButton = (dialog, label) =>
    [...dialog.querySelectorAll(".dlg-buttons button,.browse-buttons button")]
      .find((b) => b.textContent === label)
      .click();
  return { s, d, q, change, key, saved, dialogButton };
}
test("display tabs, wallpaper selection and preference controls persist together", async () => {
  const h = await open();
  const { q, change, key } = h;
  const tabs = [...h.d.querySelectorAll('[role="tab"]')];
  for (const tab of tabs) {
    tab.click();
    expect(q("#" + tab.getAttribute("aria-controls")).hidden).toBeFalse();
  }
  for (const k of ["Home", "ArrowRight", "ArrowLeft", "End"]) key(tabs[0], k);
  expect(tabs.at(-1).getAttribute("aria-selected")).toBe("true");
  change("#display-theme", "classic");
  change("#display-wallpaper", "ascent");
  const list = q(".display-wallpaper-list");
  for (const k of ["Home", "ArrowDown", "ArrowUp", "End"]) key(list, k);
  expect(list.querySelector('[aria-selected="true"]')).not.toBeNull();
  change("#display-position", "tile");
  change("#display-color", "#123456", "input");
  change("#display-appearance", "silver");
  change("#display-font-size", "large");
  change("#display-saver-wait", "99");
  q(".display-saver-login").click();
  q('[data-display-action="apply"]').click();
  expect(h.saved()).toMatchObject({
    position: "tile",
    backgroundColor: "#123456",
    appearance: "silver",
    fontSize: "large",
    screenSaverWait: 60,
  });
  expect(q('[data-display-action="apply"]').disabled).toBeTrue();
  q('[data-display-action="ok"]').click();
  expect(h.d.isConnected).toBeFalse();
});
test("effects and advanced appearance commit drafts and cancel safely", async () => {
  const h = await open();
  const { s, q } = h;
  for (const commit of [false, true]) {
    q(".display-effects").click();
    const dialog = s.document.querySelector(".display-effects-dialog");
    const transition = dialog.querySelector(
      '[data-effect-enabled="transition"]',
    );
    transition.click();
    expect(
      dialog.querySelector('[data-effect="transitionEffect"]').disabled,
    ).toBe(!transition.checked);
    dialog.querySelector('[data-effect-enabled="smoothing"]').click();
    dialog.querySelector('[data-effect="largeIcons"]').click();
    h.dialogButton(dialog, commit ? "OK" : "Cancel");
    await flushShell();
    expect(dialog.isConnected).toBeFalse();
  }
  q(".display-advanced-appearance").click();
  let advanced = s.document.querySelector(".advanced-appearance-dialog");
  advanced.querySelector("[data-advanced-color]").value = "#654321";
  h.dialogButton(advanced, "OK");
  await flushShell();
  expect(q("#display-color").value).toBe("#654321");
  q(".display-advanced-appearance").click();
  advanced = s.document.querySelector(".advanced-appearance-dialog");
  h.dialogButton(advanced, "Cancel");
  q('[data-display-action="apply"]').click();
  expect(h.saved().backgroundColor).toBe("#654321");
  expect(h.saved().largeIcons).toBeTrue();
});
test("desktop icon customization toggles visibility and restores owner focus", async () => {
  const h = await open();
  const { s, q } = h;
  q(".display-customize").click();
  const dialog = s.document.querySelector(".desktop-items-dialog");
  dialog.querySelector('[data-desktop-items-tab="web"]').click();
  expect(
    dialog.querySelector('[data-desktop-items-panel="web"]').hidden,
  ).toBeFalse();
  dialog.querySelector('[data-desktop-items-tab="general"]').click();
  const choices = [...dialog.querySelectorAll(".desktop-icon-choices button")];
  choices[1].click();
  expect(choices[1].classList.contains("selected")).toBeTrue();
  dialog.querySelector('[data-system-icon="__my-computer"]').click();
  h.dialogButton(dialog, "OK");
  await flushShell();
  expect(
    s.document.querySelector('[data-desktop-id="__my-computer"]'),
  ).toBeNull();
  q(".display-customize").click();
  h.dialogButton(s.document.querySelector(".desktop-items-dialog"), "Cancel");
  await flushShell();
  expect(s.document.querySelector(".desktop-items-dialog")).toBeNull();
});
test("wallpaper upload rejects non-images, previews a valid picture and can clear it", async () => {
  const h = await open();
  const { s, q } = h;
  q(".display-browse").click();
  const input = q("#display-image");
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [new s.window.File(["no"], "bad.txt", { type: "text/plain" })],
  });
  input.dispatchEvent(new s.window.Event("change"));
  expect(q(".display-status").textContent).toContain("Choose a PNG");
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [new s.window.File(["image"], "art.png", { type: "image/png" })],
  });
  input.dispatchEvent(new s.window.Event("change"));
  for (let i = 0; i < 20 && q(".display-clear-image").hidden; i++)
    await flushShell();
  expect(q(".display-clear-image").hidden).toBeFalse();
  expect(s.document.querySelector(".wallpaper-browse-dialog")).toBeNull();
  q('[data-display-action="apply"]').click();
  expect(h.saved().customWallpaper).toStartWith("data:image/png");
  q(".display-clear-image").click();
  q('[data-display-action="apply"]').click();
  expect(h.saved().customWallpaper).toBe("");
  q(".display-browse").click();
  h.dialogButton(
    s.document.querySelector(".wallpaper-browse-dialog"),
    "Cancel",
  );
});
test("resolution preview rolls back on cancel and saver settings stay usable", async () => {
  const h = await open();
  const { s, q, change } = h;
  change("#display-resolution", "800x600");
  expect(q(".display-resolution-value").textContent).toContain("800 by 600");
  change("#display-resolution", "auto");
  change("#display-resolution-slider", "2", "input");
  expect(q(".display-resolution-value").textContent).toContain("1440 by 900");
  change("#display-saver", "blank");
  q(".display-saver-settings").click();
  const notice = s.document.querySelector(".xp-dialog-overlay");
  expect(notice.textContent).toContain("no options");
  h.dialogButton(notice, "OK");
  await flushShell();
  q(".display-saver-preview-button").click();
  expect(s.document.getElementById("screen-saver-overlay").hidden).toBeFalse();
  s.document.dispatchEvent(
    new s.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  expect(s.document.getElementById("screen-saver-overlay").hidden).toBeTrue();
  q('[data-display-action="cancel"]').click();
  expect(h.d.isConnected).toBeFalse();
  expect(h.saved()).toBeNull();
});

test("secondary display dialogs cancel with Escape and ignore clicks between controls", async () => {
  const h = await open();
  const { s, q } = h;
  const escape = (dialog) =>
    dialog.dispatchEvent(
      new s.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  q(".display-customize").click();
  const items = s.document.querySelector(".desktop-items-dialog");
  items
    .querySelector(".desktop-items-tabs")
    .dispatchEvent(new s.window.MouseEvent("click", { bubbles: true }));
  items
    .querySelector(".desktop-icon-choices")
    .dispatchEvent(new s.window.MouseEvent("click", { bubbles: true }));
  escape(items);
  expect(items.isConnected).toBeFalse();
  q(".display-effects").click();
  escape(s.document.querySelector(".display-effects-dialog"));
  q(".display-advanced-appearance").click();
  escape(s.document.querySelector(".advanced-appearance-dialog"));
  q(".display-browse").click();
  const browse = s.document.querySelector(".wallpaper-browse-dialog");
  let picked = 0;
  q("#display-image").click = () => picked++;
  h.dialogButton(browse, "Open");
  expect(picked).toBe(1);
  escape(browse);
  expect(s.document.querySelector(".xp-dialog")).toBeNull();
});

test("effects restore scroll transitions and ClearType and can turn both off", async () => {
  const s = await login(
    await loadShell({
      initialStorage: {
        displaySettings: JSON.stringify({
          transitionEffect: "scroll",
          fontSmoothing: "cleartype",
        }),
      },
    }),
  );
  clickStartAction(s, "controlPanel");
  s.document
    .querySelector('[data-control-panel-category="appearance"]')
    .click();
  s.document.querySelector('[data-control-panel-action="display"]').click();
  const content = s.document.querySelector(".display-properties-content");
  content.querySelector(".display-effects").click();
  const dialog = s.document.querySelector(".display-effects-dialog");
  expect(dialog.querySelector('[data-effect="transitionEffect"]').value).toBe(
    "scroll",
  );
  expect(dialog.querySelector('[data-effect="fontSmoothing"]').value).toBe(
    "cleartype",
  );
  dialog.querySelector('[data-effect-enabled="transition"]').click();
  dialog.querySelector('[data-effect-enabled="smoothing"]').click();
  [...dialog.querySelectorAll(".dlg-buttons button")]
    .find((button) => button.textContent === "OK")
    .click();
  content.querySelector('[data-display-action="apply"]').click();
  expect(
    JSON.parse(s.window.localStorage.getItem("displaySettings")),
  ).toMatchObject({ transitionEffect: "none", fontSmoothing: "none" });
});

test("the wallpaper list scrolls with its arrows, track, and thumb", async () => {
  const h = await open();
  const { s, q } = h;
  q('[role="tab"][aria-controls="display-panel-desktop"]').click();
  const scroller = q(".display-wallpaper-items");
  const track = q(".display-scrollbar .scroll-track");
  const thumb = q(".display-scrollbar .scroll-thumb");
  const scrolls = [];
  scroller.scrollBy = ({ top }) => scrolls.push(top);
  Object.defineProperties(scroller, {
    scrollHeight: { configurable: true, value: 400 },
    clientHeight: { configurable: true, value: 100 },
  });
  Object.defineProperty(track, "clientHeight", {
    configurable: true,
    value: 80,
  });
  scroller.dispatchEvent(new s.window.Event("scroll"));
  expect(thumb.style.height).toBe("22px");
  const pointer = (target, type, clientY, bubbles = true) =>
    target.dispatchEvent(
      new s.window.PointerEvent(type, {
        bubbles,
        cancelable: true,
        clientY,
        pointerId: 1,
      }),
    );
  pointer(q(".display-scrollbar .scroll-arrow.up"), "pointerdown", 0);
  pointer(q(".display-scrollbar .scroll-arrow.down"), "pointerdown", 0);
  thumb.getBoundingClientRect = () => ({ top: 50 });
  pointer(track, "pointerdown", 10);
  pointer(track, "pointerdown", 90);
  expect(scrolls).toEqual([-18, 18, -100, 100]);
  thumb.setPointerCapture = () => {};
  Object.defineProperty(thumb, "offsetHeight", {
    configurable: true,
    value: 22,
  });
  pointer(thumb, "pointerdown", 0);
  pointer(thumb, "pointermove", 29, false);
  expect(scroller.scrollTop).toBe(150);
  pointer(thumb, "pointerup", 29, false);
  Object.defineProperty(thumb, "offsetHeight", {
    configurable: true,
    value: 80,
  });
  pointer(thumb, "pointerdown", 0);
  pointer(thumb, "pointermove", 40, false);
  pointer(thumb, "pointercancel", 40, false);
  expect(scroller.scrollTop).toBe(150);
  const list = q(".display-wallpaper-list");
  list.dispatchEvent(new s.window.MouseEvent("click", { bubbles: true }));
  list.dispatchEvent(
    new s.window.KeyboardEvent("keydown", { key: "a", bubbles: true }),
  );
  q('[role="tab"]').dispatchEvent(
    new s.window.KeyboardEvent("keydown", { key: "a", bubbles: true }),
  );
});

test("display settings reject empty choices and report save failures", async () => {
  const h = await open();
  const { s, q, change } = h;
  change("#display-saver-wait", "abc");
  change("#display-saver", "none");
  q(".display-saver-preview-button").click();
  expect(
    s.document.getElementById("screen-saver-overlay")?.hidden ?? true,
  ).toBeTrue();
  q("#display-image").dispatchEvent(new s.window.Event("change"));
  change("#display-position", "tile");
  const realStorage = s.window.localStorage;
  const errors = [];
  const originalError = s.window.console.error;
  s.window.console.error = (...args) => errors.push(args);
  Object.defineProperty(s.window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => realStorage.getItem(key),
      removeItem: (key) => realStorage.removeItem(key),
      setItem(key, value) {
        if (key === "displaySettings") throw new Error("quota");
        realStorage.setItem(key, value);
      },
    },
  });
  try {
    q('[data-display-action="ok"]').click();
    expect(q(".display-status").textContent).toContain("could not save");
    expect(h.d.isConnected).toBeTrue();
    expect(errors).toHaveLength(1);
  } finally {
    Object.defineProperty(s.window, "localStorage", {
      configurable: true,
      value: realStorage,
    });
    s.window.console.error = originalError;
  }
  q('[data-display-action="apply"]').click();
  q('[data-display-action="ok"]').click();
  expect(h.d.isConnected).toBeFalse();
});
