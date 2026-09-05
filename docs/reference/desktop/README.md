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
- Remove the non-XP desktop upload command, which discarded binary contents.

## Validation

`bun run test` passed 197 tests across 38 files, including eight desktop
interaction regression tests, type checking, browser JavaScript validation, and
sourced-icon validation. Formatting, lint, and the production build passed.

In-app browser checks covered all four schemes at both listed resolutions,
additive selection, submenu keyboard navigation, Tab leaving the icon group,
and creating, renaming, deleting, and emptying the test folders. The final browser
run reported no console errors. Drag cancellation is covered by regression tests;
a real browser drag gesture was not part of this verification.
