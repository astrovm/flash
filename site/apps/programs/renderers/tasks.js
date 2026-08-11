import { createProgramRoot } from "../ui.js";

export const renderTasks = (context, program, programId) => {
  const content = createProgramRoot(program);

  content.innerHTML = `<div class="xp-program-toolbar"><button type="button" data-task-new>Add Scheduled Task</button></div><form class="xp-task-form" hidden><label>Task name: <input name="name" aria-label="Task name" required></label><label>Program: <select name="program" aria-label="Program"><option>Disk Cleanup</option><option>Notepad</option><option>System Information</option></select></label><label>Schedule: <select name="schedule" aria-label="Schedule"><option>Daily</option><option>Weekly</option><option>When I log on</option></select></label><div><button type="submit">Finish</button><button type="button" data-task-cancel>Cancel</button></div></form><table class="xp-task-list"><thead><tr><th>Name</th><th>Schedule</th><th>Next Run Time</th><th></th></tr></thead><tbody></tbody></table><p class="xp-program-status" aria-live="polite">Use Add Scheduled Task to schedule a program.</p>`;
  const form = content.querySelector(".xp-task-form");
  const body = content.querySelector("tbody");
  const status = content.querySelector(".xp-program-status");
  const tasks = [];
  const renderTasks = () => {
    body.replaceChildren();
    tasks.forEach((task, index) => {
      const row = document.createElement("tr");
      row.dataset.task = String(index);
      [task.name, task.schedule, task.nextRun].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      const actions = document.createElement("td");
      actions.innerHTML = `<button type="button" data-task-run>Run</button><button type="button" data-task-delete>Delete</button>`;
      row.appendChild(actions);
      body.appendChild(row);
    });
  };
  content.querySelector("[data-task-new]").addEventListener("click", () => {
    form.hidden = false;
    form.elements.name.focus();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    tasks.push({
      name: form.elements.name.value.trim(),
      program: form.elements.program.value,
      schedule: form.elements.schedule.value,
      nextRun:
        form.elements.schedule.value === "When I log on"
          ? "At next logon"
          : "Tomorrow at 9:00 AM",
    });
    status.textContent = `${form.elements.name.value.trim()} was scheduled.`;
    form.reset();
    form.hidden = true;
    renderTasks();
  });
  form.querySelector("[data-task-cancel]").addEventListener("click", () => {
    form.reset();
    form.hidden = true;
  });
  body.addEventListener("click", (event) => {
    const row = event.target.closest("[data-task]");
    if (!row) return;
    const index = Number(row.dataset.task);
    if (event.target.closest("[data-task-run]")) {
      status.textContent = `${tasks[index].name} ran ${tasks[index].program}.`;
    } else if (event.target.closest("[data-task-delete]")) {
      const [removed] = tasks.splice(index, 1);
      status.textContent = `${removed.name} was deleted.`;
      renderTasks();
    }
  });
  renderTasks();
  return content;
};
