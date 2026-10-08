# Hearts

Hearts is now a web-native rebuild of XP SP3's `mshearts.exe`, replacing the
BoxedWine copy. It was studied from the original binary (Ghidra 12.1.4, for
notes only) and the XP VM at 1024×768, then written from those notes. No
decompiled code is in the repository. The images are 1:1 crops of the
window, not scaled. The VM and app shots play the same game, number 31324.

| View                              | VM                   | App                   |
| --------------------------------- | -------------------- | --------------------- |
| Name prompt                       | `xp-welcome.png`     | `app-welcome.png`     |
| Deal of game 31324                | `xp-deal.png`        | `app-deal.png`        |
| Three cards chosen                | `xp-pass-ready.png`  | `app-pass-ready.png`  |
| Cards received from Ben           | `xp-received.png`    | `app-received.png`    |
| A diamond on Ben's two of clubs   | `xp-err-follow.png`  | `app-err-follow.png`  |
| Hearts Options                    | `xp-options.png`     | `app-options.png`     |
| Score Sheet before the first hand | `xp-score-empty.png` | `app-score-empty.png` |
| Quote                             | `xp-quote.png`       | `app-quote.png`       |
| Game menu                         | `xp-gamemenu.png`    | `app-gamemenu.png`    |
| Game Over after 10 hands          | `xp-game-over.png`   | `app-game-over.png`   |

## Matched

- Deals use mshearts.exe's own shuffle: the C runtime's `rand()`, seeded
  with `time(NULL)` at startup. Each new game draws a game number and
  reseeds with it. Each card comes from `rand() % remaining`, and the pool's
  last card fills the hole. Three VM deals (714, 10132, 31324) were found by
  their game number and reproduced card for card.
- The computers pass and play the way mshearts.exe's do: their passing
  order, their leads (fishing for the queen with low spades, then suits
  that can't win), their discards, ducking under the table's best card, and
  keeping a high card while the human could shoot the moon. Replayed with
  the same human moves (Space for every card), the model gives the VM's
  Score Sheet for every hand of game 714 (8 hands, ending 120, 39, 26, 23),
  the first five of game 10132 (where the human shoots the moon) and the
  first six of game 31324. These replays are regression tests.
- The computers' chosen cards show white marks beside their hands, at the
  VM's pixels, until a dialog repaints the table.
- Passing goes left, right, across, then no pass. The status bar names the
  receiver, the button reads **Pass Left**, **Pass Right** or **Pass
  Across**, lights up and takes the focus at three cards, then **OK** accepts
  the raised new cards.
- The two of clubs leads. Cards follow suit; hearts can't lead until broken
  unless only hearts are left; no point cards on the first trick unless the
  hand holds nothing else. Each error shows mshearts.exe's status text and
  draws the card inverted over its neighbors for a quarter second. Inverted,
  cards.dll keeps a red card's own outline, so it turns cyan.
- Played cards leave gaps in the hands. Each played card glides in
  mshearts.exe's steps: its rough square root of the distance, an even
  number of steps, 5, 15 or 60 pixels a step for Slow, Normal and Fast. A
  finished trick stays a second, then goes to the winner one card at a time,
  last card first, at 5 or 30 pixels a step.
- Taking all 13 hearts and the queen of spades gives everyone else 26. At
  the end of a hand each player's point cards lie where the hand was.
- The Score Sheet keeps the last 12 hands with older totals struck out,
  shows the place (ties share the better one) and the lowest score in blue.
  At 100 it says **Game Over** or **Game Over -- You Win**, with the winner
  in dark red and the heart icon. After **OK** the next game starts by
  itself, as in the VM: mshearts.exe asks **Do you want to play again?** only
  when playing over the network.
- The Score Sheet is centered over the whole client area, status bar
  included: mshearts.exe means to leave the status bar out but subtracts a
  height it never sets.
- The layout comes from mshearts.exe's code: a 530 by 424 client inside a
  sunken edge, the table laid out in 397 pixels above the status bar's
  allowance, the 105 by 28 pass button, and the names in bold Tahoma in a
  13-pixel cell. The pass button's caption uses XP's raster **System** font,
  flat gray when disabled. The status bar uses Luna's status pane. The cards
  and pass marks match the VM pixel for pixel.
- The name prompt opens every time, filled with the saved name. **OK** needs
  a name; **Quit** and the close box close Hearts. Names keep XP's
  14-character limit.
- **Options** (F7) sets the speed and the computers' names (defaults
  Pauline, Michele and Ben), used from the next game. **Sound** (F8, off by
  default) plays the hearts-broken and queen waves extracted from
  mshearts.exe. **Score** (F9) shows the sheet. **Space** plays the leftmost
  legal card. **Esc** closes an open menu or hides the window,
  mshearts.exe's boss key.
- Settings are saved in the browser's storage, like the registry values.

## Decisions

- **Help** keeps **Quote** and **About Hearts**; **Help Topics** is left
  out, like Solitaire and FreeCell's help.
- There is no network play: the dealer and connection dialogs aren't built.
  Like mshearts.exe in local play, there's no **New Game** command or F2.
- mshearts.exe's hidden Ctrl+Alt+Shift+F12, which shows every hand only when
  a registry value is set, isn't built.

## Remaining differences

- Text uses DOM fonts. The quote wraps "away" onto its second line.
- Dialogs leave the main window's caption and menus active; XP shows them
  inactive.
- **About Hearts** opens where the shell centers its About dialog, lower
  than XP's.
- The VM's game 31324 drifted one point from the app's after hand 6, when
  the VM run's automated input went astray, so the Game Over totals differ
  (120, 26, 45, 69 against 121, 25, 45, 69). That stretch wasn't replayed.
