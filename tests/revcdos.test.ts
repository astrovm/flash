import { expect, test } from "bun:test";

const projectDirectory = new URL("..", import.meta.url);
const read = (relativePath: string) =>
  Bun.file(new URL(relativePath, projectDirectory)).text();

const [games, main, host, game, source, packageManifest, fetchModule] =
  await Promise.all([
    read("site/js/games.js"),
    read("site/js/main.js"),
    read("site/iframe/revcdos/index.html"),
    read("site/iframe/revcdos/game.js"),
    read("site/iframe/revcdos/SOURCE.md"),
    read("site/iframe/revcdos/modules/packages/en.js"),
    read("site/iframe/revcdos/modules/fetch.js"),
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

test("adapts the Lolendor package and streaming protocols to local files", async () => {
  expect(host).toContain('type="file" webkitdirectory directory');
  expect(host).toContain('gameFrame.src = "game.html"');
  expect(host).toContain('message.event === "module.package"');
  expect(host).toContain('message.event === "module.getfile"');
  expect(host).toContain("new Uint8Array(message.size)");
  expect(host).toContain("Required file is missing");
  expect(game).toContain("DATA_PACKAGE.files.map");
  expect(game).toContain("getPreloadedPackage: () => {");
  expect(game).toContain("return data.buffer");
  expect(game).toContain("fetchLocalAsset");
  expect(game).toContain(`let cheatsEnabled = params.get("cheats") !== "0"`);
  expect(game).toContain("ownerShipConfirmed();");
  expect(
    await Bun.file(
      new URL("site/iframe/revcdos/modules/cheats.js", projectDirectory),
    ).exists(),
  ).toBe(true);
  expect(fetchModule).toContain('Module["fetchLocalAsset"](url_)');
  expect(game).toContain("window.parent.postMessage");
  expect(game).not.toContain("window.top.postMessage");
  expect(game).not.toContain("vc-sky-en-v6.data");
  expect(host).not.toContain("preload_files.list");
});

test("offers a persistent WebTorrent download alongside manual selection", async () => {
  expect(host).toContain('id="download-button"');
  expect(host).toContain(
    'import WebTorrent from "../../vendor/webtorrent/3.0.21/webtorrent.min.js"',
  );
  expect(host).toContain("revcdoseng.torrent");
  expect(host).toContain("await navigator.storage.getDirectory()");
  expect(host).toContain("storeOpts: { rootDir }");
  expect(host).toContain("new URL(TORRENT_URL, location.href).href");
  expect(host).toContain("wss://cloud.dos.zone:8444/announce-ws");
  expect(host).toContain("announce: WEB_TRACKERS");
  expect(host).toContain('fetch("/api/rtc", { cache: "no-store" })');
  expect(host).toContain("rtcConfig: { iceServers }");
  expect(host).toContain("verifyTrackerConnection()");
  expect(host).toContain("verifyPeerConnections(iceServers)");
  expect(host).toContain("globalThis.RTCPeerConnection");
  expect(host).toContain("Checking peer connection support");
  expect(host).toContain("No peer connection was established");
  expect(host).toContain("Try automatic download again");
  expect(host).toContain("destroyStoreOnDestroy: false");
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
