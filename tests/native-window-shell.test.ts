// @ts-nocheck -- Simulate native application messages at the shell boundary.
import { afterEach, expect, test } from "bun:test";
import {
  cleanupShells,
  loadShell,
  login,
  flushShell,
} from "./helpers/shell-harness";
afterEach(cleanupShells);
async function setup() {
  const s = await login(await loadShell()),
    registry = s.window.XPApplicationRegistry,
    original = registry.get("__notepad");
  let context;
  const calls = [];
  const app = {
    ...original.loaded,
    window: { ...original.loaded.window, nativeMetadata: true },
    mount(c) {
      context = c;
      const element = s.document.createElement("div");
      element.className = "window-content boxedwine-shared-app-host";
      return {
        element,
        focus: () => calls.push("focus"),
        unmount: () => calls.push("unmount"),
      };
    },
  };
  s.window.XPApplicationRegistry = {
    ...registry,
    get: (id) => (id === "__notepad" ? app : registry.get(id)),
  };
  const fs = s.window.VirtualFS;
  fs.open(fs.createFile(fs.MY_DOCUMENTS, "native.txt", { content: "" }).id);
  const win = s.document.querySelector('.xp-window[data-game="__notepad"]'),
    desktop = s.document.getElementById("desktop");
  Object.defineProperties(desktop, {
    clientWidth: { value: 1024, configurable: true },
    clientHeight: { value: 738, configurable: true },
  });
  for (const [prop, style] of Object.entries({
    offsetLeft: "left",
    offsetTop: "top",
    offsetWidth: "width",
    offsetHeight: "height",
  }))
    Object.defineProperty(win, prop, {
      configurable: true,
      get: () => parseFloat(win.style[style]) || 0,
    });
  const detail = (id, title = "Native dialog") => ({
    id,
    title,
    clientWidth: 250,
    clientHeight: 160,
    x: 10,
    y: 20,
    canvas: s.document.createElement("canvas"),
    close: () => calls.push(`close:${id}`),
    focus: () => calls.push(`focus:${id}`),
  });
  return { s, win, context, calls, detail };
}
test("native child windows block the owner, track focus, update content and close independently", async () => {
  const { s, win, context, calls, detail } = await setup();
  context.upsertNativeOwnedWindow(detail(1));
  const child = () => s.document.querySelector('[data-native-window-id="1"]');
  expect(win.getAttribute("aria-disabled")).toBe("true");
  expect(child().querySelector(".title-text").textContent).toBe(
    "Native dialog",
  );
  expect(child().style.width).toBe("250px");
  expect(child().style.height).toBe("188px");
  win.dispatchEvent(new s.window.MouseEvent("click", { bubbles: true }));
  expect(calls.at(-1)).toBe("focus:1");
  context.upsertNativeOwnedWindow(detail(2, "Other dialog"));
  child().dispatchEvent(
    new s.window.PointerEvent("pointerdown", { bubbles: true }),
  );
  expect(calls.at(-1)).toBe("focus:1");
  const updated = detail(1, "Updated dialog");
  context.upsertNativeOwnedWindow(updated);
  expect(child().querySelector("canvas") === updated.canvas).toBeTrue();
  child().querySelector(".close-btn").click();
  expect(calls).toContain("close:1");
  context.removeNativeOwnedWindow(1);
  expect(child() === null).toBeTrue();
  expect(win.getAttribute("aria-disabled")).toBe("true");
  expect(context.removeNativeOwnedWindow(999)).toBeFalse();
  context.clearNativeOwnedWindows();
  expect(
    s.document.querySelector("[data-native-window-id]") === null,
  ).toBeTrue();
  expect(win.hasAttribute("aria-disabled")).toBeFalse();
});
test("native dialogs retain dragged position and follow parent minimize, restore and close", async () => {
  const { s, win, context, detail } = await setup();
  context.upsertNativeOwnedWindow({ ...detail(1), x: 9000, y: 9000 });
  const child = s.document.querySelector('[data-native-window-id="1"]'),
    bar = child.querySelector(".title-bar");
  for (const [type, x, y] of [
    ["pointerdown", 10, 20],
    ["pointermove", 30, 40],
    ["pointerup", 30, 40],
  ])
    bar.dispatchEvent(
      new s.window.PointerEvent(type, {
        button: 0,
        pointerId: 1,
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true,
      }),
    );
  const position = [child.style.left, child.style.top];
  context.upsertNativeOwnedWindow({ ...detail(1), x: 50, y: 50 });
  expect([child.style.left, child.style.top]).toEqual(position);
  context.applyNativeMinimize();
  await flushShell();
  expect(win.style.display).toBe("none");
  expect(child.style.display).toBe("none");
  context.applyNativeRestore();
  context.applyNativeFocus();
  expect(child.style.display).toBe("flex");
  context.applyNativeClose();
  expect(win.isConnected).toBeFalse();
  expect(child.isConnected).toBeFalse();
});
test("native window metadata respects capability flags and ignores placeholder geometry", async () => {
  const { s, win, context } = await setup();
  context.setTitle("Native title");
  expect(win.querySelector(".title-text").textContent).toBe("Native title");
  context.setSize(500, 400);
  context.applyNativeWindowMetadata({
    clientWidth: 1,
    clientHeight: 1,
    canResize: false,
    canMaximize: false,
    canMinimize: false,
  });
  expect(win.style.width).toBe("500px");
  expect(win.querySelector(".maximize-btn").disabled).toBeTrue();
  expect(win.querySelector(".minimize-btn").disabled).toBeTrue();
  expect(win.querySelector(".resize-handle").hidden).toBeTrue();
  context.applyNativeWindowMetadata({
    clientWidth: 480,
    clientHeight: 300,
    canResize: true,
    canMaximize: true,
    canMinimize: true,
  });
  expect(context.nativeWindowReady).toBeTrue();
  expect(win.querySelector(".maximize-btn").disabled).toBeFalse();
  win.querySelector(".maximize-btn").click();
  const width = win.style.width;
  context.applyNativeWindowMetadata({ clientWidth: 300, clientHeight: 200 });
  expect(win.style.width).toBe(width);
  win.querySelector(".maximize-btn").click();
  context.setNativeRuntimeSize(800, 600);
  context.applyNativeSize(450, 350);
  expect(win.style.width).toBe("450px");
  context.applyNativeClientSize(400, 300);
  expect(win.style.height).toBe("328px");
  expect(context.nativeCommandSize(400, 300)).toEqual({
    width: 400,
    height: 300,
  });
  expect(context.launchApplication("missing")).toBeFalse();
  context.launchApplication("__my-documents");
  expect(
    !!s.document.querySelector('.xp-window[data-game="__my-documents"]'),
  ).toBeTrue();
  const fs = s.window.VirtualFS,
    file = context.createFile(fs.MY_DOCUMENTS, "saved.txt", "old");
  context.setFileContent(file.id, "new");
  expect(fs.getContent(file.id)).toBe("new");
  const data = await context.dataUrlFromBlob(
    new s.window.Blob(["test"], { type: "text/plain" }),
  );
  expect(data).toStartWith("data:text/plain;base64,");
  context.setWallpaper(data);
  expect(s.document.getElementById("desktop").dataset.wallpaperPosition).toBe(
    "center",
  );
});
