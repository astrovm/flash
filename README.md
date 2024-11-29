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
npm install workbox-cli --save-dev

# Run deployment script
python tools/deploy.py
```
