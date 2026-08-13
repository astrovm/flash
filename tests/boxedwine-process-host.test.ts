// @ts-nocheck -- This test uses a minimal browser and Emscripten FS contract.
import { describe, expect, test } from "bun:test";

import { installBoxedWineProcessHostBridge } from "../site/apps/core/boxedwine-process-host.js";

const createHost = () => {
  const messages = [];
  const listeners = new Map();
  const parent = {
    postMessage(message, origin) {
      messages.push({ message, origin });
    },
  };
  let interval;
  const hostWindow = {
    parent,
    location: { origin: "https://flash.example" },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
    setInterval(callback) {
      interval = callback;
      return 1;
    },
    clearInterval() {
      interval = undefined;
    },
  };
  return {
    hostWindow,
    messages,
    send(data) {
      listeners.get("message")({
        data,
        origin: hostWindow.location.origin,
        source: parent,
      });
    },
    tick() {
      interval?.();
    },
  };
};

const createModule = () => {
  const files = new Map();
  return {
    files,
    module: {
      preRun: [],
      FS: {
        readFile(path) {
          if (!files.has(path)) throw new Error("ENOENT");
          return files.get(path);
        },
        writeFile(path, content) {
          files.set(path, content);
        },
        rename(from, to) {
          files.set(to, files.get(from));
          files.delete(from);
        },
        unlink(path) {
          if (!files.delete(path)) throw new Error("ENOENT");
        },
      },
    },
  };
};

describe("persistent BoxedWine process host", () => {
  test("launches two original applications through one initialized runtime", () => {
    const host = createHost();
    const { files, module } = createModule();
    const dispose = installBoxedWineProcessHostBridge(host.hostWindow, module);

    for (const preRun of module.preRun) preRun();
    expect(files.get("/d_drive/boxedwine-launch.txt")).toBe("");
    module.onRuntimeInitialized();
    files.set("/d_drive/boxedwine-runtime-ready.txt", "ready");
    host.tick();
    expect(host.messages.at(-1).message).toEqual({
      type: "boxedwine-runtime-ready",
    });

    host.send({
      type: "boxedwine-launch-process",
      appId: "calculator",
      requestId: "first",
    });
    expect(files.get("/d_drive/boxedwine-launch.txt")).toBe(
      "1\nC:\\files\\calculator\\calc.exe\n",
    );
    files.set("/d_drive/boxedwine-launch-result.txt", "1 101 0");
    host.tick();

    host.send({
      type: "boxedwine-launch-process",
      appId: "solitaire",
      requestId: "second",
    });
    expect(files.get("/d_drive/boxedwine-launch.txt")).toBe(
      "2\nC:\\files\\solitaire\\sol.exe\n",
    );
    files.set("/d_drive/boxedwine-launch-result.txt", "2 102 0");
    host.tick();

    expect(
      host.messages
        .map(({ message }) => message)
        .filter(({ type }) => type === "boxedwine-process-launched"),
    ).toEqual([
      {
        type: "boxedwine-process-launched",
        appId: "calculator",
        requestId: "first",
        processId: 101,
        error: 0,
      },
      {
        type: "boxedwine-process-launched",
        appId: "solitaire",
        requestId: "second",
        processId: 102,
        error: 0,
      },
    ]);
    dispose();
  });

  test("rejects unknown applications", () => {
    const host = createHost();
    const { files, module } = createModule();
    installBoxedWineProcessHostBridge(host.hostWindow, module);
    for (const preRun of module.preRun) preRun();
    module.onRuntimeInitialized();
    files.set("/d_drive/boxedwine-runtime-ready.txt", "ready");
    host.tick();

    host.send({
      type: "boxedwine-launch-process",
      appId: "unknown.exe",
      requestId: "bad",
    });
    expect(files.get("/d_drive/boxedwine-launch.txt")).toBe("");
  });
});
