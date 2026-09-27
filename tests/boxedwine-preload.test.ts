// @ts-nocheck -- The preloader only needs a small window contract.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const desktop = (overrides = {}) => ({
  navigator: { userAgent: "Mozilla/5.0 (X11; Linux x86_64)" },
  matchMedia: () => ({ matches: false }),
  document: { baseURI: "https://flash.example/releases/1/" },
  ...overrides,
});

let preload;
beforeAll(async () => {
  globalThis.window = desktop();
  preload = await import("../site/apps/core/boxedwine-preload.js");
});
afterAll(() => {
  delete globalThis.window;
});

describe("BoxedWine preloading", () => {
  test("detects constrained devices", () => {
    expect(preload.isConstrainedBoxedWineDevice()).toBeFalse();
    for (const hostWindow of [
      desktop({ navigator: { userAgent: "", connection: { saveData: true } } }),
      desktop({
        navigator: { userAgent: "", connection: { effectiveType: "slow-2g" } },
      }),
      desktop({ navigator: { userAgent: "", deviceMemory: 2 } }),
      desktop({
        navigator: { userAgent: "" },
        matchMedia: (query) => ({ matches: query.includes("600px") }),
      }),
      desktop({
        navigator: { userAgent: "" },
        matchMedia: (query) => ({ matches: query.includes("coarse") }),
      }),
      desktop({
        navigator: { userAgent: "", userAgentData: { mobile: true } },
      }),
      desktop({ navigator: { userAgent: "Mozilla/5.0 (iPhone)" } }),
    ])
      expect(preload.isConstrainedBoxedWineDevice(hostWindow)).toBeTrue();
    expect(
      preload.isConstrainedBoxedWineDevice(
        desktop({
          navigator: { userAgent: "", deviceMemory: 8 },
          matchMedia: undefined,
        }),
      ),
    ).toBeFalse();
  });

  test("downloads the runtime once and retries after failures", async () => {
    const requests = [];
    let manifest = () => new Response("missing", { status: 404 });
    let asset = () => new Response("bytes");
    const hostWindow = desktop({
      fetch: async (url) => {
        requests.push(url);
        return url.endsWith("preload.json") ? manifest() : asset();
      },
    });
    await expect(
      preload.preloadBoxedWineRuntime({ hostWindow }),
    ).rejects.toThrow("preload manifest unavailable");
    manifest = () => Response.json({ files: ["../escape.js"] });
    await expect(
      preload.preloadBoxedWineRuntime({ hostWindow }),
    ).rejects.toThrow("Invalid BoxedWine preload manifest");
    manifest = () => Response.json({ files: ["boxedwine.js"] });
    asset = () => new Response("missing", { status: 404 });
    await expect(
      preload.preloadBoxedWineRuntime({ hostWindow }),
    ).rejects.toThrow("preload asset unavailable");
    asset = () => new Response("bytes");
    const manifestRequests = () =>
      requests.filter((url) => url.endsWith("preload.json")).length;
    const before = manifestRequests();
    const [first, second] = await Promise.all([
      preload.preloadBoxedWineRuntime({ hostWindow }),
      preload.preloadBoxedWineRuntime({ hostWindow }),
    ]);
    expect([first, second]).toEqual([true, true]);
    expect(manifestRequests()).toBe(before + 1);
    expect(requests.at(-1)).toBe(
      "https://flash.example/releases/1/vendor/boxedwine/26R1/boxedwine.js",
    );
    expect(
      await preload.preloadBoxedWineRuntime({
        automatic: true,
        hostWindow: desktop({ navigator: { userAgent: "Android" } }),
      }),
    ).toBeFalse();
  });

  test("schedules automatic preloading when the browser is idle", () => {
    const scheduled = [];
    expect(
      preload.scheduleBoxedWinePreload(
        desktop({ navigator: { userAgent: "iPad" } }),
      ),
    ).toBeFalse();
    expect(
      preload.scheduleBoxedWinePreload(
        desktop({
          requestIdleCallback: (callback, options) =>
            scheduled.push(["idle", options.timeout, callback]),
        }),
      ),
    ).toBeTrue();
    expect(
      preload.scheduleBoxedWinePreload(
        desktop({
          setTimeout: (callback, delay) =>
            scheduled.push(["timeout", delay, callback]),
        }),
      ),
    ).toBeTrue();
    expect(scheduled.map(([kind, delay]) => [kind, delay])).toEqual([
      ["idle", 3000],
      ["timeout", 1500],
    ]);
    scheduled[0][2]();
    const failing = desktop({
      fetch: async () => {
        throw new Error("offline");
      },
    });
    preload.scheduleBoxedWinePreload({
      ...failing,
      requestIdleCallback: (callback) => callback(),
    });
  });

  test("exposes preload controls on the page", async () => {
    window.fetch = async (url) =>
      url.endsWith("preload.json")
        ? Response.json({ files: [] })
        : new Response("x");
    window.setTimeout = () => {};
    expect(window.XPBoxedWinePreload.schedule()).toBeTrue();
    expect(await window.XPBoxedWinePreload.preload()).toBeTrue();
  });
});
