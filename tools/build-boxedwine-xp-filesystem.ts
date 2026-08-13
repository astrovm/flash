import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { unzipSync, zipSync, type Zippable } from "fflate";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = join(projectRoot, "site", "vendor", "boxedwine", "26R1");
const fixedTime = new Date("2000-01-01T00:00:00Z");
const sharedTrees = [
  "bin/",
  "etc/",
  "home/username/.wine/",
  "lib/",
  "opt/wine/bin/",
  "opt/wine/lib/",
  "opt/wine/share/",
  "usr/",
  "var/",
];

export const buildBoxedWineXpFilesystem = async ({
  sourcePath = join(runtimeRoot, "boxedwine.zip"),
  tracePath = join(runtimeRoot, "xp-accessories-files.json"),
  outputPath = join(runtimeRoot, "xp-accessories.zip"),
} = {}) => {
  const source = new Uint8Array(await readFile(sourcePath));
  const sourceFiles = unzipSync(source);
  const tracedPaths = JSON.parse(await readFile(tracePath, "utf8")) as string[];
  const selected = new Set<string>();
  const missing: string[] = [];

  const addPath = (absolutePath: string, reportMissing = true): void => {
    const path = absolutePath.replace(/^\/+/, "");
    if (!path) return;
    const sourceName = sourceFiles[path]
      ? path
      : sourceFiles[`${path}/`]
        ? `${path}/`
        : `${path}.link`;
    if (!sourceFiles[sourceName]) {
      if (reportMissing) missing.push(absolutePath);
      return;
    }
    if (selected.has(sourceName)) return;
    selected.add(sourceName);
    const segments = sourceName.split("/");
    for (let index = 1; index < segments.length; index += 1) {
      const directory = `${segments.slice(0, index).join("/")}/`;
      if (sourceFiles[directory]) selected.add(directory);
    }
    if (sourceName.endsWith(".link")) {
      const target = new TextDecoder().decode(sourceFiles[sourceName]);
      const resolvedTarget = target.startsWith("/")
        ? target
        : posix.resolve(posix.dirname(`/${path}`), target);
      addPath(resolvedTarget, false);
    }
  };

  for (const absolutePath of tracedPaths) {
    addPath(absolutePath);
  }
  for (const name of Object.keys(sourceFiles)) {
    if (
      !name.includes("/") ||
      sharedTrees.some((prefix) => name.startsWith(prefix))
    ) {
      addPath(`/${name}`, false);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing traced BoxedWine files:\n${missing.join("\n")}`);
  }

  const outputFiles: Zippable = {};
  for (const name of [...selected].sort()) {
    const content = sourceFiles[name];
    const isDirectory = name.endsWith("/");
    const isExecutable =
      isDirectory ||
      (content[0] === 0x7f &&
        content[1] === 0x45 &&
        content[2] === 0x4c &&
        content[3] === 0x46);
    outputFiles[name] = [
      content,
      {
        attrs:
          ((isDirectory ? 0o040000 : 0o100000) |
            (isExecutable ? 0o755 : 0o644)) <<
          16,
        mtime: fixedTime,
        os: 3,
      },
    ];
  }
  const output = zipSync(outputFiles, { level: 9, mtime: fixedTime });
  await writeFile(outputPath, output);

  const sha256 = (content: Uint8Array) =>
    createHash("sha256").update(content).digest("hex");
  return {
    sourceBytes: source.byteLength,
    sourceSha256: sha256(source),
    tracedPaths: tracedPaths.length,
    includedEntries: selected.size,
    missing,
    outputBytes: output.byteLength,
    outputSha256: sha256(output),
  };
};

if (import.meta.main) {
  console.log(JSON.stringify(await buildBoxedWineXpFilesystem(), null, 2));
}
