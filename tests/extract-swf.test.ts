import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TOOL = join(import.meta.dir, "..", "tools", "extract-swf.ts");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

async function fixture(platform: "mac" | "windows", swf: Buffer) {
  const directory = await mkdtemp(join(tmpdir(), "astro-flash-extract-"));
  temporaryDirectories.push(directory);
  const input = join(directory, platform === "mac" ? "game.app" : "game.exe");
  const trailer = Buffer.alloc(8);
  if (platform === "mac") {
    trailer.writeUInt32BE(swf.length, 0);
    trailer.writeUInt32BE(0xfa123456, 4);
  } else {
    trailer.writeUInt32LE(0xfa123456, 0);
    trailer.writeUInt32LE(swf.length, 4);
  }
  await writeFile(
    input,
    Buffer.concat([
      Buffer.from(platform === "mac" ? "Joy!projector" : "MZprojector"),
      swf,
      trailer,
    ]),
  );
  return input;
}

describe("SWF projector extraction", () => {
  for (const platform of ["mac", "windows"] as const) {
    test(`extracts a ${platform} projector`, async () => {
      const swf = Buffer.from("FWS embedded game");
      const input = await fixture(platform, swf);
      const process = Bun.spawnSync(["bun", TOOL, input]);
      expect(process.exitCode).toBe(0);
      expect(await readFile(input.replace(/\.[^.]+$/, ".swf"))).toEqual(swf);
    });
  }

  test("rejects an impossible embedded size", async () => {
    const input = await fixture("windows", Buffer.from("FWS"));
    const content = await readFile(input);
    content.writeUInt32LE(content.length, content.length - 4);
    await writeFile(input, content);
    const process = Bun.spawnSync(["bun", TOOL, input]);
    expect(process.exitCode).not.toBe(0);
  });
});
