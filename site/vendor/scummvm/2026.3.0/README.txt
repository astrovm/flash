ScummVM 2026.3.0 WebAssembly runtime

Upstream: https://github.com/scummvm/scummvm
Tag: v2026.3.0
Commit: fed42f2068dcafc6aafa1c28c77e4c88def74b66
Emscripten SDK: 4.0.10

The Emscripten host DATA_PATH override in configure was set to
/vendor/scummvm/2026.3.0/data. The runtime was then built with only the Pink
Panther engine:

  LDFLAGS=-lworkerfs.js ./dists/emscripten/build.sh configure make dist \
    --disable-all-engines --enable-engine=pink --disable-detection-full \
    --disable-debug --enable-release

Game data is not bundled. The launcher mounts files from a CD image selected
locally by the user.
