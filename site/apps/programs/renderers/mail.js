import { createProgramRoot } from "../ui.js";

export const renderMail = (context, program, programId) => {
  const content = createProgramRoot(program);

  content.innerHTML = `<div class="xp-mail-toolbar"><button type="button" data-mail-new>New Mail</button><button type="button" data-mail-reply disabled>Reply</button><button type="button" data-mail-delete disabled>Delete</button></div><div class="xp-mail-layout"><aside class="xp-mail-folders" aria-label="Folders"></aside><main class="xp-mail-workspace"></main></div>`;
  const folders = {
    Inbox: [
      {
        from: "Outlook Express Team",
        email: "outlook-express@example.com",
        subject: "Welcome to Outlook Express 6",
        body: "Outlook Express is ready to manage mail stored on this computer.",
      },
    ],
    Outbox: [],
    "Sent Items": [],
    "Deleted Items": [],
    Drafts: [],
  };
  const folderPane = content.querySelector(".xp-mail-folders");
  const workspace = content.querySelector(".xp-mail-workspace");
  const replyButton = content.querySelector("[data-mail-reply]");
  const deleteButton = content.querySelector("[data-mail-delete]");
  let currentFolder = "Inbox";
  let selectedMessage = null;
  const updateMailActions = () => {
    replyButton.disabled = !selectedMessage;
    deleteButton.disabled = !selectedMessage;
  };
  const renderFolders = () => {
    folderPane.replaceChildren();
    Object.entries(folders).forEach(([name, messages]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = name === currentFolder ? "selected" : "";
      button.dataset.folder = name;
      button.textContent = `${name}${messages.length ? ` (${messages.length})` : ""}`;
      folderPane.appendChild(button);
    });
  };
  const renderFolder = () => {
    selectedMessage = null;
    updateMailActions();
    renderFolders();
    workspace.innerHTML = `<table class="xp-mail-list"><thead><tr><th>From</th><th>Subject</th></tr></thead><tbody></tbody></table><article class="xp-mail-preview"><p>Select a message to read it.</p></article>`;
    const body = workspace.querySelector("tbody");
    folders[currentFolder].forEach((message, index) => {
      const row = document.createElement("tr");
      row.dataset.message = String(index);
      const from = document.createElement("td");
      const subject = document.createElement("td");
      from.textContent = message.from || message.to;
      subject.textContent = message.subject || "(no subject)";
      row.append(from, subject);
      body.appendChild(row);
    });
  };
  const openComposer = (initial = {}) => {
    workspace.innerHTML = `<form class="xp-mail-compose"><label>To: <input name="to" type="email" aria-label="To" required></label><label>Subject: <input name="subject" aria-label="Subject"></label><textarea name="body" aria-label="Message body"></textarea><div><button type="submit">Send</button><button type="button" data-save-draft>Save Draft</button></div></form>`;
    const form = workspace.querySelector("form");
    form.elements.to.value = initial.to || "";
    form.elements.subject.value = initial.subject || "";
    form.elements.body.value = initial.body || "";
    const storeMessage = (folder) => {
      folders[folder].push({
        from: "Administrator",
        to: form.elements.to.value,
        subject: form.elements.subject.value,
        body: form.elements.body.value,
      });
      currentFolder = folder;
      renderFolder();
    };
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      storeMessage("Sent Items");
    });
    form
      .querySelector("[data-save-draft]")
      .addEventListener("click", () => storeMessage("Drafts"));
    form.elements.to.focus();
  };
  folderPane.addEventListener("click", (event) => {
    const button = event.target.closest("[data-folder]");
    if (!button) return;
    currentFolder = button.dataset.folder;
    renderFolder();
  });
  workspace.addEventListener("click", (event) => {
    const row = event.target.closest("[data-message]");
    if (!row) return;
    selectedMessage = {
      index: Number(row.dataset.message),
      message: folders[currentFolder][Number(row.dataset.message)],
    };
    workspace
      .querySelectorAll("[data-message]")
      .forEach((candidate) =>
        candidate.classList.toggle("selected", candidate === row),
      );
    updateMailActions();
    const { message } = selectedMessage;
    workspace.querySelector(".xp-mail-preview").innerHTML =
      `<h3></h3><p class="xp-mail-from"></p><div class="xp-mail-body"></div>`;
    workspace.querySelector("h3").textContent = message.subject;
    workspace.querySelector(".xp-mail-from").textContent =
      `From: ${message.from || "Administrator"}`;
    workspace.querySelector(".xp-mail-body").textContent = message.body;
  });
  content
    .querySelector("[data-mail-new]")
    .addEventListener("click", () => openComposer());
  replyButton.addEventListener("click", () => {
    if (!selectedMessage) return;
    const { message } = selectedMessage;
    openComposer({
      to: message.email || message.to || "",
      subject: message.subject?.startsWith("Re:")
        ? message.subject
        : `Re: ${message.subject || ""}`,
      body: `\n\n----- Original Message -----\n${message.body || ""}`,
    });
  });
  deleteButton.addEventListener("click", () => {
    if (!selectedMessage) return;
    const [message] = folders[currentFolder].splice(selectedMessage.index, 1);
    if (currentFolder !== "Deleted Items")
      folders["Deleted Items"].push(message);
    renderFolder();
  });
  renderFolder();
  return content;
};
