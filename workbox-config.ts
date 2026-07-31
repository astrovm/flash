import { join, resolve } from "node:path";

const outputDirectory = resolve(process.env.SITE_OUTPUT_DIR || "dist");

export default {
  globDirectory: `${outputDirectory}/`,
  globPatterns: [
    "**/*.{ttf,woff,woff2,css,ico,svg,mp3,wav,png,jpg,jpeg,cur,json,html,js,mjs,wasm,swf,jsdos,xml,phtml}",
  ],
  globIgnores: [
    "version.json",
    "swf/**",
    "iframe/**",
    "dos/**",
    "vendor/scummvm/**",
    "js/*.wasm",
    "js/core.ruffle.*.js",
  ],
  swDest: join(outputDirectory, "sw.js"),
  maximumFileSizeToCacheInBytes: 25_000_000,
  dontCacheBustURLsMatching: /\.[a-f0-9]{8}\.[^./]+$/,
  ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^v$/],
  sourcemap: false,
  cacheId: "astro-flash",
  cleanupOutdatedCaches: true,
  skipWaiting: false,
  clientsClaim: true,
  importScripts: [],
};
