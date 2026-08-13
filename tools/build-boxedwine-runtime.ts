import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
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

const run = (command: string, args: string[]) =>
  new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolvePromise()
        : reject(new Error(`${command} exited with status ${code}`)),
    );
  });

const archiveFiles = async (path: string) =>
  unzipSync(new Uint8Array(await readFile(path)));

export const buildBoxedWineRuntimeArchive = async ({
  runtimeHostPath = join(outputDirectory, "runtime-host.exe"),
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
  const files: Zippable = {
    "runtime-host.exe": [
      new Uint8Array(await readFile(runtimeHostPath)),
      { mtime: fixedTime },
    ],
  };
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
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "boxedwine-host-"));
  try {
    const definitionPath = join(temporaryDirectory, "kernel32.def");
    const libraryPath = join(temporaryDirectory, "kernel32.lib");
    const objectPath = join(temporaryDirectory, "runtime-host.obj");
    const executablePath = join(outputDirectory, "runtime-host.exe");
    await writeFile(
      definitionPath,
      "LIBRARY kernel32.dll\nEXPORTS\nCreateFileA@28\nReadFile@20\nWriteFile@20\nCloseHandle@4\nCreateProcessA@40\nGetLastError@0\nSleep@4\nExitProcess@4\n",
    );
    await run("llvm-dlltool-21", [
      "-m",
      "i386",
      "--kill-at",
      "--input-def",
      definitionPath,
      "--output-lib",
      libraryPath,
    ]);
    await run("clang", [
      "--target=i686-pc-windows-msvc",
      "-Oz",
      "-c",
      join(projectRoot, "native", "boxedwine", "runtime-host.c"),
      "-o",
      objectPath,
    ]);
    await run("lld-link-21", [
      "/entry:WinMainCRTStartup",
      "/subsystem:windows,5.01",
      "/nodefaultlib",
      "/machine:x86",
      "/timestamp:0",
      `/out:${executablePath}`,
      objectPath,
      libraryPath,
    ]);
    return await buildBoxedWineRuntimeArchive({
      runtimeHostPath: executablePath,
    });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
};

if (import.meta.main) console.log(await buildBoxedWineRuntime());
