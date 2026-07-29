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
import { createRequire } from "node:module";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { unzipSync } from "fflate";
import { generateSW } from "workbox-build";

const PROJECT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const workboxConfig = require(join(PROJECT_DIR, "workbox-config.js")) as Parameters<
	WorkboxGenerator
>[0];
export const SOURCE_DIR = join(PROJECT_DIR, "site");
export const DEFAULT_OUTPUT_DIR = join(PROJECT_DIR, "dist");
export const RUFFLE_RELEASE_PATH = join(PROJECT_DIR, "tools", "ruffle-release.json");
const RUFFLE_DOWNLOAD_ROOT = "https://github.com/ruffle-rs/ruffle/releases/download";
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

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
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
	type: "iframe" | "swf";
}

interface OfflineManifest {
	games: Record<string, OfflineGame>;
	runtime: {
		bytes: number;
		files: OfflineFile[];
		revision: string;
	};
	version: string;
}

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

	get assetPaths(): Record<string, string> {
		return {
			ruffle: join(this.js, "ruffle.js"),
			fflate: this.fflateJs,
			gamesJs: join(this.js, "games.js"),
			gameInstallerJs: join(this.js, "game-installer.js"),
			gameLibraryJs: join(this.js, "game-library.js"),
			filesystemJs: join(this.js, "filesystem.js"),
			fileOperationsJs: join(this.js, "file-operations.js"),
			dialogsJs: join(this.js, "dialogs.js"),
			offlineJs: join(this.js, "offline.js"),
			mainJs: this.mainJs,
			mainCss: join(this.css, "main.css"),
		};
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
		throw new Error("fflate is not installed; run `bun install --frozen-lockfile`");
	}
	const destination = join(outputDir, "vendor", "fflate", FFLATE_VERSION);
	await mkdir(destination, { recursive: true });
	await cp(sourceJavaScript, join(destination, "index.js"), { preserveTimestamps: true });
	await cp(sourceLicense, join(destination, "LICENSE"), { preserveTimestamps: true });
}

export async function loadRuffleRelease(
	path = RUFFLE_RELEASE_PATH,
): Promise<RuffleRelease> {
	const release = JSON.parse(await readFile(path, "utf8")) as Partial<RuffleRelease>;
	const keys = Object.keys(release).sort();
	if (keys.join(",") !== "asset,sha256,tag") {
		throw new Error("Ruffle release metadata must contain tag, asset, and sha256");
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
	const actualChecksum = createHash("sha256").update(archiveBytes).digest("hex");
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
		!names.some((name) => name.startsWith("core.ruffle.") && name.endsWith(".js")) ||
		!names.some((name) => name.endsWith(".wasm"))
	) {
		throw new Error("Downloaded Ruffle package is missing required runtime files");
	}

	await Promise.all(files.map(([name, content]) => writeFile(join(jsDir, name), content)));
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

export async function updateHtml(paths: BuildPaths, version: string): Promise<void> {
	console.log("Updating output with version and cache-busting hashes...");
	let mainJavaScript = await readFile(paths.mainJs, "utf8");
	mainJavaScript = await replaceExactlyOnce(
		mainJavaScript,
		APP_VERSION_PATTERN,
		`const APP_VERSION = "${version}";`,
		"Could not update APP_VERSION in output js/main.js",
	);
	await writeFile(paths.mainJs, mainJavaScript);

	const shortHashes = Object.fromEntries(
		await Promise.all(
			Object.entries(paths.assetPaths).map(async ([name, path]) => [
				name,
				await getShortHash(path),
			]),
		),
	);
	let content = await readFile(paths.html, "utf8");
	const replacements: [RegExp, string][] = [
		[
			/<script src="js\/ruffle\.[^"]+" ?[^>]*><\/script>/g,
			`<script src="js/ruffle.js?v=${shortHashes.ruffle}"></script>`,
		],
		[
			/<script src="vendor\/fflate\/0\.8\.3\/index\.[^"]+" ?[^>]*><\/script>/g,
			`<script src="vendor/fflate/0.8.3/index.js?v=${shortHashes.fflate}"></script>`,
		],
		[
			/<script src="js\/games\.[^"]+" ?[^>]*><\/script>/g,
			`<script src="js/games.js?v=${shortHashes.gamesJs}"></script>`,
		],
		[
			/<script src="js\/game-installer\.[^"]+" ?[^>]*><\/script>/g,
			`<script src="js/game-installer.js?v=${shortHashes.gameInstallerJs}"></script>`,
		],
		[
			/<script src="js\/game-library\.[^"]+" ?[^>]*><\/script>/g,
			`<script src="js/game-library.js?v=${shortHashes.gameLibraryJs}"></script>`,
		],
		[
			/<script src="js\/filesystem\.[^"]+" ?[^>]*><\/script>/g,
			`<script src="js/filesystem.js?v=${shortHashes.filesystemJs}"></script>`,
		],
		[
			/<script src="js\/file-operations\.[^"]+" ?[^>]*><\/script>/g,
			`<script src="js/file-operations.js?v=${shortHashes.fileOperationsJs}"></script>`,
		],
		[
			/<script src="js\/dialogs\.[^"]+" ?[^>]*><\/script>/g,
			`<script src="js/dialogs.js?v=${shortHashes.dialogsJs}"></script>`,
		],
		[
			/<script src="js\/offline\.[^"]+" ?[^>]*><\/script>/g,
			`<script src="js/offline.js?v=${shortHashes.offlineJs}"></script>`,
		],
		[
			/<script src="js\/main\.[^"]+" ?[^>]*><\/script>/g,
			`<script src="js/main.js?v=${shortHashes.mainJs}"></script>`,
		],
		[
			/<link rel="stylesheet" href="css\/main\.[^"]+" ?[^>]*>/g,
			`<link rel="stylesheet" href="css/main.css?v=${shortHashes.mainCss}">`,
		],
	];
	for (const [pattern, replacement] of replacements) {
		content = await replaceExactlyOnce(
			content,
			pattern,
			replacement,
			`Could not update asset reference matching ${pattern.source}`,
		);
	}
	await writeFile(paths.html, content);
	console.log(`  - Set deployment version to ${version}`);
}

export function isOptionalOfflinePath(relativePath: string): boolean {
	const path = relativePath.split(sep).join("/");
	return (
		path.startsWith("swf/") ||
		path.startsWith("iframe/") ||
		path.startsWith("dos/") ||
		(path.startsWith("js/") &&
			(path.endsWith(".wasm") ||
				Boolean(path.split("/").at(-1)?.startsWith("core.ruffle."))))
	);
}

async function offlineFileEntry(root: string, path: string): Promise<OfflineFile> {
	return {
		bytes: (await stat(path)).size,
		url: relative(root, path).split(sep).join("/"),
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

export async function writeOfflineGameManifest(
	paths: BuildPaths,
	version: string,
): Promise<void> {
	const runtimeFiles = (await readdir(paths.js, { withFileTypes: true }))
		.filter(
			(entry) =>
				entry.isFile() &&
				(entry.name.endsWith(".wasm") ||
					(entry.name.startsWith("core.ruffle.") && entry.name.endsWith(".js"))),
		)
		.map((entry) => join(paths.js, entry.name))
		.toSorted();

	const gameIds = new Set<string>();
	for (const parent of [join(paths.root, "swf"), join(paths.root, "iframe")]) {
		if (!(await isDirectory(parent))) continue;
		for (const entry of await readdir(parent, { withFileTypes: true })) {
			if (entry.isDirectory()) gameIds.add(entry.name);
		}
	}

	const games: Record<string, OfflineGame> = {};
	for (const gameId of [...gameIds].sort()) {
		const gameType = (await isDirectory(join(paths.root, "swf", gameId)))
			? "swf"
			: "iframe";
		const roots = [join(paths.root, gameType, gameId)];
		const doomRoot = join(paths.root, "dos", "doom");
		if (gameId === "doom" && (await isDirectory(doomRoot))) roots.push(doomRoot);
		const files = (await Promise.all(roots.map(walkFiles))).flat().sort();
		games[gameId] = {
			bytes: (
				await Promise.all(files.map(async (path) => (await stat(path)).size))
			).reduce((total, bytes) => total + bytes, 0),
			files: await Promise.all(files.map((path) => offlineFileEntry(paths.root, path))),
			revision: await offlineRevision(paths.root, files),
			type: gameType,
		};
	}

	const manifest: OfflineManifest = {
		games,
		runtime: {
			bytes: (
				await Promise.all(runtimeFiles.map(async (path) => (await stat(path)).size))
			).reduce((total, bytes) => total + bytes, 0),
			files: await Promise.all(
				runtimeFiles.map((path) => offlineFileEntry(paths.root, path)),
			),
			revision: await offlineRevision(paths.root, runtimeFiles),
		},
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
): Promise<void> {
	console.log("Generating service worker...");
	await generator({
		...workboxConfig,
		globDirectory: `${resolve(outputDir)}/`,
		swDest: join(resolve(outputDir), "sw.js"),
	});

	const serviceWorker = join(outputDir, "sw.js");
	if (!(await isFile(serviceWorker))) {
		throw new Error("Workbox did not generate output sw.js");
	}
	const workerSource = await readFile(serviceWorker, "utf8");
	const referencedRuntimeNames = new Set(
		[...workerSource.matchAll(/workbox-[a-f0-9]+(?:\.js)?/g)].map((match) =>
			match[0].endsWith(".js") ? match[0] : `${match[0]}.js`,
		),
	);
	if (referencedRuntimeNames.size === 0) {
		throw new Error("Generated service worker references no Workbox runtime");
	}
	if (
		!(await Promise.all(
			[...referencedRuntimeNames].map((name) => isFile(join(outputDir, name))),
		)).every(Boolean)
	) {
		throw new Error("Generated service worker references a missing Workbox runtime");
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
		join(outputDir, "swf", "bike-mania", "main.swf"),
		join(outputDir, "iframe", "doom", "index.html"),
		join(outputDir, "iframe", "inside-the-firewall", "index.html"),
		join(outputDir, "dos", "doom", "doom.jsdos"),
		paths.fflateJs,
	];
	const missing = (
		await Promise.all(
			required.map(async (path) => ((await isFile(path)) ? undefined : relative(outputDir, path))),
		)
	).filter(Boolean);
	if (missing.length > 0) {
		throw new Error(`Build output is missing required files: ${missing.join(", ")}`);
	}

	const html = await readFile(paths.html, "utf8");
	for (const asset of [
		"js/ruffle.js",
		"vendor/fflate/0.8.3/index.js",
		"js/games.js",
		"js/game-installer.js",
		"js/game-library.js",
		"js/filesystem.js",
		"js/file-operations.js",
		"js/dialogs.js",
		"js/offline.js",
		"js/main.js",
		"css/main.css",
	]) {
		const pattern = new RegExp(`${asset.replaceAll(".", "\\.")}\\?v=[a-f0-9]{8}"`);
		if (!pattern.test(html)) {
			throw new Error(`Build output has no hashed reference for ${asset}`);
		}
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
	if (
		!(versionMetadata.version as string).endsWith(`-${versionMetadata.revision as string}`)
	) {
		throw new Error("Build output has inconsistent version metadata");
	}
	console.log("Build output validated successfully");
}

export async function replaceOutput(stagingDir: string, outputDir: string): Promise<void> {
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
	generate?: (outputDir: string) => Promise<void>;
}

export async function build({
	outputDir = DEFAULT_OUTPUT_DIR,
	revision = "HEAD",
	sourceDir = SOURCE_DIR,
	version,
	download = downloadRuffle,
	generate = generateServiceWorker,
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
		join(dirname(resolvedOutput), `.${resolvedOutput.split(sep).at(-1)}-build-`),
	);
	try {
		const stagingDir = join(temporaryDirectory, "output");
		await cp(resolvedSource, stagingDir, { recursive: true, preserveTimestamps: true });
		const paths = new BuildPaths(stagingDir);
		await installFflate(stagingDir);
		await download(paths.js);
		await updateHtml(paths, deploymentVersion);
		await writeOfflineGameManifest(paths, deploymentVersion);
		await writeVersionMetadata(paths, deploymentVersion);
		await generate(stagingDir);
		await validateOutput(stagingDir);
		await replaceOutput(stagingDir, resolvedOutput);
	} finally {
		await rm(temporaryDirectory, { recursive: true, force: true });
	}
	console.log(`Build completed successfully: ${resolvedOutput}`);
}

function parseArguments(arguments_: string[]): { outputDir: string; revision: string } {
	let outputDir = DEFAULT_OUTPUT_DIR;
	let revision = "HEAD";
	for (let index = 0; index < arguments_.length; index += 1) {
		const argument = arguments_[index];
		if (argument === "--output" || argument === "--revision") {
			const value = arguments_[index + 1];
			if (!value) throw new Error(`${argument} requires a value`);
			if (argument === "--output") outputDir = isAbsolute(value) ? value : resolve(value);
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
