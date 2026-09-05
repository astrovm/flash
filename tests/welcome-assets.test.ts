import { expect, test } from "bun:test";
import sharp from "sharp";

test.each([
  { asset: "logon/Glow.png", x: 0, y: 80 },
  { asset: "WindowsWordmark.png", x: 353, y: 312 },
])(
  "original $asset matches its pixels in the XP selection capture",
  async ({ asset, x, y }) => {
    const original = await sharp(`site/assets/xp/${asset}`)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const reference = await sharp(
      "docs/reference/welcome/xp-selection-1024x768.png",
    )
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([reference.info.width, reference.info.height]).toEqual([1024, 768]);
    let differences = 0;
    for (let row = 0; row < original.info.height; row++)
      for (let column = 0; column < original.info.width; column++) {
        const a = (row * original.info.width + column) * 3;
        const b = ((row + y) * reference.info.width + column + x) * 3;
        for (let channel = 0; channel < 3; channel++)
          if (original.data[a + channel] !== reference.data[b + channel])
            differences++;
      }
    expect(differences).toBe(0);
  },
);

test("logon labels preserve XP GDI glyph coverage and authenticated font inputs", async () => {
  const { createHash } = await import("node:crypto");
  const provenance = (await Bun.file(
    "docs/reference/welcome/gdi/provenance.json",
  ).json()) as {
    fonts: Record<string, string>;
    labels: Array<{
      name: string;
      left: number;
      top: number;
      width: number;
      height: number;
    }>;
  };
  for (const [font, hash] of Object.entries(provenance.fonts)) {
    const bytes = await Bun.file(`site/css/fonts/${font}`).bytes();
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(hash);
  }
  for (const label of provenance.labels) {
    const source = await sharp(`docs/reference/welcome/gdi/${label.name}.png`)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const mask = await sharp(`site/assets/logon-text/${label.name}.png`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([mask.info.width, mask.info.height]).toEqual([
      label.width,
      label.height,
    ]);
    let mismatches = 0;
    for (let y = 0; y < label.height; y++)
      for (let x = 0; x < label.width; x++) {
        if (
          mask.data[(y * label.width + x) * 4 + 3] !==
          source.data[
            ((y + label.top) * source.info.width + x + label.left) * 3
          ]
        )
          mismatches++;
      }
    expect(mismatches, label.name).toBe(0);
  }
});

test("GDI instruction reproduces the native XP selection label", async () => {
  const mask = await sharp("site/assets/logon-text/instruction.png")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const capture = await sharp(
    "docs/reference/welcome/xp-selection-1024x768.png",
  )
    .extract({ left: 211, top: 422, width: 255, height: 18 })
    .removeAlpha()
    .raw()
    .toBuffer();
  const foreground = [239, 247, 255],
    background = [90, 126, 220];
  let maxError = 0;
  for (let i = 0; i < 255 * 18; i++)
    for (let c = 0; c < 3; c++) {
      const alpha = mask.data[i * 4 + 3] / 255;
      const expected = Math.round(
        background[c] + (foreground[c] - background[c]) * alpha,
      );
      maxError = Math.max(maxError, Math.abs(expected - capture[i * 3 + c]));
    }
  // GDI and CSS integer alpha blending differ by at most one RGB level.
  expect(maxError).toBeLessThanOrEqual(1);
});

test("composed program count preserves the native XP status glyphs", async () => {
  const digit = await sharp("site/assets/logon-text/digits.png")
    .extract({ left: 7, top: 0, width: 7, height: 13 })
    .ensureAlpha()
    .raw()
    .toBuffer();
  const suffix = await sharp("site/assets/logon-text/program-running.png")
    .ensureAlpha()
    .raw()
    .toBuffer();
  const capture = await sharp(
    "docs/reference/welcome/xp-program-count-1024x768.png",
  )
    .extract({ left: 610, top: 366, width: 107, height: 13 })
    .removeAlpha()
    .raw()
    .toBuffer();
  let differences = 0;
  for (let y = 0; y < 13; y++)
    for (let x = 0; x < 107; x++) {
      const alpha =
        x < 7 ? digit[(y * 7 + x) * 4 + 3] : suffix[(y * 100 + x - 7) * 4 + 3];
      if (alpha > 128 !== capture[(y * 107 + x) * 3] > 180) differences++;
    }
  expect(differences).toBe(0);
});
