import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { gameBlobsFromIso } = require("../site/iframe/scummvm/iso9660.js") as {
  gameBlobsFromIso: (
    iso: Blob,
    game: {
      fileSets: readonly (readonly string[])[];
      orbFile: string;
      releases: Readonly<Record<string, string>>;
      title: string;
    },
  ) => Promise<{
    gameFiles: Array<{
      data: Blob;
      name: string;
      offset: number;
      size: number;
    }>;
    language: string;
  }>;
};
const offlineWorker = await Bun.file(
  new URL("../site/js/offline-worker.js", import.meta.url),
).text();

const sourceRoot = `${import.meta.dir}/../source-media/scummvm`;
const games = [
  {
    iso: "passport-to-peril-english.iso",
    language: "English",
    game: {
      title: "The Pink Panther: Passport to Peril",
      orbFile: "PPTP.ORB",
      fileSets: [["PPTP.ORB", "PPTP.EXE", "PPTP.BRO"]],
      releases: { 618203600: "English" },
    },
    files: {
      "PPTP.EXE": 594432,
      "PPTP.ORB": 618203600,
      "PPTP.BRO": 8945466,
    },
  },
  {
    iso: "Peligrosa.iso",
    language: "Spanish",
    game: {
      title: "The Pink Panther: Passport to Peril",
      orbFile: "PPTP.ORB",
      fileSets: [["PPTP.ORB", "PPTP.EXE", "PPTP.BRO"]],
      releases: { 633626567: "Spanish" },
    },
    files: {
      "PPTP.EXE": 595456,
      "PPTP.ORB": 633626567,
      "PPTP.BRO": 20,
    },
  },
  {
    iso: "hokus-pokus-pink-english.iso",
    language: "English",
    game: {
      title: "The Pink Panther: Hokus Pokus Pink",
      orbFile: "HPP.ORB",
      fileSets: [["HPP.ORB", "HPP.EXE"]],
      releases: { 503443586: "English" },
    },
    files: {
      "HPP.EXE": 697856,
      "HPP.ORB": 503443586,
    },
  },
  {
    iso: "ABRACADABRA.iso",
    language: "Spanish",
    game: {
      title: "The Pink Panther: Hokus Pokus Pink",
      orbFile: "HPP.ORB",
      fileSets: [["HPP.ORB", "HPP.EXE"]],
      releases: { 508716126: "Spanish" },
    },
    files: {
      "HPP.EXE": 699904,
      "HPP.ORB": 508716126,
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
const releaseTable = (wrapper: string) =>
  Object.fromEntries(
    [...wrapper.matchAll(/^\s+(\d+): "([^"]+)",$/gm)].map((match) => [
      match[1],
      match[2],
    ]),
  );

test("supports direct ISO sessions and optional persistent browser copies", () => {
  expect(releaseTable(passportWrapper)).toEqual({
    608976918: "Danish",
    613211963: "Dutch",
    618203600: "English",
    619145676: "British English",
    612549215: "Finnish",
    607185037: "French",
    609695309: "German",
    616292424: "Hebrew",
    622766069: "Italian",
    612644330: "Norwegian",
    644839372: "Polish",
    642216577: "Brazilian Portuguese",
    635322616: "Russian",
    634841166: "Spanish",
    633626567: "Spanish",
    633843917: "Swedish",
  });
  expect(releaseTable(pokusWrapper)).toEqual({
    509498007: "Dutch",
    509498617: "Dutch",
    503443586: "English",
    492220293: "French",
    543000636: "German",
    502988485: "Hebrew",
    504320381: "Italian",
    539274161: "Polish",
    526755539: "Brazilian Portuguese",
    526369062: "Russian",
    508716126: "Spanish",
    500103742: "Swedish",
    513518023: "Danish",
  });
  expect(passportWrapper).toContain("../../js/storage-policy.js");
  expect(pokusWrapper).toContain("../../js/storage-policy.js");
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
  expect(launcher).toContain("activateTemporaryIso(iso, gameFiles)");
  expect(launcher).toContain("await storeIso(iso, gameFiles, preparedOptions)");
  expect(launcher).toContain("chunks.push(value)");
  expect(launcher).toContain("window.fetch = (input, init)");
  expect(launcher).toContain("temporaryIso.slice(");
  expect(launcher).not.toContain("navigator.storage.estimate()");
  expect(launcher).toContain("downloaded > MAX_CD_IMAGE_SIZE");
  expect(launcher).toContain("isoSize: iso.size");
  expect(launcher).not.toContain("game.isoSize");
  expect(launcher).not.toContain("game.requiredFiles");
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
  expect(launcher).toContain("storagePolicy.errorMessage(error)");
  expect(launcher).toContain(
    "storagePolicy.requestPersistence(navigator.storage)",
  );
  expect(launcher).not.toContain('value="http');
});

test("mounts supported English and Spanish CD images", async () => {
  if (!authorizedCopiesAvailable) return;
  for (const game of games) {
    const { gameFiles, language } = await gameBlobsFromIso(
      Bun.file(`${sourceRoot}/${game.iso}`),
      game.game,
    );
    expect(language).toBe(game.language);
    expect(
      Object.fromEntries(gameFiles.map(({ data, name }) => [name, data.size])),
    ).toEqual(game.files);
    expect(gameFiles.every(({ offset }) => Number.isSafeInteger(offset))).toBe(
      true,
    );
  }
});

test("rejects a CD image for the other Pink Panther game", async () => {
  if (!authorizedCopiesAvailable) return;
  await expect(
    gameBlobsFromIso(Bun.file(`${sourceRoot}/${games[2].iso}`), games[0].game),
  ).rejects.toThrow("PPTP.ORB was not recognized");
});
