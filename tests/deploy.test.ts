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

import { zipSync } from "fflate";

import {
  BuildPaths,
  PRECACHE_FILE_SUFFIXES,
  build,
  downloadRuffle,
  generateServiceWorker,
  getDeploymentVersion,
  loadRuffleRelease,
  updateHtml,
  validateOutput,
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

function makeRuffleArchive({
  includeCore = true,
  includeWasm = true,
}: {
  includeCore?: boolean;
  includeWasm?: boolean;
} = {}): Uint8Array {
  return zipSync({
    "ruffle.js": new TextEncoder().encode("ruffle"),
    "ruffle.js.map": new TextEncoder().encode("map"),
    ...(includeCore
      ? { "core.ruffle.abc123.js": new TextEncoder().encode("core") }
      : {}),
    ...(includeWasm ? { "abc123.wasm": new TextEncoder().encode("wasm") } : {}),
    "nested/ignored.js": new TextEncoder().encode("ignored"),
  });
}

function archiveResponse(archive: Uint8Array): Response {
  return new Response(archive.slice().buffer as ArrayBuffer);
}

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
      '<script src="js/ruffle.js?v=old"></script>',
      '<script src="vendor/fflate/0.8.3/index.js?v=old"></script>',
      '<script src="js/games.js?v=old"></script>',
      '<script src="js/game-installer.js?v=old"></script>',
      '<script src="js/game-library.js?v=old"></script>',
      '<script src="js/filesystem.js?v=old"></script>',
      '<script src="js/file-operations.js?v=old"></script>',
      '<script src="js/dialogs.js?v=old"></script>',
      '<script src="js/offline.js?v=old"></script>',
      '<script src="js/main.js?v=old"></script>',
      '<link rel="stylesheet" href="css/main.css?v=old">',
      '<link rel="icon" href="favicon.ico">',
      '<img src="assets/xp/bliss.jpg">',
    ].join("\n"),
    "capture.html": '<script src="js/ruffle.js?v=old"></script>',
    "js/games.js": 'const icon = "assets/icons/game.png";',
    "js/game-installer.js": "game installer",
    "js/game-library.js": "game library",
    "js/filesystem.js": "filesystem",
    "js/file-operations.js": "file operations",
    "js/dialogs.js": "dialogs",
    "js/offline.js": "offline",
    "js/offline-worker.js": "offline worker",
    "js/main.js": [
      'const APP_VERSION = "old";',
      'const sound = "assets/xp/sounds/startup.mp3";',
    ].join("\n"),
    "css/main.css": [
      '@font-face { src: url("fonts/test.ttf"); }',
      'body { background: url("../assets/xp/bliss.jpg"); }',
    ].join("\n"),
    "css/fonts/test.ttf": "font",
    "assets/icons/game.png": "icon",
    "assets/icons/SOURCES.json": "{}",
    "assets/xp/bliss.jpg": "wallpaper",
    "assets/xp/sounds/startup.mp3": "sound",
    "favicon.ico": "favicon",
    "vendor/fflate/0.8.3/index.js": "fflate",
    "swf/bike-mania/main.swf": "swf",
    "iframe/doom/index.html": "doom",
    "iframe/inside-the-firewall/index.html": "firewall",
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

describe("Ruffle release handling", () => {
  test("accepts complete pinned metadata", async () => {
    const root = await makeTemporaryDirectory();
    const metadata = join(root, "ruffle.json");
    await writeFile(
      metadata,
      JSON.stringify({
        tag: "v0.4.1",
        asset: "ruffle-0.4.1-web-selfhosted.zip",
        sha256: "a".repeat(64),
      }),
    );
    expect((await loadRuffleRelease(metadata)).tag).toBe("v0.4.1");
  });

  test("rejects invalid metadata", async () => {
    const root = await makeTemporaryDirectory();
    const metadata = join(root, "ruffle.json");
    await writeFile(metadata, '{"tag":"nightly"}');
    expect(loadRuffleRelease(metadata)).rejects.toThrow(
      "tag, asset, and sha256",
    );
  });

  test("verifies checksum and extracts only root runtime files", async () => {
    const root = await makeTemporaryDirectory();
    const archive = makeRuffleArchive();
    const release = {
      tag: "v0.4.1",
      asset: "ruffle-0.4.1-web-selfhosted.zip",
      sha256: createHash("sha256").update(archive).digest("hex"),
    };
    const fetcher = async () => archiveResponse(archive);
    await downloadRuffle(join(root, "js"), release, fetcher);

    expect(await Bun.file(join(root, "js", "ruffle.js")).exists()).toBeTrue();
    expect(await Bun.file(join(root, "js", "abc123.wasm")).exists()).toBeTrue();
    expect(await Bun.file(join(root, "js", "ignored.js")).exists()).toBeFalse();
  });

  test("rejects checksum mismatches and incomplete runtimes", async () => {
    const root = await makeTemporaryDirectory();
    const completeArchive = makeRuffleArchive();
    const incompleteArchive = makeRuffleArchive({ includeWasm: false });
    const baseRelease = {
      tag: "v0.4.1",
      asset: "ruffle-0.4.1-web-selfhosted.zip",
    };
    await expect(
      downloadRuffle(
        join(root, "mismatch"),
        { ...baseRelease, sha256: "0".repeat(64) },
        async () => archiveResponse(completeArchive),
      ),
    ).rejects.toThrow("checksum mismatch");
    await expect(
      downloadRuffle(
        join(root, "incomplete"),
        {
          ...baseRelease,
          sha256: createHash("sha256").update(incompleteArchive).digest("hex"),
        },
        async () => archiveResponse(incompleteArchive),
      ),
    ).rejects.toThrow("missing required runtime");
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
    await addGeneratedRuntime(root);
    const paths = new BuildPaths(root);

    const hashedAssets = await updateHtml(paths, "26.07.28-abcdef1");
    await writeOfflineGameManifest(paths, "26.07.28-abcdef1");
    await writeVersionMetadata(paths, "26.07.28-abcdef1");

    const main = await readFile(join(root, hashedAssets.mainJs), "utf8");
    const html = await readFile(paths.html, "utf8");
    expect(main).toContain('const APP_VERSION = "26.07.28-abcdef1";');
    expect(html).toContain(`${hashedAssets.mainJs}"`);
    expect(html).toContain(`${hashedAssets.gameInstallerJs}"`);
    expect(html).toContain(`${hashedAssets.gameLibraryJs}"`);
    expect(html).toContain(`${hashedAssets.fileOperationsJs}"`);
    expect(html).toContain(`${hashedAssets.mainCss}"`);
    expect(await readFile(paths.captureHtml, "utf8")).toContain(
      `${hashedAssets.ruffle}"`,
    );
    expect(html).toMatch(/favicon\.[a-f0-9]{8}\.ico"/);
    expect(html).toMatch(/assets\/xp\/bliss\.[a-f0-9]{8}\.jpg"/);
    expect(await readFile(join(root, hashedAssets.gamesJs), "utf8")).toMatch(
      /assets\/icons\/game\.[a-f0-9]{8}\.png/,
    );
    expect(await readFile(join(root, hashedAssets.mainJs), "utf8")).toMatch(
      /assets\/xp\/sounds\/startup\.[a-f0-9]{8}\.mp3/,
    );
    expect(await readFile(join(root, hashedAssets.mainCss), "utf8")).toMatch(
      /fonts\/test\.[a-f0-9]{8}\.ttf/,
    );
    expect(await readFile(join(root, hashedAssets.mainCss), "utf8")).toMatch(
      /\.\.\/assets\/xp\/bliss\.[a-f0-9]{8}\.jpg/,
    );
    expect(await Bun.file(join(root, "js", "main.js")).exists()).toBeFalse();
    expect(await Bun.file(join(root, "css", "main.css")).exists()).toBeFalse();
    expect(PRECACHE_FILE_SUFFIXES.has(".ttf")).toBeTrue();

    const metadata = JSON.parse(await readFile(paths.versionJson, "utf8"));
    const manifest = JSON.parse(await readFile(paths.offlineGamesJson, "utf8"));
    expect(metadata.offlineBytes).toBeGreaterThan(0);
    expect(metadata.bundledGameBytes).toBeGreaterThan(0);
    expect(manifest.version).toBe("26.07.28-abcdef1");
    expect(manifest.games["bike-mania"].type).toBe("swf");
    expect(manifest.games.doom.type).toBe("iframe");
    expect(
      manifest.games.doom.files.map(({ url }: { url: string }) => url),
    ).toEqual(["dos/doom/doom.jsdos", "iframe/doom/index.html"]);
    expect(manifest.runtime.files.length).toBeGreaterThan(0);
    expect(metadata.bundledGameBytes).toBe(
      manifest.runtime.bytes +
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
    await expect(validateOutput(root)).rejects.toThrow(
      "invalid content hash for js/main.js",
    );
  });
});

describe("Workbox and artifact validation", () => {
  test("accepts a generated worker with its runtime", async () => {
    const root = await makeTemporaryDirectory();
    await writeFiles(root, {
      "js/offline-worker.12345678.js": "offline worker",
    });
    const generator = async () => {
      await addGeneratedRuntime(root);
      return { count: 1, size: 1, warnings: [], filePaths: [] };
    };
    await generateServiceWorker(root, generator as any, "26.07.28-abcdef1");
    expect(
      await Bun.file(join(root, "workbox-f9030226.js")).exists(),
    ).toBeTrue();
    expect(await readFile(join(root, "sw.js"), "utf8")).toContain(
      'self.__ASTRO_FLASH_VERSION__="26.07.28-abcdef1"',
    );
  });

  test("rejects a generated worker with a missing runtime", async () => {
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
    expect(generateServiceWorker(root, generator as any)).rejects.toThrow(
      "missing Workbox runtime",
    );
  });

  test("accepts a complete artifact and rejects a missing representative game", async () => {
    const root = await makeTemporaryDirectory();
    await makeSource(root);
    await addGeneratedRuntime(root);
    const paths = new BuildPaths(root);
    await updateHtml(paths, "26.07.28-abcdef1");
    await writeOfflineGameManifest(paths, "26.07.28-abcdef1");
    await writeVersionMetadata(paths, "26.07.28-abcdef1");
    await validateOutput(root);

    await unlink(join(root, "swf", "bike-mania", "main.swf"));
    expect(validateOutput(root)).rejects.toThrow("missing required files");
  });
});

describe("atomic build", () => {
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
      download: async (jsDir) => addGeneratedRuntime(join(jsDir, "..")),
      generate: addGeneratedRuntime,
    });

    const currentFiles = await fileSnapshot(source);
    expect([...currentFiles.keys()]).toEqual([...originalFiles.keys()]);
    for (const [path, bytes] of originalFiles) {
      expect(currentFiles.get(path)).toEqual(bytes);
    }
    expect(await Bun.file(join(output, "stale.txt")).exists()).toBeFalse();
    expect(await Bun.file(join(output, "sw.js")).exists()).toBeTrue();
    const metadata = JSON.parse(
      await readFile(join(output, "version.json"), "utf8"),
    );
    expect(metadata.offlineBytes).toBeGreaterThan(0);
    expect(metadata.bundledGameBytes).toBeGreaterThan(0);
    expect(metadata.revision).toBe("abcdef1");
    expect(metadata.version).toBe("26.07.28-abcdef1");
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
        download: async () => {
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
