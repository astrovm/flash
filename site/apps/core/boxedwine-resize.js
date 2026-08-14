const isResizeMessage = (event, origin) => {
  const { type, appId, width, height, baseWidth, baseHeight } =
    event.data || {};
  return (
    event.origin === origin &&
    type === "boxedwine-framebuffer-resize" &&
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    Number.isInteger(baseWidth) &&
    Number.isInteger(baseHeight) &&
    width > 0 &&
    height > 0 &&
    baseWidth > 0 &&
    baseHeight > 0 &&
    (appId === undefined ||
      ["solitaire", "freecell", "spider-solitaire"].includes(appId))
  );
};

export const installBoxedWineResizeBridge = (hostWindow, module) => {
  let pendingResize = null;
  let runtimeInitialized = false;
  let windowSizeTimer = null;
  let previousWindowSize = "";
  let startupWindowReported = false;

  const reportWindowSize = () => {
    if (!runtimeInitialized || typeof module.FS?.readFile !== "function")
      return;
    try {
      const text = module.FS.readFile("/d_drive/boxedwine-window-size.txt", {
        encoding: "utf8",
      }).trim();
      if (text === previousWindowSize) return;
      const match = /^(\d+) (\d+)$/.exec(text);
      if (!match) return;
      previousWindowSize = text;
      if (!startupWindowReported) {
        startupWindowReported = true;
        hostWindow.BoxedWineStartup?.report("window-ready", {
          width: Number(match[1]),
          height: Number(match[2]),
        });
      }
      hostWindow.parent.postMessage(
        {
          type: "boxedwine-window-size",
          width: Number(match[1]),
          height: Number(match[2]),
        },
        hostWindow.location.origin,
      );
    } catch {
      // Most applications do not publish their native window size.
    }
  };

  const applyResize = () => {
    if (
      !runtimeInitialized ||
      !pendingResize ||
      (pendingResize.appId === undefined &&
        typeof module._boxedwine_resize_screen !== "function") ||
      typeof module.FS?.writeFile !== "function"
    )
      return;
    const { appId, width, height, baseWidth, baseHeight } = pendingResize;
    const appSizePaths = {
      solitaire: "/d_drive/solsize.txt",
      freecell: "/d_drive/freesize.txt",
      "spider-solitaire": "/d_drive/spidsize.txt",
    };
    const sizePath = appSizePaths[appId] || "/d_drive/boxedwine-size.txt";

    if (appId === undefined) module._boxedwine_resize_screen(width, height);
    module.FS.writeFile(
      sizePath,
      `${width} ${height} ${baseWidth} ${baseHeight}`,
    );
    pendingResize = null;
  };
  const onMessage = (event) => {
    if (!isResizeMessage(event, hostWindow.location.origin)) return;
    pendingResize = event.data;
    applyResize();
  };
  const onRuntimeInitialized = module.onRuntimeInitialized;
  module.onRuntimeInitialized = () => {
    onRuntimeInitialized?.();
    runtimeInitialized = true;
    if (typeof module.FS?.writeFile === "function") {
      for (const path of [
        "/d_drive/solsize.txt",
        "/d_drive/freesize.txt",
        "/d_drive/spidsize.txt",
      ]) {
        try {
          module.FS.writeFile(path, "");
        } catch {
          // The mounted drive is unavailable only when startup has failed.
        }
      }
    }
    applyResize();
    if (
      typeof module.FS?.readFile === "function" &&
      typeof hostWindow.setInterval === "function"
    ) {
      windowSizeTimer = hostWindow.setInterval(reportWindowSize, 100);
    }
  };
  hostWindow.addEventListener("message", onMessage);

  return () => {
    hostWindow.removeEventListener("message", onMessage);
    if (windowSizeTimer !== null) hostWindow.clearInterval(windowSizeTimer);
  };
};
