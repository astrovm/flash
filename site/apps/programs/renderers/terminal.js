import { createProgramRoot } from "../ui.js";

export const renderTerminal = (context, program, programId) => {
  const content = createProgramRoot(program);

  content.innerHTML = `<div class="xp-terminal-output" aria-live="polite">Microsoft Windows XP [Version 5.1.2600]\n(C) Copyright 1985-2001 Microsoft Corp.\n\nC:\\Documents and Settings\\Administrator&gt;</div><label class="xp-terminal-prompt">C:\\Documents and Settings\\Administrator&gt;<input aria-label="Command"></label>`;
  const output = content.querySelector(".xp-terminal-output");
  const input = content.querySelector("input");
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const command = input.value.trim();
    const normalized = command.toLowerCase();
    if (normalized === "cls") output.textContent = "";
    else {
      const response =
        normalized === "help"
          ? "Supported commands: CLS, DIR, ECHO, HELP, VER"
          : normalized === "dir"
            ? " Directory of C:\\Documents and Settings\\Administrator\n\nMy Documents    My Pictures    My Music"
            : normalized === "ver"
              ? "Microsoft Windows XP [Version 5.1.2600]"
              : normalized.startsWith("echo ")
                ? command.slice(5)
                : command
                  ? `'${command}' is not recognized as an internal or external command.`
                  : "";
      output.textContent += `\nC:\\Documents and Settings\\Administrator>${command}\n${response}`;
    }
    input.value = "";
    output.scrollTop = output.scrollHeight;
  });
  setTimeout(() => input.focus(), 0);
  return content;
};
