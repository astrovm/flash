const MESSAGE_TYPE = "boxedwine-native-window";
const NATIVE_TITLE_BAR_HEIGHT = 28;

const applicationFromExecutable = (executable = "") => {
  const name = executable.toLowerCase().replaceAll("\\", "/");
  if (name.endsWith("/calc.exe")) return "calculator";
  if (name.endsWith("/sol.exe")) return "solitaire";
  if (name.endsWith("/freecell.exe")) return "freecell";
  if (name.endsWith("/spider.exe")) return "spider-solitaire";
  if (name.endsWith("/solitaire/resize-host.exe")) return "solitaire";
  if (name.endsWith("/freecell/resize-host.exe")) return "freecell";
  if (name.endsWith("/spider-solitaire/resize-host.exe"))
    return "spider-solitaire";
  return "";
};

const legacyKeyCode = (code, key) => {
  if (/^Key[A-Z]$/.test(code)) return code.charCodeAt(3);
  if (/^Digit[0-9]$/.test(code)) return code.charCodeAt(5);
  if (/^Numpad[0-9]$/.test(code)) return 96 + Number(code.at(-1));
  if (/^F(?:[1-9]|1[0-2])$/.test(code)) return 111 + Number(code.slice(1));
  return (
    {
      Backspace: 8,
      Tab: 9,
      Enter: 13,
      ShiftLeft: 16,
      ShiftRight: 16,
      ControlLeft: 17,
      ControlRight: 17,
      AltLeft: 18,
      AltRight: 18,
      Escape: 27,
      Space: 32,
      PageUp: 33,
      PageDown: 34,
      End: 35,
      Home: 36,
      ArrowLeft: 37,
      ArrowUp: 38,
      ArrowRight: 39,
      ArrowDown: 40,
      Insert: 45,
      Delete: 46,
      Semicolon: 186,
      Equal: 187,
      Comma: 188,
      Minus: 189,
      Period: 190,
      Slash: 191,
      Backquote: 192,
      BracketLeft: 219,
      Backslash: 220,
      BracketRight: 221,
      Quote: 222,
    }[code] || (key?.length === 1 ? key.toUpperCase().charCodeAt(0) : 0)
  );
};

const sdlScanCode = (code) => {
  if (/^Key[A-Z]$/.test(code)) return 4 + code.charCodeAt(3) - 65;
  if (/^Digit[1-9]$/.test(code)) return 30 + Number(code.at(-1)) - 1;
  if (code === "Digit0") return 39;
  if (/^F(?:[1-9]|1[0-2])$/.test(code)) return 57 + Number(code.slice(1));
  if (/^Numpad[1-9]$/.test(code)) return 88 + Number(code.at(-1));
  if (code === "Numpad0") return 98;
  return (
    {
      Enter: 40,
      Escape: 41,
      Backspace: 42,
      Tab: 43,
      Space: 44,
      Minus: 45,
      Equal: 46,
      BracketLeft: 47,
      BracketRight: 48,
      Backslash: 49,
      Semicolon: 51,
      Quote: 52,
      Backquote: 53,
      Comma: 54,
      Period: 55,
      Slash: 56,
      CapsLock: 57,
      PrintScreen: 70,
      ScrollLock: 71,
      Pause: 72,
      Insert: 73,
      Home: 74,
      PageUp: 75,
      Delete: 76,
      End: 77,
      PageDown: 78,
      ArrowRight: 79,
      ArrowLeft: 80,
      ArrowDown: 81,
      ArrowUp: 82,
      NumLock: 83,
      NumpadDivide: 84,
      NumpadMultiply: 85,
      NumpadSubtract: 86,
      NumpadAdd: 87,
      NumpadEnter: 88,
      NumpadDecimal: 99,
      ControlLeft: 224,
      ShiftLeft: 225,
      AltLeft: 226,
      MetaLeft: 227,
      ControlRight: 228,
      ShiftRight: 229,
      AltRight: 230,
      MetaRight: 231,
    }[code] || 0
  );
};

export const installBoxedWineWindowBridge = (hostWindow, module) => {
  const processApplications = new Map();
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
    const appId = processApplications.get(detail.processId) || "";
    hostWindow.parent.postMessage(
      { type: MESSAGE_TYPE, window: { ...detail, appId } },
      hostWindow.location.origin,
      transfer,
    );
  };

  const forwardInputEvent = (event) => {
    const { type, windowId, x, y } = event.data || {};
    if (
      event.source !== hostWindow.parent ||
      event.origin !== hostWindow.location.origin ||
      ![
        "boxedwine-native-pointer",
        "boxedwine-native-wheel",
        "boxedwine-native-key",
        "boxedwine-native-command",
      ].includes(type)
    )
      return;
    const activatesWindow =
      (type === "boxedwine-native-command" &&
        event.data.action === "activate") ||
      (type === "boxedwine-native-pointer" &&
        event.data.eventType === "mousedown") ||
      type === "boxedwine-native-key";
    if (
      activatesWindow &&
      Number.isInteger(windowId) &&
      typeof module?._boxedwine_activate_window === "function"
    )
      module._boxedwine_activate_window(windowId);
    if (type === "boxedwine-native-command") {
      const { action, x = 0, y = 0, width = 0, height = 0 } = event.data;
      if (
        ["bounds", "maximize", "restore"].includes(action) &&
        width > 0 &&
        height > 0
      ) {
        hostWindow.postMessage(
          {
            type: "boxedwine-framebuffer-resize",
            appId: event.data.appId,
            width,
            height,
            baseWidth: event.data.sourceWidth || width,
            baseHeight: event.data.sourceHeight || height,
          },
          hostWindow.location.origin,
        );
        return;
      }
      if (typeof module?._boxedwine_window_command === "function") {
        module._boxedwine_window_command(
          windowId,
          {
            close: 1,
            minimize: 2,
            maximize: 3,
            restore: 4,
            bounds: 5,
          }[action] || 0,
          x,
          y,
          width,
          height,
        );
      }
      return;
    }
    const canvas = hostWindow.document.getElementById("canvas");
    if (!canvas) return;
    const modifiers = {
      altKey: Boolean(event.data.altKey),
      ctrlKey: Boolean(event.data.ctrlKey),
      metaKey: Boolean(event.data.metaKey),
      shiftKey: Boolean(event.data.shiftKey),
    };
    if (type === "boxedwine-native-key") {
      const scanCode = sdlScanCode(event.data.code || "");
      if (scanCode && typeof module?._boxedwine_key_event === "function") {
        module._boxedwine_key_event(
          windowId,
          scanCode,
          event.data.eventType === "keydown" ? 1 : 0,
        );
        return;
      }
      const keyboardEvent = new hostWindow.KeyboardEvent(event.data.eventType, {
        ...modifiers,
        bubbles: true,
        cancelable: true,
        code: event.data.code,
        key: event.data.key,
        location: event.data.location || 0,
        repeat: Boolean(event.data.repeat),
      });
      const keyCode =
        event.data.keyCode ||
        legacyKeyCode(event.data.code || "", event.data.key || "");
      for (const property of ["keyCode", "which"])
        Object.defineProperty(keyboardEvent, property, { value: keyCode });
      hostWindow.dispatchEvent(keyboardEvent);
      return;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (type === "boxedwine-native-wheel") {
      canvas.dispatchEvent(
        new hostWindow.WheelEvent("wheel", {
          ...modifiers,
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          deltaMode: event.data.deltaMode || 0,
          deltaX: event.data.deltaX || 0,
          deltaY: event.data.deltaY || 0,
        }),
      );
      return;
    }
    canvas.dispatchEvent(
      new hostWindow.MouseEvent(event.data.eventType, {
        ...modifiers,
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: event.data.button || 0,
        buttons: event.data.buttons || 0,
        detail: event.data.detail || 0,
      }),
    );
  };

  const forwardProcessEvent = (event) => {
    const detail = event.detail;
    if (!detail || !Number.isInteger(detail.processId)) return;
    if (detail.type === "started") {
      const appId = applicationFromExecutable(detail.executable);
      if (appId) processApplications.set(detail.processId, appId);
    } else if (detail.type === "exited") {
      processApplications.delete(detail.processId);
    }
    hostWindow.parent.postMessage(
      {
        type: "boxedwine-native-process",
        process: {
          ...detail,
          appId:
            processApplications.get(detail.processId) ||
            applicationFromExecutable(detail.executable),
        },
      },
      hostWindow.location.origin,
    );
  };

  hostWindow.addEventListener(MESSAGE_TYPE, forwardWindowEvent);
  hostWindow.addEventListener("boxedwine-native-process", forwardProcessEvent);
  hostWindow.addEventListener("message", forwardInputEvent);
  return () => {
    hostWindow.removeEventListener(MESSAGE_TYPE, forwardWindowEvent);
    hostWindow.removeEventListener(
      "boxedwine-native-process",
      forwardProcessEvent,
    );
    hostWindow.removeEventListener("message", forwardInputEvent);
  };
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
  const windows = new Map();
  const surfaces = new Map();
  const canvases = new Map();
  const ownedCanvases = new Map();
  const anchoredWindows = new Set();
  const visibleWindows = new Set();
  let nextZIndex = 1;
  let nativeStack = 1;
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
    const titleBarHeight = anchoredWindows.has(top.id)
      ? NATIVE_TITLE_BAR_HEIGHT
      : 0;
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
        titleBarHeight +
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
      entry.height > NATIVE_TITLE_BAR_HEIGHT,
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
      return {
        x: entry.x + local.x,
        y: entry.y + NATIVE_TITLE_BAR_HEIGHT + local.y,
      };
    };
    const forwardPointer = (eventType, event) => {
      runtimeWindow.postMessage(
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
      runtimeWindow.postMessage(
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
        runtimeWindow.postMessage(
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
    canvas.width = entry.width;
    canvas.height = Math.max(1, entry.height - NATIVE_TITLE_BAR_HEIGHT);
    canvas.style.width = `${entry.width}px`;
    canvas.style.height = `${canvas.height}px`;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    const surface = surfaces.get(entry.id);
    if (surface) context.drawImage(surface, 0, -NATIVE_TITLE_BAR_HEIGHT);
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
        ? child.y - entry.y - NATIVE_TITLE_BAR_HEIGHT
        : child.y - NATIVE_TITLE_BAR_HEIGHT;
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
        runtimeWindow.postMessage(
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
        runtimeWindow.postMessage(
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
          runtimeWindow.postMessage(
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
    canvas.dataset.boxedwineTitle = top.title || "";
    canvas.dataset.boxedwineNativeWidth = String(top.width);
    canvas.dataset.boxedwineNativeHeight = String(top.height);
    const titleBarHeight = anchoredWindows.has(topId)
      ? NATIVE_TITLE_BAR_HEIGHT
      : 0;
    if (canvas.width !== top.width) canvas.width = top.width;
    if (canvas.height !== Math.max(1, top.height - titleBarHeight))
      canvas.height = Math.max(1, top.height - titleBarHeight);
    canvas.style.left = anchoredWindows.has(topId) ? "0px" : `${top.x}px`;
    canvas.style.top = anchoredWindows.has(topId) ? "0px" : `${top.y}px`;
    canvas.style.width = `${top.width}px`;
    canvas.style.height = `${Math.max(1, top.height - titleBarHeight)}px`;
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
          ? child.y - (anchoredOwner ? titleBarHeight : top.y)
          : offsetY + child.y;
        drawTree(child.id, childX, childY);
      }
    };
    drawTree(topId, 0, -titleBarHeight);
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
        drawTree(entry.id, entry.x - top.x, entry.y - top.y - titleBarHeight);
    }
    if (drewNativePixels && !canvas.dataset.firstFrame) {
      canvas.dataset.firstFrame = "true";
      onFirstFrame?.({
        id: topId,
        appId: top.appId || "",
        processId: top.processId || 0,
        title: top.title || "",
        canvas,
      });
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
    document.documentElement.dataset.boxedwineLastLifecycle = [
      detail.type,
      detail.id,
      detail.parentId || 0,
      detail.processId || 0,
      detail.width || 0,
      detail.height || 0,
    ].join(":");
    if (detail.type === "created") {
      windows.set(detail.id, {
        ...detail,
        mapped: false,
        title: "",
        stack: nativeStack++,
      });
      onLifecycle?.({ ...detail, topId: topLevelId(detail.id) });
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
      visibleWindows.delete(detail.id);
      anchoredWindows.delete(detail.id);
      canvases.get(detail.id)?.remove();
      canvases.delete(detail.id);
      return;
    }
    if (!entry) return;
    if (detail.type === "title") entry.title = detail.title;
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
    onLifecycle?.({ ...detail, topId });
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
      (canvases.get(id) || ownedCanvases.get(id))?.focus({
        preventScroll: true,
      });
      runtimeWindow.postMessage(
        { type: "boxedwine-native-command", action: "activate", windowId: id },
        origin,
      );
      return true;
    },
    command(id, action, detail = {}) {
      const top = windows.get(id);
      if (!top) return false;
      runtimeWindow.postMessage(
        {
          type: "boxedwine-native-command",
          windowId: id,
          action,
          sourceWidth: top.width,
          sourceHeight: top.height,
          ...detail,
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
    reset() {
      for (const canvas of canvases.values()) canvas.remove();
      for (const [id, canvas] of ownedCanvases) {
        onOwnedWindow?.({ type: "hidden", id, topId: topLevelId(id) });
        canvas.remove();
      }
      windows.clear();
      surfaces.clear();
      canvases.clear();
      ownedCanvases.clear();
      anchoredWindows.clear();
      visibleWindows.clear();
      host.replaceChildren();
    },
    dispose() {
      window.removeEventListener("message", handleMessage);
      this.reset();
    },
  };
};
