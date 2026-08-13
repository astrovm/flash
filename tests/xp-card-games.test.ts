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
    executable: "resize-host.exe",
    files: ["cards.dll", "freecell.exe", "resize-host.exe"],
  },
  {
    id: "spider-solitaire",
    applicationId: "__spider-solitaire",
    title: "Spider Solitaire",
    archive: "xp-spider-solitaire",
    executable: "resize-host.exe",
    files: ["resize-host.exe", "spider.exe"],
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
    test(`launches ${game.title} with sound and offline support`, async () => {
      const shell = await login(await loadShell());
      shell.window.ASTRO_GAME_ROOTS = {
        [game.id]: `iframe/${game.id}-build-123/`,
      };

      const gameWindow = launchGame(shell, game.id, game.applicationId);
      const frame = gameWindow.querySelector(".boxedwine-app-frame");
      const url = new URL(frame.src);

      expect(gameWindow.querySelector(".title-text").textContent).toBe(
        game.title,
      );
      expect(new URL(url.searchParams.get("appRoot")).pathname).toBe(
        `/iframe/${game.id}-build-123/`,
      );
      expect(url.searchParams.get("archive")).toBe(game.archive);
      expect(url.searchParams.get("executable")).toBe(game.executable);
      expect(url.searchParams.get("frameTop")).toBe("32");
      expect(url.searchParams.get("sound")).toBe("true");
      expect(gameWindow.querySelector(".maximize-btn").disabled).toBeFalse();
      expect(gameWindow.querySelector(".resize-handle")).not.toBeNull();
      expect(shell.window.location.hash).toBe(`#${game.id}`);
      await flushShell();
      expect(shell.offlineDownloads).toEqual([game.id]);
    });

    test(`${game.title} scales its complete native surface into a phone window`, async () => {
      const shell = await login(await loadShell());
      const desktop = shell.document.getElementById("desktop");
      Object.defineProperties(desktop, {
        clientWidth: { configurable: true, value: 390 },
        clientHeight: { configurable: true, value: 814 },
      });
      let resize;
      shell.window.ResizeObserver = class ResizeObserver {
        constructor(callback) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      };

      const gameWindow = launchGame(shell, game.id, game.applicationId);
      const host = gameWindow.querySelector(".boxedwine-app-host");
      const frame = host.querySelector(".boxedwine-app-frame");
      const resizeMessages = [];
      frame.contentWindow.postMessage = (message, origin) =>
        resizeMessages.push({ message, origin });
      Object.defineProperties(host, {
        clientWidth: { configurable: true, value: 384 },
        clientHeight: { configurable: true, value: 783 },
      });

      resize();

      const nativeWidth = game.id === "freecell" ? 640 : 794;
      const nativeHeight = game.id === "freecell" ? 448 : 569;
      expect(gameWindow.style.width).toBe("390px");
      expect(gameWindow.style.height).toBe("814px");
      expect(gameWindow.style.minWidth).toBe("0px");
      expect(gameWindow.style.minHeight).toBe("0px");
      expect(frame.style.width).toBe(`${nativeWidth}px`);
      expect(frame.style.height).toBe(`${nativeHeight}px`);
      expect(frame.style.transform).toBe(`scale(${384 / nativeWidth})`);
      expect(resizeMessages.at(-1).message).toEqual({
        type: "boxedwine-framebuffer-resize",
        width: nativeWidth,
        height: nativeHeight + 32,
        baseWidth: nativeWidth,
        baseHeight: nativeHeight + 32,
      });

      Object.defineProperties(desktop, {
        clientWidth: { configurable: true, value: 1024 },
        clientHeight: { configurable: true, value: 738 },
      });
      shell.window.dispatchEvent(new shell.window.Event("resize"));
      expect(gameWindow.style.minWidth).not.toBe("0px");
      expect(gameWindow.style.minHeight).not.toBe("0px");

      gameWindow.querySelector(".maximize-btn").click();
      expect(gameWindow.classList.contains("maximized")).toBeTrue();
      Object.defineProperties(host, {
        clientWidth: { configurable: true, value: 1018 },
        clientHeight: { configurable: true, value: 707 },
      });
      resize();
      expect(frame.style.width).toBe("100%");
      expect(frame.style.height).toBe("100%");
      expect(frame.style.transform).toBe("");
      expect(resizeMessages.at(-1).message).toEqual({
        type: "boxedwine-framebuffer-resize",
        width: 1018,
        height: 739,
        baseWidth: nativeWidth,
        baseHeight: nativeHeight + 32,
      });
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
      const solitaireManifest = JSON.parse(
        await readFile(
          join(projectDirectory, "site", "iframe", "solitaire", "SOURCES.json"),
          "utf8",
        ),
      );
      expect(manifest.windowsXp.files["resize-host.exe"].sha256).toBe(
        solitaireManifest.windowsXp.files["resize-host.exe"].sha256,
      );
    });
  }
});
