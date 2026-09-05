# Windows XP boot reference

Reference: the repository's English XP Professional SP3 x86 VL ISO, SHA-256
`fd8c8d42c1581e8767217fe800bfc0d5649c0ad20d754c927d6c763e446d1927`.
Captured on 2026-09-05 using an isolated QEMU instance (temporary disk changes).

## What was observed

- The XP splash uses a 640 × 480 framebuffer before switching to the desktop mode.
- `ntoskrnl.exe` bitmap 1 contains the complete background, lettering and bar border.
  Its stored palette is black; the running kernel supplies the visible palette.
- Bitmap 8 is the 22 × 9 blue three-block progress sprite.
- The progress clip is x=259, y=354, width=118, height=9.
- The sprite advances 8 pixels at approximately 100 ms intervals. Loading can
  pause it: the recorded run paused at x=323 for about 1.6 seconds.
- The palette fades in through stepped brightness levels before progress begins.
  The recording reached full brightness around 9.64 seconds after reset and
  cleared the splash at 14.37 seconds. These include VM firmware and disk time.

`xp-sp3-boot.png` is an unmodified VM capture. Palette entries in
`tools/xp-assets.json` were recovered by matching the bitmap's pixel indices to
this fully illuminated frame. Unused index 15 retains black. The generated
`BootScreen.png` matches every pixel outside the animated bar in this capture;
`tests/boot-assets.test.ts` checks this without a tolerance.

## Browser implementation and scope

The app uses the extracted background and sprite, not recreated text, borders,
logos or gradients. The framebuffer scales uniformly with black letterboxing;
it does not stretch to a different aspect ratio. Pointer and keyboard input do
not skip the boot screen, and the cursor is hidden while it is displayed.

The browser uses a two-second stepped brightness fade and an uninterrupted
1.8-second progress loop. Its splash lasts 4.6 seconds; VM disk stalls and
firmware timing are not reproduced. The fade sheet applies twenty palettes
observed in the VM recording to the original bitmap, including black and full
brightness; it does not generate intermediate colors. Welcome/login remains a separate area to compare.

## Repeat the comparison

Run `bun run xp:vm --instance boot-reference`, then enter:

```
record-boot /private/tmp/xp-boot-reference
```

This resets only that VM and records PNGs plus elapsed timestamps for 20 seconds.
Use `screenshot <path>` for a single frame and `quit` when finished. Do not use
`--write-base` for reference comparisons.

Run `bun run extract:xp-assets` to regenerate the resources from the authenticated
ISO, and `bun run verify:xp-assets` to check their provenance. Compare screenshots
at matching dimensions with `bun run compare:xp-ui <xp.png> <app.png> <prefix>`;
compare moving progress frames at the same animation position.
