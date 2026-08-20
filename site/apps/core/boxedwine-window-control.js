const COMMAND_PATH = "/d_drive/boxedwine-window-control.in";
const STATE_PATH = "/d_drive/boxedwine-window-control.out";
const COMMAND_MAGIC = 0x42574331;
const STATE_MAGIC = 0x42575331;
const STATE_RECORD_BYTES = 64;

const commandCodes = Object.freeze({
  close: 1,
  minimize: 2,
  maximize: 3,
  restore: 4,
  bounds: 5,
  activate: 6,
});

const emptyStateFile = () => {
  const bytes = new Uint8Array(12);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, STATE_MAGIC, true);
  return bytes;
};

export const installBoxedWineWindowControlBridge = (hostWindow, module) => {
  const metadata = new Map();
  const reported = new Map();
  let sequence = 0;
  let generation = 0;
  let timer = null;

  const onNativeWindow = (event) => {
    const detail = event.detail;
    if (!Number.isInteger(detail?.id)) return;
    if (detail.type === "frame") return;
    // Ignore the metadata event dispatched by this bridge. Feeding it back
    // into the raw X11 metadata cache lets later X11 bounds inherit the
    // win32Metrics marker and overwrite trusted client/frame geometry.
    if (detail.win32Metrics === true) return;
    if (detail.type === "destroyed") {
      metadata.delete(detail.id);
      reported.delete(detail.id);
    } else {
      metadata.set(detail.id, { ...metadata.get(detail.id), ...detail });
    }
  };

  const writeCommand = (event) => {
    const {
      type,
      action,
      windowId,
      x = 0,
      y = 0,
      width = 0,
      height = 0,
    } = event.data || {};
    const command = commandCodes[action];
    if (
      event.source !== hostWindow.parent ||
      event.origin !== hostWindow.location.origin ||
      type !== "boxedwine-native-command" ||
      !command ||
      !Number.isInteger(windowId) ||
      windowId <= 0
    )
      return;
    // This controller applies commands inside Wine. Do not also run the
    // legacy X11 command handler, because two independent resize/state paths
    // can race and use different client/outer geometry.
    event.stopImmediatePropagation();
    const bytes = new Uint8Array(32);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, COMMAND_MAGIC, true);
    view.setUint32(4, ++sequence, true);
    view.setUint32(8, windowId, true);
    view.setUint32(12, command, true);
    view.setInt32(16, Number.isFinite(x) ? Math.trunc(x) : 0, true);
    view.setInt32(20, Number.isFinite(y) ? Math.trunc(y) : 0, true);
    view.setUint32(24, Math.max(0, Math.trunc(width)), true);
    view.setUint32(28, Math.max(0, Math.trunc(height)), true);
    module.FS.writeFile(COMMAND_PATH, bytes);
  };

  const readState = () => {
    let bytes;
    try {
      bytes = module.FS.readFile(STATE_PATH);
    } catch {
      return;
    }
    if (!(bytes instanceof Uint8Array) || bytes.byteLength < 12) return;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(0, true) !== STATE_MAGIC) return;
    const nextGeneration = view.getUint32(4, true);
    const count = view.getUint32(8, true);
    if (
      nextGeneration === generation ||
      count > 256 ||
      12 + count * STATE_RECORD_BYTES > bytes.byteLength
    )
      return;
    generation = nextGeneration;
    for (let index = 0; index < count; index += 1) {
      const offset = 12 + index * STATE_RECORD_BYTES;
      const id = view.getUint32(offset, true);
      const base = metadata.get(id);
      if (!base) continue;
      const capabilities = view.getUint32(offset + 56, true);
      const detail = {
        ...base,
        type: "metadata",
        lifecycleType: "bounds",
        id,
        outerX: view.getInt32(offset + 4, true),
        outerY: view.getInt32(offset + 8, true),
        outerWidth: view.getUint32(offset + 12, true),
        outerHeight: view.getUint32(offset + 16, true),
        clientX: view.getInt32(offset + 20, true),
        clientY: view.getInt32(offset + 24, true),
        clientWidth: view.getUint32(offset + 28, true),
        clientHeight: view.getUint32(offset + 32, true),
        frameLeft: view.getUint32(offset + 36, true),
        frameTop: view.getUint32(offset + 40, true),
        frameRight: view.getUint32(offset + 44, true),
        frameBottom: view.getUint32(offset + 48, true),
        ownerId: view.getUint32(offset + 52, true),
        canResize: Boolean(capabilities & 1),
        canMaximize: Boolean(capabilities & 2),
        canMinimize: Boolean(capabilities & 4),
        menuHeight: view.getUint32(offset + 60, true),
        win32Metrics: true,
      };
      const signature = JSON.stringify(detail);
      if (reported.get(id) === signature) continue;
      reported.set(id, signature);
      metadata.set(id, detail);
      hostWindow.dispatchEvent(
        new hostWindow.CustomEvent("boxedwine-native-window", { detail }),
      );
    }
  };

  hostWindow.addEventListener("boxedwine-native-window", onNativeWindow);
  hostWindow.addEventListener("message", writeCommand);
  const onRuntimeInitialized = module.onRuntimeInitialized;
  module.onRuntimeInitialized = () => {
    onRuntimeInitialized?.();
    module.FS.writeFile(COMMAND_PATH, new Uint8Array(32));
    module.FS.writeFile(STATE_PATH, emptyStateFile());
    timer = hostWindow.setInterval(readState, 50);
  };

  return () => {
    hostWindow.removeEventListener("boxedwine-native-window", onNativeWindow);
    hostWindow.removeEventListener("message", writeCommand);
    if (timer !== null) hostWindow.clearInterval(timer);
  };
};
