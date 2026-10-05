# FreeCell

FreeCell is now a web-native rebuild of XP SP3's `freecell.exe`, replacing
the BoxedWine copy. It was studied from the original binary (Ghidra 12.1.4,
for notes only) and the XP VM at 1024×768 (`bun run xp:vm`), then written
from those notes. No decompiled code is in the repository. The images are
1:1 crops, not scaled.

| View                 | VM                   | App                   |
| -------------------- | -------------------- | --------------------- |
| Game #1              | `xp-game-1.png`      | `app-game-1.png`      |
| Statistics           | `xp-statistics.png`  | `app-statistics.png`  |
| Options              | `xp-options.png`     | `app-options.png`     |
| Game Number          | `xp-game-number.png` | `app-game-number.png` |
| Win (Ctrl+Shift+F10) | `xp-win.png`         | `app-win.png`         |

## Matched

- Deals use the C runtime's `rand()`, seeded with the game number, so every
  game from 1 to 1000000 matches XP. Games -1 and -2 are XP's hidden ordered
  deals. New Game suggests a number the way XP does, from the clock.
- The table is pixel for pixel XP's: the 640×480 window, the 632×426 client
  area, `#007F00`, cells with a black top-left and `#00FF00` bottom-right
  edge, column offsets from the client width, 18px row steps, and the king
  box. Game #1 differs from the VM only in DOM text and the VM's cursor.
- Cards come from `cards.dll`. Their corners leave three pixels unpainted and
  their outlines are black, as `cards.dll` draws them. A selected card is
  inverted; two-color clubs and spades from ace to ten invert to cyan with
  white pips, like XP.
- Moves are click then click, with XP's rules: free cells, home cells by
  suit, alternating columns, and runs as long as
  (free cells + 1) × (empty columns + 1). Long runs move one card at a time
  through free cells and empty columns, the way XP animates them.
- Moving a run to an empty column asks **Move column** or **Move single
  card**. Without free cells, it moves one card without asking.
- After every move, XP's safe cards go home: aces, twos, and higher cards once
  both opposite-color suits are home up to one rank below.
- Undo (**F10**) reverses the last move and its automatic moves, one level,
  as in XP.
- Slides take one frame per 37 pixels, and **Quick play** turns them off.
- Double-clicking a column's bottom card sends it to the first free cell.
  Holding the right button shows a covered card.
- The keyboard works as in XP: 1 to 8 pick columns, 0 the free cells (and
  cycles through them), 9 home. Pressing the selected column's key again
  shows its cards one by one, 300 ms apart.
- The cursor turns into FreeCell's down arrow over columns that take the
  selection, and XP's up arrow over cells and empty columns. The king looks
  toward the cells under the pointer.
- One move left flashes the window four times, 400 ms apart. No moves left
  shows **Game Over** with **Same game**. Winning draws the large smiling
  king and **Game Over** with **Select game**.
- **Ctrl+Shift+F10** opens XP's hidden "User-Friendly User Interface" box to
  win or lose on the next move.
- Statistics, streaks, and the three options are kept like XP's registry
  values. A replayed game counts once, and games -1 and -2 don't count.
  Resigning by starting another game or closing the window counts as a loss.
- Dialogs are built from `freecell.exe`'s dialog templates in dialog units
  (6×13 pixels per 4×8 units), at XP's positions. Game Over and Move to Empty
  Column have no close button, as in XP. The Statistics text keeps XP's
  strings and tab stops.
- XP's own text quirks are kept: "Sorry, you lose.There are no more legal
  moves." and "That move requires moving 2 cards.You only have enough free
  space to move 1."

## Decisions

- **Help** keeps **About FreeCell...** only. XP's Contents, Search, and How
  to Use Help open help files the simulation doesn't have, so they are
  omitted, like in Task Manager.
- A maximized window stays 640 pixels wide, like XP.

## Remaining differences

- Text uses DOM fonts, so glyphs differ slightly from GDI; checkbox labels
  sit one pixel lower.
- XP draws the owner window inactive while a dialog is open, and hides
  **Cards Left** when the window is inactive. The app's dialogs leave the
  window active.
- Pressing **F10** shows menu underlines in the app; in XP the accelerator
  takes the key first.
