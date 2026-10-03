// @ts-nocheck -- The server wiring is exercised with minimal fakes.
import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createDevelopmentLiveReload,
  createPreviewVersion,
  ensureDevelopmentBuild,
  parseServerArguments,
  startDevelopmentServer,
} from "../tools/dev-server";

const temporaryDirectories = [];
const makeTemporaryDirectory = async () => {
  const path = await mkdtemp(join(tmpdir(), "astro-flash-dev-wiring-test-"));
  temporaryDirectories.push(path);
  return path;
};
afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});
describe("development server wiring", () => {
  test("live reload sends heartbeats and forgets clients that stopped reading", async () => {
    const NativeReadableStream = globalThis.ReadableStream;
    let failing = false;
    globalThis.ReadableStream = class extends NativeReadableStream {
      constructor(source) {
        super({
          ...source,
          start(controller) {
            const enqueue = controller.enqueue.bind(controller);
            source.start({
              enqueue(chunk) {
                if (failing) throw new TypeError("stream closed");
                enqueue(chunk);
              },
            });
          },
        });
      }
    };
    let liveReload;
    try {
      liveReload = createDevelopmentLiveReload({ heartbeatMs: 5 });
      const reader = liveReload.response().body!.getReader();
      const decoder = new TextDecoder();
      expect(decoder.decode((await reader.read()).value)).toContain(
        "connected",
      );
      expect(decoder.decode((await reader.read()).value)).toContain(
        "heartbeat",
      );
      failing = true;
      liveReload.reload();
      failing = false;
      liveReload.reload();
      const next = await Promise.race([
        reader.read().then(() => "message"),
        Bun.sleep(30).then(() => "silence"),
      ]);
      expect(next).toBe("silence");
    } finally {
      liveReload?.close();
      globalThis.ReadableStream = NativeReadableStream;
    }
  });

  test("closing live reload ends every connected event stream", async () => {
    const liveReload = createDevelopmentLiveReload();
    const reader = liveReload.response().body.getReader();
    await reader.read();
    liveReload.close();
    expect(await reader.read()).toEqual({ done: true, value: undefined });
  });

  const fakeServer = () => {
    const calls = { builds: [], serve: null, watch: null };
    return {
      calls,
      dependencies: {
        serve: (options) => {
          calls.serve = options;
          return { url: new URL("http://127.0.0.1:1234/") };
        },
        ensureBuild: async (options) => {
          calls.builds.push(options);
          return { rebuilt: true };
        },
        watch: async (options) => {
          calls.watch = options;
          return { close() {} };
        },
      },
    };
  };
  const quietly = async (callback) => {
    const log = console.log;
    const error = console.error;
    const logs = [];
    console.log = (...values) => logs.push(["log", ...values]);
    console.error = (...values) => logs.push(["error", ...values]);
    try {
      await callback();
    } finally {
      console.log = log;
      console.error = error;
    }
    return logs;
  };

  test("builds, serves, and reloads development pages after rebuilds", async () => {
    const directory = await makeTemporaryDirectory();
    const { calls, dependencies } = fakeServer();
    let started;
    const logs = await quietly(async () => {
      started = await startDevelopmentServer(
        { ...parseServerArguments(["--rebuild"]), directory },
        dependencies,
      );
    });
    expect(calls.builds).toEqual([
      { outputDir: directory, force: true, version: undefined },
    ]);
    expect(logs).toContainEqual([
      "log",
      "Server running on http://127.0.0.1:1234/",
    ]);
    const errorLogs = await quietly(async () => {
      const response = calls.serve.error(new Error("boom"));
      expect(response.status).toBe(500);
      expect(await response.text()).toBe("Internal server error.");
    });
    expect(errorLogs[0][1].message).toBe("boom");
    await calls.watch.rebuild();
    expect(calls.builds.at(-1)).toEqual({
      outputDir: directory,
      version: undefined,
    });
    const reloads = [];
    started.liveReload.reload = () => reloads.push("reload");
    calls.watch.onReload();
    expect(reloads).toEqual(["reload"]);
    started.liveReload.close();
  });

  test("previews ask for a manual update check instead of reloading", async () => {
    const directory = await makeTemporaryDirectory();
    const { calls, dependencies } = fakeServer();
    await quietly(() =>
      startDevelopmentServer(
        { ...parseServerArguments(["--production"]), directory },
        dependencies,
      ),
    );
    expect(calls.builds[0].version).toBe(createPreviewVersion);
    const logs = await quietly(() => calls.watch.onReload());
    expect(logs).toEqual([
      ["log", "Preview update built; check for updates in the app."],
    ]);
  });

  test("serves an existing build without synchronizing or watching", async () => {
    const directory = await makeTemporaryDirectory();
    const { calls, dependencies } = fakeServer();
    const args = {
      ...parseServerArguments(["--no-sync", "--production"]),
      directory,
    };
    await expect(startDevelopmentServer(args, dependencies)).rejects.toThrow(
      "is not built",
    );
    await writeFile(join(directory, "index.html"), "<body></body>");
    await quietly(() => startDevelopmentServer(args, dependencies));
    expect(calls.builds).toEqual([]);
    expect(calls.watch).toBeNull();
    expect(calls.serve).not.toBeNull();
  });

  test("development builds use the release builder by default", async () => {
    // mock.module() patches the live namespace, so restore from a copy.
    const deploy = { ...(await import("../tools/deploy")) };
    const builds = [];
    mock.module("../tools/deploy", () => ({
      ...deploy,
      build: async (options) => builds.push(options),
    }));
    try {
      const outputDir = await makeTemporaryDirectory();
      await quietly(() =>
        ensureDevelopmentBuild({
          outputDir,
          projectDir: "/project",
          fingerprint: async () => "fingerprint",
        }),
      );
      expect(builds).toEqual([{ outputDir, sourceDir: "/project/site" }]);
    } finally {
      mock.module("../tools/deploy", () => deploy);
    }
  });
});
