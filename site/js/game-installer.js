"use strict";

// This module deliberately knows nothing about the UI.  Supplying the ZIP reader,
// cache and metadata store makes it usable both by the app and by small tests.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AstroGameInstaller = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  // Flashpoint UUIDs are not necessarily RFC 4122 version 1-5 UUIDs.
  const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const DEFAULT_LIMITS = Object.freeze({
    maxFiles: 2000,
    maxFileBytes: 64 * 1024 * 1024,
    maxTotalBytes: 512 * 1024 * 1024,
  });

  function fail(message) {
    throw new Error(message);
  }
  function field(record, ...names) {
    for (const name of names)
      if (record[name] !== undefined) return record[name];
    return undefined;
  }
  function text(value) {
    return Array.isArray(value) ? value.join(" ") : String(value || "");
  }

  function validateCatalogRecord(record, options = {}) {
    if (!record || typeof record !== "object")
      fail("A game record is required");
    const uuid = field(record, "uuid", "id");
    if (typeof uuid !== "string" || !UUID.test(uuid)) fail("Invalid game UUID");
    if (text(field(record, "library", "libraryName")).toLowerCase() !== "games")
      fail("Only Games library records are supported");
    if (
      text(field(record, "platform", "platformName")).toLowerCase() !== "flash"
    )
      fail("Only Flash games are supported");
    if (text(field(record, "status")).toLowerCase() !== "playable")
      fail("Only playable games are supported");
    const applicationPath = text(
      field(record, "applicationPath", "application", "applicationPaths"),
    );
    if (!/(?:flash\s*player|flashplayer)/i.test(applicationPath))
      fail("Game does not use the Flash player");
    const downloadUrl = field(record, "downloadUrl", "gameZipUrl", "gameZIP");
    const launchCommand = field(record, "launchCommand", "launch", "command");
    const packageType = text(
      field(record, "packageType") || "gamezip",
    ).toLowerCase();
    if (!["gamezip", "legacy"].includes(packageType))
      fail("Unsupported game package type");
    let download, launch;
    try {
      download = new URL(downloadUrl, options.origin || "https://astro.local");
    } catch (_) {
      fail("Invalid download URL");
    }
    try {
      launch = new URL(launchCommand);
    } catch (_) {
      fail("Invalid launch command");
    }
    const ownOrigin = new URL(options.origin || "https://astro.local").origin;
    const trustedUpstream =
      download.protocol === "https:" &&
      download.host === "download.unstable.life";
    if (!trustedUpstream && download.origin !== ownOrigin)
      fail("Download URL is not allowed");
    if (!/^https?:$/.test(launch.protocol) || !/\.swf$/i.test(launch.pathname))
      fail("Launch command must point to an SWF");
    return Object.assign({}, record, {
      uuid: uuid.toLowerCase(),
      downloadUrl: download.href,
      launchCommand: launch.href,
      applicationPath,
      packageType,
      legacyFallback: Boolean(record.legacyFallback),
    });
  }

  function archiveLaunchPath(launchCommand) {
    const url = new URL(launchCommand);
    return "content/" + url.hostname + decodeURIComponent(url.pathname);
  }

  function safeArchivePath(name) {
    if (
      typeof name !== "string" ||
      !name ||
      name.indexOf("\0") !== -1 ||
      name.includes("\\") ||
      name.startsWith("/") ||
      /^[a-zA-Z]:/.test(name)
    )
      fail("Unsafe ZIP entry name");
    const isDirectory = name.endsWith("/");
    const parts = (isDirectory ? name.slice(0, -1) : name).split("/");
    if (
      parts.some((part) => {
        if (!part || part === "." || part === "..") return true;
        let decoded;
        try {
          decoded = decodeURIComponent(part);
        } catch (_) {
          return true;
        }
        return decoded === "." || decoded === ".." || /[\\/?#]/.test(decoded);
      })
    )
      fail("Unsafe ZIP entry name");
    return name;
  }

  function validateZipMetadata(zipBytes, limits = {}) {
    if (!(zipBytes instanceof Uint8Array))
      fail("Game archive must be a Uint8Array");
    const max = Object.assign({}, DEFAULT_LIMITS, limits);
    const view = new DataView(
      zipBytes.buffer,
      zipBytes.byteOffset,
      zipBytes.byteLength,
    );
    const minimumEocdBytes = 22;
    const maximumCommentBytes = 0xffff;
    let eocd = -1;
    for (
      let offset = zipBytes.byteLength - minimumEocdBytes;
      offset >=
      Math.max(0, zipBytes.byteLength - minimumEocdBytes - maximumCommentBytes);
      offset -= 1
    ) {
      if (
        view.getUint32(offset, true) === 0x06054b50 &&
        offset + minimumEocdBytes + view.getUint16(offset + 20, true) ===
          zipBytes.byteLength
      ) {
        eocd = offset;
        break;
      }
    }
    if (eocd < 0) fail("ZIP metadata is invalid");
    if (view.getUint16(eocd + 4, true) || view.getUint16(eocd + 6, true))
      fail("Multi-disk ZIP files are not supported");
    const entriesOnDisk = view.getUint16(eocd + 8, true);
    const entryCount = view.getUint16(eocd + 10, true);
    const directoryBytes = view.getUint32(eocd + 12, true);
    const directoryOffset = view.getUint32(eocd + 16, true);
    if (
      entriesOnDisk !== entryCount ||
      entryCount === 0xffff ||
      directoryBytes === 0xffffffff ||
      directoryOffset === 0xffffffff ||
      entryCount > max.maxFiles ||
      directoryOffset + directoryBytes > eocd
    ) {
      fail(
        entryCount > max.maxFiles
          ? "ZIP has too many files"
          : "ZIP metadata is invalid",
      );
    }
    let offset = directoryOffset;
    let total = 0;
    for (let index = 0; index < entryCount; index += 1) {
      if (offset + 46 > eocd || view.getUint32(offset, true) !== 0x02014b50) {
        fail("ZIP metadata is invalid");
      }
      const fileBytes = view.getUint32(offset + 24, true);
      const nameBytes = view.getUint16(offset + 28, true);
      const extraBytes = view.getUint16(offset + 30, true);
      const commentBytes = view.getUint16(offset + 32, true);
      const next = offset + 46 + nameBytes + extraBytes + commentBytes;
      if (fileBytes === 0xffffffff || next > eocd)
        fail("ZIP metadata is invalid");
      const isDirectory =
        nameBytes > 0 && zipBytes[offset + 46 + nameBytes - 1] === 0x2f;
      if (!isDirectory) {
        if (fileBytes > max.maxFileBytes) fail("ZIP file is too large");
        total += fileBytes;
        if (total > max.maxTotalBytes) fail("ZIP is too large");
      }
      offset = next;
    }
    if (offset > directoryOffset + directoryBytes)
      fail("ZIP metadata is invalid");
    return { entryCount, totalBytes: total };
  }

  function entryBytes(entry) {
    if (entry instanceof Uint8Array) return entry;
    if (entry && entry.data instanceof Uint8Array) return entry.data;
    if (entry && entry.buffer instanceof Uint8Array) return entry.buffer;
    fail("ZIP entry does not contain bytes");
  }

  function validateZipEntries(entries, limits = {}) {
    const max = Object.assign({}, DEFAULT_LIMITS, limits);
    const pairs =
      entries instanceof Map
        ? Array.from(entries.entries())
        : Object.entries(entries || {});
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

  function cacheKey(origin, uuid, path) {
    const prefix =
      origin.replace(/\/$/, "") + "/__installed-games/" + uuid + "/";
    const key = new URL(path, prefix).href;
    if (!key.startsWith(prefix)) fail("Unsafe ZIP entry name");
    return key;
  }
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
    if (typeof store.set === "function")
      return store.set(metadata.id, metadata);
    fail("Metadata store dependency is required");
  }
  async function deleteMetadata(store, id) {
    if (typeof store.delete === "function") return store.delete(id);
    if (typeof store.remove === "function") return store.remove(id);
    fail("Metadata store dependency is required");
  }

  async function install(record, zipBytes, dependencies = {}) {
    if (!(zipBytes instanceof Uint8Array))
      fail("Game archive must be a Uint8Array");
    const unzip = dependencies.unzip || dependencies.unzipSync;
    if (typeof unzip !== "function") fail("ZIP reader dependency is required");
    if (
      !dependencies.cache ||
      typeof dependencies.cache.put !== "function" ||
      typeof dependencies.cache.delete !== "function"
    )
      fail("Cache dependency is required");
    if (
      !dependencies.store ||
      (typeof dependencies.store.put !== "function" &&
        typeof dependencies.store.set !== "function")
    )
      fail("Metadata store dependency is required");
    const origin =
      dependencies.origin ||
      (typeof location !== "undefined"
        ? location.origin
        : "https://astro.local");
    const game = validateCatalogRecord(record, { origin });
    if (game.packageType !== "gamezip")
      fail("Legacy games must be installed from their launch SWF");
    const launchPath = archiveLaunchPath(game.launchCommand);
    validateZipMetadata(zipBytes, dependencies.limits);
    const files = validateZipEntries(
      await unzip(zipBytes, { signal: dependencies.signal }),
      dependencies.limits,
    );
    const launchFile = files.find(
      (file) => file.path.toLowerCase() === launchPath.toLowerCase(),
    );
    if (!launchFile) fail("ZIP does not contain the launch SWF");
    const written = [];
    try {
      for (const file of files) {
        dependencies.signal?.throwIfAborted();
        const key = cacheKey(origin, game.uuid, file.path);
        await dependencies.cache.put(
          key,
          makeResponse(file.bytes, dependencies, file.path),
        );
        written.push(key);
      }
      dependencies.signal?.throwIfAborted();
      const resolvedLaunchPath = cacheKey(origin, game.uuid, launchFile.path);
      dependencies.signal?.throwIfAborted();
      const metadata = Object.assign({}, game, {
        id: "flashpoint:" + game.uuid,
        type: "swf",
        source: "Flashpoint Archive",
        launchPath: resolvedLaunchPath,
        basePath: resolvedLaunchPath.slice(
          0,
          resolvedLaunchPath.lastIndexOf("/") + 1,
        ),
      });
      await putMetadata(dependencies.store, metadata);
      return metadata;
    } catch (error) {
      await Promise.all(
        written.map((key) => dependencies.cache.delete(key).catch(() => {})),
      );
      throw error;
    }
  }

  // Read only the ZIP index into memory. File bodies remain in the temporary
  // browser file and are read in small chunks as each cache response consumes them.
  async function readArchiveIndex(blob, limits = {}) {
    const max = { ...DEFAULT_LIMITS, ...limits };
    const tailOffset = Math.max(0, blob.size - 65557);
    const tail = new Uint8Array(await blob.slice(tailOffset).arrayBuffer());
    const view = new DataView(tail.buffer);
    let end = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (
        view.getUint32(i, true) === 0x06054b50 &&
        i + 22 + view.getUint16(i + 20, true) === tail.length
      ) {
        end = i;
        break;
      }
    }
    if (
      end < 0 ||
      view.getUint16(end + 4, true) ||
      view.getUint16(end + 6, true)
    )
      fail("ZIP metadata is invalid");
    const count = view.getUint16(end + 10, true);
    const size = view.getUint32(end + 12, true);
    const offset = view.getUint32(end + 16, true);
    if (
      count > max.maxFiles ||
      count === 65535 ||
      view.getUint16(end + 8, true) !== count ||
      size > 8 * 1024 * 1024 ||
      offset + size !== tailOffset + end
    )
      fail("ZIP metadata is invalid or too large");
    const bytes = new Uint8Array(
      await blob.slice(offset, offset + size).arrayBuffer(),
    );
    const directory = new DataView(bytes.buffer);
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const files = [];
    const names = new Set();
    let position = 0,
      total = 0;
    for (let index = 0; index < count; index++) {
      if (
        position + 46 > bytes.length ||
        directory.getUint32(position, true) !== 0x02014b50
      )
        fail("ZIP metadata is invalid");
      const flags = directory.getUint16(position + 8, true),
        method = directory.getUint16(position + 10, true);
      const crc = directory.getUint32(position + 16, true),
        compressed = directory.getUint32(position + 20, true),
        expanded = directory.getUint32(position + 24, true);
      const nameLength = directory.getUint16(position + 28, true),
        extraLength = directory.getUint16(position + 30, true),
        commentLength = directory.getUint16(position + 32, true);
      const localOffset = directory.getUint32(position + 42, true);
      const next = position + 46 + nameLength + extraLength + commentLength;
      if (
        next > bytes.length ||
        flags & 1 ||
        ![0, 8].includes(method) ||
        directory.getUint16(position + 34, true) !== 0 ||
        compressed === 0xffffffff ||
        expanded === 0xffffffff ||
        localOffset >= offset
      )
        fail("Unsupported or invalid ZIP entry");
      const path = safeArchivePath(
        decoder.decode(
          bytes.subarray(position + 46, position + 46 + nameLength),
        ),
      );
      if (names.has(path.toLowerCase())) fail("ZIP contains duplicate paths");
      names.add(path.toLowerCase());
      if (
        expanded > max.maxFileBytes ||
        (total += expanded) > max.maxTotalBytes
      )
        fail("ZIP is too large");
      const header = new DataView(
        await blob.slice(localOffset, localOffset + 30).arrayBuffer(),
      );
      if (
        header.byteLength !== 30 ||
        header.getUint32(0, true) !== 0x04034b50 ||
        header.getUint16(8, true) !== method ||
        header.getUint16(6, true) !== flags
      )
        fail("ZIP local header is invalid");
      const localNameLength = header.getUint16(26, true);
      const start =
        localOffset + 30 + localNameLength + header.getUint16(28, true);
      const localName = decoder.decode(
        await blob
          .slice(localOffset + 30, localOffset + 30 + localNameLength)
          .arrayBuffer(),
      );
      if (
        localName !== path ||
        start + compressed > offset ||
        (method === 0 && compressed !== expanded)
      )
        fail("ZIP local header is invalid");
      if (!path.endsWith("/"))
        files.push({ path, method, crc, compressed, expanded, start });
      else if (expanded !== 0) fail("ZIP directory contains file data");
      position = next;
    }
    if (position !== bytes.length) fail("ZIP metadata is invalid");
    return files;
  }

  const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit++)
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
  });
  async function installStream(record, blob, dependencies = {}) {
    const { cache, store, signal, Inflate } = dependencies;
    const origin = dependencies.origin || location.origin;
    const game = validateCatalogRecord(record, { origin });
    if (game.packageType !== "gamezip") fail("A GameZIP archive is required");
    signal?.throwIfAborted();
    const files = await readArchiveIndex(blob, dependencies.limits);
    const launch = files.find(
      (file) =>
        file.path.toLowerCase() ===
        archiveLaunchPath(game.launchCommand).toLowerCase(),
    );
    if (!launch) fail("ZIP does not contain the launch SWF");
    const written = [];
    try {
      for (const file of files) {
        signal?.throwIfAborted();
        const key = cacheKey(origin, game.uuid, file.path);
        const stream = new TransformStream();
        const writer = stream.writable.getWriter();
        let cacheError, decoder, pending;
        const cached = cache
          .put(key, makeResponse(stream.readable, dependencies, file.path))
          .catch((error) => {
            cacheError = error;
            void writer.abort(error).catch(() => {});
          });
        // Include the active response in rollback even if cache.put fails late.
        written.push(key);
        const abort = () => {
          const reason =
            signal.reason ||
            new DOMException("Download cancelled", "AbortError");
          pending?.reject(reason);
          decoder?.terminate();
          void writer.abort(reason).catch(() => {});
        };
        signal?.addEventListener("abort", abort, { once: true });
        let length = 0,
          crc = 0xffffffff;
        try {
          if (file.method === 8) {
            decoder = new Inflate((error, data) => {
              const current = pending;
              pending = null;
              if (error) current?.reject(error);
              else current?.resolve(data);
            });
          }
          for (
            let offset = 0;
            offset < file.compressed || offset === 0;
            offset += 4096
          ) {
            signal?.throwIfAborted();
            const chunk = new Uint8Array(
              await blob
                .slice(
                  file.start + offset,
                  file.start + Math.min(offset + 4096, file.compressed),
                )
                .arrayBuffer(),
            );
            signal?.throwIfAborted();
            const final = offset + 4096 >= file.compressed;
            const data = decoder
              ? await new Promise((resolve, reject) => {
                  pending = { resolve, reject };
                  decoder.push(chunk, final);
                })
              : chunk;
            length += data.length;
            if (length > file.expanded)
              fail("ZIP file exceeds its declared size");
            for (const byte of data)
              crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
            if (data.length) await writer.write(data);
            if (final) break;
          }
          if (length !== file.expanded || (crc ^ 0xffffffff) >>> 0 !== file.crc)
            fail("ZIP file is corrupt");
          await writer.close();
          await cached;
          if (cacheError) throw cacheError;
        } catch (error) {
          await writer.abort(error).catch(() => {});
          await cached;
          throw error;
        } finally {
          signal?.removeEventListener("abort", abort);
          decoder?.terminate();
          writer.releaseLock();
        }
      }
      signal?.throwIfAborted();
      const launchPath = cacheKey(origin, game.uuid, launch.path);
      const metadata = {
        ...game,
        id: `flashpoint:${game.uuid}`,
        type: "swf",
        source: "Flashpoint Archive",
        launchPath,
        basePath: launchPath.slice(0, launchPath.lastIndexOf("/") + 1),
      };
      await putMetadata(store, metadata);
      return metadata;
    } catch (error) {
      await Promise.all(
        written.map((key) => cache.delete(key).catch(() => {})),
      );
      throw error;
    }
  }

  async function installLegacy(record, swfBytes, dependencies = {}) {
    if (
      !(swfBytes instanceof Uint8Array) &&
      typeof swfBytes?.stream !== "function"
    )
      fail("Game file must be a Uint8Array");
    const fileSize = swfBytes.byteLength ?? swfBytes.size;
    if (fileSize === 0) fail("Game file is empty");
    const maxFileBytes =
      dependencies.limits?.maxFileBytes || DEFAULT_LIMITS.maxFileBytes;
    if (fileSize > maxFileBytes) fail("Game file is too large");
    if (
      !dependencies.cache ||
      typeof dependencies.cache.put !== "function" ||
      typeof dependencies.cache.delete !== "function"
    )
      fail("Cache dependency is required");
    if (
      !dependencies.store ||
      (typeof dependencies.store.put !== "function" &&
        typeof dependencies.store.set !== "function")
    )
      fail("Metadata store dependency is required");
    const origin =
      dependencies.origin ||
      (typeof location !== "undefined"
        ? location.origin
        : "https://astro.local");
    const game = validateCatalogRecord(record, { origin });
    if (game.packageType !== "legacy")
      fail("Only Legacy games can be installed from a launch SWF");
    const launchPath = archiveLaunchPath(game.launchCommand);
    const resolvedLaunchPath = cacheKey(origin, game.uuid, launchPath);
    try {
      dependencies.signal?.throwIfAborted();
      await dependencies.cache.put(
        resolvedLaunchPath,
        makeResponse(
          swfBytes.stream ? swfBytes.stream() : swfBytes,
          dependencies,
          launchPath,
        ),
      );
      dependencies.signal?.throwIfAborted();
      const metadata = Object.assign({}, game, {
        id: "flashpoint:" + game.uuid,
        type: "swf",
        source: "Flashpoint Archive",
        launchPath: resolvedLaunchPath,
        basePath: resolvedLaunchPath.slice(
          0,
          resolvedLaunchPath.lastIndexOf("/") + 1,
        ),
      });
      await putMetadata(dependencies.store, metadata);
      return metadata;
    } catch (error) {
      await dependencies.cache.delete(resolvedLaunchPath).catch(() => {});
      throw error;
    }
  }

  async function uninstall(uuid, dependencies = {}) {
    if (typeof uuid !== "string" || !UUID.test(uuid)) fail("Invalid game UUID");
    if (
      !dependencies.cache ||
      typeof dependencies.cache.keys !== "function" ||
      typeof dependencies.cache.delete !== "function"
    )
      fail("Cache dependency is required");
    if (
      !dependencies.store ||
      (typeof dependencies.store.delete !== "function" &&
        typeof dependencies.store.remove !== "function")
    )
      fail("Metadata store dependency is required");
    const origin =
      dependencies.origin ||
      (typeof location !== "undefined"
        ? location.origin
        : "https://astro.local");
    const prefix = cacheKey(origin, uuid.toLowerCase(), "");
    const keys = await dependencies.cache.keys();
    await Promise.all(
      keys
        .filter((key) => String(key.url || key).startsWith(prefix))
        .map((key) => dependencies.cache.delete(key)),
    );
    await deleteMetadata(
      dependencies.store,
      "flashpoint:" + uuid.toLowerCase(),
    );
  }

  return {
    DEFAULT_LIMITS,
    validateCatalogRecord,
    archiveLaunchPath,
    safeArchivePath,
    validateZipMetadata,
    validateZipEntries,
    install,
    installStream,
    readArchiveIndex,
    installLegacy,
    uninstall,
  };
});
