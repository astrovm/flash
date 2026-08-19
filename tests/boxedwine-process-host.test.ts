// @ts-nocheck -- This test uses a minimal browser and Emscripten contract.
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
    document: { documentElement: { dataset: {} } },
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
  let launchResult = 0;
  const running = new Set();
  const launchedExecutables = [];
  const module = {
    _boxedwine_install_bridge_api() {
      module.boxedwineExpectExec = () => 1;
      module.boxedwineLaunchProcess = (executable, launchToken) => {
        launchedExecutables.push({ executable, launchToken });
        return executable.endsWith(".exe");
      };
    },
    _boxedwine_launch_result() {
      const result = launchResult;
      launchResult = 0;
      return result;
    },
    _boxedwine_process_running(processId) {
      return running.has(processId);
    },
    _boxedwine_terminate_process(processId) {
      return running.delete(processId);
    },
  };
  return {
    running,
    launchedExecutables,
    setLaunchResult(processId) {
      launchResult = processId;
      if (processId) running.add(processId);
    },
    module,
  };
};

describe("persistent BoxedWine process host", () => {
  test("launches two original applications through one initialized runtime", () => {
    const host = createHost();
    const processHost = createModule();
    installBoxedWineProcessHostBridge(host.hostWindow, processHost.module);
    processHost.module.onRuntimeInitialized();
    expect(host.messages.at(-1).message).toEqual({
      type: "boxedwine-runtime-ready",
    });

    host.send({
      type: "boxedwine-launch-process",
      appId: "calculator",
      launchToken: "1011",
      requestId: "first",
    });
    processHost.setLaunchResult(101);
    host.tick();
    host.send({
      type: "boxedwine-launch-process",
      appId: "solitaire",
      launchToken: "2022",
      requestId: "second",
    });
    processHost.setLaunchResult(102);
    host.tick();

    expect(processHost.launchedExecutables).toEqual([
      {
        executable: "calculator/resize-host.exe",
        launchToken: "1011",
      },
      {
        executable: "solitaire/resize-host.exe",
        launchToken: "2022",
      },
    ]);

    expect(
      host.messages
        .map(({ message }) => message)
        .filter(({ type }) => type === "boxedwine-process-launched"),
    ).toEqual([
      {
        type: "boxedwine-process-launched",
        appId: "calculator",
        launchToken: "1011",
        requestId: "first",
        processId: 101,
        error: 0,
      },
      {
        type: "boxedwine-process-launched",
        appId: "solitaire",
        launchToken: "2022",
        requestId: "second",
        processId: 102,
        error: 0,
      },
    ]);
  });

  test("terminates a launched process through BoxedWine", () => {
    const host = createHost();
    const processHost = createModule();
    installBoxedWineProcessHostBridge(host.hostWindow, processHost.module);
    processHost.module.onRuntimeInitialized();
    processHost.setLaunchResult(101);
    host.send({
      type: "boxedwine-launch-process",
      appId: "calculator",
      launchToken: "1011",
      requestId: "launch",
    });
    host.tick();
    host.send({
      type: "boxedwine-terminate-process",
      appId: "calculator",
      launchToken: "1011",
      processId: 101,
      requestId: "close",
    });
    expect(host.messages.at(-1).message).toEqual({
      type: "boxedwine-process-terminated",
      appId: "calculator",
      launchToken: "1011",
      requestId: "close",
      processId: 101,
      error: 0,
    });
  });

  test("observes the initial process and reports when it exits", () => {
    const host = createHost();
    const processHost = createModule();
    installBoxedWineProcessHostBridge(host.hostWindow, processHost.module);
    processHost.module.onRuntimeInitialized();
    processHost.running.add(101);

    host.send({
      type: "boxedwine-observe-process",
      appId: "calculator",
      launchToken: "1011",
      processId: 101,
      requestId: "observe",
    });
    expect(host.messages.at(-1).message).toEqual({
      type: "boxedwine-process-observed",
      appId: "calculator",
      launchToken: "1011",
      requestId: "observe",
      processId: 101,
    });

    processHost.running.delete(101);
    host.tick();
    expect(host.messages.at(-1).message).toEqual({
      type: "boxedwine-process-exited",
      appId: "calculator",
      launchToken: "1011",
      processId: 101,
    });
  });

  test("rejects unknown applications", () => {
    const host = createHost();
    const processHost = createModule();
    installBoxedWineProcessHostBridge(host.hostWindow, processHost.module);
    processHost.module.onRuntimeInitialized();
    const count = host.messages.length;
    host.send({
      type: "boxedwine-launch-process",
      appId: "unknown.exe",
      launchToken: "3033",
      requestId: "bad",
    });
    expect(host.messages).toHaveLength(count);
  });
});
