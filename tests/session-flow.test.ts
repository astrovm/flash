// @ts-nocheck -- Log off, shut down, and deep-link startup through the real shell.
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
const visible = (s, id) => !s.document.getElementById(id).hidden;
const click = (s, id) => s.document.getElementById(id).click();
const press = (s, target, key) =>
  target.dispatchEvent(
    new s.window.KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    }),
  );

const openDraft = async (s) => {
  const fs = s.window.VirtualFS;
  fs.open(fs.createFile(fs.MY_DOCUMENTS, "draft.txt").id);
  await settle();
  const win = s.document.querySelector(".notepad-window");
  const text = win.querySelector("textarea");
  text.value = "unsaved";
  text.dispatchEvent(new s.window.Event("input", { bubbles: true }));
  return win;
};
const answer = async (s, id) => {
  [...s.document.querySelectorAll(".xp-dialog")]
    .at(-1)
    .querySelector(`[data-action="${id}"]`)
    .click();
  await settle();
};

test("turning off shows the shutdown screen and a click boots again", async () => {
  const s = await login(await loadShell());
  click(s, "turn-off-button");
  click(s, "shutdown-confirm");
  await settle();
  expect(visible(s, "shutdown-screen")).toBeTrue();
  await s.advanceTime(1900);
  expect(visible(s, "turn-off-screen")).toBeTrue();
  click(s, "turn-off-screen");
  expect(visible(s, "boot-screen")).toBeTrue();
  press(s, s.document.getElementById("boot-screen"), "a");
  expect(visible(s, "boot-screen")).toBeTrue();
  click(s, "turn-off-screen");
});

test("unsaved work cancels restart, turn off, and log off", async () => {
  const s = await login(await loadShell());
  const win = await openDraft(s);
  for (const confirm of [
    "restart-confirm",
    "shutdown-confirm",
    "logoff-confirm",
  ]) {
    click(s, confirm);
    await settle();
    await answer(s, "cancel");
    expect(win.isConnected).toBeTrue();
    expect(visible(s, "desktop")).toBeTrue();
  }
  win.querySelector(".close-btn").click();
  await settle();
  click(s, "logoff-confirm");
  click(s, "logoff-confirm");
  await settle();
  await answer(s, "cancel");
  expect(s.document.querySelectorAll(".xp-dialog")).toHaveLength(0);
  expect(win.isConnected).toBeTrue();
});

test("session close failures are reported", async () => {
  const s = await login(await loadShell());
  const win = await openDraft(s);
  const message = s.window.XPDialogs.message;
  s.window.XPDialogs.message = () => Promise.reject(new Error(""));
  try {
    click(s, "logoff-confirm");
    await settle();
  } finally {
    s.window.XPDialogs.message = message;
  }
  expect(
    [...s.document.querySelectorAll(".xp-dialog")].at(-1)?.textContent || "",
  ).toMatch(/could not be closed|The session could not be closed/);
  expect(win.isConnected).toBeTrue();
});

test("a deep link skips the boot screen and warms applications when idle", async () => {
  const idle = [];
  const s = await loadShell({ url: "http://127.0.0.1/#bike-mania" });
  await settle();
  expect(visible(s, "boot-screen")).toBeFalse();
  const shell = await loadShell();
  shell.window.requestIdleCallback = (callback, options) =>
    idle.push([callback, options]);
  await login(shell);
  expect(idle[0][1]).toEqual({ timeout: 5000 });
  idle[0][0]();
});

test("the automatic Welcome screen continues only from Enter or Space on itself", async () => {
  const s = await loadShell();
  s.completeBoot();
  await settle();
  const welcome = s.document.getElementById("welcome-screen");
  expect(welcome.classList.contains("auto-login")).toBeTrue();
  press(s, welcome, "a");
  press(s, s.document.getElementById("login-user"), "Enter");
  expect(visible(s, "welcome-screen")).toBeTrue();
  press(s, welcome, " ");
  await settle();
  expect(visible(s, "desktop")).toBeTrue();
});

test("muted sessions start silently and failed sounds do not block logging off", async () => {
  const s = await loadShell({ initialStorage: { isMuted: "true" } });
  const volumes = [];
  const play = s.window.HTMLMediaElement.prototype.play;
  s.window.HTMLMediaElement.prototype.play = function () {
    volumes.push(this.volume);
    return Promise.reject(new Error("blocked"));
  };
  try {
    await login(s);
    click(s, "log-off-button");
    click(s, "logoff-confirm");
    await settle();
  } finally {
    s.window.HTMLMediaElement.prototype.play = play;
  }
  expect(volumes.every((volume) => volume === 0)).toBeTrue();
  expect(visible(s, "welcome-screen")).toBeTrue();
});

test("standby resumes from a pointer press on its screen", async () => {
  const s = await login(await loadShell());
  click(s, "turn-off-button");
  click(s, "standby-confirm");
  expect(visible(s, "standby-screen")).toBeTrue();
  s.document
    .getElementById("standby-screen")
    .dispatchEvent(new s.window.PointerEvent("pointerdown", { bubbles: true }));
  expect(visible(s, "standby-screen")).toBeFalse();
});
