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

async function setup() {
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
  s.document.getElementById("start-button").click();
  s.document.getElementById("all-programs-button").click();
  const flyouts = s.document.getElementById("start-menu-flyouts");
  flyouts.querySelector('[data-program-id="accessories"]').click();
  flyouts.querySelector('[data-program-id="calculator"]').click();
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
