"use strict";

(function exposeOfflineManager(root, factory) {
  const storagePolicy =
    typeof module === "object" && module.exports
      ? require("./storage-policy.js")
      : root.AstroStoragePolicy;
  const api = factory(storagePolicy);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.AstroOffline = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, (storagePolicy) => {
  const LAST_CHECKED_KEY = "astroFlashLastUpdateCheck";
  const DOWNLOAD_VERSION_KEY = "astroFlashDownloadVersion";
  const DOWNLOAD_BYTES_KEY = "astroFlashDownloadBytes";
  const GAME_RECORDS_KEY = "astroFlashOfflineGameRecords";
  const ACTIVE_VERSION_RELOAD_KEY = "astroFlashActiveVersionReload";
  const BUNDLED_GAME_CACHE = "astro-bundled-games-v1";
  const DEFAULT_CHECK_INTERVAL = 60 * 60 * 1000;
  const UPDATE_RETRY_DELAY = 30 * 1000;

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

  const safeRecords = (storage) => {
    try {
      const parsed = JSON.parse(storage.getItem(GAME_RECORDS_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  };

  const validManifestFile = (file) =>
    file &&
    typeof file.url === "string" &&
    !file.url.startsWith("/") &&
    !file.url.includes("\\") &&
    !file.url
      .split("/")
      .some((part) => !part || part === "." || part === "..") &&
    Number.isInteger(file.bytes) &&
    file.bytes >= 0 &&
    typeof file.integrity === "string" &&
    /^sha384-[A-Za-z0-9+/]+={0,2}$/.test(file.integrity);

  const validateManifestEntry = (entry) =>
    entry &&
    typeof entry.revision === "string" &&
    Number.isInteger(entry.bytes) &&
    entry.bytes >= 0 &&
    Array.isArray(entry.files) &&
    entry.files.every(validManifestFile);

  const validateGameManifest = (manifest) => {
    if (
      !manifest ||
      typeof manifest.version !== "string" ||
      !validateManifestEntry(manifest.runtime) ||
      !manifest.games ||
      typeof manifest.games !== "object" ||
      Array.isArray(manifest.games)
    ) {
      throw new Error("The offline game catalog is invalid.");
    }
    if (
      manifest.runtimes !== undefined &&
      (!manifest.runtimes ||
        typeof manifest.runtimes !== "object" ||
        Array.isArray(manifest.runtimes))
    ) {
      throw new Error("The offline game catalog is invalid.");
    }
    for (const [id, entry] of Object.entries(manifest.runtimes || {})) {
      if (!/^[a-z0-9-]+$/.test(id) || !validateManifestEntry(entry)) {
        throw new Error("The offline game catalog is invalid.");
      }
    }
    for (const [id, entry] of Object.entries(manifest.games)) {
      if (
        !/^[a-z0-9-]+$/.test(id) ||
        !validateManifestEntry(entry) ||
        !["swf", "iframe"].includes(entry.type) ||
        entry.root !== `${entry.type}/${id}.${entry.revision}/` ||
        (entry.runtime !== undefined &&
          (!/^[a-z0-9-]+$/.test(entry.runtime) ||
            !manifest.runtimes?.[entry.runtime]))
      ) {
        throw new Error("The offline game catalog is invalid.");
      }
    }
    return manifest;
  };

  const createManager = ({
    currentVersion,
    environment = globalThis,
    serviceWorkerUrl = "/sw.js",
    versionUrl = "/version.json",
    gameManifestUrl = "offline-games.json",
    cachePrefix = "astro-flash",
    bundledCacheName = BUNDLED_GAME_CACHE,
    checkInterval = DEFAULT_CHECK_INTERVAL,
  }) => {
    const navigatorObject = environment.navigator;
    const storage = environment.localStorage;
    const sessionStorage = environment.sessionStorage || storage;
    const listeners = new Set();
    const trackedRegistrations = new WeakSet();
    const trackedWorkers = new WeakSet();
    const records = safeRecords(storage);
    let registration = null;
    let manifest = null;
    let checkPromise = null;
    let reloadWhenControlled = false;
    let lifecycleListenersAttached = false;
    let updateRetryTimer = null;
    let bypassWorkerCdn = false;

    const versionedServiceWorkerUrl = (version) => {
      const separator = serviceWorkerUrl.includes("?") ? "&" : "?";
      const versionedUrl = `${serviceWorkerUrl}${separator}v=${encodeURIComponent(version)}`;
      return bypassWorkerCdn
        ? `${versionedUrl}&retry=${environment.Date.now()}`
        : versionedUrl;
    };

    const scheduleUpdateRetry = () => {
      if (updateRetryTimer !== null) return;
      updateRetryTimer = (environment.setTimeout || setTimeout)(() => {
        updateRetryTimer = null;
        void checkForUpdates().catch(() => {});
      }, UPDATE_RETRY_DELAY);
    };

    const requestWorkerVersion = (worker) =>
      new Promise((resolve) => {
        const MessageChannelConstructor =
          environment.MessageChannel || globalThis.MessageChannel;
        if (!worker || !MessageChannelConstructor) {
          resolve(null);
          return;
        }
        const channel = new MessageChannelConstructor();
        let settled = false;
        const finish = (version = null) => {
          if (settled) return;
          settled = true;
          channel.port1.close?.();
          channel.port2.close?.();
          resolve(typeof version === "string" ? version : null);
        };
        channel.port1.onmessage = (event) => finish(event.data?.version);
        try {
          worker.postMessage({ type: "GET_VERSION" }, [channel.port2]);
        } catch {
          finish();
          return;
        }
        (environment.setTimeout || setTimeout)(() => finish(), 250);
      });

    const cachedDownloadBytes =
      storage.getItem(DOWNLOAD_VERSION_KEY) === currentVersion
        ? Number(storage.getItem(DOWNLOAD_BYTES_KEY)) || null
        : null;
    let state = {
      enabled: true,
      online: navigatorObject.onLine !== false,
      phase: "starting",
      currentVersion,
      availableVersion: null,
      availableRevision: null,
      downloadBytes: cachedDownloadBytes,
      bundledGameBytes: null,
      downloadMetadataError: false,
      lastChecked: Number(storage.getItem(LAST_CHECKED_KEY)) || null,
      updateReady: false,
      workerState: "unregistered",
      usage: null,
      quota: null,
      error: null,
      bundledGames: [],
      downloadedGameIds: Object.keys(records).filter(
        (id) => !id.startsWith("__runtime__"),
      ),
      downloadedGameBytes: Object.values(records).reduce(
        (total, record) => total + (Number(record.bytes) || 0),
        0,
      ),
      gamePhase: "idle",
      activeGameId: null,
      gameProgressLoaded: 0,
      gameProgressTotal: 0,
      gameError: null,
    };

    const snapshot = () => ({
      ...state,
      bundledGames: state.bundledGames.map((game) => ({ ...game })),
      downloadedGameIds: [...state.downloadedGameIds],
    });
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

    const persistRecords = () => {
      storage.setItem(GAME_RECORDS_KEY, JSON.stringify(records));
      const downloadedGameIds = Object.keys(records).filter(
        (id) => !id.startsWith("__runtime__"),
      );
      setState({
        downloadedGameIds,
        downloadedGameBytes: Object.values(records).reduce(
          (total, record) => total + (Number(record.bytes) || 0),
          0,
        ),
      });
    };

    const refreshStorageEstimate = async () => {
      const estimate = await storagePolicy.estimate(navigatorObject.storage);
      if (!estimate) return snapshot();
      setState({ usage: estimate.usage, quota: estimate.quota });
      return snapshot();
    };

    const rememberVersionMetadata = (metadata) => {
      storage.setItem(DOWNLOAD_VERSION_KEY, metadata.version);
      storage.setItem(DOWNLOAD_BYTES_KEY, String(metadata.offlineBytes));
      setState({
        downloadBytes: metadata.offlineBytes,
        bundledGameBytes: metadata.bundledGameBytes,
        downloadMetadataError: false,
      });
    };

    const markWaitingUpdate = async (worker, knownMetadata = null) => {
      if (!worker) return;
      let metadata = knownMetadata;
      try {
        metadata ||= await fetchVersion();
        rememberVersionMetadata(metadata);
      } catch {
        scheduleUpdateRetry();
        return false;
      }
      const workerVersion = await requestWorkerVersion(worker);
      if (workerVersion !== metadata.version) {
        bypassWorkerCdn = true;
        setState({
          phase: "updating",
          updateReady: false,
          workerState: "waiting",
          availableVersion: metadata.version,
          availableRevision: metadata.revision,
          downloadBytes: metadata.offlineBytes,
          error: null,
        });
        scheduleUpdateRetry();
        return false;
      }
      bypassWorkerCdn = false;
      setState({
        phase: "update-ready",
        updateReady: true,
        workerState: "waiting",
        availableVersion: metadata?.version || state.availableVersion,
        availableRevision: metadata?.revision || state.availableRevision,
        downloadBytes: metadata?.offlineBytes || state.downloadBytes,
        error: null,
      });
      return true;
    };

    const reconcileActiveVersion = async (targetVersion) => {
      if (!targetVersion || targetVersion === currentVersion) {
        sessionStorage.removeItem?.(ACTIVE_VERSION_RELOAD_KEY);
        return false;
      }
      const activeVersion = await requestWorkerVersion(registration?.active);
      if (activeVersion !== targetVersion) return false;

      setState({
        availableVersion: targetVersion,
        availableRevision: targetVersion.split("-").at(-1) || null,
      });
      if (sessionStorage.getItem(ACTIVE_VERSION_RELOAD_KEY) === targetVersion) {
        setState({
          phase: "repair-required",
          updateReady: false,
          workerState: "active",
          error:
            "The active update contains inconsistent system files. Repair System Files to download a clean copy.",
        });
        return true;
      }

      sessionStorage.setItem(ACTIVE_VERSION_RELOAD_KEY, targetVersion);
      setState({ phase: "applying", error: null });
      environment.location.reload();
      return true;
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
        if (worker.state === "installed" && isUpdate) {
          (environment.setTimeout || setTimeout)(() => {
            if (registration?.waiting) {
              void markWaitingUpdate(registration.waiting);
            }
          }, 0);
        } else if (worker.state === "activated" && !isUpdate) {
          setState({ phase: "ready", workerState: "active", error: null });
          void refreshStorageEstimate();
        } else if (worker.state === "redundant") {
          setState({
            phase: "error",
            workerState: "failed",
            error: isUpdate
              ? "The update download did not complete. Repair System Files and try again."
              : "The system-file download did not complete.",
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
          Boolean(
            nextRegistration.active || navigatorObject.serviceWorker.controller,
          ),
        );
      });
      if (nextRegistration.waiting && nextRegistration.active) {
        void markWaitingUpdate(nextRegistration.waiting);
      } else if (nextRegistration.installing) {
        trackInstallingWorker(
          nextRegistration.installing,
          Boolean(
            nextRegistration.active || navigatorObject.serviceWorker.controller,
          ),
        );
      }
    };

    const registerAndWait = async (targetVersion) => {
      if (!navigatorObject.serviceWorker) {
        throw new Error(
          "Offline system files are not supported by this browser.",
        );
      }
      const nextRegistration = await navigatorObject.serviceWorker.register(
        versionedServiceWorkerUrl(targetVersion),
        { scope: "/", updateViaCache: "none" },
      );
      trackRegistration(nextRegistration);
      if (nextRegistration.active) {
        setState({
          phase: nextRegistration.waiting ? "updating" : "ready",
          workerState: nextRegistration.waiting ? "waiting" : "active",
          updateReady: false,
          error: null,
        });
        return nextRegistration;
      }
      const worker = nextRegistration.installing || nextRegistration.waiting;
      if (worker) {
        setState({
          phase: "downloading",
          workerState: worker.state,
          error: null,
        });
        await waitForWorker(worker);
      } else {
        await navigatorObject.serviceWorker.ready;
      }
      const activeWorker = nextRegistration.active || worker;
      if ((await requestWorkerVersion(activeWorker)) !== targetVersion) {
        scheduleUpdateRetry();
        throw new Error("The downloaded system version is inconsistent.");
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
        metadata.offlineBytes <= 0 ||
        !Number.isFinite(metadata.bundledGameBytes) ||
        metadata.bundledGameBytes <= 0
      ) {
        throw new Error("The update server returned invalid version metadata.");
      }
      return metadata;
    }

    const loadGameManifest = async () => {
      const response = await environment.fetch(gameManifestUrl, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Offline game catalog failed (${response.status}).`);
      }
      manifest = validateGameManifest(await response.json());
      if (manifest.version !== currentVersion) {
        manifest = null;
        throw new Error("The offline game catalog version is inconsistent.");
      }
      setState({
        bundledGames: Object.entries(manifest.games).map(([id, entry]) => ({
          id,
          bytes: entry.bytes,
          revision: entry.revision,
          type: entry.type,
        })),
        bundledGameBytes:
          manifest.runtime.bytes +
          Object.values(manifest.runtimes || {}).reduce(
            (total, entry) => total + entry.bytes,
            0,
          ) +
          Object.values(manifest.games).reduce(
            (total, entry) => total + entry.bytes,
            0,
          ),
      });
      return manifest;
    };

    const ensureManifest = async () => manifest || loadGameManifest();
    const absoluteUrl = (url) =>
      new URL(
        url,
        environment.location?.href ||
          environment.location?.origin ||
          "https://astro.local/",
      ).href;

    const cacheEntry = async (id, entry, progress) => {
      const cache = await environment.caches.open(bundledCacheName);
      if (
        records[id]?.revision === entry.revision &&
        Array.isArray(records[id].files) &&
        (
          await Promise.all(
            entry.files.map((file) => cache.match(absoluteUrl(file.url))),
          )
        ).every(Boolean)
      ) {
        return;
      }
      const previousFiles = records[id]?.files || [];
      const previousUrls = new Set(previousFiles.map(absoluteUrl));
      let loaded = 0;
      const written = [];
      try {
        for (const file of entry.files) {
          const response = await environment.fetch(file.url, {
            cache: "no-store",
            integrity: file.integrity,
          });
          if (!response.ok) {
            throw new Error(`Offline download failed (${response.status}).`);
          }
          const url = absoluteUrl(file.url);
          await cache.put(url, response);
          written.push(url);
          loaded += file.bytes;
          progress(file.bytes);
        }
      } catch (error) {
        await Promise.all(
          written
            .filter((url) => !previousUrls.has(url))
            .map((url) => cache.delete(url).catch(() => {})),
        );
        throw error;
      }
      const nextUrls = new Set(
        entry.files.map((file) => absoluteUrl(file.url)),
      );
      await Promise.all(
        [...previousUrls]
          .filter((url) => !nextUrls.has(url))
          .map((url) => cache.delete(url).catch(() => {})),
      );
      records[id] = {
        bytes: entry.bytes,
        files: entry.files.map((file) => file.url),
        revision: entry.revision,
        ...(entry.runtime ? { runtime: entry.runtime } : {}),
        type: entry.type || "runtime",
      };
      persistRecords();
      return loaded;
    };

    const downloadGame = async (id) => {
      const currentManifest = await ensureManifest();
      const entry = currentManifest.games[id];
      if (!entry) throw new Error("This bundled game is unavailable.");
      const runtimeEntry = entry.runtime
        ? currentManifest.runtimes?.[entry.runtime]
        : entry.type === "swf"
          ? currentManifest.runtime
          : null;
      const runtimeRecordId = entry.runtime
        ? `__runtime__:${entry.runtime}`
        : "__runtime__";
      const needsRuntime =
        runtimeEntry &&
        records[runtimeRecordId]?.revision !== runtimeEntry.revision;
      const total = entry.bytes + (needsRuntime ? runtimeEntry.bytes : 0);
      await storagePolicy.requestPersistence(navigatorObject.storage);
      let loaded = 0;
      setState({
        gamePhase: "downloading",
        activeGameId: id,
        gameProgressLoaded: 0,
        gameProgressTotal: total,
        gameError: null,
      });
      const progress = (bytes) => {
        loaded += bytes;
        setState({ gameProgressLoaded: Math.min(loaded, total) });
      };
      try {
        if (runtimeEntry) {
          await cacheEntry(runtimeRecordId, runtimeEntry, progress);
        }
        await cacheEntry(id, entry, progress);
        setState({
          gamePhase: "idle",
          activeGameId: null,
          gameProgressLoaded: total,
          gameProgressTotal: total,
        });
        await refreshStorageEstimate();
        return snapshot();
      } catch (error) {
        const normalized = storagePolicy.normalizeError(error);
        setState({
          gamePhase: "error",
          activeGameId: null,
          gameError: normalized.message,
        });
        throw normalized;
      }
    };

    const deleteRecordFiles = async (id) => {
      const record = records[id];
      if (!record) return;
      const cache = await environment.caches.open(bundledCacheName);
      await Promise.all(
        (record.files || []).map((url) => cache.delete(absoluteUrl(url))),
      );
      delete records[id];
      persistRecords();
    };

    const removeGame = async (id) => {
      setState({
        gamePhase: "removing",
        activeGameId: id,
        gameError: null,
      });
      try {
        const removedRecord = records[id];
        await deleteRecordFiles(id);
        const hasSwfGame = Object.entries(records).some(
          ([recordId, record]) =>
            !recordId.startsWith("__runtime__") && record.type === "swf",
        );
        if (!hasSwfGame) await deleteRecordFiles("__runtime__");
        if (removedRecord?.runtime) {
          const hasRuntimeConsumer = Object.entries(records).some(
            ([recordId, record]) =>
              !recordId.startsWith("__runtime__") &&
              record.runtime === removedRecord.runtime,
          );
          if (!hasRuntimeConsumer)
            await deleteRecordFiles(`__runtime__:${removedRecord.runtime}`);
        }
        setState({ gamePhase: "idle", activeGameId: null });
        await refreshStorageEstimate();
        return snapshot();
      } catch (error) {
        setState({
          gamePhase: "error",
          activeGameId: null,
          gameError: error.message,
        });
        throw error;
      }
    };

    const downloadAllGames = async () => {
      const currentManifest = await ensureManifest();
      for (const id of Object.keys(currentManifest.games)) {
        if (records[id]?.revision !== currentManifest.games[id].revision) {
          await downloadGame(id);
        }
      }
      return snapshot();
    };

    const removeAllGames = async () => {
      setState({
        gamePhase: "removing",
        activeGameId: null,
        gameError: null,
      });
      await environment.caches.delete(bundledCacheName);
      for (const id of Object.keys(records)) delete records[id];
      persistRecords();
      setState({ gamePhase: "idle" });
      await refreshStorageEstimate();
      return snapshot();
    };

    const syncDownloadedGames = async () => {
      const currentManifest = await ensureManifest();
      const selectedIds = Object.keys(records).filter(
        (key) => !key.startsWith("__runtime__"),
      );
      for (const id of selectedIds) {
        const entry = currentManifest.games[id];
        if (!entry) {
          await deleteRecordFiles(id);
          continue;
        }
        const runtimeEntry = entry.runtime
          ? currentManifest.runtimes?.[entry.runtime]
          : entry.type === "swf"
            ? currentManifest.runtime
            : null;
        const runtimeRecordId = entry.runtime
          ? `__runtime__:${entry.runtime}`
          : "__runtime__";
        if (
          records[id].revision !== entry.revision ||
          (runtimeEntry &&
            records[runtimeRecordId]?.revision !== runtimeEntry.revision)
        ) {
          await downloadGame(id);
        }
      }
    };

    const checkForUpdates = async () => {
      if (checkPromise) return checkPromise;
      checkPromise = (async () => {
        const previousPhase = state.phase;
        setState({ phase: "checking", error: null });
        try {
          const metadata = await fetchVersion();
          rememberVersionMetadata(metadata);
          await registerAndWait(metadata.version);
          let waitingUpdateReady = false;
          if (registration.waiting) {
            waitingUpdateReady = await markWaitingUpdate(
              registration.waiting,
              metadata,
            );
          } else if (registration.installing) {
            trackInstallingWorker(registration.installing, true);
          }
          const checkedAt = environment.Date.now();
          storage.setItem(LAST_CHECKED_KEY, String(checkedAt));
          const activeWorkerVersion = await requestWorkerVersion(
            registration?.active,
          );
          const updateAvailable =
            metadata.version !== currentVersion ||
            (activeWorkerVersion !== null &&
              activeWorkerVersion !== metadata.version);
          if (
            activeWorkerVersion !== null &&
            activeWorkerVersion !== metadata.version &&
            !registration?.waiting &&
            !registration?.installing
          ) {
            bypassWorkerCdn = true;
            scheduleUpdateRetry();
          }
          if (
            updateAvailable &&
            (await reconcileActiveVersion(metadata.version))
          ) {
            setState({ lastChecked: checkedAt });
            return;
          }
          setState({
            phase: updateAvailable
              ? waitingUpdateReady
                ? "update-ready"
                : "update-available"
              : "ready",
            availableVersion: updateAvailable ? metadata.version : null,
            availableRevision: updateAvailable ? metadata.revision : null,
            lastChecked: checkedAt,
            updateReady: updateAvailable && waitingUpdateReady,
            workerState: registration?.waiting
              ? "waiting"
              : registration?.active
                ? "active"
                : "unregistered",
            error: null,
          });
        } catch (error) {
          setState({
            phase: previousPhase === "ready" ? "ready" : "error",
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

    const deleteShellCaches = async () => {
      if (!environment.caches) return;
      const names = await environment.caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(cachePrefix))
          .map((name) => environment.caches.delete(name)),
      );
    };

    const applyUpdate = async () => {
      if (registration?.waiting) {
        const workerVersion = await requestWorkerVersion(registration.waiting);
        if (
          !state.availableVersion ||
          workerVersion !== state.availableVersion
        ) {
          scheduleUpdateRetry();
          throw new Error("The update is not ready to install.");
        }
        reloadWhenControlled = true;
        setState({ phase: "applying", error: null });
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
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
        throw new Error("Connect to the internet to repair system files.");
      }
      sessionStorage.removeItem?.(ACTIVE_VERSION_RELOAD_KEY);
      setState({ phase: "repairing", error: null });
      const currentRegistration =
        registration ||
        (await navigatorObject.serviceWorker?.getRegistration("/"));
      if (currentRegistration) await currentRegistration.unregister();
      await deleteShellCaches();
      registration = null;
      setState({ phase: "starting", updateReady: false });
      await checkForUpdates();
      return snapshot();
    };

    const automaticCheck = () => {
      if (
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
        if (environment.document.visibilityState === "visible")
          automaticCheck();
      });
    };

    const initialize = async () => {
      attachLifecycleListeners();
      await refreshStorageEstimate();
      try {
        const existingRegistration =
          await navigatorObject.serviceWorker?.getRegistration?.("/");
        if (existingRegistration) trackRegistration(existingRegistration);
        try {
          await checkForUpdates();
        } catch (error) {
          if (!existingRegistration) throw error;
          setState({ phase: "ready", workerState: "active", error: null });
        }
        await loadGameManifest();
        const knownVersion = storage.getItem(DOWNLOAD_VERSION_KEY);
        if (
          knownVersion &&
          knownVersion !== currentVersion &&
          (await reconcileActiveVersion(knownVersion))
        ) {
          return snapshot();
        }
        void syncDownloadedGames().catch((error) => {
          setState({ gamePhase: "error", gameError: error.message });
        });
      } catch (error) {
        setState({ phase: "error", error: error.message });
      }
      return snapshot();
    };

    return {
      applyUpdate,
      checkForUpdates,
      downloadAllGames,
      downloadGame,
      getSnapshot: snapshot,
      initialize,
      refreshStorageEstimate,
      removeAllGames,
      removeGame,
      repair,
      subscribe,
    };
  };

  return {
    BUNDLED_GAME_CACHE,
    createManager,
    validateGameManifest,
    waitForWorker,
  };
});
