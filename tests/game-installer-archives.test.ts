// @ts-nocheck -- Dependencies are injected into the browser installer.
import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";
import { AsyncInflate, unzipSync, zipSync } from "fflate";

const require = createRequire(import.meta.url);
const installer = require("../site/js/game-installer.js");

const uuid = "a2fb012a-b14c-4921-b688-403571e42bb0";
const launchPath = "content/game.example/main.swf";
const record = {
  uuid,
  library: "Games",
  platform: "Flash",
  status: "Playable",
  applicationPath: "Flash Player",
  downloadUrl: "https://flash.example/api/game/download",
  launchCommand: "https://game.example/main.swf",
};
const legacyRecord = { ...record, packageType: "legacy" };
// Archives from the Flashpoint mirror are allowed from any page origin.
const mirroredRecord = {
  ...record,
  downloadUrl: "https://download.unstable.life/gib-roms/Games/x.zip",
};
const mirroredLegacyRecord = { ...mirroredRecord, packageType: "legacy" };

const gameZip = (files = {}, level = 0) =>
  zipSync({ [launchPath]: new Uint8Array([1, 2, 3]), ...files }, { level });

// ZIP field offsets: the end-of-central-directory record, the first central
// directory header, and the first local file header.
const layout = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  const directory = view.getUint32(eocd + 16, true);
  return { view, eocd, directory, local: view.getUint32(directory + 42, true) };
};
const patched = (
  bytes: Uint8Array,
  change: (fields: ReturnType<typeof layout>, bytes: Uint8Array) => void,
) => {
  const copy = bytes.slice();
  change(layout(copy), copy);
  return copy;
};

const makeDependencies = () => {
  const cached = new Map(),
    metadata = new Map();
  return {
    cached,
    metadata,
    dependencies: {
      origin: "https://flash.example",
      Inflate: AsyncInflate,
      cache: {
        async put(key, response) {
          cached.set(
            key,
            typeof response.arrayBuffer === "function"
              ? new Uint8Array(await response.arrayBuffer())
              : response,
          );
        },
        async delete(key) {
          cached.delete(key.url || key);
        },
        async keys() {
          return [...cached.keys()];
        },
      },
      store: {
        async put(value) {
          metadata.set(value.id, value);
        },
        async delete(id) {
          metadata.delete(id);
        },
      },
      unzip: async (bytes) => unzipSync(bytes),
    },
  };
};

const withLocation = async (callback) => {
  globalThis.location = { origin: "https://flash.example" };
  try {
    return await callback();
  } finally {
    delete globalThis.location;
  }
};

describe("ZIP metadata validation", () => {
  const cases: [string, () => Uint8Array, string, object?][] = [
    ["no end record", () => new Uint8Array(30), "ZIP metadata is invalid"],
    [
      "a trailing comment length that does not match",
      () =>
        patched(gameZip(), ({ view, eocd }) =>
          view.setUint16(eocd + 20, 5, true),
        ),
      "ZIP metadata is invalid",
    ],
    [
      "a second disk number",
      () =>
        patched(gameZip(), ({ view, eocd }) =>
          view.setUint16(eocd + 4, 1, true),
        ),
      "Multi-disk",
    ],
    [
      "a second directory disk",
      () =>
        patched(gameZip(), ({ view, eocd }) =>
          view.setUint16(eocd + 6, 1, true),
        ),
      "Multi-disk",
    ],
    [
      "mismatched entry counts",
      () =>
        patched(gameZip(), ({ view, eocd }) =>
          view.setUint16(eocd + 8, 2, true),
        ),
      "ZIP metadata is invalid",
    ],
    [
      "ZIP64 entry counts",
      () =>
        patched(gameZip(), ({ view, eocd }) => {
          view.setUint16(eocd + 8, 0xffff, true);
          view.setUint16(eocd + 10, 0xffff, true);
        }),
      "ZIP metadata is invalid",
      { maxFiles: 0x10000 },
    ],
    [
      "a ZIP64 directory size",
      () =>
        patched(gameZip(), ({ view, eocd }) =>
          view.setUint32(eocd + 12, 0xffffffff, true),
        ),
      "ZIP metadata is invalid",
    ],
    [
      "a ZIP64 directory offset",
      () =>
        patched(gameZip(), ({ view, eocd }) =>
          view.setUint32(eocd + 16, 0xffffffff, true),
        ),
      "ZIP metadata is invalid",
    ],
    [
      "too many files",
      () => gameZip(),
      "ZIP has too many files",
      { maxFiles: 0 },
    ],
    [
      "a directory past the end record",
      () =>
        patched(gameZip(), ({ view, eocd }) =>
          view.setUint32(eocd + 16, eocd, true),
        ),
      "ZIP metadata is invalid",
    ],
    [
      "a corrupt directory header",
      () =>
        patched(gameZip(), ({ view, directory }) =>
          view.setUint32(directory, 0, true),
        ),
      "ZIP metadata is invalid",
    ],
    [
      "more entries than directory headers",
      () =>
        patched(gameZip(), ({ view, eocd }) => {
          view.setUint16(eocd + 8, 2, true);
          view.setUint16(eocd + 10, 2, true);
        }),
      "ZIP metadata is invalid",
    ],
    [
      "a ZIP64 file size",
      () =>
        patched(gameZip(), ({ view, directory }) =>
          view.setUint32(directory + 24, 0xffffffff, true),
        ),
      "ZIP metadata is invalid",
    ],
    [
      "a file name past the directory",
      () =>
        patched(gameZip(), ({ view, directory }) =>
          view.setUint16(directory + 28, 0xffff, true),
        ),
      "ZIP metadata is invalid",
    ],
    [
      "an oversized file",
      () => gameZip(),
      "ZIP file is too large",
      { maxFileBytes: 2 },
    ],
    [
      "headers that overrun the declared directory",
      () =>
        patched(gameZip(), ({ view, eocd }) =>
          view.setUint32(eocd + 12, view.getUint32(eocd + 12, true) - 1, true),
        ),
      "ZIP metadata is invalid",
    ],
  ];
  for (const [label, archive, message, limits] of cases)
    test(`rejects ${label}`, () => {
      expect(() => installer.validateZipMetadata(archive(), limits)).toThrow(
        message,
      );
    });

  test("rejects non-byte archives and skips directory sizes", () => {
    expect(() => installer.validateZipMetadata(null)).toThrow("Uint8Array");
    expect(
      installer.validateZipMetadata(
        gameZip({ "content/assets/": new Uint8Array(0) }),
      ),
    ).toEqual({ entryCount: 2, totalBytes: 3 });
  });

  test("validates extracted entries from maps and empty readers", () => {
    const entries = new Map([
      ["content/assets/", new Uint8Array(0)],
      ["content/a.bin", new Uint8Array([1])],
    ]);
    expect(installer.validateZipEntries(entries)).toEqual([
      { path: "content/a.bin", bytes: new Uint8Array([1]) },
    ]);
    expect(installer.validateZipEntries(null)).toEqual([]);
    expect(() =>
      installer.validateZipEntries(entries, { maxFiles: 1 }),
    ).toThrow("too many files");
    expect(() =>
      installer.validateZipEntries(entries, { maxFileBytes: 0 }),
    ).toThrow("ZIP file is too large");
  });

  test("rejects catalog records without a status", () => {
    const { status: _status, ...unknownStatus } = record;
    expect(() => installer.validateCatalogRecord(unknownStatus)).toThrow(
      "Only playable games",
    );
  });
});

describe("streamed ZIP index validation", () => {
  const index = (bytes: Uint8Array, limits?: object) =>
    installer.readArchiveIndex(new Blob([bytes]), limits);
  const cases: [string, () => Uint8Array, string, object?][] = [
    ["no end record", () => new Uint8Array(30), "ZIP metadata is invalid"],
    [
      "a trailing comment length that does not match",
      () =>
        patched(gameZip(), ({ view, eocd }) =>
          view.setUint16(eocd + 20, 5, true),
        ),
      "ZIP metadata is invalid",
    ],
    [
      "a second disk number",
      () =>
        patched(gameZip(), ({ view, eocd }) =>
          view.setUint16(eocd + 4, 1, true),
        ),
      "ZIP metadata is invalid",
    ],
    [
      "a second directory disk",
      () =>
        patched(gameZip(), ({ view, eocd }) =>
          view.setUint16(eocd + 6, 1, true),
        ),
      "ZIP metadata is invalid",
    ],
    [
      "too many files",
      () => gameZip(),
      "invalid or too large",
      { maxFiles: 0 },
    ],
    [
      "ZIP64 entry counts",
      () =>
        patched(gameZip(), ({ view, eocd }) => {
          view.setUint16(eocd + 8, 0xffff, true);
          view.setUint16(eocd + 10, 0xffff, true);
        }),
      "invalid or too large",
      { maxFiles: 0x10000 },
    ],
    [
      "mismatched entry counts",
      () =>
        patched(gameZip(), ({ view, eocd }) =>
          view.setUint16(eocd + 8, 2, true),
        ),
      "invalid or too large",
    ],
    [
      "an oversized directory",
      () =>
        patched(gameZip(), ({ view, eocd }) =>
          view.setUint32(eocd + 12, 9 * 1024 * 1024, true),
        ),
      "invalid or too large",
    ],
    [
      "a directory that does not end at the end record",
      () =>
        patched(gameZip(), ({ view, eocd }) =>
          view.setUint32(eocd + 16, view.getUint32(eocd + 16, true) - 1, true),
        ),
      "invalid or too large",
    ],
    [
      "more entries than directory headers",
      () =>
        patched(gameZip(), ({ view, eocd }) => {
          view.setUint16(eocd + 8, 2, true);
          view.setUint16(eocd + 10, 2, true);
        }),
      "ZIP metadata is invalid",
    ],
    [
      "a corrupt directory header",
      () =>
        patched(gameZip(), ({ view, directory }) =>
          view.setUint32(directory, 0, true),
        ),
      "ZIP metadata is invalid",
    ],
    [
      "fewer entries than directory headers",
      () =>
        patched(
          gameZip({ "content/b.bin": new Uint8Array([4]) }),
          ({ view, eocd }) => {
            view.setUint16(eocd + 8, 1, true);
            view.setUint16(eocd + 10, 1, true);
          },
        ),
      "ZIP metadata is invalid",
    ],
    ...(
      [
        ["a file name past the directory", 28, 0xffff, 2],
        ["an encrypted entry", 8, 1, 2],
        ["an unsupported compression method", 10, 12, 2],
        ["an entry on another disk", 34, 1, 2],
        ["a ZIP64 compressed size", 20, 0xffffffff, 4],
        ["a ZIP64 expanded size", 24, 0xffffffff, 4],
        ["a local header inside the directory", 42, 0x7fffffff, 4],
      ] as const
    ).map(
      ([label, field, value, size]) =>
        [
          label,
          () =>
            patched(gameZip(), ({ view, directory }) =>
              size === 2
                ? view.setUint16(directory + field, value, true)
                : view.setUint32(directory + field, value, true),
            ),
          "Unsupported or invalid ZIP entry",
        ] as [string, () => Uint8Array, string],
    ),
    [
      "duplicate paths that differ only by case",
      () =>
        zipSync(
          {
            [launchPath]: new Uint8Array([1]),
            [launchPath.toUpperCase()]: new Uint8Array([2]),
          },
          { level: 0 },
        ),
      "duplicate paths",
    ],
    [
      "an oversized file",
      () => gameZip(),
      "ZIP is too large",
      { maxFileBytes: 2 },
    ],
    [
      "an oversized archive",
      () => gameZip({ "content/b.bin": new Uint8Array([4]) }),
      "ZIP is too large",
      { maxTotalBytes: 3 },
    ],
    [
      "a corrupt local header",
      () =>
        patched(gameZip(), ({ view, local }) => view.setUint32(local, 0, true)),
      "ZIP local header is invalid",
    ],
    [
      "a local header with another compression method",
      () =>
        patched(gameZip(), ({ view, local }) =>
          view.setUint16(local + 8, 8, true),
        ),
      "ZIP local header is invalid",
    ],
    [
      "a local header with other flags",
      () =>
        patched(gameZip(), ({ view, local }) =>
          view.setUint16(local + 6, 2, true),
        ),
      "ZIP local header is invalid",
    ],
    [
      "a local header with another name",
      () =>
        patched(
          gameZip(),
          (_, bytes) => (bytes[layout(bytes).local + 30] = 0x43),
        ),
      "ZIP local header is invalid",
    ],
    [
      "file data that overruns the directory",
      () =>
        patched(gameZip(), ({ view, directory }) =>
          view.setUint32(directory + 20, 0x100000, true),
        ),
      "ZIP local header is invalid",
    ],
    [
      "stored data with a different expanded size",
      () =>
        patched(gameZip(), ({ view, directory }) =>
          view.setUint32(directory + 24, 2, true),
        ),
      "ZIP local header is invalid",
    ],
    [
      "a directory entry with file data",
      () =>
        patched(
          zipSync(
            {
              "content/assets/": new Uint8Array(0),
              [launchPath]: new Uint8Array([1]),
            },
            { level: 0 },
          ),
          ({ view, directory }) => {
            view.setUint32(directory + 20, 1, true);
            view.setUint32(directory + 24, 1, true);
          },
        ),
      "ZIP directory contains file data",
    ],
  ];
  for (const [label, archive, message, limits] of cases)
    test(`rejects ${label}`, async () => {
      await expect(index(archive(), limits)).rejects.toThrow(message);
    });

  test("lists files and skips directories", async () => {
    const files = await index(
      gameZip({ "content/assets/": new Uint8Array(0) }),
    );
    expect(files.map(({ path }) => path)).toEqual([launchPath]);
  });
});

describe("streamed installation failures", () => {
  test("requires a GameZIP record and a launch file", async () => {
    const { dependencies } = makeDependencies();
    await expect(
      installer.installStream(
        legacyRecord,
        new Blob([gameZip()]),
        dependencies,
      ),
    ).rejects.toThrow("A GameZIP archive is required");
    await expect(
      installer.installStream(
        record,
        new Blob([zipSync({ "content/other.swf": new Uint8Array([1]) })]),
        dependencies,
      ),
    ).rejects.toThrow("does not contain the launch SWF");
  });

  test("uses the page origin and reports missing dependencies", async () => {
    await withLocation(async () => {
      await expect(
        installer.installStream(record, new Blob([gameZip()])),
      ).rejects.toThrow();
    });
  });

  test("extracts empty files", async () => {
    const { cached, dependencies } = makeDependencies();
    const result = await installer.installStream(
      record,
      new Blob([
        gameZip({ "content/game.example/empty.txt": new Uint8Array(0) }),
      ]),
      dependencies,
    );
    expect(cached.get(result.basePath + "empty.txt")).toEqual(
      new Uint8Array(0),
    );
  });

  test("rejects deflated files that are corrupt or larger than declared", async () => {
    const data = { [launchPath]: new Uint8Array(4_000).fill(7) };
    const deflated = zipSync(data, { level: 6 });
    const { local } = layout(deflated);
    const start =
      local +
      30 +
      new DataView(deflated.buffer).getUint16(local + 26, true) +
      new DataView(deflated.buffer).getUint16(local + 28, true);
    const corrupt = deflated.slice();
    corrupt.fill(0xff, start, start + 4);
    for (const [archive, message] of [
      [corrupt, /./],
      [
        patched(deflated, ({ view, directory }) =>
          view.setUint32(directory + 24, 10, true),
        ),
        "exceeds its declared size",
      ],
    ]) {
      const { cached, metadata, dependencies } = makeDependencies();
      await expect(
        installer.installStream(record, new Blob([archive]), dependencies),
      ).rejects.toThrow(message);
      expect(cached.size).toBe(0);
      expect(metadata.size).toBe(0);
    }
  });

  test("rolls back when the cache rejects a file or the metadata store is missing", async () => {
    const { cached, dependencies } = makeDependencies();
    await expect(
      installer.installStream(record, new Blob([gameZip()]), {
        ...dependencies,
        cache: {
          put: async () => {
            throw new Error("cache full");
          },
          delete: async () => {
            throw new Error("cache locked");
          },
        },
      }),
    ).rejects.toThrow("cache full");
    await expect(
      installer.installStream(record, new Blob([gameZip()]), {
        ...dependencies,
        store: {},
      }),
    ).rejects.toThrow("Metadata store dependency is required");
    expect(cached.size).toBe(0);
  });

  test("cancels with a default reason when the signal has none", async () => {
    const listeners = new Set<() => void>();
    const signal = {
      reason: undefined,
      throwIfAborted() {},
      addEventListener: (_type, listener) => listeners.add(listener),
      removeEventListener: (_type, listener) => listeners.delete(listener),
    };
    const { dependencies } = makeDependencies();
    dependencies.cache.put = async (_key, response) => {
      const reader = response.body.getReader();
      await reader.read();
      listeners.forEach((listener) => listener());
      await reader.read();
    };
    await expect(
      installer.installStream(
        record,
        new Blob([
          zipSync({ [launchPath]: new Uint8Array(20_000) }, { level: 0 }),
        ]),
        { ...dependencies, signal },
      ),
    ).rejects.toThrow("Download cancelled");
  });
});

describe("buffered and legacy installation failures", () => {
  test("requires dependencies and a launch file", async () => {
    await expect(installer.install(record, gameZip())).rejects.toThrow(
      "ZIP reader dependency",
    );
    const { dependencies } = makeDependencies();
    await expect(
      installer.install(
        record,
        zipSync({ "content/other.swf": new Uint8Array([1]) }),
        dependencies,
      ),
    ).rejects.toThrow("does not contain the launch SWF");
  });

  test("falls back to the page or local origin and raw bytes without Response", async () => {
    const { dependencies, cached } = makeDependencies();
    const { origin: _origin, ...withoutOrigin } = dependencies;
    const Response_ = globalThis.Response;
    delete globalThis.Response;
    try {
      const local = await installer.install(
        mirroredRecord,
        gameZip(),
        withoutOrigin,
      );
      expect(local.launchPath.startsWith("https://astro.local/")).toBeTrue();
      expect(cached.get(local.launchPath)).toEqual(new Uint8Array([1, 2, 3]));
    } finally {
      globalThis.Response = Response_;
    }
    await withLocation(async () => {
      const paged = await installer.install(
        mirroredRecord,
        gameZip(),
        withoutOrigin,
      );
      expect(paged.launchPath.startsWith("https://flash.example/")).toBeTrue();
      const legacy = await installer.installLegacy(
        mirroredLegacyRecord,
        new Uint8Array([1]),
        withoutOrigin,
      );
      expect(legacy.launchPath.startsWith("https://flash.example/")).toBeTrue();
      await installer.uninstall(uuid, withoutOrigin);
    });
    await installer.installLegacy(
      mirroredLegacyRecord,
      new Uint8Array([1]),
      withoutOrigin,
    );
    await installer.uninstall(uuid, withoutOrigin);
    expect(cached.size).toBe(0);
  });

  test("keeps rolling back when cache deletion fails", async () => {
    const { dependencies } = makeDependencies();
    const cache = {
      ...dependencies.cache,
      async put(key) {
        if (key.endsWith("b.bin")) throw new Error("cache full");
      },
      async delete() {
        throw new Error("cache locked");
      },
    };
    await expect(
      installer.install(
        record,
        gameZip({ "content/b.bin": new Uint8Array([4]) }),
        { ...dependencies, cache },
      ),
    ).rejects.toThrow("cache full");
    await expect(
      installer.installLegacy(legacyRecord, new Uint8Array([1]), {
        ...dependencies,
        cache: {
          ...cache,
          put: async () => {
            throw new Error("cache full");
          },
        },
      }),
    ).rejects.toThrow("cache full");
  });

  test("rejects empty, oversized, and unconfigured legacy files", async () => {
    const { dependencies } = makeDependencies();
    await expect(
      installer.installLegacy(legacyRecord, new Uint8Array(0), dependencies),
    ).rejects.toThrow("Game file is empty");
    await expect(
      installer.installLegacy(legacyRecord, new Uint8Array(2), {
        ...dependencies,
        limits: { maxFileBytes: 1 },
      }),
    ).rejects.toThrow("Game file is too large");
    await expect(
      installer.installLegacy(legacyRecord, new Uint8Array(1)),
    ).rejects.toThrow("Cache dependency");
  });

  test("rejects invalid identifiers and missing dependencies on uninstall", async () => {
    await expect(installer.uninstall(42)).rejects.toThrow("Invalid game UUID");
    await expect(installer.uninstall("not-a-uuid")).rejects.toThrow(
      "Invalid game UUID",
    );
    await expect(installer.uninstall(uuid)).rejects.toThrow("Cache dependency");
  });
});
