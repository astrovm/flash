import { isConstrainedBoxedWineDevice } from "./boxedwine-preload.js";
import { createBoxedWineWindowSurface } from "./boxedwine-window-bridge.js";

const RUNTIME_ROOT = "vendor/boxedwine/26R1/";
const ROOT_ARCHIVE = "xp-accessories";
const APPLICATION_IDS = Object.freeze([
  "calculator",
  "solitaire",
  "freecell",
  "spider-solitaire",
]);

let runtime;

const packageRoot = () => {
  const root =
    window.ASTRO_GAME_ROOTS?.["boxedwine-runtime"] ||
    "iframe/boxedwine-runtime/";
  const url = new URL(root, document.baseURI).href;
  return url.endsWith("/") ? url : `${url}/`;
};

const runnerUrl = () => {
  const url = new URL(`${RUNTIME_ROOT}index.html`, document.baseURI);
  url.search = new URLSearchParams({
    appRoot: packageRoot(),
    root: ROOT_ARCHIVE,
    archive: "xp-runtime",
    executable: "runtime-host.exe",
    resolution: "1024x768",
    frameTop: "0",
    sound: "true",
    cache: "false",
    trace: "false",
    persistent: "true",
  });
  return url.href;
};

const createRuntime = () => {
  const frame = document.createElement("iframe");
  frame.className = "boxedwine-shared-runtime-frame";
  frame.title = "Shared Windows XP application runtime";
  frame.tabIndex = -1;

  const staging = document.createElement("div");
  staging.className = "boxedwine-shared-runtime-staging";
  document.body.append(frame, staging);

  const warmWindows = new Map();
  const mounts = new Map();
  let activeWarmAppId = null;
  let request = 0;
  let runtimeReady = false;
  let started = false;

  const attachMount = (appId) => {
    const mounted = mounts.get(appId);
    const windowId = warmWindows.get(appId);
    if (!mounted || !windowId) return false;
    const canvas = surfaces.getCanvas(windowId);
    if (!canvas) return false;
    mounted.element.replaceChildren();
    surfaces.attach(windowId, mounted.element);
    surfaces.show(windowId);
    surfaces.activate(windowId);
    mounted.context.setSize(canvas.width, canvas.height);
    mounted.element.dataset.boxedwineReady = "true";
    mounted.element.dataset.boxedwineOpenElapsed = String(
      Math.round(performance.now() - mounted.startedAt),
    );
    return true;
  };

  const warmNext = () => {
    if (!runtimeReady || activeWarmAppId) return;
    activeWarmAppId =
      APPLICATION_IDS.find((appId) => !warmWindows.has(appId)) || null;
    if (!activeWarmAppId) {
      document.documentElement.dataset.boxedwineApplicationsReady = "true";
      return;
    }
    frame.contentWindow.postMessage(
      {
        type: "boxedwine-launch-process",
        appId: activeWarmAppId,
        requestId: `prewarm:${activeWarmAppId}:${++request}`,
      },
      location.origin,
    );
  };

  const surfaces = createBoxedWineWindowSurface({
    host: staging,
    runtimeWindow: frame.contentWindow,
    origin: location.origin,
    initiallyVisible: false,
    onFirstFrame({ id }) {
      if (!activeWarmAppId) return;
      const appId = activeWarmAppId;
      activeWarmAppId = null;
      warmWindows.set(appId, id);
      surfaces.hide(id);
      attachMount(appId);
      setTimeout(warmNext, 50);
    },
  });

  const onMessage = (event) => {
    if (
      event.source !== frame.contentWindow ||
      event.origin !== location.origin
    )
      return;
    if (event.data?.type === "boxedwine-runtime-ready") {
      runtimeReady = true;
      warmNext();
    }
  };
  window.addEventListener("message", onMessage);

  return {
    mount(appId, context) {
      const element = document.createElement("div");
      element.className = "window-content boxedwine-shared-app-host";
      const status = document.createElement("span");
      status.className = "boxedwine-shared-loading";
      status.textContent = "Starting Windows application…";
      element.appendChild(status);
      mounts.set(appId, { context, element, startedAt: performance.now() });
      this.start();
      attachMount(appId);
      return {
        element,
        focus() {
          const windowId = warmWindows.get(appId);
          if (windowId) surfaces.activate(windowId);
        },
        unmount() {
          const windowId = warmWindows.get(appId);
          if (windowId) surfaces.detach(windowId);
          mounts.delete(appId);
        },
      };
    },
    schedule() {
      if (started || isConstrainedBoxedWineDevice(window)) return false;
      const start = () => {
        const preload = window.XPBoxedWinePreload?.preload();
        if (preload?.then) preload.catch(() => {}).finally(() => this.start());
        else this.start();
      };
      if (typeof requestIdleCallback === "function")
        requestIdleCallback(start, { timeout: 3000 });
      else setTimeout(start, 1500);
      return true;
    },
    start() {
      if (started) return;
      started = true;
      frame.src = runnerUrl();
    },
  };
};

const getRuntime = () => (runtime ||= createRuntime());

export const mountSharedBoxedWineApplication = (appId, context) =>
  getRuntime().mount(appId, context);

window.XPBoxedWineRuntime = Object.freeze({
  schedule: () => getRuntime().schedule(),
  start: () => getRuntime().start(),
});
