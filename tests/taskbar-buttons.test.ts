// @ts-nocheck -- Task buttons, grouping and Task Manager through the real shell.
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
  await flushShell();
  await flushShell();
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
const context = (s, target) =>
  target.dispatchEvent(
    new s.window.MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 200,
      clientY: 700,
    }),
  );
const overflowMenu = (s) => s.document.getElementById("taskbar-overflow-menu");
const windowOf = (s, id) =>
  s.document.querySelector(`.xp-window[data-game="${id}"]`);
const hidden = (s, id) => windowOf(s, id).style.display === "none";

async function openWindows(options = {}) {
  const s = await login(await loadShell(options));
  const fs = s.window.VirtualFS;
  for (const action of ["documents", "pictures", "music"])
    clickStartAction(s, action);
  fs.open(fs.createFile(fs.MY_DOCUMENTS, "memo.txt").id);
  await settle();
  return s;
}

test("the task overflow menu groups Explorer windows and marks attention", async () => {
  const s = await openWindows();
  s.window.XPShell.setWindowAttention("__my-pictures");
  const overflow = s.document.querySelector(
    "#task-buttons .task-button-grouped",
  );
  expect(overflow.className).toContain("needs-attention");
  expect(overflow.getAttribute("aria-label")).toContain("needs attention");
  overflow.click();
  const menu = overflowMenu(s);
  expect(menu.querySelector(".taskbar-group-heading").textContent).toBe(
    "Windows Explorer (3)",
  );
  const items = [...menu.querySelectorAll(".taskbar-overflow-item")];
  expect(items).toHaveLength(4);
  expect(
    items.some((item) => item.className.includes("needs-attention")),
  ).toBeTrue();
  context(s, items[0]);
  expect(s.document.getElementById("window-system-menu").hidden).toBeFalse();
  press(s, s.document.body, "Escape");
  overflow.click();
  overflowMenu(s).querySelector(".taskbar-overflow-item").click();
  await settle();
});

test("grouped Explorer buttons list, arrange, minimize and close their windows", async () => {
  const s = await openWindows({
    initialStorage: {
      taskbarSettings: JSON.stringify({ group: true, locked: false }),
    },
  });
  Object.defineProperty(
    s.document.getElementById("task-buttons"),
    "clientWidth",
    {
      value: 330,
    },
  );
  s.window.dispatchEvent(new s.window.Event("resize"));
  const group = () =>
    s.document.querySelector("#task-buttons .task-button-grouped");
  expect(group().textContent).toContain("3 Windows Explorer");
  group().click();
  const members = [...overflowMenu(s).querySelectorAll("button")];
  expect(members.map((item) => item.textContent)).toEqual([
    "My Documents",
    "My Pictures",
    "My Music",
  ]);
  members[1].click();
  await settle();
  const groupMenu = () => {
    context(s, group());
    return overflowMenu(s);
  };
  const choose = async (label) => {
    [...groupMenu().querySelectorAll("button")]
      .find((item) => item.textContent === label)
      .click();
    await settle();
  };
  for (const label of ["Cascade", "Tile Horizontally", "Tile Vertically"])
    await choose(label);
  await choose("Minimize Group");
  expect(
    ["__my-documents", "__my-pictures", "__my-music"].every((id) =>
      hidden(s, id),
    ),
  ).toBeTrue();
  expect(
    [...groupMenu().querySelectorAll("button")].find(
      (item) => item.textContent === "Minimize Group",
    ).disabled,
  ).toBeTrue();
  press(s, s.document.body, "Escape");
  await choose("Close Group");
  expect(!!windowOf(s, "__my-documents")).toBeFalse();
  expect(!!windowOf(s, "__my-music")).toBeFalse();
});

test("task buttons minimize the active window and restore it on the next click", async () => {
  const s = await login(await loadShell());
  Object.defineProperty(
    s.document.getElementById("task-buttons"),
    "clientWidth",
    {
      value: 800,
    },
  );
  clickStartAction(s, "documents");
  await settle();
  const button = () =>
    s.document.querySelector('.task-button[data-game="__my-documents"]');
  button().click();
  await settle();
  expect(hidden(s, "__my-documents")).toBeTrue();
  expect(button().getAttribute("aria-label")).toContain("minimized");
  button().click();
  await settle();
  expect(hidden(s, "__my-documents")).toBeFalse();
  context(s, button());
  expect(s.document.getElementById("window-system-menu").hidden).toBeFalse();
});

test("Task Manager lists no applications and opens shell dialogs from its menus", async () => {
  const s = await login(await loadShell());
  const open = () => {
    context(s, s.document.getElementById("taskbar"));
    s.document.querySelector('[data-taskbar-action="task-manager"]').click();
    return [...s.document.querySelectorAll(".task-manager-dialog")].at(-1);
  };
  let manager = open();
  expect(manager.textContent).toContain("No applications are running.");
  manager.querySelector('[data-task-manager-action="end-task"]').click();
  manager.querySelector('[data-task-manager-action="switch-to"]').click();
  manager.querySelector('[data-task-manager-action="new-task"]').click();
  expect(!!s.document.querySelector(".run-dialog")).toBeTrue();
  s.document.querySelector('.run-dialog [data-action="cancel"]').click();
  manager.querySelector('[data-task-manager-action="about"]').click();
  await settle();
  for (const [action, dialog] of [
    ["turn-off", "shutdown-dialog"],
    ["restart", "shutdown-dialog"],
    ["log-off", "logoff-dialog"],
  ]) {
    manager = open();
    manager.querySelector(`[data-task-manager-action="${action}"]`).click();
    expect(s.document.getElementById(dialog).hidden).toBeFalse();
    s.document.getElementById(dialog).hidden = true;
  }
});

test("taskbar menus activate items from the keyboard and ignore nested menus", async () => {
  const s = await login(await loadShell());
  context(s, s.document.getElementById("taskbar"));
  const menu = s.document.getElementById("taskbar-context-menu");
  const lock = menu.querySelector('[data-taskbar-action="lock"]');
  lock.focus();
  press(s, lock, "Enter");
  expect(menu.hidden).toBeTrue();
  context(s, s.document.getElementById("taskbar"));
  const nested = s.document.createElement("div");
  nested.setAttribute("role", "menu");
  const inner = s.document.createElement("button");
  nested.append(inner);
  menu.append(nested);
  press(s, inner, "ArrowDown");
  nested.remove();
  press(s, menu, "x");
  const empty = s.document.getElementById("taskbar-overflow-menu");
  empty.replaceChildren();
  empty.hidden = false;
  press(s, empty, "ArrowDown");
  const toolbars = menu.querySelector('[data-taskbar-action="toolbars"]');
  toolbars.focus();
  press(s, toolbars, " ");
});
