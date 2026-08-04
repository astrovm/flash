import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getLatestStableVersion,
  type FetchLike,
  readPinnedVersion,
  updatePackagePin,
} from "../tools/update-ruffle.ts";

const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

function response(payload: unknown): Response {
  return new Response(JSON.stringify(payload), { status: 200 });
}

function fetchFor(payload: unknown): FetchLike {
  return async () => response(payload);
}

describe("update-ruffle", () => {
  test("stable releases use the npm latest tag", async () => {
    const version = await getLatestStableVersion(
      fetchFor({
        "dist-tags": { latest: "0.4.2", nightly: "0.5.0-nightly.2026.8.4" },
      }),
    );
    expect(version).toBe("0.4.2");
  });

  test("rejects non-semantic latest tags", async () => {
    await expect(
      getLatestStableVersion(
        fetchFor({
          "dist-tags": { latest: "0.5.0-nightly.2026.8.4" },
        }),
      ),
    ).rejects.toThrow("stable semantic");
  });

  test("only writes the pin when it changes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "update-ruffle-"));
    temporaryDirectories.push(directory);
    const packageJsonPath = join(directory, "package.json");
    const current = {
      dependencies: {
        "@ruffle-rs/ruffle": "0.4.1",
      },
    };
    await writeFile(packageJsonPath, JSON.stringify(current));
    let installs = 0;
    expect(
      await updatePackagePin(
        packageJsonPath,
        fetchFor({
          "dist-tags": { latest: "0.4.1" },
        }),
        () => {
          installs += 1;
        },
      ),
    ).toBeFalse();
    expect(JSON.parse(await readFile(packageJsonPath, "utf8"))).toEqual(
      current,
    );
    expect(installs).toBe(0);

    expect(
      await updatePackagePin(
        packageJsonPath,
        fetchFor({
          "dist-tags": { latest: "0.4.2" },
        }),
        () => {
          installs += 1;
        },
      ),
    ).toBeTrue();
    expect(
      readPinnedVersion(JSON.parse(await readFile(packageJsonPath, "utf8"))),
    ).toBe("0.4.2");
    expect(installs).toBe(1);
  });
});
