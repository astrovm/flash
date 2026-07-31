(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AstroGameData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const REVCDOS_DIRECTORY = "astro-flash-revcdos";
  const REVCDOS_KEYS = [
    "astro-flash.revcdos.download-complete.v1",
    "astro-flash.revcdos.download-source.v1",
  ];
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
      const revcdosDirectory = await getDirectory(storage, REVCDOS_DIRECTORY);
      const revcdosBytes = await directoryBytes(revcdosDirectory);
      if (revcdosBytes > 0) {
        items.push({
          id: "revcdos",
          title: "Grand Theft Auto: Vice City (reVCDOS)",
          detail: "Game data",
          bytes: revcdosBytes,
        });
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
      if (id === "revcdos") {
        if (rootDirectory) {
          await rootDirectory
            .removeEntry(REVCDOS_DIRECTORY, { recursive: true })
            .catch((error) => {
              if (error.name !== "NotFoundError") throw error;
            });
        }
        REVCDOS_KEYS.forEach((key) => localStorageObject?.removeItem(key));
        let registration = null;
        try {
          registration = await serviceWorker?.ready;
        } catch {
          // The directory is already gone; worker notification is best effort.
        }
        (serviceWorker?.controller || registration?.active)?.postMessage({
          type: "REVCDOS_PACK_UPDATED",
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
      if (id === "revcdos") return remove(id);
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
    SCUMMVM_DIRECTORY,
    PINK_GAMES,
    createManager,
  };
});
