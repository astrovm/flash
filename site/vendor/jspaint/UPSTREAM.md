# JS Paint runtime

This directory contains the browser runtime from
[1j01/jspaint](https://github.com/1j01/jspaint), pinned to commit
`53be67ab8c47cc0d2168899e7481bc04839c4c81` (version 1.1.0).

JS Paint is used as the drawing engine for the Windows XP Paint recreation.
The local `index.html`, `xp-bootstrap.js`, `xp-integration.js`, `xp.css`, and
the 512-pixel default canvas width in `src/app-state.js` adapt it to this
project's XP shell and filesystem.

JS Paint is licensed under the MIT License; see `LICENSE.txt`. The included
PDF.js runtime is licensed under Apache License 2.0; see `lib/pdf.js/LICENSE`.
