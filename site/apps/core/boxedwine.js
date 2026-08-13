const RUNTIME_ROOT = "vendor/boxedwine/26R1/";

const packageRoot = (packageId) => {
  const configuredRoot = window.ASTRO_GAME_ROOTS?.[packageId];
  const root = configuredRoot || `iframe/${packageId}/`;
  return root.endsWith("/") ? root : `${root}/`;
};

const runnerUrl = ({
  packageId,
  archive,
  executable,
  resolution,
  frameTop,
  sound,
}) => {
  const url = new URL(`${RUNTIME_ROOT}index.html`, document.baseURI);
  url.search = new URLSearchParams({
    appRoot: new URL(packageRoot(packageId), document.baseURI).href,
    archive,
    executable,
    resolution,
    frameTop: String(frameTop),
    sound: String(sound),
  });
  return url.href;
};

const getFramebufferSize = (host, nativeWidth, nativeHeight, frameTop) => ({
  width: Math.max(1, Math.round(host.clientWidth || nativeWidth)),
  height: Math.max(
    1,
    Math.round((host.clientHeight || nativeHeight) + frameTop),
  ),
});

const getHostSize = (host, nativeWidth, nativeHeight) => ({
  width: Math.max(1, Math.round(host.clientWidth || nativeWidth)),
  height: Math.max(1, Math.round(host.clientHeight || nativeHeight)),
});

export const mountBoxedWineApplication = ({
  title,
  packageId,
  archive,
  executable,
  nativeWidth,
  nativeHeight,
  resolution,
  frameTop = 0,
  sound = true,
  background = "#000",
  scaleOnly = false,
  onWindowSize,
  nativeFrameWidth = 0,
  nativeFrameHeight = 0,
}) => {
  let activeNativeWidth = nativeWidth;
  let activeNativeHeight = nativeHeight;
  const host = document.createElement("div");
  host.className = "window-content boxedwine-app-host";
  host.style.background = background;

  const frame = document.createElement("iframe");
  frame.className = "boxedwine-app-frame";
  frame.title = title;
  frame.allow = "fullscreen";
  const initialFramebuffer = getFramebufferSize(
    host,
    nativeWidth,
    nativeHeight,
    frameTop,
  );
  frame.style.width = "100%";
  frame.style.height = "100%";
  frame.src = runnerUrl({
    packageId,
    archive,
    executable,
    resolution:
      resolution || `${initialFramebuffer.width}x${initialFramebuffer.height}`,
    frameTop,
    sound,
  });
  host.appendChild(frame);

  const updateLayout = () => {
    const hostSize = getHostSize(host, activeNativeWidth, activeNativeHeight);
    const shouldScale =
      scaleOnly ||
      hostSize.width < activeNativeWidth ||
      hostSize.height < activeNativeHeight;
    const scale = shouldScale
      ? Math.min(
          1,
          hostSize.width / activeNativeWidth,
          hostSize.height / activeNativeHeight,
        )
      : 1;
    const framebuffer = shouldScale
      ? {
          width: activeNativeWidth,
          height: activeNativeHeight + frameTop,
        }
      : { width: hostSize.width, height: hostSize.height + frameTop };

    if (shouldScale) {
      frame.style.width = `${activeNativeWidth}px`;
      frame.style.height = `${activeNativeHeight}px`;
      frame.style.left = `${Math.max(0, (hostSize.width - activeNativeWidth * scale) / 2)}px`;
      frame.style.transform = `scale(${scale})`;
      frame.style.transformOrigin = "top left";
    } else {
      frame.style.width = "100%";
      frame.style.height = "100%";
      frame.style.left = "0px";
      frame.style.transform = "";
      frame.style.transformOrigin = "";
    }
    frame.contentWindow?.postMessage(
      {
        type: "boxedwine-framebuffer-resize",
        ...framebuffer,
        baseWidth: activeNativeWidth,
        baseHeight: activeNativeHeight + frameTop,
      },
      new URL(frame.src).origin,
    );
  };
  const resizeObserver = window.ResizeObserver
    ? new window.ResizeObserver(updateLayout)
    : null;
  resizeObserver?.observe(host);
  frame.addEventListener("load", updateLayout);
  const handleWindowMessage = (event) => {
    const { type, width, height } = event.data || {};
    if (
      event.source !== frame.contentWindow ||
      event.origin !== new URL(frame.src).origin ||
      type !== "boxedwine-window-size" ||
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 100 ||
      height < 100
    )
      return;
    if (nativeFrameWidth || nativeFrameHeight) {
      activeNativeWidth = Math.max(1, width - nativeFrameWidth);
      activeNativeHeight = Math.max(1, height - nativeFrameHeight);
    }
    onWindowSize?.(width, height);
    updateLayout();
  };
  window.addEventListener("message", handleWindowMessage);
  updateLayout();

  return {
    element: host,
    unmount() {
      resizeObserver?.disconnect();
      window.removeEventListener("message", handleWindowMessage);
      frame.removeEventListener("load", updateLayout);
      frame.src = "about:blank";
      frame.remove();
    },
  };
};
