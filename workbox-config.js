const path = require("node:path");

const outputDirectory = path.resolve(process.env.SITE_OUTPUT_DIR || "dist");

module.exports = {
	globDirectory: `${outputDirectory}/`,
	globPatterns: [
		"**/*.{woff,woff2,css,ico,svg,mp3,wav,png,jpg,jpeg,cur,json,html,js,mjs,wasm,swf,jsdos,xml,phtml}",
	],
	globIgnores: ["version.json"],
	swDest: path.join(outputDirectory, "sw.js"),
	maximumFileSizeToCacheInBytes: 25000000,
	ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^v$/],
	sourcemap: false,
	cacheId: 'astro-flash',
	cleanupOutdatedCaches: true,
	skipWaiting: false,
	clientsClaim: true
};
