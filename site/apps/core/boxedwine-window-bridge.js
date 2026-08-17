const MESSAGE_TYPE = "boxedwine-native-window";

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
  const forwardWindowEvent = (event) => {
    const detail = event.detail;
    if (!detail || typeof detail.type !== "string") return;
    const metadata = { ...detail };
    delete metadata.rgba;
    const root = hostWindow.document.documentElement;
    root.dataset.boxedwineWindowEvents = String(
      Number(root.dataset.boxedwineWindowEvents || 0) + 1,
    );
    root.dataset.boxedwineLastWindowEvent = `${detail.type}:${detail.id}`;
    hostWindow.parent.postMessage(
      { type: MESSAGE_TYPE, window: metadata },
      hostWindow.location.origin,
      [],
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
      const changesSize =
        width > 0 &&
        height > 0 &&
        (width !== event.data.sourceWidth ||
          height !== event.data.sourceHeight);
      if (action === "bounds" && !changesSize) return;
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
    hostWindow.parent.postMessage(
      {
        type: "boxedwine-native-process",
        process: { ...detail },
      },
      hostWindow.location.origin,
    );
  };

  hostWindow.addEventListener(MESSAGE_TYPE, forwardWindowEvent);
  hostWindow.addEventListener("boxedwine-native-process", forwardProcessEvent);
  hostWindow.addEventListener("message", forwardInputEvent);
  const onRuntimeInitialized = module.onRuntimeInitialized;
  module.onRuntimeInitialized = () => {
    onRuntimeInitialized?.();
    const initialLaunchToken = hostWindow.BoxedWineInitialLaunchToken;
    if (initialLaunchToken)
      module.boxedwineSetInitialLaunchToken?.(initialLaunchToken);
    if (!module.boxedwineFrames)
      throw new Error("BoxedWine frame registry is unavailable");
    hostWindow.BoxedWineFrames = module.boxedwineFrames;
  };
  return () => {
    hostWindow.removeEventListener(MESSAGE_TYPE, forwardWindowEvent);
    hostWindow.removeEventListener(
      "boxedwine-native-process",
      forwardProcessEvent,
    );
    hostWindow.removeEventListener("message", forwardInputEvent);
    delete hostWindow.BoxedWineFrames;
  };
};
