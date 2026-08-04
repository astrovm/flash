// @ts-nocheck -- Happy DOM's element types intentionally replace lib.dom here.
import { afterEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { cleanupShells, loadShell } from "./helpers/shell-harness";

const projectDirectory = new URL("..", import.meta.url);
const file = (relativePath: string) =>
  Bun.file(new URL(relativePath, projectDirectory));
const sha256 = async (relativePath: string) =>
  new Bun.CryptoHasher("sha256")
    .update(await file(relativePath).arrayBuffer())
    .digest("hex");

afterEach(cleanupShells);

test("registers reVCDOS as a bundled iframe application", async () => {
  const shell = await loadShell();
  expect(shell.window.FLASH_GAMES.revcdos).toEqual({
    title: "reVCDOS",
    aspectRatio: 16 / 9,
    type: "iframe",
    category: "Action",
    icon: "assets/icons/revcdos.png",
  });
});

test("ships authenticated engine and torrent artifacts without game media", async () => {
  expect(await sha256("site/iframe/revcdos/index.wasm")).toBe(
    "db6aa7b9169a638e06b17f7bed5a6b3e473e00ae7bbb47354729fa94b971ebf2",
  );
  expect(await sha256("site/iframe/revcdos/revcdoseng.torrent")).toBe(
    "4e10814f38354edc27f480ac26bd8ccc80f74731bb61714775750b528344f0c9",
  );
  expect(
    await file("site/iframe/revcdos/modules/cheats.js").exists(),
  ).toBeTrue();
  expect(
    await file("node_modules/webtorrent/dist/webtorrent.min.js").exists(),
  ).toBeTrue();
  expect(await file("site/iframe/revcdos/cover.jpg").exists()).toBeFalse();
  expect(await file("site/iframe/revcdos/intro.mp4").exists()).toBeFalse();
});

test("reVCDOS presents manual, torrent, retry, and attribution controls", async () => {
  const host = new Window({ url: "http://127.0.0.1/iframe/revcdos/" });
  host.document.write(await file("site/iframe/revcdos/index.html").text());
  const manual = host.document.getElementById("file-input") as HTMLInputElement;
  const torrent = host.document.getElementById(
    "torrent-file-input",
  ) as HTMLInputElement;
  expect(manual.type).toBe("file");
  expect(manual.hasAttribute("webkitdirectory")).toBeTrue();
  expect(torrent.type).toBe("file");
  expect(host.document.getElementById("torrent-source")!.value).toBe(
    "revcdoseng.torrent",
  );
  const download = host.document.getElementById(
    "download-button",
  ) as HTMLButtonElement;
  expect(download.type).toBe("button");
  expect(download.disabled).toBeTrue();
  expect(
    host.document.querySelector<HTMLAnchorElement>(
      'a[href="https://dos.zone/revcdos/"]',
    ),
  ).not.toBeNull();

  const game = new Window({ url: "http://127.0.0.1/iframe/revcdos/game.html" });
  game.document.write(await file("site/iframe/revcdos/game.html").text());
  const startupError = game.document.getElementById("startup-error")!;
  expect(startupError.getAttribute("role")).toBe("alert");
  expect(game.document.getElementById("startup-error-retry")!.textContent).toBe(
    "Retry",
  );
  host.close();
  game.close();
});
