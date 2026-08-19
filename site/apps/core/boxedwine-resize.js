import {
  boxedWineApplications,
  getBoxedWineApplication,
} from "./boxedwine-applications.js";

// BoxedWine advertises no window manager, so Wine treats itself as the sole
// authority on its window geometry and ignores the X resize the shell performs.
// The shell therefore also writes the requested client size to the D: drive,
// where each application's in-guest resize helper polls for it and applies it
// internally with SetWindowPos, which Wine does honour.
//
// The request filename must put each application's own distinguishing
// characters within its first six bytes: this virtual DOS drive assigns
// legacy 8.3 short names by truncating the base filename, so a shared prefix
// like "bwsize-" collides across every application (all resolve to
// BWSIZE~1/BWSIZE~2/...) and only the very first file created can reliably be
// reopened by name afterward.
const requestPath = (appId) => `/d_drive/${appId}.bws`;

// BoxedWine's D: drive only exposes the directory listing it captured at some
// early, fixed point during boot; files created afterward are invisible to
// any guest process, no matter when that process itself started. Every
// application's request file is therefore pre-created here, as early as
// possible, filled with a size below MIN_DIMENSION so the in-guest helper
// treats it as "no request yet" until a real resize overwrites its content
// (content updates to an already-existing file do stay visible).
const PLACEHOLDER_SIZE = "0 0";

const isResizeRequest = (event, origin) => {
  const { type, appId, width, height } = event.data || {};
  return (
    event.origin === origin &&
    type === "boxedwine-resize-window" &&
    Boolean(getBoxedWineApplication(appId)) &&
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width >= 100 &&
    height >= 100 &&
    width <= 16384 &&
    height <= 16384
  );
};

export const installBoxedWineResizeBridge = (hostWindow, module) => {
  const pending = new Map();
  let ready = false;

  const flush = () => {
    if (!ready || typeof module.FS?.writeFile !== "function") return;
    for (const [appId, size] of pending) {
      try {
        module.FS.writeFile(requestPath(appId), size);
      } catch {
        // The mounted drive is unavailable only when startup has failed.
        continue;
      }
      pending.delete(appId);
    }
  };

  const onMessage = (event) => {
    if (
      event.source !== hostWindow.parent ||
      !isResizeRequest(event, hostWindow.location.origin)
    )
      return;
    pending.set(event.data.appId, `${event.data.width} ${event.data.height}`);
    flush();
  };

  const onRuntimeInitialized = module.onRuntimeInitialized;
  module.onRuntimeInitialized = () => {
    onRuntimeInitialized?.();
    ready = true;
    for (const application of boxedWineApplications) {
      const path = requestPath(application.id);
      try {
        module.FS.stat(path);
      } catch {
        try {
          module.FS.writeFile(path, PLACEHOLDER_SIZE);
        } catch {
          // The mounted drive is unavailable only when startup has failed.
        }
      }
    }
    flush();
  };
  hostWindow.addEventListener("message", onMessage);

  return () => hostWindow.removeEventListener("message", onMessage);
};
