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
}) => {
  const url = new URL(`${RUNTIME_ROOT}index.html`, document.baseURI);
  url.search = new URLSearchParams({
    appRoot: new URL(packageRoot(packageId), document.baseURI).href,
    archive,
    executable,
    resolution,
    frameTop: String(frameTop),
    sound: "false",
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

export const mountBoxedWineApplication = ({
  title,
  packageId,
  archive,
  executable,
  nativeWidth,
  nativeHeight,
  resolution,
  frameTop = 0,
  background = "#000",
}) => {
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
  });
  host.appendChild(frame);

  const updateLayout = () => {
    const framebuffer = getFramebufferSize(
      host,
      nativeWidth,
      nativeHeight,
      frameTop,
    );
    frame.contentWindow?.postMessage(
      { type: "boxedwine-framebuffer-resize", ...framebuffer },
      new URL(frame.src).origin,
    );
  };
  const resizeObserver = window.ResizeObserver
    ? new window.ResizeObserver(updateLayout)
    : null;
  resizeObserver?.observe(host);
  frame.addEventListener("load", updateLayout);
  updateLayout();

  return {
    element: host,
    unmount() {
      resizeObserver?.disconnect();
      frame.removeEventListener("load", updateLayout);
      frame.src = "about:blank";
      frame.remove();
    },
  };
};
