# Spider Solitaire

Spider Solitaire is now a web-native rebuild of XP SP3's `spider.exe`,
replacing the BoxedWine copy. It was studied from the original binary (Ghidra
12.1.4, for notes only) and the XP VM at 1024×768, then written from those
notes. No decompiled code is in the repository. The images are 1:1 crops,
not scaled.

| View                         | VM                  | App                  |
| ---------------------------- | ------------------- | -------------------- |
| Easy deal (clock 1791198413) | `xp-deal.png`       | `app-deal.png`       |
| One move, then a row dealt   | `xp-deal-row.png`   | `app-deal-row.png`   |
| Options                      | `xp-options.png`    | `app-options.png`    |
| Statistics                   | `xp-statistics.png` | `app-statistics.png` |
| About Spider                 | `xp-about.png`      | `app-about.png`      |
| Win                          |                     | `app-win.png`        |

## Matched

- Deals use spider.exe's own shuffle: the C runtime's `rand()`, seeded with
  the clock in seconds, placing each card of two decks in the first free slot
  `rand() % 104` finds. Easy plays all spades, Medium spades and hearts. The
  VM's deal was found by its seed and reproduced card for card, stock
  included. The table matches the VM pixel for pixel.
- spider.exe's own art: its 52 faces, back, felt (tiled every 63 pixels
  across, as it does), empty slot, About picture, suit icons and six sounds.
  Red number cards get the black outline spider.exe draws over them.
- The score box uses XP's raster **System** font, read from `vgasys.fon`.
- The layout follows the client size: columns spread out with
  `(width - 710) / 11` gaps and overlap below 710 pixels; face-down cards
  step 7 pixels and face-up cards 28, squeezed per column to fit above the
  stock row. The stock sits bottom-right, finished runs bottom-left, both 12
  pixels apart.
- Where spider.exe draws a card straight onto the table instead of
  repainting, its corners stay solid green until that column repaints: dealt
  cards, cards under a drag, the card the right button shows.
- Moves follow spider.exe: pick up a run in one suit, drop it on any card one
  rank higher or an empty column, the first column under the cards from the
  left that takes them. Dropped cards that land nowhere go straight back.
  The uncovered card turns over. Each move and each undo costs a point; a
  finished run flies home, ace first, for 100.
- Clicking the stock, **D** or **Deal!** deals a row, refused with
  spider.exe's message while a column is empty. Clicking the score box or
  **M** shows the available moves in spider.exe's order, inverting each for
  250 ms.
- Undo keeps the last 150 moves; a deal or a finished run clears it.
- Winning plays the fireworks from spider.exe's particle model behind **Game
  Over**, at the window's bottom-right. They keep going after **No** until
  the next command.
- Difficulty, Options, Statistics (with its three tabs, wins, losses and
  streaks) and About use spider.exe's templates and strings. Saved games,
  save on exit, open at startup and the prompts before saving or opening
  follow its options. Closing a game in play asks to save it, and leaving one
  counts a loss. **Esc** hides the window, its boss key.
- The window opens maximized, like spider.exe.

## Decisions

- Saved games and statistics live in the browser's storage, not
  `spider.sav` and the registry.
- **Contents** in **Help** does nothing, like Minesweeper's.
- The fireworks follow spider.exe's model (launch, drag, gravity, color and
  size fading) but use the browser's random numbers and clock, so no two
  shows match. They weren't compared with the VM.

## Remaining differences

- Menu and dialog text use DOM fonts.
- When an animation frame jumps further than a card's width, spider.exe's
  sprite code can leave a black rectangle on the table, as in
  `xp-deal-row.png`. That depends on the machine's timing and isn't copied.
- Group box captions in Statistics don't get XP's beige box behind them.
