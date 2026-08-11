import { createProgramRoot } from "../ui.js";

export const renderCharacterMap = (context, program, programId) => {
  const content = createProgramRoot(program);

  content.innerHTML = `<label>Font: <select><option>Arial</option><option>Courier New</option><option>Tahoma</option></select></label><div class="xp-character-grid" aria-label="Characters"></div><label>Characters to copy: <input></label>`;
  const target = content.querySelector("input");
  for (let code = 33; code <= 126; code += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String.fromCharCode(code);
    button.addEventListener(
      "click",
      () => (target.value += button.textContent),
    );
    content.querySelector(".xp-character-grid").appendChild(button);
  }
  return content;
};
