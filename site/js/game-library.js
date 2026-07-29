"use strict";

(function exposeGameLibrary(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AstroGameLibrary = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  const DB_NAME = "astro-installed-games";
  const DB_VERSION = 1;
  const STORE_NAME = "games";
  const CACHE_NAME = "astro-installed-games-v1";
  const DEFAULT_API_BASE = "/api/games";
  const MAX_DOWNLOAD_BYTES = 128 * 1024 * 1024;
  const MAX_LEGACY_ASSET_BYTES = 64 * 1024 * 1024;

  const requestResult = (request) =>
    new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error || new Error("Browser storage request failed."));
    });

  const transactionDone = (transaction) =>
    new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () =>
        reject(transaction.error || new Error("Browser storage was aborted."));
      transaction.onerror = () =>
        reject(transaction.error || new Error("Browser storage failed."));
    });

  const openDatabase = (indexedDBObject = root.indexedDB) => {
    if (!indexedDBObject) {
      return Promise.reject(
        new Error("Persistent game storage is not supported by this browser."),
      );
    }
    return new Promise((resolve, reject) => {
      const request = indexedDBObject.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error || new Error("Could not open game storage."));
    });
  };

  const createMetadataStore = async (indexedDBObject) => {
    const database = await openDatabase(indexedDBObject);
    const run = async (mode, operation) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const result = await operation(store);
      await transactionDone(transaction);
      return result;
    };
    return {
      list: () => run("readonly", (store) => requestResult(store.getAll())),
      get: (id) => run("readonly", (store) => requestResult(store.get(id))),
      put: (record) =>
        run("readwrite", (store) => requestResult(store.put(record))),
      delete: (id) =>
        run("readwrite", (store) => requestResult(store.delete(id))),
      close: () => database.close(),
    };
  };

  const categoryFor = (record) => {
    const tags = Array.isArray(record.tags) ? record.tags : [];
    const preferred = tags.find((tag) =>
      ["Action", "Adventure", "Arcade", "Puzzle", "Racing"].includes(tag),
    );
    return preferred || "Downloaded Games";
  };

  const asGameConfig = (record) => ({
    ...record,
    title: record.title || "Installed Flash Game",
    type: "swf",
    category: categoryFor(record),
    // Native <img> requests cannot use the page-level fetch interceptor that
    // serves installed game files from Cache Storage.
    icon: record.logoUrl || record.iconPath || null,
    url: record.launchPath,
    base: record.basePath,
    installed: true,
  });

  const readDownload = async (
    response,
    { onProgress, maxBytes = MAX_DOWNLOAD_BYTES } = {},
  ) => {
    if (!response.ok) {
      throw new Error(`Game download failed (${response.status}).`);
    }
    const expected = Number(response.headers.get("content-length")) || null;
    if (expected && expected > maxBytes) {
      throw new Error("This game is larger than the supported download limit.");
    }
    if (!response.body?.getReader) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > maxBytes) {
        throw new Error(
          "This game is larger than the supported download limit.",
        );
      }
      onProgress?.({ loaded: bytes.byteLength, total: expected });
      return bytes;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      loaded += value.byteLength;
      if (loaded > maxBytes) {
        await reader.cancel();
        throw new Error(
          "This game is larger than the supported download limit.",
        );
      }
      chunks.push(value);
      onProgress?.({ loaded, total: expected });
    }
    const result = new Uint8Array(loaded);
    let offset = 0;
    chunks.forEach((chunk) => {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    });
    return result;
  };

  const jsonRequest = async (fetchObject, url, options = {}) => {
    const response = await fetchObject(url, {
      ...options,
      headers: { Accept: "application/json", ...options.headers },
    });
    if (!response.ok) {
      let message = "";
      try {
        message = (await response.json()).error || "";
      } catch {
        // Upstream failure pages are not necessarily JSON.
      }
      throw new Error(
        message || `The game catalog returned ${response.status}.`,
      );
    }
    return response.json();
  };

  const createManager = ({
    installer = root.AstroGameInstaller,
    unzipSync = root.fflate?.unzipSync,
    fetchObject = root.fetch?.bind(root),
    cachesObject = root.caches,
    indexedDBObject = root.indexedDB,
    storageManager = root.navigator?.storage,
    apiBase = DEFAULT_API_BASE,
    origin = root.location?.origin || "https://astro.local",
    cacheObject = null,
    metadataStore = null,
  } = {}) => {
    if (!installer) throw new Error("The game installer is unavailable.");
    if (typeof unzipSync !== "function")
      throw new Error("The ZIP reader is unavailable.");
    if (typeof fetchObject !== "function")
      throw new Error("Network access is unavailable.");
    if (!cachesObject && !cacheObject)
      throw new Error("Browser cache storage is unavailable.");

    let cache;
    let store;
    let initialized = false;
    const installed = new Map();
    const listeners = new Set();

    const notify = () => {
      const snapshot = manager.getGames();
      listeners.forEach((listener) => listener(snapshot));
    };

    const initialize = async () => {
      if (initialized) return manager.getGames();
      [cache, store] = await Promise.all([
        cacheObject || cachesObject.open(CACHE_NAME),
        metadataStore || createMetadataStore(indexedDBObject),
      ]);
      const records = await store.list();
      records.forEach((record) => installed.set(record.id, record));
      initialized = true;
      return manager.getGames();
    };

    const requireReady = () => {
      if (!initialized) throw new Error("The game library is still starting.");
    };

    const installedAssetKey = (record, archivePath) =>
      `${origin}/__installed-games/${record.uuid}/${archivePath}`;

    const fetchLegacyAsset = async (record, archivePath) => {
      if (!record.legacyFallback) return null;
      let safePath;
      try {
        safePath = installer.safeArchivePath(archivePath);
      } catch {
        return null;
      }
      if (!safePath.startsWith("content/")) return null;
      const key = installedAssetKey(record, safePath);
      const cached = await cache.match(key);
      if (cached) return cached;
      const response = await fetchObject(
        `${apiBase}/${encodeURIComponent(record.uuid)}/asset?path=${encodeURIComponent(safePath)}`,
      );
      if (!response.ok) return null;
      const bytes = await readDownload(response, {
        maxBytes: MAX_LEGACY_ASSET_BYTES,
      });
      const stored = new Response(bytes, {
        status: 200,
        headers: response.headers,
      });
      await cache.put(key, stored.clone());
      return stored;
    };

    const manager = {
      initialize,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getGames() {
        return Object.fromEntries(
          [...installed.entries()].map(([id, record]) => [
            id,
            asGameConfig(record),
          ]),
        );
      },
      getRecord(id) {
        return installed.get(id) || null;
      },
      async search(query, { signal } = {}) {
        const normalized = String(query || "").trim();
        if (!normalized) return [];
        const url = `${apiBase}?q=${encodeURIComponent(normalized)}`;
        const payload = await jsonRequest(fetchObject, url, { signal });
        return Array.isArray(payload.games) ? payload.games : [];
      },
      async details(uuid, { signal } = {}) {
        return jsonRequest(
          fetchObject,
          `${apiBase}/${encodeURIComponent(uuid)}`,
          { signal },
        );
      },
      async install(record, { onProgress, signal } = {}) {
        requireReady();
        const checked = installer.validateCatalogRecord(record, { origin });
        if (installed.has(`flashpoint:${checked.uuid}`)) {
          return asGameConfig(installed.get(`flashpoint:${checked.uuid}`));
        }
        try {
          await storageManager?.persist?.();
        } catch {
          // Persistent storage is a best-effort browser capability.
        }
        const response = await fetchObject(checked.downloadUrl, { signal });
        const contentLength =
          Number(response.headers.get("content-length")) || null;
        if (contentLength && storageManager?.estimate) {
          const estimate = await storageManager.estimate();
          const available =
            Number.isFinite(estimate.quota) && Number.isFinite(estimate.usage)
              ? estimate.quota - estimate.usage
              : null;
          if (available !== null && contentLength > available) {
            throw new Error(
              "There is not enough browser storage for this game.",
            );
          }
        }
        const bytes = await readDownload(response, { onProgress });
        let metadata =
          checked.packageType === "legacy"
            ? await installer.installLegacy(checked, bytes, {
                cache,
                store,
                origin,
              })
            : await installer.install(checked, bytes, {
                cache,
                store,
                unzipSync,
                origin,
              });

        if (checked.logoUrl) {
          try {
            const logoResponse = await fetchObject(checked.logoUrl, { signal });
            if (logoResponse.ok) {
              const iconPath = `${origin}/__installed-games/${checked.uuid}/logo.jpg`;
              await cache.put(iconPath, logoResponse);
              metadata = { ...metadata, iconPath };
              await store.put(metadata);
            }
          } catch {
            // A missing logo should not undo a successfully installed game.
          }
        }
        installed.set(metadata.id, metadata);
        notify();
        return asGameConfig(metadata);
      },
      async uninstall(idOrUuid) {
        requireReady();
        const uuid = String(idOrUuid).replace(/^flashpoint:/, "");
        await installer.uninstall(uuid, { cache, store, origin });
        installed.delete(`flashpoint:${uuid.toLowerCase()}`);
        notify();
      },
      async match(request) {
        requireReady();
        const direct = await cache.match(request);
        if (direct) return direct;
        let requested;
        try {
          requested = new URL(
            request instanceof Request ? request.url : request,
            origin,
          );
        } catch {
          return null;
        }
        if (!/^https?:$/.test(requested.protocol)) return null;

        const syntheticPrefix = "/__installed-games/";
        if (requested.origin === new URL(origin).origin) {
          if (!requested.pathname.startsWith(syntheticPrefix)) return null;
          const remainder = requested.pathname.slice(syntheticPrefix.length);
          const slash = remainder.indexOf("/");
          if (slash < 1) return null;
          const uuid = remainder.slice(0, slash).toLowerCase();
          const record = installed.get(`flashpoint:${uuid}`);
          if (!record) return null;
          let archivePath;
          try {
            archivePath = decodeURIComponent(remainder.slice(slash + 1));
          } catch {
            return null;
          }
          return fetchLegacyAsset(record, archivePath);
        }

        const archivePath = installer.archiveLaunchPath(requested.href);
        for (const record of installed.values()) {
          const key = installedAssetKey(record, archivePath);
          const response = await cache.match(key);
          if (response) return response;
        }
        for (const record of installed.values()) {
          const response = await fetchLegacyAsset(record, archivePath);
          if (response) return response;
        }
        return null;
      },
      async storageEstimate() {
        return storageManager?.estimate ? storageManager.estimate() : null;
      },
    };
    return manager;
  };

  return {
    CACHE_NAME,
    DB_NAME,
    STORE_NAME,
    MAX_DOWNLOAD_BYTES,
    MAX_LEGACY_ASSET_BYTES,
    asGameConfig,
    readDownload,
    createMetadataStore,
    createManager,
  };
});
