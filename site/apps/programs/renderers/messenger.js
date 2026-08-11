import { createProgramRoot } from "../ui.js";

export const renderMessenger = (context, program, programId) => {
  const content = createProgramRoot(program);

  content.innerHTML = `<div class="xp-messenger-account"><img src="${context.XP_ICON_PATHS["WindowsMessengerLarge.png"]}" alt=""><div><b>Administrator</b><label>Status: <select aria-label="Status"><option>Online</option><option>Busy</option><option>Appear Offline</option></select></label></div></div><div class="xp-messenger-body"><aside><h3>My Contacts</h3><button type="button" data-contact="Windows XP Support">● Windows XP Support</button><button type="button" data-add-contact>Add a Contact</button></aside><main><div class="xp-messenger-history" aria-live="polite"><p>Select a contact to start a conversation.</p></div><form><input aria-label="Message" disabled><button type="submit" disabled>Send</button></form></main></div>`;
  const history = content.querySelector(".xp-messenger-history");
  const form = content.querySelector("form");
  const input = form.querySelector("input");
  const send = form.querySelector("button");
  let contact = null;
  content.querySelector("[data-contact]").addEventListener("click", (event) => {
    contact = event.currentTarget.dataset.contact;
    history.innerHTML = `<h3></h3><p class="system-message">This contact is offline. Messages remain on this computer.</p>`;
    history.querySelector("h3").textContent = contact;
    input.disabled = false;
    send.disabled = false;
    input.focus();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || !contact) return;
    const paragraph = document.createElement("p");
    const name = document.createElement("b");
    name.textContent = "Administrator says: ";
    paragraph.append(name, message);
    history.appendChild(paragraph);
    input.value = "";
    history.scrollTop = history.scrollHeight;
  });
  content.querySelector("[data-add-contact]").addEventListener("click", () => {
    const address = window.prompt?.("Enter the contact's e-mail address:");
    if (!address) return;
    history.textContent = `${address} was added to your local contact list.`;
  });
  return content;
};
