# re3

re3 runs Grand Theft Auto III in the browser through a WebAssembly build of
the [hez-gta-re3](https://github.com/hezkore/hez-gta-re3) fork, the same way
reVCDOS runs Vice City: Astro Flash ships the engine, and you bring your own
game files.

## How it works

- **Setup page** (`site/iframe/re3/index.html`): pick your GTA III folder. It
  must hold `models/gta3.img`. `movies/` and `mp3/` are skipped. With **Keep
  the game data in this browser** checked, the files are packed into one OPFS
  file and served by the offline service worker, which also lets the game
  start straight away next time. Unchecked, the files stay in memory for the
  session.
- **Game page** (`game.html`, `game.js`): copies the files into the engine's
  in-memory filesystem, puts the engine's own files (`gamefiles/`) over them,
  mounts saves and `re3.ini` from IndexedDB, then starts re3.
- **Engine**: re3 with librw's OpenGL layer on WebGL 2, Emscripten's OpenAL,
  and a main loop that hands each frame to the browser. The changes to the
  fork are in `tools/re3/*.patch`, and `tools/re3/build.sh` rebuilds
  `re3.js` and `re3.wasm`.
- **Shell**: `site/js/offline-worker.js` serves any packed game (reVCDOS and
  re3) from its own store, `site/js/game-data.js` lists and removes its data
  under **Offline Games**.

## Status

- The engine loads, creates a WebGL 2 context, reads the game's data files
  and starts its startup sequence in headless Chromium.
- Not verified: playing a game. The test machine had no complete GTA III
  folder, and DOS.Zone's torrent had no peers. Loading stopped at textures
  that weren't in the partial data. Expect work on input, performance and
  memory once a full data set is available.
- Music and radio streams over 4 MiB stay out of memory, so the radio is
  silent. Sound effects load.
- Not done: the torrent download that reVCDOS has. DOS.Zone's GTA III torrent
  repacks `gta3.img` into thousands of loose files, which re3 can't read as
  they are.

## Legal

The fork has no license file and its original repository was removed after a
Take-Two DMCA notice. Grand Theft Auto III is a trademark of Take-Two
Interactive. No game data is bundled.
