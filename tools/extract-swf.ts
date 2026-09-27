import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

export async function extractSwf(inputPath?: string) {
  if (!inputPath) throw new Error("Usage: bun tools/extract-swf.ts <file>");
  const input = Buffer.from(await readFile(inputPath));
  if (input.length < 8) throw new Error("Probably not a Flash application");
  const header = input.subarray(0, 4).toString("binary");
  if (header !== "Joy!" && input.subarray(0, 2).toString("binary") !== "MZ")
    throw new Error("Probably not a Flash application");
  const trailer = input.subarray(-8);
  const fileSize =
    header === "Joy!" ? trailer.readUInt32BE(0) : trailer.readUInt32LE(4);
  const fileType =
    header === "Joy!" ? trailer.readUInt32BE(4) : trailer.readUInt32LE(0);
  if (fileType !== 0xfa123456)
    throw new Error("Probably not a Flash application");
  if (fileSize > input.length - 8)
    throw new Error("Flash application has an invalid embedded file size");
  const outputPath = join(
    dirname(inputPath),
    `${basename(inputPath, extname(inputPath))}.swf`,
  );
  await writeFile(outputPath, input.subarray(-(fileSize + 8), -8));
}

if (import.meta.main) await extractSwf(Bun.argv[2]);
