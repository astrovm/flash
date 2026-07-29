import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
export const RUFFLE_RELEASE_PATH = join(
  PROJECT_DIR,
  "tools",
  "ruffle-release.json",
);
export const RUFFLE_LATEST_RELEASE_URL =
  "https://api.github.com/repos/ruffle-rs/ruffle/releases/latest";
const RUFFLE_ASSET_SUFFIX = "-web-selfhosted.zip";

type RuffleAsset = {
  name?: string;
  digest?: string;
  browser_download_url?: string;
};

type GithubRelease = {
  tag_name?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: RuffleAsset[];
};

export type RuffleRelease = { tag: string; asset: string; sha256: string };
export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

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

export async function getReleaseMetadata(
  fetchImpl: FetchLike = fetch,
): Promise<RuffleRelease> {
  const release = (await (
    await fetchOrThrow(fetchImpl, RUFFLE_LATEST_RELEASE_URL, 30_000)
  ).json()) as GithubRelease;
  const tag = release.tag_name ?? "";
  if (release.draft || release.prerelease || !/^v\d+\.\d+\.\d+$/.test(tag)) {
    throw new Error("GitHub did not return a stable semantic Ruffle release");
  }

  const asset = release.assets?.find((item) =>
    item.name?.endsWith(RUFFLE_ASSET_SUFFIX),
  );
  if (!asset?.name) {
    throw new Error("Stable Ruffle release has no self-hosted web package");
  }

  let checksum = asset.digest?.startsWith("sha256:")
    ? asset.digest.slice("sha256:".length)
    : "";
  if (!checksum) {
    if (!asset.browser_download_url) {
      throw new Error("Stable Ruffle release has no valid SHA-256 digest");
    }
    const archive = await fetchOrThrow(
      fetchImpl,
      asset.browser_download_url,
      120_000,
    );
    checksum = createHash("sha256")
      .update(Buffer.from(await archive.arrayBuffer()))
      .digest("hex");
  }
  if (!/^[a-f0-9]{64}$/.test(checksum)) {
    throw new Error("Stable Ruffle release has no valid SHA-256 digest");
  }

  return { tag, asset: asset.name, sha256: checksum };
}

export async function updateReleaseFile(
  path = RUFFLE_RELEASE_PATH,
  fetchImpl: FetchLike = fetch,
): Promise<boolean> {
  const latest = await getReleaseMetadata(fetchImpl);
  const current = JSON.parse(await readFile(path, "utf8")) as RuffleRelease;
  if (JSON.stringify(latest) === JSON.stringify(current)) {
    console.log(`Ruffle ${latest.tag} is already pinned.`);
    return false;
  }
  await writeFile(path, `${JSON.stringify(latest, null, 2)}\n`);
  console.log(`Updated Ruffle pin from ${current.tag} to ${latest.tag}.`);
  return true;
}

if (import.meta.main) {
  await updateReleaseFile();
}
