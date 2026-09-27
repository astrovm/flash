import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { zipSync, unzipSync } from "fflate";
import { validateIcons } from "../tools/validate-icons";
import { validateJavaScript } from "../tools/validate-javascript";
import { buildBoxedWineXpFilesystem } from "../tools/build-boxedwine-xp-filesystem";
import { bunCommand } from "./helpers/coverage";
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((p) => rm(p, { recursive: true, force: true })),
  );
});
async function root() {
  const p = await mkdtemp(join(tmpdir(), "flash-validation-"));
  roots.push(p);
  return p;
}
test("icon validation verifies PNG payloads, source metadata, hashes and contained paths", async () => {
  const dir = await root();
  await mkdir(join(dir, "js"));
  await mkdir(join(dir, "assets/icons"), { recursive: true });
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  await writeFile(join(dir, "assets/icons/good.png"), png);
  await writeFile(join(dir, "assets/icons/bad.png"), "not png");
  const source = {
    file: "good.png",
    sha256: createHash("sha256").update(png).digest("hex"),
    source: "https://example.com/icon",
    retrieved: "2026-09-26",
  };
  await writeFile(
    join(dir, "js/games.js"),
    'window.FLASH_GAMES = { good: {icon:"assets/icons/good.png"}, fallback:{} };',
  );
  await writeFile(
    join(dir, "assets/icons/SOURCES.json"),
    JSON.stringify({ good: source }),
  );
  expect(validateIcons(dir)).toEqual({
    errors: [],
    missing: ["fallback"],
    validated: 1,
  });
  expect(validateIcons(dir, true).errors).toEqual(["missing icons: fallback"]);
  await writeFile(
    join(dir, "js/games.js"),
    'window.FLASH_GAMES = { escape: {icon:"../outside.png"}, missing:{icon:"absent.png"}, bad:{icon:"assets/icons/bad.png"}, metadata:{icon:"assets/icons/good.png"} };',
  );
  await writeFile(
    join(dir, "assets/icons/SOURCES.json"),
    JSON.stringify({
      metadata: { file: "wrong", sha256: "wrong" },
      orphan: source,
    }),
  );
  const errors = validateIcons(dir).errors.join("\n");
  for (const message of [
    "escapes site/",
    "missing absent.png",
    "not a valid PNG",
    "missing SOURCES.json",
    "source file does not match",
    "SHA-256 does not match",
    "source URL and retrieval date",
    "no matching game",
  ])
    expect(errors).toContain(message);
});
test("JavaScript validation scans nested sources and rejects syntax errors", async () => {
  const dir = await root();
  await mkdir(join(dir, "nested"));
  await writeFile(join(dir, "ok.js"), "const answer = 42;");
  await writeFile(join(dir, "nested/module.js"), "export const value = 1;");
  expect(await validateJavaScript(dir)).toBe(2);
  await writeFile(join(dir, "nested/bad.js"), "const = ;");
  await expect(validateJavaScript(dir)).rejects.toThrow();
});
test("XP filesystem builder follows symlinks, installs the theme and creates a reproducible archive", async () => {
  const dir = await root(),
    sourcePath = join(dir, "source.zip"),
    tracePath = join(dir, "trace.json"),
    themePath = join(dir, "luna"),
    outputPath = join(dir, "output.zip");
  const text = (s: string) => new TextEncoder().encode(s);
  const files = {
    "bin/": new Uint8Array(),
    "bin/app": new Uint8Array([0x7f, 0x45, 0x4c, 0x46]),
    "outside/": new Uint8Array(),
    "outside/data": text("data"),
    "bin/relative.link": text("../outside/data"),
    "bin/absolute.link": text("/outside/data"),
    "bin/broken.link": text("/absent"),
    "unused/file": text("unused"),
    readme: text("root"),
    "home/username/.wine/user.reg": text('"ColorName"="Blue"'),
    "home/username/.wine/drive_c/windows/resources/themes/light/light.msstyles":
      text("old"),
  };
  await writeFile(sourcePath, zipSync(files));
  await writeFile(
    tracePath,
    JSON.stringify(["/", "/bin", "/bin/app", "/bin/relative", "/bin/absolute"]),
  );
  await writeFile(themePath, "LUNA");
  const options = { sourcePath, tracePath, themePath, outputPath };
  const result = await buildBoxedWineXpFilesystem(options),
    bytes = await readFile(outputPath),
    archive = unzipSync(bytes);
  expect(result.missing).toEqual([]);
  expect(result.includedEntries).toBe(10);
  expect(new TextDecoder().decode(archive["outside/data"])).toBe("data");
  expect(
    new TextDecoder().decode(archive["home/username/.wine/user.reg"]),
  ).toContain('"NormalColor"');
  expect(archive["unused/file"]).toBeUndefined();
  expect(
    new TextDecoder().decode(
      archive[
        "home/username/.wine/drive_c/windows/resources/themes/light/light.msstyles"
      ],
    ),
  ).toBe("LUNA");
  expect((await buildBoxedWineXpFilesystem(options)).outputSha256).toBe(
    result.outputSha256,
  );
  await writeFile(tracePath, JSON.stringify(["/missing"]));
  await expect(buildBoxedWineXpFilesystem(options)).rejects.toThrow(
    "Missing traced",
  );
  await writeFile(tracePath, "[]");
  files["home/username/.wine/user.reg"] = text('"ColorName"="Other"');
  await writeFile(sourcePath, zipSync(files));
  await expect(buildBoxedWineXpFilesystem(options)).rejects.toThrow(
    "Blue color scheme was not found",
  );
});

test("icon validation treats a catalog without games as empty", async () => {
  const dir = await root();
  await mkdir(join(dir, "js"));
  await mkdir(join(dir, "assets/icons"), { recursive: true });
  await writeFile(join(dir, "js/games.js"), "window.OTHER = {};");
  await writeFile(join(dir, "assets/icons/SOURCES.json"), "{}");
  expect(validateIcons(dir)).toEqual({ errors: [], missing: [], validated: 0 });
});
test("validation command lines check the real site", () => {
  for (const [tool, output] of [
    ["validate-icons.ts", "sourced icons"],
    ["validate-javascript.ts", "browser JavaScript files"],
  ]) {
    const result = Bun.spawnSync(
      bunCommand(join(import.meta.dir, "..", "tools", tool)),
      { stderr: "pipe", stdout: "pipe" },
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain(output);
  }
  expect(validateIcons().errors).toEqual([]);
});
