import { defineProgram } from "../programs/define-program.js";
import { defineLazyApplication } from "../core/lazy-application.js";
import { applicationMetadata as taskManagerMetadata } from "../task-manager/metadata.js";

const program = (id, title, icon, kind, extra) =>
  defineProgram({ id, title, icon, kind, ...extra });

export const systemToolApplications = [
  program("__volume-control", "Volume Control", "Volume.png", "volume", {
    window: { width: 250, height: 360 },
  }),
  defineLazyApplication(taskManagerMetadata, () =>
    import("../task-manager/index.js").then(
      (module) => module.taskManagerApplication,
    ),
  ),
];
