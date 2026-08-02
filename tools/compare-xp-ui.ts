import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import sharp from "sharp";

const [referenceInput, implementationInput, outputInput] = Bun.argv.slice(2);
if (!referenceInput || !implementationInput || !outputInput) {
  throw new Error(
    "Usage: bun tools/compare-xp-ui.ts <xp.png> <implementation.png> <output-prefix>",
  );
}

const referencePath = resolve(referenceInput);
const implementationPath = resolve(implementationInput);
const outputPrefix = resolve(outputInput);

const reference = await sharp(referencePath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const implementation = await sharp(implementationPath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

if (
  reference.info.width !== implementation.info.width ||
  reference.info.height !== implementation.info.height
) {
  throw new Error(
    `Image dimensions differ: XP is ${reference.info.width}x${reference.info.height}, implementation is ${implementation.info.width}x${implementation.info.height}`,
  );
}

const pixelCount = reference.info.width * reference.info.height;
const diff = Buffer.alloc(pixelCount * 4);
let mismatchedPixels = 0;
let absoluteError = 0;
let squaredError = 0;

for (let pixel = 0; pixel < pixelCount; pixel++) {
  const offset = pixel * 4;
  let maximumDifference = 0;
  for (let channel = 0; channel < 3; channel++) {
    const difference = Math.abs(
      reference.data[offset + channel] - implementation.data[offset + channel],
    );
    maximumDifference = Math.max(maximumDifference, difference);
    absoluteError += difference;
    squaredError += difference * difference;
  }
  if (maximumDifference > 8) mismatchedPixels++;
  diff[offset] = maximumDifference;
  diff[offset + 1] = 0;
  diff[offset + 2] = maximumDifference;
  diff[offset + 3] = 255;
}

const channelsCompared = pixelCount * 3;
const metrics = {
  reference: referencePath,
  implementation: implementationPath,
  width: reference.info.width,
  height: reference.info.height,
  mismatchThreshold: 8,
  mismatchedPixels,
  mismatchPercent: (mismatchedPixels / pixelCount) * 100,
  meanAbsoluteError: absoluteError / channelsCompared,
  rootMeanSquareError: Math.sqrt(squaredError / channelsCompared),
};

await mkdir(dirname(outputPrefix), { recursive: true });
await sharp(diff, {
  raw: {
    width: reference.info.width,
    height: reference.info.height,
    channels: 4,
  },
})
  .png()
  .toFile(`${outputPrefix}-diff.png`);
const translucentImplementation = Buffer.from(implementation.data);
for (let offset = 3; offset < translucentImplementation.length; offset += 4) {
  translucentImplementation[offset] = 128;
}
await sharp(referencePath)
  .composite([
    {
      input: translucentImplementation,
      raw: {
        width: implementation.info.width,
        height: implementation.info.height,
        channels: 4,
      },
      blend: "over",
    },
  ])
  .png()
  .toFile(`${outputPrefix}-overlay.png`);
await writeFile(
  `${outputPrefix}-metrics.json`,
  `${JSON.stringify(metrics, null, 2)}\n`,
);
console.log(JSON.stringify(metrics, null, 2));
