import { expect, test } from "bun:test";
import { Window } from "happy-dom";

test("Paint announces readiness only after image loading and menus exist", async () => {
  const window = new Window({
    url: "http://127.0.0.1/vendor/jspaint/",
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
    new URL("../site/vendor/jspaint/xp-integration.js", import.meta.url),
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
