import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { gameBlobsFromIso } = require("../site/iframe/scummvm/iso9660.js") as {
  gameBlobsFromIso: (
    iso: Blob,
    requiredFiles: Record<string, number>,
    gameTitle: string,
  ) => Promise<
    Array<{ data: Blob; name: string; offset: number; size: number }>
  >;
};
const offlineWorker = await Bun.file(
  new URL("../site/js/offline-worker.js", import.meta.url),
).text();

const sourceRoot = `${import.meta.dir}/../source-media/scummvm`;
const games = [
  {
    iso: "passport-to-peril-english.iso",
    title: "The Pink Panther: Passport to Peril",
    files: {
      "PPTP.EXE": 594432,
      "PPTP.ORB": 618203600,
      "PPTP.BRO": 8945466,
    },
  },
  {
    iso: "hokus-pokus-pink-english.iso",
    title: "The Pink Panther: Hokus Pokus Pink",
    files: {
      "HPP.EXE": 697856,
      "HPP.ORB": 503443586,
    },
  },
] as const;
const authorizedCopiesAvailable = games.every(({ iso }) =>
  existsSync(`${sourceRoot}/${iso}`),
);
const launcher = await Bun.file(
  new URL("../site/iframe/scummvm/launcher.js", import.meta.url),
).text();
const passportWrapper = await Bun.file(
  new URL(
    "../site/iframe/pink-panther-passport-to-peril/index.html",
    import.meta.url,
  ),
).text();
const pokusWrapper = await Bun.file(
  new URL(
    "../site/iframe/pink-panther-hokus-pokus/index.html",
    import.meta.url,
  ),
).text();

test("supports optional verified URL downloads in persistent browser storage", () => {
  expect(passportWrapper).toContain("isoSize: 649084928");
  expect(pokusWrapper).toContain("isoSize: 526409728");
  expect(launcher).toContain('id="disc-url"');
  expect(launcher).toContain('id="download-disc"');
  expect(launcher).toContain('id="saved-copy"');
  expect(launcher.indexOf('id="disc-input"')).toBeLessThan(
    launcher.indexOf('id="disc-url"'),
  );
  expect(launcher).toContain("or download an ISO");
  expect(launcher).toContain("z-index: 2");
  expect(launcher).toContain("navigator.storage.getDirectory()");
  expect(launcher).toContain("handle.createWritable()");
  expect(launcher).toContain("response.body.getReader()");
  expect(launcher).toContain("downloaded > game.isoSize");
  expect(launcher).toContain("iso.size !== game.isoSize");
  expect(launcher).toContain("gameFilesFromIso(");
  expect(launcher).toContain("SCUMMVM_GAME_UPDATED");
  expect(launcher).toContain('event: "astro.offline-game-ready"');
  expect(launcher).toContain('id="keep-copy" type="checkbox" checked');
  expect(launcher).toContain("data/${game.id}");
  expect(launcher).toContain("--path=${gamePath}");
  expect(launcher).not.toContain("WORKERFS");
  expect(launcher).not.toContain("FS.mount");
  expect(offlineWorker).toContain(
    'const SCUMMVM_ROUTE = "/iframe/scummvm/local-games/"',
  );
  expect(offlineWorker).toContain("serveScummvmAsset(url)");
  expect(launcher).toContain("localStorage.setItem(");
  expect(launcher).toContain("directory.removeEntry(fileName)");
  expect(launcher).toContain("cross-origin browser downloads (CORS)");
  expect(launcher).not.toContain('value="http');
});

test("mounts the required English files from both authorized CD images", async () => {
  if (!authorizedCopiesAvailable) return;
  for (const game of games) {
    const blobs = await gameBlobsFromIso(
      Bun.file(`${sourceRoot}/${game.iso}`),
      game.files,
      game.title,
    );
    expect(
      Object.fromEntries(blobs.map(({ data, name }) => [name, data.size])),
    ).toEqual(game.files);
    expect(blobs.every(({ offset }) => Number.isSafeInteger(offset))).toBe(
      true,
    );
  }
});

test("rejects a CD image for the other Pink Panther game", async () => {
  if (!authorizedCopiesAvailable) return;
  await expect(
    gameBlobsFromIso(
      Bun.file(`${sourceRoot}/${games[1].iso}`),
      games[0].files,
      games[0].title,
    ),
  ).rejects.toThrow("PPTP.EXE was not found");
});
