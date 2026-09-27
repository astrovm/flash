// @ts-nocheck -- Native runtime events are delivered through its actual iframe boundary.
import { afterEach, expect, test } from "bun:test";
import {
  cleanupShells,
  loadShell,
  login,
  flushShell,
} from "./helpers/shell-harness";
afterEach(cleanupShells);
async function setup() {
  const s = await login(await loadShell({ stubBoxedWineReadiness: false }));
  // Keep a real isolated iframe Window but replace native engine navigation with
  // about:blank. Tests explicitly deliver runtime events; no localhost fetches.
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
  s.document.getElementById("start-button").click();
  s.document.getElementById("all-programs-button").click();
  const flyouts = s.document.getElementById("start-menu-flyouts");
  flyouts.querySelector('[data-program-id="accessories"]').click();
  flyouts.querySelector('[data-program-id="calculator"]').click();
  const frame = s.document.querySelector(
    "iframe.boxedwine-shared-runtime-frame",
  );
  const requests = [];
  const capture = () =>
    Object.defineProperty(frame.contentWindow, "postMessage", {
      configurable: true,
      value: (message) => requests.push(message),
    });
  capture();
  const send = (data, options = {}) => {
    const event = new s.window.Event("message");
    Object.defineProperties(event, {
      data: { value: data },
      source: { value: options.source ?? frame.contentWindow },
      origin: { value: options.origin ?? s.window.location.origin },
    });
    s.window.dispatchEvent(event);
  };
  const token = () => new URL(frame.src).searchParams.get("launchToken");
  const state = () => s.document.documentElement.dataset;
  const app = () =>
    s.document.querySelector('.xp-window[data-game="__calculator"]');
  return { s, frame, requests, capture, send, token, state, app };
}
test("runtime ignores foreign messages and gives up after two startup recoveries", async () => {
  const h = await setup();
  const ready = h.s.window.XPBoxedWineRuntime.ready();
  const mounted = h.s.window.XPBoxedWineRuntime.applicationsReady();
  h.send(
    { type: "boxedwine-runtime-ready" },
    { origin: "https://untrusted.example" },
  );
  h.send({ type: "boxedwine-runtime-ready" }, { source: {} });
  expect(h.state().boxedwineRuntimeState).not.toBe("ready");
  for (let attempt = 1; attempt <= 2; attempt++) {
    const oldToken = h.token();
    h.send({
      type: "boxedwine-runtime-failed",
      reason: "synthetic startup failure",
    });
    expect(h.state().boxedwineRuntimeState).toBe("recovering");
    h.send({ type: "boxedwine-runtime-failed", reason: "duplicate" });
    expect(h.state().boxedwineRuntimeRecovery).toBe(
      `${attempt}:synthetic startup failure`,
    );
    await h.s.advanceTime(250);
    expect(h.token()).not.toBe(oldToken);
    h.capture();
  }
  h.send({ type: "boxedwine-runtime-failed" });
  expect(h.state().boxedwineRuntimeState).toBe("failed");
  expect(h.state().boxedwineRuntimeError).toBe("runtime-failed");
  await expect(ready).rejects.toThrow("did not start");
  await expect(mounted).rejects.toThrow("did not start");
});
test("closing an app while it launches terminates its late process and leaves the runtime idle on failure", async () => {
  const h = await setup();
  const launchToken = h.token();
  h.app().querySelector(".close-btn").click();
  await flushShell();
  h.send({
    type: "boxedwine-process-launched",
    appId: "calculator",
    launchToken,
    processId: 77,
    error: 0,
  });
  expect(h.requests.at(-1)).toMatchObject({
    type: "boxedwine-terminate-process",
    appId: "calculator",
    processId: 77,
    launchToken,
  });
  h.send({
    type: "boxedwine-process-terminated",
    appId: "calculator",
    launchToken,
    processId: 77,
  });
  expect(h.state().boxedwineLastTermination).toBe("calculator:77");
  h.send({
    type: "boxedwine-runtime-failed",
    reason: "synthetic load failure",
  });
  expect(h.state().boxedwineRuntimeState).toBe("idle");
  expect(h.frame.src).toBe("about:blank");
});
test("three native launch errors restart the runtime instead of retrying forever", async () => {
  const h = await setup();
  h.send({ type: "boxedwine-runtime-ready" });
  await h.s.window.XPBoxedWineRuntime.ready();
  let launchToken = h.token();
  for (let failure = 1; failure <= 3; failure++) {
    h.send({
      type: "boxedwine-process-launched",
      appId: "calculator",
      launchToken,
      processId: 0,
      error: 5,
    });
    expect(h.state().boxedwineRuntimeError).toBe("launch:calculator:5");
    if (failure < 3) {
      await h.s.advanceTime(250);
      expect(h.requests.at(-1)).toMatchObject({
        type: "boxedwine-launch-process",
        appId: "calculator",
      });
      launchToken = h.requests.at(-1).launchToken;
    }
  }
  expect(h.state().boxedwineRuntimeState).toBe("recovering");
  await h.s.advanceTime(250);
  expect(h.token()).not.toBe(launchToken);
});
test("startup and first-frame deadlines trigger bounded runtime recovery", async () => {
  const h = await setup();
  await h.s.advanceTime(30000);
  expect(h.state().boxedwineRuntimeRecovery).toBe("1:startup-timeout");
  await h.s.advanceTime(250);
  h.capture();
  h.send({ type: "boxedwine-runtime-ready" });
  // A missing process remains mounted; the first-frame deadline is independent of boot.
  await h.s.advanceTime(120000);
  expect(h.state().boxedwineRuntimeRecovery).toBe(
    "2:application-warmup-timeout",
  );
});
