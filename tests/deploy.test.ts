import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";

import {
  BuildPaths,
  PRECACHE_FILE_SUFFIXES,
  build,
  generateServiceWorker,
  getDeploymentVersion,
  installJsDos,
  installRuffle,
  installWebtorrent,
  updateHtml,
  validatePrecacheIntegrity,
  validateReleaseOutput,
  validateOutput,
  versionOfflineGameManifest,
  writeOfflineGameManifest,
  writeVersionMetadata,
} from "../tools/deploy";

const temporaryDirectories: string[] = [];

async function makeTemporaryDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "astro-flash-deploy-test-"));
  temporaryDirectories.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

async function writeFiles(
  root: string,
  files: Record<string, string | Uint8Array>,
): Promise<void> {
  for (const [relativePath, content] of Object.entries(files)) {
    const path = join(root, relativePath);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, content);
  }
}

async function makeSource(root: string): Promise<void> {
  await writeFiles(root, {
    "index.html": [
      "<head>",
      '<meta name="astro-version" content="development" />',
      '<script src="js/startup-recovery.js"></script>',
      '<script src="js/ruffle.js?v=old"></script>',
      '<script src="vendor/fflate/index.js?v=old"></script>',
      '<script src="js/games.js?v=old"></script>',
      '<script src="js/flash-url-router.js?v=old"></script>',
      '<script src="js/storage-policy.js?v=old"></script>',
      '<script src="js/game-installer.js?v=old"></script>',
      '<script src="js/game-library.js?v=old"></script>',
      '<script src="js/game-data.js?v=old"></script>',
      '<script src="js/filesystem.js?v=old"></script>',
      '<script src="js/file-operations.js?v=old"></script>',
      '<script src="js/dialogs.js?v=old"></script>',
      '<script src="js/offline.js?v=old"></script>',
      '<script type="module" src="apps/index.js"></script>',
      '<script src="js/shell/desktop.js"></script>',
      '<script src="js/main.js?v=old"></script>',
      '<link rel="stylesheet" href="css/main.css?v=old">',
      '<link rel="stylesheet" href="css/shell/desktop.css">',
      '<link rel="icon" href="favicon.ico">',
      '<img src="assets/xp/bliss.jpg">',
      "</head>",
    ].join("\n"),
    "capture.html": [
      '<script src="js/ruffle.js?v=old"></script>',
      '<script src="js/games.js?v=old"></script>',
      '<script src="js/flash-url-router.js?v=old"></script>',
    ].join("\n"),
    "js/games.js": 'const icon = "assets/icons/game.png";',
    "js/flash-url-router.js": "flash url router",
    "js/storage-policy.js": "storage policy",
    "js/game-installer.js": "game installer",
    "js/game-library.js": "game library",
    "js/game-data.js": "game data",
    "js/filesystem.js": "filesystem",
    "js/file-operations.js": "file operations",
    "js/dialogs.js": "dialogs",
    "js/offline.js": "offline",
    "js/offline-worker.js": "offline worker",
    "js/startup-recovery.js": "startup recovery",
    "apps/index.js": "application registry",
    "apps/catalog.js": 'const icon = "assets/xp/icons/paint.png";',
    "js/shell/desktop.js": "desktop shell",
    "js/main.js": [
      'const APP_VERSION = "old";',
      'const sound = "assets/xp/sounds/startup.wav";',
    ].join("\n"),
    "css/main.css": [
      '@font-face { src: url("fonts/test.ttf"); }',
      'body { background: url("../assets/xp/bliss.jpg"); }',
    ].join("\n"),
    "css/shell/desktop.css": ".desktop { display: block; }",
    "css/fonts/test.ttf": "font",
    "assets/icons/game.png": "icon",
    "assets/icons/SOURCES.json": "{}",
    "assets/xp/bliss.jpg": "wallpaper",
    "assets/xp/Chess.bmp": "bitmap",
    "assets/xp/about.png": "about",
    "assets/xp/icons/paint.png": "paint",
    "assets/xp/sounds/startup.wav": "sound",
    "favicon.ico": "favicon",
    "vendor/fflate/index.js": "fflate",
    "vendor/js-dos/js-dos.js": "js-dos",
    "vendor/js-dos/emulators/wdosbox.wasm": "wasm",
    "vendor/webtorrent/webtorrent.min.js": "webtorrent",
    "vendor/boxedwine/26R1/boxedwine-shell.js": "boxedwine shell",
    "vendor/boxedwine/26R1/boxedwine-startup.js": "startup loader",
    "vendor/boxedwine/26R1/boxedwine.js":
      "return locateFile('boxedwine.wasm');",
    "vendor/boxedwine/26R1/boxedwine.wasm": "boxedwine wasm",
    "vendor/boxedwine/26R1/boxedwine.zip": "full root filesystem",
    "vendor/boxedwine/26R1/xp-accessories.zip": "minimal root filesystem",
    "vendor/boxedwine/26R1/preload.json": JSON.stringify({
      files: [
        "boxedwine-startup.js",
        "boxedwine-shell.js",
        "boxedwine.js",
        "boxedwine.wasm",
        "index.html",
        "xp-accessories.zip",
      ],
    }),
    "vendor/boxedwine/26R1/index.html": [
      '<script src="boxedwine-startup.js"></script>',
      '<script src="boxedwine-shell.js"></script>',
      '<script async src="boxedwine.js"></script>',
    ].join("\n"),
    "apps/core/boxedwine.js": [
      'const ROOT_ARCHIVE = "xp-accessories";',
      "new URL(`${RUNTIME_ROOT}index.html`, document.baseURI);",
    ].join("\n"),
    "swf/bike-mania/main.swf": "swf",
    "iframe/doom/index.html": "doom ../../dos/doom/doom.jsdos",
    "iframe/inside-the-firewall/index.html": "firewall",
    "iframe/pink-panther-hokus-pokus/index.html":
      '<script src="../../js/storage-policy.js?v=old"></script>',
    "iframe/pink-panther-passport-to-peril/index.html":
      '<script src="../../js/storage-policy.js?v=old"></script>',
    "iframe/revcdos/index.html":
      '<script src="../../js/storage-policy.js?v=old"></script>',
    "iframe/scummvm/launcher.js": [
      'const route = "/iframe/scummvm/local-games/peril";',
      'const dataPath = ["", "vendor", "scummvm", "2026.3.0", "data"].join("/");',
    ].join("\n"),
    "vendor/scummvm/2026.3.0/data/index.json": JSON.stringify({
      peril: { baseUrl: "/iframe/scummvm/local-games/peril" },
      pokus: { baseUrl: "/iframe/scummvm/local-games/pokus" },
    }),
    "vendor/scummvm/2026.3.0/scummvm.wasm": "scummvm",
    "dos/doom/doom.jsdos": "jsdos",
  });
}

async function addGeneratedRuntime(root: string): Promise<void> {
  await writeFiles(root, {
    "js/ruffle.js": "ruffle",
    "js/core.ruffle.abc123.js": "core",
    "js/abc123.wasm": "wasm",
    "sw.js": 's("workbox-f9030226", import.meta.url)',
    "workbox-f9030226.js": "workbox",
  });
}

async function fileSnapshot(root: string): Promise<Map<string, Uint8Array>> {
  const snapshot = new Map<string, Uint8Array>();
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile())
        snapshot.set(relative(root, path), await readFile(path));
    }
  }
  await visit(root);
  return snapshot;
}

describe("npm runtime installation", () => {
  test("copies Ruffle runtime files from a package directory", async () => {
    const root = await makeTemporaryDirectory();
    const source = join(root, "package");
    const jsDir = join(root, "js");
    await writeFiles(source, {
      "ruffle.js": "ruffle",
      "ruffle.js.map": "map",
      "core.ruffle.abc123.js": "core",
      "abc123.wasm": "wasm",
      "nested/ignored.js": "ignored",
      "README.md": "docs",
    });
    await installRuffle(jsDir, source);

    expect(await Bun.file(join(jsDir, "ruffle.js")).exists()).toBeTrue();
    expect(await Bun.file(join(jsDir, "abc123.wasm")).exists()).toBeTrue();
    expect(await Bun.file(join(jsDir, "ignored.js")).exists()).toBeFalse();
    expect(await Bun.file(join(jsDir, "README.md")).exists()).toBeFalse();
  });

  test("rejects incomplete Ruffle packages", async () => {
    const root = await makeTemporaryDirectory();
    const source = join(root, "package");
    await writeFiles(source, {
      "ruffle.js": "ruffle",
      "core.ruffle.abc123.js": "core",
    });
    await expect(installRuffle(join(root, "js"), source)).rejects.toThrow(
      "missing required runtime",
    );
  });

  test("copies js-dos and WebTorrent browser assets", async () => {
    const root = await makeTemporaryDirectory();
    const jsDosSource = join(root, "js-dos");
    const webtorrentSource = join(root, "webtorrent");
    const output = join(root, "out");
    await writeFiles(jsDosSource, {
      "dist/js-dos.js": "player",
      "dist/js-dos.css": "css",
      "dist/emulators/emulators.js": "emulators",
      "dist/emulators/wdosbox.js": "box",
      "dist/emulators/wdosbox.wasm": "box-wasm",
      "dist/emulators/wlibzip.js": "zip",
      "dist/emulators/wlibzip.wasm": "zip-wasm",
    });
    await writeFiles(webtorrentSource, {
      "dist/webtorrent.min.js": "torrent",
    });

    await installJsDos(output, jsDosSource);
    await installWebtorrent(output, webtorrentSource);

    const paths = new BuildPaths(output);
    expect(await readFile(join(paths.jsDosRoot, "js-dos.js"), "utf8")).toBe(
      "player",
    );
    expect(
      await readFile(
        join(paths.jsDosRoot, "emulators", "wdosbox.wasm"),
        "utf8",
      ),
    ).toBe("box-wasm");
    expect(await readFile(paths.webtorrentJs, "utf8")).toBe("torrent");
  });
});

describe("build metadata", () => {
  test("uses the commit date and short revision", () => {
    const outputs = ["2026-07-28", "abcdef123456"];
    const git = () => outputs.shift() ?? "";
    expect(getDeploymentVersion("main", "/tmp", git)).toBe("26.07.28-abcdef1");
  });

  test("rejects invalid git output", () => {
    const outputs = ["not-a-date", "abcdef1"];
    const git = () => outputs.shift() ?? "";
    expect(() => getDeploymentVersion("HEAD", "/tmp", git)).toThrow(
      "invalid commit date",
    );
  });

  test("versions main before hashing and writes matching manifests", async () => {
    const root = await makeTemporaryDirectory();
    await makeSource(root);
    await writeFiles(root, {
      "apps/core/boxedwine-runtime.js": [
        'const ROOT_ARCHIVE = "xp-accessories";',
        "new URL(`${RUNTIME_ROOT}index.html`, document.baseURI);",
      ].join("\n"),
      "iframe/boxedwine-runtime/index.html": [
        'const runner = "../../vendor/boxedwine/26R1/index.html";',
        'const options = { root: "xp-accessories" };',
      ].join("\n"),
      "iframe/boxedwine-runtime/xp-runtime.zip": "shared XP applications",
      "iframe/solitaire/xp-solitaire.zip": "legacy Solitaire package",
    });
    await addGeneratedRuntime(root);
    const paths = new BuildPaths(root);

    const hashedAssets = await updateHtml(paths, "26.07.28-abcdef1");
    await writeOfflineGameManifest(paths, "26.07.28-abcdef1");
    await writeVersionMetadata(paths, "26.07.28-abcdef1");
    const offlineManifestName = await versionOfflineGameManifest(paths);

    const main = await readFile(join(root, hashedAssets.mainJs), "utf8");
    const html = await readFile(paths.html, "utf8");
    expect(main).toContain('const APP_VERSION = "26.07.28-abcdef1";');
    expect(html).toContain(
      '<meta name="astro-version" content="26.07.28-abcdef1" />',
    );
    expect(html).toContain("startup recovery");
    expect(html).not.toContain('src="js/startup-recovery.js"');
    expect(
      await Bun.file(join(root, "js", "startup-recovery.js")).exists(),
    ).toBeFalse();
    expect(html).toContain(`${hashedAssets.mainJs}"`);
    expect(html).toContain(`${hashedAssets.flashUrlRouterJs}"`);
    expect(html).toContain(`${hashedAssets.storagePolicyJs}"`);
    expect(html).toContain(`${hashedAssets.gameInstallerJs}"`);
    expect(html).toContain(`${hashedAssets.gameLibraryJs}"`);
    expect(html).toContain(`${hashedAssets.gameDataJs}"`);
    expect(html).toContain(`${hashedAssets.fileOperationsJs}"`);
    expect(html).toContain(`${hashedAssets.mainCss}"`);
    expect(html).toContain(`${hashedAssets["entry:js/shell/desktop.js"]}"`);
    expect(html).toContain(`${hashedAssets["entry:apps/index.js"]}"`);
    expect(html).toContain(`${hashedAssets["entry:css/shell/desktop.css"]}"`);
    expect(html).toContain(
      `window.ASTRO_OFFLINE_MANIFEST_URL="${offlineManifestName}"`,
    );
    expect(offlineManifestName).toMatch(/^offline-games\.[a-f0-9]{8}\.json$/);
    const capture = await readFile(paths.captureHtml, "utf8");
    expect(capture).toContain(`${hashedAssets.ruffle}"`);
    expect(capture).toContain(`${hashedAssets.gamesJs}"`);
    expect(capture).toContain(`${hashedAssets.flashUrlRouterJs}"`);
    const manifest = JSON.parse(
      await readFile(join(root, offlineManifestName), "utf8"),
    );
    expect(manifest.games["bike-mania"].files[0].integrity).toMatch(
      /^sha384-[A-Za-z0-9+/]+={0,2}$/,
    );
    expect(manifest.games["boxedwine-runtime"]).toBeUndefined();
    expect(manifest.games.solitaire.runtime).toBe("boxedwine");
    expect(
      manifest.runtimes.boxedwine.files.some(
        (file: { url: string }) =>
          file.url.includes("/boxedwine-runtime.") &&
          file.url.includes("/xp-runtime.zip?rev="),
      ),
    ).toBeTrue();
    expect(html).toMatch(
      /"boxedwine-runtime":"iframe\/boxedwine-runtime\.[a-f0-9]{16}\//,
    );
    const boxedWineIndex = await readFile(
      join(root, "apps", "core", "boxedwine.js"),
      "utf8",
    );
    const boxedWineRunner = boxedWineIndex.match(
      /index\.[a-f0-9]{8}\.html/,
    )?.[0];
    expect(boxedWineRunner).toBeDefined();
    const boxedWineRunnerMarkup = await readFile(
      join(root, "vendor", "boxedwine", "26R1", boxedWineRunner!),
      "utf8",
    );
    const boxedWineJavaScript = boxedWineRunnerMarkup.match(
      /boxedwine\.[a-f0-9]{8}\.js/,
    )?.[0];
    const boxedWineShell = boxedWineRunnerMarkup.match(
      /boxedwine-shell\.[a-f0-9]{8}\.js/,
    )?.[0];
    const boxedWineRoot = boxedWineIndex.match(
      /xp-accessories-[a-f0-9]{8}/,
    )?.[0];
    expect(boxedWineJavaScript).toBeDefined();
    expect(boxedWineShell).toBeDefined();
    expect(boxedWineRoot).toBeDefined();
    expect(
      await Bun.file(
        join(root, "vendor", "boxedwine", "26R1", boxedWineJavaScript!),
      ).exists(),
    ).toBeTrue();
    expect(
      await Bun.file(
        join(root, "vendor", "boxedwine", "26R1", boxedWineShell!),
      ).exists(),
    ).toBeTrue();
    const boxedWineJavaScriptSource = await readFile(
      join(root, "vendor", "boxedwine", "26R1", boxedWineJavaScript!),
      "utf8",
    );
    expect(boxedWineJavaScriptSource).toMatch(
      /locateFile\('boxedwine\.[a-f0-9]{8}\.wasm'\)/,
    );
    const boxedWineWasm = boxedWineJavaScriptSource.match(
      /boxedwine\.[a-f0-9]{8}\.wasm/,
    )?.[0];
    expect(
      await Bun.file(
        join(root, "vendor", "boxedwine", "26R1", `${boxedWineRoot}.zip`),
      ).exists(),
    ).toBeTrue();
    expect(
      await Bun.file(
        join(root, "vendor", "boxedwine", "26R1", "boxedwine.zip"),
      ).exists(),
    ).toBeFalse();
    const boxedWinePreload = JSON.parse(
      await readFile(
        join(root, "vendor", "boxedwine", "26R1", "preload.json"),
        "utf8",
      ),
    );
    expect(boxedWinePreload.files).toEqual([
      "boxedwine-startup.js",
      boxedWineShell,
      boxedWineJavaScript,
      boxedWineWasm,
      boxedWineRunner,
      `${boxedWineRoot}.zip`,
    ]);
    for (const gameId of [
      "pink-panther-hokus-pokus",
      "pink-panther-passport-to-peril",
      "revcdos",
    ]) {
      expect(
        await readFile(
          join(root, manifest.games[gameId].root, "index.html"),
          "utf8",
        ),
      ).toContain(`../../${hashedAssets.storagePolicyJs}"`);
    }
    expect(html).toMatch(/favicon\.[a-f0-9]{8}\.ico"/);
    expect(html).toMatch(/assets\/xp\/bliss\.[a-f0-9]{8}\.jpg"/);
    expect(await readFile(join(root, hashedAssets.gamesJs), "utf8")).toMatch(
      /assets\/icons\/game\.[a-f0-9]{8}\.png/,
    );
    expect(await readFile(join(root, hashedAssets.mainJs), "utf8")).toMatch(
      /assets\/xp\/sounds\/startup\.[a-f0-9]{8}\.wav/,
    );
    expect(await readFile(join(root, hashedAssets.mainCss), "utf8")).toMatch(
      /fonts\/test\.[a-f0-9]{8}\.ttf/,
    );
    expect(await readFile(join(root, "apps/catalog.js"), "utf8")).toMatch(
      /assets\/xp\/icons\/paint\.[a-f0-9]{8}\.png/,
    );
    expect(await readFile(join(root, hashedAssets.mainCss), "utf8")).toMatch(
      /\.\.\/assets\/xp\/bliss\.[a-f0-9]{8}\.jpg/,
    );
    expect(await Bun.file(join(root, "js", "main.js")).exists()).toBeFalse();
    expect(await Bun.file(join(root, "css", "main.css")).exists()).toBeFalse();
    expect(PRECACHE_FILE_SUFFIXES.has(".ttf")).toBeTrue();
    expect(PRECACHE_FILE_SUFFIXES.has(".bmp")).toBeTrue();
    expect(PRECACHE_FILE_SUFFIXES.has(".data")).toBeTrue();

    const metadata = JSON.parse(await readFile(paths.versionJson, "utf8"));
    expect(metadata.offlineBytes).toBeGreaterThan(0);
    expect(metadata.bundledGameBytes).toBeGreaterThan(0);
    expect(Number.isFinite(Date.parse(metadata.releasedAt))).toBeTrue();
    expect(metadata.stabilityDelayMs).toBe(6 * 60 * 60 * 1000);
    expect(manifest.version).toBe("26.07.28-abcdef1");
    expect(manifest.games["bike-mania"].type).toBe("swf");
    expect(manifest.games.doom.type).toBe("iframe");
    expect(
      manifest.games.doom.files.map(({ url }: { url: string }) => url),
    ).toEqual([
      `${manifest.games.doom.root}dos/doom/doom.jsdos`,
      `${manifest.games.doom.root}index.html`,
    ]);
    const configuredRoots = JSON.parse(
      html.match(/window\.ASTRO_GAME_ROOTS=Object\.freeze\((\{[^<]+\})\)/)![1],
    );
    expect(configuredRoots).toMatchObject(
      Object.fromEntries(
        Object.entries(manifest.games).map(([id, game]: [string, any]) => [
          id,
          game.root,
        ]),
      ),
    );
    expect(configuredRoots["boxedwine-runtime"]).toMatch(
      /^iframe\/boxedwine-runtime\.[a-f0-9]{16}\/$/,
    );
    expect(manifest.runtime.files.length).toBeGreaterThan(0);
    expect(metadata.bundledGameBytes).toBe(
      manifest.runtime.bytes +
        Object.values(manifest.runtimes).reduce(
          (total: number, runtime: any) => total + runtime.bytes,
          0,
        ) +
        Object.values(manifest.games).reduce(
          (total: number, game: any) => total + game.bytes,
          0,
        ),
    );
    expect({
      revision: metadata.revision,
      version: metadata.version,
    }).toEqual({
      revision: "abcdef1",
      version: "26.07.28-abcdef1",
    });
  });

  test("fails when an asset reference is missing", async () => {
    const root = await makeTemporaryDirectory();
    await makeSource(root);
    await addGeneratedRuntime(root);
    const html = join(root, "index.html");
    await writeFile(
      html,
      (await readFile(html, "utf8")).replace(
        '<script src="js/dialogs.js?v=old"></script>',
        "",
      ),
    );
    expect(
      updateHtml(new BuildPaths(root), "26.07.28-abcdef1"),
    ).rejects.toThrow("Could not update asset reference");
  });

  test("rejects a hashed filename that does not match its content", async () => {
    const root = await makeTemporaryDirectory();
    await makeSource(root);
    await addGeneratedRuntime(root);
    const paths = new BuildPaths(root);
    const hashedAssets = await updateHtml(paths, "26.07.28-abcdef1");
    await writeFile(join(root, hashedAssets.mainJs), "tampered");
    await writeOfflineGameManifest(paths, "26.07.28-abcdef1");
    await writeVersionMetadata(paths, "26.07.28-abcdef1");
    await versionOfflineGameManifest(paths);
    await expect(validateOutput(root)).rejects.toThrow(
      "invalid content hash for js/main.js",
    );
  });
});

describe("Workbox and artifact validation", () => {
  test("precaches bitmap artwork and Pinball data", async () => {
    const root = await makeTemporaryDirectory();
    await writeFiles(root, {
      "index.html": "final index",
      "releases/26.07.28-abcdef1/js/offline-worker.12345678.js":
        "offline worker",
      "releases/26.07.28-abcdef1/assets/xp/Chess.12345678.bmp": "bitmap",
      "releases/26.07.28-abcdef1/apps/pinball/runtime/SpaceCadetPinball.data":
        "pinball data",
    });

    await generateServiceWorker(root, undefined, "26.07.28-abcdef1");

    const worker = await readFile(join(root, "sw.js"), "utf8");
    expect(worker).toContain(
      "releases/26.07.28-abcdef1/assets/xp/Chess.12345678.bmp",
    );
    expect(worker).toContain(
      "releases/26.07.28-abcdef1/apps/pinball/runtime/SpaceCadetPinball.data",
    );
    expect(worker).toContain(
      'importScripts("releases/26.07.28-abcdef1/js/offline-worker.12345678.js")',
    );
    expect(worker).toContain(
      `integrity:"sha384-${createHash("sha384")
        .update("bitmap")
        .digest("base64")}"`,
    );
    expect(worker).toContain(
      `integrity:"sha384-${createHash("sha384")
        .update("final index")
        .digest("base64")}"`,
    );
    await validatePrecacheIntegrity(root);
    await writeFile(join(root, "index.html"), "changed after generation");
    await expect(validatePrecacheIntegrity(root)).rejects.toThrow(
      "invalid integrity: index.html",
    );
  });

  test("generates a self-contained worker for the release directory", async () => {
    const root = await makeTemporaryDirectory();
    const release = join(root, "releases", "26.07.28-abcdef1");
    await writeFiles(root, {
      "index.html": "final index",
      "releases/26.07.28-abcdef1/js/offline-worker.12345678.js":
        "offline worker",
    });
    let configuration: any;
    const generator = async (options: any) => {
      configuration = options;
      await writeFiles(root, {
        "sw.js": 's("workbox-f9030226", import.meta.url)',
        "workbox-f9030226.js": "workbox",
      });
      return { count: 1, size: 1, warnings: [], filePaths: [] };
    };
    await generateServiceWorker(root, generator as any, "26.07.28-abcdef1");
    expect(configuration.inlineWorkboxRuntime).toBeTrue();
    expect(configuration.globDirectory).toBe(`${release}/`);
    expect(configuration.importScripts).toEqual([
      "releases/26.07.28-abcdef1/js/offline-worker.12345678.js",
    ]);
    expect(
      await Bun.file(join(root, "workbox-f9030226.js")).exists(),
    ).toBeFalse();
    expect(await readFile(join(root, "sw.js"), "utf8")).toContain(
      'self.__ASTRO_FLASH_VERSION__="26.07.28-abcdef1"',
    );
    expect(await readFile(join(root, "sw.26.07.28-abcdef1.js"), "utf8")).toBe(
      await readFile(join(root, "sw.js"), "utf8"),
    );
  });

  test("removes an unused external Workbox runtime", async () => {
    const root = await makeTemporaryDirectory();
    await writeFiles(root, {
      "js/offline-worker.12345678.js": "offline worker",
    });
    const generator = async () => {
      await writeFile(
        join(root, "sw.js"),
        's("workbox-deadbeef", import.meta.url)',
      );
      return { count: 1, size: 1, warnings: [], filePaths: [] };
    };
    await generateServiceWorker(root, generator as any);
    expect(
      await Bun.file(join(root, "workbox-deadbeef.js")).exists(),
    ).toBeFalse();
  });

  test("accepts a complete artifact and rejects a missing representative game", async () => {
    const root = await makeTemporaryDirectory();
    await makeSource(root);
    await addGeneratedRuntime(root);
    const paths = new BuildPaths(root);
    await updateHtml(paths, "26.07.28-abcdef1");
    await writeOfflineGameManifest(paths, "26.07.28-abcdef1");
    await writeVersionMetadata(paths, "26.07.28-abcdef1");
    const offlineManifestName = await versionOfflineGameManifest(paths);
    await validateOutput(root);

    const manifest = JSON.parse(
      await readFile(join(root, offlineManifestName), "utf8"),
    );
    await unlink(join(root, manifest.games["bike-mania"].root, "main.swf"));
    expect(validateOutput(root)).rejects.toThrow("missing game file");
  });
});

describe("atomic build", () => {
  test("keeps temporary build directories out of git status", async () => {
    const result = Bun.spawnSync(
      ["git", "check-ignore", ".dist-build-example/output/index.html"],
      {
        cwd: join(import.meta.dir, ".."),
        stderr: "pipe",
        stdout: "pipe",
      },
    );

    expect(result.success).toBe(true);
    expect(result.stdout.toString()).toContain(".dist-build-example");
  });

  test("does not mutate source and replaces old output", async () => {
    const project = await makeTemporaryDirectory();
    const source = join(project, "site");
    const output = join(project, "dist");
    await makeSource(source);
    const originalFiles = await fileSnapshot(source);
    await mkdir(output);
    await writeFile(join(output, "stale.txt"), "stale");

    await build({
      sourceDir: source,
      outputDir: output,
      version: "26.07.28-abcdef1",
      releasedAt: "2026-07-28T12:00:00.000Z",
      stabilityDelayMs: 2 * 60 * 60 * 1000,
      installRuffle: async (jsDir) =>
        writeFiles(jsDir, {
          "ruffle.js": "ruffle",
          "core.ruffle.abc123.js": "core",
          "abc123.wasm": "wasm",
        }),
    });

    const currentFiles = await fileSnapshot(source);
    expect([...currentFiles.keys()]).toEqual([...originalFiles.keys()]);
    for (const [path, bytes] of originalFiles) {
      expect(currentFiles.get(path)).toEqual(bytes);
    }
    expect(await Bun.file(join(output, "stale.txt")).exists()).toBeFalse();
    expect(await Bun.file(join(output, "sw.js")).exists()).toBeTrue();
    expect(
      await Bun.file(join(output, "sw.26.07.28-abcdef1.js")).exists(),
    ).toBeTrue();
    const release = join(output, "releases", "26.07.28-abcdef1");
    expect(
      await Bun.file(join(output, "apps", "core", "boxedwine.js")).exists(),
    ).toBeFalse();
    expect(
      await Bun.file(join(release, "apps", "core", "boxedwine.js")).exists(),
    ).toBeTrue();
    expect(
      await Bun.file(join(release, "offline-games.json")).exists(),
    ).toBeFalse();
    const rootHtml = await readFile(join(output, "index.html"), "utf8");
    expect(rootHtml).toContain('<base href="/releases/26.07.28-abcdef1/" />');
    const scummvmIndexPath = join(
      release,
      "vendor",
      "scummvm",
      "2026.3.0",
      "data",
      "index.json",
    );
    const scummvmIndex = JSON.parse(await readFile(scummvmIndexPath, "utf8"));
    expect(scummvmIndex.peril.baseUrl).toBe(
      "/releases/26.07.28-abcdef1/iframe/scummvm/local-games/peril",
    );
    const metadata = JSON.parse(
      await readFile(join(output, "version.json"), "utf8"),
    );
    expect(metadata.offlineBytes).toBeGreaterThan(0);
    expect(metadata.bundledGameBytes).toBeGreaterThan(0);
    expect(metadata.revision).toBe("abcdef1");
    expect(metadata.version).toBe("26.07.28-abcdef1");
    expect(metadata.releasedAt).toBe("2026-07-28T12:00:00.000Z");
    expect(metadata.stabilityDelayMs).toBe(2 * 60 * 60 * 1000);

    await writeFile(
      scummvmIndexPath,
      '{"peril":{"baseUrl":"/iframe/scummvm/local-games/peril"}}',
    );
    await expect(
      validateReleaseOutput(output, "26.07.28-abcdef1"),
    ).rejects.toThrow("unscoped release reference");
  });

  test("preserves previous output after a failed build", async () => {
    const project = await makeTemporaryDirectory();
    const source = join(project, "site");
    const output = join(project, "dist");
    await makeSource(source);
    await mkdir(output);
    await writeFile(join(output, "previous.txt"), "keep");

    await expect(
      build({
        sourceDir: source,
        outputDir: output,
        version: "26.07.28-abcdef1",
        installRuffle: async () => {
          throw new Error("network failed");
        },
      }),
    ).rejects.toThrow("network failed");
    expect(await readFile(join(output, "previous.txt"), "utf8")).toBe("keep");
  });

  test("rejects output inside the source tree", async () => {
    const project = await makeTemporaryDirectory();
    const source = join(project, "site");
    await makeSource(source);
    expect(
      build({
        sourceDir: source,
        outputDir: join(source, "dist"),
        version: "26.07.28-abcdef1",
      }),
    ).rejects.toThrow("outside");
  });
});
