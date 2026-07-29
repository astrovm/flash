import { describe, expect, test } from "bun:test";

import { handleRtcRequest } from "../rtc/rtc";
import catalogWorker from "../worker/catalog-worker";

const upstreamServers = [
  {
    domain: "rtc.example",
    traffic: { dailyBytes: 123 },
    iceservers: [
      { urls: ["stun:rtc.example:3478"] },
      {
        urls: ["turn:rtc.example:3478?transport=tcp"],
        username: "temporary-user",
        credential: "temporary-password",
      },
    ],
  },
];

describe("RTC server proxy", () => {
  test("returns only fresh ICE configuration without caching metadata", async () => {
    const response = await handleRtcRequest(
      new Request("https://flash.example/api/rtc"),
      async () => Response.json(upstreamServers),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      iceServers: upstreamServers[0].iceservers,
    });
  });

  test("rejects unsupported methods and invalid upstream responses", async () => {
    expect(
      (
        await handleRtcRequest(
          new Request("https://flash.example/api/rtc", { method: "POST" }),
        )
      ).status,
    ).toBe(405);
    expect(
      (
        await handleRtcRequest(
          new Request("https://flash.example/api/rtc"),
          async () => Response.json([]),
        )
      ).status,
    ).toBe(502);
  });

  test("routes the Worker endpoint to the RTC proxy", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async () =>
        Response.json(upstreamServers)) as unknown as typeof fetch;
      const response = await catalogWorker.fetch(
        new Request("https://flash.example/api/rtc"),
      );
      expect(response.status).toBe(200);
      expect((await response.json()).iceServers).toHaveLength(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
