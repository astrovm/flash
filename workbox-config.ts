import { join, resolve } from "node:path";

const outputDirectory = resolve(process.env.SITE_OUTPUT_DIR || "dist");

export const PRECACHE_EXTENSIONS = [
  "ttf",
  "woff",
  "woff2",
  "css",
  "ico",
  "svg",
  "bmp",
  "mp3",
  "wav",
  "png",
  "jpg",
  "jpeg",
  "cur",
  "json",
  "html",
  "js",
  "mjs",
  "wasm",
  "data",
  "swf",
  "jsdos",
  "xml",
  "phtml",
] as const;

export default {
  globDirectory: `${outputDirectory}/`,
  globPatterns: [`**/*.{${PRECACHE_EXTENSIONS.join(",")}}`],
  globIgnores: [
    "version.json",
    "swf/**",
    "iframe/**",
    "dos/**",
    "vendor/boxedwine/**",
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
