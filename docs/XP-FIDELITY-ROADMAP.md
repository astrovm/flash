# Windows XP fidelity handoff

Updated after the FreeCell pass. Areas 1 to 9 are done, and area 10 is in progress. Each finished area links its evidence, decisions,
and verification limits in the table below.

## Working agreement

- Work in startup/use order. Finish the current area before opening the next.
- Run the original XP VM and the app in the in-app browser. Compare actual
  behavior and original resources; do not invent assets or reference details.
- Keep screenshots at their captured dimensions. Use 1024×768, 1280×1024, and
  1920×1080 (`bun run xp:vm -- --vga std`), plus a narrow viewport for web
  usability. Do not resize screenshots
  to make comparisons fit. Record actual guest mode, browser viewport, and any
  unavailable display-density checks.
- Zoom and display scaling must look sharp at any ratio. On fractional ratios
  (125%, 150%, 175%) `site/js/shell/display-scale.js` lays the page out at
  the next whole ratio and scales the frame down, so XP's one-pixel art never
  lands between device pixels. Canvases draw at that whole ratio. Check new
  work at 1× and 1.25×.
- Blue, Olive Green, Silver, and Windows Classic must work throughout the app.
  Validate each area in all four schemes, rather than postponing themes.
- Use native DOM text and the original extracted fonts globally. Browser text
  rasterization differs from XP GDI; do not reinstate bitmap labels to hide it.
- Expose controls only when they have a meaningful, working simulation action.
  Decide whether to implement or omit unsupported features before polishing them.
  Do not add explanatory placeholder text inside XP interfaces.
- Preserve the accepted web conveniences: adaptive, click-skippable boot;
  welcome skipping; desktop upload; and usable narrow-screen layouts.
- Automatic updates must not reload the current session. Only the manual update
  action may reload, with visible status in Astro Flash Settings.
- Record evidence and remaining gaps honestly. Close temporary tabs, servers,
  and disposable VMs when finished. Open a PR when the area is ready for review.

## Taskbar and notification area: merged

Merged work includes original theme artwork, task/tray interactions, docking on
all four edges, resizing, locking, auto-hide, Keep on top, Explorer grouping,
Quick Launch shortcut addition/removal, virtual-folder toolbars, and Volume
notification customization. It also fixes updater feedback and repeated startup
sound playback. See [taskbar evidence and boundaries](reference/taskbar/README.md).

### Toolbar implementation completed

- [x] Independent band sizing, ordering, and persistence.
- [x] Floating toolbars, title dragging, resizing, closing, and redocking.
- [x] Inline folder/Desktop items, labels, grips, overflow, and working context options.
- [x] Quick Launch shortcut ordering and overflow without moving original desktop items.
- [x] Expanded-tray collapse after leaving, with Volume interaction kept available.
- [x] Crowding-based Explorer grouping and native group context actions.
- [x] Original small-caption/frame/toolbar resources for all Luna schemes and Classic gradients.
- [x] Narrow notification spacing, single owned startup audio, and session teardown regressions.

### Verification and boundaries

The completion notes distinguish direct VM observations, original ISO settings,
and browser checks. The ten-minute Volume inactivity rule remains a simulation
heuristic. The reference VM now has a working AC97 sound card, so Volume can
be compared directly in later passes. See the [VM audio checks](reference/vm-audio/README.md).
The grouping width and flash cadence are approximations; the native
nine-to-ten-window boundary and default flash count are recorded separately.
These are not claims of universal pixel or timing identity.

Issue #151's fresh-load duplicate was not reproduced in the in-app browser.
The implementation fixes retry ownership and Restart overlap, and the issue was
closed on 2026-09-12 without a device confirmation. Retain this qualification
when describing taskbar completion.

Links is currently omitted because there is no implemented browser Favorites
source. Network folders and host bookmarks are not offered by New Toolbar.
Only Volume is a working customizable tray notification. Do not add fake
network, antivirus, or hardware indicators just to fill the tray.

## Areas and order after the taskbar

The order below follows the normal journey from entering the desktop to opening
and using applications, then ending the session. It is a handoff sequence;
individual app scope decisions still require inspection.

| Order | Area                                     | Status / completion target                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Boot                                     | Prior scoped pass merged. Preserve original assets, minimum progress visibility, black handoff, and accepted adaptive/click-skip behavior. [Evidence](reference/boot/README.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2     | Welcome and logon                        | Prior scoped pass merged. Preserve native fonts, selection/loading states, session switching, and sound distinction. Repeated-click sound fix merged in #149. [Evidence](reference/welcome/README.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 3     | Desktop                                  | Prior scoped pass merged. Preserve layout, selection, drag/drop, file actions, theme behavior, and upload. [Evidence](reference/desktop/README.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 4     | Taskbar and notification area            | Merged (#153 to #156); retain the documented fidelity and #151 verification limits.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 5     | Start menu                               | Done. Both menu styles, flyouts, the Start button menu, and both Customize dialogs compared and fixed ([evidence](reference/start-menu/README.md)). Shared tab, Help button, and spin control gaps move to area 6.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 6     | Shared windows and dialogs               | Done. Luna frames, captions, menu bars, scrollbars, common controls, message boxes, property sheets with What's This help, the window menu, and Open/Save As compared and fixed ([evidence](reference/windows-dialogs/README.md)).                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 7     | Explorer and the virtual filesystem      | Done. Explorer bands, toolbar icons, task pane, tiles, real My Computer contents, Shared Documents, Other Places, Details, inline rename, and Recycle Bin tasks compared and fixed ([evidence](reference/explorer/README.md)).                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 8     | Display Properties                       | Done. Dialog frame, ? help, all five tabs, Luna samples for the pending scheme, Windows and buttons, color quality, the trackbar, and the up-down compared and fixed ([evidence](reference/display-properties/README.md)).                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 9     | Remaining system utilities               | Done. Date and Time Properties, Task Manager, Volume Control, and Control Panel compared and fixed ([evidence](reference/system-utilities/README.md)).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 10    | Applications and games                   | In progress. FreeCell ([evidence](reference/freecell/README.md)) and Solitaire ([evidence](reference/solitaire/README.md)) are rebuilt web-native from their XP executables on a shared `cards.dll` engine. Spider Solitaire, Hearts, and Calculator follow, then Minesweeper's fidelity pass, then BoxedWine and WordPad are removed. Inventory retained browser apps and original XP application runtimes. Finish one application at a time: launch, UI, input, file open/save where applicable, sound, focus, resize, close/reopen, and errors. Then verify game launch/runtime integration and session behavior. Do not restore removed Winamp or Security Center as placeholders. |
| 11    | Astro Flash Settings and web integration | This is a product-specific area, not a native XP app to copy. Verify actual update/offline/download status, errors/retry, storage and reset, installed games, and deep links. Preserve manual-only update reload and accurate progress feedback.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 12    | Logoff, restart, shutdown, and recovery  | Complete the end-of-session flow: dialogs, cancellation, unsaved work, session teardown, sounds, restart back through boot, and recovery from failed loading. Preserve already verified Welcome/session behavior.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 13    | Whole-session regression                 | Run the complete journey across four themes and multiple resolutions, including persistence/reopen, offline/update transitions, multiple windows, keyboard use, and resource cleanup. This is integration verification, not a substitute for finishing each area.                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Resume procedure

1. Pull merged main and read this document plus the taskbar reference README.
2. Read the remaining differences in the finished areas' reference notes
   before starting the next area.
3. For each exposed feature, classify it as a real simulation action, an agreed
   web adaptation, or an omission. Record unresolved choices rather than
   silently treating them as approved exceptions.
4. Implement the bounded area, run relevant regressions and repository checks,
   capture unscaled VM/browser evidence, and review the resulting diff.
5. Update this checklist and the area's reference notes in its implementation
   PR. Keep future areas pending until they have their own comparison pass.

Main currently has 1137 passing tests across 87 files at 100% coverage, and
verifies 891 extracted assets against the original ISO.
