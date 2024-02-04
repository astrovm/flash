module.exports = {
	globDirectory: "docs/",
	globPatterns: [
		"**/*.{woff2,css,ico,svg,mp3,wav,png,json,html,js,wasm,swf,xml,phtml}",
	],
	swDest: "docs/sw.js",
	maximumFileSizeToCacheInBytes: 20000000,
	ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
};
