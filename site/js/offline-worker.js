(() => {
  "use strict";

  // The generated Workbox worker imports this file. Workbox owns the small,
  // automatic application-shell precache; this handler serves only the
  // optional bundled games and shared Ruffle runtime selected by the user.
  const BUNDLED_GAME_CACHE = "astro-bundled-games-v1";
  const OPTIONAL_PATHS = ["/swf/", "/iframe/", "/dos/"];

  self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;
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
