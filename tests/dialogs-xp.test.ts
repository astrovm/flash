// @ts-nocheck -- Dialog chrome compared against the XP SP3 VM.
import { afterEach, expect, test } from "bun:test";
import {
  cleanupShells,
  flushShell,
  loadShell,
  login,
} from "./helpers/shell-harness";
afterEach(cleanupShells);
const dialogs = (s) => [...s.document.querySelectorAll(".xp-dialog")];
const current = (s) => dialogs(s).at(-1);
const key = (s, key) =>
  s.document.activeElement.dispatchEvent(
    new s.window.KeyboardEvent("keydown", { key, bubbles: true }),
  );
const click = (s, element, x = 40, y = 50) =>
  element.dispatchEvent(
    new s.window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    }),
  );

test("only the newest dialog is active", async () => {
  const s = await login(await loadShell());
  const d = s.window.XPDialogs;
  const outer = d.confirm("Proceed?");
  const inner = d.alert("Read this first");
  const [first, second] = dialogs(s);
  expect(first.classList.contains("active")).toBeFalse();
  expect(second.classList.contains("active")).toBeTrue();
  expect(second.classList.contains("xp-message-box")).toBeTrue();
  key(s, "Enter");
  await inner;
  expect(first.classList.contains("active")).toBeTrue();
  key(s, "Escape");
  expect(await outer).toBeFalse();
});

test("the ? button shows What's This help for a control", async () => {
  const s = await login(await loadShell());
  const d = s.window.XPDialogs;
  const dialog = d.createDialog({ title: "Properties", help: true });
  const described = s.document.createElement("button");
  described.dataset.help = "Shows the clock on the taskbar.";
  const plain = s.document.createElement("button");
  dialog.body.append(described, plain);
  let clicked = 0;
  plain.addEventListener("click", () => {
    clicked += 1;
  });

  const help = dialog.el.querySelector(".help-btn");
  expect(help.getAttribute("aria-label")).toBe("Help");
  click(s, plain);
  expect(clicked).toBe(1);
  expect(s.document.querySelector(".xp-help-popup")).toBeNull();

  help.click();
  expect(dialog.el.classList.contains("whats-this")).toBeTrue();
  click(s, described, 5000, 5000);
  expect(dialog.el.classList.contains("whats-this")).toBeFalse();
  const popup = s.document.querySelector(".xp-help-popup");
  expect(popup.textContent).toBe("Shows the clock on the taskbar.");
  await s.advanceTime(1);
  s.document.dispatchEvent(
    new s.window.PointerEvent("pointerdown", { bubbles: true }),
  );
  expect(s.document.querySelector(".xp-help-popup")).toBeNull();

  help.click();
  click(s, plain);
  expect(clicked).toBe(1);
  expect(s.document.querySelector(".xp-help-popup").textContent).toBe(
    "No Help topic is associated with this item.",
  );
  help.click();
  click(s, plain);
  await s.advanceTime(1);
  s.document.dispatchEvent(
    new s.window.KeyboardEvent("keydown", { key: "Shift", bubbles: true }),
  );
  expect(s.document.querySelector(".xp-help-popup")).toBeNull();

  help.click();
  dialog.el.querySelector(".dlg-body").focus();
  dialog.onKeydown(
    new s.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  expect(dialog.el.classList.contains("whats-this")).toBeFalse();
  expect(dialog.el.isConnected).toBeTrue();
  dialog.close();
});

test("file dialogs browse with places, back, the folder list, and file types", async () => {
  const s = await login(await loadShell());
  const d = s.window.XPDialogs;
  const fs = s.window.VirtualFS;
  fs.createFile(fs.MY_DOCUMENTS, "notes.txt", { content: "" });
  fs.createFile(fs.MY_DOCUMENTS, "photo.bmp", { content: "" });
  const save = d.saveFile({ filter: [".txt"] });
  const dialog = current(s);
  expect(dialog.classList.contains("xp-file-dialog")).toBeTrue();
  expect(dialog.querySelector(".help-btn")).not.toBeNull();
  const folder = dialog.querySelector(".dlg-file-folder");
  const names = () =>
    [...dialog.querySelectorAll(".dlg-file-item")].map((item) =>
      item.textContent.trim(),
    );
  expect(folder.selectedOptions[0].textContent).toBe("My Documents");
  expect(dialog.querySelector(".dlg-file-place.selected").textContent).toBe(
    "My Documents",
  );
  expect(names()).toEqual(["My Music", "My Pictures", "notes.txt"]);
  expect(dialog.querySelector('[data-action="back"]').disabled).toBeTrue();

  const type = dialog.querySelector(".dlg-file-type");
  expect([...type.options].map((option) => option.textContent)).toEqual([
    "TXT Files (*.txt)",
    "All Files (*.*)",
  ]);
  type.value = "";
  type.dispatchEvent(new s.window.Event("change"));
  expect(names()).toContain("photo.bmp");
  type.value = ".txt";
  type.dispatchEvent(new s.window.Event("change"));
  expect(names()).not.toContain("photo.bmp");

  [...dialog.querySelectorAll(".dlg-file-place")]
    .find((place) => place.textContent === "My Computer")
    .click();
  expect(folder.value).toBe(fs.MY_COMPUTER);
  dialog.querySelector('[data-action="back"]').click();
  expect(folder.value).toBe(fs.MY_DOCUMENTS);

  folder.value = fs.DESKTOP;
  folder.dispatchEvent(new s.window.Event("change"));
  expect(folder.selectedOptions[0].textContent).toBe("Desktop");
  [...dialog.querySelectorAll(".dlg-file-place")]
    .find((place) => place.textContent === "Desktop")
    .click();
  expect(folder.value).toBe(fs.DESKTOP);

  dialog.querySelector('[data-action="new-folder"]').click();
  expect(names()).toContain("New Folder");
  expect(dialog.querySelector("#dlg-file-name").value).toBe("New Folder");

  key(s, "Escape");
  expect(await save).toBeNull();

  const open = d.openFile();
  expect(
    current(s).querySelector(".dlg-file-folder-field").textContent,
  ).toContain("Look in:");
  expect(
    [...current(s).querySelectorAll(".dlg-file-type option")].map(
      (option) => option.textContent,
    ),
  ).toEqual(["All Files (*.*)"]);
  key(s, "Escape");
  expect(await open).toBeNull();
});

test("New Folder reports a filesystem error", async () => {
  const s = await login(await loadShell());
  const d = s.window.XPDialogs;
  const fs = s.window.VirtualFS;
  const create = fs.createFolder;
  fs.createFolder = () => {
    throw new Error("synthetic storage failure");
  };
  const save = d.saveFile();
  current(s).querySelector('[data-action="new-folder"]').click();
  await flushShell();
  expect(current(s).classList.contains("xp-message-box")).toBeTrue();
  expect(current(s).textContent).toContain("synthetic storage failure");
  fs.createFolder = create;
  key(s, "Enter");
  await flushShell();
  key(s, "Escape");
  expect(await save).toBeNull();
});

test("dialogs show Explorer's icons and the Recycle Bin state", async () => {
  const s = await login(await loadShell());
  const d = s.window.XPDialogs;
  const fs = s.window.VirtualFS;
  d.properties(fs.DRIVE_C);
  expect(
    current(s).querySelector(".dlg-node-icon img").getAttribute("src"),
  ).toContain("LocalDisk.png");
  current(s).querySelector('[data-action="ok"], .xp-btn').click();
  d.properties(fs.RECYCLE_BIN);
  expect(
    current(s).querySelector(".dlg-node-icon img").getAttribute("src"),
  ).toContain("RecyclerEmpty.png");
});

test("access-key underlines follow keyboard or mouse use", async () => {
  const s = await login(await loadShell());
  const root = s.document.documentElement;
  s.document.dispatchEvent(
    new s.window.KeyboardEvent("keydown", { key: "a", bubbles: true }),
  );
  expect(root.classList.contains("keyboard-cues")).toBeFalse();
  s.document.dispatchEvent(
    new s.window.KeyboardEvent("keydown", { key: "Alt", bubbles: true }),
  );
  expect(root.classList.contains("keyboard-cues")).toBeTrue();
  s.document.dispatchEvent(
    new s.window.PointerEvent("pointerdown", { bubbles: true }),
  );
  expect(root.classList.contains("keyboard-cues")).toBeFalse();
});
