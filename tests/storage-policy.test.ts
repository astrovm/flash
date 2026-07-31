import { expect, test } from "bun:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const policy = require("../site/js/storage-policy.js");

test("treats storage estimates as optional information", async () => {
  expect(
    await policy.estimate({
      estimate: async () => ({ usage: 100, quota: 200 }),
    }),
  ).toEqual({ usage: 100, quota: 200, usageDetails: null });
  expect(
    await policy.estimate({
      estimate: async () => {
        throw new Error("estimate unavailable");
      },
    }),
  ).toBeNull();
});

test("requests persistence without blocking storage writes", async () => {
  expect(
    await policy.requestPersistence({
      persist: async () => {
        throw new Error("permission denied");
      },
    }),
  ).toBe(false);
});

test("normalizes real quota failures", () => {
  const quotaError = new DOMException("full", "QuotaExceededError");
  expect(policy.isQuotaExceeded(quotaError)).toBe(true);
  expect(policy.normalizeError(quotaError).message).toBe(policy.QUOTA_MESSAGE);
  expect(policy.errorMessage(new Error("network failed"))).toBe(
    "network failed",
  );
});
