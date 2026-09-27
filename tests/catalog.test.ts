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

describe("catalog proxy and upstream failures", () => {
  const request = (path: string, method = "GET") =>
    new Request(`https://flash.example${path}`, { method });
  const legacyHtml = detailsHtml.replace(
    /data-game-zip="[^"]+"/,
    'data-game-zip=""',
  );
  test("OPTIONS advertises only supported methods without contacting upstream", async () => {
    const result = await handleCatalogRequest(
      request("/api/games", "OPTIONS"),
      async () => {
        throw new Error("unexpected fetch");
      },
    );
    expect(result.status).toBe(204);
    expect(result.headers.get("access-control-allow-methods")).toBe(
      "GET, OPTIONS",
    );
  });
  test("details hide private upstream URLs and normalize UUID case", async () => {
    const seen: string[] = [];
    const result = await handleCatalogRequest(
      request(`/api/games/${uuid.toUpperCase()}`),
      async (url) => {
        seen.push(String(url));
        return new Response(detailsHtml);
      },
    );
    const body = await result.json();
    expect(body.uuid).toBe(uuid);
    expect(body.downloadUrl).toBe(
      `https://flash.example/api/games/${uuid}/download`,
    );
    expect(body.gameZipUrl).toBeUndefined();
    expect(body.legacyServerUrl).toBeUndefined();
    expect(seen[0]).toContain(uuid);
  });
  for (const kind of ["logo", "download", "asset"] as const) {
    test(`${kind} forwards bytes and permitted headers with its cache policy`, async () => {
      const seen: string[] = [];
      const result = await handleCatalogRequest(
        request(
          `/api/games/${uuid}/${kind}?path=content/localflash/assets/a.bin`,
        ),
        async (url) => {
          seen.push(String(url));
          if (String(url).includes("?id=")) return new Response(detailsHtml);
          return new Response(Uint8Array.of(1, 2, 3), {
            headers: {
              "content-type": "application/octet-stream",
              "content-length": "3",
              "content-disposition": "inline",
              etag: "synthetic-etag",
              "last-modified": "Mon, 01 Jan 2024 00:00:00 GMT",
              "set-cookie": "do-not-proxy=this",
            },
          });
        },
      );
      expect(result.status).toBe(200);
      expect([...new Uint8Array(await result.arrayBuffer())]).toEqual([
        1, 2, 3,
      ]);
      expect(result.headers.get("etag")).toBe("synthetic-etag");
      expect(result.headers.get("content-length")).toBe("3");
      expect(result.headers.get("set-cookie")).toBeNull();
      expect(result.headers.get("access-control-allow-origin")).toBe("*");
      expect(result.headers.get("cache-control")).toBe(
        `public, max-age=${kind === "download" ? 3600 : 86400}`,
      );
      if (kind === "logo")
        expect(seen[0]).toContain(`/Logos/a2/fb/${uuid}.png`);
      if (kind === "asset")
        expect(seen.at(-1)).toEndWith("/localflash/assets/a.bin");
    });
    test(`${kind} reports unavailable upstream content`, async () => {
      const result = await handleCatalogRequest(
        request(`/api/games/${uuid}/${kind}?path=content/localflash/a.swf`),
        async (url) =>
          new Response(String(url).includes("?id=") ? detailsHtml : "missing", {
            status: String(url).includes("?id=") ? 200 : 404,
          }),
      );
      expect(result.status).toBe(kind === "download" ? 502 : 404);
      expect(result.headers.get("cache-control")).toBe("no-store");
      expect((await result.json()).error).toBeTruthy();
    });
  }
  for (const action of ["download", "asset"]) {
    test(`${action} enforces legacy size limits`, async () => {
      const seen: string[] = [];
      const result = await handleCatalogRequest(
        request(`/api/games/${uuid}/${action}?path=content/localflash/a.swf`),
        async (url) => {
          seen.push(String(url));
          return String(url).includes("?id=")
            ? new Response(legacyHtml)
            : new Response("oversized", {
                headers: { "content-length": String(1024 ** 3) },
              });
        },
      );
      expect(result.status).toBe(413);
      expect(seen.at(-1)).toStartWith("https://infinity.unstable.life/");
      expect((await result.json()).error).toContain("size limit");
    });
    test(`${action} rejects incompatible games before fetching assets`, async () => {
      let calls = 0;
      const result = await handleCatalogRequest(
        request(`/api/games/${uuid}/${action}`),
        async () => {
          calls++;
          return new Response(detailsHtml.replace(">Flash<", ">Java<"));
        },
      );
      expect(result.status).toBe(422);
      expect(calls).toBe(1);
    });
  }
  test("legacy downloads without length metadata still stream bytes", async () => {
    const result = await handleCatalogRequest(
      request(`/api/games/${uuid}/download`),
      async (url) =>
        String(url).includes("?id=")
          ? new Response(legacyHtml)
          : new Response(Uint8Array.of(70, 87, 83)),
    );
    expect(result.status).toBe(200);
    expect(result.headers.get("content-type")).toBe("application/octet-stream");
    expect(await result.text()).toBe("FWS");
  });
  for (const path of ["/api/games?q=test", `/api/games/${uuid}`]) {
    for (const failure of [
      new Error("synthetic network failure"),
      "opaque failure",
      null,
    ]) {
      test(`${path} reports ${String(failure)} as a noncacheable upstream failure`, async () => {
        const result = await handleCatalogRequest(request(path), async () => {
          throw failure;
        });
        expect(result.status).toBe(502);
        expect(result.headers.get("cache-control")).toBe("no-store");
        expect((await result.json()).error).toContain(
          failure instanceof Error
            ? failure.message
            : path.includes("?q=")
              ? "Catalog search failed"
              : "Game lookup failed",
        );
      });
    }
  }
  test("upstream HTTP failures are reported before parsing", async () => {
    const result = await handleCatalogRequest(
      request(`/api/games/${uuid}`),
      async () => new Response("", { status: 503 }),
    );
    expect(result.status).toBe(502);
    expect((await result.json()).error).toContain("503");
  });
  test("untrusted ZIP URLs never become download targets", () => {
    for (const url of [
      "not a url",
      "https://untrusted.example/archive.zip",
      "https://download.unstable.life/other.zip",
    ]) {
      const details = parseGameDetails(
        detailsHtml.replace(/data-game-zip="[^"]+"/, `data-game-zip="${url}"`),
        "https://flash.example",
        uuid,
      );
      expect(details.packageType).toBe("legacy");
    }
    expect(
      parseSearchResults(
        searchHtml.replace("Bike Mania Arena", "&#x41;&#66;"),
      )[0].title,
    ).toBe("AB");
  });
  test("legacy asset path validation rejects empty, long, encoded and malformed paths", () => {
    for (const path of [
      undefined,
      "a".repeat(2049),
      "content/host",
      "content/host/./file",
      "content//file",
      "content/host/a\\b",
      "content/host/a\0b",
      "content/ho@st/file",
      "content/host/%2e%2e/secret",
      "%invalid",
    ])
      expect(() => legacyAssetUrl(path)).toThrow();
  });
});
