import { defineApplication } from "./application.js";

// Shares one in-flight load between callers and forgets a failed load, so the
// next call retries instead of replaying the rejection.
export const createRetryingLoader = (loader) => {
  let pending = null;
  return () =>
    (pending ??= loader().catch((error) => {
      pending = null;
      throw error;
    }));
};

export const defineLazyApplication = (metadata, loader) => {
  let loaded = null;
  const load = createRetryingLoader(() =>
    loader().then((application) => {
      loaded = application;
      return application;
    }),
  );
  return Object.freeze({
    ...defineApplication({
      ...metadata,
      mount(...args) {
        if (!loaded) throw new Error(`${metadata.title} is still loading.`);
        return loaded.mount(...args);
      },
    }),
    load,
    get loaded() {
      return loaded;
    },
  });
};
