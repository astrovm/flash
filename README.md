# Astro Flash Collection

A Windows XP-style desktop for playing classic Flash, HTML5, and DOS games in
the browser.

[Open Astro Flash Collection](https://flash.4st.li/)

## Highlights

- Authentic Windows XP shell, Explorer, Notepad, themes, and display settings
- Flash emulation with Ruffle and DOS emulation with js-dos
- Draggable game windows, task switching, fullscreen, and volume controls
- Favorites, recently played games, categories, search, and deep links
- Automatic offline support for the desktop and optional game downloads
- Internet Games catalog backed by Flashpoint Archive

## Development

Install dependencies and run the test suite:

```bash
bun install --frozen-lockfile
python -m pip install -r requirements.txt
bun run test
```

Build and serve the production site locally:

```bash
bun run build
python tools/dev_server.py --port 8000
```

Open <http://127.0.0.1:8000>. The development server also provides the local
`/api/games` proxy used by Internet Games.

## Project layout

- `site/` — authored static site
- `worker/` — Cloudflare Worker for the Internet Games catalog
- `tools/` — build, validation, and asset maintenance scripts
- `tests/` — Bun/TypeScript and Python tests
- `dist/` — generated production build; ignored by Git

## Games and offline storage

Included games are defined in `site/js/games.js`. Flash games use `type: "swf"`;
DOS and HTML5 games use `type: "iframe"`.

```javascript
{
  type: "swf",
  title: "Display Name",
  icon: "assets/icons/game.png",
  category: "Racing",
  frameRate: 45,
  aspectRatio: 480 / 360,
  spoofUrl: "example.com",
}
```

The Windows XP shell is cached automatically. Included games can be downloaded
individually or all at once from **Settings > Offline**. The shared Ruffle
runtime is downloaded when the first Flash game is selected.

Games installed through **Internet Games** are stored separately in IndexedDB
and Cache Storage. GameZIP titles are installed fully; Legacy titles cache
additional files as they are requested.

Icon sources and checksums live in `site/assets/icons/SOURCES.json`. Validate
them with:

```bash
bun run validate:icons
```

## Deployment

Pushes to `main` run tests, build the site, deploy and smoke-test the Cloudflare
Worker, and then publish to GitHub Pages. Pull requests run the same validation
without deploying.

The repository requires these GitHub Actions secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The API token needs **Workers Scripts: Edit** for the account and **Workers
Routes: Edit** for the `4st.li` zone.

To deploy the Worker manually:

```bash
bun run deploy:worker
```

Ruffle is pinned in `tools/ruffle-release.json`. A weekly workflow checks for
new stable releases and opens a reviewable pull request.

## Contributing

Test game compatibility, controls, frame rate, and categorization before
submitting a pull request. Run `bun run test` before pushing.
