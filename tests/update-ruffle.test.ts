import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getReleaseMetadata,
  type FetchLike,
  updateReleaseFile,
} from "../tools/update-ruffle.ts";

const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

function response(payload: unknown, content = ""): Response {
  return new Response(content || JSON.stringify(payload), { status: 200 });
}

function fetchFor(release: unknown): FetchLike {
  return async () => response(release);
}

describe("update-ruffle", () => {
  test("stable releases use the API digest", async () => {
    const metadata = await getReleaseMetadata(
      fetchFor({
        tag_name: "v0.4.2",
        draft: false,
        prerelease: false,
        assets: [
          {
            name: "ruffle-0.4.2-web-selfhosted.zip",
            digest: `sha256:${"b".repeat(64)}`,
          },
        ],
      }),
    );
    expect(metadata).toEqual({
      tag: "v0.4.2",
      asset: "ruffle-0.4.2-web-selfhosted.zip",
      sha256: "b".repeat(64),
    });
  });

  test("rejects prereleases", async () => {
    await expect(
      getReleaseMetadata(
        fetchFor({
          tag_name: "v0.4.2",
          draft: false,
          prerelease: true,
          assets: [],
        }),
      ),
    ).rejects.toThrow("stable semantic");
  });

  test("only writes the pin when it changes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "update-ruffle-"));
    temporaryDirectories.push(directory);
    const releasePath = join(directory, "ruffle.json");
    const current = {
      tag: "v0.4.1",
      asset: "ruffle-0.4.1-web-selfhosted.zip",
      sha256: "a".repeat(64),
    };
    await writeFile(releasePath, JSON.stringify(current));
    expect(
      await updateReleaseFile(
        releasePath,
        fetchFor({
          tag_name: current.tag,
          draft: false,
          prerelease: false,
          assets: [{ name: current.asset, digest: `sha256:${current.sha256}` }],
        }),
      ),
    ).toBeFalse();
    expect(JSON.parse(await readFile(releasePath, "utf8"))).toEqual(current);
  });
});
