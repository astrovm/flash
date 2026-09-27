import { expect, test } from "bun:test";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  indexIsoFiles,
  gameFilesFromIso,
} = require("../site/iframe/scummvm/iso9660.js");
const sector = 2048;
function record(name: string, extent: number, size: number, directory = false) {
  const bytes = new Uint8Array(Math.max(34, 33 + name.length));
  bytes[0] = bytes.length;
  new DataView(bytes.buffer).setUint32(2, extent, true);
  new DataView(bytes.buffer).setUint32(10, size, true);
  bytes[25] = directory ? 2 : 0;
  bytes[32] = name.length;
  bytes.set(new TextEncoder().encode(name), 33);
  return bytes;
}
function image() {
  const bytes = new Uint8Array(25 * sector),
    volume = 16 * sector;
  bytes[volume] = 1;
  bytes.set(new TextEncoder().encode("CD001"), volume + 1);
  bytes.set(record("\0", 20, sector, true), volume + 156);
  let offset = 20 * sector;
  for (const r of [
    record("\0", 20, sector, true),
    record("\u0001", 20, sector, true),
    record("DATA.ORB;1", 22, 4),
    record("SUB", 21, sector, true),
  ]) {
    bytes.set(r, offset);
    offset += r.length;
  }
  offset = 21 * sector;
  for (const r of [
    record("BACK", 20, sector, true),
    record("GAME.EXE;1", 23, 3),
    record("DATA.ORB;1", 24, 7),
  ]) {
    bytes.set(r, offset);
    offset += r.length;
  }
  bytes.set(new TextEncoder().encode("DATA"), 22 * sector);
  bytes.set(new TextEncoder().encode("EXE"), 23 * sector);
  return bytes;
}
const game = {
  title: "Fixture",
  orbFile: "DATA.ORB",
  releases: { 4: "English" },
  fileSets: [["MISSING"], ["DATA.ORB", "GAME.EXE"]],
};
test("ISO directory traversal handles nested folders, cycles, duplicate names and sector padding", async () => {
  const iso = new Blob([image()]);
  const files = await indexIsoFiles(iso);
  expect([...files.keys()]).toEqual(["DATA.ORB", "GAME.EXE"]);
  expect(files.get("DATA.ORB").extent).toBe(22);
  const result = await gameFilesFromIso(iso, game);
  expect(result.language).toBe("English");
  expect(
    result.gameFiles.map(
      (f: { name: string; size: number; offset: number }) => [
        f.name,
        f.size,
        f.offset,
      ],
    ),
  ).toEqual([
    ["DATA.ORB", 4, 22 * sector],
    ["GAME.EXE", 3, 23 * sector],
  ]);
  expect(await result.gameFiles[0].data.text()).toBe("DATA");
  expect(await result.gameFiles[1].data.text()).toBe("EXE");
});
test("ISO parsing rejects unsupported images, malformed directory entries and incomplete game file sets", async () => {
  await expect(indexIsoFiles(new Blob(["not an ISO"]))).rejects.toThrow(
    "not a supported ISO",
  );
  const corrupt = image();
  corrupt[20 * sector] = 20;
  await expect(indexIsoFiles(new Blob([corrupt]))).rejects.toThrow(
    "invalid ISO directory",
  );
  const blankRoot = image();
  blankRoot.fill(0, 16 * sector + 156, 16 * sector + 190);
  await expect(indexIsoFiles(new Blob([blankRoot]))).rejects.toThrow(
    "invalid ISO directory",
  );
  await expect(
    gameFilesFromIso(new Blob([image()]), {
      ...game,
      releases: { 9: "Other" },
    }),
  ).rejects.toThrow("was not recognized");
  await expect(
    gameFilesFromIso(new Blob([image()]), { ...game, fileSets: [["MISSING"]] }),
  ).rejects.toThrow("missing required game files");
});
