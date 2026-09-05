import { defineApplication } from "./application.js";

export const defineLazyApplication = (metadata, loader) => {
  let loaded = null;
  let pending = null;
  const load = () => {
    pending ||= loader()
      .then((application) => {
        loaded = application;
        return application;
      })
      .catch((error) => {
        pending = null;
        throw error;
      });
    return pending;
  };
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
