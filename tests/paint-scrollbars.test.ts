// @ts-nocheck -- Paint's scrollbars need only a DOM with stubbed layout.
import { afterEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { installPaintScrollbars } from "../site/apps/paint/scrollbars.js";

const globals = [
  "window",
  "document",
  "ResizeObserver",
  "requestAnimationFrame",
];
const previous = Object.fromEntries(
  globals.map((key) => [key, globalThis[key]]),
);
let page;
afterEach(async () => {
  for (const key of globals) {
    if (previous[key] === undefined) delete globalThis[key];
    else globalThis[key] = previous[key];
  }
  await page?.happyDOM.close();
});

const rect = (element, value) => {
  element.getBoundingClientRect = () => ({ ...value });
};

function setup({ scroll = 400, client = 100 } = {}) {
  page = new Window();
  const frames = [];
  const observers = [];
  Object.assign(globalThis, {
    window: page,
    document: page.document,
    requestAnimationFrame: (callback) => frames.push(callback),
    ResizeObserver: class {
      constructor(callback) {
        this.callback = callback;
        this.targets = [];
        observers.push(this);
      }
      observe(target) {
        this.targets.push(target);
      }
      disconnect() {
        this.disconnected = true;
      }
    },
  });
  const shell = page.document.createElement("div");
  const viewport = page.document.createElement("div");
  const canvas = page.document.createElement("canvas");
  let scrollTop = 0;
  let scrollLeft = 0;
  Object.defineProperties(viewport, {
    scrollHeight: { value: scroll },
    scrollWidth: { value: client },
    clientHeight: { value: client },
    clientWidth: { value: client },
    scrollTop: {
      get: () => scrollTop,
      set: (value) => {
        scrollTop = Math.min(scroll - client, Math.max(0, value));
      },
    },
    scrollLeft: {
      get: () => scrollLeft,
      set: (value) => (scrollLeft = value),
    },
  });
  shell.append(viewport);
  page.document.body.append(shell);
  const dispose = installPaintScrollbars(shell, viewport, canvas);
  const bar = shell.querySelector(".paint-scrollbar.vertical");
  const track = bar.querySelector(".paint-scroll-track");
  const thumb = bar.querySelector(".paint-scroll-thumb");
  rect(track, { top: 16, left: 0, height: 200, width: 16 });
  for (const other of shell.querySelectorAll(
    ".paint-scrollbar.horizontal .paint-scroll-track",
  ))
    rect(other, { top: 0, left: 16, height: 16, width: 200 });
  const render = () => {
    while (frames.length) frames.shift()();
  };
  render();
  return {
    shell,
    viewport,
    canvas,
    bar,
    track,
    thumb,
    observers,
    dispose,
    render,
    up: bar.querySelector(".paint-scroll-up"),
    down: bar.querySelector(".paint-scroll-down"),
    pointer: (target, type, clientY) =>
      target.dispatchEvent(
        new page.PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          clientY,
        }),
      ),
  };
}

describe("Paint scrollbars", () => {
  test("hide when the picture fits and stop observing once disposed", () => {
    const h = setup({ scroll: 100 });
    const horizontal = h.shell.querySelector(".paint-scrollbar.horizontal");
    expect(h.bar.hidden).toBeTrue();
    expect(horizontal.hidden).toBeTrue();
    expect(h.thumb.style.height).toBe("200px");
    expect(h.shell.classList.contains("has-vertical-scrollbar")).toBeFalse();
    expect(h.up.disabled).toBeTrue();
    expect(h.down.disabled).toBeTrue();
    expect(h.observers[0].targets).toEqual([h.viewport, h.canvas]);
    h.dispose();
    expect(h.observers[0].disconnected).toBeTrue();
  });

  test("size the thumb to the visible share and track the scroll position", () => {
    const h = setup();
    expect(h.bar.hidden).toBeFalse();
    expect(h.shell.classList.contains("has-vertical-scrollbar")).toBeTrue();
    expect(h.thumb.style.height).toBe("50px");
    expect(h.thumb.style.top).toBe("0px");
    expect(h.up.disabled).toBeTrue();
    expect(h.down.disabled).toBeFalse();
    h.viewport.scrollTop = 300;
    h.viewport.dispatchEvent(new page.Event("scroll"));
    expect(h.thumb.style.top).toBe("150px");
    expect(h.down.disabled).toBeTrue();
  });

  test("keep a minimum thumb length for very tall pictures", () => {
    const h = setup({ scroll: 100_000 });
    expect(h.thumb.style.height).toBe("8px");
  });

  test("arrows scroll by sixteen pixels", () => {
    const h = setup();
    h.down.click();
    h.down.click();
    expect(h.viewport.scrollTop).toBe(32);
    h.up.click();
    expect(h.viewport.scrollTop).toBe(16);
    expect(h.up.disabled).toBeFalse();
  });

  test("clicking the track pages toward the pointer", () => {
    const h = setup();
    h.viewport.scrollTop = 150;
    rect(h.thumb, { top: 16 + 75, left: 0, height: 50, width: 16 });
    h.pointer(h.track, "pointerdown", 200);
    expect(h.viewport.scrollTop).toBe(250);
    h.pointer(h.track, "pointerdown", 20);
    expect(h.viewport.scrollTop).toBe(150);
  });

  test("dragging the thumb scrolls proportionally until release", () => {
    const h = setup();
    h.pointer(h.thumb, "pointerdown", 20);
    expect(h.viewport.scrollTop).toBe(0);
    h.pointer(page, "pointermove", 50);
    expect(h.viewport.scrollTop).toBe(60);
    h.pointer(page, "pointerup", 50);
    h.pointer(page, "pointermove", 120);
    expect(h.viewport.scrollTop).toBe(60);
  });
});
