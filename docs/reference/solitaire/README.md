# Solitaire

Solitaire is now a web-native rebuild of XP SP3's `sol.exe`, replacing the
BoxedWine copy. It was studied from the original binary (Ghidra 12.1.4, for
notes only) and the XP VM at 1024×768, then written from those notes. No
decompiled code is in the repository. The images are 1:1 crops, not scaled.

| View                 | VM                  | App                  |
| -------------------- | ------------------- | -------------------- |
| Deal (seed 30162)    | `xp-deal.png`       | `app-deal.png`       |
| Two Draw Three turns | `xp-draw-three.png` | `app-draw-three.png` |
| Options              | `xp-options.png`    | `app-options.png`    |
| Select Card Back     | `xp-deck.png`       | `app-deck.png`       |
| Win                  |                     | `app-win.png`        |

## Matched

- Deals use sol.exe's own shuffle: the C runtime's `rand()`, seeded with the
  clock's low 15 bits, five passes of swaps, then the tableau row by row. The
  VM's deal was found by its seed and reproduced card for card; the table
  differs from the VM only in DOM text.
- The layout follows the client width: 11-pixel gaps (or wider in a wider
  window), the deck stacking 2 pixels right and 1 down every ten cards,
  foundations every four, and the tableau stepping 3 pixels per face-down
  card and 15 per face-up card.
- Draw Three fans the newest cards 14 pixels right and 1 down, and earlier
  draws collapse into the waste, as sol.exe lays them out.
- Empty foundations show cards.dll's outline, and the empty deck shows its O,
  or X once Vegas has no passes left.
- Moves follow sol.exe: drag from the waste top, any foundation card, or any
  face-up tableau card; drop where the first card overlaps a pile that takes
  it. Dropped cards that land nowhere slide back. Clicking a face-down top
  card turns it over. A double-click sends a card home, and the right button
  sends every pile's top card home once.
- Scores use sol.exe's Standard and Vegas tables, including the Draw One and
  Draw Three recycle penalties, the 2-point timer penalty every 10 seconds,
  and the time bonus. Vegas shows dollars, red when negative, limits the
  passes, and can carry the score across games.
- Undo reverses the last draw or move and its score. Turning a card over
  can't be undone.
- Winning bounces the cards off the table, kings first, leaving trails, at
  5 ms per step. Esc or a mouse press stops it, then **Deal Again?** asks.
- **Alt+Shift+2** wins on the spot, and **Ctrl+Alt+Shift** while clicking the
  deck turns one card, both sol.exe's hidden shortcuts.
- The status bar shows the score and time in bold at the right, and the
  menus' help text at the left, with sol.exe's strings.
- Options and Select Card Back use sol.exe's dialog templates at their
  positions. The card backs are shrunk the way GDI's default stretch mode
  does, ANDing the dropped pixels.
- Settings and the chosen back are saved; without a saved back, one is picked
  at random, as sol.exe does.

## Decisions

- **Help** keeps **About Solitaire** only, like FreeCell and Task Manager.
- Keyboard play (moving the selection with the arrow keys) moves the mouse
  pointer in sol.exe, which a web page can't do, so it's omitted. **F2** and
  **Esc** work.

## Remaining differences

- Text uses DOM fonts.
- One pixel at the deck's top-right corner is black in XP and green in the
  app.
- Opening a dialog by keyboard shows XP's focus rectangle and access-key
  underlines; the app shows them after Alt or Tab.
