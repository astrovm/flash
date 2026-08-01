(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AstroFlashUrlRouter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const routeKey = (value, baseUrl) => {
    const url = new URL(value, baseUrl);
    return `${url.hostname.toLowerCase()}${url.pathname}`;
  };

  const validateLocalPath = (path) => {
    if (
      typeof path !== "string" ||
      !path.startsWith("swf/") ||
      path.includes("\\") ||
      path.includes("\0") ||
      path.split("/").includes("..")
    ) {
      throw new Error(`Invalid local Flash route: ${path}`);
    }
    return path;
  };

  const create = (
    games,
    pageUrl = root.location?.href,
    gameRoots = root.ASTRO_GAME_ROOTS || {},
  ) => {
    if (!pageUrl) throw new Error("Flash URL routing requires a page URL.");
    const routes = new Map();

    for (const [gameId, game] of Object.entries(games || {})) {
      for (const [remoteUrl, localPath] of Object.entries(
        game.archive?.routes || {},
      )) {
        const key = routeKey(remoteUrl, pageUrl);
        if (routes.has(key)) {
          throw new Error(`Duplicate Flash route for ${key}`);
        }
        const sourceRoot = `swf/${gameId}/`;
        const validatedPath = validateLocalPath(localPath);
        if (!validatedPath.startsWith(sourceRoot)) {
          throw new Error(`Flash route escapes its game package: ${localPath}`);
        }
        const gameRoot = gameRoots[gameId] || sourceRoot;
        if (
          typeof gameRoot !== "string" ||
          !gameRoot.startsWith("swf/") ||
          !gameRoot.endsWith("/") ||
          gameRoot.includes("\\") ||
          gameRoot.split("/").includes("..")
        ) {
          throw new Error(`Invalid versioned Flash root: ${gameRoot}`);
        }
        routes.set(key, {
          gameId,
          localPath: validatedPath.replace(sourceRoot, gameRoot),
        });
      }
    }

    const resolve = (request) => {
      const originalUrl =
        typeof request === "string" || request instanceof URL
          ? new URL(request, pageUrl)
          : new URL(request.url);
      const route = routes.get(routeKey(originalUrl, pageUrl));
      if (!route) return null;
      const localUrl = new URL(route.localPath, pageUrl);
      localUrl.search = originalUrl.search;
      return { ...route, localUrl, originalUrl };
    };

    const rewrite = (request, init) => {
      const match = resolve(request);
      if (!match) return null;
      const originalRequest =
        request instanceof Request
          ? new Request(request, init)
          : new Request(match.originalUrl, init);
      // Every archive route resolves to an immutable local file. Flash APIs
      // such as LoadVars may POST to the original dynamic endpoint, but the
      // archived response must be read from the static file with GET.
      const method = originalRequest.method === "HEAD" ? "HEAD" : "GET";
      return {
        ...match,
        request: new Request(match.localUrl, {
          cache: originalRequest.cache,
          credentials: originalRequest.credentials,
          headers: originalRequest.headers,
          integrity: originalRequest.integrity,
          method,
          redirect: originalRequest.redirect,
          referrer: originalRequest.referrer,
          referrerPolicy: originalRequest.referrerPolicy,
          signal: originalRequest.signal,
        }),
      };
    };

    const spoofResponseUrl = (response, originalUrl) => {
      Object.defineProperty(response, "url", {
        configurable: true,
        value: originalUrl.href || String(originalUrl),
      });
      return response;
    };

    const wrapFetch = (fetcher, onRoute) => async (request, init) => {
      const routed = rewrite(request, init);
      if (!routed) return fetcher(request, init);
      const response = await fetcher(routed.request);
      onRoute?.(routed);
      return spoofResponseUrl(response, routed.originalUrl);
    };

    return {
      resolve,
      rewrite,
      routeCount: routes.size,
      spoofResponseUrl,
      wrapFetch,
    };
  };

  return { create, routeKey };
});
