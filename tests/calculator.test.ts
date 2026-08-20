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

const openCalculator = (shell) => {
  shell.document.getElementById("start-button").click();
  shell.document.getElementById("all-programs-button").click();
  const flyouts = shell.document.getElementById("start-menu-flyouts");
  flyouts.querySelector('[data-program-id="accessories"]').click();
  flyouts.querySelector('[data-program-id="calculator"]').click();
  const calculator = shell.document.querySelector(
    '.xp-window[data-game="__calculator"]',
  );
  return calculator;
};

const launchCalculator = async () => {
  const shell = await login(await loadShell());
  const calculator = openCalculator(shell);
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

// Happy DOM fires an error on the runtime iframe, which would restart the
// runtime and drop its native windows; suppress it so lifecycle messages that
// arrive after the first frame still reach the shell.
const silenceRuntimeFrameErrors = (shell) => {
  const addFrameListener =
    shell.window.HTMLIFrameElement.prototype.addEventListener;
  shell.window.HTMLIFrameElement.prototype.addEventListener = function (
    type,
    ...arguments_
  ) {
    if (type === "error") return;
    return addFrameListener.call(this, type, ...arguments_);
  };
};

const nativeLaunchToken = (shell) =>
  new URL(
    shell.document.querySelector(".boxedwine-shared-runtime-frame").src,
  ).searchParams.get("launchToken");

const showNativeCalculator = (
  shell,
  id = 41,
  runtimeWindow = shell.document.querySelector(
    ".boxedwine-shared-runtime-frame",
  ).contentWindow,
  { includeFrame = true } = {},
) => {
  runtimeWindow.__boxedwineTestFrames ||= new Map();
  runtimeWindow.BoxedWineFrames ||= {
    read(windowId, previousGeneration) {
      const frame = runtimeWindow.__boxedwineTestFrames.get(windowId);
      return frame?.generation === previousGeneration ? null : frame;
    },
    setProcessVisible() {},
  };
  const launchToken = new URL(
    shell.document.querySelector(".boxedwine-shared-runtime-frame").src,
  ).searchParams.get("launchToken");
  sendNativeWindow(
    shell,
    {
      type: "created",
      id,
      parentId: 1,
      processId: 10,
      launchToken,
      x: 0,
      y: 0,
      width: 260,
      height: 260,
      canResize: false,
      canMaximize: false,
      canMinimize: true,
    },
    runtimeWindow,
  );
  sendNativeWindow(
    shell,
    { type: "title", id, title: "Calculator" },
    runtimeWindow,
  );
  sendNativeWindow(shell, { type: "mapped", id }, runtimeWindow);
  if (includeFrame)
    sendNativeWindow(
      shell,
      {
        type: "metadata",
        lifecycleType: "bounds",
        id,
        parentId: 1,
        processId: 10,
        launchToken,
        outerX: 0,
        outerY: 0,
        outerWidth: 260,
        outerHeight: 260,
        clientWidth: 260,
        clientHeight: 232,
        frameLeft: 0,
        frameTop: 28,
        frameRight: 0,
        frameBottom: 0,
        canResize: false,
        canMaximize: false,
        canMinimize: true,
        win32Metrics: true,
      },
      runtimeWindow,
    );
  const generation =
    (runtimeWindow.__boxedwineTestFrames.get(id)?.generation || 0) + 1;
  runtimeWindow.__boxedwineTestFrames.set(id, {
    generation,
    width: 260,
    height: 260,
    rgba: new Uint8ClampedArray(260 * 260 * 4),
  });
  sendNativeWindow(
    shell,
    { type: "frame", id, width: 260, height: 260, generation },
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
    showNativeCalculator(shell);
    await flushShell();

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

  test("waits for native frame metrics instead of exposing Wine chrome", async () => {
    const { shell, calculator } = await launchCalculator();
    showNativeCalculator(shell, 41, undefined, { includeFrame: false });
    await flushShell();

    expect(
      calculator.querySelector(".boxedwine-shared-loading"),
    ).not.toBeNull();
    expect(calculator.querySelector(".boxedwine-native-window")).toBeNull();
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

  test("restores and clamps saved native placement before applying defaults", async () => {
    const shell = await login(await loadShell());
    shell.window.localStorage.setItem(
      "windowPlacements",
      JSON.stringify({
        __calculator: {
          left: 4000,
          top: 3000,
          width: 260,
          height: 260,
        },
      }),
    );
    const calculator = openCalculator(shell);
    showNativeCalculator(shell);
    await flushShell();

    expect(calculator.style.width).toBe("260px");
    expect(calculator.style.height).toBe("260px");
    expect(Number.parseFloat(calculator.style.left)).toBeLessThanOrEqual(764);
    expect(Number.parseFloat(calculator.style.top)).toBeLessThanOrEqual(478);
  });

  test("follows the native window when Scientific mode resizes it", async () => {
    const shell = await login(await loadShell());
    silenceRuntimeFrameErrors(shell);
    const calculator = openCalculator(shell);
    showNativeCalculator(shell);
    await flushShell();
    expect(calculator.style.width).toBe("260px");

    sendNativeWindow(shell, {
      type: "metadata",
      id: 41,
      parentId: 1,
      processId: 10,
      launchToken: nativeLaunchToken(shell),
      outerX: 0,
      outerY: 0,
      outerWidth: 544,
      outerHeight: 348,
      clientWidth: 544,
      clientHeight: 320,
      frameTop: 28,
      win32Metrics: true,
    });
    await flushShell();

    expect(calculator.style.width).toBe("544px");
    expect(calculator.style.height).toBe("348px");

    sendNativeWindow(shell, {
      type: "metadata",
      id: 41,
      parentId: 1,
      processId: 10,
      launchToken: nativeLaunchToken(shell),
      outerX: 0,
      outerY: 0,
      outerWidth: 1,
      outerHeight: 1,
      clientWidth: 1,
      clientHeight: 1,
    });
    await flushShell();

    expect(calculator.style.width).toBe("544px");
    expect(calculator.style.height).toBe("348px");
  });

  test("keeps following native sizes after restoring a saved placement", async () => {
    const shell = await login(await loadShell());
    silenceRuntimeFrameErrors(shell);
    shell.window.localStorage.setItem(
      "windowPlacements",
      JSON.stringify({
        __calculator: { left: 20, top: 20, width: 260, height: 260 },
      }),
    );
    const calculator = openCalculator(shell);
    showNativeCalculator(shell);
    await flushShell();

    sendNativeWindow(shell, {
      type: "metadata",
      id: 41,
      parentId: 1,
      processId: 10,
      launchToken: nativeLaunchToken(shell),
      outerX: 0,
      outerY: 0,
      outerWidth: 544,
      outerHeight: 348,
      clientWidth: 544,
      clientHeight: 320,
      frameTop: 28,
      win32Metrics: true,
    });
    await flushShell();

    expect(calculator.style.width).toBe("544px");
    expect(calculator.style.height).toBe("348px");
  });

  test("ignores metadata from a second top-level window of the same launch", async () => {
    const shell = await login(await loadShell());
    silenceRuntimeFrameErrors(shell);
    const calculator = openCalculator(shell);
    showNativeCalculator(shell);
    await flushShell();
    const launchToken = nativeLaunchToken(shell);

    sendNativeWindow(shell, {
      type: "created",
      id: 42,
      parentId: 1,
      processId: 11,
      launchToken,
      x: 0,
      y: 0,
      width: 900,
      height: 700,
      clientWidth: 900,
      clientHeight: 672,
      frameTop: 28,
    });
    sendNativeWindow(shell, { type: "title", id: 42, title: "Helper" });
    sendNativeWindow(shell, { type: "mapped", id: 42 });
    await flushShell();

    expect(calculator.style.width).toBe("260px");
    expect(calculator.style.height).toBe("260px");
    expect(calculator.querySelector(".title-text").textContent).toBe(
      "Calculator",
    );
  });

  test("keeps the runtime alive without relaunching a closed application", async () => {
    const shell = await login(await loadShell());
    const addFrameListener =
      shell.window.HTMLIFrameElement.prototype.addEventListener;
    shell.window.HTMLIFrameElement.prototype.addEventListener = function (
      type,
      ...arguments_
    ) {
      if (type === "error") return;
      return addFrameListener.call(this, type, ...arguments_);
    };
    const calculator = openCalculator(shell);
    const runtimeWindow = shell.document.querySelector(
      ".boxedwine-shared-runtime-frame",
    ).contentWindow;
    const requests = [];
    runtimeWindow.postMessage = (message) => requests.push(message);
    const nativeSetTimeout = shell.window.setTimeout.bind(shell.window);
    shell.window.setTimeout = (callback, delay, ...arguments_) => {
      if (delay === 500) {
        callback(...arguments_);
        return -1;
      }
      return nativeSetTimeout(callback, delay, ...arguments_);
    };
    showNativeCalculator(shell, 41, runtimeWindow);

    calculator.querySelector(".close-btn").click();
    expect(requests).toContainEqual(
      expect.objectContaining({
        type: "boxedwine-terminate-process",
        appId: "calculator",
        processId: 10,
      }),
    );

    const event = new shell.window.Event("message");
    Object.defineProperties(event, {
      data: {
        value: {
          type: "boxedwine-process-terminated",
          appId: "calculator",
          launchToken: new URL(
            shell.document.querySelector(".boxedwine-shared-runtime-frame").src,
          ).searchParams.get("launchToken"),
          processId: 10,
          error: 0,
        },
      },
      origin: { value: shell.window.location.origin },
      source: { value: runtimeWindow },
    });
    shell.window.dispatchEvent(event);

    expect(
      requests.filter(({ type }) => type === "boxedwine-launch-process"),
    ).toEqual([]);
    expect(
      shell.document.querySelectorAll(".boxedwine-shared-runtime-frame"),
    ).toHaveLength(1);
  });

  test("distinguishes native minimize from a replacement Calculator window", async () => {
    const shell = await login(await loadShell());
    const addFrameListener =
      shell.window.HTMLIFrameElement.prototype.addEventListener;
    shell.window.HTMLIFrameElement.prototype.addEventListener = function (
      type,
      ...arguments_
    ) {
      if (type === "error") return;
      return addFrameListener.call(this, type, ...arguments_);
    };
    const calculator = openCalculator(shell);
    const nativeSetTimeout = shell.window.setTimeout.bind(shell.window);
    shell.window.setTimeout = (callback, delay, ...arguments_) => {
      if (delay === 100) {
        callback(...arguments_);
        return -1;
      }
      return nativeSetTimeout(callback, delay, ...arguments_);
    };
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
    expect(calculator.style.display).toBe("flex");
    expect(calculator.textContent).toContain("Updating Windows application");

    showNativeCalculator(shell, 42, runtimeWindow);
    expect(calculator.style.display).toBe("flex");
    expect(
      calculator.querySelector('[data-boxedwine-window="42"]'),
    ).not.toBeNull();
  });

  test("packages the original executable and complete help", async () => {
    const manifest = JSON.parse(
      await readFile(join(calculatorDirectory, "SOURCES.json"), "utf8"),
    );
    const packageContent = new Uint8Array(
      await readFile(join(calculatorDirectory, "xp-calculator.zip")),
    );
    const files = unzipSync(packageContent);

    expect(packageContent.byteLength).toBe(manifest.windowsXp.package.bytes);
    expect(sha256(packageContent)).toBe(manifest.windowsXp.package.sha256);
    expect(Object.keys(files).sort()).toEqual(["calc.chm", "calc.exe"]);
    for (const [name, source] of Object.entries(manifest.windowsXp.files)) {
      expect(sha256(files[name])).toBe(source.sha256);
    }
  });
});
