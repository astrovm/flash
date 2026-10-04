# System utilities

This pass compares the system utilities with the original XP SP3 VM in its
1920×1080 mode (`bun run xp:vm -- --vga std`), with the app's dialog at the
VM dialog's position. The images are 1:1 crops of the dialog from the
1920×1080 captures, not scaled.

## Date and Time Properties

| Page            | VM                        | App                        |
| --------------- | ------------------------- | -------------------------- |
| Date & Time     | `xp-date-time.png`        | `app-date-time.png`        |
| Time Zone       | `xp-time-zone.png`        | `app-time-zone.png`        |
| Internet Time   | `xp-internet-time.png`    | `app-internet-time.png`    |
| Silver (scheme) | `xp-date-time-silver.png` | `app-date-time-silver.png` |

### Matched

- The dialog is 404×348 with the 3px dialog frame. Tabs, the page, group
  boxes, combo boxes, edits, up-downs, the calendar, the clock, and the
  buttons sit at XP's measured positions.
- The clock is drawn pixel for pixel from timedate.cpl's geometry: twelve
  2px hour marks, filled hour and minute hands with a white highlight and a
  shadow offset by 2px, and a second hand that inverts what's under it. Two
  VM times were matched with no differing pixels.
- The clock and the time box keep running until the time is edited, like XP.
- The calendar has XP's sunken edge, header band, and 18px rows. Its colors
  are the scheme's caption colors, so Olive Green and Silver change it too.
- The year has the Luna up-down. The time up-down changes the hour, minutes,
  seconds, or AM/PM, whichever the caret was last in.
- A focused drop-down list shows the highlighted text, as in XP, instead of a
  dotted focus rectangle. This applies to every Luna combo box.
- Opening the dialog focuses the month, and switching pages focuses the
  page's first control.
- Time Zone lists XP's 75 zones. Applying a zone moves the shell clock by the
  difference between the zones. The current zone starts as the host's zone.
- Update Now synchronizes the shell clock with the host clock in the chosen
  zone, and reports the time like XP. The check box, the server, and the last
  synchronization are saved.

### Fixed across the shell

- The Luna up-down drew its arrows under the button edges, so only a line of
  each arrow showed. The arrows now sit on top, with XP's rounding. Display
  Properties' Wait box was 1px narrow and is fixed too.
- Theme bitmaps stretched by the browser were smoothed. Combo box buttons,
  up-downs, tabs, and buttons now stretch without smoothing, like uxtheme.
- Silver dialogs used the Blue and Olive Green button face. They now use
  Silver's #E0DFE3, read from Luna.msstyles.

### Astro Flash adaptations

- The host clock stands in for the Internet time server.
- Time zones keep their standard offsets. Daylight saving changes are not
  simulated, so the daylight saving check box is omitted.
- "time synchronization" is styled as XP's link, but there is no Help and
  Support Center to open.

### Remaining differences

- Text rasterization differs from XP, so some labels are 1 to 3px wider.
- XP tiles the middle of the up-down face from the left. CSS can only center
  tiles or stretch them, so 2 or 3 columns of the face shading differ.
- Windows Classic has no classic combo boxes, tabs, or up-downs in dialogs
  yet. That belongs to a shared controls pass.
- Olive Green was checked against Luna.msstyles' colors, not in the VM.

## Windows Task Manager

| Page         | VM                                 | App                                 |
| ------------ | ---------------------------------- | ----------------------------------- |
| Applications | `xp-task-manager-applications.png` | `app-task-manager-applications.png` |
| Processes    | `xp-task-manager-processes.png`    | `app-task-manager-processes.png`    |
| Performance  | `xp-task-manager-performance.png`  | `app-task-manager-performance.png`  |
| Networking   | `xp-task-manager-networking.png`   | `app-task-manager-networking.png`   |
| Users        | `xp-task-manager-users.png`        | `app-task-manager-users.png`        |
| Classic      |                                    | `app-task-manager-classic.png`      |

The layout, menus, and strings come from taskmgr.exe's resources and the VM.
The meter bitmaps, tray icons, and user icon are extracted from taskmgr.exe,
and the list header and status bar from Luna.msstyles.

### Matched

- A real 404×455 window at (10, 10) that resizes, minimizes, and has a task
  button. It opens from the taskbar menu and Ctrl+Shift+Esc.
- The five tabs, the page, list views with Luna headers and XP's column widths
  and alignment, the buttons, and the status bar with its size grip.
- Each page has XP's own menu bar, with item widths, 17px items, check marks,
  radio bullets, submenu arrows, and shortcut columns drawn like XP's.
- Performance has XP's LED meters, with the label in unsmoothed Arial, and
  scrolling history graphs on XP's 12px grid.
- A notification area icon fills with CPU usage in XP's twelve steps.

### Working simulation

- Applications lists the real windows. End Task, Switch To, New Task, and the
  Windows menu act on them. Large Icons, Small Icons, and Details work.
- Processes lists the reference install's processes plus one per program
  window, with XP's image names. End Process closes the program's window,
  refuses critical processes, and asks first, with XP's messages. Columns sort.
- CPU usage is the share of time the page's main thread was busy, where Flash
  and emulated programs run. Memory figures add up from the processes.
- Always On Top, Minimize On Use, Hide When Minimized, Update Speed, Refresh
  Now, and Show Kernel Times work and are saved.
- Shut Down stands by, turns off, restarts, logs off, and switches users.
  Users can disconnect or log off the session.
- About shows XP's About Windows Task Manager.

### Astro Flash adaptations

- The reference install's processes and their memory are fixed values. Only
  program windows add or end processes. Winamp's agent is left out, since
  Winamp was removed.
- Networking shows XP's "No Active Network Adapters Found.", like the
  reference VM, which has no network adapter.
- Help has only About: there is no Help and Support Center. Hibernate is left
  out, as in the Turn Off Computer dialog.
- Select Columns, the right-click menus, and processor affinity are omitted.

### Remaining differences

- Text rasterization differs from XP, so menus are 1 to 3px narrower or wider.
- Windows Classic gets classic list headers, lists, and status panes, but the
  tabs still wait for the shared Classic controls pass.
