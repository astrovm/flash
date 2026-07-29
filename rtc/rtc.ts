const RTC_SERVERS_URL = "https://cloud.dos.zone/rtc/servers";

export type RtcFetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface IceServer {
  credential?: string;
  urls: string | string[];
  username?: string;
}

const isIceServer = (value: unknown): value is IceServer => {
  if (!value || typeof value !== "object") return false;
  const server = value as Record<string, unknown>;
  const urls = server.urls;
  return (
    typeof urls === "string" ||
    (Array.isArray(urls) && urls.every((url) => typeof url === "string"))
  );
};

export async function handleRtcRequest(
  request: Request,
  fetcher: RtcFetcher = fetch,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed.", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  }

  try {
    const upstream = await fetcher(RTC_SERVERS_URL, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!upstream.ok) {
      return new Response("RTC service unavailable.", {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const regions = (await upstream.json()) as unknown;
    const iceServers = Array.isArray(regions)
      ? regions.flatMap((region) => {
          if (!region || typeof region !== "object") return [];
          const servers = (region as Record<string, unknown>).iceservers;
          return Array.isArray(servers) ? servers.filter(isIceServer) : [];
        })
      : [];
    if (iceServers.length === 0) {
      return new Response("RTC service returned no servers.", {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      });
    }

    return new Response(
      request.method === "HEAD" ? null : JSON.stringify({ iceServers }),
      {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  } catch {
    return new Response("RTC service unavailable.", {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
