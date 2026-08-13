import { createProgramRoot } from "../ui.js";
import { CommandSession } from "../command-session.js";

export const renderTerminal = (context, program, programId) => {
  const content = createProgramRoot(program);
  const session = new CommandSession(context);
  context.setTitle("C:\\WINDOWS\\system32\\cmd.exe");
  content.innerHTML = `<div class="xp-terminal-screen" role="application" aria-label="Command Prompt"><pre class="xp-terminal-output" aria-live="polite"></pre><label class="xp-terminal-prompt"><span></span><input aria-label="Command" autocomplete="off" autocapitalize="off" spellcheck="false"></label></div>`;
  const output = content.querySelector(".xp-terminal-output");
  const screen = content.querySelector(".xp-terminal-screen");
  const prompt = content.querySelector(".xp-terminal-prompt span");
  const input = content.querySelector("input");
  const history = [];
  let historyIndex = 0;

  output.textContent = `${session.banner}\n`;
  const updatePrompt = () => {
    prompt.textContent = session.prompt;
  };
  updatePrompt();

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      if (!history.length) return;
      historyIndex = Math.max(
        0,
        Math.min(
          history.length,
          historyIndex + (event.key === "ArrowUp" ? -1 : 1),
        ),
      );
      input.value = history[historyIndex] || "";
      input.setSelectionRange(input.value.length, input.value.length);
      return;
    }
    if (event.key !== "Enter") return;
    const command = input.value;
    if (command.trim()) history.push(command);
    historyIndex = history.length;
    const enteredPrompt = session.prompt;
    const result = session.execute(command);
    if (result.exit) return;
    if (result.clear) output.textContent = "";
    else
      output.textContent += `${enteredPrompt}${command}\n${result.output}${result.output ? "\n" : ""}`;
    input.value = "";
    updatePrompt();
    screen.scrollTop = screen.scrollHeight;
  });
  screen.addEventListener("pointerdown", () => input.focus());
  setTimeout(() => input.focus(), 0);
  return content;
};
