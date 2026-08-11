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
  publishTitle();
  window.setInterval(publishTitle, 500);
  window.parent.postMessage({ type: "xp-paint-ready" }, window.location.origin);
}

announceReady();
