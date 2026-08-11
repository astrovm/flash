import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { cleanupShells, loadShell, login } from "./helpers/shell-harness";

const projectDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDirectory = join(
  projectDirectory,
  "site",
  "apps",
  "pinball",
  "runtime",
);
const sha256 = (content: Uint8Array) =>
  createHash("sha256").update(content).digest("hex");
const click = (element: unknown) => (element as { click(): void }).click();

afterEach(cleanupShells);

describe("3D Pinball application", () => {
  test("launches as a direct first-party canvas with the XP window identity", async () => {
    const shell = await login(await loadShell());
    const openPinball = () => {
      click(shell.document.getElementById("start-button"));
      click(shell.document.getElementById("all-programs-button"));
      const flyouts = shell.document.getElementById("start-menu-flyouts")!;
      click(flyouts.querySelector('[data-program-id="games"]'));
      click(flyouts.querySelector('[data-program-id="pinball"]'));
    };

    openPinball();
    const window = shell.document.querySelector(
      '.xp-window[data-game="__pinball"]',
    )!;
    expect(window).not.toBeNull();
    expect(window.getAttribute("style")).toContain("width: 606px");
    expect(window.getAttribute("style")).toContain("height: 471px");
    expect(window.querySelector(".title-text")!.textContent).toBe(
      "3D Pinball for Windows - Space Cadet",
    );
    const canvas = window.querySelector("canvas")!;
    expect(canvas).not.toBeNull();
    expect(window.querySelector("iframe")).toBeNull();

    click(window.querySelector(".close-btn"));
    expect(window.isConnected).toBeFalse();
    openPinball();
    expect(
      shell.document.querySelector('.xp-window[data-game="__pinball"] canvas'),
    ).toBe(canvas);
  });

  test("packages only byte-authenticated resources from the XP ISO", async () => {
    const sources = JSON.parse(
      await readFile(join(runtimeDirectory, "SOURCES.json"), "utf8"),
    ) as {
      source: { sha256: string };
      package: { sha256: string; bytes: number };
      files: Record<
        string,
        { member: string; sha256: string; start: number; end: number }
      >;
    };
    const data = await readFile(
      join(runtimeDirectory, "SpaceCadetPinball.data"),
    );

    expect(sources.source.sha256).toBe(
      "fd8c8d42c1581e8767217fe800bfc0d5649c0ad20d754c927d6c763e446d1927",
    );
    expect(data.length).toBe(sources.package.bytes);
    expect(sha256(data)).toBe(sources.package.sha256);
    expect(Object.keys(sources.files)).toContain("PINBALL.DAT");
    expect(Object.keys(sources.files)).toContain("TAHOMA.TTF");
    for (const [filename, source] of Object.entries(sources.files)) {
      expect(source.member, filename).toMatch(/^I386\/[A-Z0-9]+\.[A-Z0-9_]+$/);
      expect(sha256(data.subarray(source.start, source.end)), filename).toBe(
        source.sha256,
      );
    }
  });
});
