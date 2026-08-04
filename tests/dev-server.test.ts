import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DEV_BUILD_STATE,
  DEV_RELOAD_PATH,
  computeSourceFingerprint,
  createDevelopmentLiveReload,
  createPreviewVersion,
  createRequestHandler,
  ensureDevelopmentBuild,
  watchDevelopmentBuild,
} from "../tools/dev-server";

const temporaryDirectories: string[] = [];

async function makeTemporaryDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "astro-flash-dev-server-test-"));
  temporaryDirectories.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("development build synchronization", () => {
  test("derives preview versions from the build fingerprint", () => {
    expect(
      createPreviewVersion(
        "abcdef0123456789",
        new Date("2026-08-02T12:00:00.000Z"),
      ),
    ).toBe("26.08.02-abcdef0");
  });

  test("fingerprints build inputs but ignores unrelated files", async () => {
    const project = await makeTemporaryDirectory();
    await mkdir(join(project, "site"), { recursive: true });
    await mkdir(join(project, "tools"), { recursive: true });
    await writeFile(join(project, "site", "index.html"), "one");
    await writeFile(join(project, "tools", "deploy.ts"), "build");
    await writeFile(join(project, "workbox-config.ts"), "config");
    await writeFile(join(project, "package.json"), "{}");
    await writeFile(join(project, "bun.lock"), "lock");
    Bun.spawnSync(["git", "init"], { cwd: project });
    Bun.spawnSync(["git", "add", "."], { cwd: project });
    Bun.spawnSync(
      [
        "git",
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.com",
        "commit",
        "-m",
        "fixture",
      ],
      { cwd: project },
    );

    const initial = await computeSourceFingerprint(project);
    await writeFile(join(project, "README.md"), "ignored");
    expect(await computeSourceFingerprint(project)).toBe(initial);
    await writeFile(join(project, "site", "index.html"), "two");
    expect(await computeSourceFingerprint(project)).not.toBe(initial);
  });

  test("skips an unchanged build and rebuilds when the fingerprint changes", async () => {
    const root = await makeTemporaryDirectory();
    const output = join(root, "dist");
    let sourceFingerprint = "first";
    let builds = 0;
    const builder = async ({ outputDir }: { outputDir?: string }) => {
      builds += 1;
      await mkdir(join(outputDir as string, "js"), { recursive: true });
      await writeFile(join(outputDir as string, "index.html"), "built");
    };
    const options = {
      outputDir: output,
      fingerprint: async () => sourceFingerprint,
      builder,
    };

    expect(await ensureDevelopmentBuild(options)).toEqual({ rebuilt: true });
    expect(await ensureDevelopmentBuild(options)).toEqual({ rebuilt: false });
    sourceFingerprint = "second";
    expect(await ensureDevelopmentBuild(options)).toEqual({ rebuilt: true });
    expect(builds).toBe(2);
    const state = JSON.parse(
      await readFile(join(output, DEV_BUILD_STATE), "utf8"),
    );
    expect(state.schema).toBe(2);
    expect(state.fingerprint).toBe("second");
  });

  test("passes a fingerprint-based version to preview builds", async () => {
    const root = await makeTemporaryDirectory();
    const versions: string[] = [];

    await ensureDevelopmentBuild({
      outputDir: join(root, "dist"),
      fingerprint: async () => "1234567890abcdef",
      version: (fingerprint) => `preview-${fingerprint.slice(0, 7)}`,
      builder: async ({ outputDir, version }) => {
        versions.push(version as string);
        await mkdir(outputDir as string, { recursive: true });
        await writeFile(join(outputDir as string, "index.html"), "built");
      },
    });

    expect(versions).toEqual(["preview-1234567"]);
  });
});

describe("Bun request handler", () => {
  test("serves static files without caching and blocks traversal", async () => {
    const root = await makeTemporaryDirectory();
    await writeFile(join(root, "index.html"), "<h1>Astro Flash</h1>");
    const handler = createRequestHandler(root);

    const response = await handler(new Request("http://localhost/"));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Astro Flash");
    expect(response.headers.get("cache-control")).toContain("no-store");

    const traversal = await handler(
      new Request("http://localhost/%2e%2e%2fsecret"),
    );
    expect(traversal.status).toBe(404);
  });

  test("routes the local catalog API through the shared handler", async () => {
    const root = await makeTemporaryDirectory();
    await writeFile(join(root, "index.html"), "site");
    const uuid = "a2fb012a-b14c-6921-b688-403571e42bb0";
    const html = `
			<div class="fp-search-result">
				<a href="/view?id=${uuid}"></a>
				<a class="fp-search-result-title" href="/view?id=${uuid}">Bike Mania</a>
				<div class="fp-search-result-info">Flash game - Racing</div>
			</div>`;
    const handler = createRequestHandler(root, async () => new Response(html));
    const response = await handler(
      new Request("http://localhost/api/games?q=bike"),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).games[0].title).toBe("Bike Mania");
  });

  test("routes RTC credentials through the local origin", async () => {
    const root = await makeTemporaryDirectory();
    const handler = createRequestHandler(
      root,
      async () =>
        new Response(
          JSON.stringify([
            {
              iceservers: [
                { urls: ["stun:rtc.example:3478"] },
                {
                  urls: ["turn:rtc.example:3478"],
                  username: "temporary-user",
                  credential: "temporary-password",
                },
              ],
            },
          ]),
        ),
    );
    const response = await handler(new Request("http://localhost/api/rtc"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      iceServers: [
        { urls: ["stun:rtc.example:3478"] },
        {
          urls: ["turn:rtc.example:3478"],
          username: "temporary-user",
          credential: "temporary-password",
        },
      ],
    });
  });

  test("injects the development client and serves reload events", async () => {
    const root = await makeTemporaryDirectory();
    await writeFile(join(root, "index.html"), "<body>site</body>");
    const liveReload = createDevelopmentLiveReload();
    const handler = createRequestHandler(root, fetch, liveReload);

    const page = await handler(new Request("http://localhost/"));
    const pageHtml = await page.text();
    expect(pageHtml).toContain("window.ASTRO_DEV = true");
    expect(pageHtml).toContain(`new EventSource("${DEV_RELOAD_PATH}")`);

    const response = await handler(
      new Request(`http://localhost${DEV_RELOAD_PATH}`),
    );
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    expect(decoder.decode((await reader.read()).value)).toContain("connected");
    liveReload.reload();
    expect(decoder.decode((await reader.read()).value)).toContain(
      "event: reload",
    );
    await reader.cancel();
    liveReload.close();
  });

  test("replaces the production service worker in development", async () => {
    const root = await makeTemporaryDirectory();
    await writeFile(join(root, "index.html"), "<body>site</body>");
    const liveReload = createDevelopmentLiveReload();
    const handler = createRequestHandler(root, fetch, liveReload);

    const response = await handler(new Request("http://localhost/sw.js"));
    const worker = await response.text();
    expect(worker).toContain('name.startsWith("astro-flash")');
    expect(worker).toContain("self.registration.unregister()");
    expect(response.headers.get("cache-control")).toContain("no-store");
    liveReload.close();
  });

  test("serves production HTML and service worker unchanged for preview", async () => {
    const root = await makeTemporaryDirectory();
    await writeFile(join(root, "index.html"), "<body>site</body>");
    await writeFile(join(root, "sw.js"), "self.productionWorker = true;");
    const handler = createRequestHandler(root);

    const page = await handler(new Request("http://localhost/"));
    expect(await page.text()).toBe("<body>site</body>");

    const worker = await handler(new Request("http://localhost/sw.js"));
    expect(await worker.text()).toBe("self.productionWorker = true;");
  });
});

describe("development source watching", () => {
  test("debounces source changes and reloads after rebuilding", async () => {
    const project = await makeTemporaryDirectory();
    await mkdir(join(project, "site"), { recursive: true });
    const source = join(project, "site", "index.html");
    await writeFile(source, "one");
    let builds = 0;
    let resolveReload!: () => void;
    const reloaded = new Promise<void>((resolve) => {
      resolveReload = resolve;
    });
    const watcher = await watchDevelopmentBuild({
      debounceMs: 10,
      onReload: resolveReload,
      projectDir: project,
      rebuild: async () => {
        builds += 1;
        return { rebuilt: true };
      },
    });

    try {
      await Bun.sleep(25);
      await writeFile(source, "two");
      await Promise.race([
        reloaded,
        Bun.sleep(2_000).then(() => {
          throw new Error("Timed out waiting for the development rebuild");
        }),
      ]);
      expect(builds).toBe(1);
    } finally {
      watcher.close();
    }
  });
});
