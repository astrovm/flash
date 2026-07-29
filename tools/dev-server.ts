import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { type CatalogFetcher, handleCatalogRequest } from "../catalog/catalog";
import { handleRtcRequest } from "../rtc/rtc";
import type { BuildOptions } from "./deploy";

const PROJECT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT_DIR = join(PROJECT_DIR, "dist");
export const DEV_BUILD_STATE = ".dev-build-state.json";
const BUILD_INPUTS = [
  "site",
  "tools/deploy.ts",
  "tools/ruffle-release.json",
  "workbox-config.ts",
  "package.json",
  "bun.lock",
];

interface DevBuildState {
  schema: 1;
  fingerprint: string;
  ruffleRelease: string;
  generatedAt: string;
}

interface EnsureDevelopmentBuildOptions {
  outputDir?: string;
  force?: boolean;
  projectDir?: string;
  fingerprint?: () => Promise<string>;
  releaseKey?: () => Promise<string>;
  builder?: (options: BuildOptions) => Promise<void>;
}

interface EnsureDevelopmentBuildResult {
  rebuilt: boolean;
  reusedRuffle: boolean;
}

function gitOutput(
  arguments_: string[],
  projectDir: string,
): Uint8Array | null {
  const result = Bun.spawnSync(["git", ...arguments_], {
    cwd: projectDir,
    stderr: "ignore",
    stdout: "pipe",
  });
  return result.success ? result.stdout : null;
}

async function walkFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function filesystemFingerprint(projectDir: string): Promise<string> {
  const digest = createHash("sha256");
  for (const input of BUILD_INPUTS) {
    const path = join(projectDir, input);
    try {
      const info = await stat(path);
      const files = info.isDirectory() ? await walkFiles(path) : [path];
      for (const file of files.sort()) {
        digest.update(relative(projectDir, file).split(sep).join("/"));
        digest.update(await readFile(file));
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      digest.update(`missing:${input}`);
    }
  }
  return digest.digest("hex");
}

export async function computeSourceFingerprint(
  projectDir = PROJECT_DIR,
): Promise<string> {
  const tracked = gitOutput(
    ["ls-files", "-s", "--", ...BUILD_INPUTS],
    projectDir,
  );
  const changes = gitOutput(
    ["diff", "--binary", "--no-ext-diff", "HEAD", "--", ...BUILD_INPUTS],
    projectDir,
  );
  const untracked = gitOutput(
    ["ls-files", "--others", "--exclude-standard", "-z", "--", ...BUILD_INPUTS],
    projectDir,
  );
  if (!tracked || !changes || !untracked) {
    return filesystemFingerprint(projectDir);
  }

  const digest = createHash("sha256");
  digest.update(tracked);
  digest.update(changes);
  for (const relativePath of Buffer.from(untracked)
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .sort()) {
    digest.update(relativePath);
    digest.update(await readFile(join(projectDir, relativePath)));
  }
  return digest.digest("hex");
}

async function currentRuffleReleaseKey(): Promise<string> {
  return createHash("sha256")
    .update(await readFile(join(PROJECT_DIR, "tools", "ruffle-release.json")))
    .digest("hex");
}

async function readBuildState(
  outputDir: string,
): Promise<DevBuildState | null> {
  try {
    const state = JSON.parse(
      await readFile(join(outputDir, DEV_BUILD_STATE), "utf8"),
    ) as Partial<DevBuildState>;
    return state.schema === 1 &&
      typeof state.fingerprint === "string" &&
      typeof state.ruffleRelease === "string" &&
      typeof state.generatedAt === "string"
      ? (state as DevBuildState)
      : null;
  } catch {
    return null;
  }
}

async function hasRuffleRuntime(jsDir: string): Promise<boolean> {
  try {
    const names = await readdir(jsDir);
    return (
      names.includes("ruffle.js") &&
      names.some(
        (name) => name.startsWith("core.ruffle.") && name.endsWith(".js"),
      ) &&
      names.some((name) => name.endsWith(".wasm"))
    );
  } catch {
    return false;
  }
}

async function copyRuffleRuntime(
  sourceJsDir: string,
  destinationJsDir: string,
): Promise<void> {
  const names = (await readdir(sourceJsDir)).filter(
    (name) =>
      name === "ruffle.js" ||
      name === "ruffle.js.map" ||
      name.startsWith("core.ruffle.") ||
      name.endsWith(".wasm"),
  );
  await mkdir(destinationJsDir, { recursive: true });
  await Promise.all(
    names.map((name) =>
      cp(join(sourceJsDir, name), join(destinationJsDir, name), {
        preserveTimestamps: true,
      }),
    ),
  );
}

export async function ensureDevelopmentBuild({
  outputDir = DEFAULT_OUTPUT_DIR,
  force = false,
  projectDir = PROJECT_DIR,
  fingerprint = () => computeSourceFingerprint(projectDir),
  releaseKey = currentRuffleReleaseKey,
  builder,
}: EnsureDevelopmentBuildOptions = {}): Promise<EnsureDevelopmentBuildResult> {
  const resolvedOutput = resolve(outputDir);
  const [sourceFingerprint, ruffleRelease, previousState] = await Promise.all([
    fingerprint(),
    releaseKey(),
    readBuildState(resolvedOutput),
  ]);
  const hasIndex = await Bun.file(join(resolvedOutput, "index.html")).exists();
  if (
    !force &&
    hasIndex &&
    previousState?.fingerprint === sourceFingerprint &&
    previousState.ruffleRelease === ruffleRelease
  ) {
    console.log("Development build is already in sync.");
    return { rebuilt: false, reusedRuffle: false };
  }

  const sourceJsDir = join(resolvedOutput, "js");
  const canReuseRuffle =
    previousState?.ruffleRelease === ruffleRelease &&
    (await hasRuffleRuntime(sourceJsDir));
  const startedAt = performance.now();
  console.log(
    hasIndex
      ? "Development build is stale; rebuilding..."
      : "Development build is missing; building...",
  );
  const selectedBuilder = builder ?? (await import("./deploy")).build;
  await selectedBuilder({
    outputDir: resolvedOutput,
    ...(canReuseRuffle
      ? {
          download: (destinationJsDir: string) =>
            copyRuffleRuntime(sourceJsDir, destinationJsDir),
        }
      : {}),
  });
  const state: DevBuildState = {
    schema: 1,
    fingerprint: sourceFingerprint,
    ruffleRelease,
    generatedAt: new Date().toISOString(),
  };
  await writeFile(
    join(resolvedOutput, DEV_BUILD_STATE),
    `${JSON.stringify(state)}\n`,
  );
  console.log(
    `Development build synchronized in ${((performance.now() - startedAt) / 1000).toFixed(2)}s${canReuseRuffle ? " (reused Ruffle)" : ""}.`,
  );
  return { rebuilt: true, reusedRuffle: canReuseRuffle };
}

function noCacheHeaders(extra: HeadersInit = {}): Headers {
  const headers = new Headers(extra);
  headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, max-age=0",
  );
  headers.set("Expires", "0");
  headers.set("Pragma", "no-cache");
  return headers;
}

async function staticResponse(
  request: Request,
  directory: string,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed.", {
      status: 405,
      headers: noCacheHeaders({ Allow: "GET, HEAD" }),
    });
  }
  const url = new URL(request.url);
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return new Response("Bad request.", {
      status: 400,
      headers: noCacheHeaders(),
    });
  }
  const root = resolve(directory);
  let path = resolve(root, `.${pathname}`);
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    return new Response("Not found.", {
      status: 404,
      headers: noCacheHeaders(),
    });
  }
  try {
    if ((await stat(path)).isDirectory()) path = join(path, "index.html");
  } catch {
    return new Response("Not found.", {
      status: 404,
      headers: noCacheHeaders(),
    });
  }
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return new Response("Not found.", {
      status: 404,
      headers: noCacheHeaders(),
    });
  }
  return new Response(request.method === "HEAD" ? null : file, {
    headers: noCacheHeaders({
      "Content-Length": String(file.size),
      "Content-Type": file.type || "application/octet-stream",
    }),
  });
}

export function createRequestHandler(
  directory: string,
  fetcher: CatalogFetcher = fetch,
): (request: Request) => Promise<Response> {
  return (request) => {
    const path = new URL(request.url).pathname;
    if (path === "/api/games" || path.startsWith("/api/games/")) {
      return handleCatalogRequest(request, fetcher);
    }
    if (path === "/api/rtc") {
      return handleRtcRequest(request, fetcher);
    }
    return staticResponse(request, directory);
  };
}

interface ServerArguments {
  directory: string;
  force: boolean;
  hostname: string;
  port: number;
  sync: boolean;
}

function parseArguments(arguments_: string[]): ServerArguments {
  const parsed: ServerArguments = {
    directory: DEFAULT_OUTPUT_DIR,
    force: false,
    hostname: "127.0.0.1",
    port: 8000,
    sync: true,
  };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--rebuild") {
      parsed.force = true;
      continue;
    }
    if (argument === "--no-sync") {
      parsed.sync = false;
      continue;
    }
    if (
      argument === "--directory" ||
      argument === "--hostname" ||
      argument === "--port"
    ) {
      const value = arguments_[index + 1];
      if (!value) throw new Error(`${argument} requires a value`);
      if (argument === "--directory") parsed.directory = resolve(value);
      else if (argument === "--hostname") parsed.hostname = value;
      else {
        parsed.port = Number(value);
        if (
          !Number.isInteger(parsed.port) ||
          parsed.port < 0 ||
          parsed.port > 65535
        ) {
          throw new Error("--port must be an integer between 0 and 65535");
        }
      }
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return parsed;
}

if (import.meta.main) {
  try {
    const arguments_ = parseArguments(Bun.argv.slice(2));
    if (arguments_.sync) {
      await ensureDevelopmentBuild({
        outputDir: arguments_.directory,
        force: arguments_.force,
      });
    } else if (
      !(await Bun.file(join(arguments_.directory, "index.html")).exists())
    ) {
      throw new Error(
        `${arguments_.directory} is not built; omit --no-sync or run \`bun run build\``,
      );
    }
    const server = Bun.serve({
      hostname: arguments_.hostname,
      port: arguments_.port,
      fetch: createRequestHandler(arguments_.directory),
      error(error) {
        console.error(error);
        return new Response("Internal server error.", {
          status: 500,
          headers: noCacheHeaders(),
        });
      },
    });
    console.log(`Server running on ${server.url}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
