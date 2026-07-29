/* global window */
"use strict";

// This module deliberately knows nothing about the UI.  Supplying the ZIP reader,
// cache and metadata store makes it usable both by the app and by small tests.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AstroGameInstaller = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  // Flashpoint UUIDs are not necessarily RFC 4122 version 1-5 UUIDs.
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const DEFAULT_LIMITS = Object.freeze({
    maxFiles: 2000,
    maxFileBytes: 64 * 1024 * 1024,
    maxTotalBytes: 512 * 1024 * 1024,
  });

  function fail(message) { throw new Error(message); }
  function field(record, ...names) {
    for (const name of names) if (record[name] !== undefined) return record[name];
    return undefined;
  }
  function text(value) { return Array.isArray(value) ? value.join(" ") : String(value || ""); }

  function validateCatalogRecord(record, options = {}) {
    if (!record || typeof record !== "object") fail("A game record is required");
    const uuid = field(record, "uuid", "id");
    if (typeof uuid !== "string" || !UUID.test(uuid)) fail("Invalid game UUID");
    if (text(field(record, "library", "libraryName")).toLowerCase() !== "games") fail("Only Games library records are supported");
    if (text(field(record, "platform", "platformName")).toLowerCase() !== "flash") fail("Only Flash games are supported");
    if (text(field(record, "status")).toLowerCase() !== "playable") fail("Only playable games are supported");
    const applicationPath = text(field(record, "applicationPath", "application", "applicationPaths"));
    if (!/(?:flash\s*player|flashplayer)/i.test(applicationPath))
      fail("Game does not use the Flash player");
    const downloadUrl = field(record, "downloadUrl", "gameZipUrl", "gameZIP");
    const launchCommand = field(record, "launchCommand", "launch", "command");
    let download, launch;
    try { download = new URL(downloadUrl, options.origin || "https://astro.local"); } catch (_) { fail("Invalid download URL"); }
    try { launch = new URL(launchCommand); } catch (_) { fail("Invalid launch command"); }
    const ownOrigin = new URL(options.origin || "https://astro.local").origin;
    const trustedUpstream =
      download.protocol === "https:" &&
      download.host === "download.unstable.life";
    if (!trustedUpstream && download.origin !== ownOrigin)
      fail("Download URL is not allowed");
    if (!/^https?:$/.test(launch.protocol) || !/\.swf$/i.test(launch.pathname)) fail("Launch command must point to an SWF");
    return Object.assign({}, record, { uuid: uuid.toLowerCase(), downloadUrl: download.href, launchCommand: launch.href, applicationPath });
  }

  function archiveLaunchPath(launchCommand) {
    const url = new URL(launchCommand);
    return "content/" + url.hostname + decodeURIComponent(url.pathname);
  }

  function safeArchivePath(name) {
    if (typeof name !== "string" || !name || name.indexOf("\0") !== -1 || name.includes("\\") || name.startsWith("/") || /^[a-zA-Z]:/.test(name)) fail("Unsafe ZIP entry name");
    const isDirectory = name.endsWith("/");
    const parts = (isDirectory ? name.slice(0, -1) : name).split("/");
    if (parts.some((part) => !part || part === "." || part === "..")) fail("Unsafe ZIP entry name");
    return name;
  }

  function entryBytes(entry) {
    if (entry instanceof Uint8Array) return entry;
    if (entry && entry.data instanceof Uint8Array) return entry.data;
    if (entry && entry.buffer instanceof Uint8Array) return entry.buffer;
    fail("ZIP entry does not contain bytes");
  }

  function validateZipEntries(entries, limits = {}) {
    const max = Object.assign({}, DEFAULT_LIMITS, limits);
    const pairs = entries instanceof Map ? Array.from(entries.entries()) : Object.entries(entries || {});
    if (pairs.length > max.maxFiles) fail("ZIP has too many files");
    let total = 0;
    return pairs.flatMap(([name, entry]) => {
      const path = safeArchivePath(name);
      // Directory records have no payload to cache, but their name is still
      // validated so a malicious archive cannot hide traversal in one.
      if (path.endsWith("/")) return [];
      const bytes = entryBytes(entry);
      if (bytes.byteLength > max.maxFileBytes) fail("ZIP file is too large");
      total += bytes.byteLength;
      if (total > max.maxTotalBytes) fail("ZIP is too large");
      return [{ path, bytes }];
    });
  }

  function cacheKey(origin, uuid, path) { return origin.replace(/\/$/, "") + "/__installed-games/" + uuid + "/" + path; }
  function makeResponse(bytes, dependencies, path) {
    if (dependencies.responseFactory)
      return dependencies.responseFactory(bytes, path);
    if (typeof Response !== "undefined") {
      const contentType = /\.swf$/i.test(path)
        ? "application/x-shockwave-flash"
        : "application/octet-stream";
      return new Response(bytes, { headers: { "Content-Type": contentType } });
    }
    return bytes;
  }
  async function putMetadata(store, metadata) {
    if (typeof store.put === "function") return store.put(metadata);
    if (typeof store.set === "function") return store.set(metadata.id, metadata);
    fail("Metadata store dependency is required");
  }
  async function deleteMetadata(store, id) {
    if (typeof store.delete === "function") return store.delete(id);
    if (typeof store.remove === "function") return store.remove(id);
    fail("Metadata store dependency is required");
  }

  async function install(record, zipBytes, dependencies = {}) {
    if (!(zipBytes instanceof Uint8Array)) fail("Game archive must be a Uint8Array");
    if (typeof dependencies.unzipSync !== "function") fail("unzipSync dependency is required");
    if (!dependencies.cache || typeof dependencies.cache.put !== "function" || typeof dependencies.cache.delete !== "function") fail("Cache dependency is required");
    if (!dependencies.store || (typeof dependencies.store.put !== "function" && typeof dependencies.store.set !== "function")) fail("Metadata store dependency is required");
    const origin = dependencies.origin || (typeof location !== "undefined" ? location.origin : "https://astro.local");
    const game = validateCatalogRecord(record, { origin });
    const launchPath = archiveLaunchPath(game.launchCommand);
    const files = validateZipEntries(
      dependencies.unzipSync(zipBytes),
      dependencies.limits,
    );
    const launchFile = files.find(
      (file) => file.path.toLowerCase() === launchPath.toLowerCase(),
    );
    if (!launchFile) fail("ZIP does not contain the launch SWF");
    const written = [];
    try {
      for (const file of files) {
        const key = cacheKey(origin, game.uuid, file.path);
        await dependencies.cache.put(
          key,
          makeResponse(file.bytes, dependencies, file.path),
        );
        written.push(key);
      }
      const resolvedLaunchPath = cacheKey(
        origin,
        game.uuid,
        launchFile.path,
      );
      const metadata = Object.assign({}, game, {
        id: "flashpoint:" + game.uuid,
        type: "swf",
        source: "Flashpoint Archive",
        launchPath: resolvedLaunchPath,
        basePath: resolvedLaunchPath.slice(0, resolvedLaunchPath.lastIndexOf("/") + 1),
      });
      await putMetadata(dependencies.store, metadata);
      return metadata;
    } catch (error) {
      await Promise.all(written.map((key) => dependencies.cache.delete(key).catch(() => {})));
      throw error;
    }
  }

  async function uninstall(uuid, dependencies = {}) {
    if (typeof uuid !== "string" || !UUID.test(uuid)) fail("Invalid game UUID");
    if (!dependencies.cache || typeof dependencies.cache.keys !== "function" || typeof dependencies.cache.delete !== "function") fail("Cache dependency is required");
    if (!dependencies.store || (typeof dependencies.store.delete !== "function" && typeof dependencies.store.remove !== "function")) fail("Metadata store dependency is required");
    const origin = dependencies.origin || (typeof location !== "undefined" ? location.origin : "https://astro.local");
    const prefix = cacheKey(origin, uuid.toLowerCase(), "");
    const keys = await dependencies.cache.keys();
    await Promise.all(keys.filter((key) => String(key.url || key).startsWith(prefix)).map((key) => dependencies.cache.delete(key)));
    await deleteMetadata(dependencies.store, "flashpoint:" + uuid.toLowerCase());
  }

  return { DEFAULT_LIMITS, validateCatalogRecord, archiveLaunchPath, safeArchivePath, validateZipEntries, install, uninstall };
});
