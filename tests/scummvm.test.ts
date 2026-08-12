// @ts-nocheck -- Happy DOM's element types intentionally replace lib.dom here.
import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { Window } from "happy-dom";

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

const wrapperConfiguration = async (relativePath: string) => {
  const window = new Window({
    url: `http://127.0.0.1/${relativePath}`,
    settings: {
      disableCSSFileLoading: true,
      disableJavaScriptFileLoading: true,
      enableJavaScriptEvaluation: false,
      handleDisabledFileLoadingAsSuccess: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
    },
  });
  Object.assign(window, { Array, Object });
  const html = await Bun.file(
    new URL(`../site/${relativePath}`, import.meta.url),
  ).text();
  window.document.write(html);
  const configurationSource =
    window.document.querySelector("script:not([src])")!.textContent;
  window.document
    .querySelectorAll("script")
    .forEach((script) => script.remove());
  window.happyDOM.settings.enableJavaScriptEvaluation = true;
  const configurationScript = window.document.createElement("script");
  configurationScript.textContent = configurationSource;
  window.document.body.appendChild(configurationScript);
  const configuration = JSON.parse(JSON.stringify(window.PINK_GAME));
  window.close();
  return configuration;
};

test("Pink Panther wrappers execute their game configuration", async () => {
  const passport = await wrapperConfiguration(
    "iframe/pink-panther-passport-to-peril/index.html",
  );
  const pokus = await wrapperConfiguration(
    "iframe/pink-panther-hokus-pokus/index.html",
  );

  expect(passport.id).toBe("peril");
  expect(passport.orbFile).toBe("PPTP.ORB");
  expect(passport.fileSets).toContainEqual([
    "PPTP.ORB",
    "PPTP.EXE",
    "PPTP.BRO",
  ]);
  expect(passport.releases[618203600]).toBe("English");
  expect(passport.releases[633626567]).toBe("Spanish");

  expect(pokus.id).toBe("pokus");
  expect(pokus.orbFile).toBe("HPP.ORB");
  expect(pokus.fileSets).toContainEqual(["HPP.ORB", "HPP.EXE"]);
  expect(pokus.releases[503443586]).toBe("English");
  expect(pokus.releases[508716126]).toBe("Spanish");
});

test("maps ScummVM's fixed data path to the active release", async () => {
  const requests: string[] = [];
  const window = new Window({
    url: "http://127.0.0.1/releases/test/iframe/passport.hash/",
    settings: {
      disableCSSFileLoading: true,
      disableJavaScriptFileLoading: true,
      enableJavaScriptEvaluation: true,
      handleDisabledFileLoadingAsSuccess: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
    },
  });
  Object.assign(window, {
    Array,
    Object,
    PINK_GAME: {
      id: "peril",
      shellId: "pink-panther-passport-to-peril",
      title: "The Pink Panther: Passport to Peril",
    },
    AstroStoragePolicy: {
      errorMessage: (error: Error) => error.message,
      requestPersistence: () => Promise.resolve(),
    },
    AstroIso9660: {},
    fetch: (input: string | URL | Request) => {
      requests.push(String(input));
      return Promise.resolve(new Response("{}"));
    },
  });
  const launcher = await Bun.file(
    new URL("../site/iframe/scummvm/launcher.js", import.meta.url),
  ).text();
  const script = window.document.createElement("script");
  script.textContent = launcher;
  window.document.body.appendChild(script);

  await window.fetch(
    "/vendor/scummvm/2026.3.0/data/index.json?runtime=scummvm",
  );

  expect(requests).toEqual([
    "http://127.0.0.1/releases/test/vendor/scummvm/2026.3.0/data/index.json?runtime=scummvm",
  ]);
  window.close();
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
