import { expect, test } from "bun:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const routerApi = require("../site/js/flash-url-router.js");
const pageUrl = "https://astro.example/app/";

test("Flash URL router matches exact paths and preserves request options", () => {
  const router = routerApi.create(
    {
      example: {
        archive: {
          routes: {
            "http://media.example/game/assets/main.swf":
              "swf/example/content/media.example/game/assets/main.swf",
          },
        },
      },
    },
    pageUrl,
  );
  const signal = AbortSignal.timeout(10_000);
  const original = new Request(
    "https://media.example/game/assets/main.swf?user=1",
    {
      cache: "no-store",
      credentials: "include",
      headers: { "X-Game": "example" },
      signal,
    },
  );

  const routed = router.rewrite(original);
  expect(routed?.gameId).toBe("example");
  expect(routed?.request.url).toBe(
    "https://astro.example/app/swf/example/content/media.example/game/assets/main.swf?user=1",
  );
  expect(routed?.request.cache).toBe("no-store");
  expect(routed?.request.credentials).toBe("include");
  expect(routed?.request.headers.get("X-Game")).toBe("example");
  expect(routed?.request.signal.aborted).toBeFalse();
  expect(router.rewrite("https://media.example/other/main.swf")).toBeNull();
});

test("Flash URL router wraps fetch and restores the archived response URL", async () => {
  let fetchedUrl = "";
  const router = routerApi.create(
    {
      example: {
        archive: {
          routes: {
            "https://media.example/main.swf": "swf/example/main.swf",
          },
        },
      },
    },
    pageUrl,
  );
  const fetcher = router.wrapFetch(async (request: RequestInfo | URL) => {
    fetchedUrl = request instanceof Request ? request.url : String(request);
    return new Response("game");
  });

  const response = await fetcher("http://media.example/main.swf?v=2");
  expect(fetchedUrl).toBe("https://astro.example/app/swf/example/main.swf?v=2");
  expect(response.url).toBe("http://media.example/main.swf?v=2");
  expect(await response.text()).toBe("game");
});

test("Flash URL router rejects ambiguous and unsafe routes", () => {
  expect(() =>
    routerApi.create(
      {
        first: {
          archive: {
            routes: { "https://media.example/main.swf": "swf/first/main.swf" },
          },
        },
        second: {
          archive: {
            routes: { "http://media.example/main.swf": "swf/second/main.swf" },
          },
        },
      },
      pageUrl,
    ),
  ).toThrow("Duplicate Flash route");
  expect(() =>
    routerApi.create(
      {
        unsafe: {
          archive: {
            routes: { "https://media.example/main.swf": "../secret.swf" },
          },
        },
      },
      pageUrl,
    ),
  ).toThrow("Invalid local Flash route");
});

test("every bundled archive route targets a committed file", async () => {
  const gamesSource = await Bun.file(
    new URL("../site/js/games.js", import.meta.url),
  ).text();
  const browserGlobal: { FLASH_GAMES?: Record<string, any> } = {};
  new Function("window", gamesSource)(browserGlobal);
  const games = browserGlobal.FLASH_GAMES || {};
  const router = routerApi.create(games, pageUrl);
  let routeCount = 0;

  for (const game of Object.values(games)) {
    const archive = game.archive;
    if (!archive) continue;
    const launchRoute = router.resolve(archive.launchUrl);
    expect(launchRoute).not.toBeNull();
    for (const localPath of Object.values(archive.routes) as string[]) {
      routeCount += 1;
      expect(
        await Bun.file(
          new URL(`../site/${localPath}`, import.meta.url),
        ).exists(),
      ).toBeTrue();
    }
  }

  expect(routeCount).toBe(router.routeCount);
});
