/** Find likely Flashpoint Archive logo matches. This discovery helper never changes project assets. */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const GAMES_PATH = join(PROJECT_DIR, "site", "js", "games.js");
const API_URL = "https://db-api.unstable.life/search";

const TITLE_OVERRIDES: Record<string, string> = {
  "captain-usa": "Captain USA",
  "simpsons-wrecking-ball": "The Simpsons Movie: Wrecking Ball",
  "inside-the-firewall": "Inside the Firewall",
  "knd-operation-startup": "KND: Operation S.T.A.R.T.U.P.",
  "knd-operation-startup-final": "KND: Operation S.T.A.R.T.U.P. Final",
  "la-isla-de-lo-mono": "La Isla de lo Mono",
  "dexter-runaway-robot": "Dexter's Laboratory: Runaway Robot",
  "portal-flash": "Portal: The Flash Version",
  "sugar-sugar": "Sugar, Sugar",
  "whack-a-kass": "Whack a Kass",
  "eds-candy-machine": "Ed's Candy Machine",
  "knd-numbuh-generator": "KND Numbuh Generator",
};

type Candidate = { title: string; score?: number; [key: string]: unknown };

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function titleFromId(gameId: string): string {
  return (
    TITLE_OVERRIDES[gameId] ??
    gameId
      .split("-")
      .map((word) => word[0]?.toUpperCase() + word.slice(1))
      .join(" ")
  );
}
async function getGameIds(): Promise<string[]> {
  return [
    ...(await readFile(GAMES_PATH, "utf8")).matchAll(/^\s{4}"([^"]+)":\s*\{/gm),
  ].map((match) => match[1]);
}

function similarity(left: string, right: string): number {
  const matchSize = (
    aStart: number,
    aEnd: number,
    bStart: number,
    bEnd: number,
  ): number => {
    let bestLength = 0,
      bestA = aStart,
      bestB = bStart;
    let previous = new Map<number, number>();
    for (let a = aStart; a < aEnd; a++) {
      const next = new Map<number, number>();
      for (let b = bStart; b < bEnd; b++)
        if (left[a] === right[b]) {
          const length = (previous.get(b - 1) ?? 0) + 1;
          next.set(b, length);
          if (length > bestLength)
            [bestLength, bestA, bestB] = [
              length,
              a - length + 1,
              b - length + 1,
            ];
        }
      previous = next;
    }
    return bestLength === 0
      ? 0
      : bestLength +
          matchSize(aStart, bestA, bStart, bestB) +
          matchSize(bestA + bestLength, aEnd, bestB + bestLength, bEnd);
  };
  return left.length + right.length === 0
    ? 1
    : (2 * matchSize(0, left.length, 0, right.length)) /
        (left.length + right.length);
}

async function findCandidates(gameId: string) {
  const expectedTitle = titleFromId(gameId);
  const response = await fetch(
    `${API_URL}?${new URLSearchParams({ title: expectedTitle, fields: "id,title,developer,publisher,platform,source", limit: "20" })}`,
    { signal: AbortSignal.timeout(30_000) },
  );
  if (!response.ok)
    throw new Error(`Request failed with status ${response.status}`);
  const expected = normalize(expectedTitle);
  const candidates = (await response.json()) as Candidate[];
  for (const candidate of candidates)
    candidate.score = Number(
      similarity(expected, normalize(candidate.title)).toFixed(3),
    );
  candidates.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return [
    gameId,
    { expectedTitle, candidates: candidates.slice(0, 3) },
  ] as const;
}

if (import.meta.main) {
  const gameIds = (await getGameIds()).filter((gameId) => gameId !== "doom");
  console.log(
    JSON.stringify(
      Object.fromEntries(
        (await Promise.all(gameIds.map(findCandidates))).sort(([a], [b]) =>
          a.localeCompare(b),
        ),
      ),
      null,
      2,
    ),
  );
}
