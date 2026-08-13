// @ts-nocheck -- This test uses a minimal browser event contract.
import { describe, expect, test } from "bun:test";

import { installBoxedWineWindowBridge } from "../site/apps/core/boxedwine-window-bridge.js";

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
    class MouseEvent {
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
      MouseEvent,
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
      removeEventListener(type) {
        listeners.delete(type);
      },
    };
    const activated = [];
    const module = {
      _boxedwine_activate_window(id) {
        activated.push(id);
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
      data: { type: "boxedwine-native-activate", windowId: 41 },
    });
    expect(activated).toEqual([41, 41]);
    expect(dispatched).toHaveLength(1);

    dispose();
    expect(listeners.size).toBe(0);
  });
});
