# reVCDOS runtime

- Project: https://github.com/Lolendor/reVCDOS
- Commit: `95f14ef3c1d0a872ecd0881544cc7e1f55cb1946`
- Runtime package: `vc-sky-en-v6`
- Retrieved: 2026-07-29
- WASM SHA-256: `db6aa7b9169a638e06b17f7bed5a6b3e473e00ae7bbb47354729fa94b971ebf2`

The browser runtime, page, cover, intro, modules, and package manifest are
vendored from that Lolendor commit. Astro Flash does not bundle the compatible
game-data package. A small local adapter assembles the upstream
135,355,111-byte preload from files selected or downloaded by the user and
serves remaining assets from the same local file set instead of the upstream
CDN.

The upstream MIT license is stored in `LOLENDOR-LICENSE`.

Automatic downloads use the torrent metadata published by DOS.Zone at
`https://br.cdn.dos.zone/launcher/revcdoseng.2.torrent` (info hash
`489dae72cb4433fadd7d38a12bb52a23b5a7cc1e`). The torrent metadata contains file
names, hashes, and tracker addresses, but not the game data itself.

The browser downloader is WebTorrent 3.0.21. Its bundled source and MIT license
are stored under `site/vendor/webtorrent/3.0.21/`.

The DOS.Zone Team attribution, in-game logo, and `jsdos-cloud-sdk.js` cloud-save
integration required by the upstream project are preserved.
