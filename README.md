# Astro Flash Collection

Use a Windows XP-style desktop in your browser to play classic games and run
selected original Windows XP applications.

[Open Astro Flash Collection](https://flash.4st.li/)

## Highlights

- Windows XP-style shell, Explorer, Paint, Notepad, original XP applications, Pinball, themes, and settings
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

To test production service-worker and offline-update behavior with automatic
rebuilds, run:

```bash
bun run preview
```

Preview serves the real production worker and gives each changed build a new
local version. It intentionally does not reload the page after rebuilding; use
**Settings > Updates > Check for Updates** to exercise the update flow.

### XP reference VM

Start an isolated XP reference VM:

```bash
bun run xp:vm --instance <name>
```

VM changes are temporary by default, so multiple sessions can share the base
disk. Use `--write-base` only when changes must be saved to that disk.

## Project layout

- `site/apps/` — first-party applications, manifests, and lifecycle modules
- `native/pinball/` — MIT Space Cadet source used to build the first-party WebAssembly runtime
- `native/boxedwine/` and `site/vendor/boxedwine/` — native window control and the patched BoxedWine runtime
- `site/js/shell/` — desktop, windows, taskbar, Start menu, and shell services
- `site/js/apps/` — temporary shell adapters used by application modules
- `site/css/shell/` and `site/css/apps/` — shell and application presentation
- `site/assets/xp/` — assets extracted from the configured Windows XP source media
- `worker/` — Cloudflare Worker for the Internet Games catalog
- `tools/` — build, validation, and asset maintenance scripts
- `tests/` — Bun/TypeScript tests
- `dist/` — generated production build; ignored by Git

## Games and offline support

Catalog games are defined in `site/js/games.js`. Ruffle games use `type: "swf"`;
embedded HTML5, js-dos, ScummVM, and reVCDOS games use `type: "iframe"`.
Original XP applications such as Calculator, WordPad, and the card games are
registered in `site/apps/core/boxedwine-applications.js` and share a BoxedWine
runtime. Windows XP Pinball is mounted directly from `site/apps/pinball/`.

The Windows XP shell is cached automatically. Opening an included game queues a
complete background download for offline play. Games can also be downloaded or
removed individually, or all at once, from **Settings > Games**. Shared Ruffle,
ScummVM, and BoxedWine runtimes are downloaded only when needed.

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

## Contributing

Test game compatibility, controls, frame rate, and categorization before
submitting a pull request. Run `bun run quality && bun run test` before pushing.
