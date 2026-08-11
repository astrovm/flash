import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDirectory = join(
  projectDirectory,
  "site",
  "apps",
  "pinball",
  "runtime",
);
const packagePath = join(runtimeDirectory, "SpaceCadetPinball.data");
const sourcesPath = join(runtimeDirectory, "SOURCES.json");
const defaultIsoPath = join(
  projectDirectory,
  "source-media",
  "en_windows_xp_professional_with_service_pack_3_x86_cd_vl_x14-73974.iso",
);
const isoArgument = Bun.argv.find((argument) => argument.startsWith("--iso="));
const isoPath = resolve(isoArgument?.slice("--iso=".length) || defaultIsoPath);
const resourcesArgument = Bun.argv.find((argument) =>
  argument.startsWith("--resources-dir="),
);
const resourcesDirectory = resourcesArgument
  ? resolve(resourcesArgument.slice("--resources-dir=".length))
  : null;
const checkOnly = Bun.argv.includes("--check");

// Emscripten's original package order is retained so rebuilding only changes
// offsets for the two non-XP demo files that were intentionally removed.
const RESOURCE_ORDER = `
SOUND29.WAV
SOUND560.WAV
SOUND30.WAV
SOUND54.WAV
SOUND12.WAV
SOUND17.WAV
SOUND27.WAV
SOUND22.WAV
SOUND104.WAV
SOUND42.WAV
SOUND112.WAV
SOUND24.WAV
SOUND49D.WAV
PINBALL.MID
SOUND3.WAV
SOUND16.WAV
SOUND43.WAV
SOUND26.WAV
SOUND20.WAV
SOUND111.WAV
SOUND8.WAV
SOUND5.WAV
SOUND58.WAV
FONT.DAT
TAHOMA.TTF
SOUND1.WAV
PINBALL2.MID
SOUND28.WAV
SOUND13.WAV
SOUND735.WAV
SOUND105.WAV
SOUND181.WAV
WAVEMIX.INF
SOUND240.WAV
SOUND9.WAV
SOUND18.WAV
SOUND21.WAV
SOUND6.WAV
SOUND45.WAV
SOUND50.WAV
SOUND999.WAV
SOUND528.WAV
SOUND243.WAV
PINBALL.DAT
SOUND53.WAV
SOUND131.WAV
SOUND19.WAV
SOUND39.WAV
SOUND35.WAV
SOUND713.WAV
SOUND38.WAV
SOUND108.WAV
SOUND55.WAV
SOUND57.WAV
SOUND7.WAV
SOUND68.WAV
SOUND136.WAV
SOUND34.WAV
SOUND827.WAV
SOUND36.WAV
SOUND25.WAV
SOUND65.WAV
SOUND563.WAV
SOUND4.WAV
SOUND14.WAV
SOUND49.WAV
`
  .trim()
  .split("\n");

const sha256 = (content: Uint8Array) =>
  createHash("sha256").update(content).digest("hex");

const run = (command: string, args: string[]) => {
  const result = Bun.spawnSync([command, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `${command} failed: ${result.stderr.toString().trim() || result.exitCode}`,
    );
  }
  return result.stdout;
};

const compressedMember = (filename: string) => {
  if (filename === "PINBALL.DAT") return "PINBALL.DA_";
  if (filename === "PINBALL.MID") return "PINBALL.MI_";
  if (filename === "PINBALL2.MID") return "PINBALL2.MI_";
  if (filename === "FONT.DAT") return "FONT.DA_";
  if (filename === "TAHOMA.TTF") return "TAHOMA.TT_";
  if (filename.endsWith(".WAV")) return `${filename.slice(0, -1)}_`;
  return filename;
};

const equal = (left: Uint8Array, right: Uint8Array) =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

const workDirectory = await mkdtemp(join(tmpdir(), "astro-pinball-assets-"));
try {
  const iso = await readFile(isoPath);
  if (resourcesDirectory) await mkdir(resourcesDirectory, { recursive: true });
  const chunks: Uint8Array[] = [];
  const sourceFiles: Record<
    string,
    { member: string; sha256: string; start: number; end: number }
  > = {};
  let offset = 0;

  for (const filename of RESOURCE_ORDER) {
    const member = compressedMember(filename);
    const compressed = run("7z", ["e", "-so", isoPath, `I386/${member}`]);
    let content = compressed;
    if (member.endsWith("_")) {
      const compressedPath = join(workDirectory, member);
      await writeFile(compressedPath, compressed);
      content = run("cabextract", ["-p", compressedPath]);
    }
    if (resourcesDirectory)
      await writeFile(join(resourcesDirectory, filename), content);
    const start = offset;
    offset += content.length;
    chunks.push(content);
    sourceFiles[filename] = {
      member: `I386/${member}`,
      sha256: sha256(content),
      start,
      end: offset,
    };
  }

  const packageBytes = new Uint8Array(offset);
  let packageOffset = 0;
  for (const chunk of chunks) {
    packageBytes.set(chunk, packageOffset);
    packageOffset += chunk.length;
  }
  const packageSha256 = sha256(packageBytes);
  const sources = `${JSON.stringify(
    {
      version: 1,
      source: {
        edition: "Windows XP Professional SP3 x86 VL (English)",
        iso: basename(isoPath),
        sha256: sha256(iso),
      },
      package: {
        path: "SpaceCadetPinball.data",
        sha256: packageSha256,
        bytes: packageBytes.length,
      },
      files: sourceFiles,
    },
    null,
    2,
  )}\n`;

  if (checkOnly) {
    const [currentPackage, currentSources] = await Promise.all([
      readFile(packagePath),
      readFile(sourcesPath, "utf8"),
    ]);
    if (!equal(currentPackage, packageBytes))
      throw new Error("Pinball package differs from the XP ISO");
    if (currentSources !== sources)
      throw new Error("Pinball provenance manifest is stale");
    console.log(
      `Verified ${RESOURCE_ORDER.length} Pinball resources from the XP ISO.`,
    );
  } else {
    await mkdir(runtimeDirectory, { recursive: true });
    await Promise.all([
      writeFile(packagePath, packageBytes),
      writeFile(sourcesPath, sources),
    ]);
    console.log(
      `Extracted ${RESOURCE_ORDER.length} Pinball resources from the XP ISO.`,
    );
  }
} finally {
  await rm(workDirectory, { recursive: true, force: true });
}
