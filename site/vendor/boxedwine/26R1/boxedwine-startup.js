(function installBoxedWineStartup(global) {
  "use strict";

  const now = () => global.performance?.now?.() ?? Date.now();
  const startedAt = now();
  const requests = new Map();
  const metrics = [];

  const report = (stage, detail = {}) => {
    const currentTime = now();
    const message = {
      type: "boxedwine-startup",
      stage,
      elapsed: Math.max(0, Math.round(currentTime - startedAt)),
      ...detail,
    };
    metrics.push(message);
    global.parent?.postMessage(message, global.location.origin);
    return message;
  };

  const load = (url, name) => {
    if (requests.has(url)) return requests.get(url);
    report("download-start", { name });
    const request = global
      .fetch(url, { cache: "force-cache", credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load ${name}`);
        return response.arrayBuffer();
      })
      .then((buffer) => {
        report("download-ready", { name, bytes: buffer.byteLength });
        return new Uint8Array(buffer);
      });
    requests.set(url, request);
    void request
      .finally(() => {
        if (requests.get(url) === request) requests.delete(url);
      })
      .catch(() => {});
    return request;
  };

  global.BoxedWineStartup = Object.freeze({ load, metrics, report });
  report("runner-ready");
})(window);
