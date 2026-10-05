// @ts-nocheck -- Drive Emscripten's public callbacks without loading its binary runtime.
import { afterEach, expect, test } from "bun:test";
import { cleanupShells, loadShell, flushShell } from "./helpers/shell-harness";
afterEach(cleanupShells);
async function setup(
  fetchResource = async (url) =>
    String(url).endsWith("SOURCES.json")
      ? Response.json({ files: { "PINBALL.DAT": { start: 1, end: 3 } } })
      : new Response(new Uint8Array([0, 1, 2, 3])),
) {
  const shell = await loadShell(),
    calls = [],
    messages = [];
  shell.window.fetch = fetchResource;
  shell.window.requestAnimationFrame = (callback) => callback();
  let runtime, resize;
  shell.window.ResizeObserver = class {
    constructor(callback) {
      resize = callback;
    }
    observe() {}
    disconnect() {
      calls.push(["disconnect"]);
    }
  };
  shell.window.AstroPinballModule = async (module) => {
    runtime = module;
    for (const name of [
      "addRunDependency",
      "removeRunDependency",
      "FS_createPath",
      "FS_createDataFile",
      "setCanvasSize",
      "pauseMainLoop",
    ])
      module[name] = (...args) => calls.push([name, ...args]);
    return module;
  };
  const app = shell.window.XPApplicationRegistry.get("__pinball").loaded;
  const mounted = app.mount({
    setTitle() {},
    showMessage: (...args) => messages.push(args),
    close: () => calls.push(["close"]),
  });
  shell.document.body.append(mounted.element);
  const script = shell.document.querySelector(
    'script[src$="SpaceCadetPinball.js"]',
  );
  script.dispatchEvent(new shell.window.Event("load"));
  return { shell, mounted, runtime, calls, messages, resize, script };
}
test("Pinball loads resource slices, reports progress and resizes the live canvas", async () => {
  const h = await setup(),
    m = h.runtime;
  expect(m.locateFile("runtime.wasm")).toEndWith(
    "/apps/pinball/runtime/runtime.wasm",
  );
  m.preRun[0]();
  await flushShell();
  expect(h.calls.find((c) => c[0] === "FS_createDataFile").slice(1, 3)).toEqual(
    ["/game_resources", "PINBALL.DAT"],
  );
  expect([...h.calls.find((c) => c[0] === "FS_createDataFile")[3]]).toEqual([
    1, 2,
  ]);
  expect(h.calls.at(-1)).toEqual([
    "removeRunDependency",
    "pinball-xp-resources",
  ]);
  const progress = h.mounted.element.querySelector("progress"),
    status = h.mounted.element.querySelector('[role="status"]');
  m.monitorRunDependencies(4);
  m.monitorRunDependencies(2);
  expect(progress.value).toBe(2);
  expect(progress.max).toBe(4);
  m.monitorRunDependencies(0);
  expect(progress.hidden).toBeTrue();
  expect(status.textContent).toBe("All downloads complete.");
  m.setStatus("");
  expect(status.hidden).toBeTrue();
  expect(m.canvas.style.visibility).toBe("visible");
  Object.defineProperties(h.mounted.element, {
    clientWidth: { value: 700 },
    clientHeight: { value: 500 },
  });
  m.onRuntimeInitialized();
  await flushShell();
  expect(h.calls.at(-1)).toEqual(["setCanvasSize", 700, 500]);
  const count = h.calls.length;
  h.resize();
  expect(h.calls.length).toBe(count);
  const menu = new h.shell.window.Event("contextmenu", { cancelable: true });
  m.canvas.dispatchEvent(menu);
  expect(menu.defaultPrevented).toBeTrue();
  const lost = new h.shell.window.Event("webglcontextlost", {
    cancelable: true,
  });
  m.canvas.dispatchEvent(lost);
  expect(lost.defaultPrevented).toBeTrue();
  expect(h.messages.at(-1)[1]).toContain("stopped drawing");
  m.onHelpRequested();
  expect(h.messages.at(-1)[1]).toContain("Press F2");
  m.onExitRequested();
  expect(h.calls.at(-1)).toEqual(["close"]);
  h.mounted.unmount();
  h.mounted.element.remove();
  const afterClose = h.calls.length;
  h.resize();
  expect(h.calls.length).toBe(afterClose);
});
for (const failure of [
  "manifest",
  "data",
  "script",
  "abort",
  "empty abort",
  "factory",
]) {
  test(`Pinball reports ${failure} failures without displaying a playable canvas`, async () => {
    const h = await setup(async (url) => {
      const manifest = String(url).endsWith("SOURCES.json");
      if (
        (failure === "manifest" && manifest) ||
        (failure === "data" && !manifest)
      )
        return new Response("unavailable", { status: 503 });
      return manifest
        ? Response.json({ files: {} })
        : new Response(new Uint8Array());
    });
    if (failure === "script")
      h.script.dispatchEvent(new h.shell.window.Event("error"));
    else if (failure.includes("abort"))
      h.runtime.onAbort(failure === "abort" ? "runtime stopped" : undefined);
    else if (failure === "factory") {
      h.shell.window.AstroPinballModule = async () => {
        throw new Error("factory failed");
      };
      h.script.dispatchEvent(new h.shell.window.Event("load"));
    } else h.runtime.preRun[0]();
    await flushShell();
    const expected = {
      manifest: "resource manifest",
      data: "game data",
      script: "could not be loaded",
      abort: "runtime stopped",
      "empty abort": "could not start",
      factory: "factory failed",
    }[failure];
    expect(h.messages.at(-1)[1]).toContain(expected);
    expect(
      h.mounted.element.querySelector('[role="status"]').textContent,
    ).toContain(expected);
    expect(h.runtime.canvas.style.visibility).toBe("hidden");
  });
}
