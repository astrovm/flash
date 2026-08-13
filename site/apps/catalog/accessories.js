import { defineProgram } from "../programs/define-program.js";

const program = (id, title, icon, kind, extra = {}) =>
  defineProgram({ id, title, icon, kind, ...extra });

export const accessoryApplications = [
  program("__calculator", "Calculator", "Calculator.png", "calculator", {
    window: {
      width: 260,
      height: 260,
      resizable: false,
      maximizable: false,
      className: "xp-calculator-window",
    },
  }),
  program(
    "__command-prompt",
    "Command Prompt",
    "CommandPrompt.png",
    "terminal",
    {
      window: {
        width: 668,
        height: 338,
        left: 24,
        top: 30,
        resizable: true,
        maximizable: true,
        className: "xp-command-prompt-window",
      },
    },
  ),
];
