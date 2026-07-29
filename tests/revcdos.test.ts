import { expect, test } from "bun:test";

const projectDirectory = new URL("..", import.meta.url);
const read = (relativePath: string) =>
  Bun.file(new URL(relativePath, projectDirectory)).text();

const [games, main, host, game, source, preloadFiles] = await Promise.all([
  read("site/js/games.js"),
  read("site/js/main.js"),
  read("site/iframe/revcdos/index.html"),
  read("site/iframe/revcdos/game.js"),
  read("site/iframe/revcdos/SOURCE.md"),
  read("site/iframe/revcdos/preload_files.list"),
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
  expect(preloadFiles).toContain("vc-assets/local/models/gta3.dir");
  expect(source).toContain("does not bundle the compatible game-data package");
});

test("hosts the file-selection protocol inside the Astro Flash iframe", () => {
  expect(host).toContain('type="file" webkitdirectory directory');
  expect(host).toContain('gameFrame.src = "game.html"');
  expect(host).toContain('message.event === "module.initfs"');
  expect(host).toContain('message.event === "module.getasyncurl"');
  expect(game).toContain("window.parent.postMessage");
  expect(game).not.toContain("window.top.postMessage");
});

test("offers a persistent WebTorrent download alongside manual selection", async () => {
  expect(host).toContain('id="download-button"');
  expect(host).toContain(
    'import WebTorrent from "../../vendor/webtorrent/3.0.21/webtorrent.min.js"',
  );
  expect(host).toContain("revcdoseng.torrent");
  expect(host).toContain("navigator.storage.getDirectory()");
  expect(host).toContain("new URL(TORRENT_URL, location.href).href");
  expect(host).toContain("wss://tracker.openwebtorrent.com");
  expect(host).toContain("announce: WEB_TRACKERS");
  expect(host).toContain("stun:stun.l.google.com:19302");
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

test("marks a completed persistent download as an offline game", () => {
  expect(host).toContain('event: "astro.offline-game-ready"');
  expect(host).toContain('gameId: "revcdos"');
  expect(main).toContain('message?.event !== "astro.offline-game-ready"');
  expect(main).toContain("event.source !== win.player?.contentWindow");
  expect(main).toContain("offlineManager.downloadGame(message.gameId)");
});

test("preserves required reVCDOS attribution and cloud saves", () => {
  expect(host).toContain("https://dos.zone/revcdos/");
  expect(source).toContain("DOS.Zone Team attribution");
  expect(source).toContain("jsdos-cloud-sdk.js");
});
