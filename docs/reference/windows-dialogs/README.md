# Shared windows and dialogs

This pass compares the window frame, caption buttons, menu bars, scrollbars,
the window menu, common controls, message boxes, property sheets, and the
Open and Save As dialogs with the original XP SP3 VM at 1024×768. Notepad,
Taskbar and Start Menu Properties, Date and Time Properties, the Run error,
and Save As were the reference windows.

## Reference

The local VM was run with `bun run xp:vm -- --instance areas` using a
disposable snapshot. The app was captured in headless Chromium at the same
1024×768 viewport, with each window moved to the VM window's position.
Measurements were taken from pixel rows and columns of both captures.

| View               | VM                                   | App                                   |
| ------------------ | ------------------------------------ | ------------------------------------- |
| Notepad            | `xp-notepad-1024x768.png`            | `app-notepad-1024x768.jpg`            |
| Notepad, scrolled  | `xp-notepad-scrolled-1024x768.png`   | `app-notepad-scrolled-1024x768.jpg`   |
| Window menu        | `xp-system-menu-1024x768.png`        | `app-system-menu-1024x768.jpg`        |
| Taskbar properties | `xp-taskbar-properties-1024x768.png` | `app-taskbar-properties-1024x768.jpg` |
| Date and Time      | `xp-date-time-1024x768.png`          | `app-date-time-1024x768.jpg`          |
| Save As            | `xp-save-as-1024x768.png`            | `app-save-as-1024x768.jpg`            |
| Run error          | `xp-run-error-1024x768.png`          | `app-run-error-1024x768.jpg`          |

## Matched

- Window frames are drawn from Luna.msstyles for Blue, Olive Green, and
  Silver: a 30px caption sliced with the theme's 28/35/9/17 sizing margins,
  4px side and bottom edges, the maximized caption, and no drop shadow. The
  frame columns, caption rows, and bottom rows match the VM pixel for pixel.
- Caption buttons use each scheme's own button and glyph bitmaps, 2px apart,
  6px from the top and right edges. Title text uses the theme's colors and
  1px shadow, and inactive captions drop the shadow.
- Maximized windows push their 4px frame past the work area, like XP.
- The side edges are cut at extraction to the exact bitmap columns XP draws
  (four for windows, three for dialogs), so nothing is resampled. On
  high-density screens the frame, caption, and caption buttons scale by
  nearest neighbor, so each XP pixel stays a sharp block. Earlier, the 5px
  bitmaps were squeezed in the browser, which only matched at 1×.
- Menu bars are 19px with XP's 1px white bottom line, 6px item padding, and a
  flat blue highlight. Inactive windows draw their menu text in gray.
- Access-key underlines stay hidden until Alt, Tab, F10, or an arrow key is
  used, and hide again after mouse input.
- Scrollbars use the Luna arrows, shafts, thumbs, and grippers for each
  scheme, and Notepad shows the size grip in its scrollbar corner.
- Push buttons, check boxes, radio buttons, group boxes, tabs, tab pages,
  combo box buttons, and up-down controls use the Luna bitmaps with the
  theme's sizing margins. Selected tabs keep the orange highlight.
- Property sheets have the title bar ? button. It arms "What's This?" help:
  the next click shows the control's help, or XP's "No Help topic is
  associated with this item." Escape leaves help mode.
- A dialog behind another dialog draws inactive.
- Message boxes use user32's 32px icons, XP's spacing, and grow to fit their
  text. The Run error is titled with the command and uses XP's wording.
- The window menu shows Marlett-style glyphs, a bold Close with Alt+F4, and
  no separator after Size. A mouse-opened menu has no highlight.
- Open and Save As follow XP's layout: Places bar, Look in/Save in folder
  list, Back, Up, and Create New Folder, a column-flowing file list, and the
  file name and file type fields beside the buttons.
- Properties and file dialogs show Explorer's icons instead of an emoji.

## Astro Flash adaptations

- Windows Classic keeps its own 3D frames, controls, and scrollbars.
- The Places bar offers Desktop, My Documents, and My Computer. My Recent
  Documents and My Network Places are omitted because the shell has no folder
  for them.
- The file dialog's Views menu is omitted.

## Remaining differences

- The browser cannot tell when a scrollbar has nothing to scroll, so its
  arrows keep their normal look where XP grays them out.
- Text rasterization differs from XP, so text is about 1px off in places.
- The Date and Time clock, calendar border, and year spinner belong to the
  system utilities pass.
