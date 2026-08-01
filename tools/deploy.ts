import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";

import { unzipSync } from "fflate";
import { generateSW } from "workbox-build";
import workboxConfig from "../workbox-config";

const PROJECT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE_DIR = join(PROJECT_DIR, "site");
export const DEFAULT_OUTPUT_DIR = join(PROJECT_DIR, "dist");
export const RUFFLE_RELEASE_PATH = join(
  PROJECT_DIR,
  "tools",
  "ruffle-release.json",
);
const RUFFLE_DOWNLOAD_ROOT =
  "https://github.com/ruffle-rs/ruffle/releases/download";
const RUFFLE_FILE_SUFFIXES = [".js", ".js.map", ".wasm"];
export const FFLATE_VERSION = "0.8.3";
const FFLATE_SOURCE = join(PROJECT_DIR, "node_modules", "fflate");
export const PRECACHE_FILE_SUFFIXES = new Set([
  ".ttf",
  ".woff",
  ".woff2",
  ".css",
  ".ico",
  ".svg",
  ".bmp",
  ".mp3",
  ".wav",
  ".png",
  ".jpg",
  ".jpeg",
  ".cur",
  ".json",
  ".html",
  ".js",
  ".mjs",
  ".wasm",
  ".swf",
  ".jsdos",
  ".xml",
  ".phtml",
]);
const APP_VERSION_PATTERN = /const APP_VERSION = "[^"]+";/g;

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;
type WorkboxGenerator = typeof generateSW;

export interface RuffleRelease {
  tag: string;
  asset: string;
  sha256: string;
}

interface OfflineFile {
  bytes: number;
  url: string;
}

interface OfflineGame {
  bytes: number;
  files: OfflineFile[];
  revision: string;
  root: string;
  runtime?: string;
  type: "iframe" | "swf";
}

interface OfflineRuntime {
  bytes: number;
  files: OfflineFile[];
  revision: string;
}

interface OfflineManifest {
  games: Record<string, OfflineGame>;
  runtime: OfflineRuntime;
  runtimes?: Record<string, OfflineRuntime>;
  version: string;
}

type VersionedGamePackages = Record<string, OfflineGame>;

export class BuildPaths {
  readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  get js() {
    return join(this.root, "js");
  }

  get css() {
    return join(this.root, "css");
  }

  get html() {
    return join(this.root, "index.html");
  }

  get captureHtml() {
    return join(this.root, "capture.html");
  }

  get mainJs() {
    return join(this.js, "main.js");
  }

  get versionJson() {
    return join(this.root, "version.json");
  }

  get offlineGamesJson() {
    return join(this.root, "offline-games.json");
  }

  get fflateJs() {
    return join(this.root, "vendor", "fflate", FFLATE_VERSION, "index.js");
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function walkFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

async function replaceExactlyOnce(
  content: string,
  pattern: RegExp,
  replacement: string,
  error: string,
): Promise<string> {
  const matches = content.match(pattern);
  if (matches?.length !== 1) {
    throw new Error(error);
  }
  return content.replace(pattern, replacement);
}

export async function installFflate(
  outputDir: string,
  sourceDir = FFLATE_SOURCE,
): Promise<void> {
  const sourceJavaScript = join(sourceDir, "umd", "index.js");
  const sourceLicense = join(sourceDir, "LICENSE");
  if (!(await isFile(sourceJavaScript)) || !(await isFile(sourceLicense))) {
    throw new Error(
      "fflate is not installed; run `bun install --frozen-lockfile`",
    );
  }
  const destination = join(outputDir, "vendor", "fflate", FFLATE_VERSION);
  await mkdir(destination, { recursive: true });
  await cp(sourceJavaScript, join(destination, "index.js"), {
    preserveTimestamps: true,
  });
  await cp(sourceLicense, join(destination, "LICENSE"), {
    preserveTimestamps: true,
  });
}

export async function loadRuffleRelease(
  path = RUFFLE_RELEASE_PATH,
): Promise<RuffleRelease> {
  const release = JSON.parse(
    await readFile(path, "utf8"),
  ) as Partial<RuffleRelease>;
  const keys = Object.keys(release).sort();
  if (keys.join(",") !== "asset,sha256,tag") {
    throw new Error(
      "Ruffle release metadata must contain tag, asset, and sha256",
    );
  }
  if (!/^v\d+\.\d+\.\d+$/.test(release.tag ?? "")) {
    throw new Error("Ruffle release tag is invalid");
  }
  if (!release.asset?.endsWith("-web-selfhosted.zip")) {
    throw new Error("Ruffle release asset is not the self-hosted web package");
  }
  if (!/^[a-f0-9]{64}$/.test(release.sha256 ?? "")) {
    throw new Error("Ruffle release checksum is invalid");
  }
  return release as RuffleRelease;
}

export function ruffleDownloadUrl(release: RuffleRelease): string {
  return `${RUFFLE_DOWNLOAD_ROOT}/${release.tag}/${release.asset}`;
}

export async function downloadRuffle(
  jsDir: string,
  release?: RuffleRelease,
  fetcher: Fetcher = fetch,
): Promise<void> {
  const selectedRelease = release ?? (await loadRuffleRelease());
  await mkdir(jsDir, { recursive: true });
  console.log(`Downloading Ruffle ${selectedRelease.tag}...`);

  const response = await fetcher(ruffleDownloadUrl(selectedRelease), {
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    throw new Error(`Could not download Ruffle: HTTP ${response.status}`);
  }
  const archiveBytes = new Uint8Array(await response.arrayBuffer());
  const actualChecksum = createHash("sha256")
    .update(archiveBytes)
    .digest("hex");
  if (actualChecksum !== selectedRelease.sha256) {
    throw new Error(
      `Ruffle archive checksum mismatch: expected ${selectedRelease.sha256}, got ${actualChecksum}`,
    );
  }

  const archive = unzipSync(archiveBytes);
  const files = Object.entries(archive).filter(([name]) => {
    const normalized = name.replaceAll("\\", "/");
    return (
      !normalized.endsWith("/") &&
      !normalized.includes("/") &&
      RUFFLE_FILE_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
    );
  });
  const names = files.map(([name]) => name);
  if (
    !names.includes("ruffle.js") ||
    !names.some(
      (name) => name.startsWith("core.ruffle.") && name.endsWith(".js"),
    ) ||
    !names.some((name) => name.endsWith(".wasm"))
  ) {
    throw new Error(
      "Downloaded Ruffle package is missing required runtime files",
    );
  }

  await Promise.all(
    files.map(([name, content]) => writeFile(join(jsDir, name), content)),
  );
  console.log(`  - Installed ${files.length} Ruffle runtime files`);
}

export async function getShortHash(filePath: string): Promise<string> {
  return createHash("sha384")
    .update(await readFile(filePath))
    .digest("hex")
    .slice(0, 8);
}

export function runGit(arguments_: string[], projectDir = PROJECT_DIR): string {
  const result = Bun.spawnSync(["git", ...arguments_], {
    cwd: projectDir,
    stderr: "pipe",
    stdout: "pipe",
  });
  if (!result.success) {
    throw new Error(
      `Could not resolve deployment revision with git ${arguments_.join(" ")}`,
    );
  }
  return result.stdout.toString().trim();
}

export function getDeploymentVersion(
  revision = "HEAD",
  projectDir = PROJECT_DIR,
  git: typeof runGit = runGit,
): string {
  const commitDate = git(["show", "-s", "--format=%cs", revision], projectDir);
  const shortRevision = git(["rev-parse", "--short=7", revision], projectDir);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(commitDate)) {
    throw new Error(`Git returned an invalid commit date: ${commitDate}`);
  }
  if (!/^[a-f0-9]{7,}$/.test(shortRevision)) {
    throw new Error(`Git returned an invalid revision: ${shortRevision}`);
  }
  const [year, month, day] = commitDate.split("-");
  return `${year.slice(2)}.${month}.${day}-${shortRevision.slice(0, 7)}`;
}

export async function updateHtml(
  paths: BuildPaths,
  version: string,
): Promise<Record<string, string>> {
  console.log("Updating output with versioned asset filenames...");
  let mainJavaScript = await readFile(paths.mainJs, "utf8");
  mainJavaScript = await replaceExactlyOnce(
    mainJavaScript,
    APP_VERSION_PATTERN,
    `const APP_VERSION = "${version}";`,
    "Could not update APP_VERSION in output js/main.js",
  );
  await writeFile(paths.mainJs, mainJavaScript);

  const staticPaths = [
    ...(await walkFiles(join(paths.root, "assets"))),
    ...(await walkFiles(join(paths.css, "fonts"))),
    join(paths.root, "favicon.ico"),
  ];
  const staticAssets = new Map<string, string>();
  await Promise.all(
    staticPaths.map(async (sourcePath) => {
      const relativePath = relative(paths.root, sourcePath)
        .split(sep)
        .join("/");
      const extension = extname(relativePath);
      const hash = await getShortHash(sourcePath);
      const hashedRelativePath = `${relativePath.slice(
        0,
        -extension.length,
      )}.${hash}${extension}`;
      await rename(sourcePath, join(paths.root, hashedRelativePath));
      staticAssets.set(relativePath, hashedRelativePath);
    }),
  );

  const mutableAssets = {
    ruffle: "js/ruffle.js",
    gamesJs: "js/games.js",
    flashUrlRouterJs: "js/flash-url-router.js",
    storagePolicyJs: "js/storage-policy.js",
    gameInstallerJs: "js/game-installer.js",
    gameLibraryJs: "js/game-library.js",
    gameDataJs: "js/game-data.js",
    filesystemJs: "js/filesystem.js",
    fileOperationsJs: "js/file-operations.js",
    dialogsJs: "js/dialogs.js",
    offlineJs: "js/offline.js",
    offlineWorkerJs: "js/offline-worker.js",
    mainJs: "js/main.js",
    mainCss: "css/main.css",
  };
  const referenceFiles = [
    ...Object.values(mutableAssets).filter(
      (path) => path !== "js/ruffle.js" && path !== "js/offline-worker.js",
    ),
    "index.html",
    ...((await isFile(paths.captureHtml)) ? ["capture.html"] : []),
  ];
  for (const referencePath of referenceFiles) {
    const absolutePath = join(paths.root, referencePath);
    let content = await readFile(absolutePath, "utf8");
    for (const [originalPath, hashedPath] of staticAssets) {
      content = content.replaceAll(originalPath, hashedPath);
      if (referencePath.startsWith("css/")) {
        const originalCssPath = relative("css", originalPath)
          .split(sep)
          .join("/");
        const hashedCssPath = relative("css", hashedPath).split(sep).join("/");
        content = content.replaceAll(originalCssPath, hashedCssPath);
      }
    }
    await writeFile(absolutePath, content);
  }

  const hashedAssets = Object.fromEntries(
    await Promise.all(
      Object.entries(mutableAssets).map(async ([name, relativePath]) => {
        const sourcePath = join(paths.root, relativePath);
        const hash = await getShortHash(sourcePath);
        const extension = extname(relativePath);
        const hashedRelativePath = `${relativePath.slice(
          0,
          -extension.length,
        )}.${hash}${extension}`;
        await rename(sourcePath, join(paths.root, hashedRelativePath));
        return [name, hashedRelativePath];
      }),
    ),
  ) as Record<string, string>;
  const fflateHash = await getShortHash(paths.fflateJs);

  let content = await readFile(paths.html, "utf8");
  for (const [name, originalPath] of Object.entries(mutableAssets)) {
    if (name === "offlineWorkerJs") continue;
    const pattern = new RegExp(
      originalPath.replaceAll(".", "\\.") + '(?:\\?v=[^"]+)?"',
      "g",
    );
    content = await replaceExactlyOnce(
      content,
      pattern,
      `${hashedAssets[name]}"`,
      `Could not update asset reference matching ${pattern.source}`,
    );
  }
  const fflatePattern = /vendor\/fflate\/0\.8\.3\/index\.js(?:\?v=[^"]+)?"?/g;
  content = await replaceExactlyOnce(
    content,
    fflatePattern,
    `vendor/fflate/0.8.3/index.js?v=${fflateHash}"`,
    "Could not update fflate asset reference",
  );
  await writeFile(paths.html, content);

  for (const relativePath of [
    "iframe/pink-panther-hokus-pokus/index.html",
    "iframe/pink-panther-passport-to-peril/index.html",
    "iframe/revcdos/index.html",
  ]) {
    const absolutePath = join(paths.root, relativePath);
    if (!(await isFile(absolutePath))) continue;
    let iframe = await readFile(absolutePath, "utf8");
    iframe = await replaceExactlyOnce(
      iframe,
      /\.\.\/\.\.\/js\/storage-policy\.js(?:\?v=[^"]+)?"?/g,
      `../../${hashedAssets.storagePolicyJs}"`,
      `Could not update storage policy reference in ${relativePath}`,
    );
    await writeFile(absolutePath, iframe);
  }

  if (await isFile(paths.captureHtml)) {
    let capture = await readFile(paths.captureHtml, "utf8");
    for (const [name, originalPath] of [
      ["ruffle", "js/ruffle.js"],
      ["gamesJs", "js/games.js"],
      ["flashUrlRouterJs", "js/flash-url-router.js"],
    ] as const) {
      const pattern = new RegExp(
        originalPath.replaceAll(".", "\\.") + '(?:\\?v[^"]+)?"',
        "g",
      );
      capture = await replaceExactlyOnce(
        capture,
        pattern,
        `${hashedAssets[name]}"`,
        `Could not update capture reference for ${originalPath}`,
      );
    }
    await writeFile(paths.captureHtml, capture);
  }
  console.log(`  - Set deployment version to ${version}`);
  return hashedAssets;
}

export function isOptionalOfflinePath(relativePath: string): boolean {
  const path = relativePath.split(sep).join("/");
  return (
    path.startsWith("swf/") ||
    path.startsWith("iframe/") ||
    path.startsWith("dos/") ||
    path.startsWith("vendor/scummvm/") ||
    (path.startsWith("js/") &&
      (path.endsWith(".wasm") ||
        Boolean(path.split("/").at(-1)?.startsWith("core.ruffle."))))
  );
}

async function offlineFileEntry(
  root: string,
  path: string,
  revision?: string,
): Promise<OfflineFile> {
  const relativePath = relative(root, path).split(sep).join("/");
  return {
    bytes: (await stat(path)).size,
    url: revision ? `${relativePath}?rev=${revision}` : relativePath,
  };
}

async function offlineRevision(root: string, files: string[]): Promise<string> {
  const digest = createHash("sha256");
  for (const path of files.toSorted()) {
    digest.update(relative(root, path).split(sep).join("/"));
    digest.update(await readFile(path));
  }
  return digest.digest("hex").slice(0, 16);
}

async function prepareDoomPackage(paths: BuildPaths): Promise<void> {
  const iframeRoot = join(paths.root, "iframe", "doom");
  const dosRoot = join(paths.root, "dos", "doom");
  if (!(await isDirectory(iframeRoot)) || !(await isDirectory(dosRoot))) return;

  const bundledDosRoot = join(iframeRoot, "dos", "doom");
  await mkdir(dirname(bundledDosRoot), { recursive: true });
  await cp(dosRoot, bundledDosRoot, { recursive: true });
  const indexPath = join(iframeRoot, "index.html");
  const index = await replaceExactlyOnce(
    await readFile(indexPath, "utf8"),
    /\.\.\/\.\.\/dos\/doom\/doom\.jsdos/g,
    "dos/doom/doom.jsdos",
    "Could not package the Doom game data",
  );
  await writeFile(indexPath, index);
  await rm(dosRoot, { recursive: true });
}

export async function versionGamePackages(
  paths: BuildPaths,
): Promise<VersionedGamePackages> {
  await prepareDoomPackage(paths);
  const gameIds = new Set<string>();
  for (const parent of [join(paths.root, "swf"), join(paths.root, "iframe")]) {
    if (!(await isDirectory(parent))) continue;
    for (const entry of await readdir(parent, { withFileTypes: true })) {
      if (entry.isDirectory()) gameIds.add(entry.name);
    }
  }
  gameIds.delete("scummvm");

  const gameRuntimes: Record<string, string> = {
    "pink-panther-hokus-pokus": "scummvm",
    "pink-panther-passport-to-peril": "scummvm",
  };
  const packages: VersionedGamePackages = {};
  for (const gameId of [...gameIds].sort()) {
    const type = (await isDirectory(join(paths.root, "swf", gameId)))
      ? "swf"
      : "iframe";
    const sourceRoot = join(paths.root, type, gameId);
    const files = (await walkFiles(sourceRoot)).sort();
    const revision = await offlineRevision(paths.root, files);
    const versionedName = `${gameId}.${revision}`;
    const versionedRoot = join(paths.root, type, versionedName);
    await rename(sourceRoot, versionedRoot);
    const versionedFiles = (await walkFiles(versionedRoot)).sort();
    packages[gameId] = {
      bytes: (
        await Promise.all(
          versionedFiles.map(async (path) => (await stat(path)).size),
        )
      ).reduce((total, bytes) => total + bytes, 0),
      files: await Promise.all(
        versionedFiles.map((path) => offlineFileEntry(paths.root, path)),
      ),
      revision,
      root: `${type}/${versionedName}/`,
      ...(gameRuntimes[gameId]
        ? { runtime: gameRuntimes[gameId] }
        : {}),
      type,
    };
  }
  return packages;
}

async function injectGameRoots(
  paths: BuildPaths,
  games: VersionedGamePackages,
): Promise<void> {
  const roots = Object.fromEntries(
    Object.entries(games).map(([id, game]) => [id, game.root]),
  );
  const mapping = `<script>window.ASTRO_GAME_ROOTS=Object.freeze(${JSON.stringify(roots)});</script>`;
  for (const path of [paths.html, paths.captureHtml]) {
    if (!(await isFile(path))) continue;
    const content = await readFile(path, "utf8");
    const updated = await replaceExactlyOnce(
      content,
      /<script src="js\/games\.[a-f0-9]{8}\.js"><\/script>/g,
      `${mapping}\n    $&`,
      `Could not inject versioned game roots into ${relative(paths.root, path)}`,
    );
    await writeFile(path, updated);
  }
}

export async function writeOfflineGameManifest(
  paths: BuildPaths,
  version: string,
): Promise<void> {
  const runtimeFiles = (await readdir(paths.js, { withFileTypes: true }))
    .filter(
      (entry) =>
        entry.isFile() &&
        (entry.name.endsWith(".wasm") ||
          (entry.name.startsWith("core.ruffle.") &&
            entry.name.endsWith(".js"))),
    )
    .map((entry) => join(paths.js, entry.name))
    .toSorted();

  const sharedRuntimes = {
    scummvm: [
      join(paths.root, "iframe", "scummvm"),
      join(paths.root, "vendor", "scummvm", "2026.3.0"),
    ],
  };
  const games = await versionGamePackages(paths);
  await injectGameRoots(paths, games);

  const runtimes = Object.fromEntries(
    await Promise.all(
      (
        await Promise.all(
          Object.entries(sharedRuntimes).map(async ([id, roots]) => ({
            id,
            roots,
            available: (await Promise.all(roots.map(isDirectory))).every(
              Boolean,
            ),
          })),
        )
      )
        .filter(({ available }) => available)
        .map(async ({ id, roots }) => {
          const files = (await Promise.all(roots.map(walkFiles))).flat().sort();
          const revision = await offlineRevision(paths.root, files);
          return [
            id,
            {
              bytes: (
                await Promise.all(
                  files.map(async (path) => (await stat(path)).size),
                )
              ).reduce((total, bytes) => total + bytes, 0),
              files: await Promise.all(
                files.map((path) =>
                  offlineFileEntry(paths.root, path, revision),
                ),
              ),
              revision,
            },
          ];
        }),
    ),
  );
  const runtimeRevision = await offlineRevision(paths.root, runtimeFiles);
  const manifest: OfflineManifest = {
    games,
    runtime: {
      bytes: (
        await Promise.all(
          runtimeFiles.map(async (path) => (await stat(path)).size),
        )
      ).reduce((total, bytes) => total + bytes, 0),
      files: await Promise.all(
        runtimeFiles.map((path) =>
          offlineFileEntry(paths.root, path, runtimeRevision),
        ),
      ),
      revision: runtimeRevision,
    },
    runtimes,
    version,
  };
  await writeFile(paths.offlineGamesJson, `${JSON.stringify(manifest)}\n`);
}

export async function writeVersionMetadata(
  paths: BuildPaths,
  version: string,
): Promise<void> {
  const files = await walkFiles(paths.root);
  let offlineBytes = 0;
  for (const path of files) {
    const relativePath = relative(paths.root, path);
    if (
      path !== paths.versionJson &&
      PRECACHE_FILE_SUFFIXES.has(extname(path).toLowerCase()) &&
      !isOptionalOfflinePath(relativePath)
    ) {
      offlineBytes += (await stat(path)).size;
    }
  }
  const offlineManifest = JSON.parse(
    await readFile(paths.offlineGamesJson, "utf8"),
  ) as OfflineManifest;
  const bundledGameBytes =
    offlineManifest.runtime.bytes +
    Object.values(offlineManifest.runtimes ?? {}).reduce(
      (total, runtime) => total + runtime.bytes,
      0,
    ) +
    Object.values(offlineManifest.games).reduce(
      (total, game) => total + game.bytes,
      0,
    );
  const revision = version.split("-").at(-1);
  await writeFile(
    paths.versionJson,
    `${JSON.stringify({
      bundledGameBytes,
      offlineBytes,
      revision,
      version,
    })}\n`,
  );
}

async function getWorkboxFiles(outputDir: string): Promise<string[]> {
  return (await readdir(outputDir))
    .filter(
      (name) =>
        name === "sw.js" ||
        name === "sw.js.map" ||
        /^workbox-.*\.js(?:\.map)?$/.test(name),
    )
    .map((name) => join(outputDir, name));
}

export async function generateServiceWorker(
  outputDir: string,
  generator: WorkboxGenerator = generateSW,
  version?: string,
): Promise<void> {
  console.log("Generating service worker...");
  const offlineWorkerNames = (await readdir(join(outputDir, "js"))).filter(
    (name) => /^offline-worker\.[a-f0-9]{8}\.js$/.test(name),
  );
  if (offlineWorkerNames.length !== 1) {
    throw new Error(
      "Build output must contain exactly one hashed offline worker",
    );
  }
  await generator({
    ...workboxConfig,
    globDirectory: `${resolve(outputDir)}/`,
    importScripts: [`js/${offlineWorkerNames[0]}`],
    swDest: join(resolve(outputDir), "sw.js"),
  });

  const serviceWorker = join(outputDir, "sw.js");
  if (!(await isFile(serviceWorker))) {
    throw new Error("Workbox did not generate output sw.js");
  }
  let workerSource = await readFile(serviceWorker, "utf8");
  if (version) {
    workerSource += `\nself.__ASTRO_FLASH_VERSION__=${JSON.stringify(
      version,
    )};self.addEventListener("message",event=>{if(event.data?.type==="GET_VERSION")event.ports[0]?.postMessage({version:self.__ASTRO_FLASH_VERSION__})});\n`;
    await writeFile(serviceWorker, workerSource);
  }
  const referencedRuntimeNames = new Set(
    [...workerSource.matchAll(/workbox-[a-f0-9]+(?:\.js)?/g)].map((match) =>
      match[0].endsWith(".js") ? match[0] : `${match[0]}.js`,
    ),
  );
  if (referencedRuntimeNames.size === 0) {
    throw new Error("Generated service worker references no Workbox runtime");
  }
  if (
    !(
      await Promise.all(
        [...referencedRuntimeNames].map((name) =>
          isFile(join(outputDir, name)),
        ),
      )
    ).every(Boolean)
  ) {
    throw new Error(
      "Generated service worker references a missing Workbox runtime",
    );
  }
  for (const path of await getWorkboxFiles(outputDir)) {
    const name = path.split(sep).at(-1) ?? "";
    if (name.startsWith("workbox-") && !referencedRuntimeNames.has(name)) {
      await rm(path);
    }
  }
  console.log("  - Service worker generated successfully");
}

export async function validateOutput(outputDir: string): Promise<void> {
  const paths = new BuildPaths(outputDir);
  const required = [
    paths.html,
    paths.offlineGamesJson,
    paths.versionJson,
    join(outputDir, "sw.js"),
    paths.fflateJs,
  ];
  const missing = (
    await Promise.all(
      required.map(async (path) =>
        (await isFile(path)) ? undefined : relative(outputDir, path),
      ),
    )
  ).filter(Boolean);
  if (missing.length > 0) {
    throw new Error(
      `Build output is missing required files: ${missing.join(", ")}`,
    );
  }

  const html = await readFile(paths.html, "utf8");
  for (const asset of [
    "js/ruffle.js",
    "js/games.js",
    "js/flash-url-router.js",
    "js/storage-policy.js",
    "js/game-installer.js",
    "js/game-library.js",
    "js/game-data.js",
    "js/filesystem.js",
    "js/file-operations.js",
    "js/dialogs.js",
    "js/offline.js",
    "js/main.js",
    "css/main.css",
  ]) {
    const [directory, filename] = asset.split("/");
    const extension = extname(filename);
    const stem = filename.slice(0, -extension.length);
    const pattern = new RegExp(
      `${directory}/${stem.replaceAll(".", "\\.")}\\.([a-f0-9]{8})\\${extension}"`,
    );
    const match = html.match(pattern);
    if (!match) {
      throw new Error(`Build output has no hashed reference for ${asset}`);
    }
    const hashedPath = join(outputDir, match[0].slice(0, -1));
    if (
      !(await isFile(hashedPath)) ||
      (await getShortHash(hashedPath)) !== match[1]
    ) {
      throw new Error(`Build output has an invalid content hash for ${asset}`);
    }
  }
  if (!/vendor\/fflate\/0\.8\.3\/index\.js\?v=[a-f0-9]{8}"/.test(html)) {
    throw new Error("Build output has no versioned fflate reference");
  }
  const staticFiles = [
    ...(await walkFiles(join(outputDir, "assets"))),
    ...(await walkFiles(join(outputDir, "css", "fonts"))),
  ];
  const favicons = (await readdir(outputDir))
    .filter((name) => /^favicon\.[a-f0-9]{8}\.ico$/.test(name))
    .map((name) => join(outputDir, name));
  if (favicons.length !== 1) {
    throw new Error("Build output has no uniquely hashed favicon");
  }
  for (const path of [...staticFiles, ...favicons]) {
    const filename = path.split(sep).at(-1) ?? "";
    const match = filename.match(/\.([a-f0-9]{8})\.[^./]+$/);
    if (!match || (await getShortHash(path)) !== match[1]) {
      throw new Error(
        `Build output has an invalid static asset hash for ${relative(
          outputDir,
          path,
        )}`,
      );
    }
  }
  const referenceDocuments = [
    { content: html, path: paths.html },
    ...((await isFile(paths.captureHtml))
      ? [
          {
            content: await readFile(paths.captureHtml, "utf8"),
            path: paths.captureHtml,
          },
        ]
      : []),
  ];
  for (const match of html.matchAll(
    /(?:src|href)="((?:js|css)\/[^"]+\.(?:js|css))"/g,
  )) {
    referenceDocuments.push({
      content: await readFile(join(outputDir, match[1]), "utf8"),
      path: join(outputDir, match[1]),
    });
  }
  for (const document of referenceDocuments) {
    for (const match of document.content.matchAll(
      /(?:\.\.\/)?assets\/[^"'`()\s]+|fonts\/[^"'`()\s]+|favicon[^"'`()\s]+/g,
    )) {
      const reference = match[0];
      if (!/\.[a-f0-9]{8}\.[^./]+$/.test(reference)) {
        throw new Error(
          `Build output has an unhashed static reference in ${relative(
            outputDir,
            document.path,
          )}: ${reference}`,
        );
      }
      const target = reference.startsWith("../")
        ? join(outputDir, reference.slice(3))
        : reference.startsWith("fonts/")
          ? join(outputDir, "css", reference)
          : join(outputDir, reference);
      if (!(await isFile(target))) {
        throw new Error(
          `Build output references a missing static asset: ${reference}`,
        );
      }
    }
  }
  if (
    (await readdir(paths.js)).filter((name) =>
      /^offline-worker\.[a-f0-9]{8}\.js$/.test(name),
    ).length !== 1
  ) {
    throw new Error("Build output has no uniquely hashed offline worker");
  }
  const jsEntries = await readdir(paths.js);
  if (!jsEntries.some((name) => /^core\.ruffle\..*\.js$/.test(name))) {
    throw new Error("Build output has no Ruffle core JavaScript");
  }
  if (!jsEntries.some((name) => name.endsWith(".wasm"))) {
    throw new Error("Build output has no Ruffle WebAssembly");
  }

  let versionMetadata: Record<string, unknown>;
  try {
    versionMetadata = JSON.parse(await readFile(paths.versionJson, "utf8"));
  } catch {
    throw new Error("Build output has invalid version metadata");
  }
  if (
    Object.keys(versionMetadata).sort().join(",") !==
    "bundledGameBytes,offlineBytes,revision,version"
  ) {
    throw new Error("Build output has invalid version metadata");
  }
  if (
    !Number.isInteger(versionMetadata.offlineBytes) ||
    (versionMetadata.offlineBytes as number) <= 0 ||
    !Number.isInteger(versionMetadata.bundledGameBytes) ||
    (versionMetadata.bundledGameBytes as number) <= 0
  ) {
    throw new Error("Build output has invalid offline download size");
  }

  let offlineManifest: OfflineManifest;
  try {
    offlineManifest = JSON.parse(
      await readFile(paths.offlineGamesJson, "utf8"),
    ) as OfflineManifest;
  } catch {
    throw new Error("Build output has invalid offline game manifest");
  }
  if (
    offlineManifest.version !== versionMetadata.version ||
    Object.keys(offlineManifest.games ?? {}).length === 0 ||
    !offlineManifest.runtime?.files?.length
  ) {
    throw new Error("Build output has invalid offline game manifest");
  }
  const gameRoots = Object.fromEntries(
    Object.entries(offlineManifest.games).map(([id, game]) => [id, game.root]),
  );
  if (
    !html.includes(
      `window.ASTRO_GAME_ROOTS=Object.freeze(${JSON.stringify(gameRoots)})`,
    )
  ) {
    throw new Error("Build output has no matching versioned game roots");
  }
  for (const [id, game] of Object.entries(offlineManifest.games)) {
    if (
      game.root !== `${game.type}/${id}.${game.revision}/` ||
      !game.files.length ||
      game.files.some((file) => !file.url.startsWith(game.root))
    ) {
      throw new Error(`Build output has an invalid game package for ${id}`);
    }
    for (const file of game.files) {
      if (!(await isFile(join(outputDir, file.url)))) {
        throw new Error(`Build output references a missing game file: ${file.url}`);
      }
    }
  }
  for (const runtime of [
    offlineManifest.runtime,
    ...Object.values(offlineManifest.runtimes ?? {}),
  ]) {
    for (const file of runtime.files) {
      if (
        !file.url.endsWith(`?rev=${runtime.revision}`) ||
        !(await isFile(join(outputDir, file.url.split("?")[0])))
      ) {
        throw new Error(`Build output has an invalid runtime file: ${file.url}`);
      }
    }
  }
  if (
    !(versionMetadata.version as string).endsWith(
      `-${versionMetadata.revision as string}`,
    )
  ) {
    throw new Error("Build output has inconsistent version metadata");
  }
  console.log("Build output validated successfully");
}

export async function replaceOutput(
  stagingDir: string,
  outputDir: string,
): Promise<void> {
  await mkdir(dirname(outputDir), { recursive: true });
  const backupDir = join(dirname(stagingDir), "previous-output");
  if (await isDirectory(outputDir)) {
    await rename(outputDir, backupDir);
  }
  try {
    await rename(stagingDir, outputDir);
  } catch (error) {
    if (await isDirectory(backupDir)) {
      await rename(backupDir, outputDir);
    }
    throw error;
  }
}

export interface BuildOptions {
  outputDir?: string;
  revision?: string;
  sourceDir?: string;
  version?: string;
  download?: (jsDir: string) => Promise<void>;
  generate?: (outputDir: string, version?: string) => Promise<void>;
}

export async function build({
  outputDir = DEFAULT_OUTPUT_DIR,
  revision = "HEAD",
  sourceDir = SOURCE_DIR,
  version,
  download = downloadRuffle,
  generate = (directory, buildVersion) =>
    generateServiceWorker(directory, generateSW, buildVersion),
}: BuildOptions = {}): Promise<void> {
  const resolvedOutput = resolve(outputDir);
  const resolvedSource = resolve(sourceDir);
  if (
    resolvedOutput === resolvedSource ||
    resolvedOutput.startsWith(`${resolvedSource}${sep}`)
  ) {
    throw new Error("Build output must be outside the site source directory");
  }

  const deploymentVersion = version ?? getDeploymentVersion(revision);
  await mkdir(dirname(resolvedOutput), { recursive: true });
  const temporaryDirectory = await mkdtemp(
    join(
      dirname(resolvedOutput),
      `.${resolvedOutput.split(sep).at(-1)}-build-`,
    ),
  );
  try {
    const stagingDir = join(temporaryDirectory, "output");
    await cp(resolvedSource, stagingDir, {
      recursive: true,
      preserveTimestamps: true,
    });
    const paths = new BuildPaths(stagingDir);
    await installFflate(stagingDir);
    await download(paths.js);
    await updateHtml(paths, deploymentVersion);
    await writeOfflineGameManifest(paths, deploymentVersion);
    await writeVersionMetadata(paths, deploymentVersion);
    await generate(stagingDir, deploymentVersion);
    await validateOutput(stagingDir);
    await replaceOutput(stagingDir, resolvedOutput);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
  console.log(`Build completed successfully: ${resolvedOutput}`);
}

function parseArguments(arguments_: string[]): {
  outputDir: string;
  revision: string;
} {
  let outputDir = DEFAULT_OUTPUT_DIR;
  let revision = "HEAD";
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--output" || argument === "--revision") {
      const value = arguments_[index + 1];
      if (!value) throw new Error(`${argument} requires a value`);
      if (argument === "--output")
        outputDir = isAbsolute(value) ? value : resolve(value);
      else revision = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return { outputDir, revision };
}

if (import.meta.main) {
  try {
    await build(parseArguments(Bun.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
