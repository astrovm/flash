# Taskbar completion evidence

This pass uses a disposable XP SP3 VM (`taskbar-final`, no base-disk writes)
and the local production build in the Codex in-app browser. Screenshots retain
their captured dimensions. No screenshots were resized for comparison.

## Original reference

- Blue floating Quick Launch was detached, resized, and returned to the taskbar
  at 1024×768 and 1280×1024. The 1280×1024 guest uses 16-bit color.
- Classic floating captions use the system active and inactive gradients, not
  flat blue/gray. `xp-classic-floating1280.png` records the active reference.
- The hidden tray expanded and collapsed after the pointer left it. A sequence
  captured approximately every 250 ms remained expanded through frame 5 and
  was closed by frame 7. The implementation waits two seconds and preserves
  keyboard focus, an open Volume popup, and its context menu.
- At 1280×1024 with Classic, a detached Quick Launch, and the captured tray,
  nine Explorer windows remained separate; ten grouped. This bounds a compact
  button width around 110 pixels, replacing the previous 160-pixel trigger.
  This is an empirical approximation, not a recovered internal XP algorithm.
- The group context menu contains Cascade, Tile Horizontally, Tile Vertically,
  Minimize Group, and Close Group. When all members are minimized, Minimize Group
  is disabled. Cascade restores minimized members. The new group actions operate
  on group members, rather than unrelated application windows.
- The original ISO's `I386/HIVEDEF.INF` sets
  `HKCU\Control Panel\Desktop\ForegroundFlashCount` to 3. Attention now flashes
  three times and retains its highlight; the existing 900 ms cadence is not a
  measured native timing. Classic uses its system highlight colors.

## Source assets

The 51 added PNGs are extracted from the authenticated ISO's `LUNA.MS_`:
Blue/NORMAL, Olive/HOMESTEAD, and Silver/METALLIC small captions, small close
buttons/glyphs, toolbar backgrounds, and active/inactive frame strips. Their
bitmap indices, crops, and pixel hashes are in `site/assets/xp/SOURCES.json`.

The original theme INI sections provide these sizing values:

| Resource           | Original dimensions / slicing                                                       |
| ------------------ | ----------------------------------------------------------------------------------- |
| Small caption      | 66×19 state; left 24, right 37; Blue/Olive top 9, bottom 8; Silver top 3, bottom 15 |
| Small close button | 13×13 state, 5-pixel sizing margins                                                 |
| Small close glyph  | 7×7 state                                                                           |
| Toolbar background | 320×13; bottom sizing margin 4                                                      |
| Left/right frame   | 5×31 state; sizing margins 2,2,0,0                                                  |
| Bottom frame       | 49×5 state; sizing margins 5,5,2,2                                                  |

## Browser behavior checked

- Four schemes, 1024×768 and 1280×1024; docking on left, top, right, and bottom
  with populated Desktop and large-icon Quick Launch bands. The recorded DOM
  bounds in `browser-edge-checks.json` accompany the visual samples.
- Individual band resizing/reordering; detached title dragging; floating resize;
  redocking; active/inactive caption; 16/32-pixel icons; View submenu; text/title
  options; and shortcut overflow launching a real folder.
- Adding My Computer/My Documents from the desktop, reordering without launching,
  keeping original desktop items, and preserving toolbar contents after reload.
- Locked grips are unavailable; keyboard band resizing works when unlocked.
  Canceled drags do not commit. A saved position of zero remains zero.
- Multirow taskbar resizing reserves the corresponding desktop space. Auto-hide
  leaves a two-pixel reveal edge, and its context menu remains reachable there.
  Disabling Keep on top restores the full desktop bounds.
- Blue at 390×844 and Silver at 320×568: Volume stays inside the tray artwork,
  its popup is reachable, and both populated toolbar overflow controls remain
  accessible. Expanded icons stay visible while using Volume and collapse after
  leaving. Classic was also checked at these widths.
- No browser console errors were reported during these checks.

The earlier taskbar reference captures remain useful for Properties, notification
customization, and the original docked artwork. These checks do not establish
pixel identity on every host display or exhaust every combination of settings.

## Issue fixes and limits

[#152](https://github.com/astrovm/flash/issues/152): narrow CSS overrides moved
Volume onto the Luna tray's decorative left edge. Removing those overrides
preserves the original padding. Crowded bands also retain their overflow menus;
when there are more minimum-width bands than fit, they can scroll horizontally.

[#151](https://github.com/astrovm/flash/issues/151): startup playback now owns one
Audio element across retries, shares an in-flight playback request, and pauses
that element when ending/restarting the session. A synthetic regression covers
Restart before the old sound has finished. An instrumented fresh build produced
one playback when rapidly skipping boot/Welcome in the in-app browser. The exact
reported fresh-load duplicate was not reproduced; confirmation from the affected
browser/device remains necessary before closing the issue.

The ten-minute Volume inactivity threshold remains a simulation heuristic.
The reference VM has no working Volume device, so an exact comparison of that
heuristic is unavailable. No fake network/security/hardware indicators were
added. Links and host Favorites remain omitted because they have no working
source. The Start menu and shared application window interiors remain later areas.

## Validation

219 tests pass across 39 files, including audio retry/Restart ownership, toolbar
persistence/drag cancellation/reordering, tray collapse, and Explorer group actions.
Type checking, JavaScript/icon validation, formatting/lint, and the production
build pass. All 483 extracted assets verify against the authenticated ISO.
