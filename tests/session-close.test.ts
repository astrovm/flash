// @ts-nocheck -- The shell harness exposes application globals in Happy DOM.
import { afterEach, expect, test } from "bun:test";
import {
  cleanupShells,
  flushShell,
  loadShell,
  login,
} from "./helpers/shell-harness";

afterEach(cleanupShells);

test("cancelling a dirty editor keeps the session on the desktop", async () => {
  const { window, document } = await login(await loadShell());
  const fs = window.VirtualFS;
  const file = fs.createFile(fs.MY_DOCUMENTS, "notes.txt", {
    content: "saved",
  });
  fs.open(file.id);
  const editor = document.querySelector(".notepad-editor");
  editor.value = "draft";
  editor.dispatchEvent(new window.Event("input", { bubbles: true }));
  document.getElementById("start-button").click();
  document.getElementById("log-off-button").click();
  document.getElementById("logoff-confirm").click();
  await flushShell();
  expect(document.getElementById("desktop").hidden).toBeFalse();
  document.querySelector('.xp-dialog [data-action="cancel"]').click();
  await flushShell();
  expect(document.getElementById("desktop").hidden).toBeFalse();
  expect(document.getElementById("welcome-screen").hidden).toBeTrue();
  expect(editor.isConnected).toBeTrue();
  expect(editor.value).toBe("draft");
});

test("a failed Notepad save retains the draft and close confirmation", async () => {
  const { window, document } = await login(await loadShell());
  const fs = window.VirtualFS;
  const file = fs.createFile(fs.MY_DOCUMENTS, "notes.txt", {
    content: "saved",
  });
  fs.open(file.id);
  const editor = document.querySelector(".notepad-editor");
  editor.value = "draft";
  editor.dispatchEvent(new window.Event("input", { bubbles: true }));
  const setContent = fs.setContent;
  fs.setContent = () => {
    throw new Error("Browser storage is full. Free some space and save again.");
  };
  editor.dispatchEvent(
    new window.KeyboardEvent("keydown", {
      key: "s",
      ctrlKey: true,
      bubbles: true,
    }),
  );
  await flushShell();
  fs.setContent = setContent;
  expect(document.querySelector(".xp-dialog").textContent).toContain(
    "storage is full",
  );
  document.querySelector('.xp-dialog [data-action="ok"]').click();
  await flushShell();
  expect(editor.value).toBe("draft");
  expect(fs.getContent(file.id)).toBe("saved");
  document.querySelector(".notepad-window .close-btn").click();
  await flushShell();
  expect(document.querySelector(".xp-dialog").textContent).toContain(
    "Do you want to save",
  );
});

test("the app host loads a deferred application on first open", async () => {
  const { window, document } = await login(
    await loadShell({ preloadApplications: false }),
  );
  const descriptor = window.XPApplicationRegistry.get("__notepad");
  expect(descriptor.loaded).toBeNull();
  const fs = window.VirtualFS;
  const file = fs.createFile(fs.MY_DOCUMENTS, "lazy.txt", {
    content: "loaded on demand",
  });
  fs.open(file.id);
  await descriptor.load();
  await flushShell();
  expect(document.querySelector(".notepad-editor").value).toBe(
    "loaded on demand",
  );
});

for (const fails of [false, true]) {
  test(`a deferred application ${fails ? "failure" : "load"} cannot outlive its session`, async () => {
    const shell = await login(await loadShell({ preloadApplications: false }));
    const { window, document } = shell;
    const registry = window.XPApplicationRegistry;
    const original = registry.get("__notepad");
    let finish;
    const gate = new Promise((resolve) => {
      finish = resolve;
    });
    const pending = gate.then(() => {
      if (fails) throw new Error("late import failure");
      return original.load();
    });
    window.XPApplicationRegistry = {
      ...registry,
      get(id) {
        return id === "__notepad"
          ? { ...original, load: () => pending }
          : registry.get(id);
      },
    };
    const fs = window.VirtualFS;
    fs.open(
      fs.createFile(fs.MY_DOCUMENTS, "late.txt", { content: "pending" }).id,
    );
    document.getElementById("start-button").click();
    document.getElementById("log-off-button").click();
    document.getElementById("logoff-confirm").click();
    await flushShell();
    expect(document.getElementById("welcome-screen").hidden).toBeFalse();
    await login(shell);
    finish();
    await pending.catch(() => {});
    await flushShell();
    expect(document.querySelector(".notepad-window")).toBeNull();
    expect(document.querySelector(".xp-dialog")).toBeNull();
  });
}
