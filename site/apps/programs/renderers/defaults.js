import { createProgramRoot } from "../ui.js";

export const renderDefaults = (context, program, programId) => {
  const content = createProgramRoot(program);

  content.innerHTML = `<div class="xp-program-panel"><h2>Choose a configuration</h2><label><input type="radio" name="defaults" checked> Microsoft Windows</label><label><input type="radio" name="defaults"> Non-Microsoft</label><label><input type="radio" name="defaults"> Custom</label><button type="button">OK</button><p class="xp-program-status" aria-live="polite"></p></div>`;
  content.querySelector("button").addEventListener("click", () => {
    content.querySelector(".xp-program-status").textContent =
      "The selected program access settings have been applied.";
  });
  return content;
};
