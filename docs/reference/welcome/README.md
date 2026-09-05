# Welcome and logon reference

Compared on 2026-09-05 against a running Windows XP Professional SP3 VM installed
from `en_windows_xp_professional_with_service_pack_3_x86_cd_vl_x14-73974.iso`.
The guest was run with a temporary disk snapshot.

## Captures

All images retain their captured dimensions. No screenshots were resized.
`xp-*.png` files are QEMU framebuffer captures; `app-*.jpg` files are in-app
browser captures at the corresponding viewport size. The 1280×1024 guest uses
16-bit color, which visibly quantizes gradients. Browser JPEG encoding, color
management also prevent a whole-screen pixel equality claim. The older app captures used bitmap labels and are historical evidence only;
native text now uses the original XP fonts through the browser renderer.

`app-native-*.jpg` records the completed native text implementation. Automatic
Welcome, selected-user loading, logged-off selection and program counts were
checked at 1024×768 and 1280×1024 without resizing captures. At 390×844, both
plural counts and loading text fit below the avatar and the instruction wraps.
Separate display-density emulation was not available in this browser.

The final pass corrected the native Welcome label position by two CSS pixels
left and down, including selected-user loading. The reference remains XP's
original Arial bold italic; the browser's antialiasing and fractional advances
are accepted platform differences, not reproduced with bitmap text.

To capture the brief loading state, a temporary local HTTP preview delayed only
manual login by eight seconds immediately before `await fs.ready`. The served
DOM, CSS, fonts and remaining session code were unchanged. This instrumentation
is not part of the application. The ordinary build was separately checked for
immediate login and a clean browser console; deferred-storage behavior is also
covered by `tests/shell-behavior.test.ts`.

Final interaction checks covered automatic keyboard skip, user-tile login,
status clicks staying on selection, power-dialog cancellation, switched-window
preservation with one/two program counts, and full logoff clearing the session.
All 189 tests, formatting, lint, type checking, asset-reference validation and
the production build pass.

The older pairs cover automatic Welcome and user selection at 1024×768 and 1280×1024.
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
- Switch User preserves the session and shows its real running-program count,
  or Logged on when no windows are open. Log Off closes the session, removes
  that status, and returns to an unselected user tile.
- Clicking the status text does not accidentally activate the user tile.
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

## XP text rendering

`site/css/fonts.css` defines the original ISO-extracted font files for the whole
page. Shell text defaults to Tahoma, including native form controls; application
styles can select the supplied Arial, Trebuchet MS and Lucida Console faces.
Bold and italic faces use the corresponding original files.

Welcome uses real DOM text: Arial bold italic 48px, Arial 19px instructions,
Tahoma 19px user/power labels, and Tahoma bold 11px status. Counts are ordinary
strings; narrow layouts wrap naturally. No text images, glyph sprites, or
host-specific smoothing overrides are used. Browser zoom and display density
are handled by the native text engine.

Original font outlines do not guarantee identical rasterization: browser/OS
hinting, antialiasing and fractional advances can differ from XP GDI. This is
not a claim of pixel-exact text across platforms. The native VM captures remain
the reference for type sizes, positions and appearance.

## Recorded sound behavior

The AC'97 reference capture uses the Intel driver supplied in the XP ISO's
WDMA_INT.INF. `xp-session-audio.wav` contains the unchanged captured PCM with
its RIFF byte counts finalized. `audio-comparison.json` records template-match
offsets and correlations against the original extracted WAVs. Idle periods
are omitted by the recording backend, so offsets are not wall-clock timings.

| Action                         | Original sound used |
| ------------------------------ | ------------------- |
| Automatic startup              | Windows XP Startup  |
| Switch User                    | Windows XP Logoff   |
| Return to the switched session | Windows XP Logon    |
| Full Log Off                   | Windows XP Shutdown |
| Fresh logon after Log Off      | Windows XP Startup  |

The recording also includes one deliberate Control Panel test of Windows XP
Error. The switch sounds, full-logoff sound, and fresh-startup sound match their
ISO templates at normalized correlations of 0.99976 or higher. The first cold
startup has a lower correlation while the newly configured device starts.
An earlier ES1370 recording had a driver/buffering fault and was discarded.

The app follows this observed distinction between ending a session and
switching it. It no longer adds a logon chime to automatic startup. Browser
autoplay rules can block the first startup sound; a Welcome gesture retries
that blocked sound once, without adding a second audible startup. Boot visuals
and click skipping from PR #146 are unchanged.
