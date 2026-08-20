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
const wordPadDirectory = join(projectDirectory, "site", "iframe", "wordpad");
const sha256 = (content: Uint8Array) =>
  createHash("sha256").update(content).digest("hex");

afterEach(cleanupShells);

const launchWordPad = (shell) => {
  shell.document.getElementById("start-button").click();
  shell.document.getElementById("all-programs-button").click();
  const flyouts = shell.document.getElementById("start-menu-flyouts");
  flyouts.querySelector('[data-program-id="accessories"]').click();
  flyouts.querySelector('[data-program-id="wordpad"]').click();
  return shell.document.querySelector('.xp-window[data-game="__wordpad"]');
};

describe("Windows XP WordPad through BoxedWine", () => {
  test("launches from Accessories in the shared offline runtime", async () => {
    const shell = await login(await loadShell());
    const wordPad = launchWordPad(shell);
    const frame = shell.document.querySelector(
      ".boxedwine-shared-runtime-frame",
    );
    const url = new URL(frame.src);

    expect(wordPad.querySelector(".title-text").textContent).toBe("WordPad");
    expect(url.searchParams.get("archive")).toBe("xp-runtime");
    expect(url.searchParams.get("executable")).toBe("wordpad/wordpad.exe");
    expect(url.searchParams.get("persistent")).toBe("true");
    expect(wordPad.querySelector(".boxedwine-shared-app-host")).not.toBeNull();
    expect(
      shell.document.querySelectorAll(".boxedwine-shared-runtime-frame"),
    ).toHaveLength(1);
    expect(shell.window.location.hash).toBe("#wordpad");
    await flushShell();
    expect(shell.offlineDownloads).toEqual(["wordpad"]);
  });

  test("package matches its XP source manifest", async () => {
    const manifest = JSON.parse(
      await readFile(join(wordPadDirectory, "SOURCES.json"), "utf8"),
    );
    const packageContent = new Uint8Array(
      await readFile(join(wordPadDirectory, "xp-wordpad.zip")),
    );
    const files = unzipSync(packageContent);

    expect(packageContent.byteLength).toBe(manifest.windowsXp.package.bytes);
    expect(sha256(packageContent)).toBe(manifest.windowsXp.package.sha256);
    expect(Object.keys(files).sort()).toEqual([
      "mfc42u.dll",
      "wordpad.exe",
      "wordpad.hlp",
    ]);
    for (const [name, source] of Object.entries(manifest.windowsXp.files)) {
      expect(sha256(files[name])).toBe(source.sha256);
    }
  });
});
