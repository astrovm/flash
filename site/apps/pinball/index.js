import { defineApplication } from "../core/application.js";

const RUNTIME_ROOT = new URL("apps/pinball/runtime/", document.baseURI).href;
const TITLE = "3D Pinball for Windows - Space Cadet";

const state = {
  canvas: null,
  module: null,
  promise: null,
};

const createCanvas = (context) => {
  const canvas = document.createElement("canvas");
  canvas.id = "canvas";
  canvas.className = "pinball-canvas";
  canvas.width = 600;
  canvas.height = 440;
  canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", "3D Pinball: Space Cadet game table");
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener(
    "webglcontextlost",
    (event) => {
      event.preventDefault();
      context.showMessage(
        TITLE,
        "The Pinball graphics context was lost. Close and reopen Pinball to continue.",
      );
    },
    false,
  );
  return canvas;
};

const loadRuntime = (context, status, progress) => {
  if (state.promise) return state.promise;
  state.canvas = createCanvas(context);
  state.promise = new Promise((resolve, reject) => {
    let totalDependencies = 0;
    const module = {
      canvas: state.canvas,
      locateFile: (path) => `${RUNTIME_ROOT}${path}`,
      preRun: [],
      postRun: [],
      print: (...values) => console.log(...values),
      printErr: (...values) => console.error(...values),
      onExitRequested: () => context.close(),
      onHelpRequested: () =>
        context.showMessage(
          "3D Pinball Help",
          "Press F2 for a new game, Space to launch the ball, Z for the left flipper, and / for the right flipper.",
        ),
      setStatus(message) {
        const match = message.match(/([^(]+)\((\d+(?:\.\d+)?)\/(\d+)\)/);
        status.textContent = match ? match[1].trim() : message;
        if (match) {
          progress.hidden = false;
          progress.value = Number(match[2]);
          progress.max = Number(match[3]);
        } else {
          progress.hidden = true;
        }
        if (!message) {
          status.hidden = true;
          progress.hidden = true;
          state.canvas.style.visibility = "visible";
          state.canvas.focus();
        }
      },
      monitorRunDependencies(remaining) {
        totalDependencies = Math.max(totalDependencies, remaining);
        module.setStatus(
          remaining
            ? `Preparing... (${totalDependencies - remaining}/${totalDependencies})`
            : "All downloads complete.",
        );
      },
      onRuntimeInitialized() {
        state.module = module;
        resolve(module);
      },
      onAbort(reason) {
        reject(new Error(String(reason || "Pinball could not start")));
      },
    };
    module.preRun.push(() => {
      const dependency = "pinball-xp-resources";
      module.addRunDependency(dependency);
      Promise.all([
        fetch(`${RUNTIME_ROOT}SOURCES.json`).then((response) => {
          if (!response.ok)
            throw new Error("Pinball resource manifest is unavailable");
          return response.json();
        }),
        fetch(`${RUNTIME_ROOT}SpaceCadetPinball.data`).then((response) => {
          if (!response.ok) throw new Error("Pinball game data is unavailable");
          return response.arrayBuffer();
        }),
      ])
        .then(([sources, buffer]) => {
          const bytes = new Uint8Array(buffer);
          module.FS_createPath("/", "game_resources", true, true);
          for (const [filename, source] of Object.entries(sources.files)) {
            module.FS_createDataFile(
              "/game_resources",
              filename,
              bytes.subarray(source.start, source.end),
              true,
              true,
              true,
            );
          }
          module.removeRunDependency(dependency);
        })
        .catch((error) => {
          reject(error);
          module.setStatus(error.message);
        });
    });
    const script = document.createElement("script");
    script.src = `${RUNTIME_ROOT}SpaceCadetPinball.js`;
    script.async = true;
    script.addEventListener("error", () => {
      reject(new Error("The Pinball runtime could not be loaded"));
    });
    script.addEventListener("load", () => {
      window.AstroPinballModule(module).catch(reject);
    });
    document.head.appendChild(script);
  });
  return state.promise;
};

const mountPinball = (context) => {
  context.setTitle(TITLE);
  const content = document.createElement("div");
  content.className = "pinball-content";
  const loading = document.createElement("div");
  loading.className = "pinball-loading";
  const status = document.createElement("div");
  status.textContent = "Downloading...";
  status.setAttribute("role", "status");
  const progress = document.createElement("progress");
  progress.hidden = true;
  loading.append(status, progress);
  content.append(loading);

  if (state.canvas) {
    content.append(state.canvas);
    state.canvas.style.visibility = "visible";
    loading.hidden = true;
    state.module?.resumeMainLoop?.();
    state.canvas.focus();
  } else {
    loadRuntime(context, status, progress)
      .then(() => {
        loading.hidden = true;
        requestAnimationFrame(resize);
      })
      .catch((error) => {
        status.hidden = false;
        progress.hidden = true;
        status.textContent = error.message;
        context.showMessage(TITLE, error.message);
      });
    content.append(state.canvas);
    state.canvas.style.visibility = "hidden";
  }

  const resize = () => {
    if (!state.module?.setCanvasSize || !content.isConnected) return;
    const width = Math.max(1, Math.round(content.clientWidth));
    const height = Math.max(1, Math.round(content.clientHeight));
    if (state.canvas.width !== width || state.canvas.height !== height) {
      state.canvas.width = width;
      state.canvas.height = height;
      state.module.setCanvasSize(width, height);
    }
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(content);

  return {
    element: content,
    unmount() {
      resizeObserver.disconnect();
      state.module?.pauseMainLoop?.();
    },
  };
};

export const pinballApplication = defineApplication({
  id: "__pinball",
  title: "Pinball",
  icon: "Pinball.png",
  kind: "native-game",
  window: {
    width: 606,
    height: 471,
    className: "pinball-window",
  },
  mount: mountPinball,
});
