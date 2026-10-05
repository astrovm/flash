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
const applyDisplayScale = () => {
  const root = document.documentElement;
  const ratio = window.devicePixelRatio;
  const density = getRenderDensity();
  const fractional = Math.abs(density - ratio) >= 0.01;
  root.style.zoom = fractional ? String(density / ratio) : "";
  root.style.transformOrigin = fractional ? "0 0" : "";
  root.style.willChange = fractional ? "transform" : "";
  root.style.transform = "";
  // The first frames rasterize at the whole ratio. Scaling after them keeps
  // that raster and lets the GPU scale it down.
  if (fractional)
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        root.style.transform = `scale(${ratio / density})`;
      }),
    );
  displayScaleQuery?.removeEventListener("change", applyDisplayScale);
  displayScaleQuery = matchMedia(`(resolution: ${ratio}dppx)`);
  displayScaleQuery.addEventListener("change", applyDisplayScale);
};
applyDisplayScale();
