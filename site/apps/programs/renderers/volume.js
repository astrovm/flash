import { createProgramRoot } from "../ui.js";

export const renderVolume = (context, program, programId) => {
  const content = createProgramRoot(program);

  const { volume, isMuted } = context.getSystemVolume();
  content.innerHTML = `<div class="xp-volume-console"><div class="xp-volume-heading">Volume Control</div><label>Volume<input type="range" min="0" max="100" value="${volume}" orient="vertical" aria-label="Volume level"></label><label><input type="checkbox" ${isMuted ? "checked" : ""}> Mute</label></div>`;
  const slider = content.querySelector('input[type="range"]');
  const mute = content.querySelector('input[type="checkbox"]');
  const apply = () =>
    context.setSystemVolume(Number(slider.value), mute.checked);
  slider.addEventListener("input", apply);
  mute.addEventListener("change", apply);
  return content;
};
