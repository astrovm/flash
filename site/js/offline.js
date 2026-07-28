"use strict";

(function exposeOfflineManager(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.AstroOffline = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const ENABLED_KEY = "offlineModeEnabled";
  const LAST_CHECKED_KEY = "astroFlashLastUpdateCheck";
  const DOWNLOAD_VERSION_KEY = "astroFlashDownloadVersion";
  const DOWNLOAD_BYTES_KEY = "astroFlashDownloadBytes";
  const DEFAULT_CHECK_INTERVAL = 60 * 60 * 1000;

  const waitForWorker = (worker) =>
    new Promise((resolve, reject) => {
      if (!worker || worker.state === "activated") {
        resolve();
        return;
      }
      if (worker.state === "redundant") {
        reject(new Error("The offline download was interrupted."));
        return;
      }
      const onStateChange = () => {
        if (worker.state === "activated") {
          worker.removeEventListener("statechange", onStateChange);
          resolve();
        } else if (worker.state === "redundant") {
          worker.removeEventListener("statechange", onStateChange);
          reject(new Error("The offline download was interrupted."));
        }
      };
      worker.addEventListener("statechange", onStateChange);
    });

  const createManager = ({
    currentVersion,
    environment = globalThis,
    serviceWorkerUrl = "sw.js",
    versionUrl = "version.json",
    cachePrefix = "astro-flash",
    checkInterval = DEFAULT_CHECK_INTERVAL,
  }) => {
    const navigatorObject = environment.navigator;
    const storage = environment.localStorage;
    const listeners = new Set();
    const trackedRegistrations = new WeakSet();
    const trackedWorkers = new WeakSet();
    let registration = null;
    let checkPromise = null;
    let reloadWhenControlled = false;
    let lifecycleListenersAttached = false;

    const cachedDownloadBytes =
      storage.getItem(DOWNLOAD_VERSION_KEY) === currentVersion
        ? Number(storage.getItem(DOWNLOAD_BYTES_KEY)) || null
        : null;
    let state = {
      enabled: storage.getItem(ENABLED_KEY) === "true",
      online: navigatorObject.onLine !== false,
      phase:
        storage.getItem(ENABLED_KEY) === "true" ? "starting" : "disabled",
      currentVersion,
      availableVersion: null,
      availableRevision: null,
      downloadBytes: cachedDownloadBytes,
      downloadMetadataError: false,
      lastChecked: Number(storage.getItem(LAST_CHECKED_KEY)) || null,
      updateReady: false,
      workerState: "unregistered",
      usage: null,
      quota: null,
      error: null,
    };

    const snapshot = () => ({ ...state });
    const notify = () => listeners.forEach((listener) => listener(snapshot()));
    const setState = (patch) => {
      state = { ...state, ...patch };
      notify();
    };

    const subscribe = (listener) => {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    };

    const refreshStorageEstimate = async () => {
      if (!navigatorObject.storage?.estimate) return snapshot();
      try {
        const estimate = await navigatorObject.storage.estimate();
        setState({
          usage: Number.isFinite(estimate.usage) ? estimate.usage : null,
          quota: Number.isFinite(estimate.quota) ? estimate.quota : null,
        });
      } catch {
        // Storage estimates are optional and should never break offline mode.
      }
      return snapshot();
    };

    const rememberVersionMetadata = (metadata) => {
      storage.setItem(DOWNLOAD_VERSION_KEY, metadata.version);
      storage.setItem(DOWNLOAD_BYTES_KEY, String(metadata.offlineBytes));
      setState({
        downloadBytes: metadata.offlineBytes,
        downloadMetadataError: false,
      });
    };

    const markWaitingUpdate = async (worker) => {
      if (!worker) return;
      let metadata = null;
      try {
        metadata = await fetchVersion();
        rememberVersionMetadata(metadata);
      } catch {
        // A waiting worker is enough to prove that an update is ready.
      }
      setState({
        phase: "update-ready",
        updateReady: true,
        workerState: "waiting",
        availableVersion: metadata?.version || state.availableVersion,
        availableRevision: metadata?.revision || state.availableRevision,
        downloadBytes: metadata?.offlineBytes || state.downloadBytes,
        error: null,
      });
    };

    const trackInstallingWorker = (worker, isUpdate) => {
      if (!worker || trackedWorkers.has(worker)) return;
      trackedWorkers.add(worker);
      setState({
        phase: isUpdate ? "updating" : "downloading",
        workerState: worker.state,
        error: null,
      });
      worker.addEventListener("statechange", () => {
        setState({ workerState: worker.state });
        if (worker.state === "installed" && registration?.waiting && isUpdate) {
          void markWaitingUpdate(registration.waiting);
        } else if (worker.state === "activated" && !isUpdate) {
          setState({ phase: "ready", workerState: "active", error: null });
          void refreshStorageEstimate();
        } else if (
          worker.state === "redundant" &&
          !registration?.active
        ) {
          setState({
            phase: "error",
            workerState: "failed",
            error: "The offline download did not complete.",
          });
        }
      });
    };

    const trackRegistration = (nextRegistration) => {
      registration = nextRegistration;
      if (trackedRegistrations.has(nextRegistration)) return;
      trackedRegistrations.add(nextRegistration);
      nextRegistration.addEventListener("updatefound", () => {
        trackInstallingWorker(
          nextRegistration.installing,
          Boolean(nextRegistration.active || navigatorObject.serviceWorker.controller),
        );
      });
      if (nextRegistration.waiting && nextRegistration.active) {
        void markWaitingUpdate(nextRegistration.waiting);
      } else if (nextRegistration.installing) {
        trackInstallingWorker(
          nextRegistration.installing,
          Boolean(nextRegistration.active || navigatorObject.serviceWorker.controller),
        );
      }
    };

    const registerAndWait = async () => {
      if (!navigatorObject.serviceWorker) {
        throw new Error("Offline mode is not supported by this browser.");
      }
      const nextRegistration = await navigatorObject.serviceWorker.register(
        serviceWorkerUrl,
        { updateViaCache: "none" },
      );
      trackRegistration(nextRegistration);

      if (nextRegistration.active) {
        setState({
          phase: nextRegistration.waiting ? "update-ready" : "ready",
          workerState: nextRegistration.waiting ? "waiting" : "active",
          updateReady: Boolean(nextRegistration.waiting),
          error: null,
        });
        return nextRegistration;
      }

      const worker = nextRegistration.installing || nextRegistration.waiting;
      if (worker) {
        setState({ phase: "downloading", workerState: worker.state, error: null });
        await waitForWorker(worker);
      } else {
        await navigatorObject.serviceWorker.ready;
      }
      setState({ phase: "ready", workerState: "active", error: null });
      await refreshStorageEstimate();
      return nextRegistration;
    };

    async function fetchVersion() {
      if (navigatorObject.onLine === false) {
        throw new Error("Connect to the internet to check for updates.");
      }
      const separator = versionUrl.includes("?") ? "&" : "?";
      const response = await environment.fetch(
        `${versionUrl}${separator}t=${environment.Date.now()}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error(`Update check failed (${response.status}).`);
      }
      const metadata = await response.json();
      if (
        typeof metadata.version !== "string" ||
        typeof metadata.revision !== "string" ||
        !Number.isFinite(metadata.offlineBytes) ||
        metadata.offlineBytes <= 0
      ) {
        throw new Error("The update server returned invalid version metadata.");
      }
      return metadata;
    }

    const checkForUpdates = async () => {
      if (checkPromise) return checkPromise;
      checkPromise = (async () => {
        const previousPhase = state.phase;
        setState({ phase: "checking", error: null });
        try {
          const metadata = await fetchVersion();
          rememberVersionMetadata(metadata);
          if (state.enabled) {
            if (!registration) await registerAndWait();
            await registration.update();
          }
          const checkedAt = environment.Date.now();
          storage.setItem(LAST_CHECKED_KEY, String(checkedAt));
          const updateAvailable = metadata.version !== currentVersion;
          setState({
            phase: updateAvailable
              ? registration?.waiting
                ? "update-ready"
                : "update-available"
              : state.enabled
                ? "ready"
                : "disabled",
            availableVersion: updateAvailable ? metadata.version : null,
            availableRevision: updateAvailable ? metadata.revision : null,
            downloadBytes: metadata.offlineBytes,
            lastChecked: checkedAt,
            updateReady: updateAvailable && Boolean(registration?.waiting),
            workerState: registration?.waiting
              ? "waiting"
              : registration?.active
                ? "active"
                : "unregistered",
            error: null,
          });
        } catch (error) {
          setState({
            phase:
              previousPhase === "disabled" || previousPhase === "ready"
                ? previousPhase
                : "error",
            error: error.message,
            downloadMetadataError: state.downloadBytes === null,
          });
          throw error;
        } finally {
          checkPromise = null;
        }
        return snapshot();
      })();
      return checkPromise;
    };

    const deleteOfflineCaches = async () => {
      if (!environment.caches) return;
      const names = await environment.caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(cachePrefix))
          .map((name) => environment.caches.delete(name)),
      );
    };

    const setEnabled = async (enabled) => {
      if (enabled) {
        storage.setItem(ENABLED_KEY, "true");
        setState({ enabled: true, phase: "starting", error: null });
        try {
          await registerAndWait();
          return snapshot();
        } catch (error) {
          setState({ phase: "error", error: error.message });
          throw error;
        }
      }

      const currentRegistration =
        registration ||
        (await navigatorObject.serviceWorker?.getRegistration("./"));
      if (currentRegistration) await currentRegistration.unregister();
      await deleteOfflineCaches();
      registration = null;
      storage.setItem(ENABLED_KEY, "false");
      setState({
        enabled: false,
        phase: "disabled",
        updateReady: false,
        workerState: "unregistered",
        usage: null,
        quota: null,
        error: null,
      });
      return snapshot();
    };

    const applyUpdate = async () => {
      if (registration?.waiting) {
        reloadWhenControlled = true;
        setState({ phase: "applying", error: null });
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
        return;
      }
      if (state.availableVersion && !state.enabled) {
        environment.location.reload();
        return;
      }
      throw new Error(
        registration?.installing
          ? "The update is still downloading."
          : "No update is ready to install.",
      );
    };

    const repair = async () => {
      if (navigatorObject.onLine === false) {
        throw new Error("Connect to the internet to repair offline files.");
      }
      setState({ phase: "repairing", error: null });
      const currentRegistration =
        registration ||
        (await navigatorObject.serviceWorker?.getRegistration("./"));
      if (currentRegistration) await currentRegistration.unregister();
      await deleteOfflineCaches();
      registration = null;
      storage.setItem(ENABLED_KEY, "true");
      setState({ enabled: true, phase: "starting", updateReady: false });
      await registerAndWait();
      await checkForUpdates();
      return snapshot();
    };

    const automaticCheck = () => {
      if (
        !state.enabled ||
        navigatorObject.onLine === false ||
        (state.lastChecked &&
          environment.Date.now() - state.lastChecked < checkInterval)
      ) {
        return;
      }
      void checkForUpdates().catch(() => {});
    };

    const attachLifecycleListeners = () => {
      if (lifecycleListenersAttached) return;
      lifecycleListenersAttached = true;
      navigatorObject.serviceWorker?.addEventListener(
        "controllerchange",
        () => {
          if (reloadWhenControlled) environment.location.reload();
        },
      );
      environment.addEventListener?.("online", () => {
        setState({ online: true });
        automaticCheck();
      });
      environment.addEventListener?.("offline", () => {
        setState({ online: false });
      });
      environment.document?.addEventListener("visibilitychange", () => {
        if (environment.document.visibilityState === "visible") automaticCheck();
      });
    };

    const initialize = async () => {
      attachLifecycleListeners();
      await refreshStorageEstimate();
      if (state.downloadBytes === null && navigatorObject.onLine !== false) {
        try {
          rememberVersionMetadata(await fetchVersion());
        } catch {
          setState({ downloadMetadataError: true });
        }
      }
      if (!state.enabled) return snapshot();
      try {
        await registerAndWait();
        automaticCheck();
      } catch (error) {
        setState({ phase: "error", error: error.message });
      }
      return snapshot();
    };

    return {
      applyUpdate,
      checkForUpdates,
      getSnapshot: snapshot,
      initialize,
      refreshStorageEstimate,
      repair,
      setEnabled,
      subscribe,
    };
  };

  return {
    createManager,
    waitForWorker,
  };
});
