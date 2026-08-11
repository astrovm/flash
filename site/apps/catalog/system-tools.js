import { defineProgram } from "../programs/define-program.js";

const program = (id, title, icon, kind, extra = {}) =>
  defineProgram({ id, title, icon, kind, ...extra });

export const systemToolApplications = [
  program("__volume-control", "Volume Control", "Volume.png", "volume", {
    window: { width: 250, height: 360 },
  }),
];
