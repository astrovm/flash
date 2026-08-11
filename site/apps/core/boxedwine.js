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

export const mountBoxedWineApplication = ({
  title,
  packageId,
  archive,
  executable,
  nativeWidth,
  nativeHeight,
  resolution = "800x600",
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
  frame.style.width = `${nativeWidth}px`;
  frame.style.height = `${nativeHeight}px`;
  frame.src = runnerUrl({
    packageId,
    archive,
    executable,
    resolution,
    frameTop,
  });
  host.appendChild(frame);

  const updateLayout = () => {
    const availableWidth = host.clientWidth || nativeWidth;
    const availableHeight = host.clientHeight || nativeHeight;
    const scale = Math.min(
      availableWidth / nativeWidth,
      availableHeight / nativeHeight,
    );
    const left = (availableWidth - nativeWidth * scale) / 2;
    const top = (availableHeight - nativeHeight * scale) / 2;
    frame.style.setProperty("--boxedwine-scale", String(scale));
    frame.style.setProperty("--boxedwine-left", `${left}px`);
    frame.style.setProperty("--boxedwine-top", `${top}px`);
  };
  const resizeObserver = window.ResizeObserver
    ? new window.ResizeObserver(updateLayout)
    : null;
  resizeObserver?.observe(host);
  updateLayout();

  return {
    element: host,
    unmount() {
      resizeObserver?.disconnect();
      frame.src = "about:blank";
      frame.remove();
    },
  };
};
