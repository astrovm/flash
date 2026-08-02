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

import { decode as decodeBmp } from "@nktkas/bmp";
import sharp from "sharp";

type DirectAsset = { member: string; output: string };
type CabAsset = DirectAsset & { cabMember: string; bitmap?: boolean };
type ResourceIcon = DirectAsset & {
  expandedName: string;
  resourceType: number;
  resourceId: number | string;
  width: number;
  height: number;
  bitDepth: number;
};
type ResourceBitmap = DirectAsset & {
  expandedName: string;
  resourceType: number;
  resourceId: number | string;
  transparentColor?: [number, number, number];
  colorMap?: Array<{
    from: [number, number, number];
    to: [number, number, number];
  }>;
  indexedPalette?: {
    sourceShiftX: number;
    colors: Array<{
      indices: number[];
      rgba: [number, number, number, number];
    }>;
  };
};
type ResourcePng = DirectAsset & {
  expandedName: string;
  resourceType: string;
  resourceId: number | string;
};
type RenderedAsset = DirectAsset & {
  frame: string;
  sha256: string;
  pixelSha256: string;
  inputs: string[];
  capture: string;
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
  cabAssets?: CabAsset[];
  cursorImages?: DirectAsset[];
  resourceIcons: ResourceIcon[];
  resourceBitmaps: ResourceBitmap[];
  resourcePngs?: ResourcePng[];
  renderedAssets?: RenderedAsset[];
  auditFiles: DirectAsset[];
};
type SourceRecord = {
  isoSha256: string;
  member: string;
  sha256: string;
  resource?: {
    parentSha256: string;
    type: number | string;
    id: number | string;
    language: number;
    frame: string;
    pixelSha256: string;
  };
  rendered?: {
    inputs: string[];
    capture: string;
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

async function extractCabAsset(
  isoPath: string,
  asset: CabAsset,
  workDirectory: string,
): Promise<Uint8Array> {
  const cabinet = await expandMember(isoPath, asset.member, workDirectory);
  const cabinetPath = join(
    workDirectory,
    `${asset.member}-${basename(asset.cabMember)}.cab`,
  );
  await writeFile(cabinetPath, cabinet);
  const content = run("cabextract", ["-p", "-F", asset.cabMember, cabinetPath]);
  if (!asset.bitmap) return content;
  const decoded = decodeBmp(content);
  const rgba = new Uint8Array(decoded.width * decoded.height * 4);
  for (let source = 0, target = 0; source < decoded.data.length;) {
    rgba[target++] = decoded.data[source++];
    rgba[target++] = decoded.data[source++];
    rgba[target++] = decoded.data[source++];
    rgba[target++] = decoded.channels === 4 ? decoded.data[source++] : 255;
  }
  return sharp(rgba, {
    raw: { width: decoded.width, height: decoded.height, channels: 4 },
  })
    .png()
    .toBuffer();
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

async function extractCursorImage(
  isoPath: string,
  asset: DirectAsset,
  workDirectory: string,
): Promise<Uint8Array> {
  const cursor = await expandMember(isoPath, asset.member, workDirectory);
  const resourceKey = `${asset.member}-${basename(asset.output)}`.replace(
    /[^a-zA-Z0-9._-]/g,
    "-",
  );
  const cursorPath = join(workDirectory, `${resourceKey}.cur`);
  const frameDirectory = join(workDirectory, `cursor-${resourceKey}`);
  await writeFile(cursorPath, cursor);
  await mkdir(frameDirectory);
  run("icotool", ["-x", "-o", frameDirectory, cursorPath]);
  return readFile(await firstFile(frameDirectory, ".png"));
}

async function extractIcon(
  isoPath: string,
  icon: ResourceIcon,
  workDirectory: string,
): Promise<{ png: Uint8Array; parentSha256: string; pixelSha256: string }> {
  const parent = await expandMember(isoPath, icon.member, workDirectory);
  const parentPath = join(workDirectory, icon.expandedName);
  await writeFile(parentPath, parent);

  const resourceKey = `${icon.expandedName}-${icon.resourceId}-${basename(icon.output)}`;
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

async function extractBitmap(
  isoPath: string,
  bitmap: ResourceBitmap,
  workDirectory: string,
): Promise<{
  png: Uint8Array;
  parentSha256: string;
  pixelSha256: string;
  frame: string;
}> {
  const parent = await expandMember(isoPath, bitmap.member, workDirectory);
  const parentPath = join(workDirectory, bitmap.expandedName);
  await writeFile(parentPath, parent);

  const resourceKey =
    `${bitmap.expandedName}-${bitmap.resourceId}-${basename(bitmap.output)}`.replace(
      /[^a-zA-Z0-9._-]/g,
      "-",
    );
  const bitmapDirectory = join(workDirectory, `bitmap-${resourceKey}`);
  await mkdir(bitmapDirectory);
  run("wrestool", [
    "-x",
    "-t",
    String(bitmap.resourceType),
    "-n",
    String(bitmap.resourceId),
    "-L",
    String(manifest.source.language),
    "-o",
    bitmapDirectory,
    parentPath,
  ]);

  const bitmapFile = await readFile(await firstFile(bitmapDirectory, ".bmp"));
  const decoded = decodeBmp(bitmapFile);
  const rgba = new Uint8Array(decoded.width * decoded.height * 4);
  if (bitmap.indexedPalette) {
    const bitsPerPixel = bitmapFile.readUInt16LE(28);
    const compression = bitmapFile.readUInt32LE(30);
    if (bitsPerPixel !== 8 || compression !== 1)
      throw new Error(
        `${bitmap.expandedName} resource ${bitmap.resourceId} must be RLE8 for indexed palette rendering`,
      );
    const indices = new Uint8Array(decoded.width * decoded.height);
    let input = bitmapFile.readUInt32LE(10);
    let x = 0;
    let y = decoded.height - 1;
    while (input < bitmapFile.length && y >= 0) {
      const count = bitmapFile[input++];
      const value = bitmapFile[input++];
      if (count) {
        for (let offset = 0; offset < count; offset += 1) {
          if (x < decoded.width) indices[y * decoded.width + x] = value;
          x += 1;
        }
      } else if (value === 0) {
        x = 0;
        y -= 1;
      } else if (value === 1) {
        break;
      } else if (value === 2) {
        x += bitmapFile[input++];
        y -= bitmapFile[input++];
      } else {
        for (let offset = 0; offset < value; offset += 1) {
          if (x < decoded.width)
            indices[y * decoded.width + x] = bitmapFile[input];
          x += 1;
          input += 1;
        }
        if (value % 2) input += 1;
      }
    }
    const palette = new Map<number, [number, number, number, number]>();
    bitmap.indexedPalette.colors.forEach(({ indices: entries, rgba: color }) =>
      entries.forEach((index) => palette.set(index, color)),
    );
    for (let targetY = 0; targetY < decoded.height; targetY += 1) {
      for (let targetX = 0; targetX < decoded.width; targetX += 1) {
        const sourceX =
          (targetX + bitmap.indexedPalette.sourceShiftX + decoded.width) %
          decoded.width;
        const index = indices[targetY * decoded.width + sourceX];
        const color = palette.get(index);
        if (!color)
          throw new Error(
            `${bitmap.expandedName} resource ${bitmap.resourceId} has unmapped palette index ${index}`,
          );
        rgba.set(color, (targetY * decoded.width + targetX) * 4);
      }
    }
  } else {
    const colorMap = new Map(
      bitmap.colorMap?.map(({ from, to }) => [from.join(","), to]),
    );
    for (let source = 0, target = 0; source < decoded.data.length;) {
      const red = decoded.data[source++];
      const green = decoded.data[source++];
      const blue = decoded.data[source++];
      const sourceAlpha = decoded.channels === 4 ? decoded.data[source++] : 255;
      const mapped = colorMap.get(`${red},${green},${blue}`);
      const transparent =
        bitmap.transparentColor?.[0] === red &&
        bitmap.transparentColor[1] === green &&
        bitmap.transparentColor[2] === blue;
      rgba[target++] = mapped?.[0] ?? red;
      rgba[target++] = mapped?.[1] ?? green;
      rgba[target++] = mapped?.[2] ?? blue;
      rgba[target++] = transparent ? 0 : sourceAlpha;
    }
  }
  const png = await sharp(rgba, {
    raw: { width: decoded.width, height: decoded.height, channels: 4 },
  })
    .png()
    .toBuffer();
  return {
    png,
    parentSha256: sha256(parent),
    pixelSha256: sha256(rgba),
    frame: `${decoded.width}x${decoded.height}x32`,
  };
}

async function extractPng(
  isoPath: string,
  asset: ResourcePng,
  workDirectory: string,
): Promise<{
  png: Uint8Array;
  parentSha256: string;
  pixelSha256: string;
  frame: string;
}> {
  const parent = await expandMember(isoPath, asset.member, workDirectory);
  const parentPath = join(workDirectory, asset.expandedName);
  await writeFile(parentPath, parent);
  const resourceKey =
    `${asset.expandedName}-${asset.resourceId}-${basename(asset.output)}`.replace(
      /[^a-zA-Z0-9._-]/g,
      "-",
    );
  const pngDirectory = join(workDirectory, `png-${resourceKey}`);
  await mkdir(pngDirectory);
  run("wrestool", [
    "-x",
    "--raw",
    "-t",
    asset.resourceType,
    "-n",
    String(asset.resourceId),
    "-L",
    String(manifest.source.language),
    "-o",
    pngDirectory,
    parentPath,
  ]);
  const png = await readFile(await firstFile(pngDirectory, ""));
  const metadata = await sharp(png).metadata();
  const { data } = await sharp(png).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  return {
    png,
    parentSha256: sha256(parent),
    pixelSha256: sha256(data),
    frame: `${metadata.width}x${metadata.height}`,
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

  for (const asset of manifest.cabAssets ?? []) {
    const content = await extractCabAsset(isoPath, asset, workDirectory);
    await verifyOrWrite(asset.output, content);
    records[relative("site", asset.output)] = {
      isoSha256: manifest.source.sha256,
      member: `I386/${asset.member}!/${asset.cabMember}`,
      sha256: sha256(content),
    };
  }

  for (const asset of manifest.cursorImages ?? []) {
    const content = await extractCursorImage(isoPath, asset, workDirectory);
    await verifyOrWrite(asset.output, content);
    records[relative("site", asset.output)] = {
      isoSha256: manifest.source.sha256,
      member: `I386/${asset.member}`,
      sha256: sha256(content),
    };
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

  for (const bitmap of manifest.resourceBitmaps) {
    const extracted = await extractBitmap(isoPath, bitmap, workDirectory);
    await verifyOrWrite(bitmap.output, extracted.png, extracted.pixelSha256);
    records[relative("site", bitmap.output)] = {
      isoSha256: manifest.source.sha256,
      member: `I386/${bitmap.member}`,
      sha256: sha256(extracted.png),
      resource: {
        parentSha256: extracted.parentSha256,
        type: bitmap.resourceType,
        id: bitmap.resourceId,
        language: manifest.source.language,
        frame: extracted.frame,
        pixelSha256: extracted.pixelSha256,
      },
    };
  }

  for (const asset of manifest.resourcePngs ?? []) {
    const extracted = await extractPng(isoPath, asset, workDirectory);
    await verifyOrWrite(asset.output, extracted.png, extracted.pixelSha256);
    records[relative("site", asset.output)] = {
      isoSha256: manifest.source.sha256,
      member: `I386/${asset.member}`,
      sha256: sha256(extracted.png),
      resource: {
        parentSha256: extracted.parentSha256,
        type: asset.resourceType,
        id: asset.resourceId,
        language: manifest.source.language,
        frame: extracted.frame,
        pixelSha256: extracted.pixelSha256,
      },
    };
  }

  for (const asset of manifest.renderedAssets ?? []) {
    const content = await readFile(join(projectDirectory, asset.output));
    const { data } = await sharp(content).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });
    if (sha256(content) !== asset.sha256 || sha256(data) !== asset.pixelSha256)
      throw new Error(`${asset.output}: rendered XP capture differs`);
    records[relative("site", asset.output)] = {
      isoSha256: manifest.source.sha256,
      member: `I386/${asset.member}`,
      sha256: asset.sha256,
      rendered: {
        inputs: asset.inputs,
        capture: asset.capture,
        frame: asset.frame,
        pixelSha256: asset.pixelSha256,
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
    `${checkOnly ? "Verified" : "Extracted"} ${manifest.webAssets.length + (manifest.cabAssets?.length ?? 0) + (manifest.cursorImages?.length ?? 0) + manifest.resourceIcons.length + manifest.resourceBitmaps.length + (manifest.resourcePngs?.length ?? 0) + (manifest.renderedAssets?.length ?? 0)} web assets from the authenticated XP SP3 ISO.`,
  );
} finally {
  await rm(workDirectory, { force: true, recursive: true });
}
