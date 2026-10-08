# Hearts study notes

The native rebuild is pending. These notes record observations from XP SP3's
`mshearts.exe` and its resource templates, examined with Ghidra 12.1.4.
Decompiled code stays outside the repository.

## Deal and cards

- Cards use the shared cards.dll convention: rank times four plus suit,
  with clubs, diamonds, hearts, and spades in that order. Ace is rank zero
  in storage and ranks above king when winning a trick.
- The queen of spades is card 47 and contributes 13 points. Each heart
  contributes one point.
- Startup seeds the C runtime random generator with `time(NULL)`.
- The new-game routine at 01007e18 draws a random game seed and reseeds the
  generator before dealing.
- The deal routine at 01007f89 starts with cards 0 through 51. Each draw
  selects `rand() % remaining`, replaces that slot with the final remaining
  card, and reduces the pool. It deals 13 cards to each player, with player
  order offset by the dealer. This differs from Solitaire's shuffle.
- Pass modes cycle through Left, Right, Across, and no pass. The first
  three show a pass button and a prompt naming the receiving player.

## Dialogs and commands

- First run asks for the player's name in dialog 503, 235 by 50 dialog
  units. It has OK and Quit buttons.
- Defaults for the three computer names are Pauline, Michele, and Ben.
- Hearts Options is dialog 505, 180 by 148 units. It offers Slow, Normal,
  and Fast animation and the three computer names.
- Game offers Options (F7), Sound (F8), Score (F9), and Exit.
- Help offers Help Topics, Quote, and About Hearts. The quote dialog uses
  the short Julius Caesar quotation in the resource template.
- The Score Sheet title and four placement names are resource strings.
- Move errors distinguish failure to follow suit, leading hearts before
  they are broken, failure to lead the two of clubs, and playing a point
  card on the first trick.
- The registry settings include sound, name, speed, and the three computer
  player names.

## Work still needed

- Record a reference deal and derive its seed to verify every card.
- Verify passing order, first-trick exceptions, shooting the moon, tie
  rankings, and end-of-game scoring in the binary and XP VM.
- Study the computer passing and play routines before implementing AI.
- Capture the table, Options, Score Sheet, Quote, and game-over views.
- Build and visibly compare the native app, then remove the shared
  BoxedWine runtime after Calculator is also replaced.

