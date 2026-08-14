// @ts-nocheck -- This test uses a minimal browser event contract.
import { describe, expect, test } from "bun:test";

import {
  createBoxedWineWindowSurface,
  installBoxedWineWindowBridge,
} from "../site/apps/core/boxedwine-window-bridge.js";

describe("BoxedWine window bridge", () => {
  test("forwards separate window frames and routes pointer input", () => {
    const listeners = new Map();
    const messages = [];
    const dispatched = [];
    const parent = {
      postMessage(message, origin, transfer) {
        messages.push({ message, origin, transfer });
      },
    };
    const canvas = {
      dispatchEvent(event) {
        dispatched.push(event);
      },
    };
    class InputEvent {
      constructor(type, options) {
        this.type = type;
        Object.assign(this, options);
      }
    }
    const hostWindow = {
      parent,
      location: { origin: "https://flash.example" },
      document: {
        documentElement: { dataset: {} },
        getElementById: () => canvas,
      },
      KeyboardEvent: InputEvent,
      MouseEvent: InputEvent,
      WheelEvent: InputEvent,
      dispatchEvent(event) {
        dispatched.push(event);
      },
      postMessage(message, origin) {
        messages.push({ message, origin });
      },
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
      removeEventListener(type) {
        listeners.delete(type);
      },
    };
    const activated = [];
    const commands = [];
    const keyEvents = [];
    const module = {
      _boxedwine_activate_window(id) {
        activated.push(id);
      },
      _boxedwine_window_command(...args) {
        commands.push(args);
      },
      _boxedwine_key_event(...args) {
        keyEvents.push(args);
      },
    };
    const dispose = installBoxedWineWindowBridge(hostWindow, module);
    const rgba = new Uint8ClampedArray([1, 2, 3, 255]);

    listeners.get("boxedwine-native-window")({
      detail: { type: "frame", id: 41, width: 1, height: 1, rgba },
    });
    expect(messages[0].message.window.id).toBe(41);
    expect(messages[0].transfer).toEqual([rgba.buffer]);

    listeners.get("message")({
      source: parent,
      origin: hostWindow.location.origin,
      data: {
        type: "boxedwine-native-pointer",
        windowId: 41,
        eventType: "mousedown",
        x: 25,
        y: 30,
        button: 0,
        buttons: 1,
      },
    });
    expect(dispatched[0]).toMatchObject({
      type: "mousedown",
      clientX: 25,
      clientY: 30,
      buttons: 1,
    });
    expect(activated).toEqual([41]);

    listeners.get("message")({
      source: parent,
      origin: hostWindow.location.origin,
      data: {
        type: "boxedwine-native-pointer",
        windowId: 41,
        eventType: "mousemove",
        x: 30,
        y: 35,
        buttons: 0,
      },
    });
    expect(activated).toEqual([41]);

    listeners.get("message")({
      source: parent,
      origin: hostWindow.location.origin,
      data: {
        type: "boxedwine-native-command",
        action: "activate",
        windowId: 41,
      },
    });
    expect(activated).toEqual([41, 41]);
    expect(commands).toEqual([[41, 0, 0, 0, 0, 0]]);
    expect(dispatched).toHaveLength(2);

    listeners.get("message")({
      source: parent,
      origin: hostWindow.location.origin,
      data: {
        type: "boxedwine-native-command",
        action: "maximize",
        appId: "solitaire",
        windowId: 41,
        width: 1280,
        height: 690,
        sourceWidth: 593,
        sourceHeight: 437,
      },
    });
    expect(messages.at(-1).message).toEqual({
      type: "boxedwine-framebuffer-resize",
      appId: "solitaire",
      width: 1280,
      height: 690,
      baseWidth: 593,
      baseHeight: 437,
    });
    expect(commands).toEqual([[41, 0, 0, 0, 0, 0]]);

    listeners.get("message")({
      source: parent,
      origin: hostWindow.location.origin,
      data: {
        type: "boxedwine-native-key",
        windowId: 41,
        eventType: "keydown",
        code: "KeyA",
        key: "a",
      },
    });
    expect(keyEvents).toEqual([[41, 4, 1]]);
    expect(activated).toEqual([41, 41, 41]);

    listeners.get("message")({
      source: parent,
      origin: hostWindow.location.origin,
      data: {
        type: "boxedwine-native-wheel",
        windowId: 41,
        x: 25,
        y: 30,
        deltaY: 120,
      },
    });
    expect(dispatched[2]).toMatchObject({
      type: "wheel",
      clientX: 25,
      clientY: 30,
      deltaY: 120,
    });
    expect(activated).toEqual([41, 41, 41]);

    dispose();
    expect(listeners.size).toBe(0);
  });

  test("composes native window lifecycles and routes captured input", () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalImageData = globalThis.ImageData;
    const windowListeners = new Map();
    const runtimeMessages = [];
    const lifecycle = [];
    const ownedWindows = [];
    const firstFrames = [];
    const canvases = [];

    const makeCanvas = () => {
      const listeners = new Map();
      const draws = [];
      const canvas = {
        dataset: {},
        style: {},
        hidden: false,
        width: 0,
        height: 0,
        parentElement: null,
        capturedPointer: null,
        addEventListener(type, listener) {
          listeners.set(type, listener);
        },
        appendChild(child) {
          child.parentElement = this;
        },
        dispatch(type, detail = {}) {
          listeners.get(type)?.({
            altKey: false,
            button: 0,
            buttons: 0,
            clientX: 0,
            clientY: 0,
            ctrlKey: false,
            detail: 0,
            metaKey: false,
            preventDefault() {},
            shiftKey: false,
            ...detail,
          });
        },
        focus() {
          this.focused = true;
        },
        getBoundingClientRect() {
          return { left: 20, top: 30, width: 130, height: 130 };
        },
        getContext() {
          return {
            clearRect() {},
            drawImage(...args) {
              draws.push(args);
            },
            putImageData() {},
          };
        },
        hasPointerCapture(pointerId) {
          return this.capturedPointer === pointerId;
        },
        releasePointerCapture() {
          this.capturedPointer = null;
        },
        remove() {
          this.removed = true;
          this.parentElement = null;
        },
        setPointerCapture(pointerId) {
          this.capturedPointer = pointerId;
        },
        listeners,
        draws,
      };
      canvases.push(canvas);
      return canvas;
    };
    const host = {
      children: [],
      appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
      },
      replaceChildren() {
        this.children = [];
      },
    };
    const target = {
      appendChild(child) {
        child.parentElement = this;
      },
    };
    const runtimeWindow = {
      postMessage(message, origin) {
        runtimeMessages.push({ message, origin });
      },
    };
    const fakeWindow = {
      addEventListener(type, listener) {
        windowListeners.set(type, listener);
      },
      removeEventListener(type) {
        windowListeners.delete(type);
      },
    };
    const fakeDocument = {
      documentElement: { dataset: {} },
      createElement(type) {
        if (type !== "canvas") throw new Error(`Unexpected element: ${type}`);
        return makeCanvas();
      },
    };
    class FakeImageData {
      constructor(data, width, height) {
        Object.assign(this, { data, width, height });
      }
    }

    Object.assign(globalThis, {
      window: fakeWindow,
      document: fakeDocument,
      ImageData: FakeImageData,
    });
    try {
      const surface = createBoxedWineWindowSurface({
        host,
        runtimeWindow,
        origin: "https://flash.example",
        initiallyVisible: false,
        onFirstFrame: (detail) => firstFrames.push(detail),
        onLifecycle: (detail) => lifecycle.push(detail),
        onOwnedWindow: (detail) => ownedWindows.push(detail),
      });
      const send = (window) =>
        windowListeners.get("message")({
          source: runtimeWindow,
          origin: "https://flash.example",
          data: { type: "boxedwine-native-window", window },
        });

      send({ type: "created", id: 1, parentId: 0, processId: 0 });
      send({
        type: "created",
        id: 41,
        parentId: 1,
        processId: 9,
        x: 100,
        y: 50,
        width: 260,
        height: 260,
      });
      send({ type: "title", id: 41, title: "Calculator" });
      send({ type: "mapped", id: 41 });
      expect(firstFrames).toHaveLength(0);
      send({
        type: "frame",
        id: 41,
        width: 260,
        height: 260,
        rgba: new Uint8ClampedArray(260 * 260 * 4),
      });
      expect(firstFrames).toHaveLength(1);
      expect(firstFrames[0]).toMatchObject({
        id: 41,
        processId: 9,
        title: "Calculator",
      });

      const canvas = surface.getCanvas(41);
      expect(canvas).toBeDefined();
      expect(canvas.hidden).toBeTrue();
      expect(surface.attach(41, target)).toBeTrue();
      expect(surface.show(41)).toBeTrue();
      expect(canvas.style.left).toBe("0px");
      expect(canvas.style.width).toBe("260px");
      expect(canvas.style.height).toBe("232px");
      expect(canvas.style.objectFit).toBe("none");
      expect(canvas.width).toBe(260);
      expect(canvas.height).toBe(232);
      expect(canvas.hidden).toBeFalse();

      send({
        type: "created",
        id: 42,
        parentId: 41,
        processId: 9,
        x: 12,
        y: 18,
        width: 80,
        height: 40,
      });
      send({ type: "mapped", id: 42 });
      send({
        type: "frame",
        id: 42,
        width: 80,
        height: 40,
        rgba: new Uint8ClampedArray(80 * 40 * 4),
      });
      send({
        type: "created",
        id: 43,
        parentId: 1,
        processId: 9,
        x: 4,
        y: 49,
        width: 100,
        height: 60,
      });
      send({ type: "owner", id: 43, parentId: 41 });
      send({ type: "mapped", id: 43 });
      send({
        type: "frame",
        id: 43,
        width: 100,
        height: 60,
        rgba: new Uint8ClampedArray(100 * 60 * 4),
      });
      expect(canvas.draws.length).toBeGreaterThanOrEqual(3);
      expect(
        canvas.draws.findLast(([drawn]) => drawn.width === 100)?.slice(1),
      ).toEqual([4, 21]);
      expect(
        lifecycle.find((event) => event.id === 43 && event.type === "owner"),
      ).toMatchObject({ topId: 41 });

      send({
        type: "created",
        id: 44,
        parentId: 1,
        processId: 9,
        x: 27,
        y: 101,
        width: 400,
        height: 336,
      });
      send({ type: "owner", id: 44, parentId: 41 });
      send({ type: "title", id: 44, title: "About Calculator" });
      send({ type: "mapped", id: 44 });
      send({
        type: "frame",
        id: 44,
        width: 400,
        height: 336,
        rgba: new Uint8ClampedArray(400 * 336 * 4),
      });
      const ownedWindow = ownedWindows.findLast(
        (event) => event.type === "shown" && event.id === 44,
      );
      expect(ownedWindow).toMatchObject({
        ownerId: 41,
        topId: 41,
        title: "About Calculator",
        x: 27,
        y: 101,
        width: 400,
        height: 336,
      });
      expect(ownedWindow.canvas).not.toBe(canvas);
      expect(ownedWindow.canvas.width).toBe(400);
      expect(ownedWindow.canvas.height).toBe(308);
      expect(canvas.draws.some(([drawn]) => drawn.width === 400)).toBeFalse();

      ownedWindow.canvas.dispatch("pointerdown", {
        pointerId: 8,
        buttons: 1,
        clientX: 85,
        clientY: 95,
      });
      expect(runtimeMessages.at(-1).message).toMatchObject({
        type: "boxedwine-native-pointer",
        windowId: 44,
        eventType: "mousedown",
      });

      canvas.dispatch("pointerdown", {
        pointerId: 7,
        buttons: 1,
        clientX: 85,
        clientY: 95,
      });
      expect(canvas.capturedPointer).toBe(7);
      expect(runtimeMessages.at(-1).message).toMatchObject({
        type: "boxedwine-native-pointer",
        windowId: 41,
        eventType: "mousedown",
        x: 230,
        y: 194,
      });
      canvas.dispatch("pointerup", {
        pointerId: 7,
        clientX: 85,
        clientY: 95,
      });
      expect(canvas.capturedPointer).toBeNull();
      canvas.dispatch("wheel", { clientX: 85, clientY: 95, deltaY: 120 });
      expect(runtimeMessages.at(-1).message).toMatchObject({
        type: "boxedwine-native-wheel",
        deltaY: 120,
      });
      canvas.dispatch("keydown", { code: "KeyA", key: "a" });
      expect(runtimeMessages.at(-1).message).toMatchObject({
        type: "boxedwine-native-key",
        eventType: "keydown",
        code: "KeyA",
      });

      send({ type: "unmapped", id: 44 });
      expect(ownedWindows.at(-1)).toMatchObject({
        type: "hidden",
        id: 44,
        topId: 41,
      });
      expect(ownedWindow.canvas.removed).toBeTrue();

      for (const action of [
        "activate",
        "minimize",
        "maximize",
        "restore",
        "bounds",
        "close",
      ]) {
        expect(
          surface.command(41, action, { width: 640, height: 480 }),
        ).toBeTrue();
        expect(runtimeMessages.at(-1).message.action).toBe(action);
      }

      send({ type: "unmapped", id: 41 });
      expect(canvas.hidden).toBeTrue();
      send({ type: "mapped", id: 41 });
      expect(lifecycle.map(({ type }) => type)).toContain("mapped");
      send({ type: "destroyed", id: 42 });
      expect(surface.getCanvas(41)).toBe(canvas);
      send({ type: "destroyed", id: 41 });
      expect(surface.getCanvas(41)).toBeNull();
      expect(canvas.removed).toBeTrue();
      surface.dispose();
      expect(windowListeners.size).toBe(0);
    } finally {
      Object.assign(globalThis, {
        window: originalWindow,
        document: originalDocument,
        ImageData: originalImageData,
      });
    }
  });
});
