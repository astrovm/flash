# Start menu

This pass compares the Luna Start menu, All Programs, and the right-column
submenus with the original XP SP3 VM at 1024×768. The Classic Start menu was
checked for regressions only.

## Reference

The local VM was run with `bun run xp:vm -- --instance startmenu` using a
disposable snapshot. The app was captured in headless Chromium at the same
1024×768 viewport. VM screenshots are PNGs; app screenshots are JPEGs.

| View                | VM                             | App                       |
| ------------------- | ------------------------------ | ------------------------- |
| Start menu          | `xp-blue-1024x768.png`         | `app-start-1024x768.jpg`  |
| All Programs, Games | `xp-games-1024x768.png`        | `app-games-1024x768.jpg`  |
| My Recent Documents | `xp-recent-1024x768.png`       | `app-recent-1024x768.jpg` |
| All Programs        | `xp-all-programs-1024x768.png` |                           |

## Matched

- Right column rows are 30 pixels high. The places group is bold; Control
  Panel, Search, and Run are regular weight.
- Separators are short and fade at both ends. Control Panel has its own group,
  like XP's Control Panel group.
- Access-key underlines stay hidden until the keyboard is used, in both menu
  styles.
- Highlighted places are solid blue with white text and stay highlighted while
  their submenu is open.
- My Recent Documents opens a submenu with an arrow. An empty list shows a
  disabled "(Empty)" item.
- Log Off and Turn Off Computer use shell32's 24-pixel key and power icons,
  positioned and spaced like XP, without the extra text shadow.
- The All Programs item is inset like XP. Its flyout opens from the item's
  right edge and grows upward from its bottom.
- Program flyouts size to their longest entry and use XP's 11-pixel text,
  icon spacing, and arrow gap.

## Astro Flash adaptations

- The pinned item is Internet Games, shown like XP's pinned items with a bold
  name, a gray "Flashpoint Archive" subtitle, and a separator.
- The most-used list shows favorites and recently played games.
- My Recent Documents lists recently played games, because the shell does not
  track opened documents.
- Set Program Access and Defaults, Printers and Faxes, and Help and Support are
  omitted. They have no real destination in the simulation.

## Remaining differences

Browser font rasterization differs from XP, so text is slightly wider in the
app. The user name and pinned game icons come from the app.
