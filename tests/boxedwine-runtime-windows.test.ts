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

async function setup({
  beforeOpen = (_s) => {},
  open = true,
  initialStorage = {},
} = {}) {
  const s = await login(
    await loadShell({ stubBoxedWineReadiness: false, initialStorage }),
  );
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

const openDialog = (h, id, extra = {}) => {
  h.native({
    type: "created",
    id,
    ownerId: 10,
    processId: 77,
    dialog: true,
    title: `Dialog ${id}`,
    x: 20,
    y: 20,
    width: 200,
    height: 120,
    frameTop: 25,
    win32Metrics: true,
    ...extra,
  });
  h.native({ type: "mapped", id });
  h.native({ type: "frame", id, width: 200, height: 120 });
};

test("native dialogs keep the focused dialog when another closes and only drag with the primary button", async () => {
  const h = await setup();
  h.send({ type: "boxedwine-runtime-ready" });
  const launchToken = h.token();
  launched(h, launchToken);
  await openWindow(h, 10, launchToken);
  openDialog(h, 20, { x: 0, y: 0 });
  await settle(h.s);
  openDialog(h, 21);
  await settle(h.s);
  const dialog = (id) =>
    h.s.document.querySelector(`[data-native-window-id="${id}"]`);
  const first = dialog(20);
  expect(dialog(21).classList.contains("active")).toBeTrue();
  first.dispatchEvent(
    new h.s.window.PointerEvent("pointerdown", { bubbles: true }),
  );
  expect(first.classList.contains("active")).toBeTrue();

  h.native({ type: "destroyed", id: 21 });
  await settle(h.s);
  expect(dialog(21)).toBeNull();
  expect(first.classList.contains("active")).toBeTrue();

  h.native({ type: "title", id: 20, title: "Renamed" });
  h.native({ type: "frame", id: 20, width: 200, height: 120 });
  await settle(h.s);
  expect(dialog(20)).toBe(first);
  expect(first.querySelector(".title-text").textContent).toBe("Renamed");

  const bar = first.querySelector(".title-bar");
  const { left, top } = first.style;
  const pointer = (type, init) =>
    bar.dispatchEvent(
      new h.s.window.PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  pointer("pointerdown", { button: 2, clientX: 10, clientY: 10 });
  pointer("pointermove", { clientX: 80, clientY: 60 });
  expect([first.style.left, first.style.top]).toEqual([left, top]);
  first.querySelector(".close-btn").dispatchEvent(
    new h.s.window.PointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      clientX: 10,
      clientY: 10,
    }),
  );
  pointer("pointermove", { clientX: 80, clientY: 60 });
  expect([first.style.left, first.style.top]).toEqual([left, top]);
});

const metadata = (h, client, extra = {}) =>
  h.native({
    type: "metadata",
    id: 10,
    win32Metrics: true,
    frameTop: 30,
    canMaximize: true,
    clientWidth: client.width,
    clientHeight: client.height,
    ...extra,
  });

const openMeasuredWindow = async () => {
  const h = await setup();
  h.send({ type: "boxedwine-runtime-ready" });
  const launchToken = h.token();
  launched(h, launchToken);
  await openWindow(h, 10, launchToken);
  const win = h.app();
  const host = win.querySelector(".boxedwine-shared-app-host");
  Object.defineProperties(host, {
    clientWidth: { configurable: true, value: 300 },
    clientHeight: { configurable: true, value: 200 },
  });
  return { h, win, size: () => [win.style.width, win.style.height] };
};

test("native metadata without usable bounds leaves the shell frame alone", async () => {
  const { h, size } = await openMeasuredWindow();
  const before = size();
  metadata(h, { width: 0, height: 0 }, { width: 0, height: 0 });
  await settle(h.s);
  expect(size()).toEqual(before);
});

test("stale native size echoes are ignored until the pending resize expires", async () => {
  const { h, size } = await openMeasuredWindow();
  metadata(h, { width: 900, height: 600 });
  await settle(h.s);
  const requested = size();
  metadata(h, { width: 640, height: 480 });
  await settle(h.s);
  expect(size()).toEqual(requested);

  const performance = h.s.window.performance;
  const now = performance.now.bind(performance);
  performance.now = () => now() + 5000;
  try {
    metadata(h, { width: 640, height: 480 });
    await settle(h.s);
  } finally {
    performance.now = now;
  }
  expect(size()[0]).toBe("640px");
});

test("native size echoes during a frame resize drag do not resize the frame", async () => {
  const { h, win, size } = await openMeasuredWindow();
  metadata(h, { width: 900, height: 600 });
  await settle(h.s);
  const [width, height] = size().map((value) => parseFloat(value));
  metadata(h, { width, height: height - 28 });
  await settle(h.s);
  const handle = win.querySelector(".resize-handle");
  handle.dispatchEvent(
    new h.s.window.PointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      clientX: 10,
      clientY: 10,
    }),
  );
  const during = size();
  metadata(h, { width: 500, height: 400 });
  await settle(h.s);
  expect(size()).toEqual(during);
  handle.dispatchEvent(
    new h.s.window.PointerEvent("pointerup", {
      bubbles: true,
      clientX: 10,
      clientY: 10,
    }),
  );
});

test("native windows larger than the work area keep asking for their preferred size", async () => {
  const { h, win } = await openMeasuredWindow();
  metadata(h, { width: 1500, height: 1000 });
  await settle(h.s);
  expect(parseFloat(win.style.width)).toBeLessThan(1500);
  h.requests.length = 0;
  h.resizeObservers.at(-1).callback();
  await settle(h.s);
  const bounds = commandsFor(h, "bounds").at(-1);
  expect(bounds.width).toBe(1500);
});

test("a minimized native window that disappears stays minimized until it returns", async () => {
  const h = await setup();
  h.send({ type: "boxedwine-runtime-ready" });
  const launchToken = h.token();
  launched(h, launchToken);
  await openWindow(h, 10, launchToken);
  const win = h.app();
  win.querySelector(".minimize-btn").click();
  await settle(h.s, 200);
  expect(win.style.display).toBe("none");
  h.native({ type: "unmapped", id: 10 });
  await settle(h.s, 150);
  expect(win.style.display).toBe("none");

  h.native({ type: "destroyed", id: 10 });
  await settle(h.s);
  Object.defineProperty(
    h.s.document.getElementById("task-buttons"),
    "clientWidth",
    { value: 330 },
  );
  h.s.window.dispatchEvent(new h.s.window.Event("resize"));
  await settle(h.s);
  h.s.document.querySelector('.task-button[data-game="__calculator"]').click();
  await settle(h.s, 200);
  expect(win.style.display).toBe("none");

  await openWindow(h, 11, launchToken);
  await settle(h.s, 200);
  expect(win.style.display).not.toBe("none");
});

const setViewport = (s, width, height) => {
  for (const [name, value] of [
    ["innerWidth", width],
    ["innerHeight", height],
  ])
    Object.defineProperty(s.window, name, { configurable: true, value });
  const desktop = s.document.getElementById("desktop");
  Object.defineProperties(desktop, {
    clientWidth: { configurable: true, value: width },
    clientHeight: { configurable: true, value: height },
  });
};

test("native windows too large for the screen shrink to fit and regain their size when room returns", async () => {
  const { h, win } = await openMeasuredWindow();
  setViewport(h.s, 1024, 768);
  metadata(h, { width: 1500, height: 1000 });
  await settle(h.s);
  const fitted = parseFloat(win.style.width);
  expect(fitted).toBeLessThan(1500);
  setViewport(h.s, 1200, 900);
  h.s.window.dispatchEvent(new h.s.window.Event("resize"));
  await settle(h.s);
  expect(parseFloat(win.style.width)).toBeGreaterThan(fitted);
  expect(parseFloat(win.style.width)).toBeLessThan(1500);
  setViewport(h.s, 2400, 1800);
  h.s.window.dispatchEvent(new h.s.window.Event("resize"));
  await settle(h.s);
  expect(win.style.width).toBe("1500px");
});

test("native windows opened on a tiny screen fit before their metadata arrives", async () => {
  const h = await setup({ beforeOpen: (s) => setViewport(s, 320, 240) });
  const width = parseFloat(h.app().style.width);
  expect(width).toBeLessThanOrEqual(320);
  expect(width).toBeGreaterThan(0);
});

test("native windows are left alone while the browser has no visible area", async () => {
  const h = await setup({ beforeOpen: (s) => setViewport(s, 0, 0) });
  expect(h.app().style.width).toBe("640px");
});

test("a remembered native window position is kept while an unusable remembered size is not", async () => {
  const h = await setup({
    initialStorage: {
      windowPlacements: JSON.stringify({
        __calculator: { left: 40, top: 30, width: 50, height: 40 },
      }),
    },
  });
  h.send({ type: "boxedwine-runtime-ready" });
  const launchToken = h.token();
  launched(h, launchToken);
  await openWindow(h, 10, launchToken);
  metadata(h, { width: 300, height: 200 }, { canResize: false });
  await settle(h.s);
  const win = h.app();
  expect([win.style.left, win.style.top]).toEqual(["40px", "30px"]);
  expect(win.style.width).toBe("300px");
});

test("keyboard sizing and showing the desktop keep native windows in sync", async () => {
  const h = await setup();
  h.send({ type: "boxedwine-runtime-ready" });
  const launchToken = h.token();
  const win = h.app();
  launched(h, launchToken);
  await openWindow(h, 10, launchToken);
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
  const host = win.querySelector(".boxedwine-shared-app-host");
  Object.defineProperties(host, {
    clientWidth: { configurable: true, value: 300 },
    clientHeight: { configurable: true, value: 200 },
  });
  await settle(h.s, 100);

  const boundsBefore = commandsFor(h, "bounds").length;
  win.querySelector(".title-bar").dispatchEvent(
    new h.s.window.MouseEvent("contextmenu", {
      bubbles: true,
      clientX: 20,
      clientY: 10,
    }),
  );
  h.s.document
    .querySelector('#window-system-menu [data-command="size"]')
    .click();
  for (const key of ["ArrowRight", "Enter"]) {
    h.s.document.dispatchEvent(
      new h.s.window.KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      }),
    );
  }
  await settle(h.s, 100);
  expect(commandsFor(h, "bounds").length).toBeGreaterThan(boundsBefore);

  h.s.window.history.replaceState(null, "", "#");
  h.s.window.dispatchEvent(new h.s.window.HashChangeEvent("hashchange"));
  await settle(h.s, 100);
  expect(win.style.display).toBe("none");
  expect(commandsFor(h, "minimize")).toHaveLength(1);
});

test("closing an application while it launches keeps the warm runtime", async () => {
  const h = await setup();
  h.send({ type: "boxedwine-runtime-ready" });
  h.app().querySelector(".close-btn").click();
  await settle(h.s, 600);
  await settle(h.s, 121_000);
  expect(h.s.document.documentElement.dataset.boxedwineRuntimeState).not.toBe(
    "idle",
  );
});
