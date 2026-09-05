# Desktop reference comparison

This pass covers the desktop immediately after logon: wallpaper placement, icon
layout and selection, desktop context menus, and existing file interactions.
Taskbar, Start menu, and Display Properties visual fidelity are separate areas.

## Reference and captures

The reference is the local Windows XP SP3 VM, launched with
`bun run xp:vm -- --instance desktop-reference` using a disposable snapshot.
Original theme metrics come from `Luna.msstyles` extracted from the local XP ISO;
`luna-metrics.json` records the source hash and selection colors.

All captures retain their original resolution. No screenshot was resized for
comparison. App JPEGs are browser captures; VM PNGs are native framebuffer
captures. The VM and app have different desktop file inventories.

| Scheme          | VM reference                                          | App captures           |
| --------------- | ----------------------------------------------------- | ---------------------- |
| Blue            | 1024×768, arranged icons, selected icon, desktop menu | 1024×768 and 1280×1024 |
| Olive Green     | 1024×768                                              | 1024×768 and 1280×1024 |
| Silver          | 1280×1024                                             | 1024×768 and 1280×1024 |
| Windows Classic | 1280×1024                                             | 1024×768 and 1280×1024 |

The higher-resolution VM captures use 16-bit color. Browser font rasterization,
color handling, and JPEG capture compression can differ from the VM. These
captures support the layout and behavior corrections, not a claim of identical
pixels across platforms.

## Corrections

- Stretch wallpaper across the monitor, including the area behind the taskbar.
- Use the stock 75-pixel icon grid, original 32-pixel icons, Tahoma labels, and
  theme-specific selection colors. Classic labels do not use Luna's shadow.
- Arrange Recycle Bin with the other system icons instead of anchoring it to the
  bottom-right corner.
- Match desktop menu row spacing and Classic menu styling; keep submenus within
  the work area and keyboard navigation within the active menu.
- Repair additive and range selection, desktop keyboard focus, canceled drags,
  and sorting without implicitly enabling Auto Arrange.
- Ask for confirmation once when deleting from the context menu.
- Retain desktop upload as an intentional web convenience. Text is stored as
  text and binary files as data URLs, preserving bytes instead of discarding them.
- Replace the ordinary-file emoji fallback with original shell32 icons: group 1
  for generic files and group 152 for text documents, extracted at 32×32. Their
  provenance is recorded in `site/assets/xp/SOURCES.json`.

## Validation

`bun run test` passed 198 tests across 38 files, including nine desktop
interaction regression tests, type checking, browser JavaScript validation, and
sourced-icon validation. Formatting, lint, and the production build passed.

In-app browser checks covered all four schemes at both listed resolutions,
additive selection, submenu keyboard navigation, Tab leaving the icon group,
and creating, renaming, deleting, and emptying the test folders. The final browser
run reported no console errors.

The final pass used real in-app browser drag gestures at 1280×1024 and 1024×768:

- Move My Computer to empty space, confirm grid snapping, reload, and confirm its
  saved position.
- Move a text document into a newly created folder and open the folder to confirm
  the document moved.
- Drag that folder into Recycle Bin, then verify it appears there.
- Draw a selection rectangle from empty space and confirm the intersecting icons
  are selected.
- Enable Auto Arrange, drag an icon away, and confirm it returns to its grid slot.
- Upload a text file and PNG through the actual multi-file picker; open the text
  in Notepad and the PNG in Paint to verify their contents.
- Select both uploaded files and drag them together into Recycle Bin; confirm
  both appear there. The test fixtures remain recoverable in the local test bin.

`app-upload-paint-1024x768.jpg` shows the uploaded PNG rendered in Paint, and
`app-drag-recycle-1024x768.jpg` records the three recycled test objects. Pointer
cancellation remains covered by the automated regression test. The temporary
browser tab and viewport override were closed/reset after verification.
