const MESSAGE_TYPE = "boxedwine-native-window";

export const installBoxedWineWindowBridge = (hostWindow, module) => {
  const forwardWindowEvent = (event) => {
    const detail = event.detail;
    if (!detail || typeof detail.type !== "string") return;
    const root = hostWindow.document.documentElement;
    root.dataset.boxedwineWindowEvents = String(
      Number(root.dataset.boxedwineWindowEvents || 0) + 1,
    );
    root.dataset.boxedwineLastWindowEvent = `${detail.type}:${detail.id}`;
    const transfer =
      detail.rgba instanceof Uint8ClampedArray ? [detail.rgba.buffer] : [];
    hostWindow.parent.postMessage(
      { type: MESSAGE_TYPE, window: detail },
      hostWindow.location.origin,
      transfer,
    );
  };

  const forwardPointerEvent = (event) => {
    const { type, windowId, x, y, button = 0 } = event.data || {};
    if (
      event.source !== hostWindow.parent ||
      event.origin !== hostWindow.location.origin ||
      (type !== "boxedwine-native-pointer" &&
        type !== "boxedwine-native-activate")
    )
      return;
    if (
      Number.isInteger(windowId) &&
      typeof module?._boxedwine_activate_window === "function"
    )
      module._boxedwine_activate_window(windowId);
    if (type === "boxedwine-native-activate") return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const canvas = hostWindow.document.getElementById("canvas");
    if (!canvas) return;
    canvas.dispatchEvent(
      new hostWindow.MouseEvent(event.data.eventType, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button,
        buttons: event.data.buttons || 0,
      }),
    );
  };

  hostWindow.addEventListener(MESSAGE_TYPE, forwardWindowEvent);
  hostWindow.addEventListener("message", forwardPointerEvent);
  return () => {
    hostWindow.removeEventListener(MESSAGE_TYPE, forwardWindowEvent);
    hostWindow.removeEventListener("message", forwardPointerEvent);
  };
};

export const createBoxedWineWindowSurface = ({
  host,
  runtimeWindow,
  origin,
  onFirstFrame,
  initiallyVisible = true,
}) => {
  const windows = new Map();
  const surfaces = new Map();
  const canvases = new Map();
  const anchoredWindows = new Set();
  const visibleWindows = new Set();
  let nextZIndex = 1;
  const topLevelId = (id) => {
    let current = windows.get(id);
    if (!current) return 0;
    while (current.parentId) {
      const parent = windows.get(current.parentId);
      if (!parent || !parent.parentId) return current.id;
      current = parent;
    }
    return 0;
  };

  const render = (topId) => {
    const top = windows.get(topId);
    if (!top?.mapped) return;
    let canvas = canvases.get(topId);
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.dataset.boxedwineWindow = String(topId);
      canvas.className = "boxedwine-native-window";
      canvases.set(topId, canvas);
      if (initiallyVisible) visibleWindows.add(topId);
      canvas.addEventListener("mousedown", (event) => {
        const rect = canvas.getBoundingClientRect();
        runtimeWindow.postMessage(
          {
            type: "boxedwine-native-pointer",
            windowId: topId,
            eventType: "mousedown",
            x: top.x + (event.clientX - rect.left),
            y: top.y + (event.clientY - rect.top),
            button: event.button,
            buttons: event.buttons,
          },
          origin,
        );
      });
      for (const eventType of ["mousemove", "mouseup"]) {
        canvas.addEventListener(eventType, (event) => {
          const rect = canvas.getBoundingClientRect();
          runtimeWindow.postMessage(
            {
              type: "boxedwine-native-pointer",
              windowId: topId,
              eventType,
              x: top.x + (event.clientX - rect.left),
              y: top.y + (event.clientY - rect.top),
              button: event.button,
              buttons: event.buttons,
            },
            origin,
          );
        });
      }
      host.appendChild(canvas);
    }
    canvas.hidden = !visibleWindows.has(topId);
    canvas.dataset.boxedwineX = String(top.x);
    canvas.dataset.boxedwineY = String(top.y);
    canvas.width = top.width;
    canvas.height = top.height;
    canvas.style.left = anchoredWindows.has(topId) ? "0px" : `${top.x}px`;
    canvas.style.top = anchoredWindows.has(topId) ? "0px" : `${top.y}px`;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);

    const drawTree = (id, offsetX, offsetY) => {
      const entry = windows.get(id);
      if (!entry?.mapped) return;
      const surface = surfaces.get(id);
      if (surface) context.drawImage(surface, offsetX, offsetY);
      for (const child of windows.values()) {
        if (child.parentId === id)
          drawTree(child.id, offsetX + child.x, offsetY + child.y);
      }
    };
    drawTree(topId, 0, 0);
    if (!canvas.dataset.firstFrame) {
      canvas.dataset.firstFrame = "true";
      onFirstFrame?.({ id: topId, title: top.title || "", canvas });
    }
  };

  const handleMessage = (event) => {
    if (
      event.source !== runtimeWindow ||
      event.origin !== origin ||
      event.data?.type !== MESSAGE_TYPE
    )
      return;
    const detail = event.data.window;
    if (!detail || !Number.isInteger(detail.id)) return;
    if (detail.type === "created") {
      windows.set(detail.id, { ...detail, mapped: false, title: "" });
      return;
    }
    const entry = windows.get(detail.id);
    if (detail.type === "destroyed") {
      windows.delete(detail.id);
      surfaces.delete(detail.id);
      visibleWindows.delete(detail.id);
      anchoredWindows.delete(detail.id);
      canvases.get(detail.id)?.remove();
      canvases.delete(detail.id);
      return;
    }
    if (!entry) return;
    if (detail.type === "title") entry.title = detail.title;
    if (detail.type === "owner") entry.ownerId = detail.parentId;
    if (detail.type === "mapped" || detail.type === "unmapped")
      entry.mapped = detail.type === "mapped";
    if (detail.type === "bounds") Object.assign(entry, detail);
    if (detail.type === "frame") {
      const surface =
        surfaces.get(detail.id) || document.createElement("canvas");
      surface.width = detail.width;
      surface.height = detail.height;
      surface
        .getContext("2d")
        .putImageData(
          new ImageData(detail.rgba, detail.width, detail.height),
          0,
          0,
        );
      surfaces.set(detail.id, surface);
    }
    const topId = topLevelId(detail.id);
    if (topId) {
      const canvas = canvases.get(topId);
      if (detail.type === "unmapped" && detail.id === topId && canvas)
        canvas.hidden = true;
      else render(topId);
    }
  };

  window.addEventListener("message", handleMessage);
  return {
    hide(id) {
      visibleWindows.delete(id);
      const canvas = canvases.get(id);
      if (canvas) canvas.hidden = true;
    },
    show(id) {
      if (!windows.has(id)) return false;
      visibleWindows.add(id);
      render(id);
      const canvas = canvases.get(id);
      if (!canvas) return false;
      canvas.style.zIndex = String(nextZIndex++);
      canvas.hidden = false;
      return true;
    },
    activate(id) {
      const top = windows.get(id);
      if (!top?.mapped) return false;
      runtimeWindow.postMessage(
        { type: "boxedwine-native-activate", windowId: id },
        origin,
      );
      return true;
    },
    attach(id, target, { anchored = true } = {}) {
      const canvas = canvases.get(id);
      if (!canvas || !target) return false;
      if (anchored) anchoredWindows.add(id);
      else anchoredWindows.delete(id);
      target.appendChild(canvas);
      render(id);
      return true;
    },
    detach(id) {
      const canvas = canvases.get(id);
      if (!canvas) return false;
      anchoredWindows.delete(id);
      host.appendChild(canvas);
      visibleWindows.delete(id);
      canvas.hidden = true;
      return true;
    },
    getCanvas(id) {
      return canvases.get(id) || null;
    },
    dispose() {
      window.removeEventListener("message", handleMessage);
      host.replaceChildren();
    },
  };
};
