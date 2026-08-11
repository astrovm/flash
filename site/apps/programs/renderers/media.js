import { createProgramRoot } from "../ui.js";

export const renderMedia = (context, program, programId) => {
  const content = createProgramRoot(program);

  content.innerHTML = `<div class="xp-media-screen"><div class="xp-media-logo">Windows Media Player</div><p data-track>Windows XP Startup</p></div><div class="xp-media-controls"><button type="button" data-media="play" aria-label="Play">▶</button><button type="button" data-media="stop" aria-label="Stop">■</button><input type="range" min="0" max="100" value="70" aria-label="Player volume"></div>`;
  const audio = new Audio("assets/xp/sounds/startup.wav");
  const volume = content.querySelector('input[type="range"]');
  volume.addEventListener(
    "input",
    () => (audio.volume = Number(volume.value) / 100),
  );
  content
    .querySelector('[data-media="play"]')
    .addEventListener("click", () => audio.play());
  content.querySelector('[data-media="stop"]').addEventListener("click", () => {
    audio.pause();
    audio.currentTime = 0;
  });
  return content;
};
