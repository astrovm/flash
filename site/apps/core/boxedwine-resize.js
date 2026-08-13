const isResizeMessage = (event, origin) => {
  const { type, width, height, baseWidth, baseHeight } = event.data || {};
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
    baseHeight > 0
  );
};

export const installBoxedWineResizeBridge = (hostWindow, module) => {
  let pendingResize = null;
  let runtimeInitialized = false;

  const applyResize = () => {
    if (
      !runtimeInitialized ||
      !pendingResize ||
      typeof module._boxedwine_resize_screen !== "function" ||
      typeof module.FS?.writeFile !== "function"
    )
      return;
    const { width, height, baseWidth, baseHeight } = pendingResize;
    const sizePath = "/d_drive/boxedwine-size.txt";
    const temporaryPath = `${sizePath}.tmp`;

    module._boxedwine_resize_screen(width, height);
    module.FS.writeFile(
      temporaryPath,
      `${width} ${height} ${baseWidth} ${baseHeight}`,
    );
    try {
      module.FS.unlink(sizePath);
    } catch {
      // The destination does not exist before the first resize.
    }
    module.FS.rename(temporaryPath, sizePath);
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
    applyResize();
  };
  hostWindow.addEventListener("message", onMessage);

  return () => hostWindow.removeEventListener("message", onMessage);
};
