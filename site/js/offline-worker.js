(() => {
  "use strict";

  // The generated Workbox worker imports this file. Workbox owns the small,
  // automatic application-shell precache; this handler serves only the
  // optional bundled games and shared Ruffle runtime selected by the user.
  const BUNDLED_GAME_CACHE = "astro-bundled-games-v1";
  const OPTIONAL_PATHS = ["/swf/", "/iframe/", "/dos/", "/vendor/scummvm/"];
  const REVCDOS_ROUTE = "/iframe/revcdos/local-assets/";
  const REVCDOS_DIRECTORY = "astro-flash-revcdos";
  const REVCDOS_MANIFEST = "manifest.json";
  let revcdosStorePromise;

  const normalizeAssetPath = (path) =>
    decodeURIComponent(path)
      .replaceAll("\\", "/")
      .replace(/^\/+/, "")
      .toLowerCase();

  const findPackedAsset = (files, requestedPath) => {
    const path = normalizeAssetPath(requestedPath);
    const candidates = [
      path,
      path.replace(/^fetched\//, "vc-assets/local/"),
      path.replace(/^vcsky\/fetched\//, "vc-assets/local/"),
    ];
    for (const candidate of candidates) {
      if (files[candidate]) return files[candidate];
    }
    return null;
  };

  const openRevcdosStore = async () => {
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle(REVCDOS_DIRECTORY);
    const manifestHandle = await directory.getFileHandle(REVCDOS_MANIFEST);
    const manifest = JSON.parse(await (await manifestHandle.getFile()).text());
    if (
      manifest.version !== 1 ||
      typeof manifest.dataFile !== "string" ||
      typeof manifest.files !== "object"
    ) {
      throw new Error("Invalid reVCDOS packed manifest");
    }
    const dataHandle = await directory.getFileHandle(manifest.dataFile);
    const data = await dataHandle.getFile();
    if (data.size !== manifest.size) {
      throw new Error("Incomplete reVCDOS packed data");
    }
    return { data, files: manifest.files };
  };

  const parseRange = (header, length) => {
    if (!header) return { start: 0, end: length - 1, partial: false };
    const match = /^bytes=(\d*)-(\d*)$/.exec(header);
    if (!match) return null;
    let start = match[1] ? Number(match[1]) : null;
    let end = match[2] ? Number(match[2]) : null;
    if (start === null) {
      const suffix = end;
      if (!suffix) return null;
      start = Math.max(0, length - suffix);
      end = length - 1;
    } else {
      end = end === null ? length - 1 : Math.min(end, length - 1);
    }
    if (start < 0 || start > end || start >= length) return null;
    return { start, end, partial: true };
  };

  const serveRevcdosAsset = async (request, url) => {
    try {
      revcdosStorePromise ||= openRevcdosStore();
      const { data, files } = await revcdosStorePromise;
      const requestedPath = url.pathname.slice(
        url.pathname.indexOf(REVCDOS_ROUTE) + REVCDOS_ROUTE.length,
      );
      const asset = findPackedAsset(files, requestedPath);
      if (!asset) return new Response("Asset not found", { status: 404 });
      const range = parseRange(request.headers.get("range"), asset.length);
      if (!range) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${asset.length}` },
        });
      }
      const length = range.end - range.start + 1;
      const headers = new Headers({
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
        "Content-Length": String(length),
        "Content-Type": "application/octet-stream",
      });
      if (range.partial) {
        headers.set(
          "Content-Range",
          `bytes ${range.start}-${range.end}/${asset.length}`,
        );
      }
      return new Response(
        data.slice(asset.offset + range.start, asset.offset + range.end + 1),
        { status: range.partial ? 206 : 200, headers },
      );
    } catch (error) {
      revcdosStorePromise = undefined;
      return new Response(`Packed asset unavailable: ${error.message}`, {
        status: 503,
      });
    }
  };

  self.addEventListener("message", (event) => {
    if (event.data?.type === "REVCDOS_PACK_UPDATED") {
      revcdosStorePromise = undefined;
    }
  });

  self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith(REVCDOS_ROUTE)) {
      event.respondWith(serveRevcdosAsset(event.request, url));
      return;
    }
    const isGameFile = OPTIONAL_PATHS.some((prefix) =>
      url.pathname.startsWith(prefix),
    );
    const isRuffleRuntime =
      url.pathname.startsWith("/js/") &&
      (url.pathname.endsWith(".wasm") ||
        /\/core\.ruffle\.[^/]+\.js$/.test(url.pathname));
    if (!isGameFile && !isRuffleRuntime) return;

    event.respondWith(
      caches.open(BUNDLED_GAME_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request, { ignoreSearch: true });
        return cached || fetch(event.request);
      }),
    );
  });
})();
