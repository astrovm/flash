import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const siteDirectory = join(projectDirectory, "site");
const gamesPath = join(siteDirectory, "js", "games.js");
const sourcesPath = join(siteDirectory, "assets", "icons", "SOURCES.json");
const requireAll = Bun.argv.includes("--require-all");
type Game = { icon?: string };
type IconSource = {
  file?: string;
  sha256?: string;
  source?: string;
  retrieved?: string;
};

const context = vm.createContext({
  window: {} as { FLASH_GAMES?: Record<string, Game> },
});
vm.runInContext(readFileSync(gamesPath, "utf8"), context, {
  filename: gamesPath,
});
const games = (context.window.FLASH_GAMES ?? {}) as Record<string, Game>;
const sources = JSON.parse(readFileSync(sourcesPath, "utf8")) as Record<
  string,
  IconSource
>;
const errors: string[] = [],
  missing: string[] = [];
const pngSignature = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

for (const [gameId, game] of Object.entries(games)) {
  if (!game.icon) {
    missing.push(gameId);
    continue;
  }
  const iconPath = resolve(siteDirectory, game.icon);
  if (!iconPath.startsWith(`${siteDirectory}${sep}`)) {
    errors.push(`${gameId}: icon path escapes site/`);
    continue;
  }
  if (!existsSync(iconPath)) {
    errors.push(`${gameId}: missing ${game.icon}`);
    continue;
  }
  const iconContent = readFileSync(iconPath);
  if (!iconContent.subarray(0, 8).equals(pngSignature))
    errors.push(`${gameId}: icon is not a valid PNG payload`);
  const source = sources[gameId];
  if (!source) {
    errors.push(`${gameId}: missing SOURCES.json entry`);
    continue;
  }
  if (source.file !== basename(iconPath))
    errors.push(`${gameId}: source file does not match ${game.icon}`);
  if (source.sha256 !== createHash("sha256").update(iconContent).digest("hex"))
    errors.push(`${gameId}: SHA-256 does not match SOURCES.json`);
  if (!source.source || !source.retrieved)
    errors.push(`${gameId}: source URL and retrieval date are required`);
}
for (const gameId of Object.keys(sources))
  if (!games[gameId])
    errors.push(`${gameId}: source entry has no matching game`);
if (requireAll && missing.length)
  errors.push(`missing icons: ${missing.join(", ")}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exitCode = 1;
} else
  console.log(
    `Validated ${Object.keys(games).length - missing.length} sourced icons; ${missing.length} games still use fallbacks.`,
  );
