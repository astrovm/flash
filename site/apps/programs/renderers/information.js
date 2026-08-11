import { createProgramRoot } from "../ui.js";

export const renderInformation = (context, program, programId) => {
  const content = createProgramRoot(program);

  content.innerHTML = `<div class="xp-system-information"><aside><button type="button" class="selected" data-info-section="summary">System Summary</button><button type="button" data-info-section="hardware">Hardware Resources</button><button type="button" data-info-section="components">Components</button><button type="button" data-info-section="software">Software Environment</button></aside><table><tbody></tbody></table></div>`;
  const sections = {
    summary: [
      ["OS Name", "Microsoft Windows XP Professional"],
      ["Version", "5.1.2600 Service Pack 3 Build 2600"],
      ["System Manufacturer", "Astro VM"],
      ["System Type", "X86-based PC"],
      ["Total Physical Memory", "512.00 MB"],
      ["Display", `${window.innerWidth} × ${window.innerHeight}`],
    ],
    hardware: [
      ["Conflicts/Sharing", "No hardware conflicts detected"],
      ["DMA", "Direct memory access controller"],
      ["IRQs", "System timer — IRQ 0"],
      ["Memory", "0x00000000–0x1FFFFFFF"],
    ],
    components: [
      ["Display", "Standard VGA Graphics Adapter"],
      ["Multimedia", "Audio Codecs"],
      ["Network", "Local Area Connection"],
      ["Storage", "Local Disk (C:)"],
    ],
    software: [
      ["System Drivers", "All drivers are running"],
      ["Environment Variables", "TEMP, PATH, USERPROFILE"],
      ["Running Tasks", "explorer.exe, services.exe"],
      ["Startup Programs", "Windows Messenger"],
    ],
  };
  const body = content.querySelector("tbody");
  const renderSection = (section) => {
    body.replaceChildren();
    sections[section].forEach(([name, value]) => {
      const row = document.createElement("tr");
      const heading = document.createElement("th");
      const cell = document.createElement("td");
      heading.textContent = name;
      cell.textContent = value;
      row.append(heading, cell);
      body.appendChild(row);
    });
    content
      .querySelectorAll("[data-info-section]")
      .forEach((button) =>
        button.classList.toggle(
          "selected",
          button.dataset.infoSection === section,
        ),
      );
  };
  content.querySelector("aside").addEventListener("click", (event) => {
    const button = event.target.closest("[data-info-section]");
    if (button) renderSection(button.dataset.infoSection);
  });
  renderSection("summary");
  return content;
};
