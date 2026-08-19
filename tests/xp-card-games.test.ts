// @ts-nocheck -- Happy DOM's element types intentionally replace lib.dom here.
import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  cleanupShells,
  flushShell,
  loadShell,
  login,
} from "./helpers/shell-harness";

const require = createRequire(import.meta.url);
const { unzipSync } = require("fflate");
const projectDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const sha256 = (content: Uint8Array) =>
  createHash("sha256").update(content).digest("hex");

const games = [
  {
    id: "freecell",
    applicationId: "__freecell",
    title: "FreeCell",
    archive: "xp-freecell",
    executable: "freecell.exe",
    files: ["cards.dll", "freecell.exe", "resize-host.exe", "resize-host.txt"],
  },
  {
    id: "spider-solitaire",
    applicationId: "__spider-solitaire",
    title: "Spider Solitaire",
    archive: "xp-spider-solitaire",
    executable: "spider.exe",
    files: ["resize-host.exe", "resize-host.txt", "spider.exe"],
  },
];

afterEach(cleanupShells);

const launchGame = (shell, id, applicationId) => {
  shell.document.getElementById("start-button").click();
  shell.document.getElementById("all-programs-button").click();
  const flyouts = shell.document.getElementById("start-menu-flyouts");
  flyouts.querySelector('[data-program-id="games"]').click();
  flyouts.querySelector(`[data-program-id="${id}"]`).click();
  return shell.document.querySelector(
    `.xp-window[data-game="${applicationId}"]`,
  );
};

describe("Windows XP card games through BoxedWine", () => {
  for (const game of games) {
    test(`mounts ${game.title} in the boot-prepared runtime with sound and offline support`, async () => {
      const shell = await login(await loadShell());
      const gameWindow = launchGame(shell, game.id, game.applicationId);
      const frame = shell.document.querySelector(
        ".boxedwine-shared-runtime-frame",
      );
      const url = new URL(frame.src);

      expect(gameWindow.querySelector(".title-text").textContent).toBe(
        game.title,
      );
      expect(new URL(url.searchParams.get("appRoot")).pathname).toBe(
        "/iframe/boxedwine-runtime/",
      );
      expect(url.searchParams.get("archive")).toBe("xp-runtime");
      expect(url.searchParams.get("executable")).toBe(
        `${game.id}/resize-host.exe`,
      );
      expect(url.searchParams.get("persistent")).toBe("true");
      expect(url.searchParams.get("sound")).toBe("true");
      expect(
        gameWindow.querySelector(".boxedwine-shared-app-host"),
      ).not.toBeNull();
      expect(gameWindow.querySelector(".maximize-btn").disabled).toBeFalse();
      expect(gameWindow.querySelector(".resize-handle")).not.toBeNull();
      expect(shell.window.location.hash).toBe(`#${game.id}`);
      await flushShell();
      expect(shell.offlineDownloads).toEqual([game.id]);
    });

    test(`${game.title} uses the complete phone work area`, async () => {
      const shell = await login(await loadShell());
      const desktop = shell.document.getElementById("desktop");
      Object.defineProperties(desktop, {
        clientWidth: { configurable: true, value: 390 },
        clientHeight: { configurable: true, value: 814 },
      });
      const gameWindow = launchGame(shell, game.id, game.applicationId);
      expect(gameWindow.style.width).toBe("390px");
      expect(gameWindow.style.height).toBe("814px");
      expect(gameWindow.style.minWidth).toBe("0px");
      expect(gameWindow.style.minHeight).toBe("0px");

      Object.defineProperties(desktop, {
        clientWidth: { configurable: true, value: 1024 },
        clientHeight: { configurable: true, value: 738 },
      });
      shell.window.dispatchEvent(new shell.window.Event("resize"));
      expect(gameWindow.style.minWidth).not.toBe("0px");
      expect(gameWindow.style.minHeight).not.toBe("0px");
    });

    test(`${game.title} package matches its provenance manifest`, async () => {
      const directory = join(projectDirectory, "site", "iframe", game.id);
      const manifest = JSON.parse(
        await readFile(join(directory, "SOURCES.json"), "utf8"),
      );
      const packageContent = new Uint8Array(
        await readFile(join(directory, `${game.archive}.zip`)),
      );
      const files = unzipSync(packageContent);

      expect(packageContent.byteLength).toBe(manifest.windowsXp.package.bytes);
      expect(sha256(packageContent)).toBe(manifest.windowsXp.package.sha256);
      expect(Object.keys(files).sort()).toEqual(game.files);
      for (const [name, source] of Object.entries(manifest.windowsXp.files)) {
        expect(sha256(files[name])).toBe(source.sha256);
      }
    });
  }
});
