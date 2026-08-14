import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { unzipSync, zipSync, type Zippable } from "fflate";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = join(
  projectRoot,
  "site",
  "iframe",
  "boxedwine-runtime",
);
const fixedTime = new Date("2000-01-01T00:00:00Z");

const archiveFiles = async (path: string) =>
  unzipSync(new Uint8Array(await readFile(path)));

export const buildBoxedWineRuntimeArchive = async ({
  outputPath = join(outputDirectory, "xp-runtime.zip"),
} = {}) => {
  const packages = {
    calculator: await archiveFiles(
      join(projectRoot, "site", "iframe", "calculator", "xp-calculator.zip"),
    ),
    solitaire: await archiveFiles(
      join(projectRoot, "site", "iframe", "solitaire", "xp-solitaire.zip"),
    ),
    freecell: await archiveFiles(
      join(projectRoot, "site", "iframe", "freecell", "xp-freecell.zip"),
    ),
    "spider-solitaire": await archiveFiles(
      join(
        projectRoot,
        "site",
        "iframe",
        "spider-solitaire",
        "xp-spider-solitaire.zip",
      ),
    ),
  };
  const files: Zippable = {};
  for (const [application, entries] of Object.entries(packages)) {
    for (const [name, bytes] of Object.entries(entries)) {
      if (name.endsWith("/") || name.endsWith("host.exe")) continue;
      files[`${application}/${name}`] = [bytes, { mtime: fixedTime }];
    }
  }
  const output = zipSync(files, { level: 9, mtime: fixedTime });
  await writeFile(outputPath, output);
  return { entries: Object.keys(files).sort(), outputBytes: output.byteLength };
};

export const buildBoxedWineRuntime = async () => {
  return await buildBoxedWineRuntimeArchive();
};

if (import.meta.main) console.log(await buildBoxedWineRuntime());
