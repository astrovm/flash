# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a curated Flash games archive that uses Ruffle for Flash emulation. The project provides a web interface for playing classic Flash games with modern browser support, featuring offline functionality, volume controls, favorites, and search capabilities.

## Development Commands

### Local Development Server
```bash
python tools/dev_server.py
```
This starts a local HTTP server on port 8000 serving from the `docs/` directory with cache-disabled headers for development.

### Deployment
```bash
# Install dependencies first
bun add workbox-cli --dev

# Full deployment process
python tools/deploy.py
```
The deployment script:
- Downloads the latest Ruffle emulator files from unpkg.com
- Updates HTML with cache-busting hashes for CSS/JS files
- Increments version numbers automatically (format: YY.MM.DD or YY.MM.DD-N)
- Generates service worker for offline functionality
- Cleans up old Ruffle core files

### Utility Scripts
```bash
# Extract SWF from Flash executable/projector files
python tools/swf.py <input_file>
```

## Architecture

### Core Structure
- `docs/` - Static web files (served directory)
  - `index.html` - Main application entry point
  - `js/main.js` - Core game management and UI logic
  - `css/main.css` - Styling and responsive design
  - `swf/` - Flash game files organized by game name
  - `iframe/` - HTML5 game files for iframe integration

### Game Configuration
Games are configured in `docs/js/main.js` within the `gamesList` object:
```javascript
"game-name": {
    type: "swf" | "iframe",     // Game type
    frameRate: 60,              // Optional: specific frame rate
    category: "Racing",         // Game category for organization
    aspectRatio: 480/360,       // Optional: force aspect ratio
    spoofUrl: "example.com"     // Optional: URL spoofing for sitelock bypass
}
```

### Key Features Implementation
- **Ruffle Integration**: Flash emulation with configurable frame rates per game
- **Volume Control**: Unified system for both Flash (Ruffle API) and HTML5 (postMessage) games with localStorage persistence
- **Offline Mode**: Service worker caches all assets for offline gameplay
- **Game Management**: Favorites system, recently played tracking, play count statistics
- **Responsive UI**: Adaptive controls positioning based on game container size

### Build System
- **Cache Busting**: SHA384-based hashing for CSS/JS files
- **Service Worker**: Workbox-generated for comprehensive offline caching (up to 25MB files)
- **Asset Management**: Automatic Ruffle updates and cleanup of old versions
- **Version Control**: Automatic date-based versioning with build numbers

### File Organization
- Games stored in `docs/swf/[game-name]/main.swf`
- HTML5 games in `docs/iframe/[game-name]/`
- Static assets cached with content-based hashing
- Service worker precaches all game assets for offline play

## Testing
No specific test framework is configured. Test manually using the development server and verify:
- Game loading and playback
- Volume controls functionality
- Offline mode operation
- Search and category filtering
- Responsive design across devices