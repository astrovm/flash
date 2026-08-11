import { createProgramRoot } from "../ui.js";

export const renderRemote = (context, program, programId) => {
  const content = createProgramRoot(program);

  content.innerHTML = `<div class="xp-program-panel"><img src="${context.XP_ICON_PATHS[program.icon]}" alt=""><p>Enter the name of the remote computer.</p><label>Computer: <input aria-label="Computer"></label><button type="button">Connect</button><p class="xp-program-status" aria-live="polite"></p></div>`;
  content.querySelector("button").addEventListener("click", () => {
    const computer = content.querySelector("input").value.trim();
    content.querySelector(".xp-program-status").textContent = computer
      ? `The computer ${computer} is not available on this local network.`
      : "Enter a computer name.";
  });
  return content;
};
