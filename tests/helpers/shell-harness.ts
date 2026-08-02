// @ts-nocheck -- Happy DOM's element types intentionally replace lib.dom here.
import { Window } from "happy-dom";

const projectDirectory = new URL("../..", import.meta.url);
const scripts = [
  "site/js/games.js",
  "site/js/flash-url-router.js",
  "site/js/storage-policy.js",
  "site/js/game-installer.js",
  "site/js/game-library.js",
  "site/js/game-data.js",
  "site/js/filesystem.js",
  "site/js/file-operations.js",
  "site/js/dialogs.js",
  "site/js/offline.js",
];

const activeWindows = new Set<Window>();

export const flushShell = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

export async function loadShell() {
  const window = new Window({
    url: "http://127.0.0.1/",
    width: 1024,
    height: 768,
    settings: {
      enableJavaScriptEvaluation: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
    },
  });
  const { document } = window;
  activeWindows.add(window);
  Object.assign(window, {
    Array,
    ArrayBuffer,
    BigInt,
    Boolean,
    DataView,
    Date,
    Error,
    EvalError,
    Float32Array,
    Float64Array,
    Int8Array,
    Int16Array,
    Int32Array,
    Intl,
    JSON,
    Map,
    Math,
    Number,
    Object,
    Promise,
    RangeError,
    ReferenceError,
    RegExp,
    Set,
    String,
    Symbol,
    SyntaxError,
    TypeError,
    Uint8Array,
    Uint8ClampedArray,
    Uint16Array,
    Uint32Array,
    URIError,
    WeakMap,
    WeakSet,
    parseFloat,
    parseInt,
    structuredClone,
  });
  const scriptErrors: unknown[] = [];
  window.addEventListener("error", (event) => {
    scriptErrors.push(event.error || event.message);
  });
  const html = await Bun.file(
    new URL("site/index.html", projectDirectory),
  ).text();
  document.write(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, ""),
  );

  window.matchMedia ??= (() => ({
    matches: false,
    media: "",
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  })) as typeof window.matchMedia;
  window.Option = function Option(
    text = "",
    value = "",
    defaultSelected = false,
    selected = false,
  ) {
    const option = document.createElement("option");
    option.text = text;
    option.value = value;
    option.defaultSelected = defaultSelected;
    option.selected = selected;
    return option;
  } as typeof window.Option;
  window.HTMLElement.prototype.animate = function animate() {
    const animation = new window.EventTarget() as EventTarget & {
      cancel(): void;
    };
    animation.cancel = () => {};
    const addEventListener = animation.addEventListener.bind(animation);
    animation.addEventListener = ((type: string, listener: EventListener) => {
      addEventListener(type, listener);
      if (type === "finish") {
        queueMicrotask(() =>
          animation.dispatchEvent(new window.Event("finish")),
        );
      }
    }) as typeof animation.addEventListener;
    return animation as unknown as Animation;
  };

  for (const path of scripts) {
    const script = document.createElement("script");
    script.textContent = await Bun.file(new URL(path, projectDirectory)).text();
    document.body.appendChild(script);
  }

  const emptyLibrary = {
    subscribe() {
      return () => {};
    },
    async initialize() {
      return {};
    },
    async search() {
      return [];
    },
    async details() {
      return null;
    },
    async install() {},
    async uninstall() {},
    getRecord() {
      return null;
    },
    async match() {
      return null;
    },
  };
  window.AstroGameLibrary.createManager = () => emptyLibrary;

  const offlineSnapshot = {
    downloadedGameIds: [],
    phase: "idle",
    updateAvailable: false,
  };
  window.AstroOffline.createManager = () => ({
    subscribe() {
      return () => {};
    },
    async initialize() {},
    getSnapshot() {
      return offlineSnapshot;
    },
    async downloadGame() {},
  });

  const main = document.createElement("script");
  main.textContent = await Bun.file(
    new URL("site/js/main.js", projectDirectory),
  ).text();
  document.body.appendChild(main);

  if (scriptErrors.length) throw scriptErrors[0];

  window.dispatchEvent(new window.Event("load"));
  await flushShell();
  return { window, document };
}

export async function login(shell: Awaited<ReturnType<typeof loadShell>>) {
  shell.document.getElementById("boot-screen")!.click();
  shell.document.getElementById("welcome-screen")!.click();
  await flushShell();
  await flushShell();
  return shell;
}

export function clickStartAction(
  shell: Awaited<ReturnType<typeof loadShell>>,
  action: string,
) {
  shell.document.getElementById("start-button")!.click();
  const button = shell.document.querySelector<HTMLButtonElement>(
    `[data-start-action="${action}"]`,
  );
  if (!button) throw new Error(`Missing Start action: ${action}`);
  button.click();
}

export function cleanupShells() {
  activeWindows.forEach((window) => window.close());
  activeWindows.clear();
}
