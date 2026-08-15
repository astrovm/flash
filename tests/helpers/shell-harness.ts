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

const shellScripts = [
  "site/js/main.js",
  "site/js/shell/window-manager.js",
  "site/js/apps/display-properties.js",
  "site/js/apps/explorer.js",
  "site/js/apps/programs.js",
  "site/js/shell/taskbar.js",
  "site/js/shell/system-tray.js",
  "site/js/shell/desktop.js",
  "site/js/shell/start-menu.js",
  "site/js/shell/session.js",
  "site/js/shell/bootstrap.js",
];

const activeWindows = new Set<Window>();

export const flushShell = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

export async function loadShell({
  gameLibraryManager,
  offlineSettings = {},
} = {}) {
  const window = new Window({
    url: "http://127.0.0.1/",
    width: 1024,
    height: 768,
    settings: {
      disableCSSFileLoading: true,
      disableJavaScriptFileLoading: true,
      enableJavaScriptEvaluation: false,
      handleDisabledFileLoadingAsSuccess: true,
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
  document.write(html);
  window.happyDOM.settings.enableJavaScriptEvaluation = true;

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
  window.HTMLCanvasElement.prototype.getContext = function getContext() {
    const width = this.width;
    const height = this.height;
    const image = new Uint8ClampedArray(width * height * 4);
    return {
      canvas: this,
      beginPath() {},
      closePath() {},
      drawImage() {},
      ellipse() {},
      fillRect() {},
      getImageData() {
        return { data: image, width, height };
      },
      lineTo() {},
      moveTo() {},
      putImageData() {},
      rect() {},
      stroke() {},
    } as unknown as CanvasRenderingContext2D;
  };
  window.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,";
  window.HTMLCanvasElement.prototype.toBlob = function toBlob(callback) {
    callback(new window.Blob([], { type: "image/png" }));
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
  window.AstroGameLibrary.createManager = () =>
    gameLibraryManager || emptyLibrary;

  const offlineSnapshot = {
    activeGameId: null,
    automaticUpdateDelayMs: null,
    availableVersion: null,
    bundledGames: [
      { id: "freecell" },
      { id: "solitaire" },
      { id: "spider-solitaire" },
    ],
    downloadedGameIds: [],
    downloadedGameBytes: 0,
    downloadBytes: 8_000_000,
    downloadMetadataError: false,
    enabled: true,
    gameError: null,
    gamePhase: "idle",
    gameProgressLoaded: 0,
    gameProgressTotal: 0,
    lastChecked: null,
    online: true,
    releaseUpdateDelayMs: 6 * 60 * 60 * 1000,
    savePlayedGamesOffline: true,
    automaticUpdatesEnabled: true,
    phase: "ready",
    updateEligibleAt: null,
    updateAvailable: false,
    updateReady: false,
    usage: 0,
    workerState: "active",
    ...offlineSettings,
  };
  const offlineDownloads: string[] = [];
  const offlineListeners = new Set();
  const notifyOfflineListeners = () =>
    offlineListeners.forEach((listener) => listener({ ...offlineSnapshot }));
  window.AstroOffline.createManager = () => ({
    subscribe(listener) {
      offlineListeners.add(listener);
      listener({ ...offlineSnapshot });
      return () => offlineListeners.delete(listener);
    },
    async initialize() {},
    getSnapshot() {
      return offlineSnapshot;
    },
    async downloadGame(gameId) {
      offlineDownloads.push(gameId);
      offlineSnapshot.downloadedGameIds.push(gameId);
      notifyOfflineListeners();
    },
    async setOfflineEnabled(enabled) {
      offlineSnapshot.enabled = enabled;
      notifyOfflineListeners();
    },
    setSavePlayedGamesOffline(enabled) {
      offlineSnapshot.savePlayedGamesOffline = enabled;
      notifyOfflineListeners();
    },
    setAutomaticUpdatesEnabled(enabled) {
      offlineSnapshot.automaticUpdatesEnabled = enabled;
      notifyOfflineListeners();
    },
    setAutomaticUpdateDelay() {},
    async checkForUpdates() {},
    async updateNow() {},
  });

  // Happy DOM evaluates separately injected classic scripts in isolated lexical
  // environments. Real browsers share one global lexical environment, so join
  // the ordered shell modules before evaluation to preserve browser semantics.
  const script = document.createElement("script");
  script.textContent = (
    await Promise.all(
      shellScripts.map((path) =>
        Bun.file(new URL(path, projectDirectory)).text(),
      ),
    )
  ).join("\n");
  document.body.appendChild(script);

  const applicationBundle = await Bun.build({
    entrypoints: [new URL("site/apps/index.js", projectDirectory).pathname],
    format: "iife",
    target: "browser",
  });
  if (!applicationBundle.success) {
    throw new Error(applicationBundle.logs.join("\n"));
  }
  const applicationScript = document.createElement("script");
  applicationScript.textContent = await applicationBundle.outputs[0].text();
  document.body.appendChild(applicationScript);

  // The real browser runs the WebAssembly guest while the XP welcome screen
  // is visible. Happy DOM cannot execute an iframe guest, so resolve only the
  // boot readiness boundaries and keep the real runtime DOM for shell tests.
  const boxedWineRuntime = window.XPBoxedWineRuntime;
  if (boxedWineRuntime) {
    window.XPBoxedWineRuntime = Object.freeze({
      ...boxedWineRuntime,
      ready: async () => {},
      applicationsReady: async () => {},
    });
  }

  if (scriptErrors.length) throw scriptErrors[0];

  document.dispatchEvent(new window.Event("DOMContentLoaded"));
  await flushShell();
  return { window, document, offlineDownloads };
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
