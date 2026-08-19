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
const appDirectory = join(projectDirectory, "site", "iframe", "solitaire");
const runtimeDirectory = join(
  projectDirectory,
  "site",
  "vendor",
  "boxedwine",
  "26R1",
);
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
  test("uses the complete phone work area when its native bounds do not fit", async () => {
    const shell = await login(await loadShell());
    const desktop = shell.document.getElementById("desktop");
    Object.defineProperties(desktop, {
      clientWidth: { configurable: true, value: 390 },
      clientHeight: { configurable: true, value: 814 },
    });

    const solitaireWindow = launchSolitaire(shell);

    expect(solitaireWindow.style.left).toBe("0px");
    expect(solitaireWindow.style.top).toBe("0px");
    expect(solitaireWindow.style.width).toBe("390px");
    expect(solitaireWindow.style.height).toBe("814px");

    Object.defineProperties(desktop, {
      clientWidth: { configurable: true, value: 844 },
      clientHeight: { configurable: true, value: 360 },
    });
    shell.window.dispatchEvent(new shell.window.Event("resize"));

    expect(solitaireWindow.style.left).toBe("0px");
    expect(solitaireWindow.style.top).toBe("0px");
    expect(solitaireWindow.style.width).toBe("844px");
    expect(solitaireWindow.style.height).toBe("360px");

    Object.defineProperties(desktop, {
      clientWidth: { configurable: true, value: 1024 },
      clientHeight: { configurable: true, value: 738 },
    });
    shell.window.dispatchEvent(new shell.window.Event("resize"));

    expect(solitaireWindow.style.width).toBe("592px");
    expect(solitaireWindow.style.height).toBe("438px");
  });

  test("regrows with the work area while its native bounds still do not fit", async () => {
    const shell = await login(await loadShell());
    const desktop = shell.document.getElementById("desktop");
    const resizeDesktop = (clientWidth, clientHeight) => {
      Object.defineProperties(desktop, {
        clientWidth: { configurable: true, value: clientWidth },
        clientHeight: { configurable: true, value: clientHeight },
      });
      shell.window.dispatchEvent(new shell.window.Event("resize"));
    };
    Object.defineProperties(desktop, {
      clientWidth: { configurable: true, value: 844 },
      clientHeight: { configurable: true, value: 360 },
    });

    const solitaireWindow = launchSolitaire(shell);
    expect(solitaireWindow.style.width).toBe("844px");
    expect(solitaireWindow.style.height).toBe("360px");

    // 592x438 still does not fit, so the window keeps filling the work area
    // instead of staying at the size measured for the smaller one.
    resizeDesktop(900, 400);

    expect(solitaireWindow.style.width).toBe("900px");
    expect(solitaireWindow.style.height).toBe("400px");
  });

  test("mounts in the boot-prepared shared runtime as a resizable XP window", async () => {
    const shell = await login(await loadShell());
    const solitaireWindow = launchSolitaire(shell);
    const frame = shell.document.querySelector(
      ".boxedwine-shared-runtime-frame",
    );
    const url = new URL(frame.src);

    expect(solitaireWindow.querySelector(".title-text").textContent).toBe(
      "Solitaire",
    );
    expect(url.pathname).toBe("/vendor/boxedwine/26R1/index.html");
    expect(new URL(url.searchParams.get("appRoot")).pathname).toBe(
      "/iframe/boxedwine-runtime/",
    );
    expect(url.searchParams.get("archive")).toBe("xp-runtime");
    expect(url.searchParams.get("executable")).toBe(
      "solitaire/resize-host.exe",
    );
    expect(url.searchParams.get("resolution")).toBe("1024x738");
    expect(url.searchParams.get("persistent")).toBe("true");
    expect(url.searchParams.get("sound")).toBe("true");
    expect(
      solitaireWindow.querySelector(".boxedwine-shared-app-host"),
    ).not.toBeNull();
    expect(solitaireWindow.querySelectorAll(".resize-handle")).toHaveLength(8);
    expect(shell.window.location.hash).toBe("#solitaire");
    await flushShell();
    expect(shell.offlineDownloads).toEqual(["solitaire"]);
  });

  test("opens Solitaire from its deep link", async () => {
    const shell = await loadShell();
    shell.window.location.hash = "#solitaire";
    await login(shell);

    expect(
      shell.document.querySelector('.xp-window[data-game="__solitaire"]'),
    ).not.toBeNull();
  });

  test("keeps the application URL at the origin root with a release base URL", async () => {
    const shell = await login(await loadShell());
    const base = shell.document.createElement("base");
    base.href = "/releases/26.08.12-abcdef1/";
    shell.document.head.prepend(base);
    shell.window.history.replaceState(null, "", "/releases/26.08.12-abcdef1/");

    launchSolitaire(shell);

    expect(shell.window.location.pathname).toBe("/");
    expect(shell.window.location.hash).toBe("#solitaire");
  });

  test("shares one runtime with Calculator while keeping separate shell windows", async () => {
    const shell = await login(await loadShell());
    const solitaireWindow = launchSolitaire(shell);
    shell.document.getElementById("start-button").click();
    shell.document.getElementById("all-programs-button").click();
    const flyouts = shell.document.getElementById("start-menu-flyouts");
    flyouts.querySelector('[data-program-id="accessories"]').click();
    flyouts.querySelector('[data-program-id="calculator"]').click();

    expect(solitaireWindow.isConnected).toBeTrue();
    expect(
      shell.document.querySelector('.xp-window[data-game="__calculator"]'),
    ).not.toBeNull();
    expect(
      shell.document.querySelectorAll(".boxedwine-shared-runtime-frame"),
    ).toHaveLength(1);
    expect(
      shell.document.querySelectorAll(".boxedwine-shared-app-host"),
    ).toHaveLength(2);
  });

  test("packages the pinned runtime and original XP files", async () => {
    const runtimeSources = JSON.parse(
      await readFile(join(runtimeDirectory, "SOURCES.json"), "utf8"),
    );
    const appSources = JSON.parse(
      await readFile(join(appDirectory, "SOURCES.json"), "utf8"),
    );

    for (const [filename, expectedHash] of Object.entries(
      runtimeSources.files,
    )) {
      const content = await readFile(join(runtimeDirectory, filename));
      expect(sha256(content), filename).toBe(expectedHash);
    }

    const packageBytes = await readFile(
      join(appDirectory, appSources.windowsXp.package.file),
    );
    expect(packageBytes.length).toBe(appSources.windowsXp.package.bytes);
    expect(sha256(packageBytes)).toBe(appSources.windowsXp.package.sha256);

    const files = unzipSync(packageBytes);
    expect(Object.keys(files).sort()).toEqual([
      "cards.dll",
      "resize-host.exe",
      "resize-host.txt",
      "sol.exe",
    ]);
    for (const [filename, source] of Object.entries(
      appSources.windowsXp.files,
    )) {
      expect(sha256(files[filename]), filename).toBe(source.sha256);
    }
  });
});
