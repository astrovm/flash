import { defineProgram } from "../programs/define-program.js";

const program = (id, title, icon, kind, extra = {}) =>
  defineProgram({ id, title, icon, kind, ...extra });

export const accessoryApplications = [
  program(
    "__on-screen-keyboard",
    "On-Screen Keyboard",
    "OnScreenKeyboard.png",
    "keyboard",
  ),
  program("__character-map", "Character Map", "Fonts.png", "character-map"),
  program("__calculator", "Calculator", "Calculator.png", "calculator", {
    window: { width: 260, height: 330 },
  }),
  program(
    "__command-prompt",
    "Command Prompt",
    "CommandPrompt.png",
    "terminal",
  ),
  program(
    "__remote-desktop",
    "Remote Desktop Connection",
    "RemoteDesktopConnection.png",
    "remote",
  ),
  program("__wordpad", "WordPad", "WordPad.png", "editor"),
];
