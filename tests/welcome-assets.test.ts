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
