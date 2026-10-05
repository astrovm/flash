import { defineApplication } from "../core/application.js";
import {
  createRetryingLoader,
  defineLazyApplication,
} from "../core/lazy-application.js";

// The system window runtime is only needed once a system window opens, so it
// stays out of the startup module graph.
const loadSystemRuntime = createRetryingLoader(
  () => import("../system/runtime.js"),
);

const system = (id, title, icon, window = {}, activation = null) => {
  const metadata = {
    id,
    title,
    icon,
    kind: "system",
    window: { width: 800, height: 600, ...window },
  };
  return defineLazyApplication(metadata, () =>
    loadSystemRuntime().then(({ createSystemRuntime }) =>
      defineApplication({
        ...metadata,
        mount(context, instance) {
          const runtime = createSystemRuntime(context);
          return {
            element: runtime.render(id, instance.window),
            activate: () => runtime.activate(activation, instance.window),
            unmount() {},
          };
        },
        activate(_context, _instance, mounted) {
          mounted.activate();
        },
      }),
    ),
  );
};

export const systemApplications = [
  system("__my-computer", "My Computer", "MyComputer.png"),
  system("__my-documents", "My Documents", "MyDocuments.png"),
  system("__my-pictures", "My Pictures", "MyPictures.png"),
  system("__my-music", "My Music", "MyMusic.png"),
  system("__recycle-bin", "Recycle Bin", "RecyclerEmpty.png"),
  system(
    "__control-panel",
    "Control Panel",
    "ControlPanel.png",
    { left: 44, top: 58 },
    "control-panel",
  ),
  system(
    "__search",
    "Search Results",
    "Search.png",
    { left: 66, top: 88 },
    "search",
  ),
  system(
    "__astro-settings",
    "Astro Flash Settings",
    "ControlPanel.png",
    { width: 540, height: 450 },
    "project-settings",
  ),
  system(
    "__internet-games",
    "Internet Games",
    "AddRemovePrograms.png",
    { width: 760, height: 540 },
    "internet-games",
  ),
  system(
    "__display-properties",
    "Display Properties",
    "DisplaySettings.png",
    {
      width: 404,
      height: 455,
      left: 22,
      top: 29,
      className: "display-properties-window",
      dialogControls: true,
    },
    "display-properties",
  ),
];
