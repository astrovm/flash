import { expect, test } from "bun:test";
import { Window } from "happy-dom";

test("Paint announces readiness only after image loading and menus exist", async () => {
  const window = new Window({
    url: "http://127.0.0.1/apps/paint/",
    settings: {
      enableJavaScriptEvaluation: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
    },
  });
  const callbacks: FrameRequestCallback[] = [];
  const messages: unknown[] = [];
  window.happyDOM.settings.enableJavaScriptEvaluation = true;
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callbacks.push(callback);
    return callbacks.length as never;
  }) as typeof window.requestAnimationFrame;
  window.postMessage = ((message: unknown) => {
    messages.push(message);
  }) as typeof window.postMessage;

  const source = await Bun.file(
    new URL("../site/apps/paint/integration.js", import.meta.url),
  ).text();
  Function("window", "document", source)(window, window.document);

  expect(messages).toEqual([]);
  expect(callbacks).toHaveLength(1);

  Object.assign(window, { open_from_file() {}, systemHooks: {} });
  const app = window.document.createElement("div");
  app.className = "jspaint";
  const menu = window.document.createElement("button");
  menu.className = "menu-button";
  menu.setAttribute("aria-label", "File");
  app.appendChild(menu);
  window.document.body.appendChild(app);
  callbacks.shift()!(0);

  expect(messages).toContainEqual({ type: "xp-paint-ready" });
  window.close();
});

test("Paint uses one custom scrollbar per axis and scrolls with its arrows", async () => {
  const window = new Window({
    url: "http://127.0.0.1/apps/paint/",
    settings: {
      enableJavaScriptEvaluation: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
    },
  });
  window.happyDOM.settings.enableJavaScriptEvaluation = true;
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0);
    return 1 as never;
  }) as typeof window.requestAnimationFrame;
  window.setInterval = (() =>
    1 as never) as unknown as typeof window.setInterval;
  Object.assign(window, {
    open_from_file() {},
    systemHooks: {},
    ResizeObserver: class {
      observe() {}
    },
  });

  window.document.body.innerHTML = `
    <div class="jspaint">
      <button class="menu-button" aria-label="File"></button>
      <div class="canvas-scroll-shell">
        <div class="canvas-area"><canvas class="main-canvas"></canvas></div>
      </div>
    </div>`;
  const viewport = window.document.querySelector(".canvas-area");
  if (!viewport) throw new Error("Test viewport was not created");
  Object.defineProperties(viewport, {
    clientWidth: { value: 100 },
    clientHeight: { value: 80 },
    scrollWidth: { value: 300 },
    scrollHeight: { value: 240 },
  });

  const source = await Bun.file(
    new URL("../site/apps/paint/integration.js", import.meta.url),
  ).text();
  Function(
    "window",
    "document",
    "ResizeObserver",
    source,
  )(window, window.document, window.ResizeObserver);

  expect(window.document.querySelectorAll(".xp-canvas-scrollbar")).toHaveLength(
    2,
  );
  expect(window.document.querySelectorAll(".xp-scroll-corner")).toHaveLength(1);
  (
    window.document.querySelector(".xp-scroll-right") as HTMLElement | null
  )?.click();
  (
    window.document.querySelector(".xp-scroll-down") as HTMLElement | null
  )?.click();
  expect(viewport.scrollLeft).toBe(16);
  expect(viewport.scrollTop).toBe(16);
  window.close();
});
