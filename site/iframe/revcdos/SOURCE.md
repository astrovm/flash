# reVCDOS runtime

- Project: https://github.com/Carter54git/revcdos
- Release: v9
- Archive: `vc-sky-9.zip`
- Retrieved: 2026-07-29
- SHA-256: `e4a8147738304834624561a893182fd4555e75e75b6911ed2cc37c205f119bfa`

Only the public reVCDOS engine and browser runtime are bundled. Astro Flash
does not bundle the compatible game-data package.

Automatic downloads use the torrent metadata published by DOS.Zone at
`https://br.cdn.dos.zone/launcher/revcdoseng.2.torrent` (info hash
`489dae72cb4433fadd7d38a12bb52a23b5a7cc1e`). The torrent metadata contains file
names, hashes, and tracker addresses, but not the game data itself.

The browser downloader is WebTorrent 3.0.21. Its bundled source and MIT license
are stored under `site/vendor/webtorrent/3.0.21/`.

The DOS.Zone Team attribution, in-game logo, and `jsdos-cloud-sdk.js` cloud-save
integration required by the upstream project are preserved.
