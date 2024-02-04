module.exports = {
	globDirectory: "docs/",
	globPatterns: [
		"**/*.{woff2,css,ico,svg,mp3,wav,png,json,html,js,wasm,swf,xml,phtml}",
	],
	swDest: "docs/js/sw.js",
	maximumFileSizeToCacheInBytes: 25000000,
	ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
};
