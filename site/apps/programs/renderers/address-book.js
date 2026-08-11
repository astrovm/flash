import { createProgramRoot } from "../ui.js";

export const renderAddressBook = (context, program, programId) => {
  const content = createProgramRoot(program);

  content.innerHTML = `<div class="xp-program-toolbar"><button type="button">New Contact</button></div><form class="xp-address-form" hidden><input name="name" aria-label="Name" placeholder="Name" required><input name="email" type="email" aria-label="E-mail" placeholder="E-mail"><button type="submit">Add</button></form><table class="xp-address-list"><thead><tr><th>Name</th><th>E-mail Address</th></tr></thead><tbody><tr><td>Administrator</td><td>administrator@localhost</td></tr></tbody></table>`;
  const form = content.querySelector("form");
  content
    .querySelector(".xp-program-toolbar button")
    .addEventListener("click", () => {
      form.hidden = false;
      form.elements.name.focus();
    });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const row = document.createElement("tr");
    [form.elements.name.value, form.elements.email.value].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    content.querySelector("tbody").appendChild(row);
    form.reset();
    form.hidden = true;
  });
  return content;
};
