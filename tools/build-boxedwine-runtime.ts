import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { unzipSync, zipSync, type Zippable } from "fflate";

import { boxedWineApplications } from "../site/apps/core/boxedwine-applications.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = join(
  projectRoot,
  "site",
  "iframe",
  "boxedwine-runtime",
);
const fixedTime = new Date(2000, 0, 1);

const archiveFiles = async (path: string) =>
  unzipSync(new Uint8Array(await readFile(path)));

export const buildBoxedWineRuntimeArchive = async ({
  outputPath = join(outputDirectory, "xp-runtime.zip"),
} = {}) => {
  const files: Zippable = {};
  for (const { id, packagePath } of boxedWineApplications) {
    const entries = await archiveFiles(join(projectRoot, packagePath));
    for (const [name, bytes] of Object.entries(entries)) {
      if (name.endsWith("/") || name === "window-host.exe") continue;
      files[`${id}/${name}`] = [bytes, { mtime: fixedTime }];
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
