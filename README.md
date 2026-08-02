# Astro Flash Collection

A Windows XP-style desktop for playing classic browser games with Ruffle,
js-dos, ScummVM, and embedded web runtimes.

[Open Astro Flash Collection](https://flash.4st.li/)

## Highlights

- Authentic Windows XP shell, Explorer, Notepad, themes, and display settings
- Draggable game windows, task switching, fullscreen, and volume controls
- Favorites, recently played games, categories, search, and deep links
- Automatic offline support with optional per-game downloads
- Internet Games catalog backed by Flashpoint Archive

## Development

Install dependencies and run the checks:

```bash
bun install --frozen-lockfile
bun run quality
bun run test
```

Build and serve the production site locally:

```bash
bun run dev
```

Open <http://127.0.0.1:8000>. The development server watches build inputs,
rebuilds automatically, and reloads open browser tabs after a successful build.
It also provides the local `/api/games` proxy used by Internet Games and starts
immediately when `dist/` is already current. Use
`bun run dev -- --rebuild` to force a rebuild or `--no-sync` to serve the
existing output unchanged.

## Project layout

- `site/` — authored static site
- `worker/` — Cloudflare Worker for the Internet Games catalog
- `tools/` — build, validation, and asset maintenance scripts
- `tests/` — Bun/TypeScript tests
- `dist/` — generated production build; ignored by Git

## Games and offline support

Included games are defined in `site/js/games.js`. Ruffle games use `type: "swf"`;
embedded HTML5, js-dos, ScummVM, and reVCDOS games use `type: "iframe"`.

The Windows XP shell is cached automatically. Opening an included game queues a
complete background download for offline play. Games can also be downloaded or
removed individually, or all at once, from **Settings > Offline**. The shared
Ruffle and ScummVM runtimes are downloaded only when needed.

Games installed through **Internet Games** are stored separately in IndexedDB
and Cache Storage. GameZIP titles are installed fully; Legacy titles cache
additional files as they are requested.

## Deployment

Pushes to `main` run tests, build the site, deploy and smoke-test the Cloudflare
Worker, and then publish to GitHub Pages. Pull requests run the same validation
without deploying.

The repository requires these GitHub Actions secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The API token needs **Workers Scripts: Edit** for the account and **Workers
Routes: Edit** for the `4st.li` zone.

Deploy the Worker manually with:

```bash
bun run deploy:worker
```

Ruffle is pinned in `tools/ruffle-release.json`. A weekly workflow checks for
new stable releases and opens a reviewable pull request.

## Contributing

Test game compatibility, controls, frame rate, and categorization before
submitting a pull request. Run `bun run quality && bun run test` before pushing.
