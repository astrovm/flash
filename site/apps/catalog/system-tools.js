import { defineProgram } from "../programs/define-program.js";
import { defineLazyApplication } from "../core/lazy-application.js";
import { applicationMetadata as taskManagerMetadata } from "../task-manager/metadata.js";

const program = (id, title, icon, kind, extra) =>
  defineProgram({ id, title, icon, kind, ...extra });

export const systemToolApplications = [
  program("__volume-control", "Volume Control", "Volume.png", "volume", {
    window: {
      width: 251,
      height: 318,
      left: 66,
      top: 88,
      resizable: false,
      maximizable: false,
      className: "xp-volume-window",
    },
  }),
  defineLazyApplication(taskManagerMetadata, () =>
    import("../task-manager/index.js").then(
      (module) => module.taskManagerApplication,
    ),
  ),
];
