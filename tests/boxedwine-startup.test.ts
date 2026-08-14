// @ts-nocheck -- Happy DOM's element types intentionally replace lib.dom here.
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";

import { cleanupShells, flushShell, loadShell } from "./helpers/shell-harness";
import { buildBoxedWineXpFilesystem } from "../tools/build-boxedwine-xp-filesystem";

const require = createRequire(import.meta.url);
const { unzipSync, zipSync } = require("fflate");
const projectDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDirectory = join(
  projectDirectory,
  "site",
  "vendor",
  "boxedwine",
  "26R1",
);

afterEach(cleanupShells);

describe("BoxedWine startup", () => {
  test("deduplicates active downloads and releases completed data", async () => {
    const window = new Window({
      url: "https://flash.example/runner.html",
    });
    const messages = [];
    let downloads = 0;
    window.postMessage = (message) => messages.push(message);
    window.fetch = async () => {
      downloads += 1;
      return {
        ok: true,
        async arrayBuffer() {
          return new Uint8Array([1, 2, 3]).buffer;
        },
      };
    };
    const startupSource = await readFile(
      join(runtimeDirectory, "boxedwine-startup.js"),
      "utf8",
    );
    new Function("window", startupSource)(window);

    const first = window.BoxedWineStartup.load("root.zip", "root");
    const second = window.BoxedWineStartup.load("root.zip", "root");
    expect(first).toBe(second);
    expect([...(await first)]).toEqual([1, 2, 3]);
    expect(downloads).toBe(1);
    expect(messages.map(({ stage }) => stage)).toEqual([
      "runner-ready",
      "download-start",
      "download-ready",
    ]);
    expect(messages.every(({ elapsed }) => elapsed >= 0)).toBeTrue();
    expect(window.BoxedWineStartup.metrics).toEqual(messages);

    const third = window.BoxedWineStartup.load("root.zip", "root");
    expect(third).not.toBe(first);
    await third;
    expect(downloads).toBe(2);
    await window.happyDOM.close();
  });

  test("starts shared runtime preparation during the XP boot sequence", async () => {
    const shell = await loadShell();
    expect(
      shell.window.document.querySelectorAll(
        "iframe.boxedwine-shared-runtime-frame",
      ),
    ).toHaveLength(1);
    expect(shell.document.getElementById("boot-screen").hidden).toBeFalse();
  });

  test("does not block Welcome on application preparation", async () => {
    const shell = await loadShell();
    shell.window.XPBoxedWineRuntime = {
      ...shell.window.XPBoxedWineRuntime,
      applicationsReady: () => new Promise(() => {}),
    };

    shell.document.getElementById("boot-screen").click();
    await flushShell();
    expect(shell.document.getElementById("boot-screen").hidden).toBeTrue();
    expect(shell.document.getElementById("welcome-screen").hidden).toBeFalse();
    shell.document.getElementById("welcome-screen").click();
    await flushShell();
    expect(shell.document.getElementById("desktop").hidden).toBeFalse();
  });

  test("opens an installed-game deep link after the library becomes ready", async () => {
    let releaseLibrary;
    const gameLibraryManager = {
      subscribe() {
        return () => {};
      },
      initialize() {
        return new Promise((resolve) => {
          releaseLibrary = resolve;
        });
      },
      async search() {
        return [];
      },
      async details() {
        return null;
      },
      async install() {},
      async uninstall() {},
      getRecord() {
        return null;
      },
      async match() {
        return null;
      },
    };
    const shell = await loadShell({ gameLibraryManager });
    shell.window.location.hash = "#delayed-installed-game";
    shell.document.getElementById("boot-screen").click();
    shell.document.getElementById("welcome-screen").click();
    await flushShell();
    expect(
      shell.document.querySelector('[data-game="delayed-installed-game"]'),
    ).toBeNull();

    releaseLibrary({
      "delayed-installed-game": {
        ...shell.window.FLASH_GAMES["bike-mania"],
        id: "delayed-installed-game",
        title: "Delayed Installed Game",
      },
    });
    await flushShell();
    await flushShell();

    expect(
      shell.document.querySelector('[data-game="delayed-installed-game"]'),
    ).not.toBeNull();
  });

  test("waits for complete preload response bodies", async () => {
    const shell = await loadShell();
    const releases = [];
    let preloadFinished = false;
    shell.window.fetch = async (url) => {
      if (String(url).endsWith("/preload.json")) {
        return {
          ok: true,
          async json() {
            return { files: ["runtime.js", "root.zip"] };
          },
        };
      }
      return {
        ok: true,
        arrayBuffer() {
          return new Promise((resolve) => releases.push(resolve));
        },
      };
    };

    const preload = shell.window.XPBoxedWinePreload.preload().then(() => {
      preloadFinished = true;
    });
    await flushShell();
    await flushShell();

    expect(releases).toHaveLength(2);
    expect(preloadFinished).toBeFalse();
    for (const release of releases) release(new ArrayBuffer(1));
    await preload;
    expect(preloadFinished).toBeTrue();
  });

  test("rejects a preload when an asset body transfer fails", async () => {
    const shell = await loadShell();
    shell.window.fetch = async (url) => {
      if (String(url).endsWith("/preload.json")) {
        return {
          ok: true,
          async json() {
            return { files: ["runtime.js"] };
          },
        };
      }
      return {
        ok: true,
        async arrayBuffer() {
          throw new Error("transfer failed");
        },
      };
    };

    await expect(shell.window.XPBoxedWinePreload.preload()).rejects.toThrow(
      "transfer failed",
    );
  });

  test("packages only the traced shared XP files", async () => {
    const trace = JSON.parse(
      await readFile(
        join(runtimeDirectory, "xp-accessories-files.json"),
        "utf8",
      ),
    );
    const archive = unzipSync(
      new Uint8Array(
        await readFile(join(runtimeDirectory, "xp-accessories.zip")),
      ),
    );

    for (const absolutePath of trace) {
      const path = absolutePath.replace(/^\/+/, "");
      expect(
        archive[path] || archive[`${path}/`] || archive[`${path}.link`],
      ).toBeDefined();
    }
    const wineRegistry = new TextDecoder().decode(
      archive["home/username/.wine/user.reg"],
    );
    expect(wineRegistry).toContain('"ThemeActive"="1"');
    expect(wineRegistry).toContain('"ColorName"="NormalColor"');
    expect(wineRegistry).toContain(
      '"DllName"="C:\\\\windows\\\\resources\\\\themes\\\\light\\\\light.msstyles"',
    );
    expect(
      (await stat(join(runtimeDirectory, "xp-accessories.zip"))).size,
    ).toBeLessThan((await stat(join(runtimeDirectory, "boxedwine.zip"))).size);
  });

  test("does not write an archive when a traced file is missing", async () => {
    const temporaryDirectory = await mkdtemp(
      join(tmpdir(), "boxedwine-filesystem-"),
    );
    const sourcePath = join(temporaryDirectory, "source.zip");
    const tracePath = join(temporaryDirectory, "trace.json");
    const outputPath = join(temporaryDirectory, "output.zip");
    try {
      await writeFile(
        sourcePath,
        zipSync({ "present.exe": new Uint8Array([1]) }),
      );
      await writeFile(tracePath, JSON.stringify(["/missing.exe"]));

      await expect(
        buildBoxedWineXpFilesystem({ sourcePath, tracePath, outputPath }),
      ).rejects.toThrow("Missing traced BoxedWine files");
      expect(await stat(outputPath).catch((error) => error.code)).toBe(
        "ENOENT",
      );
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
