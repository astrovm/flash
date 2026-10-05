// @ts-nocheck -- Happy DOM's element types intentionally replace lib.dom here.
import { afterEach, describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { Window } from "happy-dom";
import { cleanupShells, loadShell } from "./helpers/shell-harness";

const projectDirectory = new URL("..", import.meta.url);
const file = (relativePath: string) =>
  Bun.file(new URL(relativePath, projectDirectory));

afterEach(cleanupShells);

describe("re3", () => {
  test("registers as a bundled iframe application", async () => {
    const shell = await loadShell();
    expect(shell.window.FLASH_GAMES.re3).toEqual({
      title: "re3",
      aspectRatio: 16 / 9,
      type: "iframe",
      category: "Action",
      icon: "assets/icons/re3.png",
    });
  });

  test("ships the engine and its own files, but no game media", async () => {
    const wasm = new Uint8Array(
      await file("site/iframe/re3/re3.wasm").arrayBuffer(),
    );
    expect([...wasm.slice(0, 4)]).toEqual([0x00, 0x61, 0x73, 0x6d]);
    // SOURCE.md records the build's hash.
    const hash = new Bun.CryptoHasher("sha256").update(wasm).digest("hex");
    expect(await file("site/iframe/re3/SOURCE.md").text()).toContain(hash);
    expect(await file("site/iframe/re3/re3.js").text()).toContain(
      "createRe3Module",
    );
    // gamefiles.json lists every file under gamefiles/, which are re3's own.
    const listed = await file("site/iframe/re3/gamefiles.json").json();
    const found = [];
    const walk = async (directory, prefix = "") => {
      for (const entry of await readdir(new URL(directory, projectDirectory), {
        withFileTypes: true,
      })) {
        if (entry.isDirectory())
          await walk(`${directory}${entry.name}/`, `${prefix}${entry.name}/`);
        else found.push(`${prefix}${entry.name}`);
      }
    };
    await walk("site/iframe/re3/gamefiles/");
    expect(listed).toEqual(found.sort());
    expect(listed).toContain("neo/neo.txd");
    expect(
      listed.some((path) => /gta3\.img|\.wav|\.mp3|\.mpg/i.test(path)),
    ).toBeFalse();
    for (const path of ["models/gta3.img", "audio/sfx.raw", "data/gta3.dat"])
      expect(await file(`site/iframe/re3/${path}`).exists()).toBeFalse();
  });

  test("asks for the user's own folder, and the game page shows progress", async () => {
    const host = new Window({ url: "http://127.0.0.1/iframe/re3/" });
    host.document.write(await file("site/iframe/re3/index.html").text());
    const folder = host.document.getElementById("file-input");
    expect(folder.type).toBe("file");
    expect(folder.hasAttribute("webkitdirectory")).toBeTrue();
    expect(host.document.getElementById("keep-copy").checked).toBeTrue();
    expect(host.document.body.textContent).toContain(
      "Select the folder of your own copy of",
    );
    expect(
      host.document.querySelector(
        'a[href="https://github.com/hezkore/hez-gta-re3"]',
      ),
    ).not.toBeNull();

    const game = new Window({ url: "http://127.0.0.1/iframe/re3/game.html" });
    game.document.write(await file("site/iframe/re3/game.html").text());
    expect(
      game.document.getElementById("canvas").getAttribute("tabindex"),
    ).toBe("0");
    expect(
      game.document.getElementById("progress").hasAttribute("hidden"),
    ).toBeTrue();
    expect(game.document.getElementById("status").getAttribute("role")).toBe(
      "status",
    );
    host.close();
    game.close();
  });
});
