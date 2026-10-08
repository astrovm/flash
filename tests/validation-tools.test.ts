import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { validateIcons } from "../tools/validate-icons";
import { validateJavaScript } from "../tools/validate-javascript";
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
test("the icon validation command fails with each error it finds", async () => {
  const dir = await root();
  await mkdir(join(dir, "js"));
  await mkdir(join(dir, "assets/icons"), { recursive: true });
  await writeFile(
    join(dir, "js/games.js"),
    'window.FLASH_GAMES = { broken: {icon:"assets/icons/absent.png"} };',
  );
  await writeFile(join(dir, "assets/icons/SOURCES.json"), "{}");
  const result = Bun.spawnSync(
    bunCommand(
      join(import.meta.dir, "..", "tools", "validate-icons.ts"),
      `--site=${dir}`,
    ),
    { stderr: "pipe", stdout: "pipe" },
  );
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain(
    "ERROR: broken: missing assets/icons/absent.png",
  );
});
