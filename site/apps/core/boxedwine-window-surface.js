const MESSAGE_TYPE = "boxedwine-native-window";
const WINE_LUNA_CAPTION_HEIGHT = 28;

const frameMetrics = (entry) => {
  const left = Math.max(0, entry.frameLeft || 0);
  const top = Math.max(0, entry.frameTop || 0);
  const right = Math.max(0, entry.frameRight || 0);
  const bottom = Math.max(0, entry.frameBottom || 0);
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(1, entry.clientWidth || entry.width - left - right),
    height: Math.max(1, entry.clientHeight || entry.height - top - bottom),
  };
};

const hasReportedFrame = (entry) =>
  entry.frameLeft > 0 ||
  entry.frameTop > 0 ||
  entry.frameRight > 0 ||
  entry.frameBottom > 0;

const looksDecorated = (entry) =>
  Boolean(entry.title?.trim()) ||
  entry.canMinimize === true ||
  entry.canMaximize === true ||
  entry.dialog === true;

const applyDecoratedFrameFallback = (entry) => {
  if (hasReportedFrame(entry) || !looksDecorated(entry)) return;
  entry.frameTop = WINE_LUNA_CAPTION_HEIGHT;
  const fullHeight = Number(entry.outerHeight) || Number(entry.height) || 0;
  const clientHeight = Number(entry.clientHeight);
  if (clientHeight > WINE_LUNA_CAPTION_HEIGHT && clientHeight >= fullHeight)
    entry.clientHeight = clientHeight - WINE_LUNA_CAPTION_HEIGHT;
  else if (!clientHeight && fullHeight > WINE_LUNA_CAPTION_HEIGHT)
    entry.clientHeight = fullHeight - WINE_LUNA_CAPTION_HEIGHT;
};

export const createBoxedWineWindowSurface = ({
  host,
  runtimeWindow,
  origin,
  onFirstFrame,
  onLifecycle,
  onOwnedWindow,
  initiallyVisible = true,
}) => {
  const getRuntimeWindow =
    typeof runtimeWindow === "function" ? runtimeWindow : () => runtimeWindow;
  const windows = new Map();
  const surfaces = new Map();
  const canvases = new Map();
  const ownedCanvases = new Map();
  const anchoredWindows = new Set();
  const visibleWindows = new Set();
  const frameGenerations = new Map();
  const pendingFrameIds = new Set();
  const pendingRenderIds = new Set();
  let nextZIndex = 1;
  let nativeStack = 1;
  let animationFrame = 0;
  const inputCoordinates = (canvas, top, event) => {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(
      rect.width / canvas.width,
      rect.height / canvas.height,
    );
    const renderedWidth = canvas.width * scale;
    const renderedHeight = canvas.height * scale;
    const renderedLeft = rect.left + (rect.width - renderedWidth) / 2;
    const renderedTop = rect.top + (rect.height - renderedHeight) / 2;
    const frame = frameMetrics(top);
    return {
      x:
        top.x +
        (Math.min(
          Math.max(event.clientX, renderedLeft),
          renderedLeft + renderedWidth,
        ) -
          renderedLeft) /
          scale,
      y:
        top.y +
        (anchoredWindows.has(top.id) ? frame.top : 0) +
        (Math.min(
          Math.max(event.clientY, renderedTop),
          renderedTop + renderedHeight,
        ) -
          renderedTop) /
          scale,
    };
  };
  const modifiers = (event) => ({
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
  });
  const scaledCanvasCoordinates = (canvas, event) => {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(
      rect.width / canvas.width,
      rect.height / canvas.height,
    );
    const renderedWidth = canvas.width * scale;
    const renderedHeight = canvas.height * scale;
    const renderedLeft = rect.left + (rect.width - renderedWidth) / 2;
    const renderedTop = rect.top + (rect.height - renderedHeight) / 2;
    return {
      x:
        (Math.min(
          Math.max(event.clientX, renderedLeft),
          renderedLeft + renderedWidth,
        ) -
          renderedLeft) /
        scale,
      y:
        (Math.min(
          Math.max(event.clientY, renderedTop),
          renderedTop + renderedHeight,
        ) -
          renderedTop) /
        scale,
    };
  };
  const isOwnedDialog = (entry) =>
    Boolean(
      entry?.ownerId &&
      entry.dialog &&
      entry.mapped &&
      entry.title?.trim() &&
      entry.width > 1 &&
      frameMetrics(entry).height > 1,
    );
  const topLevelId = (id) => {
    let current = windows.get(id);
    if (!current) return 0;
    while (current.parentId || current.ownerId) {
      const parent = windows.get(current.ownerId || current.parentId);
      if (!parent || (!parent.parentId && !parent.ownerId)) {
        if (current.processId) {
          const primary = [...windows.values()].find(
            (candidate) =>
              candidate.id !== current.id &&
              candidate.processId === current.processId &&
              canvases.has(candidate.id),
          );
          if (primary) return primary.id;
        }
        return current.id;
      }
      current = parent;
    }
    return 0;
  };

  const ownedDialogAncestor = (id, topId) => {
    let current = windows.get(id);
    const visited = new Set();
    while (current && current.id !== topId && !visited.has(current.id)) {
      visited.add(current.id);
      if (isOwnedDialog(current)) return current;
      current = windows.get(current.ownerId || current.parentId);
    }
    return null;
  };

  const createOwnedCanvas = (entry) => {
    const canvas = document.createElement("canvas");
    canvas.dataset.boxedwineOwnedWindow = String(entry.id);
    canvas.className = "boxedwine-native-owned-window";
    canvas.tabIndex = 0;
    ownedCanvases.set(entry.id, canvas);
    const coordinates = (event) => {
      const local = scaledCanvasCoordinates(canvas, event);
      const frame = frameMetrics(entry);
      return {
        x: entry.x + frame.left + local.x,
        y: entry.y + frame.top + local.y,
      };
    };
    const forwardPointer = (eventType, event) => {
      getRuntimeWindow().postMessage(
        {
          type: "boxedwine-native-pointer",
          windowId: entry.id,
          eventType,
          ...coordinates(event),
          ...modifiers(event),
          button: event.button,
          buttons: event.buttons,
          detail: event.detail,
        },
        origin,
      );
    };
    canvas.addEventListener("pointerdown", (event) => {
      canvas.focus({ preventScroll: true });
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Mouse events and older browsers do not expose pointer capture.
      }
      forwardPointer("mousedown", event);
    });
    for (const [pointerType, mouseType] of [
      ["pointermove", "mousemove"],
      ["pointerup", "mouseup"],
      ["pointercancel", "mouseup"],
    ]) {
      canvas.addEventListener(pointerType, (event) => {
        forwardPointer(mouseType, event);
        if (
          pointerType !== "pointermove" &&
          canvas.hasPointerCapture?.(event.pointerId)
        )
          canvas.releasePointerCapture(event.pointerId);
      });
    }
    canvas.addEventListener("dblclick", (event) =>
      forwardPointer("dblclick", event),
    );
    canvas.addEventListener("wheel", (event) => {
      getRuntimeWindow().postMessage(
        {
          type: "boxedwine-native-wheel",
          windowId: entry.id,
          ...coordinates(event),
          ...modifiers(event),
          deltaMode: event.deltaMode,
          deltaX: event.deltaX,
          deltaY: event.deltaY,
        },
        origin,
      );
      event.preventDefault();
    });
    for (const eventType of ["keydown", "keyup"]) {
      canvas.addEventListener(eventType, (event) => {
        getRuntimeWindow().postMessage(
          {
            type: "boxedwine-native-key",
            windowId: entry.id,
            eventType,
            ...modifiers(event),
            code: event.code,
            key: event.key,
            keyCode: event.keyCode,
            location: event.location,
            repeat: event.repeat,
          },
          origin,
        );
        event.preventDefault();
      });
    }
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    return canvas;
  };

  const renderOwnedDialog = (entry, top) => {
    let canvas = ownedCanvases.get(entry.id);
    if (!canvas) canvas = createOwnedCanvas(entry);
    canvas.dataset.boxedwineTitle = entry.title;
    canvas.dataset.boxedwineNativeWidth = String(entry.width);
    canvas.dataset.boxedwineNativeHeight = String(entry.height);
    const frame = frameMetrics(entry);
    canvas.width = frame.width;
    canvas.height = frame.height;
    canvas.style.width = `${frame.width}px`;
    canvas.style.height = `${frame.height}px`;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    const surface = surfaces.get(entry.id);
    if (surface) context.drawImage(surface, -frame.left, -frame.top);
    const children = [...windows.values()]
      .filter(
        (child) =>
          child.mapped &&
          !isOwnedDialog(child) &&
          (child.parentId === entry.id || child.ownerId === entry.id),
      )
      .sort((left, right) => left.stack - right.stack);
    for (const child of children) {
      const childSurface = surfaces.get(child.id);
      if (!childSurface) continue;
      const childX = child.ownerId ? child.x - entry.x : child.x;
      const childY = child.ownerId
        ? child.y - entry.y - frame.top
        : child.y - frame.top;
      context.drawImage(childSurface, childX, childY);
    }
    onOwnedWindow?.({
      type: "shown",
      id: entry.id,
      ownerId: entry.ownerId,
      topId: top.id,
      title: entry.title,
      x: entry.x - (anchoredWindows.has(top.id) ? 0 : top.x),
      y: entry.y - (anchoredWindows.has(top.id) ? 0 : top.y),
      width: entry.width,
      height: entry.height,
      clientWidth: frame.width,
      clientHeight: frame.height,
      canvas,
    });
  };

  const reportFirstFrame = (topId, canvas) => {
    if (!canvas || canvas.dataset.firstFrame) return;
    const top = windows.get(topId);
    if (!top) return;
    canvas.dataset.firstFrame = "true";
    onFirstFrame?.({
      id: topId,
      appId: top.appId || "",
      launchToken: String(top.launchToken || ""),
      processId: top.processId || 0,
      title: top.title || "",
      canvas,
    });
  };

  const render = (topId) => {
    const top = windows.get(topId);
    if (!top?.mapped) return;
    let canvas = canvases.get(topId);
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.dataset.boxedwineWindow = String(topId);
      canvas.className = "boxedwine-native-window";
      canvas.tabIndex = 0;
      canvases.set(topId, canvas);
      if (initiallyVisible) visibleWindows.add(topId);
      const forwardPointer = (eventType, event) => {
        const coordinates = inputCoordinates(canvas, top, event);
        getRuntimeWindow().postMessage(
          {
            type: "boxedwine-native-pointer",
            windowId: topId,
            eventType,
            ...coordinates,
            ...modifiers(event),
            button: event.button,
            buttons: event.buttons,
            detail: event.detail,
          },
          origin,
        );
      };
      canvas.addEventListener("pointerdown", (event) => {
        canvas.focus({ preventScroll: true });
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch {
          // Mouse events and older browsers do not expose pointer capture.
        }
        forwardPointer("mousedown", event);
      });
      for (const [pointerType, mouseType] of [
        ["pointermove", "mousemove"],
        ["pointerup", "mouseup"],
        ["pointercancel", "mouseup"],
      ]) {
        canvas.addEventListener(pointerType, (event) => {
          forwardPointer(mouseType, event);
          if (
            pointerType !== "pointermove" &&
            canvas.hasPointerCapture?.(event.pointerId)
          )
            canvas.releasePointerCapture(event.pointerId);
        });
      }
      canvas.addEventListener("dblclick", (event) =>
        forwardPointer("dblclick", event),
      );
      canvas.addEventListener("wheel", (event) => {
        const coordinates = inputCoordinates(canvas, top, event);
        getRuntimeWindow().postMessage(
          {
            type: "boxedwine-native-wheel",
            windowId: topId,
            ...coordinates,
            ...modifiers(event),
            deltaMode: event.deltaMode,
            deltaX: event.deltaX,
            deltaY: event.deltaY,
          },
          origin,
        );
        event.preventDefault();
      });
      for (const eventType of ["keydown", "keyup"]) {
        canvas.addEventListener(eventType, (event) => {
          getRuntimeWindow().postMessage(
            {
              type: "boxedwine-native-key",
              windowId: topId,
              eventType,
              ...modifiers(event),
              code: event.code,
              key: event.key,
              keyCode: event.keyCode,
              location: event.location,
              repeat: event.repeat,
            },
            origin,
          );
          event.preventDefault();
        });
      }
      canvas.addEventListener("contextmenu", (event) => event.preventDefault());
      host.appendChild(canvas);
    }
    canvas.hidden = !visibleWindows.has(topId);
    canvas.dataset.boxedwineX = String(top.x);
    canvas.dataset.boxedwineY = String(top.y);
    canvas.dataset.boxedwineParent = String(top.parentId || 0);
    canvas.dataset.boxedwineProcess = String(top.processId || 0);
    canvas.dataset.boxedwineLaunchToken = String(top.launchToken || "");
    canvas.dataset.boxedwineTitle = top.title || "";
    canvas.dataset.boxedwineNativeWidth = String(top.width);
    canvas.dataset.boxedwineNativeHeight = String(top.height);
    const frame = frameMetrics(top);
    const frameLeft = anchoredWindows.has(topId) ? frame.left : 0;
    const frameTop = anchoredWindows.has(topId) ? frame.top : 0;
    const canvasWidth = anchoredWindows.has(topId) ? frame.width : top.width;
    const canvasHeight = anchoredWindows.has(topId) ? frame.height : top.height;
    if (canvas.width !== canvasWidth) canvas.width = canvasWidth;
    if (canvas.height !== canvasHeight) canvas.height = canvasHeight;
    canvas.style.left = anchoredWindows.has(topId) ? "0px" : `${top.x}px`;
    canvas.style.top = anchoredWindows.has(topId) ? "0px" : `${top.y}px`;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    canvas.style.objectFit = "none";
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (anchoredWindows.has(topId)) {
      for (const entry of windows.values()) {
        if (isOwnedDialog(entry) && topLevelId(entry.id) === topId)
          renderOwnedDialog(entry, top);
      }
    }

    const drawnWindows = new Set();
    let drewNativePixels = false;
    const drawTree = (id, offsetX, offsetY) => {
      const entry = windows.get(id);
      if (!entry?.mapped || drawnWindows.has(id)) return;
      drawnWindows.add(id);
      const surface = surfaces.get(id);
      if (surface) {
        context.drawImage(surface, offsetX, offsetY);
        drewNativePixels = true;
      }
      const children = [...windows.values()]
        .filter((child) => child.parentId === id || child.ownerId === id)
        .sort((left, right) => left.stack - right.stack);
      for (const child of children) {
        if (anchoredWindows.has(topId) && ownedDialogAncestor(child.id, topId))
          continue;
        const anchoredOwner = child.ownerId && anchoredWindows.has(topId);
        const childX = child.ownerId
          ? child.x - (anchoredOwner ? 0 : top.x)
          : offsetX + child.x;
        const childY = child.ownerId
          ? child.y - (anchoredOwner ? frameTop : top.y)
          : offsetY + child.y;
        drawTree(child.id, childX, childY);
      }
    };
    drawTree(topId, -frameLeft, -frameTop);
    const processWindows = [...windows.values()].sort(
      (left, right) => left.stack - right.stack,
    );
    for (const entry of processWindows) {
      if (
        entry.id !== topId &&
        entry.processId &&
        entry.processId === top.processId &&
        !drawnWindows.has(entry.id) &&
        !(anchoredWindows.has(topId) && ownedDialogAncestor(entry.id, topId))
      )
        drawTree(
          entry.id,
          entry.x - top.x - frameLeft,
          entry.y - top.y - frameTop,
        );
    }
    if (drewNativePixels) reportFirstFrame(topId, canvas);
  };

  const requestRender = (topId, frameId = 0) => {
    if (topId) pendingRenderIds.add(topId);
    if (frameId) pendingFrameIds.add(frameId);
    if (animationFrame) return;
    const request = window.requestAnimationFrame || window.setTimeout;
    animationFrame = request.call(window, flushRenders);
  };

  const uploadFrame = (id) => {
    const registry = getRuntimeWindow()?.BoxedWineFrames;
    if (typeof registry?.read !== "function") return false;
    const frame = registry.read(id, frameGenerations.get(id) || 0);
    if (!frame) return false;
    let rgba = new Uint8ClampedArray(
      frame.rgba.buffer,
      frame.rgba.byteOffset,
      frame.rgba.byteLength,
    );
    let image;
    try {
      image = new ImageData(rgba, frame.width, frame.height);
    } catch {
      rgba = rgba.slice();
      image = new ImageData(rgba, frame.width, frame.height);
    }
    const surface = surfaces.get(id) || document.createElement("canvas");
    if (surface.width !== frame.width) surface.width = frame.width;
    if (surface.height !== frame.height) surface.height = frame.height;
    surface.getContext("2d").putImageData(image, 0, 0);
    surfaces.set(id, surface);
    frameGenerations.set(id, frame.generation);
    const topId = topLevelId(id);
    if (topId) reportFirstFrame(topId, canvases.get(topId));
    return true;
  };

  function flushRenders() {
    animationFrame = 0;
    for (const id of pendingFrameIds) {
      const topId = topLevelId(id);
      const canvas = topId ? canvases.get(topId) : null;
      if (
        canvas?.dataset.firstFrame &&
        (!visibleWindows.has(topId) ||
          !windows.get(topId)?.mapped ||
          document.hidden)
      )
        continue;
      pendingFrameIds.delete(id);
      if (!uploadFrame(id)) continue;
      if (topId) pendingRenderIds.add(topId);
    }
    const renderIds = [...pendingRenderIds];
    pendingRenderIds.clear();
    for (const topId of renderIds) render(topId);
  }

  const setProcessVisible = (id, visible) => {
    const processId = windows.get(id)?.processId || 0;
    const registry = getRuntimeWindow()?.BoxedWineFrames;
    if (processId && typeof registry?.setProcessVisible === "function")
      registry.setProcessVisible(processId, visible);
  };

  const onDocumentVisibility = () => {
    const visible = !document.hidden;
    for (const id of visibleWindows) {
      setProcessVisible(id, visible);
      if (visible) requestRender(id);
    }
  };

  const handleMessage = (event) => {
    if (
      event.source !== getRuntimeWindow() ||
      event.origin !== origin ||
      event.data?.type !== MESSAGE_TYPE
    )
      return;
    const detail = event.data.window;
    if (!detail || !Number.isInteger(detail.id)) return;
    document.documentElement.dataset.boxedwineLastLifecycle = [
      detail.type,
      detail.id,
      detail.parentId || 0,
      detail.processId || 0,
      detail.width || 0,
      detail.height || 0,
    ].join(":");
    if (detail.type === "created") {
      const created = {
        ...detail,
        mapped: false,
        title: detail.title || "",
        launchToken: Number(detail.launchToken) >>> 0,
        stack: nativeStack++,
      };
      applyDecoratedFrameFallback(created);
      windows.set(detail.id, created);
      onLifecycle?.({ ...created, topId: topLevelId(detail.id) });
      return;
    }
    const entry = windows.get(detail.id);
    if (detail.type === "destroyed") {
      const topId = topLevelId(detail.id) || detail.id;
      if (ownedCanvases.has(detail.id)) {
        onOwnedWindow?.({ type: "hidden", id: detail.id, topId });
        ownedCanvases.get(detail.id)?.remove();
        ownedCanvases.delete(detail.id);
      }
      onLifecycle?.({ ...detail, topId });
      windows.delete(detail.id);
      surfaces.delete(detail.id);
      frameGenerations.delete(detail.id);
      pendingFrameIds.delete(detail.id);
      visibleWindows.delete(detail.id);
      anchoredWindows.delete(detail.id);
      canvases.get(detail.id)?.remove();
      canvases.delete(detail.id);
      return;
    }
    if (!entry) return;
    if (detail.type === "frame") {
      // Frame events carry the framebuffer size, not the window geometry.
      entry.generation = detail.generation;
    } else {
      Object.assign(entry, detail);
    }
    if (detail.type === "metadata") {
      if (Number.isFinite(detail.outerX)) entry.x = detail.outerX;
      if (Number.isFinite(detail.outerY)) entry.y = detail.outerY;
      if (detail.outerWidth > 0) entry.width = detail.outerWidth;
      if (detail.outerHeight > 0) entry.height = detail.outerHeight;
      if (detail.launchToken != null)
        entry.launchToken = Number(detail.launchToken) >>> 0;
    }
    // Lifecycle bounds report the client size; the matching metadata message
    // that follows restores the outer size. Refreshing the client size here
    // keeps frameMetrics from measuring against the previous geometry.
    if (detail.type === "bounds" && detail.width > 0 && detail.height > 0) {
      entry.clientWidth = detail.width;
      entry.clientHeight = detail.height;
    }
    if (detail.type === "title") entry.title = detail.title;
    applyDecoratedFrameFallback(entry);
    if (detail.type === "owner") entry.ownerId = detail.parentId;
    if (typeof detail.dialog === "boolean") entry.dialog = detail.dialog;
    if (detail.type === "raised") entry.stack = nativeStack++;
    if (detail.type === "mapped" || detail.type === "unmapped")
      entry.mapped = detail.type === "mapped";
    if (detail.type === "unmapped" && ownedCanvases.has(detail.id)) {
      const topId = topLevelId(detail.id);
      onOwnedWindow?.({ type: "hidden", id: detail.id, topId });
      ownedCanvases.get(detail.id)?.remove();
      ownedCanvases.delete(detail.id);
    }
    if (detail.type === "frame") pendingFrameIds.add(detail.id);
    const topId = topLevelId(detail.id);
    if (detail.type === "frame" && topId)
      reportFirstFrame(topId, canvases.get(topId));
    onLifecycle?.({ ...detail, ...entry, topId });
    if (topId) {
      if (detail.type === "mapped" && !canvases.has(topId)) render(topId);
      const canvas = canvases.get(topId);
      if (detail.type === "unmapped" && detail.id === topId && canvas) {
        canvas.hidden = true;
        setProcessVisible(topId, false);
      } else {
        if (
          detail.type === "mapped" &&
          detail.id === topId &&
          visibleWindows.has(topId)
        )
          setProcessVisible(topId, true);
        requestRender(topId, detail.type === "frame" ? detail.id : 0);
      }
    }
  };

  window.addEventListener("message", handleMessage);
  document.addEventListener?.("visibilitychange", onDocumentVisibility);
  return {
    hide(id) {
      visibleWindows.delete(id);
      setProcessVisible(id, false);
      const canvas = canvases.get(id);
      if (canvas) canvas.hidden = true;
    },
    show(id) {
      if (!windows.has(id)) return false;
      visibleWindows.add(id);
      setProcessVisible(id, !document.hidden);
      requestRender(id);
      const canvas = canvases.get(id);
      if (!canvas) return false;
      canvas.style.zIndex = String(nextZIndex++);
      canvas.hidden = false;
      return true;
    },
    activate(id) {
      const top = windows.get(id);
      if (!top?.mapped) return false;
      (canvases.get(id) || ownedCanvases.get(id))?.focus({
        preventScroll: true,
      });
      getRuntimeWindow().postMessage(
        { type: "boxedwine-native-command", action: "activate", windowId: id },
        origin,
      );
      return true;
    },
    command(id, action, detail = {}) {
      const top = windows.get(id);
      if (!top) return false;
      if (action === "minimize" && top.canMinimize === false) return false;
      if (action === "maximize" && top.canMaximize === false) return false;
      const frame = frameMetrics(top);
      const requestedWidth = Number(detail.width) || frame.width;
      const requestedHeight = Number(detail.height) || frame.height;
      const canResize = top.canResize !== false;
      getRuntimeWindow().postMessage(
        {
          type: "boxedwine-native-command",
          windowId: id,
          action,
          sourceWidth: top.width,
          sourceHeight: top.height,
          ...detail,
          width: canResize
            ? requestedWidth + frame.left + frame.right
            : top.width,
          height: canResize
            ? requestedHeight + frame.top + frame.bottom
            : top.height,
        },
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
      setProcessVisible(id, false);
      canvas.hidden = true;
      return true;
    },
    remove(id) {
      const ids = [...windows.keys()].filter(
        (windowId) => windowId === id || topLevelId(windowId) === id,
      );
      if (ids.length === 0) return false;
      for (const windowId of ids) {
        if (ownedCanvases.has(windowId))
          onOwnedWindow?.({ type: "hidden", id: windowId, topId: id });
        windows.delete(windowId);
        surfaces.delete(windowId);
        frameGenerations.delete(windowId);
        pendingFrameIds.delete(windowId);
        visibleWindows.delete(windowId);
        anchoredWindows.delete(windowId);
        canvases.get(windowId)?.remove();
        canvases.delete(windowId);
        ownedCanvases.get(windowId)?.remove();
        ownedCanvases.delete(windowId);
      }
      return true;
    },
    getCanvas(id) {
      return canvases.get(id) || ownedCanvases.get(id) || null;
    },
    canResize(id) {
      return windows.get(id)?.canResize !== false;
    },
    reset() {
      for (const canvas of canvases.values()) canvas.remove();
      for (const [id, canvas] of ownedCanvases) {
        onOwnedWindow?.({ type: "hidden", id, topId: topLevelId(id) });
        canvas.remove();
      }
      windows.clear();
      surfaces.clear();
      frameGenerations.clear();
      pendingFrameIds.clear();
      pendingRenderIds.clear();
      canvases.clear();
      ownedCanvases.clear();
      anchoredWindows.clear();
      visibleWindows.clear();
      host.replaceChildren();
    },
    dispose() {
      window.removeEventListener("message", handleMessage);
      document.removeEventListener?.("visibilitychange", onDocumentVisibility);
      if (animationFrame) {
        const cancel = window.cancelAnimationFrame || window.clearTimeout;
        cancel?.call(window, animationFrame);
        animationFrame = 0;
      }
      this.reset();
    },
  };
};
