import { createProgramRoot } from "../ui.js";

export const renderHyperterminal = (context, program, programId) => {
  const content = createProgramRoot(program);

  content.innerHTML = `<form class="xp-hyperterminal-connect"><fieldset><legend>Connect To</legend><label>Name: <input name="name" value="My Connection" aria-label="Connection name"></label><label>Country/region: <select name="country" aria-label="Country or region"><option>Argentina (54)</option><option>United States of America (1)</option></select></label><label>Area code: <input name="area" aria-label="Area code"></label><label>Phone number: <input name="phone" aria-label="Phone number" required></label></fieldset><div><button type="submit">Dial</button><button type="button" data-hyperterminal-cancel>Cancel</button></div><p class="xp-program-status" aria-live="polite"></p></form>`;
  const form = content.querySelector("form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const phone = form.elements.phone.value.trim();
    if (!phone) return;
    content.innerHTML = `<div class="xp-hyperterminal-toolbar"><span>Connected to </span><b></b><button type="button" data-disconnect>Disconnect</button></div><div class="xp-hyperterminal-screen" aria-live="polite">ATDT${phone}\nCONNECT 57600\n</div><form class="xp-hyperterminal-prompt"><input aria-label="Terminal input" autocomplete="off"><button type="submit">Send</button></form>`;
    content.querySelector(".xp-hyperterminal-toolbar b").textContent =
      form.elements.name.value || phone;
    const screen = content.querySelector(".xp-hyperterminal-screen");
    const prompt = content.querySelector(".xp-hyperterminal-prompt");
    prompt.addEventListener("submit", (promptEvent) => {
      promptEvent.preventDefault();
      const input = prompt.querySelector("input");
      if (!input.value) return;
      screen.textContent += `${input.value}\n`;
      input.value = "";
    });
    content.querySelector("[data-disconnect]").addEventListener("click", () => {
      screen.textContent += "\nNO CARRIER";
      prompt.querySelector("input").disabled = true;
      prompt.querySelector("button").disabled = true;
    });
    prompt.querySelector("input").focus();
  });
  form
    .querySelector("[data-hyperterminal-cancel]")
    .addEventListener("click", () => {
      form.querySelector(".xp-program-status").textContent =
        "The connection was cancelled.";
    });
  return content;
};
