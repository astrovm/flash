import { describe, expect, test } from "bun:test";

import {
  handleCatalogRequest,
  legacyAssetUrl,
  parseGameDetails,
  parseSearchResults,
} from "../catalog/catalog";
import catalogWorker from "../worker/catalog-worker";

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
const detailsHtml = `
<div class="header-large">Bike Mania Arena</div>
<div class="player-container"
  data-game-zip="https://download.unstable.life/gib-roms/Games/${uuid}-1651457108151.zip"
  data-legacy-server="https://infinity.unstable.life/Flashpoint/Legacy/htdocs"
  data-launch-command="http://localflash/bikemaniaarena1/bike-mania-arena-1.swf"
  data-id="${uuid}"></div>
<div class="row"><div class="field">Developer:</div><div class="value">Flash Games 247</div></div>
<div class="row"><div class="field">Library:</div><div class="value">Games</div></div>
<div class="row"><div class="field">Platform:</div><div class="value">Flash</div></div>
<div class="row"><div class="field">Status:</div><div class="value">Playable</div></div>
<div class="row"><div class="field">Tags:</div><div class="value"><ul><li>Sports</li><li>Motocross</li></ul></div></div>
<div class="row"><div class="field">Application Path:</div><div class="value">FPSoftware\\Flash\\flashplayer_32_sa.exe</div></div>`;

describe("Flashpoint catalog parsing", () => {
  test("parses search results and safely decodes text", () => {
    const results = parseSearchResults(searchHtml);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      uuid,
      title: "Bike Mania Arena",
      developer: "Flash Games 247",
      platform: "Flash",
      tags: ["Sports", "Motocross", "Auto-zipped"],
    });
    expect(
      parseSearchResults(
        searchHtml.replace(
          "Bike Mania Arena",
          "&lt;b&gt;Bike Mania Arena&lt;/b&gt;",
        ),
      )[0].title,
    ).toBe("Bike Mania Arena");
    expect(
      parseSearchResults(
        searchHtml.replace(
          "Bike Mania Arena",
          "&amp;lt;b&amp;gt;Bike Mania Arena&amp;lt;/b&amp;gt;",
        ),
      )[0].title,
    ).toBe("&lt;b&gt;Bike Mania Arena&lt;/b&gt;");
  });

  test("parses GameZIP and Legacy compatibility", () => {
    const details = parseGameDetails(
      detailsHtml,
      "https://flash.example",
      uuid,
    );
    expect(details).toMatchObject({
      compatible: true,
      packageType: "gamezip",
      legacyFallback: true,
      downloadUrl: `https://flash.example/api/games/${uuid}/download`,
      tags: ["Sports", "Motocross"],
    });

    const unsupported = parseGameDetails(
      detailsHtml
        .replace(/data-game-zip="[^"]+"/, 'data-game-zip=""')
        .replace(/data-legacy-server="[^"]+"/, 'data-legacy-server=""'),
      "https://flash.example",
      uuid,
    );
    expect(unsupported.compatible).toBeFalse();
    const legacy = parseGameDetails(
      detailsHtml.replace(/data-game-zip="[^"]+"/, 'data-game-zip=""'),
      "https://flash.example",
      uuid,
    );
    expect(legacy.compatible).toBeTrue();
    expect(legacy.packageType).toBe("legacy");
  });

  test("accepts safe Legacy paths and rejects traversal", () => {
    expect(legacyAssetUrl("content/localflash/game/main.swf")).toBe(
      "https://infinity.unstable.life/Flashpoint/Legacy/htdocs/localflash/game/main.swf",
    );
    expect(() => legacyAssetUrl("content/localflash/../secret")).toThrow(
      "Invalid Legacy",
    );
  });
});

describe("shared catalog request handler", () => {
  test("serves search results in both local and Worker entrypoints", async () => {
    const fetcher = async () =>
      new Response(searchHtml, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    const request = new Request(
      "https://flash.example/api/games?q=bike%20mania",
    );
    const localResponse = await handleCatalogRequest(request, fetcher);
    expect(localResponse.status).toBe(200);
    expect((await localResponse.json()).games[0].title).toBe(
      "Bike Mania Arena",
    );

    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = fetcher as unknown as typeof fetch;
      const workerResponse = await catalogWorker.fetch(request);
      expect(workerResponse.status).toBe(200);
      expect((await workerResponse.json()).games[0].title).toBe(
        "Bike Mania Arena",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("validates methods, queries, and UUID routes", async () => {
    expect(
      (
        await handleCatalogRequest(
          new Request("https://flash.example/api/games", {
            method: "POST",
          }),
        )
      ).status,
    ).toBe(405);
    expect(
      (
        await handleCatalogRequest(
          new Request("https://flash.example/api/games?q="),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handleCatalogRequest(
          new Request("https://flash.example/api/games/not-a-uuid"),
        )
      ).status,
    ).toBe(404);
  });
});
