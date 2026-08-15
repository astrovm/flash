import { createBoxedWineWindowSurface } from "./boxedwine-window-surface.js";
import { getBoxedWineApplication } from "./boxedwine-applications.js";

const RUNTIME_ROOT = "vendor/boxedwine/26R1/";
const ROOT_ARCHIVE = "xp-accessories";
const NATIVE_TITLE_BAR_HEIGHT = 28;

let runtime;

const packageRoot = () => {
  const root =
    window.ASTRO_GAME_ROOTS?.["boxedwine-runtime"] ||
    "iframe/boxedwine-runtime/";
  const url = new URL(root, document.baseURI).href;
  return url.endsWith("/") ? url : `${url}/`;
};

const runnerUrl = (initialApplicationId) => {
  const application = getBoxedWineApplication(initialApplicationId);
  if (!application)
    throw new TypeError(
      `Unknown BoxedWine application: ${initialApplicationId}`,
    );
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
    executable: application.executable,
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

  const runningWindows = new Map();
  const processes = new Map();
  const processApplications = new Map();
  const windowApplications = new Map();
  const launchingApplications = new Set([initialApplicationId]);
  const pendingFirstFrames = new Map();
  const pendingWindowDestructions = new Set();
  const pendingNativeMinimizes = new Map();
  const launchFailures = new Map();
  const mounts = new Map();
  let request = 0;
  let recoveryAttempt = 0;
  let recoveryScheduled = false;
  let runtimeTimer = 0;
  let launchTimer = 0;
  let runtimeReady = false;
  let mountedReadinessComplete = false;
  let started = false;
  let resolveMountedReady;
  let rejectMountedReady;
  let resolveInitialized;
  let rejectInitialized;
  let initializationComplete = false;
  const initialized = new Promise((resolve, reject) => {
    resolveInitialized = resolve;
    rejectInitialized = reject;
  });
  initialized.catch(() => {});
  const mountedReady = new Promise((resolve, reject) => {
    resolveMountedReady = resolve;
    rejectMountedReady = reject;
  });
  mountedReady.catch(() => {});

  const attachMount = (appId) => {
    const mounted = mounts.get(appId);
    const windowId = runningWindows.get(appId);
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

  const cancelWindowDestruction = (appId) => {
    pendingWindowDestructions.delete(appId);
  };

  const cancelNativeMinimize = (appId) => {
    const timer = pendingNativeMinimizes.get(appId);
    if (timer) window.clearTimeout(timer);
    pendingNativeMinimizes.delete(appId);
  };

  const scheduleNativeMinimize = (appId, windowId) => {
    cancelNativeMinimize(appId);
    pendingNativeMinimizes.set(
      appId,
      window.setTimeout(() => {
        pendingNativeMinimizes.delete(appId);
        if (runningWindows.get(appId) === windowId)
          mounts.get(appId)?.context.applyNativeMinimize();
      }, 100),
    );
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

  const updateMountedReadiness = () => {
    document.documentElement.dataset.boxedwineRunningApplications = [
      ...runningWindows.keys(),
    ].join(",");
    if (
      mounts.size > 0 &&
      [...mounts.keys()].every((appId) => runningWindows.has(appId))
    ) {
      window.clearTimeout(launchTimer);
      recoveryAttempt = 0;
      document.documentElement.dataset.boxedwineMountedApplicationsReady =
        "true";
      delete document.documentElement.dataset.boxedwineRuntimeError;
      delete document.documentElement.dataset.boxedwineRuntimeRecovery;
      if (!mountedReadinessComplete) {
        mountedReadinessComplete = true;
        resolveMountedReady();
      }
    }
  };

  const ensureMountedApplications = () => {
    if (!runtimeReady) return;
    const missingApplications = [...mounts.keys()].filter(
      (appId) => !runningWindows.has(appId) && !processes.has(appId),
    );
    if (missingApplications.length > 0) {
      window.clearTimeout(launchTimer);
      launchTimer = window.setTimeout(
        () => recoverRuntime("application-warmup-timeout"),
        120000,
      );
    }
    if (launchingApplications.size > 0) return;
    for (const appId of missingApplications) {
      if (
        runningWindows.has(appId) ||
        launchingApplications.has(appId) ||
        processes.has(appId)
      )
        continue;
      launchingApplications.add(appId);
      postProcessRequest("boxedwine-launch-process", appId);
      break;
    }
    updateMountedReadiness();
  };

  const bindFirstFrame = (appId, windowId, processId = 0) => {
    if (!appId || runningWindows.get(appId) === windowId) return;
    if (!mounts.has(appId)) {
      launchingApplications.delete(appId);
      surfaces.remove(windowId);
      if (processId)
        postProcessRequest("boxedwine-terminate-process", appId, processId);
      ensureMountedApplications();
      return;
    }
    const replacesDestroyedWindow = pendingWindowDestructions.has(appId);
    cancelNativeMinimize(appId);
    const currentWindowId = runningWindows.get(appId);
    if (currentWindowId) {
      const currentProcessId = Number(
        surfaces.getCanvas(currentWindowId)?.dataset.boxedwineProcess || 0,
      );
      if (!processId || processId !== currentProcessId) return;
      surfaces.hide(currentWindowId);
    }
    cancelWindowDestruction(appId);
    runningWindows.set(appId, windowId);
    windowApplications.set(windowId, appId);
    if (processId) {
      const launchProcessId = processes.get(appId);
      if (launchProcessId && launchProcessId !== processId)
        processApplications.delete(launchProcessId);
      processes.set(appId, processId);
      processApplications.set(processId, appId);
      postProcessRequest("boxedwine-observe-process", appId, processId);
    }
    launchingApplications.delete(appId);
    launchFailures.delete(appId);
    surfaces.hide(windowId);
    attachMount(appId);
    if (replacesDestroyedWindow)
      mounts.get(appId)?.context.applyNativeRestore();
    updateMountedReadiness();
    ensureMountedApplications();
  };

  const surfaces = createBoxedWineWindowSurface({
    host: staging,
    runtimeWindow: () => frame.contentWindow,
    origin: location.origin,
    initiallyVisible: false,
    onFirstFrame({ id, appId: nativeAppId, processId }) {
      const appId =
        nativeAppId ||
        processApplications.get(processId) ||
        launchingApplications.values().next().value ||
        "";
      if (appId) bindFirstFrame(appId, id, processId);
      else if (processId) pendingFirstFrames.set(processId, id);
    },
    onOwnedWindow(detail) {
      const appId = windowApplications.get(detail.topId);
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
      const appId = windowApplications.get(detail.topId);
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
        scheduleNativeMinimize(appId, detail.id);
      } else if (detail.type === "mapped" && detail.id === detail.topId) {
        cancelNativeMinimize(appId);
        mounted?.context.applyNativeRestore();
      } else if (
        detail.id === detail.topId &&
        (detail.type === "focused" || detail.type === "raised")
      ) {
        mounted?.context.applyNativeFocus();
      } else if (detail.type === "destroyed" && detail.id === detail.topId) {
        windowApplications.delete(detail.topId);
        cancelNativeMinimize(appId);
        if (mounted) {
          const status = document.createElement("span");
          status.className = "boxedwine-shared-loading";
          status.textContent = "Updating Windows application…";
          mounted.element.replaceChildren(status);
        }
        runningWindows.delete(appId);
        delete document.documentElement.dataset
          .boxedwineMountedApplicationsReady;
        pendingWindowDestructions.add(appId);
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
    window.clearTimeout(launchTimer);
    document.documentElement.dataset.boxedwineRuntimeState = "failed";
    document.documentElement.dataset.boxedwineRuntimeError = reason;
    const instruction = document.querySelector(".welcome-instruction");
    if (instruction)
      instruction.textContent =
        "Windows applications could not start. Reload this page to try again.";
    if (!mountedReadinessComplete)
      rejectMountedReady(
        new Error("The Windows application runtime did not start"),
      );
    if (!initializationComplete)
      rejectInitialized(
        new Error("The Windows application runtime did not start"),
      );
  };

  const startRuntimeAttempt = () => {
    recoveryScheduled = false;
    const startupApplicationId =
      mounts.keys().next().value || initialApplicationId;
    launchingApplications.clear();
    launchingApplications.add(startupApplicationId);
    const url = new URL(runnerUrl(startupApplicationId));
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
    if (mounts.size === 0) {
      runtimeReady = false;
      started = false;
      frame.src = "about:blank";
      surfaces.reset();
      document.documentElement.dataset.boxedwineRuntimeState = "idle";
      document.documentElement.dataset.boxedwineRuntimeError = reason;
      return;
    }
    if (recoveryAttempt >= 2) {
      failRuntime(reason);
      return;
    }
    recoveryAttempt += 1;
    recoveryScheduled = true;
    window.clearTimeout(runtimeTimer);
    window.clearTimeout(launchTimer);
    runtimeReady = false;
    document.documentElement.dataset.boxedwineRuntimeState = "recovering";
    document.documentElement.dataset.boxedwineRuntimeRecovery = `${recoveryAttempt}:${reason}`;
    delete document.documentElement.dataset.boxedwineMountedApplicationsReady;
    runningWindows.clear();
    processes.clear();
    processApplications.clear();
    windowApplications.clear();
    pendingFirstFrames.clear();
    pendingWindowDestructions.clear();
    for (const appId of pendingNativeMinimizes.keys())
      cancelNativeMinimize(appId);
    launchFailures.clear();
    launchingApplications.clear();
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
      ensureMountedApplications();
    } else if (event.data?.type === "boxedwine-runtime-failed") {
      recoverRuntime(event.data.reason || "runtime-failed");
    } else if (
      event.data?.type === "boxedwine-process-launched" &&
      getBoxedWineApplication(event.data.appId) &&
      !event.data.error
    ) {
      processes.set(event.data.appId, event.data.processId);
      processApplications.set(event.data.processId, event.data.appId);
      if (!mounts.has(event.data.appId)) {
        launchingApplications.delete(event.data.appId);
        processes.delete(event.data.appId);
        processApplications.delete(event.data.processId);
        postProcessRequest(
          "boxedwine-terminate-process",
          event.data.appId,
          event.data.processId,
        );
        ensureMountedApplications();
        return;
      }
      document.documentElement.dataset.boxedwineLastProcess = `${event.data.appId}:${event.data.processId}`;
      const pendingWindowId = pendingFirstFrames.get(event.data.processId);
      if (pendingWindowId) {
        pendingFirstFrames.delete(event.data.processId);
        bindFirstFrame(event.data.appId, pendingWindowId, event.data.processId);
      }
    } else if (
      event.data?.type === "boxedwine-process-launched" &&
      getBoxedWineApplication(event.data.appId) &&
      event.data.error
    ) {
      launchingApplications.delete(event.data.appId);
      const failures = (launchFailures.get(event.data.appId) || 0) + 1;
      launchFailures.set(event.data.appId, failures);
      document.documentElement.dataset.boxedwineRuntimeError = `launch:${event.data.appId}:${event.data.error}`;
      if (!mounts.has(event.data.appId)) ensureMountedApplications();
      else if (failures < 3) window.setTimeout(ensureMountedApplications, 250);
      else recoverRuntime(`launch:${event.data.appId}:${event.data.error}`);
    } else if (
      event.data?.type === "boxedwine-process-exited" &&
      getBoxedWineApplication(event.data.appId) &&
      processes.get(event.data.appId) === event.data.processId
    ) {
      const appId = event.data.appId;
      cancelWindowDestruction(appId);
      cancelNativeMinimize(appId);
      const launchFailed = launchingApplications.delete(appId);
      const windowId = runningWindows.get(appId);
      const mounted = mounts.get(appId);
      runningWindows.delete(appId);
      if (windowId) windowApplications.delete(windowId);
      processes.delete(appId);
      processApplications.delete(event.data.processId);
      document.documentElement.dataset.boxedwineLastExit = `${appId}:${event.data.processId}`;
      if (windowId) surfaces.remove(windowId);
      delete document.documentElement.dataset.boxedwineMountedApplicationsReady;
      if (launchFailed && mounted) {
        const failures = (launchFailures.get(appId) || 0) + 1;
        launchFailures.set(appId, failures);
        document.documentElement.dataset.boxedwineRuntimeError = `launch:${appId}:process-exited`;
        if (failures < 3) window.setTimeout(ensureMountedApplications, 250);
        else recoverRuntime(`launch:${appId}:process-exited`);
      } else {
        if (mounted) {
          mounts.delete(appId);
          mounted.context.applyNativeClose();
        }
        ensureMountedApplications();
      }
    } else if (
      event.data?.type === "boxedwine-process-terminated" &&
      getBoxedWineApplication(event.data.appId) &&
      !event.data.error
    ) {
      document.documentElement.dataset.boxedwineLastTermination = `${event.data.appId}:${event.data.processId}`;
      ensureMountedApplications();
    }
  };
  window.addEventListener("message", onMessage);
  frame.addEventListener("error", () => {
    recoverRuntime("load");
  });

  return {
    mount(appId, context) {
      if (!getBoxedWineApplication(appId))
        throw new TypeError(`Unknown BoxedWine application: ${appId}`);
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
        const windowId = runningWindows.get(appId);
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
        return Boolean(runningWindows.get(appId));
      };
      mounts.get(appId).scheduleNativeWindow = scheduleNativeWindow;
      const resizeObserver = new window.ResizeObserver(() => {
        scheduleNativeWindow();
      });
      resizeObserver.observe(element);
      this.start();
      attachMount(appId);
      if (!runningWindows.has(appId)) {
        delete document.documentElement.dataset
          .boxedwineMountedApplicationsReady;
        ensureMountedApplications();
      }
      return {
        element,
        focus() {
          const windowId = runningWindows.get(appId);
          if (windowId) surfaces.activate(windowId);
        },
        minimize() {
          const windowId = runningWindows.get(appId);
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
          cancelNativeMinimize(appId);
          resizeObserver.disconnect();
          if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
          context.clearNativeOwnedWindows();
          const windowId = runningWindows.get(appId);
          const processId = processes.get(appId);
          if (windowId) {
            surfaces.detach(windowId);
            surfaces.command(windowId, "close");
          }
          runningWindows.delete(appId);
          if (windowId) windowApplications.delete(windowId);
          processes.delete(appId);
          delete document.documentElement.dataset
            .boxedwineMountedApplicationsReady;
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
      return mountedReady;
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
