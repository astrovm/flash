# Windows XP boot reference

Reference: the repository's English XP Professional SP3 x86 VL ISO, SHA-256
`fd8c8d42c1581e8767217fe800bfc0d5649c0ad20d754c927d6c763e446d1927`.
Captured on 2026-09-05 using QEMU with temporary disk changes.

## Direct VM observations

Two VM boot recordings used actual desktop modes of 1024 × 768 and 1280 × 1024.
The latter was selected and applied through XP Display Properties, with the
Cirrus adapter using 16-bit color. Neither recording was resized.

| Desktop mode | Boot framebuffer entered         | Desktop mode restored   |
| ------------ | -------------------------------- | ----------------------- |
| 1024 × 768   | 640 × 480 at 6.321 s after reset | 1024 × 768 at 15.739 s  |
| 1280 × 1024  | 640 × 480 at 6.581 s after reset | 1280 × 1024 at 16.576 s |

The second run cleared the 640 × 480 splash to black at 15.257 s, before the
resolution changed. BIOS/firmware used a separate 720 × 400 mode and is outside
this Windows boot area. Timing includes emulated disk and firmware work and is
not a universal XP duration.

- `ntoskrnl.exe` bitmap 1 contains the complete background, lettering and bar border.
  Its stored palette is black; the running kernel supplies the visible palette.
- Bitmap 8 is the 22 × 9 blue three-block progress sprite.
- The progress clip is x=259, y=354, width=118, height=9.
- The sprite advances 8 pixels at approximately 100 ms intervals. Disk loading
  can pause it; the first recording included a roughly 1.6-second pause.
- The palette fades through discrete colors before the progress sprite appears.

## Unaltered evidence

- `xp-display-1280x1024.png`: actual applied desktop setting, 1280 × 1024 capture.
- `xp-sp3-boot.png`: boot capture from the 1024 × 768 desktop run, 640 × 480.
- `xp-sp3-boot-from-1280.png`: boot capture from the 1280 × 1024 run, 640 × 480.
- `xp-boot-cleared.png`: black boot framebuffer before the resolution transition.
- `app-1280x1024.jpg` and `app-1920x1080.jpg`: direct browser captures during boot.

All files above are original capture bytes, without resizing, cropping, or
compositing. Browser capture output is JPEG, so it is visual/layout evidence,
not a lossless pixel-equivalence assertion. The earlier scaled screenshot
comparison is not used as evidence.

Palette entries in `tools/xp-assets.json` were recovered by matching the bitmap's
pixel indices to the VM recording. Unused index 15 retains black. The generated
`BootScreen.png` matches every pixel outside the animated bar in both native VM
boot captures; `tests/boot-assets.test.ts` checks this without a tolerance.

## Browser behavior

The browser fits the original 4:3 framebuffer to the available viewport, scaling
uniformly and centering it on black. This is an intentional web adaptation:
XP itself switches to a 640 × 480 video mode, while a web page cannot change the
physical monitor mode. The artwork is never stretched to another aspect ratio.
Browser screenshots show the actual rendered page; the captured files themselves
are not resized for comparison.

The app waits for the boot images to decode before starting the two-second
palette fade. The fade sheet applies twenty palettes observed in the VM to the
original bitmap; it does not invent intermediate colors. Progress uses the
original sprite with the observed 8-pixel steps. Boot completion waits for the
two-second fade plus one complete 1.8-second progress pass, document storage,
and the existing bounded game-library initialization. Fast startup therefore
remains visible for at least 3.8 seconds after image decoding; slower startup
keeps the progress animation running. VM disk stalls are not replayed
as fake browser work.

The final palette is painted, then the boot framebuffer is cleared to black
before Welcome appears. Clicking boot skips directly to Welcome, as do Enter and Space when boot is
focused. This is another intentional web adaptation. Restart repeats the decode/fade/handoff lifecycle. Welcome/login
appearance and behavior remain the next separate area.

Verification includes the native bitmap comparisons, a delayed-startup test
that checks the black handoff before Welcome, click/keyboard skip and minimum-duration tests, and in-app
browser checks. The production build reached the desktop with no console errors.

## Repeat the comparison

Run `bun run xp:vm --instance boot-reference`, select the desired desktop mode
inside XP, then enter:

```
record-boot /private/tmp/xp-boot-reference
```

This resets only that VM and records PNGs plus elapsed timestamps for 20 seconds.
Use `screenshot <path>` for later frames and `quit` when finished. Do not use
`--write-base` for reference comparisons.

Run `bun run extract:xp-assets` to regenerate resources from the authenticated
ISO, and `bun run verify:xp-assets` to check provenance. Keep all captures at
their original dimensions. `bun run compare:xp-ui <xp.png> <app.png> <prefix>`
requires equal dimensions; do not resize either input to satisfy that check.
