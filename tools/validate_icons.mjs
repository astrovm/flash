import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ".."
);
const docsDirectory = path.join(projectDirectory, "docs");
const gamesPath = path.join(docsDirectory, "js", "games.js");
const sourcesPath = path.join(docsDirectory, "assets", "icons", "SOURCES.json");
const requireAll = process.argv.includes("--require-all");

const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(gamesPath, "utf8"), context, {
    filename: gamesPath
});

const games = context.window.FLASH_GAMES;
const sources = JSON.parse(fs.readFileSync(sourcesPath, "utf8"));
const errors = [];
const missing = [];

for (const [gameId, game] of Object.entries(games)) {
    if (!game.icon) {
        missing.push(gameId);
        continue;
    }

    const iconPath = path.resolve(docsDirectory, game.icon);
    if (!iconPath.startsWith(`${docsDirectory}${path.sep}`)) {
        errors.push(`${gameId}: icon path escapes docs/`);
        continue;
    }
    if (!fs.existsSync(iconPath)) {
        errors.push(`${gameId}: missing ${game.icon}`);
        continue;
    }
    const iconContent = fs.readFileSync(iconPath);
    if (!iconContent.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )) {
        errors.push(`${gameId}: icon is not a valid PNG payload`);
    }

    const source = sources[gameId];
    if (!source) {
        errors.push(`${gameId}: missing SOURCES.json entry`);
        continue;
    }
    if (source.file !== path.basename(iconPath)) {
        errors.push(`${gameId}: source file does not match ${game.icon}`);
    }

    const hash = crypto
        .createHash("sha256")
        .update(iconContent)
        .digest("hex");
    if (source.sha256 !== hash) {
        errors.push(`${gameId}: SHA-256 does not match SOURCES.json`);
    }
    if (!source.source || !source.retrieved) {
        errors.push(`${gameId}: source URL and retrieval date are required`);
    }
}

for (const gameId of Object.keys(sources)) {
    if (!games[gameId]) {
        errors.push(`${gameId}: source entry has no matching game`);
    }
}

if (requireAll && missing.length) {
    errors.push(`missing icons: ${missing.join(", ")}`);
}

if (errors.length) {
    for (const error of errors) {
        console.error(`ERROR: ${error}`);
    }
    process.exitCode = 1;
} else {
    console.log(
        `Validated ${Object.keys(games).length - missing.length} sourced icons; `
        + `${missing.length} games still use fallbacks.`
    );
}
