import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import catalogWorker from "../worker/catalog-worker";
import {
  RETIRED_SERVICE_WORKER,
  handleLegacyRequest,
} from "../worker/legacy-domain";

const moveScript = readFileSync(
  new URL("../worker/domain-move.js", import.meta.url),
  "utf8",
);

const pageLoad = (url: string, init: RequestInit = {}) =>
  new Request(url, {
    ...init,
    headers: { "Sec-Fetch-Dest": "document", "Sec-Fetch-Mode": "navigate" },
  });

describe("old domain", () => {
  test("page loads get the move page", async () => {
    const response = await catalogWorker.fetch(
      pageLoad("https://flash.4st.li/?game=sonic"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "frame-src https://xp.4st.li; frame-ancestors 'none'",
    );
    const html = await response.text();
    expect(html).toContain(moveScript);
    expect(html).toContain('targetOrigin: "https://xp.4st.li"');
    expect(html).toContain('importPath: "/api/import"');
    expect(html).toContain('<meta name="robots" content="noindex" />');
  });

  test("the inlined script can't close its own script tag", () => {
    expect(moveScript).not.toContain("</script");
  });

  test("everything else is redirected to the same path", async () => {
    for (const request of [
      new Request("https://flash.4st.li/js/main.js?v=2"),
      new Request("http://flash.4st.li/js/main.js?v=2"),
      pageLoad("https://flash.4st.li/js/main.js?v=2", { method: "HEAD" }),
    ]) {
      const response = await catalogWorker.fetch(request);
      expect(response.status).toBe(308);
      expect(response.headers.get("Location")).toBe(
        "https://xp.4st.li/js/main.js?v=2",
      );
    }
    const api = handleLegacyRequest(
      new Request("https://flash.4st.li/api/games?q=sonic"),
    );
    expect(api.headers.get("Location")).toBe(
      "https://xp.4st.li/api/games?q=sonic",
    );
  });

  test("service worker updates retire the old offline shell", async () => {
    for (const path of ["/sw.js", "/sw.26.10.01-abcdef1.js"]) {
      const response = handleLegacyRequest(
        new Request(`https://flash.4st.li${path}`),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe(
        "text/javascript; charset=utf-8",
      );
      expect(await response.text()).toBe(RETIRED_SERVICE_WORKER);
    }
    for (const path of ["/js/sw.js", "/sw.json", "/swap.js"]) {
      const response = handleLegacyRequest(
        new Request(`https://flash.4st.li${path}`),
      );
      expect(response.status).toBe(308);
    }
  });

  test("the retired service worker removes itself and reloads its tabs", async () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const navigated: string[] = [];
    let skipped = false;
    let unregistered = false;
    const self = {
      addEventListener: (type: string, listener: (event: unknown) => void) =>
        listeners.set(type, listener),
      skipWaiting: () => {
        skipped = true;
      },
      registration: {
        unregister: async () => {
          unregistered = true;
          return true;
        },
      },
      clients: {
        matchAll: async (options: unknown) => {
          expect(options).toEqual({ type: "window" });
          return ["https://flash.4st.li/", "https://flash.4st.li/?a=1"].map(
            (url) => ({
              url,
              navigate: async (target: string) => navigated.push(target),
            }),
          );
        },
      },
    };
    new Function("self", RETIRED_SERVICE_WORKER)(self);
    listeners.get("install")!({});
    expect(skipped).toBe(true);
    let work: Promise<unknown> = Promise.resolve();
    listeners.get("activate")!({
      waitUntil: (promise: Promise<unknown>) => {
        work = promise;
      },
    });
    await work;
    expect(unregistered).toBe(true);
    expect(navigated).toEqual([
      "https://flash.4st.li/",
      "https://flash.4st.li/?a=1",
    ]);
  });
});

describe("new domain", () => {
  test("serves the import frame only to the old domain", async () => {
    const response = await catalogWorker.fetch(
      new Request("https://xp.4st.li/api/import"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors https://flash.4st.li",
    );
    const html = await response.text();
    expect(html).toContain(moveScript);
    expect(html).toContain('sourceOrigin: "https://flash.4st.li"');
  });
});
