"use strict";

(function exposeStartupRecovery(root, factory) {
  const createStartupRecovery = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = { createStartupRecovery };
  } else {
    createStartupRecovery(root);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const RECOVERY_KEY = "astroFlashStartupRecovery";
  const RECOVERY_PARAMETER = "__astro_recovery";
  const SHELL_CACHE_PREFIX = "astro-flash-";

  const createStartupRecovery = (
    environment,
    { startupTimeout = 12_000, retryTimeout = 30_000 } = {},
  ) => {
    let ready = false;
    let watchdog;

    const scheduleRecovery = (delay) => {
      environment.clearTimeout(watchdog);
      watchdog = environment.setTimeout(recover, delay);
    };

    const versionFromHtml = (html) => {
      const document = new environment.DOMParser().parseFromString(
        html,
        "text/html",
      );
      return document
        .querySelector('meta[name="astro-version"]')
        ?.getAttribute("content");
    };

    const recover = async () => {
      if (ready || environment.sessionStorage.getItem(RECOVERY_KEY)) return;
      if (environment.navigator.onLine === false) {
        scheduleRecovery(retryTimeout);
        return;
      }

      try {
        const nonce = environment.Date.now();
        const versionResponse = await environment.fetch(
          `/version.json?t=${nonce}`,
          { cache: "no-store" },
        );
        if (!versionResponse.ok) throw new Error("Version check failed");
        const metadata = await versionResponse.json();
        if (typeof metadata.version !== "string") {
          throw new Error("Version metadata is invalid");
        }

        const recoveryUrl = new environment.URL(environment.location.href);
        recoveryUrl.searchParams.set(
          RECOVERY_PARAMETER,
          `${metadata.version}-${nonce}`,
        );
        const htmlResponse = await environment.fetch(recoveryUrl.href, {
          cache: "no-store",
        });
        if (!htmlResponse.ok) throw new Error("Recovery page failed");
        if (versionFromHtml(await htmlResponse.text()) !== metadata.version) {
          throw new Error("Recovery page version is inconsistent");
        }

        const registrations =
          (await environment.navigator.serviceWorker?.getRegistrations?.()) ||
          [];
        await Promise.all(
          registrations.map((registration) => registration.unregister()),
        );
        if (environment.caches) {
          const names = await environment.caches.keys();
          await Promise.all(
            names
              .filter((name) => name.startsWith(SHELL_CACHE_PREFIX))
              .map((name) => environment.caches.delete(name)),
          );
        }
        environment.sessionStorage.setItem(RECOVERY_KEY, String(nonce));
        environment.location.replace(recoveryUrl.href);
      } catch (error) {
        environment.console.error("Automatic startup recovery failed:", error);
        scheduleRecovery(retryTimeout);
      }
    };

    const markReady = () => {
      ready = true;
      environment.clearTimeout(watchdog);
      environment.sessionStorage.removeItem(RECOVERY_KEY);
      const url = new environment.URL(environment.location.href);
      if (url.searchParams.has(RECOVERY_PARAMETER)) {
        url.searchParams.delete(RECOVERY_PARAMETER);
        environment.history.replaceState(null, "", url.href);
      }
    };

    environment.__ASTRO_STARTUP_READY__ = markReady;
    scheduleRecovery(startupTimeout);
    return { markReady, recover };
  };

  return createStartupRecovery;
});
