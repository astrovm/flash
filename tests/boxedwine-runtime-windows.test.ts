// @ts-nocheck -- Native runtime window events delivered through the real iframe boundary.
import { afterEach, expect, test } from "bun:test";
import {
  cleanupShells,
  flushShell,
  loadShell,
  login,
} from "./helpers/shell-harness";

afterEach(cleanupShells);

const settle = async (s, time = 20) => {
  await s.advanceTime(time);
  await flushShell();
};

async function setup({ beforeOpen = (_s) => {}, open = true } = {}) {
  const s = await login(await loadShell({ stubBoxedWineReadiness: false }));
  s.window.addEventListener(
    "error",
    (event) => {
      if (event.target?.tagName === "IFRAME") event.stopImmediatePropagation();
    },
    true,
  );
  const prototype = s.window.HTMLIFrameElement.prototype;
  const src = Object.getOwnPropertyDescriptor(prototype, "src");
  const requestedUrls = new WeakMap();
  Object.defineProperty(prototype, "src", {
    configurable: true,
    get() {
      return requestedUrls.get(this) ?? src.get.call(this);
    },
    set(value) {
      requestedUrls.set(this, value);
      src.set.call(this, "about:blank");
    },
  });
  s.window.ImageData ??= class {
    constructor(data, width, height) {
      Object.assign(this, { data, width, height });
    }
  };
  s.window.ResizeObserver = class {
    constructor(callback) {
      this.callback = callback;
      resizeObservers.push(this);
    }
    observe() {}
    disconnect() {
      this.disconnected = true;
    }
  };
  const resizeObservers = [];
  beforeOpen(s);
  if (open) {
    s.document.getElementById("start-button").click();
    s.document.getElementById("all-programs-button").click();
    const flyouts = s.document.getElementById("start-menu-flyouts");
    flyouts.querySelector('[data-program-id="accessories"]').click();
    flyouts.querySelector('[data-program-id="calculator"]').click();
  } else {
    s.window.XPBoxedWineRuntime.start();
  }
  const frame = s.document.querySelector(
    "iframe.boxedwine-shared-runtime-frame",
  );
  const requests = [];
  const nativeFrames = new Map();
  const capture = () => {
    Object.defineProperty(frame.contentWindow, "postMessage", {
      configurable: true,
      value: (message) => requests.push(message),
    });
    frame.contentWindow.BoxedWineFrames = {
      read(id, generation) {
        const native = nativeFrames.get(id);
        return native?.generation === generation ? null : native;
      },
      setProcessVisible() {},
    };
  };
  capture();
  const send = (data) => {
    const event = new s.window.Event("message");
    Object.defineProperties(event, {
      data: { value: data },
      source: { value: frame.contentWindow },
      origin: { value: s.window.location.origin },
    });
    s.window.dispatchEvent(event);
  };
  const native = (detail) => {
    if (detail.type === "frame") {
      const generation = (nativeFrames.get(detail.id)?.generation || 0) + 1;
      nativeFrames.set(detail.id, {
        generation,
        width: detail.width || 300,
        height: detail.height || 200,
        rgba: new Uint8ClampedArray(
          (detail.width || 300) * (detail.height || 200) * 4,
        ),
      });
      detail = { ...detail, generation };
    }
    send({ type: "boxedwine-native-window", window: detail });
  };
  const token = () => new URL(frame.src).searchParams.get("launchToken");
  const app = () =>
    s.document.querySelector('.xp-window[data-game="__calculator"]');
  return {
    s,
    frame,
    requests,
    send,
    native,
    token,
    app,
    capture,
    resizeObservers,
  };
}

const openWindow = async (h, id, launchToken, processId = 77, extra = {}) => {
  h.native({ type: "created", id: 1, parentId: 0 });
  h.native({
    type: "created",
    id,
    parentId: 1,
    processId,
    launchToken: Number(launchToken),
    x: 0,
    y: 0,
    width: 300,
    height: 200,
    frameTop: 30,
    clientWidth: 300,
    clientHeight: 170,
    win32Metrics: true,
    canMaximize: true,
    canMinimize: true,
    ...extra,
  });
  h.native({ type: "title", id, title: "Calculator" });
  h.native({ type: "mapped", id });
  h.native({ type: "frame", id });
  await settle(h.s);
};

test("the first native frame attaches to the shell window and native state drives it", async () => {
  const h = await setup();
  h.send({ type: "boxedwine-runtime-ready" });
  await h.s.window.XPBoxedWineRuntime.ready();
  const launchToken = h.token();
  h.send({
    type: "boxedwine-process-launched",
    appId: "calculator",
    launchToken,
    processId: 77,
    error: 0,
  });
  await openWindow(h, 10, launchToken);
  const win = h.app();
  expect(win.querySelector(".title-text").textContent).toBe("Calculator");
  const host = win.querySelector(".boxedwine-shared-app-host");
  expect(host.dataset.boxedwineReady).toBe("true");
  expect(host.querySelector("canvas")).toBeTruthy();
  expect(
    h.requests.some((request) => request.type === "boxedwine-observe-process"),
  ).toBeTrue();
  await h.s.window.XPBoxedWineRuntime.applicationsReady();

  h.native({
    type: "metadata",
    id: 10,
    win32Metrics: true,
    outerX: 0,
    outerY: 0,
    outerWidth: 320,
    outerHeight: 240,
    clientWidth: 300,
    clientHeight: 200,
    frameTop: 30,
    canMaximize: true,
  });
  h.native({ type: "focused", id: 10 });
  h.native({ type: "raised", id: 10 });
  h.native({ type: "unmapped", id: 10 });
  await settle(h.s, 150);
  expect(win.style.display).toBe("none");
  h.native({ type: "mapped", id: 10 });
  await settle(h.s);
  expect(win.style.display).not.toBe("none");

  h.native({
    type: "created",
    id: 20,
    ownerId: 10,
    processId: 77,
    dialog: true,
    title: "About Calculator",
    x: 20,
    y: 20,
    width: 200,
    height: 120,
    frameTop: 25,
    win32Metrics: true,
  });
  h.native({ type: "mapped", id: 20 });
  h.native({ type: "frame", id: 20, width: 200, height: 120 });
  await settle(h.s);
  expect(!!h.s.document.querySelector("[data-native-window-id]")).toBeTrue();
  h.native({ type: "destroyed", id: 20 });
  await settle(h.s);
  expect(!!h.s.document.querySelector("[data-native-window-id]")).toBeFalse();

  const content = () => win.querySelector(".boxedwine-shared-app-host");
  Object.defineProperties(content(), {
    clientWidth: { configurable: true, value: 300 },
    clientHeight: { configurable: true, value: 200 },
  });
  h.resizeObservers.at(-1).callback();
  await settle(h.s);
  win.querySelector(".maximize-btn").click();
  await settle(h.s);
  win.querySelector(".maximize-btn").click();
  await settle(h.s);
  const commands = h.requests.filter(
    (request) => request.type === "boxedwine-native-command",
  );
  expect(commands.map((request) => request.action)).toContain("maximize");

  h.native({ type: "destroyed", id: 10 });
  await settle(h.s);
  expect(content().textContent).toContain("Updating Windows application");
  await openWindow(h, 11, launchToken);
  expect(content().querySelector("canvas")).toBeTruthy();

  win.querySelector(".minimize-btn").click();
  await settle(h.s);
  h.s.document.querySelector('.task-button[data-game="__calculator"]')?.click();
  await settle(h.s);
  win.querySelector(".close-btn").click();
  await settle(h.s, 600);
  expect(
    h.requests.some(
      (request) =>
        request.type === "boxedwine-terminate-process" &&
        request.processId === 77,
    ),
  ).toBeTrue();
});

test("process exits close mounted windows or retry launches that never showed", async () => {
  const h = await setup();
  h.send({ type: "boxedwine-runtime-ready" });
  const launchToken = h.token();
  const launch = (processId) =>
    h.send({
      type: "boxedwine-process-launched",
      appId: "calculator",
      launchToken,
      processId,
      error: 0,
    });
  const exit = (processId) =>
    h.send({
      type: "boxedwine-process-exited",
      appId: "calculator",
      launchToken,
      processId,
    });
  launch(70);
  exit(70);
  expect(h.s.document.documentElement.dataset.boxedwineRuntimeError).toBe(
    "launch:calculator:process-exited",
  );
  await settle(h.s, 300);
  const retryToken = h.requests.at(-1).launchToken;
  h.send({
    type: "boxedwine-process-launched",
    appId: "calculator",
    launchToken: retryToken,
    processId: 71,
    error: 0,
  });
  await openWindow(h, 30, retryToken, 71);
  h.send({
    type: "boxedwine-process-exited",
    appId: "calculator",
    launchToken: retryToken,
    processId: 71,
  });
  await settle(h.s);
  expect(h.app()).toBeNull();
  h.send({
    type: "boxedwine-process-launched",
    appId: "solitaire",
    launchToken: "999",
    processId: 5,
    error: 0,
  });
});

const commandsFor = (h, action) =>
  h.requests.filter(
    (request) =>
      request.type === "boxedwine-native-command" && request.action === action,
  );

const launched = (h, launchToken, processId = 77) =>
  h.send({
    type: "boxedwine-process-launched",
    appId: "calculator",
    launchToken,
    processId,
    error: 0,
  });

test("starting the runtime without an open application boots Calculator from a slashless root", async () => {
  const h = await setup({
    open: false,
    beforeOpen: (s) => {
      s.window.ASTRO_GAME_ROOTS = {
        "boxedwine-runtime": "https://cdn.example/boxedwine",
      };
    },
  });
  const url = new URL(h.frame.src);
  expect(url.searchParams.get("executable")).toBe("calculator/calc.exe");
  expect(url.searchParams.get("appRoot")).toBe(
    "https://cdn.example/boxedwine/",
  );
  expect(h.app()).toBeNull();
  h.send({ type: "boxedwine-runtime-ready" });
  await h.s.window.XPBoxedWineRuntime.ready();
  expect(h.s.document.documentElement.dataset.boxedwineRuntimeState).toBe(
    "ready",
  );
});

test("launch tokens stay nonzero without crypto randomness or a usable clock", async () => {
  const now = Date.now;
  let h;
  try {
    h = await setup({
      beforeOpen: (s) => {
        Object.defineProperty(s.window, "crypto", {
          configurable: true,
          value: {},
        });
        Date.now = () => Number.NaN;
      },
    });
  } finally {
    Date.now = now;
  }
  expect(h.token()).toBe("1");
  h.send({ type: "boxedwine-runtime-ready" });
  h.send({
    type: "boxedwine-process-launched",
    appId: "calculator",
    launchToken: "1",
    processId: 0,
    error: 87,
  });
  await settle(h.s, 300);
  const retry = h.requests.at(-1);
  expect(retry.type).toBe("boxedwine-launch-process");
  expect(retry.launchToken).toMatch(/^[1-9]\d*$/);
  expect(retry.launchToken).not.toBe("1");
});

test("first frames from foreign launches, other processes, or closed applications never take over the shell window", async () => {
  const h = await setup();
  h.send({ type: "boxedwine-runtime-ready" });
  const launchToken = h.token();
  const host = () => h.app().querySelector(".boxedwine-shared-app-host");

  await openWindow(h, 9, "424242", 50);
  expect(host().querySelector("canvas")).toBeNull();

  await openWindow(h, 10, launchToken, 0);
  expect(host().querySelector("canvas").dataset.boxedwineWindow).toBe("10");
  expect(
    h.requests.some((request) => request.type === "boxedwine-observe-process"),
  ).toBeFalse();

  await openWindow(h, 12, launchToken, 99);
  expect(host().querySelector("canvas").dataset.boxedwineWindow).toBe("10");

  h.app().querySelector(".close-btn").click();
  await settle(h.s, 600);
  expect(h.app()).toBeNull();
  const terminations = () =>
    h.requests.filter(
      (request) => request.type === "boxedwine-terminate-process",
    );
  expect(terminations()).toEqual([]);

  await openWindow(h, 13, launchToken, 0);
  await openWindow(h, 14, launchToken, 88);
  expect(terminations().map((request) => request.processId)).toEqual([88]);
  expect(
    h.s.document.querySelector('canvas[data-boxedwine-window="14"]'),
  ).toBeNull();

  h.native({ type: "created", id: 15, parentId: 1, launchToken });
  h.native({ type: "destroyed", id: 15 });
  await settle(h.s);
  expect(h.app()).toBeNull();
});

test("closing a launching application discards its late launch failure", async () => {
  const h = await setup();
  h.send({ type: "boxedwine-runtime-ready" });
  const launchToken = h.token();
  h.app().querySelector(".close-btn").click();
  await settle(h.s, 600);
  const requestCount = h.requests.length;
  h.send({
    type: "boxedwine-process-launched",
    appId: "calculator",
    launchToken,
    processId: 0,
    error: 87,
  });
  await settle(h.s, 300);
  expect(h.s.document.documentElement.dataset.boxedwineRuntimeError).toBe(
    "launch:calculator:87",
  );
  expect(h.requests).toHaveLength(requestCount);
});

test("three processes exiting before their first frame restart the runtime", async () => {
  const h = await setup();
  h.send({ type: "boxedwine-runtime-ready" });
  let launchToken = h.token();
  for (const processId of [61, 62, 63]) {
    launched(h, launchToken, processId);
    h.send({
      type: "boxedwine-process-exited",
      appId: "calculator",
      launchToken,
      processId,
    });
    await settle(h.s, 300);
    launchToken = h.requests.at(-1).launchToken ?? h.token();
  }
  expect(h.s.document.documentElement.dataset.boxedwineRuntimeRecovery).toBe(
    "1:launch:calculator:process-exited",
  );
  expect(new URL(h.frame.src).searchParams.get("recovery")).toBe("1");
});

test("runtime recovery drops native dialogs and pending minimizes, then relaunches the application", async () => {
  const h = await setup();
  h.send({ type: "boxedwine-runtime-ready" });
  const launchToken = h.token();
  launched(h, launchToken);
  await openWindow(h, 10, launchToken);
  h.native({
    type: "created",
    id: 20,
    ownerId: 10,
    processId: 77,
    dialog: true,
    title: "About Calculator",
    x: 20,
    y: 20,
    width: 200,
    height: 120,
    frameTop: 25,
    win32Metrics: true,
  });
  h.native({ type: "mapped", id: 20 });
  h.native({ type: "frame", id: 20, width: 200, height: 120 });
  await settle(h.s);
  const dialog = h.s.document.querySelector('[data-native-window-id="20"]');
  dialog.querySelector(".close-btn").click();
  expect(commandsFor(h, "close").map((request) => request.windowId)).toEqual([
    20,
  ]);

  h.native({ type: "unmapped", id: 10 });
  h.send({ type: "boxedwine-runtime-failed", reason: "wasm-trap" });
  await settle(h.s, 150);
  expect(h.app().style.display).not.toBe("none");
  expect(h.s.document.querySelector("[data-native-window-id]")).toBeNull();
  expect(h.app().textContent).toContain("Restarting Windows application");

  await settle(h.s, 300);
  const relaunch = new URL(h.frame.src).searchParams;
  expect(relaunch.get("recovery")).toBe("1");
  expect(relaunch.get("launchToken")).not.toBe(launchToken);
  h.send({ type: "boxedwine-runtime-ready" });
  expect(h.s.document.documentElement.dataset.boxedwineRuntimeState).toBe(
    "ready",
  );
  await openWindow(h, 30, relaunch.get("launchToken"), 78);
  expect(
    h.app().querySelector(".boxedwine-shared-app-host canvas").dataset
      .boxedwineWindow,
  ).toBe("30");
});

test("repeated failures after startup mark the runtime failed without rejecting readiness", async () => {
  const h = await setup();
  h.send({ type: "boxedwine-runtime-ready" });
  const launchToken = h.token();
  launched(h, launchToken);
  await openWindow(h, 10, launchToken);
  await h.s.window.XPBoxedWineRuntime.applicationsReady();
  h.s.document.querySelector(".welcome-instruction")?.remove();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    h.send({ type: "boxedwine-runtime-failed", reason: "crash" });
    await settle(h.s, 300);
  }
  const dataset = h.s.document.documentElement.dataset;
  expect(dataset.boxedwineRuntimeState).toBe("failed");
  expect(dataset.boxedwineRuntimeError).toBe("crash");
  await h.s.window.XPBoxedWineRuntime.ready();
  await h.s.window.XPBoxedWineRuntime.applicationsReady();
});

test("native window state changes wait for native metadata and respect fixed windows", async () => {
  const h = await setup();
  h.send({ type: "boxedwine-runtime-ready" });
  const launchToken = h.token();
  const win = h.app();

  win.querySelector(".minimize-btn").click();
  await settle(h.s, 200);
  expect(win.style.display).not.toBe("none");

  launched(h, launchToken);
  await openWindow(h, 10, launchToken);
  const host = win.querySelector(".boxedwine-shared-app-host");
  Object.defineProperties(host, {
    clientWidth: { configurable: true, value: 300 },
    clientHeight: { configurable: true, value: 200 },
  });
  h.resizeObservers.at(-1).callback();
  await settle(h.s, 100);
  expect(commandsFor(h, "bounds")).toEqual([]);
  win.querySelector(".maximize-btn").click();
  await settle(h.s, 100);
  expect(win.classList.contains("maximized")).toBeTrue();
  expect(commandsFor(h, "maximize")).toEqual([]);

  h.native({
    type: "metadata",
    id: 10,
    win32Metrics: true,
    outerWidth: 320,
    outerHeight: 240,
    clientWidth: 300,
    clientHeight: 200,
    frameTop: 30,
    canMaximize: true,
  });
  await settle(h.s, 100);
  expect(commandsFor(h, "maximize")).toHaveLength(1);

  win.querySelector(".maximize-btn").click();
  await settle(h.s, 100);
  expect(win.classList.contains("maximized")).toBeFalse();
  expect(commandsFor(h, "restore")).toHaveLength(1);

  const handle = win.querySelector(".resize-handle");
  const pointer = (type) =>
    handle.dispatchEvent(
      new h.s.window.PointerEvent(type, {
        bubbles: true,
        button: 0,
        clientX: 10,
        clientY: 10,
      }),
    );
  pointer("pointerdown");
  pointer("pointerup");
  await settle(h.s, 100);
  expect(commandsFor(h, "bounds").length).toBeGreaterThan(0);

  h.native({
    type: "metadata",
    id: 10,
    win32Metrics: true,
    outerWidth: 320,
    outerHeight: 240,
    clientWidth: 300,
    clientHeight: 200,
    frameTop: 30,
    canMaximize: false,
  });
  await settle(h.s);
  win
    .querySelector(".title-bar")
    .dispatchEvent(new h.s.window.MouseEvent("dblclick", { bubbles: true }));
  await settle(h.s, 100);
  expect(win.classList.contains("maximized")).toBeFalse();
  expect(commandsFor(h, "maximize")).toHaveLength(1);
});

test("native minimizes are ignored for windows the shell never bound", async () => {
  const h = await setup();
  h.send({ type: "boxedwine-runtime-ready" });
  const launchToken = h.token();
  h.native({ type: "created", id: 1, parentId: 0 });
  h.native({
    type: "created",
    id: 10,
    parentId: 1,
    launchToken: Number(launchToken),
    width: 300,
    height: 200,
  });
  h.native({ type: "mapped", id: 10 });
  h.native({ type: "unmapped", id: 10 });
  await settle(h.s, 150);
  expect(h.app().style.display).not.toBe("none");
});

test("unknown applications are rejected before the shared runtime is created", async () => {
  const { Window } = await import("happy-dom");
  const page = new Window({ url: "https://flash.example/" });
  const globals = ["window", "document", "location"];
  const previous = globals.map((key) => globalThis[key]);
  Object.assign(globalThis, {
    window: page,
    document: page.document,
    location: page.location,
  });
  try {
    const { mountSharedBoxedWineApplication } =
      await import("../site/apps/core/boxedwine-runtime.js");
    expect(() => mountSharedBoxedWineApplication("bogus", {})).toThrow(
      "Unknown BoxedWine application: bogus",
    );
    expect(page.document.querySelector("iframe")).toBeNull();
    expect(page.XPBoxedWineRuntime).toBeDefined();
  } finally {
    globals.forEach((key, index) => {
      if (previous[index] === undefined) delete globalThis[key];
      else globalThis[key] = previous[index];
    });
    await page.happyDOM.close();
  }
});
