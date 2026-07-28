# Flash Collection

A curated archive of Flash games

## Features

- Windows XP desktop simulation with boot, login and turn-off screens
- Windows XP assets: Bliss wallpaper, arrow cursor, boot/login artwork and system sounds
- Games as desktop icons, opened in draggable/resizable windows
- Start menu with game categories, search, favorites and recently played
- Taskbar with window buttons and tray clock
- Flash emulation by Ruffle
- DOS emulation by js-dos
- Play offline, no internet connection required
- FPS optimized per game
- Fast CDN
- Flawless screen adaptation
- No requests to external resources
- Automatic sitelock bypass
- Fullscreen support
- Volume controls for both Flash and HTML5 games
- Persistent volume settings across sessions
- Mute/unmute functionality
- Per-window volume controls with focus-based muting
- Up to 4 game windows open simultaneously
- Deep linking via URL hash (#game-id)

## Development

The authored static site lives in `site/`. Deployment-only files are generated
in the ignored `dist/` directory and must not be committed.

### Tests

```bash
bun install --frozen-lockfile
python -m pip install -r requirements-dev.txt
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
`--directory` to serve another completed build.

### Deployment

Pushes to `main` are tested, built, and deployed to GitHub Pages by
`.github/workflows/pages.yml`. Pull requests run the same tests and production
build without deploying. The build:

- Copies `site/` into a fresh `dist/`
- Downloads the pinned self-hosted Ruffle release and verifies its SHA-256
- Generates a date-plus-commit deployment version and asset hashes
- Generates the Workbox service worker
- Validates representative Flash, DOS, and HTML5 artifacts

The Pages repository setting must use **GitHub Actions** as its source. The
custom domain remains configured in the repository Pages settings; `site/CNAME`
is retained for documentation and rollback compatibility.

Ruffle release metadata is pinned in `tools/ruffle-release.json`. A weekly
workflow checks for a newer stable release and opens a reviewable dependency PR.
Repository settings must allow GitHub Actions to create pull requests for that
automation to work. Ruffle update PRs are never auto-merged.

### Game Support

The collection supports two types of games:
- SWF (Flash) games using Ruffle emulation
- DOS and HTML5 games via iframe integration

Each game can be configured with specific settings:
```javascript
{
    type: "swf",              // Game type: "swf" or "iframe"
    title: "Display Name",     // Optional: Preserve original title styling
    icon: "assets/icons/x.png", // Sourced PNG used throughout the shell
    frameRate: 45,            // Optional: Set specific frame rate
    category: "Racing",       // Game category for organization
    aspectRatio: 480/360,     // Optional: Force specific aspect ratio
    spoofUrl: "example.com"   // Optional: URL spoofing for sitelock bypass
}
```

Game definitions live in `site/js/games.js`. Icon provenance and checksums live
in `site/assets/icons/SOURCES.json`; run `bun run validate:icons` to ensure every
game has a valid, source-documented PNG. `tools/sync_game_icons.py` contains the
reviewed Flashpoint UUID mappings and can refresh those assets without fuzzy
auto-matching.

### Volume Control Implementation

The project implements unified volume controls that work across both Flash and HTML5 games:
- Flash games use Ruffle's native volume control
- HTML5 games use postMessage API for volume control
- Volume settings persist in localStorage
- Supports mute/unmute with volume memory
- Volume slider with real-time updates

### Contributing

Contributions are welcome! Please ensure that:
- Games are tested for compatibility
- Frame rates are optimized for performance
- Proper categorization is maintained
- Volume controls are working correctly
