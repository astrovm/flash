#!/usr/bin/env bash
# Builds site/iframe/re3/re3.{js,wasm} from the hez-gta-re3 fork.
# Needs Emscripten (emcmake on PATH), CMake and Ninja. Run from anywhere:
#   tools/re3/build.sh [work-directory]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
WORK="${1:-$HOME/src/re3-web-build}"
RE3_COMMIT="a0d03b1a063046cc4197a031f17ff123f728f66d"
MPG123_VERSION="1.32.10"

mkdir -p "$WORK"
cd "$WORK"

if [[ ! -d re3 ]]; then
  git clone https://github.com/hezkore/hez-gta-re3.git re3
fi
cd re3
git fetch -q origin
git checkout -q "$RE3_COMMIT"
git submodule update --init --recursive
git apply --check "$HERE/re3-web.patch" 2>/dev/null && git apply "$HERE/re3-web.patch"
(cd vendor/librw && git apply --check "$HERE/librw-web.patch" 2>/dev/null && git apply "$HERE/librw-web.patch")
cd "$WORK"

# mpg123 decodes the game's MP3 sound banks.
if [[ ! -f prefix/lib/libmpg123.a ]]; then
  curl -sL "https://www.mpg123.de/download/mpg123-$MPG123_VERSION.tar.bz2" | tar xj
  emcmake cmake -S "mpg123-$MPG123_VERSION/ports/cmake" -B mpg123-build -G Ninja \
    -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DBUILD_PROGRAMS=OFF \
    -DBUILD_LIBOUT123=OFF -DNO_MOREINFO=ON -DCPU=generic_fpu \
    -DCMAKE_INSTALL_PREFIX="$WORK/prefix"
  cmake --build mpg123-build
  cmake --install mpg123-build
fi

SYSROOT="$(em-config CACHE)/sysroot"
emcmake cmake -S re3 -B build -G Ninja -DCMAKE_BUILD_TYPE=Release \
  -DLIBRW_PLATFORM=GL3 -DLIBRW_GL3_GFXLIB=GLFW \
  -DCMAKE_PREFIX_PATH="$WORK/prefix" -DCMAKE_FIND_ROOT_PATH="$WORK/prefix" \
  -DOPENAL_INCLUDE_DIR="$SYSROOT/include" -DOPENAL_LIBRARY=openal
cmake --build build

cp build/src/re3.js build/src/re3.wasm "$ROOT/site/iframe/re3/"
# The engine's own files that go over the game's.
rsync -a --exclude '.*' re3/gamefiles/ "$ROOT/site/iframe/re3/gamefiles/"
echo "Built re3.js and re3.wasm. Update gamefiles.json if the file list changed."
