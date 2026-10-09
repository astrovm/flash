"use strict";

// ============================================
// Display scale
// ============================================

// On fractional pixel ratios (125%, 150% or 175% zoom or display scaling),
// XP's one-pixel art can't land on whole device pixels, so bitmaps blur or
// double and their borders show seams. The page then lays out at the next
// whole ratio and the browser scales the finished frame down, like a
// supersampled display. Layout and pointer coordinates stay the same.
const getRenderDensity = () => Math.ceil(window.devicePixelRatio - 0.01);

let displayScaleQuery = null;
let displayScaleRatio = null;
const applyDisplayScale = () => {
  const root = document.documentElement;
  const ratio = window.devicePixelRatio;
  const density = getRenderDensity();
  const fractional = Math.abs(density - ratio) >= 0.01;
  displayScaleRatio = ratio;
  root.style.zoom = fractional ? String(density / ratio) : "";
  root.style.transformOrigin = fractional ? "0 0" : "";
  root.style.willChange = fractional ? "transform" : "";
  root.style.transform = "";
  sizeDisplayScaleRoot();
  // The first frames rasterize at the whole ratio. Scaling after them keeps
  // that raster and lets the GPU scale it down. A newer ratio may have
  // replaced this one by then.
  if (fractional)
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (displayScaleRatio === ratio)
          root.style.transform = `scale(${ratio / density})`;
      }),
    );
  displayScaleQuery?.removeEventListener("change", applyDisplayScale);
  displayScaleQuery = matchMedia(`(resolution: ${ratio}dppx)`);
  displayScaleQuery.addEventListener("change", applyDisplayScale);
};

// Browsers disagree on whether the zoomed root's 100% size is zoomed, so the
// scaled-down page could cover only part of the window. Pixel sizes are
// always zoomed, so the root is sized in pixels to fill the window exactly.
function sizeDisplayScaleRoot() {
  const root = document.documentElement;
  const zoomed = root.style.zoom !== "";
  root.style.width = zoomed ? `${window.innerWidth}px` : "";
  root.style.height = zoomed ? `${window.innerHeight}px` : "";
}

// Browser zoom and moving between monitors resize the window. The media
// query can miss a ratio it never matched exactly, so resizes check it too.
window.addEventListener("resize", () => {
  if (window.devicePixelRatio !== displayScaleRatio) applyDisplayScale();
  else sizeDisplayScaleRoot();
});
applyDisplayScale();
