import domainMoveScript from "./domain-move.js" with { type: "text" };

export const SITE_ORIGIN = "https://xp.4st.li";
export const LEGACY_HOST = "flash.4st.li";
export const LEGACY_ORIGIN = `https://${LEGACY_HOST}`;
export const IMPORT_PATH = "/api/import";

// Installs over the old site's service worker, removes it, and reloads its
// tabs so they reach the move page instead of the cached shell.
export const RETIRED_SERVICE_WORKER = `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.registration
      .unregister()
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) =>
        Promise.all(clients.map((client) => client.navigate(client.url))),
      ),
  );
});
`;

const page = (body: string, script: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Astro XP</title>
    <link rel="icon" href="data:," />
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #000;
        color: #fff;
        font: 13px Tahoma, Verdana, sans-serif;
        text-align: center;
      }
      button {
        font: inherit;
        padding: 4px 16px;
      }
      a {
        color: #9cf;
        margin-left: 12px;
      }
    </style>
  </head>
  <body>
    ${body}
    <script>
${domainMoveScript}
    </script>
    <script>
${script}
    </script>
  </body>
</html>
`;

const htmlResponse = (html: string, policy: string) =>
  new Response(html, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": `default-src 'none'; img-src data:; script-src 'unsafe-inline'; style-src 'unsafe-inline'; ${policy}`,
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });

export const movePage = () =>
  htmlResponse(
    page(
      `<main>
      <p id="status" role="status">Moving to xp.4st.li…</p>
      <p id="ask" hidden>
        <button id="move" type="button">Move my files</button>
        <a id="skip" href="${SITE_ORIGIN}/">Not now</a>
      </p>
    </main>`,
      `const status = document.getElementById("status");
const ask = document.getElementById("ask");
AstroDomainMove.runExport(window, {
  targetOrigin: ${JSON.stringify(SITE_ORIGIN)},
  importPath: ${JSON.stringify(IMPORT_PATH)},
  onProgress: (count) => {
    status.textContent = "Moving your files to xp.4st.li… " + count;
  },
  requestWindow: (url) =>
    new Promise((resolve) => {
      status.textContent = "Your files are still on flash.4st.li.";
      ask.hidden = false;
      document.getElementById("move").addEventListener("click", () => {
        ask.hidden = true;
        status.textContent = "Moving your files to xp.4st.li…";
        resolve(window.open(url, "astro-xp-move", "popup,width=360,height=160"));
      });
      document.getElementById("skip").addEventListener("click", (event) => {
        event.preventDefault();
        resolve(null);
      });
    }),
});`,
    ),
    `frame-src ${SITE_ORIGIN}; frame-ancestors 'none'`,
  );

export const importPage = () =>
  htmlResponse(
    page(
      `<p role="status">Moving your files to xp.4st.li…</p>`,
      `AstroDomainMove.runImport(window, {
  sourceOrigin: ${JSON.stringify(LEGACY_ORIGIN)},
});`,
    ),
    `frame-ancestors ${LEGACY_ORIGIN}`,
  );

export function handleLegacyRequest(request: Request): Response {
  const url = new URL(request.url);
  if (/^\/sw(\.[^/]+)?\.js$/.test(url.pathname)) {
    return new Response(RETIRED_SERVICE_WORKER, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/javascript; charset=utf-8",
      },
    });
  }
  // Only real page loads can carry storage across. Crawlers, scripts and
  // older browsers get a permanent redirect.
  if (
    request.method === "GET" &&
    request.headers.get("Sec-Fetch-Dest") === "document"
  ) {
    return movePage();
  }
  return Response.redirect(`${SITE_ORIGIN}${url.pathname}${url.search}`, 308);
}
