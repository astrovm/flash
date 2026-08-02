import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

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
    pixelSha256: string;
  };
};

const projectDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const sources = JSON.parse(
  await readFile(
    join(projectDirectory, "site", "assets", "xp", "SOURCES.json"),
    "utf8",
  ),
) as Record<string, SourceRecord>;
const manifest = JSON.parse(
  await readFile(join(projectDirectory, "tools", "xp-assets.json"), "utf8"),
) as {
  source: { sha256: string };
  webAssets: { output: string }[];
  cabAssets?: { output: string }[];
  cursorImages?: { output: string }[];
  resourceIcons: { output: string; resourceId: number }[];
  resourceBitmaps: { output: string; resourceId: number | string }[];
  resourcePngs?: { output: string; resourceId: number | string }[];
  renderedAssets?: { output: string }[];
};

const sha256 = (content: Uint8Array) =>
  createHash("sha256").update(content).digest("hex");

describe("Windows XP asset provenance", () => {
  test("covers every committed extracted asset", () => {
    const outputs = [
      ...manifest.webAssets.map(({ output }) => output.replace(/^site\//, "")),
      ...(manifest.cabAssets ?? []).map(({ output }) =>
        output.replace(/^site\//, ""),
      ),
      ...(manifest.cursorImages ?? []).map(({ output }) =>
        output.replace(/^site\//, ""),
      ),
      ...manifest.resourceIcons.map(({ output }) =>
        output.replace(/^site\//, ""),
      ),
      ...manifest.resourceBitmaps.map(({ output }) =>
        output.replace(/^site\//, ""),
      ),
      ...(manifest.resourcePngs ?? []).map(({ output }) =>
        output.replace(/^site\//, ""),
      ),
      ...(manifest.renderedAssets ?? []).map(({ output }) =>
        output.replace(/^site\//, ""),
      ),
    ];
    expect(Object.keys(sources)).toEqual(outputs);
    for (const source of Object.values(sources)) {
      expect(source.isoSha256).toBe(manifest.source.sha256);
      expect(source.member).toMatch(
        /^I386\/[A-Z0-9_]+(?:\.[A-Z0-9_]+)(?:!\/[A-Za-z0-9_.-]+)?$/,
      );
    }

    const xpFiles = [
      ...new Bun.Glob("site/assets/xp/**/*").scanSync({
        cwd: projectDirectory,
        onlyFiles: true,
      }),
    ]
      .map((file) => file.replace(/^site\//, ""))
      .filter((file) => file !== "assets/xp/SOURCES.json")
      .sort();
    expect(
      Object.keys(sources)
        .filter((file) => file.startsWith("assets/xp/"))
        .sort(),
    ).toEqual(xpFiles);

    const fontFiles = [
      ...new Bun.Glob("site/css/fonts/*").scanSync({
        cwd: projectDirectory,
        onlyFiles: true,
      }),
    ]
      .map((file) => file.replace(/^site\//, ""))
      .sort();
    expect(
      Object.keys(sources)
        .filter((file) => file.startsWith("css/fonts/"))
        .sort(),
    ).toEqual(fontFiles);
  });

  test("matches the recorded byte and pixel hashes", async () => {
    for (const [relativePath, source] of Object.entries(sources)) {
      const content = await readFile(
        join(projectDirectory, "site", relativePath),
      );
      expect(sha256(content), relativePath).toBe(source.sha256);
      if (source.resource) {
        const { data } = await sharp(content).ensureAlpha().raw().toBuffer({
          resolveWithObject: true,
        });
        expect(sha256(data), `${relativePath} pixels`).toBe(
          source.resource.pixelSha256,
        );
      }
      if (source.rendered) {
        const { data } = await sharp(content).ensureAlpha().raw().toBuffer({
          resolveWithObject: true,
        });
        expect(sha256(data), `${relativePath} rendered pixels`).toBe(
          source.rendered.pixelSha256,
        );
      }
    }
  });

  test("uses the canonical shell32 Recycle Bin resource pair", () => {
    const empty = sources["assets/xp/icons/RecyclerEmpty.png"];
    const full = sources["assets/xp/icons/RecyclerFull.png"];
    expect(empty.resource?.id).toBe(32);
    expect(full.resource?.id).toBe(33);
    expect(empty.resource?.parentSha256).toBe(full.resource?.parentSha256);
    expect(empty.resource?.pixelSha256).not.toBe(full.resource?.pixelSha256);
  });
});
