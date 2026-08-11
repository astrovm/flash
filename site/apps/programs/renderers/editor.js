import { createProgramRoot } from "../ui.js";

export const renderEditor = (context, program, programId) => {
  const content = createProgramRoot(program);

  content.innerHTML = `<div class="xp-editor-toolbar"><button type="button" data-editor-command="bold"><b>B</b></button><button type="button" data-editor-command="italic"><i>I</i></button><button type="button" data-editor-command="underline"><u>U</u></button></div><div class="xp-editor-page" contenteditable="true" role="textbox" aria-label="Document"></div>`;
  const page = content.querySelector(".xp-editor-page");
  content
    .querySelector(".xp-editor-toolbar")
    .addEventListener("click", (event) => {
      const command = event.target.closest("button")?.dataset.editorCommand;
      if (command) document.execCommand(command);
      page.focus();
    });
  return content;
};
