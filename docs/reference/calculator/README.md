# Calculator

Calculator is now a web-native rebuild of XP SP3's `calc.exe`, replacing the
BoxedWine copy. It was studied from the original binary (Ghidra 12.1.4, for
notes only), its resources, and the XP VM at 1024×768, then written from
those notes. No decompiled code is in the repository. The images are 1:1
crops, not scaled.

| View                     | VM                  | App                  |
| ------------------------ | ------------------- | -------------------- |
| Standard                 | `xp-standard.png`   | `app-standard.png`   |
| View menu                | `xp-view-menu.png`  | `app-view-menu.png`  |
| Scientific               | `xp-scientific.png` | `app-scientific.png` |
| Scientific, Hex          | `xp-hex.png`        | `app-hex.png`        |
| Statistics Box, 4 values | `xp-statistics.png` | `app-statistics.png` |

## Matched

- Both views come from calc.exe's dialog templates: 102 for Standard and 101
  for Scientific, at 6/4 horizontal and 13/8 vertical dialog units. The
  client area ends at the hidden marker control: 254 by 208 pixels, and 474
  by 265. With the fixed 3-pixel dialog frame and the menu bar the windows
  are 260 by 260 and 480 by 317, with Maximize shown but disabled.
- Luna push buttons use the string table's labels (sqrt, Or), in calc.exe's
  colors: blue `#0000FF` for digits, Sta and pi, red `#FF0000` for
  operators, memory and clear keys, magenta `#FF00FF` for functions, and
  `#ACA899` when disabled. Buttons, the display, the radio buttons, check
  boxes, group boxes and the sunken memory and parenthesis indicators line
  up with the VM pixel for pixel; only text rendering differs.
- Scientific disables what the base can't use: F-E, dms, Exp, sin, cos, tan
  and pi outside decimal, digits past the base, A to F in decimal, and Ave,
  Sum, s and Dat until the Statistics Box opens. Outside decimal, the angle
  buttons give way to Qword, Dword, Word and Byte.
- Numbers are exact fractions, as ratpak keeps them, so `1/3*3-1` is 0.
  The display shows 32 significant digits, rounded half away from zero, with
  a trailing point on whole numbers. Scientific notation starts past 32
  whole digits (`1.e+32`) or 34 decimals (`1.e-35`), or with F-E, which C
  turns off.
- Entry takes 32 characters, the point included, and 4 exponent digits.
  Hex, octal and binary take as many digits as the word size holds. Typing
  shows the digits as entered (`1.50`); the first operator tidies them.
- Standard runs left to right. Scientific has calc.exe's precedence: Or and
  Xor, then And, then + and -, then Lsh, Mod, / and \*, then x^y. Up to 25
  parentheses nest, shown as `(=n`, and `(` shows on the display.
- Equals repeats the last operation (`2+3==` is 8), keeps its quirks
  (`2+3=4=` is 8, `2+3*=` is 4), and stops at an open parenthesis.
- Percent takes a share of the number before (`200+10%` is 20). In Standard,
  `%` means percent and `@` square root; in Scientific they are Mod and x^2.
  Keys for buttons Standard lacks still work, as in calc.exe.
- Errors use the resource strings: **Cannot divide by zero.**, **Invalid
  input for function.** and **Result of function is undefined.** Only C and
  CE clear them.
- Functions: Int and Frac, Not, sin, cos and tan in degrees, radians and
  grads with their inverses and hyperbolic forms, ln and e^x, log and 10^x,
  x^2, x^3 and their roots, x^y and its root, n! with the gamma function for
  fractions, 1/x, dms and its inverse, and pi or 2pi. Inv and Hyp clear after
  the keys that use them, and CE clears them too.
- Hex, octal and binary keep whole numbers in the word size: `-1` shows
  `FFFFFFFFFFFFFFFF`, a smaller word size cuts the value for good, and going
  back to decimal shows it unsigned.
- Decimal And, Or and Xor reproduce ratpak's digit-by-digit quirk: `2.5 Or 0`
  is 20 and `2.25 Or 1.5` is 20.2.
- Memory: MS, MR, MC and M+, with the ` M` indicator while memory is not 0.
- The Statistics Box is modeless, at its template position on the desktop.
  Dat (Insert) adds the display, RET goes back, LOAD and a double-click load
  the selected value, CD and CAD clear one or all, and closing it or
  changing the view clears the list. Ave, Sum and s, with Inv for squares
  and the population deviation.
- The keyboard follows calc.exe's accelerator table, including F2 to F8,
  F9, F12, Ctrl+M, Ctrl+P, Ctrl+R, Ctrl+L, Ctrl+S, Ctrl+A, Ctrl+T, Ctrl+D,
  Insert, Ctrl+Insert and Shift+Insert. Each key briefly presses its button.
- Copy copies the display without a whole number's trailing point. Paste
  reads the text as key presses, with calc.exe's paste table: it skips
  spaces, line breaks and commas, understands `:m`, `:c` and the other colon
  codes, and stops at the first character it has no key for.
- Invalid keys play XP's Default Beep (`ding.wav`).
- The view and digit grouping are saved, as calc.exe saves `layout` and
  `UseSep`. Without saved settings Calculator opens in Standard.

## Decisions

- **Help** keeps **About Calculator** only, like the other rebuilt apps.
  **Ctrl+Shift+K**, calc.exe's hidden shortcut, opens it too.
- Square roots, cube roots and x^y roots are exact when the answer is.
  calc.exe's ratpak isn't: `sqrt(4)-2` shows
  `-8.1648465955514287168521180122928e-39` in XP and 0 here.
- Functions work to 100 digits, so their 32 shown digits match XP, but the
  digits past them, seen only after subtracting, differ.
- calc.exe has no fixed size limit. Here magnitudes stop at 10^99999 with
  **Invalid input for function.**, which is what XP shows for `10^100000`,
  and factorials stop past 25205!.
- The long calculation prompt (dialog 104) isn't needed, as nothing here
  takes long.

## Remaining differences

- Text uses DOM fonts, so labels are antialiased.
- The Statistics Box stays above Calculator and has no taskbar button. In XP
  it is its own window, behind Calculator when Calculator is active, and has
  a window icon.
- The Statistics Box list starts a pixel further right.
- Menus opened by keyboard show XP's access-key underlines and highlight the
  first item; the app shows them after Alt.
- calc.exe's **What's This?** context menu on buttons isn't there.
