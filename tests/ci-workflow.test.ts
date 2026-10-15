import { describe, expect, test } from "bun:test";
import { YAML } from "bun";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const workflow = YAML.parse(
  await Bun.file(
    new URL("../.github/workflows/ci.yml", import.meta.url),
  ).text(),
) as {
  jobs: Record<string, { steps: { name: string; run?: string }[] }>;
};
const step = (job: string, name: string) => {
  const run = workflow.jobs[job].steps.find((step) => step.name === name)?.run;
  if (!run) throw new Error(`Missing workflow step: ${name}`);
  return run;
};

describe("required CI", () => {
  const gate = step("required-ci", "Require every PR validation job to pass");
  for (const [results, passes] of [
    [["success"], true],
    [["success", "success"], true],
    [[], false],
    [["failure"], false],
    [["cancelled"], false],
    [["skipped"], false],
    [["success", "skipped"], false],
  ] as const) {
    test(`prerequisites ${JSON.stringify(results)} ${passes ? "pass" : "fail"}`, () => {
      const result = Bun.spawnSync(["bash", "-e", "-c", gate], {
        env: { ...process.env, RESULTS: JSON.stringify(results) },
        stdout: "pipe",
        stderr: "pipe",
      });
      expect(result.exitCode === 0).toBe(passes);
    });
  }
});

test("production smoke check rejects stale or invalid versions", () => {
  const directory = mkdtempSync(join(tmpdir(), "xp-ci-smoke-"));
  mkdirSync(join(directory, "dist"));
  writeFileSync(
    join(directory, "dist/version.json"),
    JSON.stringify({ version: "26.10.15-1234567" }),
  );
  const smoke = step("build", "Smoke-test the production site");
  try {
    for (const [response, passes] of [
      ['{"version":"26.10.15-1234567"}', true],
      ['{"version":"26.10.14-abcdef0"}', false],
      ["{}", false],
      ["invalid", false],
    ] as const) {
      const result = Bun.spawnSync(
        [
          "bash",
          "-e",
          "-c",
          `curl() { if [[ "$*" == *version.json* ]]; then printf '%s' "$VERSION_RESPONSE"; fi; }\n${smoke}`,
        ],
        {
          cwd: directory,
          env: { ...process.env, VERSION_RESPONSE: response },
          stdout: "pipe",
          stderr: "pipe",
        },
      );
      expect(result.exitCode === 0).toBe(passes);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
