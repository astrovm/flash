import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { decode } from "@nktkas/bmp";
import sharp from "sharp";

// Run render-logon-text.c inside the XP reference VM first. These are GDI
// glyphs from the ISO's fonts, not a host font renderer or screenshot scaling.
const input = Bun.argv[2];
if (!input)
  throw new Error(
    "Usage: bun tools/render-logon-text.ts <XP BMP output directory>",
  );
const output = "site/assets/logon-text";
const reference = "docs/reference/welcome/gdi";
await mkdir(output, { recursive: true });
await mkdir(reference, { recursive: true });
const hashes = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const labels = [
  "welcome",
  "instruction",
  "power",
  "astro",
  "logged-on",
  "loading",
  "digits",
  "program-running",
  "programs-running",
];
const records = [];
for (const name of labels) {
  const source = await readFile(join(input, `${name}-4.bmp`));
  const bitmap = decode(source);
  let left = bitmap.width,
    top = bitmap.height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < bitmap.height; y++)
    for (let x = 0; x < bitmap.width; x++) {
      if (bitmap.data[(y * bitmap.width + x) * bitmap.channels]) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  if (right < left) throw new Error(`${name}: XP rendered no text`);
  // Preserve advance widths and baseline for composable count labels.
  if (name === "digits" || name.endsWith("-running")) {
    left = 8;
    top = 0;
    bottom = 12;
    if (name === "digits") right = 77;
  }
  const width = right - left + 1,
    height = bottom - top + 1;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      rgba.fill(255, offset, offset + 3);
      rgba[offset + 3] =
        bitmap.data[((y + top) * bitmap.width + x + left) * bitmap.channels];
    }
  const png = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
  await writeFile(join(output, `${name}.png`), png);
  await sharp(bitmap.data, {
    raw: {
      width: bitmap.width,
      height: bitmap.height,
      channels: bitmap.channels,
    },
  })
    .png()
    .toFile(join(reference, `${name}.png`));
  records.push({
    name,
    left,
    top,
    width,
    height,
    bitmapSha256: hashes(source),
    pngSha256: hashes(png),
  });
}
// Word boundaries in the GDI instruction, preserving pixels for narrow layouts.
for (const [index, [left, width]] of [
  [0, 21],
  [28, 49],
  [85, 36],
  [126, 36],
  [168, 36],
  [210, 45],
].entries()) {
  await sharp(join(output, "instruction.png"))
    .extract({ left, top: 0, width, height: 18 })
    .png()
    .toFile(join(output, `instruction-${index}.png`));
}
const fonts = {} as Record<string, string>;
for (const font of ["arial.ttf", "arialbi.ttf", "tahoma.ttf", "tahomabd.ttf"])
  fonts[font] = hashes(await readFile(`site/css/fonts/${font}`));
await writeFile(
  join(reference, "provenance.json"),
  JSON.stringify(
    {
      renderer:
        "Windows XP SP3 GDI CreateFontA / TextOutA, ANTIALIASED_QUALITY",
      source: "tools/reference/render-logon-text.c",
      fonts,
      labels: records,
    },
    null,
    2,
  ) + "\n",
);
