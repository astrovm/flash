# Taskbar and notification area

This pass covers the docked taskbar, Start button, task buttons, taskbar
menus, clock, and tray volume popup. Start menu contents, application window
frames, and the interiors of Date and Time Properties and Volume Control remain
separate areas. The taskbar launch actions for those applications are tested.

## Reference

The local XP SP3 VM was run with a disposable snapshot. Audio was enabled with
`bun run xp:vm -- --instance taskbar-reference --audio-output /private/tmp/taskbar-reference.wav`
to inspect the original quick volume popup. The VM uses the authenticated local
XP ISO; extracted artwork and fonts have provenance in `site/assets/xp/SOURCES.json`.

`luna-metrics.json` records the original theme sections used for sizing margins,
font choices, and text colors. Luna background and button resources are rendered
with their original edge sizes. The extraction manifest records the crop for
each state in a bitmap strip; extraction verification checks the decoded pixels.
The Start label uses live text with XP's Franklin Gothic Medium Italic font. The
previous bitmap containing the rendered Start label has been removed.

| Scheme          | VM capture | App captures           |
| --------------- | ---------- | ---------------------- |
| Blue            | 1024×768   | 1024×768 and 1280×1024 |
| Olive Green     | 1024×768   | 1024×768 and 1280×1024 |
| Silver          | 1280×1024  | 1024×768 and 1280×1024 |
| Windows Classic | 1280×1024  | 1024×768 and 1280×1024 |

All screenshots retain their native dimensions. VM screenshots are PNGs; app
screenshots use the browser's JPEG capture. The high-resolution VM captures use
16-bit color. Browser font rasterization and color handling differ from XP, so
this is not a claim of identical pixels on every host display. The two systems
also have different applications and notification icons installed.

## Behavior checked

- Clicking an active task minimizes it; clicking its minimized task restores it.
- Explorer's task label follows the displayed folder, including Recycle Bin.
- At 390×844, a four-window taskbar exposes its hidden windows through an on-screen
  overflow menu. Selecting Recycle Bin there activates that window.
- Show the clock applies immediately, survives reload, and is reflected when
  Taskbar Properties is reopened. The test setting was restored afterwards.
- The clock uses the reference installation's English date and 12-hour time
  format. Double-click opens Date and Time Properties; Enter/Space also opens it
  for keyboard access, while a single pointer click does not.
- Single-clicking Volume opens the quick popup; double-click or its context menu
  opens Volume Control. The popup closes when that application opens.
- Moving the slider while muted keeps Mute checked, as directly observed in XP.
  The app check moved volume from 100 to 99 with Mute still selected, then restored
  volume to 100 and cleared Mute.
- Escape and outside-click dismissal work for the tray and taskbar menus.

## Docking and toolbar follow-up

The disposable XP VM was also compared at 1024×768 and 1280×1024 with
unlocked, left, right, and top taskbars. The additional VM PNGs and browser JPEGs
retain their native dimensions; no screenshot scaling was used. The native top
capture has a 360-pixel multirow taskbar, not the app's one-row configuration.
The four app themes were checked with vertical taskbars at both resolutions.
Original Luna resources supply the vertical backgrounds, sizing edges, grips,
and notification expansion buttons. The Show Desktop icon comes from explorer.exe.

The in-app browser verification covered:

- Dragging an unlocked taskbar to all four edges, changing its width and row
  count, and preventing dragging while locked.
- Auto-hide leaving a two-pixel reveal edge and returning on pointer entry.
- Disabling Keep on top allowing the desktop to occupy the full screen, with
  Ctrl+Esc raising the taskbar and opening Start.
- Maximized windows fitting the remaining desktop with a two-row taskbar.
- Three Explorer windows grouping at 390×844, with the group menu activating
  the selected folder window.
- Dragging My Documents from the desktop into Quick Launch, launching it there,
  and keeping the original desktop shortcut in place.
- A My Documents folder toolbar opening a menu of its actual contents.
- Choosing Always hide for Volume, applying the parent dialog, then expanding
  and collapsing the hidden notification icon.

## Simulation boundaries

Desktop and folder toolbars expose the simulation's real files and shortcuts.
New Toolbar creates folders in that filesystem. Links is omitted because there
is no implemented browser Favorites source. Network locations and host browser
bookmarks are not presented as available folders.

Folder toolbars use compact content menus. Independent floating toolbars,
individual toolbar width adjustment, and toolbar reordering are not implemented.
Quick Launch supports adding desktop shortcuts and removing its shortcuts;
removal does not delete the original item. Only the working Volume notification
is customizable. Hide when inactive uses ten minutes without interaction in the
simulation; this is not a verified reproduction of XP's inactivity heuristic.
The narrow-screen task overflow menu is a browser adaptation.

Start menu contents, application window frames, and the interiors of Date and
Time Properties and Volume Control remain separate areas. Browser font
rasterization still prevents a universal pixel-identical XP match.

## Validation

212 tests pass across 39 files, including taskbar setting persistence, docking,
resizing, auto-hide, grouping, notification customization, folder toolbars, and
Quick Launch shortcut ownership. Type checking, browser JavaScript/icon
validation, formatting, lint, production build, and authenticated extraction
verification cover the implementation and original assets.
