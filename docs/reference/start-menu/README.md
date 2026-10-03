# Start menu

This pass compares both Start menu styles, their submenus, the Start button
menu, and the Customize dialogs with the original XP SP3 VM at 1024×768.

## Reference

The local VM was run with `bun run xp:vm -- --instance startmenu` using a
disposable snapshot. The app was captured in headless Chromium at the same
1024×768 viewport. VM screenshots are PNGs; app screenshots are JPEGs.

| View                         | VM                                   | App                                   |
| ---------------------------- | ------------------------------------ | ------------------------------------- |
| Start menu                   | `xp-blue-1024x768.png`               | `app-start-1024x768.jpg`              |
| All Programs, Games          | `xp-games-1024x768.png`              | `app-games-1024x768.jpg`              |
| All Programs                 | `xp-all-programs-1024x768.png`       |                                       |
| My Recent Documents          | `xp-recent-1024x768.png`             | `app-recent-1024x768.jpg`             |
| Start button menu            | `xp-start-button-menu-1024x768.png`  | `app-start-button-menu-1024x768.jpg`  |
| Customize Start Menu         | `xp-customize-general-1024x768.png`  | `app-customize-general-1024x768.jpg`  |
| Customize, Advanced          | `xp-customize-advanced-1024x768.png` | `app-customize-advanced-1024x768.jpg` |
| Classic Start menu           | `xp-classic-1024x768.png`            | `app-classic-1024x768.jpg`            |
| Customize Classic Start Menu | `xp-customize-classic-1024x768.png`  | `app-customize-classic-1024x768.jpg`  |

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
- Right-clicking Start opens the Start button menu instead of the taskbar
  menu. Properties opens Taskbar and Start Menu Properties on the Start Menu
  tab.
- Customize Start Menu works: icon size, number of programs, Clear List,
  Internet, opening submenus on hover, each item as a link, a menu, or hidden,
  Run, Search, and the recent documents list with its own Clear List.
- "Display as a menu" lists the folder's real contents, with subfolders as
  submenus. Control Panel lists its applets.
- The Classic menu uses 32-pixel rows, the Programs folder icon, no line under
  Programs, a Search submenu, and the regular-weight edition in its banner.
- Customize Classic Start Menu works: Clear, Display Run, Expand Control
  Panel, Expand My Documents, Expand My Pictures, and Show Small Icons, which
  also removes the side banner like XP.

## Astro Flash adaptations

- The pinned item is Internet Games, shown like XP's pinned items with a bold
  name, a gray "Flashpoint Archive" subtitle, and a separator. The Internet
  option shows or hides it.
- The most-used list shows favorites and recently played games, then fills
  with games in title order. Clear List removes the play history ordering.
- My Recent Documents lists recently played games, because the shell does not
  track opened documents. The Classic Documents menu lists them too.
- Omitted because they have no real destination in the simulation: E-mail,
  Set Program Access and Defaults, Printers and Faxes, Help and Support,
  Favorites, Network Connections, Administrative Tools, Highlight newly
  installed programs, dragging and dropping, Scroll Programs, personalized
  menus, and Classic Add, Remove, Advanced, and Sort. The Start button menu
  omits Open, Explore, and the All Users entries because there is no Start
  Menu folder.

## Left for the shared dialogs pass

- Property sheet tabs lack XP's orange selected-tab line.
- Dialogs lack the title bar Help button and sit a few pixels off XP's frame
  metrics.
- Number fields have no XP spin buttons.
- Properties and file dialogs draw files with an emoji instead of XP icons.

## Remaining differences

Browser font rasterization differs from XP, so text is slightly wider in the
app. The user name and pinned game icons come from the app.
