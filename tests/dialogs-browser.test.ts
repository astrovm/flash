// @ts-nocheck -- Happy DOM supplies the browser API.
import { afterEach, expect, test } from "bun:test";
import {
  cleanupShells,
  loadShell,
  login,
  flushShell,
} from "./helpers/shell-harness";
afterEach(cleanupShells);
const current = (s) => [...s.document.querySelectorAll(".xp-dialog")].at(-1);
const key = (s, key, options = {}) =>
  s.document.activeElement.dispatchEvent(
    new s.window.KeyboardEvent("keydown", { key, bubbles: true, ...options }),
  );
test("message access keys, stacked dialogs and keyboard cancel resolve correctly", async () => {
  const s = await login(await loadShell()),
    d = s.window.XPDialogs;
  const outer = d.confirm("Proceed?");
  const inner = d.alert("First read this");
  key(s, "Enter");
  expect(await inner).toBe("ok");
  key(s, "n", { altKey: true });
  expect(await outer).toBeFalse();
  const retry = d.message({
    text: "Retry?",
    buttons: d.BUTTON_SETS.retryCancel,
  });
  key(s, "Escape");
  expect(await retry).toBe("cancel");
  const yes = d.confirm("Proceed?");
  key(s, "y");
  expect(await yes).toBeTrue();
  const custom = d.message({
    text: "custom",
    icon: "unknown",
    buttons: [{ id: "finish", label: "Finish", isDefault: true }],
  });
  key(s, "Escape");
  expect(await custom).toBe("finish");
});
test("modal focus is trapped and dialogs can be dragged within the overlay", async () => {
  const s = await login(await loadShell()),
    d = s.window.XPDialogs.createDialog({ title: "Fields" });
  const first = s.document.createElement("input"),
    last = s.document.createElement("button");
  d.body.append(first, last);
  const buttons = [...d.el.querySelectorAll("button,input")];
  for (const el of buttons)
    Object.defineProperty(el, "offsetParent", { get: () => d.el });
  last.focus();
  key(s, "Tab");
  expect(s.document.activeElement).toBe(buttons[0]);
  key(s, "Tab", { shiftKey: true });
  expect(s.document.activeElement).toBe(last);
  const overlay = d.el.parentElement;
  Object.defineProperty(overlay, "clientWidth", { value: 600 });
  Object.defineProperty(overlay, "clientHeight", { value: 400 });
  const bar = d.el.querySelector(".title-bar");
  bar.dispatchEvent(
    new s.window.PointerEvent("pointerdown", {
      button: 0,
      clientX: 10,
      clientY: 10,
      bubbles: true,
    }),
  );
  s.document.dispatchEvent(
    new s.window.PointerEvent("pointermove", { clientX: 80, clientY: 50 }),
  );
  s.document.dispatchEvent(new s.window.PointerEvent("pointerup"));
  expect(d.el.style.left).toBe("70px");
  expect(d.el.style.top).toBe("40px");
  d.close();
  d.close();
  expect(d.el.isConnected).toBeFalse();
});
test("progress clamps percentages and cancel signals without silently closing", async () => {
  const s = await login(await loadShell());
  let canceled = 0;
  const p = s.window.XPDialogs.progress({
    text: "Copying",
    cancellable: true,
    onCancel: () => canceled++,
  });
  p.update(2, "Done");
  expect(
    p.el.querySelector('[role="progressbar"]').getAttribute("aria-valuenow"),
  ).toBe("100");
  expect(p.el.querySelector(".dlg-progress-text").textContent).toBe("Done");
  p.update(-1);
  expect(
    p.el.querySelector('[role="progressbar"]').getAttribute("aria-valuenow"),
  ).toBe("0");
  p.el.querySelector(".dlg-buttons button").click();
  expect(canceled).toBe(1);
  expect(p.el.isConnected).toBeTrue();
  p.close();
});
test("properties describe drives, files and nested folder contents", async () => {
  const s = await login(await loadShell()),
    fs = s.window.VirtualFS,
    d = s.window.XPDialogs;
  const folder = fs.createFolder(fs.MY_DOCUMENTS, "Example");
  fs.createFolder(folder.id, "Sub");
  const file = fs.createFile(folder.id, "sample.txt", { content: "hello" });
  for (const id of [
    folder.id,
    file.id,
    fs.DRIVE_C,
    fs.DRIVE_D,
    fs.DRIVE_F,
    fs.RECYCLE_BIN,
  ]) {
    const p = d.properties(id);
    if (!fs.getNode(id)) {
      expect(await p).toBeNull();
      continue;
    }
    expect(current(s).textContent).toContain("Properties");
    if (id === folder.id)
      expect(current(s).textContent).toContain("1 files, 1 folders");
    key(s, "Enter");
    await p;
  }
  expect(await d.properties("missing")).toBeNull();
});
test("open dialog navigates folders, filters files, validates names and cancels", async () => {
  const s = await login(await loadShell()),
    fs = s.window.VirtualFS,
    d = s.window.XPDialogs;
  const folder = fs.createFolder(fs.MY_DOCUMENTS, "Fixture");
  const file = fs.createFile(folder.id, "note.txt", { content: "hello" });
  fs.createFile(folder.id, "hidden.png");
  const p = d.openFile({ startFolder: folder.id, filter: [".txt"] });
  expect(current(s).textContent).toContain("note.txt");
  expect(current(s).textContent).not.toContain("hidden.png");
  s.document.getElementById("dlg-file-name").value = "missing";
  key(s, "Enter");
  expect(current(s).textContent).toContain("Cannot find");
  key(s, "Enter");
  await flushShell();
  s.document.getElementById("dlg-file-name").value = "note.txt";
  key(s, "Enter");
  expect((await p).id).toBe(file.id);
  const canceled = d.openFile({ startFolder: "missing" });
  key(s, "Escape");
  expect(await canceled).toBeNull();
  const nested = d.openFile();
  const item = [...current(s).querySelectorAll(".dlg-file-item")].find(
    (x) => x.textContent === "Fixture",
  );
  item.dispatchEvent(new s.window.MouseEvent("dblclick"));
  expect(current(s).querySelector(".dlg-file-path").textContent).toContain(
    "Fixture",
  );
  const note = [...current(s).querySelectorAll(".dlg-file-item")].find((x) =>
    x.textContent.endsWith("note.txt"),
  );
  note.click();
  note.dispatchEvent(new s.window.MouseEvent("dblclick"));
  expect((await nested).id).toBe(file.id);
});
test("save dialog confirms replacement and returns new filenames", async () => {
  const s = await login(await loadShell()),
    fs = s.window.VirtualFS,
    d = s.window.XPDialogs;
  const file = fs.createFile(fs.MY_DOCUMENTS, "save.txt");
  const p = d.saveFile({ defaultName: "save.txt" });
  key(s, "Enter");
  expect(current(s).textContent).toContain("already exists");
  key(s, "n");
  await flushShell();
  expect(s.document.getElementById("dlg-file-name")).not.toBeNull();
  key(s, "Enter");
  key(s, "y");
  expect(await p).toEqual({
    parentId: fs.MY_DOCUMENTS,
    name: "save.txt",
    existingId: file.id,
  });
  const fresh = d.saveFile();
  key(s, "Enter");
  await flushShell();
  expect(current(s)).toBeDefined();
  s.document.getElementById("dlg-file-name").value = "new.txt";
  key(s, "Enter");
  expect(await fresh).toEqual({
    parentId: fs.MY_DOCUMENTS,
    name: "new.txt",
    existingId: null,
  });
});
