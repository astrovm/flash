// @ts-nocheck -- Happy DOM's element types intentionally replace lib.dom here.
import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  cleanupShells,
  flushShell,
  loadShell,
  login,
} from "./helpers/shell-harness";
import { installBoxedWineResizeBridge } from "../site/apps/core/boxedwine-resize.js";

const require = createRequire(import.meta.url);
const { unzipSync } = require("fflate");
const projectDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const calculatorDirectory = join(
  projectDirectory,
  "site",
  "iframe",
  "calculator",
);
const sha256 = (content: Uint8Array) =>
  createHash("sha256").update(content).digest("hex");

afterEach(cleanupShells);

const launchCalculator = async () => {
  const shell = await login(await loadShell());
  shell.document.getElementById("start-button").click();
  shell.document.getElementById("all-programs-button").click();
  const flyouts = shell.document.getElementById("start-menu-flyouts");
  flyouts.querySelector('[data-program-id="accessories"]').click();
  flyouts.querySelector('[data-program-id="calculator"]').click();
  const calculator = shell.document.querySelector(
    '.xp-window[data-game="__calculator"]',
  );
  return { shell, calculator };
};

const sendNativeWindow = (shell, detail, runtimeWindow) => {
  const frame = shell.document.querySelector(".boxedwine-shared-runtime-frame");
  const event = new shell.window.Event("message");
  Object.defineProperties(event, {
    data: {
      value: { type: "boxedwine-native-window", window: detail },
    },
    origin: { value: shell.window.location.origin },
    source: { value: runtimeWindow || frame.contentWindow },
  });
  shell.window.dispatchEvent(event);
};

const showNativeCalculator = (
  shell,
  id = 41,
  runtimeWindow = shell.document.querySelector(
    ".boxedwine-shared-runtime-frame",
  ).contentWindow,
) => {
  sendNativeWindow(
    shell,
    {
      type: "created",
      id,
      parentId: 1,
      processId: 10,
      x: 0,
      y: 0,
      width: 260,
      height: 260,
    },
    runtimeWindow,
  );
  sendNativeWindow(
    shell,
    { type: "title", id, title: "Calculator" },
    runtimeWindow,
  );
  sendNativeWindow(shell, { type: "mapped", id }, runtimeWindow);
  sendNativeWindow(
    shell,
    {
      type: "frame",
      id,
      width: 260,
      height: 260,
      rgba: new Uint8ClampedArray(260 * 260 * 4),
    },
    runtimeWindow,
  );
  return runtimeWindow;
};

describe("original Windows XP Calculator through BoxedWine", () => {
  test("launches the authentic XP executable in its fixed Standard window", async () => {
    const { shell, calculator } = await launchCalculator();
    const frame = shell.document.querySelector(
      ".boxedwine-shared-runtime-frame",
    );
    const url = new URL(frame.src);

    expect(calculator.style.width).toBe("260px");
    expect(calculator.style.height).toBe("260px");
    expect(
      calculator.classList.contains("xp-boxedwine-shared-window"),
    ).toBeTrue();
    expect(calculator.querySelector(".resize-handle")).toBeNull();
    expect(
      calculator.querySelector(".boxedwine-shared-app-host"),
    ).not.toBeNull();
    expect(url.searchParams.get("archive")).toBe("xp-runtime");
    expect(url.searchParams.get("root")).toBe("xp-accessories");
    expect(url.searchParams.get("executable")).toBe("calculator/calc.exe");
    expect(url.searchParams.get("resolution")).toBe("1024x738");
    expect(url.searchParams.get("persistent")).toBe("true");
    expect(url.searchParams.get("cache")).toBe("false");
    expect(url.searchParams.get("trace")).toBe("false");
  });

  test("reuses one persistent runtime for repeated Calculator launches", async () => {
    const { shell } = await launchCalculator();
    shell.document.getElementById("start-button").click();
    shell.document.getElementById("all-programs-button").click();
    const flyouts = shell.document.getElementById("start-menu-flyouts");
    flyouts.querySelector('[data-program-id="accessories"]').click();
    flyouts.querySelector('[data-program-id="calculator"]').click();

    expect(
      shell.document.querySelectorAll(".boxedwine-shared-runtime-frame"),
    ).toHaveLength(1);
    expect(
      shell.document.querySelectorAll(".boxedwine-shared-app-host"),
    ).toHaveLength(1);
  });

  test("distinguishes native minimize from a replacement Calculator window", async () => {
    const { shell, calculator } = await launchCalculator();
    const nativeSetTimeout = shell.window.setTimeout.bind(shell.window);
    shell.window.setTimeout = (callback, delay, ...arguments_) =>
      nativeSetTimeout(callback, delay === 100 ? 0 : delay, ...arguments_);
    shell.window.ImageData = class ImageData {
      constructor(data, width, height) {
        Object.assign(this, { data, width, height });
      }
    };
    const getCanvasContext =
      shell.window.HTMLCanvasElement.prototype.getContext;
    shell.window.HTMLCanvasElement.prototype.getContext = function (...args) {
      const context = getCanvasContext.apply(this, args);
      context.clearRect ||= () => {};
      return context;
    };
    const runtimeWindow = showNativeCalculator(shell);
    sendNativeWindow(shell, { type: "unmapped", id: 41 }, runtimeWindow);
    await flushShell();
    await flushShell();
    expect(calculator.style.display).toBe("none");

    sendNativeWindow(shell, { type: "mapped", id: 41 }, runtimeWindow);
    expect(calculator.style.display).toBe("flex");

    sendNativeWindow(shell, { type: "unmapped", id: 41 }, runtimeWindow);
    sendNativeWindow(shell, { type: "destroyed", id: 41 }, runtimeWindow);
    await flushShell();
    await flushShell();
    expect(calculator.style.display).toBe("flex");
    expect(calculator.textContent).toContain("Updating Windows application");

    showNativeCalculator(shell, 42, runtimeWindow);
    expect(calculator.style.display).toBe("flex");
    expect(
      calculator.querySelector('[data-boxedwine-window="42"]'),
    ).not.toBeNull();
  });

  test("packages the original executable, complete help, and window host", async () => {
    const manifest = JSON.parse(
      await readFile(join(calculatorDirectory, "SOURCES.json"), "utf8"),
    );
    const packageContent = new Uint8Array(
      await readFile(join(calculatorDirectory, "xp-calculator.zip")),
    );
    const files = unzipSync(packageContent);

    expect(packageContent.byteLength).toBe(manifest.windowsXp.package.bytes);
    expect(sha256(packageContent)).toBe(manifest.windowsXp.package.sha256);
    expect(Object.keys(files).sort()).toEqual([
      "calc.chm",
      "calc.exe",
      "window-host.exe",
    ]);
    for (const [name, source] of Object.entries(manifest.windowsXp.files)) {
      expect(sha256(files[name])).toBe(source.sha256);
    }
  });

  test("publishes native Standard and Scientific window sizes to the shell", () => {
    let pollWindowSize;
    const posted = [];
    const startupReports = [];
    const runnerWindow = {
      location: { origin: "https://flash.test" },
      BoxedWineStartup: {
        report(stage, detail) {
          startupReports.push({ stage, ...detail });
        },
      },
      parent: {
        postMessage(message, origin) {
          posted.push({ message, origin });
        },
      },
      addEventListener() {},
      removeEventListener() {},
      setInterval(callback) {
        pollWindowSize = callback;
        return 1;
      },
      clearInterval() {},
    };
    let nativeSize = "260 260";
    const module = {
      _boxedwine_resize_screen() {},
      FS: {
        readFile() {
          return nativeSize;
        },
        writeFile() {},
        unlink() {},
        rename() {},
      },
    };
    installBoxedWineResizeBridge(runnerWindow, module);
    module.onRuntimeInitialized();

    pollWindowSize();
    expect(posted.at(-1)).toEqual({
      message: { type: "boxedwine-window-size", width: 260, height: 260 },
      origin: "https://flash.test",
    });

    nativeSize = "480 260";
    pollWindowSize();
    expect(posted.at(-1)).toEqual({
      message: { type: "boxedwine-window-size", width: 480, height: 260 },
      origin: "https://flash.test",
    });
    expect(startupReports).toEqual([
      { stage: "window-ready", width: 260, height: 260 },
    ]);
  });
});
