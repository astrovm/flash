// @ts-nocheck -- This test uses a minimal browser event contract.
import { describe, expect, test } from "bun:test";

import { installBoxedWineWindowBridge } from "../site/apps/core/boxedwine-window-bridge.js";
import { createBoxedWineWindowSurface } from "../site/apps/core/boxedwine-window-surface.js";

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
    const legacyPixels = new Uint8ClampedArray([1, 2, 3, 4]);
    listeners.get("boxedwine-native-window")({
      detail: {
        type: "frame",
        id: 41,
        width: 1,
        height: 1,
        generation: 1,
        rgba: legacyPixels,
      },
    });
    expect(messages[0].message.window.id).toBe(41);
    expect(messages[0].message.window).not.toHaveProperty("rgba");
    expect(messages[0].transfer).toEqual([]);
    listeners.get("boxedwine-native-window")({
      detail: {
        type: "metadata",
        lifecycleType: "mapped",
        id: 41,
        processId: 202,
        parentProcessId: 101,
        launchToken: 4242,
        outerWidth: 640,
        outerHeight: 480,
        clientWidth: 632,
        clientHeight: 444,
        frameLeft: 4,
        frameTop: 32,
        frameRight: 4,
        frameBottom: 4,
        canResize: true,
        canMaximize: true,
        canMinimize: true,
      },
    });
    expect(messages[1].message.window).toMatchObject({
      type: "metadata",
      processId: 202,
      parentProcessId: 101,
      launchToken: 4242,
      outerWidth: 640,
      clientHeight: 444,
      canResize: true,
    });

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

    const messagesBeforeMove = messages.length;
    listeners.get("message")({
      source: parent,
      origin: hostWindow.location.origin,
      data: {
        type: "boxedwine-native-command",
        action: "bounds",
        appId: "solitaire",
        windowId: 41,
        x: 300,
        y: 200,
        width: 593,
        height: 437,
        sourceWidth: 593,
        sourceHeight: 437,
      },
    });
    expect(messages).toHaveLength(messagesBeforeMove);
    expect(commands).toEqual([
      [41, 0, 0, 0, 0, 0],
      [41, 5, 300, 200, 593, 437],
    ]);

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
    expect(
      messages.some(
        (entry) => entry.message?.type === "boxedwine-framebuffer-resize",
      ),
    ).toBe(false);
    expect(commands).toEqual([
      [41, 0, 0, 0, 0, 0],
      [41, 5, 300, 200, 593, 437],
      [41, 3, 0, 0, 1280, 690],
    ]);

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
    const documentListeners = new Map();
    const runtimeMessages = [];
    const lifecycle = [];
    const ownedWindows = [];
    const firstFrames = [];
    const canvases = [];
    const nativeFrames = new Map();
    const frameSubscriptions = [];
    const animationFrames = [];
    let frameReads = 0;

    const makeCanvas = () => {
      const listeners = new Map();
      const draws = [];
      const canvas = {
        dataset: {},
        style: {},
        hidden: false,
        clears: 0,
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
            clearRect() {
              canvas.clears += 1;
            },
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
      BoxedWineFrames: {
        read(id, previousGeneration) {
          frameReads += 1;
          const frame = nativeFrames.get(id);
          return frame?.generation === previousGeneration ? null : frame;
        },
        setProcessVisible(processId, visible) {
          frameSubscriptions.push({ processId, visible });
        },
      },
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
      requestAnimationFrame(callback) {
        animationFrames.push(callback);
        return animationFrames.length;
      },
      cancelAnimationFrame() {},
    };
    const fakeDocument = {
      hidden: false,
      documentElement: { dataset: {} },
      addEventListener(type, listener) {
        documentListeners.set(type, listener);
      },
      removeEventListener(type) {
        documentListeners.delete(type);
      },
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
      const send = (window) => {
        if (window.type === "frame") {
          const generation = (nativeFrames.get(window.id)?.generation || 0) + 1;
          nativeFrames.set(window.id, {
            generation,
            width: window.width,
            height: window.height,
            rgba: window.rgba,
          });
          window = { ...window, generation };
          delete window.rgba;
        }
        windowListeners.get("message")({
          source: runtimeWindow,
          origin: "https://flash.example",
          data: { type: "boxedwine-native-window", window },
        });
      };
      const flushRenders = () => {
        while (animationFrames.length) animationFrames.shift()();
      };

      send({ type: "created", id: 1, parentId: 0, processId: 0 });
      send({
        type: "created",
        id: 41,
        parentId: 1,
        processId: 9,
        launchToken: 4242,
        x: 100,
        y: 50,
        width: 260,
        height: 260,
        frameTop: 28,
        clientWidth: 260,
        clientHeight: 232,
        canResize: false,
        canMaximize: false,
        canMinimize: true,
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
      flushRenders();
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

      send({
        type: "created",
        id: 51,
        parentId: 1,
        processId: 11,
        launchToken: 99,
        x: 0,
        y: 0,
        width: 260,
        height: 260,
        canMinimize: true,
        canMaximize: false,
        canResize: false,
      });
      send({ type: "title", id: 51, title: "Calculator" });
      send({ type: "mapped", id: 51 });
      send({
        type: "frame",
        id: 51,
        width: 260,
        height: 260,
        rgba: new Uint8ClampedArray(260 * 260 * 4),
      });
      flushRenders();
      expect(surface.attach(51, target)).toBeTrue();
      const cropped = surface.getCanvas(51);
      expect(cropped.width).toBe(260);
      expect(cropped.height).toBe(260);
      expect(cropped.dataset.boxedwineLaunchToken).toBe("99");

      send({
        type: "created",
        id: 52,
        parentId: 1,
        processId: 12,
        launchToken: -2020735226,
        x: 0,
        y: 0,
        width: 260,
        height: 260,
        canMinimize: true,
      });
      send({ type: "title", id: 52, title: "Solitaire" });
      send({ type: "mapped", id: 52 });
      send({
        type: "frame",
        id: 52,
        width: 260,
        height: 260,
        rgba: new Uint8ClampedArray(260 * 260 * 4),
      });
      flushRenders();
      expect(surface.getCanvas(52).dataset.boxedwineLaunchToken).toBe(
        "2274232070",
      );
      expect(canvas.width).toBe(260);
      expect(canvas.height).toBe(232);
      expect(canvas.hidden).toBeFalse();
      flushRenders();

      const readsBeforeCoalescing = frameReads;
      const clearsBeforeCoalescing = canvas.clears;
      send({
        type: "frame",
        id: 41,
        width: 260,
        height: 260,
        rgba: new Uint8ClampedArray(260 * 260 * 4),
      });
      send({
        type: "frame",
        id: 41,
        width: 260,
        height: 260,
        rgba: new Uint8ClampedArray(260 * 260 * 4),
      });
      expect(animationFrames).toHaveLength(1);
      flushRenders();
      expect(frameReads - readsBeforeCoalescing).toBe(1);
      expect(canvas.clears - clearsBeforeCoalescing).toBe(1);

      fakeDocument.hidden = true;
      documentListeners.get("visibilitychange")();
      const readsBeforeDocumentHiddenFrame = frameReads;
      send({
        type: "frame",
        id: 41,
        width: 260,
        height: 260,
        rgba: new Uint8ClampedArray(260 * 260 * 4),
      });
      flushRenders();
      expect(frameReads).toBe(readsBeforeDocumentHiddenFrame);
      fakeDocument.hidden = false;
      documentListeners.get("visibilitychange")();
      flushRenders();
      expect(frameReads).toBe(readsBeforeDocumentHiddenFrame + 1);
      expect(frameSubscriptions.at(-1)).toEqual({
        processId: 9,
        visible: true,
      });

      surface.hide(41);
      const readsBeforeHiddenFrame = frameReads;
      send({
        type: "frame",
        id: 41,
        width: 260,
        height: 260,
        rgba: new Uint8ClampedArray(260 * 260 * 4),
      });
      flushRenders();
      expect(frameReads).toBe(readsBeforeHiddenFrame);
      expect(frameSubscriptions.at(-1)).toEqual({
        processId: 9,
        visible: false,
      });
      expect(surface.show(41)).toBeTrue();
      flushRenders();
      expect(frameReads).toBe(readsBeforeHiddenFrame + 1);

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
      flushRenders();
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
      send({ type: "mapped", id: 43, dialog: true });
      send({
        type: "frame",
        id: 43,
        width: 100,
        height: 60,
        rgba: new Uint8ClampedArray(100 * 60 * 4),
      });
      flushRenders();
      expect(canvas.draws.length).toBeGreaterThanOrEqual(3);
      expect(
        canvas.draws.findLast(([drawn]) => drawn.width === 100)?.slice(1),
      ).toEqual([4, 21]);
      expect(
        lifecycle.find((event) => event.id === 43 && event.type === "owner"),
      ).toMatchObject({ topId: 41 });
      expect(ownedWindows.some((event) => event.id === 43)).toBeFalse();

      send({
        type: "created",
        id: 44,
        parentId: 1,
        processId: 9,
        x: 27,
        y: 101,
        width: 400,
        height: 336,
        frameTop: 28,
        clientWidth: 400,
        clientHeight: 308,
      });
      send({ type: "owner", id: 44, parentId: 41 });
      send({ type: "title", id: 44, title: "About Calculator" });
      send({ type: "mapped", id: 44, dialog: true });
      send({
        type: "frame",
        id: 44,
        width: 400,
        height: 336,
        rgba: new Uint8ClampedArray(400 * 336 * 4),
      });
      flushRenders();
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
        "restore",
        "bounds",
        "close",
      ]) {
        expect(
          surface.command(41, action, { width: 640, height: 480 }),
        ).toBeTrue();
        expect(runtimeMessages.at(-1).message.action).toBe(action);
      }
      expect(
        surface.command(41, "maximize", { width: 640, height: 480 }),
      ).toBeFalse();
      expect(runtimeMessages.at(-1).message.action).toBe("close");

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
