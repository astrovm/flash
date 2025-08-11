# Repository Guidelines

## Project Structure & Module Organization
- `docs/`: Static site served and deployed. Includes `index.html`, `js/main.js` (UI, game loader, volume/favorites/recent logic), `css/main.css`, `swf/` and `iframe/` game folders, `sw.js` (generated), and assets.
- `tools/`: Helper scripts — `dev_server.py` (local server with no-cache headers), `deploy.py` (updates Ruffle, cache-busts assets, generates service worker), `swf.py` (SWF utilities).
- `workbox-config.js`: Service worker build settings. `package.json` declares `workbox-cli` as a dev dependency (managed with Bun).

## Build, Test, and Development Commands
- Local run: `python tools/dev_server.py` then open `http://localhost:8000`.
- Install tooling: `bun add workbox-cli --dev` (required for service worker generation).
- Deploy/build: `python tools/deploy.py` — downloads Ruffle, versions `js/css`, updates HTML version, and runs `workbox generateSW` to create `docs/sw.js`.
- Optional: `bunx workbox generateSW workbox-config.js` to debug SW generation.

## Coding Style & Naming Conventions
- JavaScript: ES2015+, 4-space indent, camelCase for variables/functions, semicolons. Keep logic in `docs/js/main.js`; prefer small, pure helpers.
- Python: 4-space indent, PEP 8 style in `tools/*.py`.
- Game IDs and folders: kebab-case under `docs/swf/` and `docs/iframe/` (e.g., `docs/swf/learn-to-fly/main.swf`, `docs/iframe/inside-the-firewall/index.html`).

## Testing Guidelines
- No automated tests; perform manual checks:
  - Start the dev server; open several games; verify fullscreen, search, favorites, recently played, and controls placement.
  - Confirm volume slider and mute work for both SWF (Ruffle) and iframe games; settings persist.
  - After `deploy.py`, enable Offline mode and reload to verify caching; ensure console has no errors.

## Commit & Pull Request Guidelines
- Commits: imperative mood with a short scope; prefer typed prefixes (`feat:`, `fix:`, `docs:`, `chore:`) consistent with history.
- PRs: include a clear description, linked issues, affected paths/games, and screenshots/GIFs for UI changes.
- Adding a game: place assets in the proper folder, then add an entry in `gamesList` in `docs/js/main.js` with `type` (`swf`/`iframe`) and optional `frameRate`, `aspectRatio`, `spoofUrl`, and `category`.

## Security & Configuration Tips
- CSP in `index.html` is strict; avoid new external origins.
- Service worker caches files up to ~25MB (see `workbox-config.js`); keep assets small or adjust the limit thoughtfully.
