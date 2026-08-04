import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PACKAGE_JSON_PATH = join(PROJECT_DIR, "package.json");
export const RUFFLE_PACKAGE = "@ruffle-rs/ruffle";
export const RUFFLE_NPM_REGISTRY_URL =
  "https://registry.npmjs.org/@ruffle-rs/ruffle";

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

type PackageJson = {
  dependencies?: Record<string, string>;
  [key: string]: unknown;
};

type NpmPackageMetadata = {
  "dist-tags"?: {
    latest?: string;
    [tag: string]: string | undefined;
  };
};

async function fetchOrThrow(
  fetchImpl: FetchLike,
  url: string,
  timeout: number,
): Promise<Response> {
  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}: ${url}`);
  }
  return response;
}

export async function getLatestStableVersion(
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const metadata = (await (
    await fetchOrThrow(fetchImpl, RUFFLE_NPM_REGISTRY_URL, 30_000)
  ).json()) as NpmPackageMetadata;
  const version = metadata["dist-tags"]?.latest ?? "";
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error("npm did not return a stable semantic Ruffle version");
  }
  return version;
}

const PINNED_VERSION_PATTERN = /^\^?(\d+\.\d+\.\d+)$/;

export function readPinnedVersion(packageJson: PackageJson): string {
  const version = packageJson.dependencies?.[RUFFLE_PACKAGE];
  const match = version?.match(PINNED_VERSION_PATTERN);
  if (!match) {
    throw new Error(
      `package.json must pin ${RUFFLE_PACKAGE} to a stable semantic version`,
    );
  }
  return match[1];
}

export function pinnedDependencyRange(version: string): string {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid Ruffle version: ${version}`);
  }
  return `^${version}`;
}

export async function updatePackagePin(
  packageJsonPath = PACKAGE_JSON_PATH,
  fetchImpl: FetchLike = fetch,
  install: (projectDir: string) => void = runBunInstall,
): Promise<boolean> {
  const latest = await getLatestStableVersion(fetchImpl);
  const packageJson = JSON.parse(
    await readFile(packageJsonPath, "utf8"),
  ) as PackageJson;
  const current = readPinnedVersion(packageJson);
  if (current === latest) {
    console.log(`Ruffle ${latest} is already pinned.`);
    return false;
  }
  packageJson.dependencies = {
    ...packageJson.dependencies,
    [RUFFLE_PACKAGE]: pinnedDependencyRange(latest),
  };
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  install(dirname(packageJsonPath));
  console.log(`Updated Ruffle pin from ${current} to ${latest}.`);
  return true;
}

export function runBunInstall(projectDir: string): void {
  // Allow brand-new stable releases through Bun's default 24h minimum-release-age.
  const result = Bun.spawnSync(["bun", "install", "--minimum-release-age=0"], {
    cwd: projectDir,
    stderr: "pipe",
    stdout: "pipe",
  });
  if (!result.success) {
    throw new Error(
      `bun install failed after updating ${RUFFLE_PACKAGE}: ${result.stderr.toString()}`,
    );
  }
}

if (import.meta.main) {
  await updatePackagePin();
}
