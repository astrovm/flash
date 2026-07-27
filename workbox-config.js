module.exports = {
	globDirectory: "docs/",
	globPatterns: [
		"**/*.{woff,woff2,css,ico,svg,mp3,wav,png,jpg,jpeg,cur,json,html,js,mjs,wasm,swf,jsdos,xml,phtml}",
	],
	swDest: "docs/sw.js",
	maximumFileSizeToCacheInBytes: 25000000,
	ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
	sourcemap: false,
	cacheId: 'astro-flash',
	cleanupOutdatedCaches: true,
	skipWaiting: true,
	clientsClaim: true
};
