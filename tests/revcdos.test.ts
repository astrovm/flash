import { expect, test } from "bun:test";

const projectDirectory = new URL("..", import.meta.url);
const read = (relativePath: string) =>
  Bun.file(new URL(relativePath, projectDirectory)).text();

const [
  games,
  main,
  host,
  gameHtml,
  game,
  source,
  packageManifest,
  fetchModule,
  packedStore,
  offlineWorker,
] = await Promise.all([
  read("site/js/games.js"),
  read("site/js/main.js"),
  read("site/iframe/revcdos/index.html"),
  read("site/iframe/revcdos/game.html"),
  read("site/iframe/revcdos/game.js"),
  read("site/iframe/revcdos/SOURCE.md"),
  read("site/iframe/revcdos/modules/packages/en.js"),
  read("site/iframe/revcdos/modules/fetch.js"),
  read("site/iframe/revcdos/packed-store.js"),
  read("site/js/offline-worker.js"),
]);

test("registers reVCDOS as a bundled iframe application", () => {
  expect(games).toContain("revcdos: {");
  expect(games).toContain('title: "reVCDOS"');
  expect(games).toContain('icon: "assets/icons/revcdos.png"');
  expect(games).toContain('type: "iframe"');
});

test("ships the engine without bundled game data", async () => {
  const runtime = Bun.file(
    new URL("site/iframe/revcdos/index.wasm", projectDirectory),
  );
  expect(await runtime.exists()).toBe(true);
  expect(
    new Bun.CryptoHasher("sha256")
      .update(await runtime.arrayBuffer())
      .digest("hex"),
  ).toBe("db6aa7b9169a638e06b17f7bed5a6b3e473e00ae7bbb47354729fa94b971ebf2");
  expect(packageManifest).toContain(
    'filename: "/vc-assets/local/anim/ped.ifp"',
  );
  expect(packageManifest).toContain("remote_package_size: 135355111");
  expect(source).toContain("does not bundle the compatible");
  expect(source).toContain("game-data package");
  expect(source).toContain("Original-game media");
  expect(
    await Bun.file(
      new URL("site/iframe/revcdos/cover.jpg", projectDirectory),
    ).exists(),
  ).toBe(false);
  expect(
    await Bun.file(
      new URL("site/iframe/revcdos/intro.mp4", projectDirectory),
    ).exists(),
  ).toBe(false);
});

test("serves the Lolendor runtime through a packed OPFS store", async () => {
  expect(host).toContain('id="file-input"');
  expect(host).toContain("webkitdirectory");
  expect(host).toContain("directory");
  expect(host).toContain('"game.html?session=1"');
  expect(host).toContain("loadPackedManifest");
  expect(host).toContain("packFiles");
  expect(host).toContain("destroyTorrent");
  expect(host).toContain("{ destroyStore: true }");
  expect(host).toContain("verifyPackedAssets");
  expect(host).toContain('headers: { Range: "bytes=0-0" }');
  expect(host).not.toContain('message.event === "module.package"');
  expect(host).not.toContain('message.event === "module.getfile"');
  expect(game).toContain("DATA_PACKAGE.files[nextFile++]");
  expect(game).toContain("getPreloadedPackage: () => {");
  expect(game).toContain("return data.buffer");
  expect(game).toContain("local-assets/");
  expect(game).toContain("await fetch(localAssetUrl(filename)");
  expect(game).toContain('params.get("session") === "1"');
  expect(game).toContain('event: "revcdos.asset-request"');
  expect(host).toContain("setSessionFiles(entries)");
  expect(host).toContain('message.event === "revcdos.asset-request"');
  expect(host).toContain("const buffer = await file.arrayBuffer()");
  expect(game).not.toContain("fetchLocalAsset");
  expect(game).toContain(`let cheatsEnabled = params.get("cheats") !== "0"`);
  expect(game).toContain("ownerShipConfirmed();");
  expect(
    await Bun.file(
      new URL("site/iframe/revcdos/modules/cheats.js", projectDirectory),
    ).exists(),
  ).toBe(true);
  expect(fetchModule).toContain("var xhr = new XMLHttpRequest()");
  expect(fetchModule).not.toContain('Module["fetchLocalAsset"]');
  expect(game).toContain("window.parent.postMessage");
  expect(game).not.toContain("window.top.postMessage");
  expect(game).not.toContain("vc-sky-en-v6.data");
  expect(host).not.toContain("preload_files.list");
  expect(packedStore).toContain('"astro-flash-revcdos"');
  expect(packedStore).toContain("createWritable()");
  expect(packedStore).toContain("for await (const chunk of readChunks(file))");
  expect(packedStore).toContain(
    "manifestWriter.write(JSON.stringify(manifest))",
  );
  expect(offlineWorker).toContain(
    'const REVCDOS_ROUTE = "/iframe/revcdos/local-assets/"',
  );
  expect(offlineWorker).toContain("data.slice(");
  expect(offlineWorker).toContain('"Content-Range"');
});

test("shows actionable startup errors above the game canvas", () => {
  expect(gameHtml).toContain('id="startup-error"');
  expect(gameHtml).toContain('role="alert"');
  expect(gameHtml).toContain('id="startup-error-retry"');
  expect(game).toContain("function showStartupError(");
  expect(game).toContain("startupError.hidden = false");
  expect(game).toContain('canvas.addEventListener("webglcontextcreationerror"');
  expect(game).toContain('canvas.addEventListener("webglcontextlost"');
  expect(game).toContain('window.addEventListener("unhandledrejection"');
  expect(game).toContain("script.onerror");
  expect(game).toContain("window.location.reload()");
  expect(game).toContain("Enable browser hardware acceleration");
});

test("offers temporary or persistent WebTorrent downloads alongside manual selection", async () => {
  expect(host).toContain('id="download-button"');
  expect(host).toContain("Select your game files…");
  expect(host).toContain("Download from torrent");
  expect(host.indexOf('for="file-input"')).toBeLessThan(
    host.indexOf('for="torrent-source"'),
  );
  expect(host).toContain('id="torrent-source"');
  expect(host).toContain('value="revcdoseng.torrent"');
  expect(host).toContain('id="torrent-file-input"');
  expect(host).toContain("magnet:?");
  expect(host).toContain("new Uint8Array(await torrentFile.arrayBuffer())");
  expect(host).toContain(
    'import WebTorrent from "../../vendor/webtorrent/3.0.21/webtorrent.min.js"',
  );
  expect(host).toContain("revcdoseng.torrent");
  expect(host).toContain("await navigator.storage.getDirectory()");
  expect(host).toContain("torrentOptions.storeOpts = { rootDir }");
  expect(host).toContain("const torrent = client.add(torrentSource");
  expect(host).toContain("wss://cloud.dos.zone:8444/announce-ws");
  expect(host).toContain("announce: WEB_TRACKERS");
  expect(host).toContain('fetch("/api/rtc", { cache: "no-store" })');
  expect(host).toContain("rtcConfig: { iceServers }");
  expect(host).toContain("verifyTrackerConnection()");
  expect(host).toContain("verifyPeerConnections(iceServers)");
  expect(host).toContain("globalThis.RTCPeerConnection");
  expect(host).toContain("Checking peer connection support");
  expect(host).toContain("No peer connection was established");
  expect(host).toContain("Try torrent download again");
  expect(host).not.toContain("Download automatically");
  expect(host).not.toContain("Download and optimize");
  expect(host).toContain("destroyStoreOnDestroy: !keepBrowserCopy");
  expect(host).toContain("if (keepBrowserCopy)");
  expect(host).not.toContain("navigator.storage.estimate()");
  expect(host).toContain("../../js/storage-policy.js");
  expect(host).toContain("storagePolicy.errorMessage(error)");
  expect(packedStore).toContain(
    "storagePolicy.requestPersistence(navigator.storage)",
  );
  expect(packedStore).toContain("directory.removeEntry(dataFile)");
  expect(host).toContain("uploads: 2");
  expect(host).toContain("skipVerify: cached");
  expect(host).toContain("torrent.files.map");
  const torrent = Bun.file(
    new URL("site/iframe/revcdos/revcdoseng.torrent", projectDirectory),
  );
  expect(await torrent.exists()).toBe(true);
  expect(
    new Bun.CryptoHasher("sha256")
      .update(await torrent.arrayBuffer())
      .digest("hex"),
  ).toBe("4e10814f38354edc27f480ac26bd8ccc80f74731bb61714775750b528344f0c9");
  expect(
    await Bun.file(
      new URL(
        "site/vendor/webtorrent/3.0.21/webtorrent.min.js",
        projectDirectory,
      ),
    ).exists(),
  ).toBe(true);
});

test("caches the engine after torrent completion or manual selection", () => {
  expect(host).toContain('event: "astro.offline-game-ready"');
  expect(host).toContain('gameId: "revcdos"');
  expect(host.match(/cacheEngineForOfflineUse\(\)/g)).toHaveLength(2);
  expect(main).toContain('message?.event !== "astro.offline-game-ready"');
  expect(main).toContain("event.source !== win.player?.contentWindow");
  expect(main).toContain("offlineManager.downloadGame(message.gameId)");
});

test("preserves required reVCDOS attribution and cloud saves", () => {
  expect(host).toContain("https://dos.zone/revcdos/");
  expect(source).toContain("DOS.Zone Team attribution");
  expect(source).toContain("jsdos-cloud-sdk.js");
});
