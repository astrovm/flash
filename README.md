# Astro Flash Collection

**Classic games and Windows XP apps, right in your browser.**

A Windows XP-style desktop that runs in your browser. Play classic games and use selected original Windows XP applications without installing anything.

[Open Astro Flash Collection](https://flash.4st.li/)

## 🚀 Use

- Open [flash.4st.li](https://flash.4st.li/). There's nothing to install.
- Want a game offline? Open an included game once, or download it in **Settings → Games**.

## Features

- **XP shell.** Explorer, Paint, Notepad, Pinball, themes, and settings.
- **Original XP apps.** Such as Calculator, WordPad, and the card games.
- **Real windows.** Drag game windows around, switch tasks, go fullscreen, and set the volume.
- **Find games fast.** Favorites, recently played, categories, search, and deep links.
- **Offline play.** With optional downloads for individual games.
- **Internet Games.** A catalog backed by Flashpoint Archive.

## Offline and updates

- **The shell is cached automatically.** The XP desktop works offline without doing anything.
- **Included games cache themselves.** Opening one starts a background download so it works offline next time.
- **Manage downloads.** **Settings → Games** downloads or removes games one at a time or all together.
- **Runtimes load on demand.** The shared Ruffle, ScummVM, and BoxedWine runtimes download only when a game needs them.
- **Updates don't interrupt you.** They install in the background and leave the current page alone.
- **Switching versions.** Reopen the site to get the new version, or press **Update Now** to reload right away.
- **Internet Games are stored separately.** They live in IndexedDB and Cache Storage.
- **GameZIP titles install completely.** Legacy titles cache extra files as the game requests them.

Installing Internet Games needs a browser with IndexedDB, OPFS, and streaming responses.

## Your files

- **Each document is saved on its own.** Documents are separate IndexedDB records.
- **Old files come along.** Older localStorage files migrate automatically in a single transaction, and the old snapshot is kept as a recovery backup.
- **Saves are real saves.** A save finishes only after the database commits it.
- **Multiple tabs are safe.** Any tab can write, but if another tab changed the same file first, the save is rejected so the editor keeps its draft.

<details>
<summary><b>Getting started (development)</b></summary>

Install the Bun version pinned in `package.json`. CI reads the same pin.

```bash
bun install --frozen-lockfile
bun run dev
```

Then open <http://127.0.0.1:8000>.

The development server:

- builds the site into `dist/`
- watches the build inputs and rebuilds on change
- reloads open tabs after each successful build
- serves the local `/api/games` proxy that Internet Games uses
- starts immediately when `dist/` is already current

| Flag        | What it does                     |
| ----------- | -------------------------------- |
| `--rebuild` | Forces a fresh build             |
| `--no-sync` | Serves the existing output as is |

```bash
bun run dev -- --rebuild
```

### Testing offline updates

```bash
bun run preview
```

Preview serves the real production service worker and gives every rebuild a new local version. It does not reload the page for you. Use **Settings → Updates → Check for Updates** to walk through the update flow.

### XP reference VM

```bash
bun run xp:vm --instance <name>
```

This starts an isolated Windows XP VM to compare against. Changes are discarded when it stops, so several sessions can share one base disk. Pass `--write-base` only when a change must be saved to that disk.

The [fidelity roadmap](docs/XP-FIDELITY-ROADMAP.md) lists known taskbar gaps, finished reference passes, and the remaining areas in priority order.

</details>

<details>
<summary><b>Checks</b></summary>

Run these before pushing:

| Command                 | What it runs                           |
| ----------------------- | -------------------------------------- |
| `bun run quality`       | Prettier and ESLint                    |
| `bun run test`          | typecheck, tests, and asset validation |
| `bun run test:coverage` | tests with first-party coverage        |

Typechecking uses the native TypeScript 7 compiler from `@typescript/native`. TypeScript 6 stays installed because TypeScript ESLint still needs it.

Tests run in parallel worker processes. Each test file groups its tests under a `describe` that names the subject, and each test name is a lowercase, present-tense behavior that reads as a sentence after it, for example `Flash URL router` › `rejects ambiguous and unsafe routes`. Shell tests move XP timers forward with `shell.advanceTime(ms)` from `tests/helpers/shell-harness.ts` instead of waiting in real time.

`bun run test:coverage` instruments first-party code with Istanbul, including the classic scripts the shell harness loads into Happy DOM. It writes an HTML report to `coverage/index.html` and fails unless lines, statements, functions, and branches are all at 100%. Instrumentation slows the suite, so this run allows each test 30 seconds. CI enforces the same threshold on every pull request.

</details>

<details>
<summary><b>Project layout</b></summary>

| Path                                          | Contents                                                   |
| --------------------------------------------- | ---------------------------------------------------------- |
| `site/apps/`                                  | First-party applications, manifests, and lifecycle modules |
| `site/js/shell/`                              | Desktop, windows, taskbar, Start menu, and shell services  |
| `site/js/apps/`                               | Temporary shell adapters used by application modules       |
| `site/css/shell/`, `site/css/apps/`           | Shell and application styles                               |
| `site/assets/xp/`                             | Assets extracted from the configured Windows XP media      |
| `native/pinball/`                             | MIT Space Cadet source for the Pinball WebAssembly build   |
| `native/boxedwine/`, `site/vendor/boxedwine/` | Native window control and the patched BoxedWine runtime    |
| `worker/`                                     | Cloudflare Worker for the Internet Games catalog           |
| `tools/`                                      | Build, validation, and asset maintenance scripts           |
| `tests/`                                      | Bun and TypeScript tests                                   |
| `dist/`                                       | Generated production build, ignored by Git                 |

</details>

<details>
<summary><b>Games and applications</b></summary>

Catalog games live in `site/js/games.js`.

| Game kind                                    | `type`     |
| -------------------------------------------- | ---------- |
| Ruffle                                       | `"swf"`    |
| Embedded HTML5, js-dos, ScummVM, and reVCDOS | `"iframe"` |

Original XP applications are registered in `site/apps/core/boxedwine-applications.js` and share one BoxedWine runtime. Windows XP Pinball is mounted directly from `site/apps/pinball/`.

</details>

<details>
<summary><b>How Internet Games installs work</b></summary>

Installing a game streams the download into a temporary file in the browser's private filesystem (OPFS), validates the ZIP index, and extracts one file at a time into Cache Storage. Reads are bounded, and sizes and CRCs are checked. If the install is cancelled or fails, partial cache entries and the temporary archive are removed. This needs a browser with IndexedDB, OPFS, and streaming responses.

</details>

<details>
<summary><b>Deployment</b></summary>

Pull requests run formatting, lint, tests, the coverage check, and a production build. The protected `main` branch requires passing PR checks. Pushes to `main` build, deploy and smoke-test the Cloudflare Worker, and then publish the site to GitHub Pages.

CI needs these GitHub Actions secrets:

| Secret                  | Value                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID                                                                                 |
| `CLOUDFLARE_API_TOKEN`  | Token with **Workers Scripts: Edit** on the account and **Workers Routes: Edit** on the `4st.li` zone |

To deploy the Worker by hand:

```bash
bun run deploy:worker
```

</details>

<details>
<summary><b>Contributing</b></summary>

Before opening a pull request:

- Check game compatibility, controls, frame rate, and category.
- Make sure `bun run quality`, `bun run test`, and `bun run test:coverage` all pass.

</details>
