import { defineProgram } from "../programs/define-program.js";

const program = (id, title, icon, kind, extra = {}) =>
  defineProgram({ id, title, icon, kind, ...extra });

export const accessoryApplications = [
  program(
    "__accessibility-wizard",
    "Accessibility Wizard",
    "AccessibilityOptions.png",
    "wizard",
  ),
  program("__magnifier", "Magnifier", "Magnifier.png", "tool"),
  program("__narrator", "Narrator", "AccessibilitySound.png", "tool"),
  program(
    "__on-screen-keyboard",
    "On-Screen Keyboard",
    "OnScreenKeyboard.png",
    "keyboard",
  ),
  program(
    "__utility-manager",
    "Utility Manager",
    "AccessibilityOptions.png",
    "utility-manager",
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
    "__program-compatibility-wizard",
    "Program Compatibility Wizard",
    "ProgramCompatibilityWizard.png",
    "wizard",
  ),
  program(
    "__remote-desktop",
    "Remote Desktop Connection",
    "RemoteDesktopConnection.png",
    "remote",
  ),
  program("__synchronize", "Synchronize", "Synchronize.png", "sync"),
  program("__tour-windows-xp", "Tour Windows XP", "TourWindowsXP.png", "tour"),
  program("__wordpad", "WordPad", "WordPad.png", "editor"),
];
