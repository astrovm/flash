import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	DEV_BUILD_STATE,
	computeSourceFingerprint,
	createRequestHandler,
	ensureDevelopmentBuild,
} from "../tools/dev-server";

const temporaryDirectories: string[] = [];

async function makeTemporaryDirectory(): Promise<string> {
	const path = await mkdtemp(join(tmpdir(), "astro-flash-dev-server-test-"));
	temporaryDirectories.push(path);
	return path;
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((path) =>
			rm(path, { force: true, recursive: true }),
		),
	);
});

describe("development build synchronization", () => {
	test("fingerprints build inputs but ignores unrelated files", async () => {
		const project = await makeTemporaryDirectory();
		await mkdir(join(project, "site"), { recursive: true });
		await mkdir(join(project, "tools"), { recursive: true });
		await writeFile(join(project, "site", "index.html"), "one");
		await writeFile(join(project, "tools", "deploy.ts"), "build");
		await writeFile(join(project, "tools", "ruffle-release.json"), "{}");
		await writeFile(join(project, "workbox-config.js"), "config");
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

	test("skips an unchanged build and reuses the pinned Ruffle runtime", async () => {
		const root = await makeTemporaryDirectory();
		const output = join(root, "dist");
		let sourceFingerprint = "first";
		let builds = 0;
		const builder = async ({ outputDir }: { outputDir?: string }) => {
			builds += 1;
			await mkdir(join(outputDir as string, "js"), { recursive: true });
			await writeFile(join(outputDir as string, "index.html"), "built");
			await writeFile(join(outputDir as string, "js", "ruffle.js"), "ruffle");
			await writeFile(
				join(outputDir as string, "js", "core.ruffle.abc.js"),
				"core",
			);
			await writeFile(join(outputDir as string, "js", "abc.wasm"), "wasm");
		};
		const options = {
			outputDir: output,
			fingerprint: async () => sourceFingerprint,
			releaseKey: async () => "v1:asset:checksum",
			builder,
		};

		expect(await ensureDevelopmentBuild(options)).toEqual({
			rebuilt: true,
			reusedRuffle: false,
		});
		expect(await ensureDevelopmentBuild(options)).toEqual({
			rebuilt: false,
			reusedRuffle: false,
		});
		sourceFingerprint = "second";
		expect(await ensureDevelopmentBuild(options)).toEqual({
			rebuilt: true,
			reusedRuffle: true,
		});
		expect(builds).toBe(2);
		const state = JSON.parse(
			await readFile(join(output, DEV_BUILD_STATE), "utf8"),
		);
		expect(state.fingerprint).toBe("second");
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
		const handler = createRequestHandler(
			root,
			async () => new Response(html),
		);
		const response = await handler(
			new Request("http://localhost/api/games?q=bike"),
		);
		expect(response.status).toBe(200);
		expect((await response.json()).games[0].title).toBe("Bike Mania");
	});
});
