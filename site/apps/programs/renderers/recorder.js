import { createProgramRoot } from "../ui.js";

export const renderRecorder = (context, program, programId) => {
  const content = createProgramRoot(program);

  content.innerHTML = `<div class="xp-recorder-display"><output aria-label="Recording time">0.00 sec</output><div class="xp-recorder-wave" aria-hidden="true"></div></div><div class="xp-recorder-controls"><button type="button" data-action="record" aria-label="Record">●</button><button type="button" data-action="stop" aria-label="Stop">■</button><button type="button" data-action="play" aria-label="Play">▶</button></div><p class="xp-program-status" aria-live="polite">Stopped</p>`;
  const output = content.querySelector("output");
  const status = content.querySelector(".xp-program-status");
  let elapsed = 0;
  let timer = null;
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
    status.textContent = "Stopped";
  };
  content
    .querySelector('[data-action="record"]')
    .addEventListener("click", () => {
      stop();
      elapsed = 0;
      status.textContent = "Recording";
      content.querySelector(".xp-recorder-wave").classList.add("active");
      timer = setInterval(() => {
        if (!content.isConnected) return stop();
        elapsed += 0.1;
        output.textContent = `${elapsed.toFixed(2)} sec`;
      }, 100);
    });
  content
    .querySelector('[data-action="stop"]')
    .addEventListener("click", () => {
      stop();
      content.querySelector(".xp-recorder-wave").classList.remove("active");
    });
  content
    .querySelector('[data-action="play"]')
    .addEventListener("click", () => {
      stop();
      status.textContent = elapsed
        ? "Playing recorded sound"
        : "No recorded sound";
    });
  return content;
};
