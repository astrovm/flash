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

### Local testing

```bash
python tools/dev_server.py --port 8000
```

Use the `--port` flag to change the listening port (defaults to `8000`).

### Deployment

The project includes deployment scripts that handle:
- Updating Ruffle to the latest version
- Versioning CSS and JS files
- Generating service worker for offline mode

To deploy:

```bash
# Install dependencies
bun add workbox-cli --dev
python -m pip install -r requirements-dev.txt

# Run deployment script
python tools/deploy.py
```

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

Game definitions live in `docs/js/games.js`. Icon provenance and checksums live
in `docs/assets/icons/SOURCES.json`; run `bun run validate:icons` to ensure every
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
