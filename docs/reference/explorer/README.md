# Explorer and the virtual filesystem

This pass compares My Computer, My Documents, and the Recycle Bin with the
original XP SP3 VM at 1024×768, with each app window moved to the VM window's
position and size. It builds on the shared window and dialog pass.

## Reference

| View         | VM                             | App                             |
| ------------ | ------------------------------ | ------------------------------- |
| My Computer  | `xp-my-computer-1024x768.png`  | `app-my-computer-1024x768.jpg`  |
| My Documents | `xp-my-documents-1024x768.png` | `app-my-documents-1024x768.jpg` |
| Recycle Bin  | `xp-recycle-bin-1024x768.png`  | `app-recycle-bin-1024x768.jpg`  |

## Matched

- The menu, toolbar, and address bands use XP's heights, etched separators,
  and lighter rebar colors; their rows match the VM pixel for pixel.
- Toolbar buttons use shell32's 24px Back, Forward, Up, Search, Folders, and
  Views icons, and the address box uses the Luna drop-down button.
- The task pane uses XP's gradient, 12px margins, 25px section headers,
  20px task rows with 16px icons, and Luna's collapse and expand buttons.
- Tiles use regular-weight names, 48px icons, XP's column width and group
  spacing, no hover box, and the selection drawn on the name. Group headings
  use a 1px fading underline. The group rows match the VM.
- My Computer lists only real places: Shared Documents, astro's Documents,
  Local Disk (C:), Local Disk (D:), and Removable Disk (F:), in XP's groups.
  Before this pass it showed My Music as "Shared Documents", My Pictures as
  "Administrator's Documents", and the drives as a floppy and a CD.
- Shared Documents is a real folder at C:\Documents and Settings\All Users\
  Documents and is shown under XP's name.
- The address bar names My Documents, Shared Documents, and the Desktop, and
  shows paths elsewhere. Folders have no heading, and system folders show
  only their names.
- Other Places changes with the folder, and Details names the selection or
  the open folder, with the date and size for files.
- File and Folder Tasks offer Make a new folder, Rename this file or folder,
  Delete this file or folder, and Delete the selected items, depending on the
  selection.
- Rename is inline on the item's label, like XP, instead of a browser prompt.
- Delete confirmations use XP's wording, titles, and Recycle Bin icon.
- The Recycle Bin shows Empty the Recycle Bin and Restore all items, this
  item, or the selected items only when they apply. Empty folders are blank.
- Clicking empty space clears the selection.

## Astro Flash adaptations

- My Network Places, Favorites, and Tools are omitted because the simulation
  has no network, favorites, or folder options.
- Tasks with no simulation behind them are omitted: Publish this folder to
  the Web, Share this folder, slide shows, printing, and online ordering.
  They were shown disabled before.

## Remaining differences

- Text rasterization differs from XP by about 1px.
- The Details section starts expanded; XP remembers whether each section was
  collapsed.
