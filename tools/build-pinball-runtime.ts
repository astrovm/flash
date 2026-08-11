import { chmod, cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = join(projectDirectory, "native", "pinball");
const runtimeDirectory = join(
  projectDirectory,
  "site",
  "apps",
  "pinball",
  "runtime",
);
const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "astro-pinball-build-"),
);
const buildDirectory = join(temporaryDirectory, "build");
const outputDirectory = join(temporaryDirectory, "output");

const run = (command: string, args: string[]) => {
  const result = Bun.spawnSync([command, ...args], {
    cwd: projectDirectory,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0)
    throw new Error(`${command} exited with status ${result.exitCode}`);
};

try {
  run("emcmake", [
    "cmake",
    "-S",
    sourceDirectory,
    "-B",
    buildDirectory,
    "-DCMAKE_BUILD_TYPE=Release",
    `-DPINBALL_OUTPUT_DIR=${outputDirectory}`,
    "-DMUSIC_TSF=ON",
  ]);
  run("cmake", ["--build", buildDirectory, "--parallel"]);
  await Promise.all([
    cp(
      join(outputDirectory, "SpaceCadetPinball.js"),
      join(runtimeDirectory, "SpaceCadetPinball.js"),
    ),
    cp(
      join(outputDirectory, "SpaceCadetPinball.wasm"),
      join(runtimeDirectory, "SpaceCadetPinball.wasm"),
    ),
  ]);
  await Promise.all([
    chmod(join(runtimeDirectory, "SpaceCadetPinball.js"), 0o644),
    chmod(join(runtimeDirectory, "SpaceCadetPinball.wasm"), 0o644),
  ]);
  console.log("Built the first-party Pinball WebAssembly runtime.");
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
