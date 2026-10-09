(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AstroGameData = api;
})(globalThis, function (root) {
  "use strict";

  const REVCDOS_DIRECTORY = "astro-flash-revcdos";
  const RE3_DIRECTORY = "astro-flash-re3";
  // Games that keep their data as one packed copy in browser storage.
  const PACKED_GAMES = {
    revcdos: {
      title: "reVC",
      directory: REVCDOS_DIRECTORY,
      keys: [
        "astro-flash.revcdos.download-complete.v1",
        "astro-flash.revcdos.download-source.v1",
      ],
      message: "REVCDOS_PACK_UPDATED",
    },
    re3: {
      title: "re3",
      directory: RE3_DIRECTORY,
      keys: [],
      message: "RE3_PACK_UPDATED",
    },
  };
  const SCUMMVM_DIRECTORY = "astro-flash-scummvm";
  const PINK_GAMES = {
    peril: "The Pink Panther: Passport to Peril",
    pokus: "The Pink Panther: Hokus Pokus Pink",
  };

  const metadataKey = (id) => `astro-flash.scummvm.${id}.iso.v1`;

  const getDirectory = async (storage, name) => {
    if (!storage?.getDirectory) return null;
    try {
      return await (await storage.getDirectory()).getDirectoryHandle(name);
    } catch {
      return null;
    }
  };

  const directoryBytes = async (directory) => {
    let total = 0;
    if (!directory) return total;
    for await (const [, handle] of directory.entries()) {
      if (handle.kind === "file") {
        total += (await handle.getFile()).size;
      } else {
        total += await directoryBytes(handle);
      }
    }
    return total;
  };

  const createManager = ({
    storage = root.navigator?.storage,
    localStorageObject = root.localStorage,
    serviceWorker = root.navigator?.serviceWorker,
  } = {}) => {
    const list = async () => {
      const items = [];
      for (const [id, game] of Object.entries(PACKED_GAMES)) {
        const bytes = await directoryBytes(
          await getDirectory(storage, game.directory),
        );
        if (bytes > 0) {
          items.push({
            id,
            title: game.title,
            detail: "Game data",
            bytes,
          });
        }
      }

      const scummvmDirectory = await getDirectory(storage, SCUMMVM_DIRECTORY);
      if (scummvmDirectory) {
        for (const [id, title] of Object.entries(PINK_GAMES)) {
          let bytes = 0;
          for await (const [name, handle] of scummvmDirectory.entries()) {
            if (handle.kind === "file" && name.startsWith(`${id}-`)) {
              bytes += (await handle.getFile()).size;
            }
          }
          if (bytes > 0) {
            items.push({
              id: `scummvm:${id}`,
              title,
              detail: "CD image",
              bytes,
            });
          }
        }
      }
      return items;
    };

    const remove = async (id) => {
      const rootDirectory = storage?.getDirectory
        ? await storage.getDirectory()
        : null;
      const packed = Object.hasOwn(PACKED_GAMES, id) && PACKED_GAMES[id];
      if (packed) {
        if (rootDirectory) {
          await rootDirectory
            .removeEntry(packed.directory, { recursive: true })
            .catch((error) => {
              if (error.name !== "NotFoundError") throw error;
            });
        }
        packed.keys.forEach((key) => localStorageObject?.removeItem(key));
        let registration = null;
        try {
          registration = await serviceWorker?.ready;
        } catch {
          // The directory is already gone; worker notification is best effort.
        }
        (serviceWorker?.controller || registration?.active)?.postMessage({
          type: packed.message,
        });
        return;
      }

      const match = /^scummvm:(peril|pokus)$/.exec(id);
      if (!match) throw new Error("Unknown installed game data.");
      const gameId = match[1];
      const directory = await getDirectory(storage, SCUMMVM_DIRECTORY);
      if (directory) {
        for await (const [name, handle] of directory.entries()) {
          if (handle.kind === "file" && name.startsWith(`${gameId}-`)) {
            await directory.removeEntry(name);
          }
        }
      }
      localStorageObject?.removeItem(metadataKey(gameId));
    };

    const removeTemporary = async (id, fileName) => {
      if (Object.hasOwn(PACKED_GAMES, id)) return remove(id);
      const match = /^scummvm:(peril|pokus)$/.exec(id);
      if (
        !match ||
        typeof fileName !== "string" ||
        !fileName.startsWith(`${match[1]}-`) ||
        fileName.includes("/")
      ) {
        throw new Error("Unknown temporary game data.");
      }
      const directory = await getDirectory(storage, SCUMMVM_DIRECTORY);
      if (!directory) return;
      await directory.removeEntry(fileName).catch((error) => {
        if (error.name !== "NotFoundError") throw error;
      });
      await directory
        .removeEntry(`${match[1]}-manifest.json`)
        .catch((error) => {
          if (error.name !== "NotFoundError") throw error;
        });
    };

    return { list, remove, removeTemporary };
  };

  return {
    REVCDOS_DIRECTORY,
    RE3_DIRECTORY,
    SCUMMVM_DIRECTORY,
    PINK_GAMES,
    createManager,
  };
});
