const XP_MENU_ITEMS = {
  File: new Set([
    "New",
    "Open...",
    "Save",
    "Save As...",
    "From Scanner or Camera...",
    "Print Preview",
    "Page Setup...",
    "Print...",
    "Send...",
    "Set As Background (Tiled)",
    "Set As Background (Centered)",
    "Recent File",
    "Exit",
  ]),
  Edit: new Set([
    "Undo",
    "Repeat",
    "Cut",
    "Copy",
    "Paste",
    "Clear Selection",
    "Select All",
    "Copy To...",
    "Paste From...",
  ]),
  View: new Set([
    "Tool Box",
    "Color Box",
    "Status Bar",
    "Text Toolbar",
    "Zoom",
    "View Bitmap",
  ]),
  Image: new Set([
    "Flip/Rotate",
    "Stretch/Skew",
    "Invert Colors",
    "Attributes...",
    "Clear Image",
    "Draw Opaque",
  ]),
  Colors: new Set(["Edit Colors..."]),
  Help: new Set(["Help Topics", "About Paint"]),
};

function tidySeparators(menu) {
  const rows = [...menu.querySelectorAll(".menu-row")];
  let previousWasSeparator = true;
  rows.forEach((row, index) => {
    if (!row.isConnected) return;
    if (!row.querySelector(".menu-hr")) {
      previousWasSeparator = false;
      return;
    }
    const hasFollowingItem = rows
      .slice(index + 1)
      .some(
        (candidate) =>
          candidate.isConnected && candidate.matches(".menu-item"),
      );
    if (previousWasSeparator || !hasFollowingItem) row.remove();
    else previousWasSeparator = true;
  });
}

function matchXPMenuStructure() {
  const extrasButton = document.querySelector(".extras-menu-button");
  document.getElementById(extrasButton?.getAttribute("aria-controls"))?.remove();
  extrasButton?.remove();
  document.querySelectorAll('.menu-popup[data-semantic-parent]').forEach((menu) => {
    if (!document.getElementById(menu.dataset.semanticParent)) menu.remove();
  });
  document.querySelectorAll(".menu-button").forEach((button) => {
    const name = button.getAttribute("aria-label") || button.textContent.trim();
    const allowed = XP_MENU_ITEMS[name];
    if (!allowed) return;
    const popup = document.getElementById(button.getAttribute("aria-controls"));
    if (!popup) return;
    popup.querySelectorAll(".menu-item").forEach((item) => {
      if (!allowed.has(item.getAttribute("aria-label"))) item.remove();
    });
    tidySeparators(popup);
  });
}

function publishTitle() {
  const title = `${window.file_name || "untitled"} - Paint`;
  document.title = title;
  window.parent.postMessage(
    { type: "xp-paint-title", title },
    window.location.origin,
  );
}

function installXPScrollbars() {
  const shell = document.querySelector(".canvas-scroll-shell");
  const viewport = shell?.querySelector(".canvas-area");
  if (!shell || !viewport || shell.querySelector(".xp-canvas-scrollbar")) return;

  const makeScrollbar = (axis) => {
    const vertical = axis === "vertical";
    const bar = document.createElement("div");
    bar.className = `xp-canvas-scrollbar ${axis}`;
    const backward = document.createElement("button");
    backward.type = "button";
    backward.tabIndex = -1;
    backward.setAttribute("aria-hidden", "true");
    backward.className = `xp-scroll-arrow xp-scroll-${vertical ? "up" : "left"}`;
    const track = document.createElement("div");
    track.className = "xp-scroll-track";
    const thumb = document.createElement("div");
    thumb.className = "xp-scroll-thumb";
    track.appendChild(thumb);
    const forward = document.createElement("button");
    forward.type = "button";
    forward.tabIndex = -1;
    forward.setAttribute("aria-hidden", "true");
    forward.className = `xp-scroll-arrow xp-scroll-${vertical ? "down" : "right"}`;
    bar.append(backward, track, forward);
    shell.appendChild(bar);

    const scrollKey = vertical ? "scrollTop" : "scrollLeft";
    const scrollSizeKey = vertical ? "scrollHeight" : "scrollWidth";
    const clientSizeKey = vertical ? "clientHeight" : "clientWidth";
    const coordinateKey = vertical ? "clientY" : "clientX";
    const sizeKey = vertical ? "height" : "width";
    const positionKey = vertical ? "top" : "left";

    const metrics = () => {
      const trackLength = track.getBoundingClientRect()[sizeKey];
      const maximum = Math.max(0, viewport[scrollSizeKey] - viewport[clientSizeKey]);
      const thumbLength = maximum === 0
        ? trackLength
        : Math.max(8, trackLength * viewport[clientSizeKey] / viewport[scrollSizeKey]);
      const travel = Math.max(0, trackLength - thumbLength);
      return { trackLength, maximum, thumbLength, travel };
    };

    const update = () => {
      const { maximum, thumbLength, travel } = metrics();
      const position = maximum ? travel * viewport[scrollKey] / maximum : 0;
      thumb.style[sizeKey] = `${thumbLength}px`;
      thumb.style[positionKey] = `${position}px`;
      backward.disabled = viewport[scrollKey] <= 0;
      forward.disabled = viewport[scrollKey] >= maximum;
    };

    const moveBy = (amount) => {
      viewport[scrollKey] += amount;
      update();
    };
    backward.addEventListener("click", () => moveBy(-16));
    forward.addEventListener("click", () => moveBy(16));
    track.addEventListener("pointerdown", (event) => {
      if (event.target === thumb) return;
      const offset = event[coordinateKey] - track.getBoundingClientRect()[positionKey];
      moveBy(offset < thumb.getBoundingClientRect()[positionKey] - track.getBoundingClientRect()[positionKey]
        ? -viewport[clientSizeKey]
        : viewport[clientSizeKey]);
    });
    thumb.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const startCoordinate = event[coordinateKey];
      const startScroll = viewport[scrollKey];
      const { maximum, travel } = metrics();
      const onMove = (moveEvent) => {
        viewport[scrollKey] = startScroll + (moveEvent[coordinateKey] - startCoordinate) * maximum / Math.max(1, travel);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
    viewport.addEventListener("scroll", update);
    return update;
  };

  const updateVertical = makeScrollbar("vertical");
  const updateHorizontal = makeScrollbar("horizontal");
  const corner = document.createElement("div");
  corner.className = "xp-scroll-corner";
  shell.appendChild(corner);
  const update = () => {
    updateVertical();
    updateHorizontal();
  };
  new ResizeObserver(update).observe(viewport);
  const canvas = viewport.querySelector(".main-canvas");
  if (canvas) new ResizeObserver(update).observe(canvas);
  update();
}

window.addEventListener("message", async (event) => {
  if (event.origin !== window.location.origin) return;
  if (event.data?.type !== "xp-paint-open-file") return;
  const { id, name, content } = event.data.file;
  try {
    const response = await fetch(content);
    const blob = await response.blob();
    const file = new File([blob], name, { type: blob.type });
    window.open_from_file(file, id);
  } catch (error) {
    window.show_error_message(`Failed to open ${name}.`, error);
  }
});

function announceReady() {
  if (
    typeof window.open_from_file !== "function" ||
    !window.systemHooks ||
    !document.querySelector(".jspaint .menu-button")
  ) {
    window.requestAnimationFrame(announceReady);
    return;
  }
  matchXPMenuStructure();
  installXPScrollbars();
  publishTitle();
  window.setInterval(publishTitle, 500);
  window.parent.postMessage({ type: "xp-paint-ready" }, window.location.origin);
}

announceReady();
