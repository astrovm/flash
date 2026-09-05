export const createAddRemoveProgramsContent = ({
  openProjectSettings,
  openSystemWindow,
}) => {
  const content = document.createElement("div");
  content.className = "add-remove-programs-content";
  content.innerHTML = `
    <nav class="add-remove-programs-nav" aria-label="Add or Remove Programs tasks">
      <button type="button" class="selected" data-page="installed">Installed applications</button>
      <button type="button" data-page="add">Add games</button>
      <button type="button" disabled title="Windows components cannot be installed in this browser">Windows Components</button>
      <button type="button" disabled title="Operating system defaults cannot be changed by this website">Program Access and Defaults</button>
    </nav>
    <main class="add-remove-programs-main"></main>`;
  const main = content.querySelector("main");
  const render = (page) => {
    for (const button of content.querySelectorAll("[data-page]"))
      button.classList.toggle("selected", button.dataset.page === page);
    if (page === "add") {
      main.innerHTML = `<h2>Add games</h2><p>Browse Internet Games to install supported Flash games. Windows installers and drivers cannot be installed here.</p><button type="button" class="xp-btn" data-action="browse">Browse Internet Games</button><button type="button" class="xp-btn" data-action="settings">Manage downloaded games</button>`;
    } else {
      main.innerHTML = `<h2>Included applications</h2><p>These applications are included with Astro Flash. Manage downloaded games and their storage in Astro Flash Settings.</p><ul aria-label="Included applications"></ul><button type="button" class="xp-btn" data-action="settings">Manage downloaded games</button>`;
      const list = main.querySelector("ul");
      for (const app of window.XPApplicationRegistry.values()
        .filter((app) => app.kind !== "system")
        .sort((a, b) => a.title.localeCompare(b.title))) {
        const item = document.createElement("li");
        item.textContent = app.title;
        list.appendChild(item);
      }
    }
  };
  content.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button?.dataset.page) render(button.dataset.page);
    if (button?.dataset.action === "settings") openProjectSettings();
    if (button?.dataset.action === "browse")
      openSystemWindow("__internet-games");
  });
  render("installed");
  return content;
};
