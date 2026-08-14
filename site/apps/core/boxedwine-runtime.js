import { createBoxedWineWindowSurface } from "./boxedwine-window-bridge.js";

const RUNTIME_ROOT = "vendor/boxedwine/26R1/";
const ROOT_ARCHIVE = "xp-accessories";
const NATIVE_TITLE_BAR_HEIGHT = 28;
const APPLICATION_IDS = Object.freeze([
  "calculator",
  "solitaire",
  "freecell",
  "spider-solitaire",
]);
const APPLICATION_EXECUTABLES = Object.freeze({
  calculator: "calculator/calc.exe",
  solitaire: "solitaire/resize-host.exe",
  freecell: "freecell/resize-host.exe",
  "spider-solitaire": "spider-solitaire/resize-host.exe",
});
const applicationFromTitle = (title = "") => {
  const normalized = title.trim().toLowerCase();
  if (normalized.includes("spider")) return "spider-solitaire";
  if (normalized === "freecell") return "freecell";
  if (normalized === "solitaire") return "solitaire";
  if (normalized === "calculator" || normalized === "calc") return "calculator";
  return "";
};

let runtime;

const packageRoot = () => {
  const root =
    window.ASTRO_GAME_ROOTS?.["boxedwine-runtime"] ||
    "iframe/boxedwine-runtime/";
  const url = new URL(root, document.baseURI).href;
  return url.endsWith("/") ? url : `${url}/`;
};

const runnerUrl = (initialApplicationId) => {
  const url = new URL(`${RUNTIME_ROOT}index.html`, document.baseURI);
  const desktop = document.getElementById("desktop");
  const screenWidth = desktop?.clientWidth || window.innerWidth;
  const screenHeight = Math.min(
    desktop?.clientHeight || window.innerHeight,
    window.innerHeight - 30,
  );
  url.search = new URLSearchParams({
    appRoot: packageRoot(),
    root: ROOT_ARCHIVE,
    archive: "xp-runtime",
    executable: APPLICATION_EXECUTABLES[initialApplicationId],
    resolution: `${Math.max(320, screenWidth)}x${Math.max(240, screenHeight)}`,
    frameTop: "0",
    sound: "true",
    cache: "false",
    trace: "false",
    persistent: "true",
  });
  return url.href;
};

const createRuntime = (initialApplicationId) => {
  const frame = document.createElement("iframe");
  frame.className = "boxedwine-shared-runtime-frame";
  frame.title = "Shared Windows XP application runtime";
  frame.tabIndex = -1;

  const staging = document.createElement("div");
  staging.className = "boxedwine-shared-runtime-staging";
  document.body.append(frame, staging);

  const warmWindows = new Map();
  const processes = new Map();
  const processApplications = new Map();
  const launchingApplications = new Set([initialApplicationId]);
  const pendingFirstFrames = new Map();
  const launchFailures = new Map();
  const mounts = new Map();
  let request = 0;
  let recoveryAttempt = 0;
  let recoveryScheduled = false;
  let runtimeTimer = 0;
  let warmTimer = 0;
  let runtimeReady = false;
  let preparationComplete = false;
  let started = false;
  let resolvePrepared;
  let rejectPrepared;
  let resolveInitialized;
  let rejectInitialized;
  let initializationComplete = false;
  const initialized = new Promise((resolve, reject) => {
    resolveInitialized = resolve;
    rejectInitialized = reject;
  });
  initialized.catch(() => {});
  const prepared = new Promise((resolve, reject) => {
    resolvePrepared = resolve;
    rejectPrepared = reject;
  });
  prepared.catch(() => {});

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
    mounted.context.setSize(
      Number(canvas.dataset.boxedwineNativeWidth) || canvas.width,
      Number(canvas.dataset.boxedwineNativeHeight) || canvas.height,
    );
    mounted.element.dataset.boxedwineReady = "true";
    mounted.element.dataset.boxedwineOpenElapsed = String(
      Math.round(performance.now() - mounted.startedAt),
    );
    mounted.scheduleNativeWindow?.();
    return true;
  };

  const postProcessRequest = (type, appId, processId = 0) => {
    frame.contentWindow.postMessage(
      {
        type,
        appId,
        processId,
        requestId: `${type}:${appId}:${++request}`,
      },
      location.origin,
    );
  };

  const updatePreparation = () => {
    document.documentElement.dataset.boxedwineWarmApplications =
      APPLICATION_IDS.filter((appId) => warmWindows.has(appId)).join(",");
    if (APPLICATION_IDS.every((appId) => warmWindows.has(appId))) {
      window.clearTimeout(warmTimer);
      recoveryAttempt = 0;
      document.documentElement.dataset.boxedwineApplicationsReady = "true";
      delete document.documentElement.dataset.boxedwineRuntimeError;
      delete document.documentElement.dataset.boxedwineRuntimeRecovery;
      if (!preparationComplete) {
        preparationComplete = true;
        resolvePrepared();
      }
    }
  };

  const ensureWarmApplications = () => {
    if (!runtimeReady) return;
    if (!APPLICATION_IDS.every((appId) => warmWindows.has(appId))) {
      window.clearTimeout(warmTimer);
      warmTimer = window.setTimeout(
        () => recoverRuntime("application-warmup-timeout"),
        120000,
      );
    }
    const launchOrder = [
      ...APPLICATION_IDS.filter((appId) => mounts.has(appId)),
      ...APPLICATION_IDS,
    ];
    if (launchingApplications.size > 0) return;
    for (const appId of launchOrder) {
      if (
        warmWindows.has(appId) ||
        launchingApplications.has(appId) ||
        processes.has(appId)
      )
        continue;
      launchingApplications.add(appId);
      postProcessRequest("boxedwine-launch-process", appId);
      break;
    }
    updatePreparation();
  };

  const bindFirstFrame = (appId, windowId, processId = 0) => {
    if (!appId || warmWindows.has(appId)) return;
    warmWindows.set(appId, windowId);
    if (processId) {
      const launchProcessId = processes.get(appId);
      if (launchProcessId && launchProcessId !== processId)
        processApplications.delete(launchProcessId);
      processes.set(appId, processId);
      processApplications.set(processId, appId);
    }
    launchingApplications.delete(appId);
    launchFailures.delete(appId);
    surfaces.hide(windowId);
    attachMount(appId);
    updatePreparation();
    ensureWarmApplications();
  };

  const surfaces = createBoxedWineWindowSurface({
    host: staging,
    runtimeWindow: frame.contentWindow,
    origin: location.origin,
    initiallyVisible: false,
    onFirstFrame({ id, appId: nativeAppId, processId, title }) {
      const appId =
        nativeAppId ||
        processApplications.get(processId) ||
        applicationFromTitle(title) ||
        launchingApplications.values().next().value ||
        "";
      if (appId) bindFirstFrame(appId, id, processId);
      else if (processId) pendingFirstFrames.set(processId, id);
    },
    onOwnedWindow(detail) {
      const appId = APPLICATION_IDS.find(
        (candidate) => warmWindows.get(candidate) === detail.topId,
      );
      const mounted = appId ? mounts.get(appId) : null;
      if (!mounted) return;
      if (detail.type === "hidden") {
        mounted.context.removeNativeOwnedWindow(detail.id);
        return;
      }
      mounted.context.upsertNativeOwnedWindow({
        ...detail,
        close: () => surfaces.command(detail.id, "close"),
        focus: () => surfaces.activate(detail.id),
      });
    },
    onLifecycle(detail) {
      const appId = APPLICATION_IDS.find(
        (candidate) => warmWindows.get(candidate) === detail.topId,
      );
      if (!appId) return;
      const mounted = mounts.get(appId);
      if (
        detail.type === "title" &&
        detail.id === detail.topId &&
        detail.title
      ) {
        mounted?.context.setTitle(detail.title);
      } else if (detail.type === "bounds" && detail.id === detail.topId) {
        mounted?.context.applyNativeClientSize(
          detail.width,
          Math.max(1, detail.height - NATIVE_TITLE_BAR_HEIGHT),
        );
      } else if (detail.type === "unmapped" && detail.id === detail.topId) {
        mounted?.context.applyNativeMinimize();
      } else if (detail.type === "mapped" && detail.id === detail.topId) {
        mounted?.context.applyNativeRestore();
      } else if (
        detail.id === detail.topId &&
        (detail.type === "focused" || detail.type === "raised")
      ) {
        mounted?.context.applyNativeFocus();
      } else if (detail.type === "destroyed" && detail.id === detail.topId) {
        const processId = processes.get(appId);
        warmWindows.delete(appId);
        processes.delete(appId);
        delete document.documentElement.dataset.boxedwineApplicationsReady;
        if (processId) {
          processApplications.delete(processId);
          postProcessRequest("boxedwine-terminate-process", appId, processId);
        }
        if (mounted) {
          mounts.delete(appId);
          mounted.context.applyNativeClose();
        }
        if (!processId) ensureWarmApplications();
      }
    },
  });

  const showLoadingState = () => {
    for (const mounted of mounts.values()) {
      mounted.context.clearNativeOwnedWindows();
      const status = document.createElement("span");
      status.className = "boxedwine-shared-loading";
      status.textContent = "Restarting Windows application…";
      mounted.element.replaceChildren(status);
      delete mounted.element.dataset.boxedwineReady;
      delete mounted.element.dataset.boxedwineOpenElapsed;
    }
  };

  const failRuntime = (reason) => {
    window.clearTimeout(runtimeTimer);
    window.clearTimeout(warmTimer);
    document.documentElement.dataset.boxedwineRuntimeState = "failed";
    document.documentElement.dataset.boxedwineRuntimeError = reason;
    const instruction = document.querySelector(".welcome-instruction");
    if (instruction)
      instruction.textContent =
        "Windows applications could not start. Reload this page to try again.";
    if (!preparationComplete)
      rejectPrepared(
        new Error("The Windows application runtime did not start"),
      );
    if (!initializationComplete)
      rejectInitialized(
        new Error("The Windows application runtime did not start"),
      );
  };

  const startRuntimeAttempt = () => {
    recoveryScheduled = false;
    const url = new URL(runnerUrl(initialApplicationId));
    if (recoveryAttempt) url.searchParams.set("recovery", recoveryAttempt);
    frame.src = url.href;
    window.clearTimeout(runtimeTimer);
    runtimeTimer = window.setTimeout(
      () => recoverRuntime("startup-timeout"),
      30000,
    );
  };

  const recoverRuntime = (reason) => {
    if (recoveryScheduled) return;
    if (recoveryAttempt >= 2) {
      failRuntime(reason);
      return;
    }
    recoveryAttempt += 1;
    recoveryScheduled = true;
    window.clearTimeout(runtimeTimer);
    window.clearTimeout(warmTimer);
    runtimeReady = false;
    document.documentElement.dataset.boxedwineRuntimeState = "recovering";
    document.documentElement.dataset.boxedwineRuntimeRecovery = `${recoveryAttempt}:${reason}`;
    delete document.documentElement.dataset.boxedwineApplicationsReady;
    warmWindows.clear();
    processes.clear();
    processApplications.clear();
    pendingFirstFrames.clear();
    launchFailures.clear();
    launchingApplications.clear();
    launchingApplications.add(initialApplicationId);
    surfaces.reset();
    showLoadingState();
    window.setTimeout(startRuntimeAttempt, 250);
  };

  const onMessage = (event) => {
    if (
      event.source !== frame.contentWindow ||
      event.origin !== location.origin
    )
      return;
    if (event.data?.type === "boxedwine-runtime-ready") {
      window.clearTimeout(runtimeTimer);
      document.documentElement.dataset.boxedwineRuntimeState = "ready";
      runtimeReady = true;
      if (!initializationComplete) {
        initializationComplete = true;
        resolveInitialized();
      }
      ensureWarmApplications();
    } else if (event.data?.type === "boxedwine-runtime-failed") {
      recoverRuntime(event.data.reason || "runtime-failed");
    } else if (
      event.data?.type === "boxedwine-process-launched" &&
      APPLICATION_IDS.includes(event.data.appId) &&
      !event.data.error
    ) {
      processes.set(event.data.appId, event.data.processId);
      processApplications.set(event.data.processId, event.data.appId);
      document.documentElement.dataset.boxedwineLastProcess = `${event.data.appId}:${event.data.processId}`;
      const pendingWindowId = pendingFirstFrames.get(event.data.processId);
      if (pendingWindowId) {
        pendingFirstFrames.delete(event.data.processId);
        bindFirstFrame(event.data.appId, pendingWindowId, event.data.processId);
      }
    } else if (
      event.data?.type === "boxedwine-process-launched" &&
      APPLICATION_IDS.includes(event.data.appId) &&
      event.data.error
    ) {
      launchingApplications.delete(event.data.appId);
      const failures = (launchFailures.get(event.data.appId) || 0) + 1;
      launchFailures.set(event.data.appId, failures);
      document.documentElement.dataset.boxedwineRuntimeError = `launch:${event.data.appId}:${event.data.error}`;
      if (failures < 3) window.setTimeout(ensureWarmApplications, 250);
      else recoverRuntime(`launch:${event.data.appId}:${event.data.error}`);
    } else if (
      event.data?.type === "boxedwine-process-exited" &&
      APPLICATION_IDS.includes(event.data.appId) &&
      processes.get(event.data.appId) === event.data.processId
    ) {
      const appId = event.data.appId;
      const launchFailed = launchingApplications.delete(appId);
      const windowId = warmWindows.get(appId);
      const mounted = mounts.get(appId);
      warmWindows.delete(appId);
      processes.delete(appId);
      processApplications.delete(event.data.processId);
      document.documentElement.dataset.boxedwineLastExit = `${appId}:${event.data.processId}`;
      if (windowId) surfaces.remove(windowId);
      if (mounted) {
        mounts.delete(appId);
        mounted.context.applyNativeClose();
      }
      delete document.documentElement.dataset.boxedwineApplicationsReady;
      if (launchFailed) {
        const failures = (launchFailures.get(appId) || 0) + 1;
        launchFailures.set(appId, failures);
        document.documentElement.dataset.boxedwineRuntimeError = `launch:${appId}:process-exited`;
        if (failures < 3) window.setTimeout(ensureWarmApplications, 250);
        else recoverRuntime(`launch:${appId}:process-exited`);
      } else {
        ensureWarmApplications();
      }
    } else if (
      event.data?.type === "boxedwine-process-terminated" &&
      APPLICATION_IDS.includes(event.data.appId) &&
      !event.data.error
    ) {
      document.documentElement.dataset.boxedwineLastTermination = `${event.data.appId}:${event.data.processId}`;
      ensureWarmApplications();
    }
  };
  window.addEventListener("message", onMessage);
  frame.addEventListener("error", () => {
    recoverRuntime("load");
  });

  return {
    mount(appId, context) {
      const element = document.createElement("div");
      element.className = "window-content boxedwine-shared-app-host";
      const status = document.createElement("span");
      status.className = "boxedwine-shared-loading";
      status.textContent = "Starting Windows application…";
      element.appendChild(status);
      mounts.set(appId, { context, element, startedAt: performance.now() });
      let resizeFrame = 0;
      let pendingWindowAction = "bounds";
      const syncNativeWindow = () => {
        resizeFrame = 0;
        const windowId = warmWindows.get(appId);
        const width = element.clientWidth;
        const height = element.clientHeight;
        if (!windowId || width <= 0 || height <= 0) return false;
        const action = pendingWindowAction;
        pendingWindowAction = "bounds";
        return surfaces.command(windowId, action, {
          x: context.windowElement.offsetLeft,
          y: context.windowElement.offsetTop,
          appId,
          width,
          height: height + NATIVE_TITLE_BAR_HEIGHT,
        });
      };
      const scheduleNativeWindow = (action = "bounds") => {
        if (action !== "bounds") pendingWindowAction = action;
        if (!resizeFrame)
          resizeFrame = window.requestAnimationFrame(syncNativeWindow);
        return Boolean(warmWindows.get(appId));
      };
      mounts.get(appId).scheduleNativeWindow = scheduleNativeWindow;
      const resizeObserver = new window.ResizeObserver(() => {
        scheduleNativeWindow();
      });
      resizeObserver.observe(element);
      this.start();
      attachMount(appId);
      if (!warmWindows.has(appId)) {
        delete document.documentElement.dataset.boxedwineApplicationsReady;
        ensureWarmApplications();
      }
      return {
        element,
        focus() {
          const windowId = warmWindows.get(appId);
          if (windowId) surfaces.activate(windowId);
        },
        minimize() {
          const windowId = warmWindows.get(appId);
          return windowId ? surfaces.command(windowId, "minimize") : false;
        },
        maximize() {
          return scheduleNativeWindow("maximize");
        },
        restore() {
          return scheduleNativeWindow("restore");
        },
        bounds() {
          return scheduleNativeWindow();
        },
        unmount() {
          resizeObserver.disconnect();
          if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
          context.clearNativeOwnedWindows();
          const windowId = warmWindows.get(appId);
          const processId = processes.get(appId);
          if (windowId) {
            surfaces.detach(windowId);
            surfaces.command(windowId, "close");
          }
          warmWindows.delete(appId);
          processes.delete(appId);
          delete document.documentElement.dataset.boxedwineApplicationsReady;
          if (processId) {
            processApplications.delete(processId);
            window.setTimeout(
              () =>
                postProcessRequest(
                  "boxedwine-terminate-process",
                  appId,
                  processId,
                ),
              500,
            );
          }
          mounts.delete(appId);
        },
      };
    },
    ready() {
      this.start();
      return initialized;
    },
    applicationsReady() {
      this.start();
      return prepared;
    },
    start() {
      if (started) return initialized;
      started = true;
      startRuntimeAttempt();
      return initialized;
    },
  };
};

const getRuntime = (initialApplicationId = "calculator") =>
  (runtime ||= createRuntime(initialApplicationId));

export const mountSharedBoxedWineApplication = (appId, context) =>
  getRuntime(appId).mount(appId, context);

window.XPBoxedWineRuntime = Object.freeze({
  ready: () => getRuntime().ready(),
  applicationsReady: () => getRuntime().applicationsReady(),
  start: () => getRuntime().start(),
});
