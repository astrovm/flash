import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

type DirectAsset = { member: string; output: string };
type ResourceIcon = DirectAsset & {
  expandedName: string;
  resourceType: number;
  resourceId: number;
  width: number;
  height: number;
  bitDepth: number;
};
type Manifest = {
  version: number;
  source: {
    edition: string;
    iso: string;
    sha256: string;
    language: number;
  };
  webAssets: DirectAsset[];
  resourceIcons: ResourceIcon[];
  auditFiles: DirectAsset[];
};
type SourceRecord = {
  isoSha256: string;
  member: string;
  sha256: string;
  resource?: {
    parentSha256: string;
    type: number;
    id: number;
    language: number;
    frame: string;
    pixelSha256: string;
  };
};

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(projectDirectory, "tools", "xp-assets.json");
const sourcesPath = join(
  projectDirectory,
  "site",
  "assets",
  "xp",
  "SOURCES.json",
);
const auditDirectory = join(
  projectDirectory,
  "source-media",
  "xp-sp3",
  "extracted",
);
const checkOnly = Bun.argv.includes("--check");

const sha256 = (content: Uint8Array) =>
  createHash("sha256").update(content).digest("hex");

function run(command: string, args: string[], input?: Uint8Array): Uint8Array {
  const result = Bun.spawnSync([command, ...args], {
    stdin: input,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    const details = result.stderr.toString().trim();
    throw new Error(`${command} failed${details ? `: ${details}` : ""}`);
  }
  return result.stdout;
}

async function expandMember(
  isoPath: string,
  member: string,
  workDirectory: string,
): Promise<Uint8Array> {
  const compressed = run("7z", ["e", "-so", isoPath, `I386/${member}`]);
  const compressedPath = join(workDirectory, member);
  await writeFile(compressedPath, compressed);
  return run("cabextract", ["-p", compressedPath]);
}

async function firstFile(
  directory: string,
  extension: string,
): Promise<string> {
  const files = await readdir(directory);
  const file = files.find((candidate) =>
    candidate.toLowerCase().endsWith(extension),
  );
  if (!file) throw new Error(`No ${extension} file produced in ${directory}`);
  return join(directory, file);
}

async function extractIcon(
  isoPath: string,
  icon: ResourceIcon,
  workDirectory: string,
): Promise<{ png: Uint8Array; parentSha256: string; pixelSha256: string }> {
  const parent = await expandMember(isoPath, icon.member, workDirectory);
  const parentPath = join(workDirectory, icon.expandedName);
  await writeFile(parentPath, parent);

  const resourceKey = `${icon.expandedName}-${icon.resourceId}`;
  const groupDirectory = join(workDirectory, `group-${resourceKey}`);
  const frameDirectory = join(workDirectory, `frame-${resourceKey}`);
  await mkdir(groupDirectory);
  await mkdir(frameDirectory);
  run("wrestool", [
    "-x",
    "-t",
    String(icon.resourceType),
    "-n",
    String(icon.resourceId),
    "-L",
    String(manifest.source.language),
    "-o",
    groupDirectory,
    parentPath,
  ]);
  const icoPath = await firstFile(groupDirectory, ".ico");
  run("icotool", [
    "-x",
    "-w",
    String(icon.width),
    "-h",
    String(icon.height),
    "-b",
    String(icon.bitDepth),
    "-o",
    frameDirectory,
    icoPath,
  ]);
  const png = await readFile(await firstFile(frameDirectory, ".png"));
  const { data } = await sharp(png).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  return {
    png,
    parentSha256: sha256(parent),
    pixelSha256: sha256(data),
  };
}

async function verifyOrWrite(
  output: string,
  content: Uint8Array,
  pixelHash?: string,
): Promise<void> {
  const outputPath = join(projectDirectory, output);
  if (!checkOnly) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
    return;
  }
  const existing = await readFile(outputPath);
  if (pixelHash) {
    const { data } = await sharp(existing).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });
    if (sha256(data) !== pixelHash)
      throw new Error(`${output}: rendered pixels differ from the XP resource`);
  } else if (sha256(existing) !== sha256(content)) {
    throw new Error(`${output}: bytes differ from the XP source`);
  }
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
const isoPath = join(projectDirectory, manifest.source.iso);
const iso = await readFile(isoPath);
if (sha256(iso) !== manifest.source.sha256)
  throw new Error(`Unexpected ISO checksum for ${manifest.source.iso}`);

const workDirectory = await mkdtemp(join(tmpdir(), "astro-xp-assets-"));
const records: Record<string, SourceRecord> = {};
try {
  for (const asset of manifest.webAssets) {
    const content = await expandMember(isoPath, asset.member, workDirectory);
    await verifyOrWrite(asset.output, content);
    records[relative("site", asset.output)] = {
      isoSha256: manifest.source.sha256,
      member: `I386/${asset.member}`,
      sha256: sha256(content),
    };
    if (!checkOnly) {
      const auditPath = join(auditDirectory, "I386", basename(asset.output));
      await mkdir(dirname(auditPath), { recursive: true });
      await writeFile(auditPath, content);
    }
  }

  for (const icon of manifest.resourceIcons) {
    const extracted = await extractIcon(isoPath, icon, workDirectory);
    await verifyOrWrite(icon.output, extracted.png, extracted.pixelSha256);
    records[relative("site", icon.output)] = {
      isoSha256: manifest.source.sha256,
      member: `I386/${icon.member}`,
      sha256: sha256(extracted.png),
      resource: {
        parentSha256: extracted.parentSha256,
        type: icon.resourceType,
        id: icon.resourceId,
        language: manifest.source.language,
        frame: `${icon.width}x${icon.height}x${icon.bitDepth}`,
        pixelSha256: extracted.pixelSha256,
      },
    };
  }

  for (const asset of manifest.auditFiles) {
    const content = await expandMember(isoPath, asset.member, workDirectory);
    const outputPath = join(auditDirectory, asset.output);
    if (!checkOnly) {
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, content);
    }
  }

  if (checkOnly) {
    const expected = JSON.parse(await readFile(sourcesPath, "utf8"));
    if (JSON.stringify(expected) !== JSON.stringify(records))
      throw new Error("site/assets/xp/SOURCES.json is out of date");
  } else {
    await mkdir(dirname(sourcesPath), { recursive: true });
    await writeFile(sourcesPath, `${JSON.stringify(records, null, 2)}\n`);
    await copyFile(manifestPath, join(auditDirectory, "manifest.json"));
  }
  console.log(
    `${checkOnly ? "Verified" : "Extracted"} ${manifest.webAssets.length + manifest.resourceIcons.length} web assets from the authenticated XP SP3 ISO.`,
  );
} finally {
  await rm(workDirectory, { force: true, recursive: true });
}
