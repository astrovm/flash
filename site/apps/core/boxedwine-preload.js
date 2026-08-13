const RUNTIME_ROOT = "vendor/boxedwine/26R1/";
let preloadPromise;

export const isConstrainedBoxedWineDevice = (hostWindow = window) => {
  const connection = hostWindow.navigator.connection;
  const mobileUserAgent =
    hostWindow.navigator.userAgentData?.mobile === true ||
    /Android|iPad|iPhone|iPod|Mobile/i.test(hostWindow.navigator.userAgent);
  return Boolean(
    connection?.saveData ||
    /(?:^|-)2g$/.test(connection?.effectiveType || "") ||
    (Number.isFinite(hostWindow.navigator.deviceMemory) &&
      hostWindow.navigator.deviceMemory < 4) ||
    hostWindow.matchMedia?.("(max-width: 600px)").matches ||
    hostWindow.matchMedia?.("(pointer: coarse)").matches ||
    mobileUserAgent,
  );
};

const runtimeUrl = (path, hostWindow) =>
  new URL(`${RUNTIME_ROOT}${path}`, hostWindow.document.baseURI).href;

export const preloadBoxedWineRuntime = async ({
  automatic = false,
  hostWindow = window,
} = {}) => {
  if (automatic && isConstrainedBoxedWineDevice(hostWindow)) return false;
  if (preloadPromise) return preloadPromise;

  preloadPromise = hostWindow
    .fetch(runtimeUrl("preload.json", hostWindow), {
      cache: "force-cache",
      credentials: "same-origin",
    })
    .then(async (response) => {
      if (!response.ok)
        throw new Error("BoxedWine preload manifest unavailable");
      const manifest = await response.json();
      if (
        !Array.isArray(manifest.files) ||
        manifest.files.some(
          (file) =>
            typeof file !== "string" || !/^[a-z0-9][a-z0-9.-]*$/i.test(file),
        )
      ) {
        throw new Error("Invalid BoxedWine preload manifest");
      }
      await Promise.all(
        manifest.files.map(async (file) => {
          const assetResponse = await hostWindow.fetch(
            runtimeUrl(file, hostWindow),
            {
              cache: "force-cache",
              credentials: "same-origin",
            },
          );
          if (!assetResponse.ok) {
            throw new Error("BoxedWine preload asset unavailable");
          }
          await assetResponse.arrayBuffer();
        }),
      );
      return true;
    })
    .catch((error) => {
      preloadPromise = undefined;
      throw error;
    });
  return preloadPromise;
};

export const scheduleBoxedWinePreload = (hostWindow = window) => {
  if (isConstrainedBoxedWineDevice(hostWindow)) return false;
  const start = () =>
    preloadBoxedWineRuntime({ automatic: true, hostWindow }).catch(() => {});
  if (typeof hostWindow.requestIdleCallback === "function") {
    hostWindow.requestIdleCallback(start, { timeout: 3000 });
  } else {
    hostWindow.setTimeout(start, 1500);
  }
  return true;
};

window.XPBoxedWinePreload = Object.freeze({
  preload: () => preloadBoxedWineRuntime(),
  schedule: () => scheduleBoxedWinePreload(),
});
