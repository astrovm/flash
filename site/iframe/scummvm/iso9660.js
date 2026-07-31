"use strict";

(function exposeIso9660(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.AstroIso9660 = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const ISO_SECTOR_SIZE = 2048;
  const PRIMARY_VOLUME_SECTOR = 16;
  const textDecoder = new TextDecoder("ascii");

  const readUint32 = (bytes, offset) =>
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
      offset,
      true,
    );

  const parseDirectoryRecord = (bytes, offset) => {
    const length = bytes[offset];
    if (!length) return null;
    if (offset + length > bytes.length || length < 34)
      throw new Error("The CD image has an invalid ISO directory.");
    const nameLength = bytes[offset + 32];
    const rawName = textDecoder.decode(
      bytes.subarray(offset + 33, offset + 33 + nameLength),
    );
    return {
      directory: Boolean(bytes[offset + 25] & 2),
      extent: readUint32(bytes, offset + 2),
      length,
      name:
        rawName === "\u0000"
          ? "."
          : rawName === "\u0001"
            ? ".."
            : rawName.replace(/;1$/i, "").toUpperCase(),
      size: readUint32(bytes, offset + 10),
    };
  };

  const readDirectory = async (iso, extent, size) => {
    const bytes = new Uint8Array(
      await iso
        .slice(extent * ISO_SECTOR_SIZE, extent * ISO_SECTOR_SIZE + size)
        .arrayBuffer(),
    );
    const records = [];
    let offset = 0;
    while (offset < bytes.length) {
      if (!bytes[offset]) {
        offset = Math.ceil((offset + 1) / ISO_SECTOR_SIZE) * ISO_SECTOR_SIZE;
        continue;
      }
      const record = parseDirectoryRecord(bytes, offset);
      if (!record) break;
      records.push(record);
      offset += record.length;
    }
    return records;
  };

  const indexIsoFiles = async (iso) => {
    const volume = new Uint8Array(
      await iso
        .slice(
          PRIMARY_VOLUME_SECTOR * ISO_SECTOR_SIZE,
          (PRIMARY_VOLUME_SECTOR + 1) * ISO_SECTOR_SIZE,
        )
        .arrayBuffer(),
    );
    if (
      volume[0] !== 1 ||
      textDecoder.decode(volume.subarray(1, 6)) !== "CD001"
    ) {
      throw new Error("That file is not a supported ISO 9660 CD image.");
    }

    const root = parseDirectoryRecord(volume, 156);
    const files = new Map();
    const visited = new Set();
    const visit = async (directory, depth) => {
      if (depth > 8 || visited.has(directory.extent)) return;
      visited.add(directory.extent);
      for (const entry of await readDirectory(
        iso,
        directory.extent,
        directory.size,
      )) {
        if (entry.name === "." || entry.name === "..") continue;
        if (entry.directory) await visit(entry, depth + 1);
        else if (!files.has(entry.name)) files.set(entry.name, entry);
      }
    };
    await visit(root, 0);
    return files;
  };

  const gameFilesFromIso = async (iso, requiredFiles, gameTitle) => {
    const files = await indexIsoFiles(iso);
    const gameFiles = [];
    for (const [name, expectedSize] of Object.entries(requiredFiles)) {
      const entry = files.get(name);
      if (!entry || entry.size !== expectedSize) {
        throw new Error(
          `This is not the English ${gameTitle} CD image (${name} was not found).`,
        );
      }
      const start = entry.extent * ISO_SECTOR_SIZE;
      gameFiles.push({
        name,
        offset: start,
        size: entry.size,
        data: iso.slice(start, start + entry.size),
      });
    }
    return gameFiles;
  };

  const gameBlobsFromIso = async (iso, requiredFiles, gameTitle) =>
    gameFilesFromIso(iso, requiredFiles, gameTitle);

  return { gameBlobsFromIso, gameFilesFromIso, indexIsoFiles };
});
