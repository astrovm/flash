// @ts-nocheck -- The window surface only needs a small canvas and window contract.
import { afterEach, describe, expect, test } from "bun:test";

import { createBoxedWineWindowSurface } from "../site/apps/core/boxedwine-window-surface.js";

const ORIGIN = "https://flash.example";
const originalGlobals = {
  window: globalThis.window,
  document: globalThis.document,
  ImageData: globalThis.ImageData,
};
afterEach(() => {
  for (const [key, value] of Object.entries(originalGlobals)) {
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
  }
});

const makeCanvas = ({ throwCapture = false, rect } = {}) => {
  const listeners = new Map();
  const draws = [];
  return {
    dataset: {},
    style: {},
    width: 0,
    height: 0,
    hidden: false,
    draws,
    listeners,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    dispatch(type, event = {}) {
      const full = {
        pointerId: 1,
        clientX: 10,
        clientY: 10,
        button: 0,
        buttons: 1,
        detail: 1,
        preventDefault() {
          this.defaultPrevented = true;
        },
        ...event,
      };
      listeners.get(type)?.(full);
      return full;
    },
    focus() {
      this.focused = true;
    },
    getBoundingClientRect: () =>
      rect || { left: 0, top: 0, width: 200, height: 100 },
    getContext() {
      return {
        clearRect() {},
        drawImage: (...args) => draws.push(args),
        putImageData() {},
      };
    },
    setPointerCapture(pointerId) {
      if (throwCapture) throw new Error("unsupported");
      this.captured = pointerId;
    },
    hasPointerCapture(pointerId) {
      return this.captured === pointerId;
    },
    releasePointerCapture() {
      this.captured = null;
    },
    remove() {
      this.removed = true;
    },
  };
};

function setup({
  initiallyVisible,
  animationFrames = true,
  documentEvents = true,
  throwCapture = false,
  runtimeAsFunction = false,
  registry = "full",
  sharedImageData = false,
} = {}) {
  const windowListeners = new Map();
  const documentListeners = new Map();
  const frames = [];
  const timers = [];
  const cancelled = [];
  const messages = [];
  const nativeFrames = new Map();
  const visibility = [];
  const lifecycle = [];
  const owned = [];
  const firstFrames = [];
  const canvases = [];
  const host = {
    children: [],
    appendChild(child) {
      this.children.push(child);
    },
    replaceChildren() {
      this.children = [];
    },
  };
  const runtime = {
    BoxedWineFrames:
      registry === "none"
        ? undefined
        : {
            read(id, generation) {
              const frame = nativeFrames.get(id);
              return frame?.generation === generation ? null : frame;
            },
            ...(registry === "full"
              ? {
                  setProcessVisible: (processId, visible) =>
                    visibility.push([processId, visible]),
                }
              : {}),
          },
    postMessage: (message, origin) => messages.push({ message, origin }),
  };
  globalThis.window = {
    addEventListener: (type, listener) => windowListeners.set(type, listener),
    removeEventListener: (type) => windowListeners.delete(type),
    ...(animationFrames
      ? {
          requestAnimationFrame: (callback) => frames.push(callback),
          cancelAnimationFrame: (id) => cancelled.push(id),
        }
      : {
          setTimeout: (callback) => timers.push(callback),
          clearTimeout: (id) => cancelled.push(id),
        }),
  };
  globalThis.document = {
    hidden: false,
    documentElement: { dataset: {} },
    ...(documentEvents
      ? {
          addEventListener: (type, listener) =>
            documentListeners.set(type, listener),
          removeEventListener: (type) => documentListeners.delete(type),
        }
      : {}),
    createElement() {
      const canvas = makeCanvas({ throwCapture });
      canvases.push(canvas);
      return canvas;
    },
  };
  let sharedBuffer;
  globalThis.ImageData = class {
    constructor(data, width, height) {
      if (sharedImageData && data.buffer === sharedBuffer)
        throw new TypeError("shared memory");
      Object.assign(this, { data, width, height });
    }
  };
  const surface = createBoxedWineWindowSurface({
    host,
    runtimeWindow: runtimeAsFunction ? () => runtime : runtime,
    origin: ORIGIN,
    ...(initiallyVisible === undefined ? {} : { initiallyVisible }),
    onFirstFrame: (detail) => firstFrames.push(detail),
    onLifecycle: (detail) => lifecycle.push(detail),
    onOwnedWindow: (detail) => owned.push(detail),
  });
  const send = (detail, overrides = {}) => {
    if (detail.type === "frame") {
      const generation = (nativeFrames.get(detail.id)?.generation || 0) + 1;
      const rgba = new Uint8ClampedArray(
        (detail.width || 4) * (detail.height || 4) * 4,
      );
      sharedBuffer = rgba.buffer;
      nativeFrames.set(detail.id, {
        generation,
        width: detail.width || 4,
        height: detail.height || 4,
        rgba,
      });
      detail = { ...detail, generation };
    }
    windowListeners.get("message")?.({
      source: runtime,
      origin: ORIGIN,
      data: { type: "boxedwine-native-window", window: detail },
      ...overrides,
    });
  };
  const flush = () => {
    while (frames.length || timers.length) (frames.shift() || timers.shift())();
  };
  return {
    surface,
    send,
    flush,
    host,
    runtime,
    messages,
    visibility,
    lifecycle,
    owned,
    firstFrames,
    canvases,
    nativeFrames,
    documentListeners,
    windowListeners,
    cancelled,
    timers,
  };
}

const topWindow = (id, extra = {}) => ({
  type: "created",
  id,
  parentId: 1,
  processId: 5,
  launchToken: 7,
  x: 50,
  y: 40,
  width: 300,
  height: 200,
  frameLeft: 4,
  frameTop: 30,
  frameRight: 4,
  frameBottom: 4,
  menuHeight: 20,
  clientWidth: 292,
  clientHeight: 146,
  win32Metrics: true,
  ...extra,
});

const mapWithFrame = (h, id, size = {}) => {
  h.send({ type: "mapped", id });
  h.send({ type: "frame", id, width: 300, height: 200, ...size });
  h.flush();
};

describe("BoxedWine window surface", () => {
  test("renders owned dialogs with their children and forwards dialog input", () => {
    const h = setup({ throwCapture: true });
    h.send({ type: "created", id: 1, parentId: 0 });
    h.send(topWindow(10));
    mapWithFrame(h, 10);
    h.send({
      type: "created",
      id: 20,
      ownerId: 10,
      processId: 5,
      dialog: true,
      title: "Open",
      x: 80,
      y: 70,
      width: 200,
      height: 120,
      frameLeft: 3,
      frameTop: 25,
      frameRight: 3,
      frameBottom: 3,
      win32Metrics: true,
    });
    mapWithFrame(h, 20, { width: 200, height: 120 });
    h.send({ type: "created", id: 21, parentId: 20, x: 5, y: 30 });
    mapWithFrame(h, 21, { width: 20, height: 20 });
    h.send({ type: "created", id: 22, ownerId: 20, x: 90, y: 100 });
    mapWithFrame(h, 22, { width: 20, height: 20 });
    h.send({ type: "created", id: 23, parentId: 20 });
    h.send({ type: "mapped", id: 23 });
    const target = { appendChild() {} };
    expect(h.surface.attach(10, target)).toBeTrue();
    h.flush();
    const shown = h.owned.find((entry) => entry.type === "shown");
    expect(shown).toMatchObject({ id: 20, topId: 10, title: "Open", x: 30 });
    const dialog = shown.canvas;
    expect(dialog.draws.length).toBeGreaterThanOrEqual(3);

    for (const type of [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
      "dblclick",
      "wheel",
      "keydown",
      "keyup",
      "contextmenu",
    ])
      dialog.dispatch(type, { code: "KeyA", key: "a", deltaY: 3 });
    dialog.captured = 1;
    dialog.dispatch("pointerup");
    expect(dialog.captured).toBeNull();
    const types = h.messages.map(({ message }) => message.type);
    expect(types).toContain("boxedwine-native-wheel");
    expect(types).toContain("boxedwine-native-key");
    const doubleClick = h.messages.find(
      ({ message }) => message.eventType === "dblclick",
    ).message;
    expect(doubleClick.windowId).toBe(20);
    expect(doubleClick.x).toBeGreaterThan(80);
    expect(doubleClick.y).toBeGreaterThan(95);

    expect(h.surface.getCanvas(20)).toBe(dialog);
    expect(h.surface.activate(20)).toBeTrue();
    h.send({ type: "unmapped", id: 20 });
    expect(h.owned.at(-1)).toMatchObject({ type: "hidden", id: 20 });
    h.send({ type: "mapped", id: 20 });
    h.surface.attach(10, target);
    h.send({ type: "destroyed", id: 20 });
    expect(h.owned.at(-1)).toMatchObject({ type: "hidden", id: 20, topId: 10 });
  });

  test("forwards top-level input in window coordinates", () => {
    const h = setup({ throwCapture: true, runtimeAsFunction: true });
    h.send({ type: "created", id: 1, parentId: 0 });
    h.send(topWindow(10));
    mapWithFrame(h, 10);
    const canvas = h.surface.getCanvas(10);
    for (const type of [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
      "dblclick",
      "wheel",
      "keydown",
      "keyup",
      "contextmenu",
    ])
      canvas.dispatch(type, { clientX: 500, clientY: -5, key: "b" });
    canvas.captured = 1;
    canvas.dispatch("pointercancel");
    expect(canvas.captured).toBeNull();
    const pointer = h.messages.find(
      ({ message }) => message.eventType === "mousedown",
    ).message;
    expect(pointer).toMatchObject({ windowId: 10, x: 350, y: 40 });
    h.surface.attach(10, { appendChild() {} });
    canvas.dispatch("wheel", { clientX: 0, clientY: 0 });
    expect(h.messages.at(-1).message.y).toBeCloseTo(50);
  });

  test("groups secondary process windows under the primary top-level canvas", () => {
    const h = setup();
    h.send({ type: "created", id: 1, parentId: 0 });
    h.send(topWindow(10));
    mapWithFrame(h, 10);
    h.send(topWindow(11, { x: 60, y: 60 }));
    mapWithFrame(h, 11, { width: 50, height: 50 });
    expect(h.lifecycle.at(-1).topId).toBe(10);
    expect(h.surface.getCanvas(11)).toBeNull();
    const canvas = h.surface.getCanvas(10);
    expect(canvas.draws.some(([, x, y]) => x === 10 && y === 20)).toBeTrue();
  });

  test("copies frames that cannot be wrapped and falls back to timers", () => {
    const h = setup({ sharedImageData: true, animationFrames: false });
    h.send({ type: "created", id: 1, parentId: 0 });
    h.send(topWindow(10));
    mapWithFrame(h, 10);
    expect(h.firstFrames).toHaveLength(1);
    h.send({ type: "frame", id: 10, width: 300, height: 200 });
    h.surface.dispose();
    expect(h.cancelled).toHaveLength(1);
  });

  test("skips uploads without a frame registry or new frame", () => {
    for (const registry of ["none", "read-only"]) {
      const h = setup({ registry });
      h.send({ type: "created", id: 1, parentId: 0 });
      h.send(topWindow(10));
      mapWithFrame(h, 10);
      h.send({ type: "frame", id: 10 });
      h.nativeFrames.delete(10);
      h.flush();
      h.surface.hide(10);
      h.surface.show(10);
    }
  });

  test("pauses uploads for hidden documents and resumes when visible", () => {
    const h = setup();
    h.send({ type: "created", id: 1, parentId: 0 });
    h.send(topWindow(10));
    mapWithFrame(h, 10);
    document.hidden = true;
    h.documentListeners.get("visibilitychange")();
    h.send({ type: "frame", id: 10 });
    h.flush();
    expect(h.visibility.at(-1)).toEqual([5, false]);
    document.hidden = false;
    h.documentListeners.get("visibilitychange")();
    h.flush();
    expect(h.visibility.at(-1)).toEqual([5, true]);
    h.surface.hide(10);
    h.send({ type: "frame", id: 10 });
    h.flush();
  });

  test("ignores foreign messages and unknown windows, and merges metadata", () => {
    const h = setup({ initiallyVisible: false, documentEvents: false });
    h.send({ type: "created", id: 10 }, { source: {} });
    h.send({ type: "created", id: 10 }, { origin: "https://evil.example" });
    h.windowListeners.get("message")({
      source: h.runtime,
      origin: ORIGIN,
      data: { type: "other" },
    });
    h.windowListeners.get("message")({
      source: h.runtime,
      origin: ORIGIN,
      data: { type: "boxedwine-native-window" },
    });
    h.send({ type: "created", id: "x" });
    h.send({ type: "mapped", id: 99 });
    expect(h.lifecycle).toHaveLength(0);

    h.send({ type: "created", id: 1, parentId: 0 });
    h.send({ type: "created", id: 10, parentId: 1 });
    h.send({
      type: "metadata",
      id: 10,
      ownerId: null,
      processId: 8,
      dialog: false,
      launchToken: -1,
      outerX: 5,
      outerY: 6,
      outerWidth: 120,
      outerHeight: 80,
    });
    h.send({ type: "bounds", id: 10, width: 100, height: 60 });
    h.send({ type: "bounds", id: 10, width: 0, height: 60 });
    h.send({ type: "title", id: 10, title: "Tool" });
    h.send({ type: "owner", id: 10, parentId: 1 });
    h.send({ type: "raised", id: 10 });
    h.send({ type: "mapped", id: 10 });
    expect(h.lifecycle.at(-1)).toMatchObject({
      processId: 8,
      launchToken: 4294967295,
      x: 5,
      clientWidth: 100,
      title: "Tool",
      ownerId: 1,
      dialog: false,
      win32Metrics: false,
    });
    expect(h.surface.getCanvas(10).hidden).toBeTrue();
    h.send({ type: "unmapped", id: 10 });
    expect(h.surface.getCanvas(10).hidden).toBeTrue();
    h.surface.dispose();
  });

  test("controls window visibility, commands, attachment, and removal", () => {
    const h = setup();
    expect(h.surface.show(10)).toBeFalse();
    expect(h.surface.activate(10)).toBeFalse();
    expect(h.surface.command(10, "close")).toBeFalse();
    expect(h.surface.attach(10, {})).toBeFalse();
    expect(h.surface.detach(10)).toBeFalse();
    expect(h.surface.remove(10)).toBeFalse();
    expect(h.surface.getCanvas(10)).toBeNull();

    h.send({ type: "created", id: 1, parentId: 0 });
    h.send(topWindow(10, { canMinimize: false, canMaximize: false }));
    expect(h.surface.show(10)).toBeFalse();
    expect(h.surface.activate(10)).toBeFalse();
    mapWithFrame(h, 10);
    expect(h.surface.command(10, "minimize")).toBeFalse();
    expect(h.surface.command(10, "maximize")).toBeFalse();
    expect(h.surface.command(10, "bounds", { width: 100, height: 50 })).toBe(
      true,
    );
    expect(h.messages.at(-1).message).toMatchObject({
      width: 108,
      height: 64,
    });
    h.send(topWindow(12, { processId: 6, canResize: false }));
    mapWithFrame(h, 12);
    h.surface.command(12, "restore");
    expect(h.messages.at(-1).message).toMatchObject({
      width: 300,
      height: 200,
    });
    expect(h.surface.attach(12, null)).toBeFalse();
    expect(
      h.surface.attach(12, { appendChild() {} }, { anchored: false }),
    ).toBe(true);
    expect(h.surface.detach(12)).toBeTrue();
    h.send({
      type: "created",
      id: 20,
      ownerId: 10,
      processId: 5,
      dialog: true,
      title: "Dialog",
      x: 60,
      y: 60,
      width: 80,
      height: 60,
      frameTop: 20,
      win32Metrics: true,
    });
    mapWithFrame(h, 20, { width: 80, height: 60 });
    h.surface.attach(10, { appendChild() {} });
    h.flush();
    h.send({ type: "destroyed", id: 99 });
    expect(h.surface.remove(10)).toBeTrue();
    expect(h.owned.at(-1)).toMatchObject({ type: "hidden", id: 20 });
    h.send(topWindow(30, { processId: 9 }));
    mapWithFrame(h, 30);
    h.send({
      type: "created",
      id: 31,
      ownerId: 30,
      processId: 9,
      dialog: true,
      title: "Reset",
      x: 60,
      y: 60,
      width: 80,
      height: 60,
      win32Metrics: true,
    });
    mapWithFrame(h, 31, { width: 80, height: 60 });
    h.surface.attach(30, { appendChild() {} });
    h.flush();
    h.send({ type: "frame", id: 30 });
    h.surface.dispose();
    expect(h.owned.at(-1)).toMatchObject({ type: "hidden", id: 31 });
  });

  test("handles windows without process, frame, or geometry details", () => {
    const h = setup();
    h.surface.hide(99);
    h.send({ type: "created", id: 1, parentId: 0 });
    h.send({
      type: "created",
      id: 10,
      parentId: 1,
      width: 40,
      height: 30,
      win32Metrics: true,
    });
    h.send({ type: "metadata", id: 10, win32Metrics: true });
    h.send({ type: "mapped", id: 10 });
    h.send({ type: "frame", id: 10, width: 40, height: 30 });
    h.flush();
    const canvas = h.surface.getCanvas(10);
    expect(canvas.dataset).toMatchObject({
      boxedwineParent: "1",
      boxedwineProcess: "0",
      boxedwineLaunchToken: "0",
    });
    expect(h.firstFrames[0]).toMatchObject({ processId: 0, launchToken: "0" });
    h.surface.hide(10);
    h.surface.show(10);
    h.flush();
    h.surface.dispose();
    expect(h.cancelled).toEqual([]);
  });
});
