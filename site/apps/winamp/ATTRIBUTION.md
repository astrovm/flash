# Winamp module attribution

This is a first-party Astro Flash application module. Its player state,
playlist, equalizer, file routing, lifecycle, and DOM integration are maintained
in this directory and do not load an iframe or an upstream runtime.

The authentic Winamp 2.91 base-skin sheets and Winamp icon are the project's
explicit external-asset exception. The sheets are stored as lossless PNG files
so browsers receive a reliable image content type. They were converted from
the BMP files copied from
[`captbaritone/webamp`](https://github.com/captbaritone/webamp) at commit
`5f56a5369c3e2346f4f6e045f214856ef9abaad4` on 2026-08-11:

- `packages/webamp/assets/skins/base-2.91/`
- `packages/webamp-docs/static/img/winamp2-32x32.png`

Webamp is MIT licensed; its license is preserved in `LICENSE.webamp.txt`.
Winamp and the original base-skin artwork are trademarks/assets of their
respective owners. No affiliation or endorsement is implied.
