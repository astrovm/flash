import assert from "node:assert/strict";
import {
  parseGameDetails,
  parseSearchResults,
} from "../worker/catalog-worker.mjs";

const uuid = "a2fb012a-b14c-6921-b688-403571e42bb0";
const searchHtml = `
<div class="fp-search-result">
  <a class="fp-search-result-logo" href="/view?id=${uuid}" data-src="logo"></a>
  <div class="fp-search-result-text">
    <div class="fp-search-result-header">
      <a class="fp-search-result-title" href="/view?id=${uuid}">Bike Mania Arena</a>
      <span class="fp-search-result-creator">by Flash Games 247</span>
    </div>
    <div class="fp-search-result-info">Flash game - <span class="fp-search-result-tags">Sports - Motocross - Auto-zipped</span></div>
  </div>
</div>`;
const results = parseSearchResults(searchHtml);
assert.equal(results.length, 1);
assert.equal(results[0].uuid, uuid);
assert.equal(results[0].title, "Bike Mania Arena");
assert.equal(results[0].developer, "Flash Games 247");
assert.equal(results[0].platform, "Flash");
assert.deepEqual(results[0].tags, ["Sports", "Motocross", "Auto-zipped"]);

const detailsHtml = `
<div class="header-large">Bike Mania Arena</div>
<div class="player-container"
  data-game-zip="https://download.unstable.life/gib-roms/Games/${uuid}-1651457108151.zip"
  data-launch-command="http://localflash/bikemaniaarena1/bike-mania-arena-1.swf"
  data-id="${uuid}"></div>
<div class="row"><div class="field">Developer:</div><div class="value">Flash Games 247</div></div>
<div class="row"><div class="field">Library:</div><div class="value">Games</div></div>
<div class="row"><div class="field">Platform:</div><div class="value">Flash</div></div>
<div class="row"><div class="field">Status:</div><div class="value">Playable</div></div>
<div class="row"><div class="field">Tags:</div><div class="value"><ul><li>Sports</li><li>Motocross</li></ul></div></div>
<div class="row"><div class="field">Application Path:</div><div class="value">FPSoftware\\Flash\\flashplayer_32_sa.exe</div></div>`;
const details = parseGameDetails(detailsHtml, "https://flash.example", uuid);
assert.equal(details.compatible, true);
assert.equal(details.downloadUrl, `https://flash.example/api/games/${uuid}/download`);
assert.deepEqual(details.tags, ["Sports", "Motocross"]);

const legacy = parseGameDetails(
  detailsHtml.replace(/data-game-zip="[^"]+"/, 'data-game-zip=""'),
  "https://flash.example",
  uuid,
);
assert.equal(legacy.compatible, false);
assert.match(legacy.incompatibleReason, /GameZIP/);

console.log("catalog worker tests passed");
