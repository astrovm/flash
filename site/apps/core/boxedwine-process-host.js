const APPLICATIONS = Object.freeze({
  calculator: 1,
  solitaire: 2,
  freecell: 3,
  "spider-solitaire": 4,
});

export const installBoxedWineProcessHostBridge = (hostWindow, module) => {
  let ready = false;
  let timer = null;
  let activeRequest = null;
  const queuedRequests = [];
  const processes = new Map();

  const post = (message) =>
    hostWindow.parent.postMessage(message, hostWindow.location.origin);

  const completeRequest = (processId, error = 0) => {
    const request = activeRequest;
    activeRequest = null;
    post({
      type:
        request.operation === "terminate"
          ? "boxedwine-process-terminated"
          : "boxedwine-process-launched",
      appId: request.appId,
      requestId: request.requestId,
      processId,
      error,
    });
    dispatchNext();
  };

  const dispatchNext = () => {
    if (!ready || activeRequest || queuedRequests.length === 0) return;
    activeRequest = queuedRequests.shift();
    const request = activeRequest;
    post({
      type: "boxedwine-process-dispatched",
      appId: request.appId,
      requestId: request.requestId,
    });
    if (request.operation === "launch") {
      if (!module._boxedwine_launch_process(APPLICATIONS[request.appId])) {
        completeRequest(0, 87);
        return;
      }
      post({
        type: "boxedwine-process-accepted",
        appId: request.appId,
        requestId: request.requestId,
      });
      return;
    }
    if (!module._boxedwine_terminate_process(request.processId))
      completeRequest(request.processId, 87);
    else {
      processes.delete(request.processId);
      completeRequest(request.processId);
    }
  };

  const poll = () => {
    if (activeRequest?.operation === "launch") {
      const result = module._boxedwine_launch_result();
      if (result) {
        const processId = result === -1 || result === 0xffffffff ? 0 : result;
        if (processId) processes.set(processId, activeRequest.appId);
        completeRequest(processId, processId ? 0 : 87);
      }
    }
    for (const [processId, appId] of processes) {
      if (module._boxedwine_process_running(processId)) continue;
      processes.delete(processId);
      post({ type: "boxedwine-process-exited", appId, processId });
    }
  };

  const onMessage = (event) => {
    const { type, appId, processId, requestId } = event.data || {};
    if (
      event.source !== hostWindow.parent ||
      event.origin !== hostWindow.location.origin ||
      !["boxedwine-launch-process", "boxedwine-terminate-process"].includes(
        type,
      ) ||
      typeof requestId !== "string" ||
      !Object.hasOwn(APPLICATIONS, appId) ||
      (type === "boxedwine-terminate-process" &&
        (!Number.isInteger(processId) || processId <= 0))
    )
      return;
    queuedRequests.push({
      appId,
      requestId,
      operation:
        type === "boxedwine-terminate-process" ? "terminate" : "launch",
      processId,
    });
    dispatchNext();
  };

  const onRuntimeInitialized = module.onRuntimeInitialized;
  module.onRuntimeInitialized = () => {
    onRuntimeInitialized?.();
    ready = true;
    hostWindow.document.documentElement.dataset.boxedwineProcessHost = "ready";
    post({ type: "boxedwine-runtime-ready" });
    dispatchNext();
    timer = hostWindow.setInterval(poll, 50);
  };
  hostWindow.addEventListener("message", onMessage);

  return () => {
    hostWindow.removeEventListener("message", onMessage);
    if (timer !== null) hostWindow.clearInterval(timer);
  };
};
