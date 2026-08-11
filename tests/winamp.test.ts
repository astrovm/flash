// @ts-nocheck -- Happy DOM's element types intentionally replace lib.dom here.
import { afterEach, expect, test } from "bun:test";
import {
  cleanupShells,
  flushShell,
  loadShell,
  login,
} from "./helpers/shell-harness";

afterEach(cleanupShells);

test("Winamp mounts with native 2.91 panels and plays associated audio", async () => {
  const shell = await login(await loadShell());
  shell.window.HTMLMediaElement.prototype.play = function play() {
    return Promise.resolve();
  };
  shell.window.HTMLMediaElement.prototype.pause = function pause() {};
  shell.window.HTMLMediaElement.prototype.load = function load() {};

  const song = shell.window.VirtualFS.createFile(
    shell.window.VirtualFS.MY_MUSIC,
    "Astro Theme.mp3",
    { content: "data:audio/mpeg;base64,SUQz" },
  );
  expect(shell.window.VirtualFS.open(song.id)).toBeTrue();
  await flushShell();

  const win = shell.document.querySelector<HTMLElement>(
    '.xp-window[data-game="__winamp"]',
  )!;
  expect(win).not.toBeNull();
  expect(win.style.width).toBe("275px");
  expect(win.style.height).toBe("348px");
  expect(win.querySelector("iframe")).toBeNull();
  expect(win.querySelectorAll(".winamp-panel")).toHaveLength(3);
  expect(win.querySelector(".winamp-main")).not.toBeNull();
  expect(win.querySelector(".winamp-equalizer")).not.toBeNull();
  expect(win.querySelector(".winamp-playlist")).not.toBeNull();
  expect(win.querySelector(".winamp-marquee")!.textContent).toContain(
    "ASTRO THEME",
  );

  const audio = win.querySelector<HTMLAudioElement>(".winamp-audio")!;
  win.querySelector<HTMLButtonElement>(".winamp-actions .play")!.click();
  await flushShell();
  expect(win.querySelector(".winamp-app")!.classList).toContain("playing");
  win.querySelector<HTMLButtonElement>(".winamp-actions .pause")!.click();
  expect(win.querySelector(".winamp-app")!.classList).toContain("paused");

  const volume = win.querySelector<HTMLInputElement>(".winamp-volume input")!;
  volume.value = "42";
  volume.dispatchEvent(new shell.window.Event("input", { bubbles: true }));
  expect(audio.volume).toBe(0.42);

  Object.defineProperty(audio, "duration", {
    configurable: true,
    value: 120,
  });
  const seek = win.querySelector<HTMLInputElement>(".winamp-position")!;
  seek.value = "500";
  seek.dispatchEvent(new shell.window.Event("input", { bubbles: true }));
  expect(audio.currentTime).toBe(60);

  const eqToggle = win.querySelector<HTMLButtonElement>(".winamp-eq-toggle")!;
  eqToggle.click();
  expect(
    win.querySelector<HTMLElement>(".winamp-equalizer")!.hidden,
  ).toBeTrue();
  expect(win.style.height).toBe("232px");
  eqToggle.click();
  expect(
    win.querySelector<HTMLElement>(".winamp-equalizer")!.hidden,
  ).toBeFalse();
  expect(win.style.height).toBe("348px");

  win.querySelector<HTMLButtonElement>(".winamp-shade")!.click();
  expect(win.style.height).toBe("14px");
  win.querySelector<HTMLButtonElement>(".winamp-shade")!.click();
  expect(win.style.height).toBe("348px");
});

test("Winamp loads playlists and owns each browser-supported media type", async () => {
  const shell = await login(await loadShell());
  shell.window.HTMLMediaElement.prototype.play = () => Promise.resolve();
  shell.window.HTMLMediaElement.prototype.pause = () => {};
  shell.window.HTMLMediaElement.prototype.load = () => {};
  const fs = shell.window.VirtualFS;
  const first = fs.createFile(fs.MY_MUSIC, "First.mp3", {
    content: "data:audio/mpeg;base64,SUQz",
  });
  fs.createFile(fs.MY_MUSIC, "Second.wav", {
    content: "data:audio/wav;base64,UklGRg==",
  });
  const list = fs.createFile(fs.MY_MUSIC, "Favorites.m3u", {
    content: "#EXTM3U\nFirst.mp3\nSecond.wav",
  });

  expect(fs.open(list.id)).toBeTrue();
  await flushShell();
  const win = shell.document.querySelector<HTMLElement>(
    '.xp-window[data-game="__winamp"]',
  )!;
  expect(win.querySelectorAll(".winamp-playlist li")).toHaveLength(2);
  win
    .querySelectorAll<HTMLElement>(".winamp-playlist li")[1]
    .dispatchEvent(new shell.window.MouseEvent("dblclick", { bubbles: true }));
  expect(win.querySelector(".winamp-marquee")!.textContent).toContain("SECOND");

  const supported = [
    "aac",
    "flac",
    "m4a",
    "oga",
    "ogg",
    "opus",
    "webm",
    "m3u8",
    "pls",
  ];
  for (const extension of supported) {
    const content = extension === "pls" ? "[playlist]\nFile1=First.mp3" : "";
    const file = fs.createFile(fs.MY_MUSIC, `Associated.${extension}`, {
      content,
    });
    expect(fs.open(file.id)).toBeTrue();
  }

  win.querySelector<HTMLButtonElement>(".winamp-list-options")!.click();
  const playlistMenu = win.querySelector<HTMLElement>(".winamp-playlist-menu")!;
  expect(playlistMenu.hidden).toBeFalse();
  playlistMenu.querySelector<HTMLButtonElement>("button")!.click();
  expect(win.querySelectorAll(".winamp-playlist li")).toHaveLength(0);
  expect(playlistMenu.hidden).toBeTrue();

  win.querySelector<HTMLButtonElement>(".winamp-close")!.click();
  expect(win.isConnected).toBeFalse();
  expect(fs.open(first.id)).toBeTrue();
  expect(
    shell.document.querySelector('.xp-window[data-game="__winamp"]'),
  ).not.toBeNull();
});
