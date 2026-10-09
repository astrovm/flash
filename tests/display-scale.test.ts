// @ts-nocheck -- Supersampled rendering on fractional pixel ratios.
import { afterEach, expect, test } from "bun:test";
import { cleanupShells, loadShell } from "./helpers/shell-harness";

afterEach(cleanupShells);

// A display whose ratio can change, with the matchMedia query the page
// watches for that change.
const display = (ratio) => {
  const queries = [];
  return {
    queries,
    beforeScripts: (window) => {
      Object.defineProperty(window, "devicePixelRatio", {
        configurable: true,
        get: () => display.ratio,
      });
      display.ratio = ratio;
      window.matchMedia = (media) => {
        const query = new window.EventTarget();
        query.media = media;
        queries.push(query);
        return query;
      };
    },
  };
};

const frames = (s) =>
  new Promise((resolve) =>
    s.window.requestAnimationFrame(() =>
      s.window.requestAnimationFrame(() => setTimeout(resolve)),
    ),
  );

test("fractional ratios lay out at the next whole ratio and scale down", async () => {
  const screen = display(1.25);
  const s = await loadShell({ beforeScripts: screen.beforeScripts });
  const root = s.document.documentElement.style;
  expect([root.zoom, root.transformOrigin, root.willChange]).toEqual([
    "1.6",
    "0 0",
    "transform",
  ]);
  await frames(s);
  expect(root.transform).toBe("scale(0.625)");

  // Back at a whole ratio, the page renders as is.
  display.ratio = 2;
  screen.queries.at(-1).dispatchEvent(new s.window.Event("change"));
  expect([root.zoom, root.transform, root.willChange]).toEqual(["", "", ""]);
  expect(screen.queries.at(-1).media).toBe("(resolution: 2dppx)");
});

test("the zoomed root fills the window in pixels, also after a resize", async () => {
  const s = await loadShell({ beforeScripts: display(1.5).beforeScripts });
  const root = s.document.documentElement.style;
  expect([root.width, root.height]).toEqual([
    `${s.window.innerWidth}px`,
    `${s.window.innerHeight}px`,
  ]);

  s.window.happyDOM.setViewport({ width: 700, height: 500 });
  s.window.dispatchEvent(new s.window.Event("resize"));
  expect([root.width, root.height, root.zoom]).toEqual([
    "700px",
    "500px",
    "1.3333333333333333",
  ]);
});

test("a resize applies a new ratio the media query missed", async () => {
  const s = await loadShell({ beforeScripts: display(1.25).beforeScripts });
  const root = s.document.documentElement.style;

  // Browser zoom moved from 125% to 175%, a ratio no media query matched.
  display.ratio = 1.75;
  s.window.dispatchEvent(new s.window.Event("resize"));
  await frames(s);
  expect([root.zoom, root.transform]).toEqual([
    "1.1428571428571428",
    "scale(0.875)",
  ]);

  display.ratio = 1;
  s.window.dispatchEvent(new s.window.Event("resize"));
  expect([root.zoom, root.width, root.height]).toEqual(["", "", ""]);
});

test("a ratio change before the first frames drops the old scale", async () => {
  const screen = display(1.25);
  const s = await loadShell({ beforeScripts: screen.beforeScripts });
  const root = s.document.documentElement.style;

  for (const ratio of [1.5, 2]) {
    display.ratio = ratio;
    screen.queries.at(-1).dispatchEvent(new s.window.Event("change"));
  }
  await frames(s);
  expect([root.zoom, root.transform]).toEqual(["", ""]);
});
