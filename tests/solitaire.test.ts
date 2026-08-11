// @ts-nocheck -- Happy DOM's element types intentionally replace lib.dom here.
import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { cleanupShells, loadShell, login } from "./helpers/shell-harness";

const require = createRequire(import.meta.url);
const { unzipSync } = require("fflate");
const projectDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDirectory = join(projectDirectory, "site", "iframe", "solitaire");
const sha256 = (content: Uint8Array) =>
  createHash("sha256").update(content).digest("hex");

afterEach(cleanupShells);

const launchSolitaire = (shell) => {
  shell.document.getElementById("start-button").click();
  shell.document.getElementById("all-programs-button").click();
  const flyouts = shell.document.getElementById("start-menu-flyouts");
  flyouts.querySelector('[data-program-id="games"]').click();
  flyouts.querySelector('[data-program-id="solitaire"]').click();
  return shell.document.querySelector('.xp-window[data-game="__solitaire"]');
};

describe("Windows XP Solitaire through BoxedWine", () => {
  test("launches the native executable in a resizable XP shell window", async () => {
    const shell = await login(await loadShell());
    shell.window.ASTRO_GAME_ROOTS = {
      solitaire: "iframe/solitaire-build-123/",
    };

    const solitaireWindow = launchSolitaire(shell);
    const frame = solitaireWindow.querySelector(".boxedwine-solitaire-frame");
    const url = new URL(frame.src);

    expect(solitaireWindow.style.width).toBe("592px");
    expect(solitaireWindow.style.height).toBe("438px");
    expect(solitaireWindow.querySelector(".title-text").textContent).toBe(
      "Solitaire",
    );
    expect(url.pathname).toBe("/iframe/solitaire-build-123/index.html");
    expect(url.searchParams.get("root")).toBe("boxedwine");
    expect(url.searchParams.get("app")).toBe("xp-solitaire");
    expect(url.searchParams.get("p")).toBe("sol.exe");
    expect(url.searchParams.has("env")).toBeFalse();
    expect(url.searchParams.get("sound")).toBe("false");
    expect(solitaireWindow.querySelectorAll(".resize-handle")).toHaveLength(8);
    const maximize = solitaireWindow.querySelector(".maximize-btn");
    expect(maximize.disabled).toBeFalse();
    maximize.click();
    expect(solitaireWindow.classList.contains("maximized")).toBeTrue();
    expect(maximize.title).toBe("Restore");
    maximize.click();
    expect(solitaireWindow.classList.contains("maximized")).toBeFalse();
    expect(maximize.title).toBe("Maximize");
  });

  test("stops the emulator when its window closes", async () => {
    const shell = await login(await loadShell());
    const solitaireWindow = launchSolitaire(shell);
    const frame = solitaireWindow.querySelector(".boxedwine-solitaire-frame");

    solitaireWindow.querySelector(".close-btn").click();

    expect(solitaireWindow.isConnected).toBeFalse();
    expect(frame.isConnected).toBeFalse();
    expect(frame.src).toBe("about:blank");
  });

  test("scales and centers the emulator viewport after a window resize", async () => {
    const shell = await login(await loadShell());
    let resize;
    let observed;
    let disconnected = false;
    shell.window.ResizeObserver = class ResizeObserver {
      constructor(callback) {
        resize = callback;
      }
      observe(target) {
        observed = target;
      }
      disconnect() {
        disconnected = true;
      }
    };

    const solitaireWindow = launchSolitaire(shell);
    const host = solitaireWindow.querySelector(".boxedwine-solitaire-host");
    const frame = host.querySelector(".boxedwine-solitaire-frame");
    Object.defineProperties(host, {
      clientWidth: { configurable: true, value: 1372 },
      clientHeight: { configurable: true, value: 812 },
    });

    resize();

    expect(observed).toBe(host);
    expect(frame.style.getPropertyValue("--solitaire-scale")).toBe("2");
    expect(frame.style.getPropertyValue("--solitaire-left")).toBe("100px");
    expect(frame.style.getPropertyValue("--solitaire-top")).toBe("0px");

    solitaireWindow.querySelector(".close-btn").click();
    expect(disconnected).toBeTrue();
  });

  test("packages the pinned runtime and only the two required XP files", async () => {
    const sources = JSON.parse(
      await readFile(join(runtimeDirectory, "SOURCES.json"), "utf8"),
    );

    for (const [filename, expectedHash] of Object.entries(
      sources.boxedWine.files,
    )) {
      const content = await readFile(join(runtimeDirectory, filename));
      expect(sha256(content), filename).toBe(expectedHash);
    }

    const packageBytes = await readFile(
      join(runtimeDirectory, sources.windowsXp.package.file),
    );
    expect(packageBytes.length).toBe(sources.windowsXp.package.bytes);
    expect(sha256(packageBytes)).toBe(sources.windowsXp.package.sha256);

    const files = unzipSync(packageBytes);
    expect(Object.keys(files).sort()).toEqual(["cards.dll", "sol.exe"]);
    for (const [filename, source] of Object.entries(sources.windowsXp.files)) {
      expect(sha256(files[filename]), filename).toBe(source.sha256);
    }
  });
});
