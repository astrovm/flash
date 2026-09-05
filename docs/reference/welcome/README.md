# Welcome and logon reference

Compared on 2026-09-05 against a running Windows XP Professional SP3 VM installed
from `en_windows_xp_professional_with_service_pack_3_x86_cd_vl_x14-73974.iso`.
The guest was run with a temporary disk snapshot.

## Captures

All images retain their captured dimensions. No screenshots were resized.
`xp-*.png` files are QEMU framebuffer captures; `app-*.jpg` files are in-app
browser captures at the corresponding viewport size. The 1280×1024 guest uses
16-bit color, which visibly quantizes gradients. Browser JPEG encoding, color
management, and font smoothing also prevent a whole-screen pixel equality claim.

The pairs cover automatic Welcome and user selection at 1024×768 and 1280×1024.
Additional guest captures show logged-off selection and selected-user loading.
The VM account is Administrator; the simulation uses its existing astro profile.

## Original resources and measurements

The ISO extraction manifest records the seven added `logonui.exe` bitmap
resources: 100 (glow), 112 (selection background), 113 and 119 (user frames),
124 (vertical divider), 125 (top divider), and 126 (bottom divider).
The existing wordmark resource 127 has the same pixels as resource 123 used by
the logon layout. Existing Chess, Power, cursor, and font assets are reused.

`logonui.exe` UIFILE 1000 and native captures establish an 80-pixel top band,
a 96-pixel footer, a 219×207 glow, a 137×86 wordmark, 58×58 user frames,
48×48 pictures, and a 26×26 power image. Artwork and type sizes stay fixed when
the resolution changes; the central layout moves with the available area.
Welcome uses bold italic Arial at 48 pixels. User names and power text use
Tahoma; the left instruction uses Arial.

The original glow at (0, 80) and wordmark at (353, 312) exactly match their RGB
pixels in the 1024×768 selection capture. `tests/welcome-assets.test.ts` checks
this directly, without resizing either input.

## Behavior checked

- Automatic Welcome retains the requested click/keyboard skip behavior.
- Selection requires the user tile; clicking the background does not sign in.
- Switch User preserves the session and shows Logged on; Log Off closes it and
  removes that status.
- Selected-user login displays Loading your personal settings while storage is
  pending. The desktop is revealed after initial game-file synchronization.
- The power control opens the existing shutdown dialog; cancel returns to
  selection.
- Browser checks cover both reference resolutions and a 390×844 narrow viewport.
  Session tests also cover deferred storage and preserving open windows.

The simulation has one local profile, with no pretend authentication or account
management. XP's footer instruction pointing to User Accounts is omitted because
that control panel does not exist here. Narrow viewports wrap the instruction
and constrain the selected-user welcome text to keep the controls usable.

The ISO's HIVEDEF.INF maps SystemStart and WindowsLogon to the existing startup
and logon sound assets. Playback behavior was preserved; VM audio was not
recorded for this comparison. Boot behavior from PR #146 is unchanged.
