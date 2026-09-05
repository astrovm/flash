import { expect, test } from "bun:test";
import sharp from "sharp";

test("boot fade starts black and ends at the original framebuffer", async () => {
  const fade = sharp("site/assets/xp/BootFade.png");
  const metadata = await fade.metadata();
  expect([metadata.width, metadata.height]).toEqual([640, 480 * 20]);
  const first = await fade
    .clone()
    .extract({ left: 0, top: 0, width: 640, height: 480 })
    .removeAlpha()
    .raw()
    .toBuffer();
  expect(first.every((channel) => channel === 0)).toBeTrue();
  const last = await fade
    .clone()
    .extract({ left: 0, top: 480 * 19, width: 640, height: 480 })
    .removeAlpha()
    .raw()
    .toBuffer();
  const original = await sharp("site/assets/xp/BootScreen.png")
    .removeAlpha()
    .raw()
    .toBuffer();
  expect(last.equals(original)).toBeTrue();
});

test.each(["xp-sp3-boot.png", "xp-sp3-boot-from-1280.png"])(
  "extracted boot framebuffer matches %s outside the progress sprite",
  async (referenceName) => {
    const read = (path: string) =>
      sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const [actual, reference] = await Promise.all([
      read("site/assets/xp/BootScreen.png"),
      read(`docs/reference/boot/${referenceName}`),
    ]);
    expect([actual.info.width, actual.info.height]).toEqual([640, 480]);
    expect(actual.info).toEqual(reference.info);
    let mismatches = 0;
    for (let y = 0; y < 480; y++) {
      for (let x = 0; x < 640; x++) {
        if (x >= 259 && x < 377 && y >= 354 && y < 363) continue;
        const offset = (y * 640 + x) * 3;
        for (let channel = 0; channel < 3; channel++) {
          if (
            actual.data[offset + channel] !== reference.data[offset + channel]
          ) {
            mismatches++;
            break;
          }
        }
      }
    }
    expect(mismatches).toBe(0);
  },
);
