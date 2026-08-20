import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { zipSync, type Zippable } from "fflate";

import { boxedWineApplications } from "../site/apps/core/boxedwine-applications.js";

type SourceFile = { member: string; sha256: string };
type Sources = {
  windowsXp: {
    sourceSha256: string;
    package: { file: string; bytes: number; sha256: string };
    files: Record<string, SourceFile>;
  };
};

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isoArgument = Bun.argv.indexOf("--iso");
const sourceIso =
  isoArgument >= 0 && Bun.argv[isoArgument + 1]
    ? resolve(Bun.argv[isoArgument + 1])
    : join(
        projectRoot,
        "source-media",
        "en_windows_xp_professional_with_service_pack_3_x86_cd_vl_x14-73974.iso",
      );
const fixedTime = new Date(2000, 0, 1);
const checkOnly = Bun.argv.includes("--check");

const sha256 = (content: Uint8Array) =>
  createHash("sha256").update(content).digest("hex");

const sha256File = (path: string) =>
  new Promise<string>((resolveHash, reject) => {
    const hash = createHash("sha256");
    const input = createReadStream(path);
    input.on("data", (chunk) => hash.update(chunk));
    input.on("error", reject);
    input.on("end", () => resolveHash(hash.digest("hex")));
  });

const run = (command: string, args: string[], input?: Uint8Array) => {
  const result = Bun.spawnSync([command, ...args], {
    stdin: input,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    const details = result.stderr.toString().trim();
    throw new Error(`${command} failed${details ? `: ${details}` : ""}`);
  }
  return new Uint8Array(result.stdout);
};

const verify = (
  actual: string | number,
  expected: string | number,
  label: string,
) => {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
};

const expand = async (
  member: string,
  workDirectory: string,
): Promise<Uint8Array> => {
  const compressed = run("7z", ["e", "-so", sourceIso, member]);
  const compressedPath = join(workDirectory, basename(member));
  await writeFile(compressedPath, compressed);
  return run("cabextract", ["-p", compressedPath]);
};

export const buildBoxedWineApplicationPackages = async () => {
  const isoHash = await sha256File(sourceIso);
  const workDirectory = await mkdtemp(join(tmpdir(), "boxedwine-apps-"));
  const results: Array<{ id: string; bytes: number; sha256: string }> = [];

  try {
    for (const application of boxedWineApplications) {
      const packagePath = join(projectRoot, application.packagePath);
      const sourcesPath = join(dirname(packagePath), "SOURCES.json");
      const sources = JSON.parse(
        await readFile(sourcesPath, "utf8"),
      ) as Sources;
      const definition = sources.windowsXp;
      verify(isoHash, definition.sourceSha256, "Windows XP ISO hash");
      verify(
        basename(packagePath),
        definition.package.file,
        `${application.id} package filename`,
      );

      const files: Zippable = {};
      for (const [name, source] of Object.entries(definition.files)) {
        const content = await expand(source.member, workDirectory);
        verify(sha256(content), source.sha256, `${application.id}/${name}`);
        files[name] = [content, { mtime: fixedTime }];
      }
      const archive = zipSync(files, { level: 9, mtime: fixedTime });
      verify(
        archive.byteLength,
        definition.package.bytes,
        `${application.id} package bytes`,
      );
      verify(
        sha256(archive),
        definition.package.sha256,
        `${application.id} package hash`,
      );

      if (checkOnly) {
        const committed = new Uint8Array(await readFile(packagePath));
        verify(
          sha256(committed),
          definition.package.sha256,
          `${application.id} committed package hash`,
        );
      } else {
        await writeFile(packagePath, archive);
      }
      results.push({
        id: application.id,
        bytes: archive.byteLength,
        sha256: definition.package.sha256,
      });
    }
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }

  return results;
};

if (import.meta.main) {
  console.log(await buildBoxedWineApplicationPackages());
}
