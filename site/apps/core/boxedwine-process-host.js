import { getBoxedWineApplication } from "./boxedwine-applications.js";

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
      launchToken: request.launchToken,
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
      launchToken: request.launchToken,
      requestId: request.requestId,
    });
    if (request.operation === "launch") {
      const application = getBoxedWineApplication(request.appId);
      // Launch the wrapper first: if it fails (e.g. a launch is already
      // pending), boxedwineExpectExec is never called, so a rejected launch
      // never leaves a stale filename->token mapping for a later, unrelated
      // launch of the same target to accidentally match.
      if (
        !application ||
        !module.boxedwineLaunchProcess(
          application.launchExecutable,
          request.launchToken,
        ) ||
        !module.boxedwineExpectExec(
          application.executable.slice(
            application.executable.lastIndexOf("/") + 1,
          ),
          request.launchToken,
        )
      ) {
        completeRequest(0, 87);
        return;
      }
      post({
        type: "boxedwine-process-accepted",
        appId: request.appId,
        launchToken: request.launchToken,
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
        if (processId)
          processes.set(processId, {
            appId: activeRequest.appId,
            launchToken: activeRequest.launchToken,
          });
        completeRequest(processId, processId ? 0 : 87);
      }
    }
    for (const [processId, process] of processes) {
      if (module._boxedwine_process_running(processId)) continue;
      processes.delete(processId);
      post({ type: "boxedwine-process-exited", ...process, processId });
    }
  };

  const onMessage = (event) => {
    const { type, appId, launchToken, processId, requestId } = event.data || {};
    if (
      event.source !== hostWindow.parent ||
      event.origin !== hostWindow.location.origin ||
      ![
        "boxedwine-launch-process",
        "boxedwine-observe-process",
        "boxedwine-terminate-process",
      ].includes(type) ||
      typeof requestId !== "string" ||
      typeof launchToken !== "string" ||
      !/^\d{1,10}$/.test(launchToken) ||
      !getBoxedWineApplication(appId) ||
      (["boxedwine-observe-process", "boxedwine-terminate-process"].includes(
        type,
      ) &&
        (!Number.isInteger(processId) || processId <= 0))
    )
      return;
    if (type === "boxedwine-observe-process") {
      processes.set(processId, { appId, launchToken });
      post({
        type: "boxedwine-process-observed",
        appId,
        launchToken,
        requestId,
        processId,
      });
      return;
    }
    queuedRequests.push({
      appId,
      launchToken,
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
    module._boxedwine_install_bridge_api();
    if (typeof module.boxedwineLaunchProcess !== "function")
      throw new Error("BoxedWine process launcher is unavailable");
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
