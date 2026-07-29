# Astro Flash Collection

A browser-based collection of classic Flash, HTML5, and DOS games presented as
a Windows XP desktop.

[Open Astro Flash Collection](https://flash.4st.li/)

## Features

- Windows XP shell with boot, login, shutdown, Start menu, taskbar, system tray,
  desktop context menus, and keyboard navigation
- Draggable and resizable game windows with minimize, maximize, fullscreen,
  task switching, taskbar overflow, and window arrangement controls
- Persistent virtual filesystem with Explorer windows, file operations, Recycle
  Bin, search, and an editable Notepad
- Game categories, favorites, recently played items, Run commands, and URL hash
  deep links
- Flash emulation through Ruffle and DOS emulation through js-dos
- Master and per-game volume controls, persistent settings, and automatic muting
  of unfocused games
- Desktop themes, wallpapers, screen savers, appearance schemes, and simulated
  display resolutions
- Automatic offline Windows XP shell plus individual or full included-game
  downloads with update checks, progress, storage reporting, and repair controls
- Internet Games catalog for finding, installing, playing, and uninstalling
  compatible Flashpoint GameZIP and Legacy titles

## Development

The authored static site lives in `site/`. Deployment-only files are generated
in the ignored `dist/` directory and must not be committed.

### Tests

```bash
bun install --frozen-lockfile
python -m pip install -r requirements.txt
bun run test
```

The test command runs the Python suite, the Node-backed behavioral suites,
JavaScript syntax checks, and icon validation.

### Local site

Build the deployable site and serve it locally:

```bash
bun run build
python tools/dev_server.py --port 8000
```

The server reads `dist/` by default and refuses to serve an unbuilt tree. Use
`--directory` to serve another completed build. It also provides the
same-origin `/api/games` catalog proxy used by Internet Games.

### Deployment

Pushes to `main` are tested, built, and deployed to GitHub Pages by
`.github/workflows/pages.yml`. Pull requests run the same tests and production
build without deploying. The build:

- Copies `site/` into a fresh `dist/`
- Downloads the pinned self-hosted Ruffle release and verifies its SHA-256
- Generates a date-plus-commit deployment version and asset hashes
- Generates uncached `version.json` metadata for client update checks
- Generates the Workbox service worker
- Validates representative Flash, DOS, and HTML5 artifacts

The Pages repository setting must use **GitHub Actions** as its source. The
custom domain remains configured in the repository Pages settings; `site/CNAME`
is retained for documentation and rollback compatibility.

Ruffle release metadata is pinned in `tools/ruffle-release.json`. A weekly
workflow checks for a newer stable release and opens a reviewable dependency PR.
Repository settings must allow GitHub Actions to create pull requests for that
automation to work. Ruffle update PRs are never auto-merged.

The Windows XP application shell is cached automatically. Included games are
kept out of that small default download and can be saved individually or all at
once from Settings > Offline. The shared Ruffle runtime is downloaded once when
the first Flash game is selected. Astro Flash checks for updates at startup,
when connectivity returns, and when a long-lived tab becomes visible again. An
installed update waits for user confirmation before the worker activates and
reloads the page.

### Internet Games catalog

The browser keeps installed game metadata in IndexedDB and extracted GameZIP
files in a dedicated Cache Storage cache. These files are device-local and are
not part of the generated offline collection.

Production uses `worker/catalog-worker.mjs` as a same-origin `/api/games*`
Cloudflare Worker route in front of the GitHub Pages origin. The production
route is declared in `worker/wrangler.toml`. Deploy it locally with:

```bash
bun run deploy:worker
```

Pushes to `main` deploy and smoke-test the Worker before GitHub Pages is
released. The repository must define `CLOUDFLARE_ACCOUNT_ID` and a narrowly
scoped `CLOUDFLARE_API_TOKEN` as GitHub Actions secrets. The Worker normalizes
Flashpoint search metadata and relays supported game files because the upstream
services do not permit direct browser downloads from this site.

Internet Games supports playable Flash entries stored as either GameZIP or
Legacy data. GameZIP installations are fully local. Legacy installations keep
the launch SWF immediately and cache additional assets as the game requests
them. Other platforms remain unsupported.

### Game Support

The collection supports two types of games:

- SWF (Flash) games using Ruffle emulation
- DOS and HTML5 games via iframe integration

Each game can be configured with specific settings:

```javascript
{
  type: "swf",               // "swf" or "iframe"
  title: "Display Name",      // Optional display title
  icon: "assets/icons/x.png", // Sourced PNG used throughout the shell
  frameRate: 45,             // Optional frame rate
  category: "Racing",
  aspectRatio: 480 / 360,    // Optional forced aspect ratio
  spoofUrl: "example.com",   // Optional URL spoofing for sitelock compatibility
}
```

Game definitions live in `site/js/games.js`. Icon provenance and checksums live
in `site/assets/icons/SOURCES.json`; run `bun run validate:icons` to ensure every
game has a valid, source-documented PNG. `tools/sync_game_icons.py` contains the
reviewed Flashpoint UUID mappings and can refresh those assets without fuzzy
auto-matching.

### Contributing

Contributions are welcome! Please ensure that:

- Games are tested for compatibility
- Frame rates are optimized for performance
- Proper categorization is maintained
- Volume controls are working correctly
