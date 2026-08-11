import { createProgramRoot } from "../ui.js";

export const renderDisk = (context, program, programId) => {
  const content = createProgramRoot(program);

  content.innerHTML = `<div class="xp-disk-header"><img src="${context.XP_ICON_PATHS[program.icon]}" alt=""><div><b>${program.title}</b><p>Local Disk (C:)</p></div></div><fieldset><legend>Files to delete</legend><label><input type="checkbox" data-size="18" checked> Downloaded Program Files <span>18 KB</span></label><label><input type="checkbox" data-size="1536" checked> Temporary Internet Files <span>1,536 KB</span></label><label><input type="checkbox" data-size="64"> Recycle Bin <span>64 KB</span></label><label><input type="checkbox" data-size="2944" checked> Temporary files <span>2,944 KB</span></label></fieldset><p>You can free up <b data-disk-total>4,498 KB</b> of disk space.</p><button type="button" data-disk-clean>OK</button><p class="xp-program-status" aria-live="polite"></p>`;
  const updateTotal = () => {
    const total = [
      ...content.querySelectorAll('input[type="checkbox"]:checked'),
    ].reduce((sum, checkbox) => sum + Number(checkbox.dataset.size), 0);
    content.querySelector("[data-disk-total]").textContent =
      `${total.toLocaleString()} KB`;
  };
  content
    .querySelectorAll('input[type="checkbox"]')
    .forEach((checkbox) => checkbox.addEventListener("change", updateTotal));
  content.querySelector("[data-disk-clean]").addEventListener("click", () => {
    const total = content.querySelector("[data-disk-total]").textContent;
    content.querySelector(".xp-program-status").textContent =
      `${total} of temporary data was cleaned.`;
  });
  return content;
};
