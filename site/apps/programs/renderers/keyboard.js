import { createProgramRoot } from "../ui.js";

export const renderKeyboard = (context, program, programId) => {
  const content = createProgramRoot(program);

  content.innerHTML = `<input class="xp-keyboard-output" aria-label="Typed text"><div class="xp-keyboard-keys"></div>`;
  const output = content.querySelector("input");
  "1234567890QWERTYUIOPASDFGHJKLZXCVBNM".split("").forEach((key) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = key;
    button.addEventListener("click", () => {
      output.value += key;
      output.focus();
    });
    content.querySelector(".xp-keyboard-keys").appendChild(button);
  });
  return content;
};
