# re3 runtime

- Project: https://github.com/hezkore/hez-gta-re3 (a fork of re3, the
  reverse-engineered Grand Theft Auto III engine; its original repository is
  no longer up)
- Commit: `a0d03b1a063046cc4197a031f17ff123f728f66d`
- Built: 2026-10-05, Emscripten 6.0.10, WebGL 2 through the contrib GLFW 3.4
  port, Emscripten's OpenAL, mpg123 1.32.10
- `re3.wasm` SHA-256: `f113e62e9966f8420fa35ba3c18d1e852ec03e4d612f94cbf9a69e8a0c4cc66c`
- `re3.js` SHA-256: `9b140c725f61128f8044aa31f707df0b61f09971003b9014e2d2fe775623366c`

Astro Flash's changes to the fork are in `tools/re3/re3-web.patch` and
`tools/re3/librw-web.patch`, and `tools/re3/build.sh` rebuilds the runtime.
They make CD streaming run without threads, hand each frame to the browser
(Asyncify), and move librw's OpenGL layer onto WebGL 2. The audio code runs
on Emscripten's OpenAL without the EFX reverb.

`gamefiles/` holds the fork's own files that go over the game's: the English
and other text tables, menu textures, and the extra data re3 reads. They come
from the fork's `gamefiles` folder. `gamefiles.json` lists them.

No game data is bundled. The setup page asks for the user's own Grand Theft
Auto III folder, skips `movies/` and `mp3/`, and packs the rest into a single
OPFS file (or keeps it in memory for the session). The offline service worker
serves slices of that file. At start, the game page copies everything except
music and radio streams over 4 MiB into the engine's memory filesystem; the
radio is silent because those streams stay out.

The fork has no license file. Grand Theft Auto III is a trademark of
Take-Two Interactive Software, Inc. This project is not affiliated with
Rockstar Games or Take-Two Interactive.
