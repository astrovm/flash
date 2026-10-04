# Display Properties

This pass compares every tab of Display Properties with the original XP SP3
VM at 1024×768, with the app's dialog at the VM dialog's position. It builds
on the shared window and dialog pass.

## Reference

| Tab          | VM                           | App                           |
| ------------ | ---------------------------- | ----------------------------- |
| Themes       | `xp-themes-1024x768.png`     | `app-themes-1024x768.jpg`     |
| Desktop      | `xp-desktop-1024x768.png`    | `app-desktop-1024x768.jpg`    |
| Screen Saver | `xp-saver-1024x768.png`      | `app-saver-1024x768.jpg`      |
| Appearance   | `xp-appearance-1024x768.png` | `app-appearance-1024x768.jpg` |
| Settings     | `xp-settings-1024x768.png`   | `app-settings-1024x768.jpg`   |

## Matched

- Dialogs now have XP's fixed 3px frame and 29px caption, with the same
  bitmap columns XP keeps. This applies to every dialog, not only Display
  Properties. Resizable windows keep the 4px frame and 30px caption.
- Taskbar and Start Menu Properties was realigned to the new frame. Its
  frame, tabs, page, and buttons match the VM pixel for pixel.
- Explorer-style windows lost their side frames to a white background. They
  draw the Luna frame again.
- The title bar has the ? button with "What's This?" help for each control.
  Desktop Items, Effects, and Advanced Appearance have it too.
- Tabs, the tab page, labels, combo boxes, buttons, and group boxes sit at
  XP's measured positions. Text rows match the VM.
- The Themes sample and the Appearance preview are drawn from the Luna
  caption, frame, button, and scrollbar bitmaps of the scheme being chosen,
  so they change before you apply. The message box uses the dialog frame.
- The monitor uses its real size. The Desktop and Screen Saver previews fill
  its 152×112 screen, and Settings shows the monitor's own sample desktop.
- The wallpaper list uses the Luna scrollbar. A picture opened with Browse is
  added to the list under its name, like XP, instead of a status line and a
  "Remove custom picture" link.
- Windows and buttons switches between Windows XP style and Windows Classic
  style, and Color scheme lists only the schemes for that style. Olive Green
  uses XP's capitalization.
- The Wait box has the Luna up-down control.
- The resolution slider uses the Luna trackbar thumb, a sunken track, and a
  tick under each stop.
- Color quality shows the screen's real color depth with XP's color bar from
  themeui.dll.
- The XP theme's desktop color is XP's #004E98.
- Errors open message boxes instead of status text.

## Fixed across the shell

- Scrollbar thumbs show their gripper again. The thumb's border image had
  been painting over it.

## Astro Flash adaptations

- Save As and Delete on the Themes page are omitted. The simulation has no
  theme files.
- Monitor power, Troubleshoot, and the adapter's Advanced button are omitted.
  The browser has no power or adapter settings.
- The display adapter is named "Web Browser".
- The resolution slider keeps the simulation's stops, including the whole
  browser window.

## Remaining differences

- Text rasterization differs from XP, so some labels are 1 to 3px wider.
- Chrome won't draw a scrollbar thumb shorter than 26px, so the samples'
  thumbs are longer than XP's 17px.
- Wallpapers in the list share one picture icon. XP shows each file type's
  icon.
- Date and Time still sits a few pixels off inside its frame. It belongs to
  the system utilities pass.
