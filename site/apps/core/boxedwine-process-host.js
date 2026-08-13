const APPLICATIONS = Object.freeze({
  calculator: "C:\\files\\calculator\\calc.exe",
  solitaire: "C:\\files\\solitaire\\sol.exe",
  freecell: "C:\\files\\freecell\\freecell.exe",
  "spider-solitaire": "C:\\files\\spider-solitaire\\spider.exe",
});

const READY_PATH = "/d_drive/boxedwine-runtime-ready.txt";
const COMMAND_PATH = "/d_drive/boxedwine-launch.txt";
const ACCEPTED_PATH = "/d_drive/boxedwine-launch-accepted.txt";
const RESULT_PATH = "/d_drive/boxedwine-launch-result.txt";

export const installBoxedWineProcessHostBridge = (hostWindow, module) => {
  let runtimeInitialized = false;
  let ready = false;
  let timer = null;
  let nextSequence = 1;
  let activeRequest = null;
  const queuedRequests = [];

  const post = (message) =>
    hostWindow.parent.postMessage(message, hostWindow.location.origin);

  const removeFile = (path) => {
    try {
      module.FS.unlink(path);
    } catch {
      // The file does not exist before the first command.
    }
  };

  const dispatchNext = () => {
    if (!ready || activeRequest || queuedRequests.length === 0) return;
    activeRequest = queuedRequests.shift();
    const command = `${activeRequest.sequence}\n${activeRequest.path}\n`;
    module.FS.writeFile(COMMAND_PATH, command);
    post({
      type: "boxedwine-process-dispatched",
      appId: activeRequest.appId,
      requestId: activeRequest.requestId,
    });
  };

  const poll = () => {
    if (!runtimeInitialized || typeof module.FS?.readFile !== "function")
      return;
    if (!ready) {
      try {
        if (
          module.FS.readFile(READY_PATH, { encoding: "utf8" }).trim() ===
          "ready"
        ) {
          ready = true;
          post({ type: "boxedwine-runtime-ready" });
          dispatchNext();
        }
      } catch {
        return;
      }
    }
    if (!activeRequest) return;
    try {
      const accepted = module.FS.readFile(ACCEPTED_PATH, {
        encoding: "utf8",
      }).trim();
      if (Number(accepted) === activeRequest.sequence) {
        removeFile(ACCEPTED_PATH);
        post({
          type: "boxedwine-process-accepted",
          appId: activeRequest.appId,
          requestId: activeRequest.requestId,
        });
      }
    } catch {
      // The resident host has not consumed the command yet.
    }
    try {
      const result = module.FS.readFile(RESULT_PATH, {
        encoding: "utf8",
      }).trim();
      const match = /^(\d+) (\d+) (\d+)$/.exec(result);
      if (!match || Number(match[1]) !== activeRequest.sequence) return;
      removeFile(RESULT_PATH);
      const request = activeRequest;
      activeRequest = null;
      post({
        type: "boxedwine-process-launched",
        appId: request.appId,
        requestId: request.requestId,
        processId: Number(match[2]),
        error: Number(match[3]),
      });
      dispatchNext();
    } catch {
      // The resident host has not written a result yet.
    }
  };

  const onMessage = (event) => {
    const { type, appId, requestId } = event.data || {};
    if (
      event.source !== hostWindow.parent ||
      event.origin !== hostWindow.location.origin ||
      type !== "boxedwine-launch-process" ||
      typeof requestId !== "string" ||
      !Object.hasOwn(APPLICATIONS, appId)
    )
      return;
    queuedRequests.push({
      appId,
      requestId,
      path: APPLICATIONS[appId],
      sequence: nextSequence++,
    });
    dispatchNext();
  };

  const onRuntimeInitialized = module.onRuntimeInitialized;
  module.preRun?.push(() => {
    try {
      module.FS.readFile(COMMAND_PATH);
    } catch {
      module.FS.writeFile(COMMAND_PATH, "");
    }
  });
  module.onRuntimeInitialized = () => {
    onRuntimeInitialized?.();
    runtimeInitialized = true;
    poll();
    timer = hostWindow.setInterval(poll, 20);
  };
  hostWindow.addEventListener("message", onMessage);

  return () => {
    hostWindow.removeEventListener("message", onMessage);
    if (timer !== null) hostWindow.clearInterval(timer);
  };
};
