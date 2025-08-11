# Flash Collection

A curated archive of Flash games

## Features

- Flash emulation by Ruffle
- Play offline, no internet connection required
- FPS optimized per game
- Fast CDN
- Flawless screen adaptation
- No requests to external resources
- Automatic sitelock bypass
- Game categories
- Favorites system
- Recently played tracking
- Fullscreen support
- Search functionality
- Volume controls for both Flash and HTML5 games
- Persistent volume settings across sessions
- Mute/unmute functionality
- Adaptive controls positioning

## Development

### Local testing

```bash
python tools/dev_server.py
```

### Deployment

The project includes deployment scripts that handle:
- Updating Ruffle to the latest version
- Versioning CSS and JS files
- Generating service worker for offline mode

To deploy:

```bash
# Install dependencies
bun add workbox-cli --dev

# Run deployment script
python tools/deploy.py
```

### Game Support

The collection supports two types of games:
- SWF (Flash) games using Ruffle emulation
- HTML5 games via iframe integration

Each game can be configured with specific settings:
```javascript
{
    type: "swf",              // Game type: "swf" or "iframe"
    frameRate: 45,            // Optional: Set specific frame rate
    category: "Racing",       // Game category for organization
    aspectRatio: 480/360,     // Optional: Force specific aspect ratio
    spoofUrl: "example.com"   // Optional: URL spoofing for sitelock bypass
}
```

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
