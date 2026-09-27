// @ts-nocheck -- Saved window placements clamped to the visible work area.
import { afterEach, expect, test } from "bun:test";
import {
  cleanupShells,
  clickStartAction,
  loadShell,
  login,
} from "./helpers/shell-harness";

afterEach(cleanupShells);

const openWithViewport = async ({
  desktop,
  viewport,
  visualViewport,
  taskbar = {},
  taskbarHeight,
}) => {
  const s = await login(
    await loadShell({
      initialStorage: {
        windowPlacements: JSON.stringify({
          "__my-documents": {
            left: 5000,
            top: 5000,
            width: 3000,
            height: 3000,
          },
        }),
        taskbarSettings: JSON.stringify(taskbar),
      },
    }),
  );
  const desktopElement = s.document.getElementById("desktop");
  Object.defineProperties(desktopElement, {
    clientWidth: { configurable: true, value: desktop[0] },
    clientHeight: { configurable: true, value: desktop[1] },
  });
  Object.defineProperties(s.window, {
    innerWidth: { configurable: true, value: viewport[0] },
    innerHeight: { configurable: true, value: viewport[1] },
    visualViewport: { configurable: true, value: visualViewport },
  });
  if (taskbarHeight !== undefined)
    s.document.getElementById("taskbar").getBoundingClientRect = () => ({
      height: taskbarHeight,
    });
  clickStartAction(s, "documents");
  const win = s.document.querySelector(
    '.xp-window[data-game="__my-documents"]',
  );
  return [parseFloat(win.style.width), parseFloat(win.style.height)];
};

test("restored windows fit the full-screen work area above the taskbar", async () => {
  expect(
    await openWithViewport({
      desktop: [1024, 768],
      viewport: [1024, 768],
      taskbarHeight: 32,
    }),
  ).toEqual([1024, 736]);
  expect(
    await openWithViewport({
      desktop: [1024, 768],
      viewport: [1024, 768],
      taskbarHeight: 90,
    }),
  ).toEqual([1024, 738]);
});

test("restored windows fit a shorter or narrower browser viewport", async () => {
  expect(
    await openWithViewport({
      desktop: [1024, 768],
      viewport: [1024, 500],
      taskbarHeight: 30,
    }),
  ).toEqual([1024, 470]);
  expect(
    await openWithViewport({
      desktop: [1024, 768],
      viewport: [800, 768],
      taskbarHeight: 30,
    }),
  ).toEqual([800, 768]);
});

test("pinch zoom limits windows to the reachable part of the page", async () => {
  expect(
    await openWithViewport({
      desktop: [1024, 768],
      viewport: [1024, 768],
      visualViewport: { width: 600, height: 400, scale: 2 },
      taskbarHeight: 30,
    }),
  ).toEqual([600, 370]);
  expect(
    await openWithViewport({
      desktop: [1024, 768],
      viewport: [1024, 768],
      visualViewport: { width: 600, height: 400, scale: 1 },
      taskbarHeight: 30,
    }),
  ).toEqual([1024, 768]);
});

test("auto-hidden taskbars and empty desktops use the viewport", async () => {
  expect(
    await openWithViewport({
      desktop: [1024, 768],
      viewport: [900, 700],
      taskbar: { autoHide: true },
    }),
  ).toEqual([900, 700]);
  expect(
    await openWithViewport({
      desktop: [0, 0],
      viewport: [640, 480],
      taskbarHeight: 30,
    }),
  ).toEqual([640, 450]);
  expect(
    await openWithViewport({
      desktop: [0, 0],
      viewport: [0, 0],
      taskbarHeight: 30,
    }),
  ).toEqual([3000, 3000]);
});
