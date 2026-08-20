// @ts-nocheck -- This test uses a minimal browser and Emscripten contract.
import { describe, expect, test } from "bun:test";

import { installBoxedWineWindowControlBridge } from "../site/apps/core/boxedwine-window-control.js";

const stateBytes = (generation, records) => {
  const bytes = new Uint8Array(12 + records.length * 64);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x42575331, true);
  view.setUint32(4, generation, true);
  view.setUint32(8, records.length, true);
  records.forEach((record, index) => {
    const offset = 12 + index * 64;
    const values = [
      record.id,
      record.outerX,
      record.outerY,
      record.outerWidth,
      record.outerHeight,
      record.clientX,
      record.clientY,
      record.clientWidth,
      record.clientHeight,
      record.frameLeft,
      record.frameTop,
      record.frameRight,
      record.frameBottom,
      record.ownerId || 0,
      record.capabilities,
      record.menuHeight || 0,
    ];
    values.forEach((value, field) =>
      [1, 2, 5, 6].includes(field)
        ? view.setInt32(offset + field * 4, value, true)
        : view.setUint32(offset + field * 4, value, true),
    );
  });
  return bytes;
};

const createHarness = () => {
  const listeners = new Map();
  const files = new Map();
  const intervals = new Map();
  const parent = {};
  let nextInterval = 1;
  class CustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options.detail;
    }
  }
  const hostWindow = {
    parent,
    location: { origin: "https://flash.example" },
    CustomEvent,
    addEventListener(type, listener) {
      const entries = listeners.get(type) || [];
      entries.push(listener);
      listeners.set(type, entries);
    },
    removeEventListener(type, listener) {
      listeners.set(
        type,
        (listeners.get(type) || []).filter((entry) => entry !== listener),
      );
    },
    dispatchEvent(event) {
      for (const listener of listeners.get(event.type) || []) listener(event);
    },
    setInterval(callback) {
      const id = nextInterval++;
      intervals.set(id, callback);
      return id;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
  };
  const module = {
    FS: {
      writeFile(path, bytes) {
        files.set(path, new Uint8Array(bytes));
      },
      readFile(path) {
        if (!files.has(path)) throw new Error("missing file");
        return files.get(path);
      },
    },
  };
  return {
    hostWindow,
    module,
    files,
    emit(type, detail) {
      hostWindow.dispatchEvent(new CustomEvent(type, { detail }));
    },
    message(data) {
      let stopped = false;
      const event = {
        data,
        origin: hostWindow.location.origin,
        source: parent,
        stopImmediatePropagation() {
          stopped = true;
        },
      };
      for (const listener of listeners.get("message") || []) {
        listener(event);
        if (stopped) break;
      }
    },
    tick() {
      for (const callback of intervals.values()) callback();
    },
  };
};

describe("generic BoxedWine Win32 window control", () => {
  test("writes generic commands and reports Win32 frame metrics and capabilities", () => {
    const harness = createHarness();
    const received = [];
    harness.hostWindow.addEventListener("boxedwine-native-window", (event) =>
      received.push(event.detail),
    );
    const dispose = installBoxedWineWindowControlBridge(
      harness.hostWindow,
      harness.module,
    );
    let legacyCommands = 0;
    harness.hostWindow.addEventListener("message", () => {
      legacyCommands += 1;
    });
    harness.module.onRuntimeInitialized();

    harness.emit("boxedwine-native-window", {
      type: "mapped",
      id: 71,
      processId: 901,
      launchToken: 101,
      dialog: false,
    });
    harness.message({
      type: "boxedwine-native-command",
      action: "bounds",
      windowId: 71,
      x: 12,
      y: 34,
      width: 800,
      height: 600,
    });
    const command = new DataView(
      harness.files.get("/d_drive/boxedwine-window-control.in").buffer,
    );
    expect(
      Array.from({ length: 8 }, (_, index) =>
        command.getUint32(index * 4, true),
      ),
    ).toEqual([0x42574331, 1, 71, 5, 12, 34, 800, 600]);
    expect(legacyCommands).toBe(0);

    harness.files.set(
      "/d_drive/boxedwine-window-control.out",
      stateBytes(1, [
        {
          id: 71,
          outerX: 12,
          outerY: 34,
          outerWidth: 800,
          outerHeight: 600,
          clientX: 16,
          clientY: 62,
          clientWidth: 792,
          clientHeight: 568,
          frameLeft: 4,
          frameTop: 28,
          frameRight: 4,
          frameBottom: 4,
          capabilities: 7,
          menuHeight: 20,
        },
        {
          id: 72,
          outerX: 0,
          outerY: 0,
          outerWidth: 300,
          outerHeight: 200,
          clientX: 3,
          clientY: 24,
          clientWidth: 294,
          clientHeight: 173,
          frameLeft: 3,
          frameTop: 24,
          frameRight: 3,
          frameBottom: 3,
          capabilities: 0,
        },
      ]),
    );
    harness.emit("boxedwine-native-window", {
      type: "mapped",
      id: 72,
      processId: 902,
      launchToken: 202,
      dialog: true,
    });
    harness.tick();

    expect(received.at(-2)).toMatchObject({
      type: "metadata",
      id: 71,
      processId: 901,
      launchToken: 101,
      clientWidth: 792,
      clientHeight: 568,
      frameTop: 28,
      menuHeight: 20,
      canResize: true,
      canMaximize: true,
      canMinimize: true,
      win32Metrics: true,
    });
    expect(received.at(-1)).toMatchObject({
      type: "metadata",
      id: 72,
      dialog: true,
      canResize: false,
      canMaximize: false,
      canMinimize: false,
    });

    harness.emit("boxedwine-native-window", {
      type: "metadata",
      id: 71,
      outerWidth: 1,
      outerHeight: 1,
      win32Metrics: true,
    });
    harness.emit("boxedwine-native-window", {
      type: "bounds",
      id: 71,
      width: 1,
      height: 1,
    });
    harness.files.set(
      "/d_drive/boxedwine-window-control.out",
      stateBytes(2, [
        {
          id: 71,
          outerX: 12,
          outerY: 34,
          outerWidth: 800,
          outerHeight: 600,
          clientX: 16,
          clientY: 62,
          clientWidth: 792,
          clientHeight: 568,
          frameLeft: 4,
          frameTop: 28,
          frameRight: 4,
          frameBottom: 4,
          capabilities: 7,
        },
      ]),
    );
    harness.tick();
    expect(received.at(-1)).toMatchObject({
      id: 71,
      outerWidth: 800,
      outerHeight: 600,
      clientWidth: 792,
      clientHeight: 568,
      win32Metrics: true,
    });

    dispose();
    const before = received.length;
    harness.tick();
    expect(received).toHaveLength(before);
  });

  test("reports twenty independently owned windows through one runtime bridge", () => {
    const harness = createHarness();
    const reported = [];
    harness.hostWindow.addEventListener("boxedwine-native-window", (event) => {
      if (event.detail.win32Metrics) reported.push(event.detail);
    });
    installBoxedWineWindowControlBridge(harness.hostWindow, harness.module);
    harness.module.onRuntimeInitialized();

    const records = Array.from({ length: 20 }, (_, index) => {
      const id = 1000 + index;
      harness.emit("boxedwine-native-window", {
        type: "mapped",
        id,
        processId: 2000 + index,
        launchToken: 3000 + index,
        dialog: false,
      });
      return {
        id,
        outerX: index * 8,
        outerY: index * 6,
        outerWidth: 400 + index,
        outerHeight: 300 + index,
        clientX: index * 8 + 4,
        clientY: index * 6 + 28,
        clientWidth: 392 + index,
        clientHeight: 268 + index,
        frameLeft: 4,
        frameTop: 28,
        frameRight: 4,
        frameBottom: 4,
        capabilities: index % 2 ? 7 : 4,
      };
    });
    harness.files.set(
      "/d_drive/boxedwine-window-control.out",
      stateBytes(1, records),
    );
    harness.tick();

    expect(reported).toHaveLength(20);
    expect(new Set(reported.map(({ launchToken }) => launchToken)).size).toBe(
      20,
    );
    expect(reported[0]).toMatchObject({
      id: 1000,
      canResize: false,
      canMaximize: false,
      canMinimize: true,
    });
    expect(reported[19]).toMatchObject({
      id: 1019,
      canResize: true,
      canMaximize: true,
      canMinimize: true,
    });
  });
});
