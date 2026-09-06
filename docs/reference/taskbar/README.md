# Taskbar and notification area

This pass covers the horizontal taskbar, Start button, task buttons, taskbar
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

## Simulation boundaries

The taskbar remains fixed at the bottom and on top of application windows.
Unlocking/resizing/docking, auto-hide, Quick Launch and other toolbars, XP-style
similar-application grouping, and inactive-notification customization are not
implemented. Their existing controls are now disabled instead of accepting
changes without applying them. The placeholder Customize Notifications message
was removed. The responsive overflow menu is an intentional browser adaptation.

## Validation

201 tests pass across 39 files, including regressions for clock persistence,
Volume Control launching, Explorer task titles, and preserving mute while moving
the slider. Type checking, browser JavaScript/icon validation, formatting, lint,
production build, and authenticated extraction verification pass. The browser
verification includes the two desktop resolutions above and the narrow overflow
case. No console errors were reported during the final browser check.
