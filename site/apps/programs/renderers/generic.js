import { createProgramRoot } from "../ui.js";

export const renderGeneric = (context, program) => {
  const content = createProgramRoot(program);

  const isWizard = program.kind === "wizard";
  content.innerHTML = `<div class="xp-program-panel"><img src="${context.XP_ICON_PATHS[program.icon]}" alt=""><h2>${program.title}</h2><p>${program.description || `Use ${program.title} on this computer.`}</p><div class="xp-program-workspace"></div><p class="xp-program-status" aria-live="polite"></p><div class="xp-program-actions"><button type="button" data-primary>${isWizard ? "Next >" : "Start"}</button>${isWizard ? '<button type="button" data-cancel>Cancel</button>' : ""}</div></div>`;
  const status = content.querySelector(".xp-program-status");
  content.querySelector("[data-primary]").addEventListener("click", (event) => {
    status.textContent = isWizard
      ? `${program.title} completed its local configuration check.`
      : `${program.title} is running.`;
    event.target.disabled = true;
  });
  content.querySelector("[data-cancel]")?.addEventListener("click", () => {
    status.textContent = `${program.title} was cancelled.`;
  });
  return content;
};
