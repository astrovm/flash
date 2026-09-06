// @ts-nocheck -- Happy DOM supplies browser objects.
import { afterEach, expect, test } from "bun:test";
import {
  cleanupShells,
  flushShell,
  loadShell,
  login,
} from "./helpers/shell-harness";

afterEach(cleanupShells);

const properties = (s) => {
  s.document
    .getElementById("taskbar")
    .dispatchEvent(new s.window.MouseEvent("contextmenu", { bubbles: true }));
  s.document.querySelector('[data-taskbar-action="properties"]').click();
  return s.document.querySelector(".taskbar-properties-dialog");
};

test("Show the clock persists and reopening Properties reflects the saved value", async () => {
  const s = await login(await loadShell());
  Object.defineProperty(
    s.document.getElementById("task-buttons"),
    "clientWidth",
    { value: 800 },
  );
  const dialog = properties(s);
  dialog.querySelector('[data-taskbar-setting="show-clock"]').click();
  dialog.querySelector('[data-action="ok"]').click();
  expect(s.document.getElementById("taskbar-clock").hidden).toBeTrue();
  expect(s.window.localStorage.getItem("taskbarShowClock")).toBe("false");
  expect(
    properties(s).querySelector('[data-taskbar-setting="show-clock"]').checked,
  ).toBeFalse();
  const restored = await login(
    await loadShell({ initialStorage: { taskbarShowClock: "false" } }),
  );
  expect(restored.document.getElementById("taskbar-clock").hidden).toBeTrue();
});

test("double-clicking Volume opens Volume Control and closes the quick popup", async () => {
  const s = await login(await loadShell());
  Object.defineProperty(
    s.document.getElementById("task-buttons"),
    "clientWidth",
    { value: 800 },
  );
  const button = s.document.getElementById("tray-volume-button");
  button.click();
  expect(button.getAttribute("aria-expanded")).toBe("true");
  button.dispatchEvent(new s.window.MouseEvent("dblclick"));
  await flushShell();
  await flushShell();
  expect(s.document.getElementById("tray-volume-popup").hidden).toBeTrue();
  expect(button.getAttribute("aria-expanded")).toBe("false");
  expect(
    s.document.querySelector('.task-button[data-game="__volume-control"]'),
  ).not.toBeNull();
});

test("Explorer task title follows its current folder", async () => {
  const s = await login(await loadShell());
  Object.defineProperty(
    s.document.getElementById("task-buttons"),
    "clientWidth",
    { value: 800 },
  );
  const bin = s.document.querySelector('[data-desktop-id="__recycle-bin"]');
  bin.dispatchEvent(new s.window.MouseEvent("dblclick"));
  await flushShell();
  await flushShell();
  expect(s.document.querySelector(".task-button .task-label").textContent).toBe(
    "Recycle Bin",
  );
});
