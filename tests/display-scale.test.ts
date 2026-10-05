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
