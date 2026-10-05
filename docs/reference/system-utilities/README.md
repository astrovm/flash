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
The Networking capture comes from the VM started with a restricted RTL8139
adapter (`-nic user,model=rtl8139,restrict=on`), since the reference VM has
no network adapter.
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
- Networking has XP's adapter graph, with its scale column, yellow axis, and
  31px rows, over the adapter list.
- A notification area icon fills with CPU usage in XP's twelve steps.

### Working simulation

- Applications lists the real windows. End Task, Switch To, New Task, and the
  Windows menu act on them. Large Icons, Small Icons, and Details work.
- Processes lists the reference install's processes plus one per program
  window, with XP's image names. End Process closes the program's window,
  refuses critical processes, and asks first, with XP's messages. Columns sort.
- CPU usage is measured from how late each animation frame runs, which counts
  all of the page's work, including Flash and the emulated programs. It goes
  to the active program's process, or to explorer.exe.
- Each program's memory is its working set plus what its window really holds:
  canvas and image pixels and its elements. Folder windows add to
  explorer.exe. The totals, commit charge, and PF Usage add up from that.
- Networking graphs what the page really downloads, against a 100 Mbps link.
  The adapter shows Disconnected while the browser is offline. Auto Scale,
  Show Scale, Reset, Tab Always Active, and the three history lines work.
- Always On Top, Minimize On Use, Hide When Minimized, Update Speed, Refresh
  Now, and Show Kernel Times work and are saved.
- Shut Down stands by, turns off, restarts, logs off, and switches users.
  Users can disconnect or log off the session.
- About shows XP's About Windows Task Manager.

### Astro Flash adaptations

- The reference install's background processes keep fixed memory, handles,
  and threads. Program windows add, grow, and end processes. Winamp's agent
  is left out, since Winamp was removed.
- Browsers can't tell kernel time apart, so Show Kernel Times draws an
  estimated 40% share. They don't report uploads either, so Bytes Sent stays
  at zero.
- Show Cumulative Data is omitted, since its columns are.
- Help has only About: there is no Help and Support Center. Hibernate is left
  out, as in the Turn Off Computer dialog.
- Select Columns, the right-click menus, and processor affinity are omitted.

### Remaining differences

- Text rasterization differs from XP, so menus are 1 to 3px narrower or wider.
- Windows Classic gets classic list headers, lists, and status panes, but the
  tabs still wait for the shared Classic controls pass.

## Volume Control

| Scheme  | VM                      | App                              |
| ------- | ----------------------- | -------------------------------- |
| Blue    | `xp-volume-control.png` | `app-volume-control.png`         |
| Classic |                         | `app-volume-control-classic.png` |

The VM capture is sndvol32 with the reference VM's AC97 sound card, whose
Intel driver is installed in the base disk. The menus and strings come from
sndvol32.exe, the speaker icons, window icon, and About icon from its icons,
and the trackbar track and thumbs from Luna.msstyles.

### Matched

- XP names the window and first column after the master line: **Master
  Volume**. The status bar names the device: Intel(r) Integrated Audio.
- The window opens at XP's position, one pixel above the screen's top edge,
  at its size.
- Master Volume and Wave are laid out at XP's measured positions: titles,
  etched lines, Balance with its speakers, downward thumb, and three ticks,
  and Volume with its vertical thumb and seven ticks on each side.
- **Advanced Controls** is gray, as XP shows it for this device.

### Working simulation

- **Master Volume** and the tray volume stay in step both ways.
- **Wave** scales every sound after Master, as all of the shell's audio is
  wave output: games, programs, and system sounds.
- **Mute all** and **Mute** silence everything and Wave.
- **Balance** pans the shell's sounds through Web Audio. Master and Wave
  balance add up.
- **Options** → **Properties** shows or hides the Wave column, and the
  window resizes like XP's. **Exit** and **About Volume Control** work.

### Astro Flash adaptations

- SW Synth and CD Player are left out: nothing in the browser plays through
  them. The window is narrower for it.
- Recording is unavailable, since nothing records.
- Games play through their own players, which browsers don't let a page
  pan, so Balance affects only the shell's sounds.
- Help Topics is omitted: there is no Help and Support Center.

### Remaining differences

- Text rasterization differs from XP.

## Control Panel

| Page          | VM                                  | App                                  |
| ------------- | ----------------------------------- | ------------------------------------ |
| Category View | `xp-control-panel.png`              | `app-control-panel.png`              |
| Category page | `xp-control-panel-appearance.png`   | `app-control-panel-appearance.png`   |
| Classic View  | `xp-control-panel-classic-view.png` | `app-control-panel-classic-view.png` |
| Olive Green   |                                     | `app-control-panel-olive.png`        |

Colors come from XP's shell style files on the CD: `blue_ss.dll`,
`home_ss.dll`, `metal_ss.dll`, and `class_ss.dll`. The special task group
bitmaps come from Luna.msstyles, and the icons from shell32.dll.

### Matched

- Explorer's chrome, as in other folder windows: the File, Edit, View, and
  Help menus, the toolbar with Views, and the address bar with Go.
- The title bar and address name the page, and keep the Control Panel icon.
- Back, Forward, and Up walk the pages like XP. Up from Control Panel opens
  the Desktop folder.
- The special Control Panel task group, with Luna's head, background, and
  collapse button, and **Switch to Classic View** with shell32's icon.
- Category View: XP's title, category positions, and infotips.
- Category pages: the header band, **Pick a task...**, the tasks, and **or
  pick a Control Panel icon**, at XP's positions.
- Classic View: Icons and List views. A click selects, a double-click or
  Enter opens. **File** → **Open**, **Edit** → **Select All** and **Invert
  Selection** work.
- The page and task pane colors follow Blue, Olive Green, Silver, and
  Classic. The Explorer task pane now uses Olive Green's and Silver's colors
  too.

### Astro Flash adaptations

- Only the categories, tasks, and icons that open working dialogs are shown:
  Appearance and Themes (Display, Taskbar and Start Menu) and Date, Time,
  Language, and Regional Options (Date and Time).
- See Also, Troubleshooters, and Help are omitted: they open nothing here.
- The address runs what it names, like Run.

### Remaining differences

- XP's task group header icon has a dark red check. It isn't among the icons
  on the CD, so the Control Panel icon with its orange check is used.
- Text rasterization differs from XP.
