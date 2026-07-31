"use strict";

(function exposeStoragePolicy(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AstroStoragePolicy = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const QUOTA_MESSAGE =
    "The browser refused the storage write because its actual storage quota was reached.";

  const isQuotaExceeded = (error) =>
    error?.name === "QuotaExceededError" ||
    error?.name === "NS_ERROR_DOM_QUOTA_REACHED";

  const normalizeError = (error, quotaMessage = QUOTA_MESSAGE) => {
    if (isQuotaExceeded(error)) {
      return new Error(quotaMessage, { cause: error });
    }
    if (error instanceof Error) return error;
    return new Error(String(error));
  };

  const errorMessage = (error, quotaMessage = QUOTA_MESSAGE) =>
    normalizeError(error, quotaMessage).message;

  const requestPersistence = async (storageManager) => {
    if (!storageManager?.persist) return false;
    try {
      return Boolean(await storageManager.persist());
    } catch {
      return false;
    }
  };

  const estimate = async (storageManager) => {
    if (!storageManager?.estimate) return null;
    try {
      const result = await storageManager.estimate();
      return {
        usage: Number.isFinite(result?.usage) ? result.usage : null,
        quota: Number.isFinite(result?.quota) ? result.quota : null,
        usageDetails: result?.usageDetails || null,
      };
    } catch {
      return null;
    }
  };

  return {
    QUOTA_MESSAGE,
    errorMessage,
    estimate,
    isQuotaExceeded,
    normalizeError,
    requestPersistence,
  };
});
