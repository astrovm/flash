const SEARCH_ORIGIN = "https://flashpointarchive.org";
const PLAYER_ORIGIN = "https://ooooooooo.ooo";
const DOWNLOAD_ORIGIN = "https://download.unstable.life";
const IMAGE_ORIGIN = "https://infinity.unstable.life";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const decodeHtml = (value = "") =>
  value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const plainText = (value = "") =>
  decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());

export function parseSearchResults(html) {
  const games = [];
  const blocks = html.match(
    /<div class="fp-search-result">[\s\S]*?(?=<div class="fp-search-result">|<\/div>\s*<\/div>\s*<div class="fp-search-navigation">|$)/g,
  );
  for (const block of blocks || []) {
    const id = block.match(/\/view\?id=([0-9a-f-]{36})/i)?.[1];
    const title = block.match(
      /class="fp-search-result-title"[^>]*>([\s\S]*?)<\/a>/i,
    )?.[1];
    if (!id || !title || !UUID_PATTERN.test(id)) continue;
    const creator = block.match(
      /class="fp-search-result-creator"[^>]*>([\s\S]*?)<\/span>/i,
    )?.[1];
    const info = plainText(
      block.match(
        /class="fp-search-result-info"[^>]*>([\s\S]*?)<\/div>/i,
      )?.[1] || "",
    );
    const [platformPart, tagPart = ""] = info.split(/\s+game\s+-\s+/i);
    const tags = tagPart
      .split(/\s+-\s+/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    games.push({
      uuid: id.toLowerCase(),
      title: plainText(title),
      developer: plainText(creator || "").replace(/^by\s+/i, ""),
      platform: platformPart || "",
      tags,
      logoUrl: `/api/games/${id.toLowerCase()}/logo`,
      potentiallyCompatible: platformPart.toLowerCase() === "flash",
    });
  }
  return games;
}

const attribute = (html, name) =>
  decodeHtml(
    html.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1] || "",
  );

const detailRows = (html) => {
  const rows = new Map();
  for (const match of html.matchAll(
    /<div class="row">\s*<div class="field">([\s\S]*?)<\/div>\s*<div class="value">([\s\S]*?)<\/div>\s*<\/div>/gi,
  )) {
    const label = plainText(match[1]).replace(/:$/, "");
    if (!rows.has(label)) rows.set(label, plainText(match[2]));
  }
  return rows;
};

export function parseGameDetails(html, requestOrigin, uuid) {
  if (!UUID_PATTERN.test(uuid)) throw new Error("Invalid game UUID");
  const rows = detailRows(html);
  const gameZipUrl = attribute(html, "data-game-zip");
  const launchCommand = attribute(html, "data-launch-command");
  const title = plainText(
    html.match(/<div class="header-large">([\s\S]*?)<\/div>/i)?.[1] || "",
  );
  const tagsBlock =
    html.match(
      /<div class="field">Tags:<\/div>\s*<div class="value">([\s\S]*?)<\/div>/i,
    )?.[1] || "";
  const tags = [...tagsBlock.matchAll(/<li>([\s\S]*?)<\/li>/gi)].map((match) =>
    plainText(match[1]),
  );
  const normalizedUuid = uuid.toLowerCase();
  const expectedZipPath = new RegExp(
    `^/gib-roms/Games/${normalizedUuid}-\\d+\\.zip$`,
    "i",
  );
  let hasSafeGameZip = false;
  if (gameZipUrl) {
    try {
      const parsed = new URL(gameZipUrl);
      hasSafeGameZip =
        parsed.origin === DOWNLOAD_ORIGIN && expectedZipPath.test(parsed.pathname);
    } catch {
      hasSafeGameZip = false;
    }
  }
  const platform = rows.get("Platform") || "";
  const library = rows.get("Library") || "";
  const status = rows.get("Status") || "";
  const applicationPath = rows.get("Application Path") || "";
  const compatible =
    hasSafeGameZip &&
    platform.toLowerCase() === "flash" &&
    library.toLowerCase() === "games" &&
    status.toLowerCase() === "playable" &&
    /(?:flash\s*player|flashplayer)/i.test(applicationPath) &&
    /\.swf(?:$|[?#])/i.test(launchCommand);

  return {
    uuid: normalizedUuid,
    title,
    developer: rows.get("Developer") || "",
    sourceUrl: rows.get("Source") || "",
    library,
    platform,
    status,
    applicationPath,
    launchCommand,
    tags,
    logoUrl: `${requestOrigin}/api/games/${normalizedUuid}/logo`,
    downloadUrl: `${requestOrigin}/api/games/${normalizedUuid}/download`,
    compatible,
    incompatibleReason: compatible
      ? null
      : !hasSafeGameZip
        ? "This entry does not have a supported GameZIP."
        : "This entry is not a playable Flash game.",
    upstreamUrl: `${SEARCH_ORIGIN}/view?id=${normalizedUuid}`,
    gameZipUrl: hasSafeGameZip ? gameZipUrl : null,
  };
}

const json = (value, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": status === 200 ? "public, max-age=900" : "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });

const fetchText = async (fetchObject, url) => {
  const response = await fetchObject(url, {
    headers: { "User-Agent": "Astro-Flash-Catalog/1.0" },
  });
  if (!response.ok) {
    throw new Error(`Flashpoint upstream returned ${response.status}.`);
  }
  return response.text();
};

const fetchPlayerDetails = async (fetchObject, uuid, requestOrigin) => {
  const html = await fetchText(
    fetchObject,
    `${PLAYER_ORIGIN}/?id=${encodeURIComponent(uuid)}`,
  );
  return parseGameDetails(html, requestOrigin, uuid);
};

const proxyResponse = (upstream, cacheSeconds) => {
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": `public, max-age=${cacheSeconds}`,
    "Content-Type":
      upstream.headers.get("content-type") || "application/octet-stream",
  });
  for (const name of [
    "content-length",
    "content-disposition",
    "etag",
    "last-modified",
  ]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
};

export async function handleRequest(request, fetchObject = fetch) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/api/games") {
    const query = (url.searchParams.get("q") || "").trim();
    if (!query || query.length > 100) {
      return json({ error: "Enter a search between 1 and 100 characters." }, 400);
    }
    try {
      const upstream = new URL("/search", SEARCH_ORIGIN);
      upstream.searchParams.set("query", query);
      const html = await fetchText(fetchObject, upstream);
      return json({ games: parseSearchResults(html) });
    } catch (error) {
      return json({ error: error.message || "Catalog search failed." }, 502);
    }
  }

  const match = path.match(
    /^\/api\/games\/([0-9a-f-]{36})(?:\/(download|logo))?$/i,
  );
  if (!match || !UUID_PATTERN.test(match[1])) {
    return json({ error: "Not found." }, 404);
  }
  const uuid = match[1].toLowerCase();
  const action = match[2];
  try {
    if (action === "logo") {
      const logoPath = `Logos/${uuid.slice(0, 2)}/${uuid.slice(2, 4)}/${uuid}.png`;
      const upstream = await fetchObject(
        `${IMAGE_ORIGIN}/images/${logoPath}?type=jpg`,
      );
      if (!upstream.ok) return json({ error: "Logo not found." }, upstream.status);
      return proxyResponse(upstream, 86400);
    }
    const details = await fetchPlayerDetails(fetchObject, uuid, url.origin);
    if (action === "download") {
      if (!details.compatible || !details.gameZipUrl) {
        return json({ error: details.incompatibleReason }, 422);
      }
      const upstream = await fetchObject(details.gameZipUrl, {
        headers: { "User-Agent": "Astro-Flash-Catalog/1.0" },
      });
      if (!upstream.ok) {
        return json({ error: `Game download returned ${upstream.status}.` }, 502);
      }
      return proxyResponse(upstream, 3600);
    }
    const { gameZipUrl: _privateUpstreamUrl, ...publicDetails } = details;
    return json(publicDetails);
  } catch (error) {
    return json({ error: error.message || "Game lookup failed." }, 502);
  }
}

export default { fetch: handleRequest };
