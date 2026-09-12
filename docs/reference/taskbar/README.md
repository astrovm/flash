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

## Start artwork and background corrections

A follow-up comparison of the running XP VM at 1024×768 and the existing
1280×1024 captures found that the Start artwork is painted at 32 pixels high.
The single-row taskbar clips its last two rows; shrinking the artwork to
30 pixels instead exposed a blue line below Start. The 33-pixel source image
keeps its original sizing margins and is painted into a 32-pixel surface, with
the button clipped to the available taskbar height. Taller taskbars retain the
complete button, as in `vm-blue-top-multirow1280.png`.

The background uses the theme's `SizingType=Tile`, and its drawing bounds exclude
the unlocked taskbar's four-pixel resize strip. In
`completion/xp-blue-floating1280.png`, that strip occupies rows 990–993 and the
background begins at row 994. Bitmap rendering preserves the artwork's pixels
on high-density displays. The extracted source assets are unchanged.

The in-app browser checks covered Blue at 1280×720 and all four schemes at
1280×1024, including locked and unlocked Blue taskbars. These corrections address
the artwork and geometry; they do not establish universal font rasterization
parity with XP.

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

Folder and Desktop toolbars now display inline items and overflow menus, with
independent sizing, ordering, and detachable floating windows. Quick Launch
supports adding, ordering, launching, and removing shortcuts; removal does not
delete the original item. Floating windows use original Luna small-caption,
frame, close-button, and toolbar resources, or Classic system colors.
See the [completion evidence](completion/README.md) for the new comparisons,
regressions, and remaining fidelity limits.

Only the working Volume notification is customizable. Hide when inactive uses
ten minutes without interaction; this is a simulation heuristic. Expanded icons
collapse after leaving the tray, while keyboard focus and an open Volume popup
keep them available. Narrow-screen task overflow and horizontally scrollable
crowded toolbar bands are web adaptations.

Start menu contents, application window frames, and the interiors of Date and
Time Properties and Volume Control remain separate areas. Browser font
rasterization still prevents a universal pixel-identical XP match.

## Validation

219 tests pass across 39 files. Formatting, lint, type checking, browser
JavaScript/icon validation, production build, and authenticated verification of
483 extracted assets cover the implementation. The completion notes record
which interactions were checked directly in the browser and original VM.
