const DIRECTORY_NAME = "astro-flash-revcdos";
const MANIFEST_NAME = "manifest.json";
const FORMAT_VERSION = 1;
const DATA_PREFIX = "assets-";

const normalizePath = (path) =>
  String(path).replaceAll("\\", "/").replace(/^\/+/, "").toLowerCase();

const getSize = (file) => file.size ?? file.length;

async function* readChunks(file) {
  if (typeof file[Symbol.asyncIterator] === "function") {
    for await (const chunk of file) yield chunk;
    return;
  }

  if (typeof file.stream === "function") {
    const reader = file.stream().getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  } else {
    yield new Uint8Array(await file.arrayBuffer());
  }
}

const getDirectory = async () => {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(DIRECTORY_NAME, { create: true });
};

export async function loadPackedManifest() {
  try {
    const directory = await getDirectory();
    const manifestHandle = await directory.getFileHandle(MANIFEST_NAME);
    const manifest = JSON.parse(await (await manifestHandle.getFile()).text());
    if (
      manifest.version !== FORMAT_VERSION ||
      typeof manifest.dataFile !== "string" ||
      typeof manifest.size !== "number" ||
      typeof manifest.files !== "object"
    ) {
      return null;
    }
    const dataHandle = await directory.getFileHandle(manifest.dataFile);
    const dataFile = await dataHandle.getFile();
    return dataFile.size === manifest.size ? manifest : null;
  } catch {
    return null;
  }
}

export async function packFiles(entries, onProgress = () => {}) {
  await navigator.storage.persist?.();
  const files = [...entries]
    .map(([path, file]) => [normalizePath(path), file])
    .sort(([left], [right]) => left.localeCompare(right));
  const total = files.reduce((sum, [, file]) => sum + getSize(file), 0);
  const directory = await getDirectory();
  const generation = crypto.randomUUID();
  const dataFile = `${DATA_PREFIX}${generation}.bin`;
  const dataHandle = await directory.getFileHandle(dataFile, { create: true });
  const writable = await dataHandle.createWritable();
  const index = {};
  let offset = 0;

  try {
    for (const [path, file] of files) {
      const length = getSize(file);
      if (!Number.isSafeInteger(length) || length < 0) {
        throw new Error(`Invalid file size: ${path}`);
      }
      index[path] = { offset, length };
      for await (const chunk of readChunks(file)) {
        await writable.write(chunk);
        offset += chunk.byteLength;
        onProgress(offset, total, path);
      }
      if (offset !== index[path].offset + length) {
        throw new Error(`Unexpected file size while packing: ${path}`);
      }
    }
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => {});
    await directory.removeEntry(dataFile).catch(() => {});
    throw error;
  }

  const manifest = {
    version: FORMAT_VERSION,
    dataFile,
    size: offset,
    files: index,
  };
  const manifestHandle = await directory.getFileHandle(MANIFEST_NAME, {
    create: true,
  });
  const manifestWriter = await manifestHandle.createWritable();
  await manifestWriter.write(JSON.stringify(manifest));
  await manifestWriter.close();

  for await (const [name, handle] of directory.entries()) {
    if (
      handle.kind === "file" &&
      name.startsWith(DATA_PREFIX) &&
      name !== dataFile
    ) {
      await directory.removeEntry(name).catch(() => {});
    }
  }

  const registration = await navigator.serviceWorker.ready;
  (navigator.serviceWorker.controller || registration.active)?.postMessage({
    type: "REVCDOS_PACK_UPDATED",
  });
  return manifest;
}
