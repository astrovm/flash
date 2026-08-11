"use strict";

// ============================================
// Taskbar
// ============================================

const closeTaskbarMenus = () => {
  document.getElementById("taskbar-context-menu").hidden = true;
  document.getElementById("taskbar-overflow-menu").hidden = true;
};

// Public shell hook for windows that need to notify the user without stealing
// focus (for example, an app that has finished loading).
const setWindowAttention = (gameId, needsAttention = true) => {
  const win = openWindows.get(gameId);
  if (!win) return false;
  win.needsAttention = Boolean(needsAttention) && gameId !== focusedGameId;
  renderTaskButtons();
  return true;
};
window.XPShell = Object.assign(window.XPShell || {}, { setWindowAttention });

const positionTaskbarMenu = (menu, clientX, clientY) => {
  menu.hidden = false;
  menu.style.left = "0";
  menu.style.top = "0";
  menu.style.left = `${Math.max(2, Math.min(clientX, innerWidth - menu.offsetWidth - 2))}px`;
  menu.style.top = `${Math.max(2, Math.min(clientY - menu.offsetHeight, innerHeight - menu.offsetHeight - 2))}px`;
  menu.querySelector("button:not(:disabled)")?.focus();
};

const wireTaskbarMenuKeyboard = (menu) => {
  menu.addEventListener("keydown", (event) => {
    const items = [...menu.children]
      .map((child) =>
        child.matches("button")
          ? child
          : child.matches(".context-parent")
            ? child.firstElementChild
            : null,
      )
      .filter((item) => item?.matches("button:not(:disabled)"));
    if (!items.length) return;
    const current = items.indexOf(document.activeElement);
    let target = null;
    if (event.key === "ArrowDown") {
      target = items[(current + 1 + items.length) % items.length];
    } else if (event.key === "ArrowUp") {
      target = items[(current - 1 + items.length) % items.length];
    } else if (event.key === "Home") {
      target = items[0];
    } else if (event.key === "End") {
      target = items.at(-1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeTaskbarMenus();
      return;
    } else if (
      (event.key === "Enter" || event.key === " ") &&
      document.activeElement?.matches("button:not(:disabled)")
    ) {
      event.preventDefault();
      document.activeElement.click();
      return;
    }
    if (target) {
      event.preventDefault();
      target.focus();
    }
  });
};

const activateTaskButton = (gameId) => {
  const win = openWindows.get(gameId);
  if (!win) return;
  if (gameId === focusedGameId && !win.minimized) minimizeWindow(gameId);
  else {
    restoreWindow(gameId);
    focusWindow(gameId);
  }
};

const renderTaskButtons = () => {
  const container = document.getElementById("task-buttons");
  const windows = [...openWindows.entries()];
  const styles = getComputedStyle(container);
  const taskMinWidth =
    Number.parseFloat(styles.getPropertyValue("--task-button-min-width")) || 52;
  const overflowMinWidth =
    Number.parseFloat(styles.getPropertyValue("--task-overflow-min-width")) ||
    68;
  const taskGap = Number.parseFloat(styles.gap) || 0;
  const contentWidth = Math.max(
    0,
    container.clientWidth -
      (Number.parseFloat(styles.paddingLeft) || 0) -
      (Number.parseFloat(styles.paddingRight) || 0),
  );
  const allTasksWidth =
    windows.length * taskMinWidth + Math.max(0, windows.length - 1) * taskGap;
  const hasOverflow = allTasksWidth > contentWidth;
  // The overflow control has a larger minimum than a normal task. Account
  // for that control and its separating gap up front so it cannot be clipped.
  const visibleCapacity = hasOverflow
    ? Math.max(
        0,
        Math.floor(
          (contentWidth - overflowMinWidth - taskGap) /
            (taskMinWidth + taskGap),
        ),
      )
    : windows.length;
  const visible = windows.slice(0, visibleCapacity);
  const hidden = windows.slice(visible.length);
  container.innerHTML = "";

  const appendTaskButton = ([gameId, win]) => {
    const taskTitle = win.title || formatGameTitle(gameId);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "task-button" +
      (gameId === focusedGameId && !win.minimized ? " active" : "") +
      (win.needsAttention ? " needs-attention" : "");
    btn.dataset.game = gameId;
    btn.title = taskTitle;
    btn.setAttribute(
      "aria-label",
      `${taskTitle}${win.minimized ? ", minimized" : ""}${win.needsAttention ? ", needs attention" : ""}`,
    );
    btn.setAttribute(
      "aria-pressed",
      String(gameId === focusedGameId && !win.minimized),
    );

    const icon = createGameIconElement(gameId, "task-icon");
    const taskImage = icon.querySelector("img");
    if (taskImage && win.icon) taskImage.src = win.icon;

    const label = document.createElement("span");
    label.className = "task-label";
    label.textContent = taskTitle;

    btn.append(icon, label);
    btn.addEventListener("click", () => activateTaskButton(gameId));
    btn.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      closeTaskbarMenus();
      openWindowSystemMenu(win, event.clientX, event.clientY);
    });
    container.appendChild(btn);
  };
  visible.forEach(appendTaskButton);

  if (hidden.length) {
    const overflow = document.createElement("button");
    overflow.type = "button";
    const hiddenNeedsAttention = hidden.some(([, win]) => win.needsAttention);
    overflow.className =
      "task-button task-button-grouped" +
      (hiddenNeedsAttention ? " needs-attention" : "");
    overflow.textContent = `${hidden.length} windows`;
    overflow.setAttribute(
      "aria-label",
      `Open menu for ${hidden.length} additional windows${hiddenNeedsAttention ? ", including a window that needs attention" : ""}`,
    );
    overflow.setAttribute("aria-haspopup", "menu");
    overflow.addEventListener("click", () => {
      const menu = document.getElementById("taskbar-overflow-menu");
      menu.innerHTML = "";
      const explorerWindows = hidden.filter(
        ([, win]) => win.type === "system" && win.currentFolderId,
      );
      const appendWindowItem = ([gameId, win]) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className =
          "taskbar-overflow-item" +
          (win.needsAttention ? " needs-attention" : "");
        item.setAttribute("role", "menuitem");
        item.textContent = formatGameTitle(gameId);
        item.setAttribute(
          "aria-label",
          `${formatGameTitle(gameId)}${win.minimized ? ", minimized" : ""}${win.needsAttention ? ", needs attention" : ""}`,
        );
        item.addEventListener("click", () => {
          closeTaskbarMenus();
          activateTaskButton(gameId);
        });
        item.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          closeTaskbarMenus();
          openWindowSystemMenu(win, event.clientX, event.clientY);
        });
        menu.appendChild(item);
      };
      // Group only genuinely similar windows. Other applications stay
      // separate menu items rather than being presented as one app.
      if (explorerWindows.length > 1) {
        const heading = document.createElement("span");
        heading.className = "taskbar-group-heading";
        heading.setAttribute("role", "presentation");
        heading.textContent = `Windows Explorer (${explorerWindows.length})`;
        menu.appendChild(heading);
        explorerWindows.forEach(appendWindowItem);
      }
      hidden
        .filter(
          (entry) =>
            !explorerWindows.includes(entry) || explorerWindows.length <= 1,
        )
        .forEach(appendWindowItem);
      const rect = overflow.getBoundingClientRect();
      positionTaskbarMenu(menu, rect.left, rect.top);
    });
    container.appendChild(overflow);
  }
};

const arrangeTaskbarWindows = (mode) => {
  const windows = [...openWindows.values()].filter((win) => !win.minimized);
  if (!windows.length) return;
  const { width, height } = getDesktopSize();
  windows.forEach((win, index) => {
    if (win.maximized) toggleMaximize(win.gameId);
    if (mode === "cascade") {
      const offset = index * 26;
      Object.assign(win.el.style, {
        left: `${Math.min(offset, width - 340)}px`,
        top: `${Math.min(offset, height - 240)}px`,
        width: `${Math.max(340, width - Math.min(offset, 130))}px`,
        height: `${Math.max(240, height - Math.min(offset, 130))}px`,
      });
    } else {
      const horizontal = mode === "tile-horizontal";
      const count = windows.length;
      Object.assign(
        win.el.style,
        horizontal
          ? {
              left: "0px",
              top: `${(index * height) / count}px`,
              width: `${width}px`,
              height: `${height / count}px`,
            }
          : {
              left: `${(index * width) / count}px`,
              top: "0px",
              width: `${width / count}px`,
              height: `${height}px`,
            },
      );
    }
  });
  focusWindow(windows[windows.length - 1].gameId);
};

const openTaskManager = () => {
  const dialog = XPDialogs.createDialog({ title: "Windows Task Manager" });
  dialog.el.classList.add("task-manager-dialog");
  const title = dialog.el.querySelector(".title-text");
  const titleIcon = document.createElement("img");
  titleIcon.className = "task-manager-title-icon";
  titleIcon.src = "assets/xp/icons/TaskManager.png";
  titleIcon.alt = "";
  title.before(titleIcon);
  const titleButtons = dialog.el.querySelector(".title-buttons");
  const minimize = document.createElement("button");
  minimize.type = "button";
  minimize.className = "tb-btn minimize-btn";
  minimize.setAttribute("aria-label", "Minimize");
  const maximize = document.createElement("button");
  maximize.type = "button";
  maximize.className = "tb-btn maximize-btn";
  maximize.setAttribute("aria-label", "Maximize");
  titleButtons.prepend(minimize, maximize);

  const escapeTaskManagerText = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const applications = [...openWindows.values()].map((win) => ({
    id: win.gameId,
    title: win.title || formatGameTitle(win.gameId),
    minimized: win.minimized,
  }));
  const applicationRows = applications.length
    ? applications
        .map(
          (application, index) =>
            `<button type="button" class="task-manager-row${index ? "" : " selected"}" data-task-manager-window="${application.id}" role="option" aria-selected="${index ? "false" : "true"}"><span><img src="${openWindows.get(application.id)?.icon || systemShortcuts[application.id]?.icon || "assets/xp/icons/FolderOptions.png"}" alt="">${escapeTaskManagerText(application.title)}</span><span>${application.minimized ? "Minimized" : "Running"}</span></button>`,
        )
        .join("")
    : '<p class="task-manager-empty">No applications are running.</p>';
  const processes = [
    ["taskmgr.exe", "Administrator", "06", "3,828 K"],
    ["wscntfy.exe", "Administrator", "00", "1,852 K"],
    ["alg.exe", "LOCAL SERVICE", "00", "3,328 K"],
    ["spoolsv.exe", "SYSTEM", "00", "4,376 K"],
    ["explorer.exe", "Administrator", "00", "21,960 K"],
    ["svchost.exe", "LOCAL SERVICE", "00", "4,100 K"],
    ["svchost.exe", "NETWORK SERVICE", "00", "2,640 K"],
    ["svchost.exe", "SYSTEM", "00", "16,864 K"],
    ["lsass.exe", "SYSTEM", "00", "3,996 K"],
    ["services.exe", "SYSTEM", "00", "3,000 K"],
    ["winlogon.exe", "SYSTEM", "00", "6,396 K"],
    ["csrss.exe", "SYSTEM", "00", "3,148 K"],
    ["smss.exe", "SYSTEM", "00", "372 K"],
    ["System", "SYSTEM", "00", "212 K"],
    ["System Idle Process", "SYSTEM", "94", "16 K"],
  ];
  const processRows = processes
    .map(
      (process, index) =>
        `<button type="button" class="task-manager-process-row${index ? "" : " selected"}" role="option" aria-selected="${index ? "false" : "true"}">${process.map((value) => `<span>${value}</span>`).join("")}</button>`,
    )
    .join("");
  dialog.body.innerHTML = `
    <div class="task-manager-menu-bar" role="menubar">
      <button type="button" role="menuitem" data-task-manager-menu="file">File</button>
      <button type="button" role="menuitem" data-task-manager-menu="options">Options</button>
      <button type="button" role="menuitem" data-task-manager-menu="view">View</button>
      <button type="button" role="menuitem" data-task-manager-menu="windows">Windows</button>
      <button type="button" role="menuitem" data-task-manager-menu="shutdown">Shut Down</button>
      <button type="button" role="menuitem" data-task-manager-menu="help">Help</button>
    </div>
    <div class="task-manager-menu-popup" data-task-manager-popup="file" role="menu" hidden><button role="menuitem" data-task-manager-action="new-task">New Task (Run...)</button><hr><button role="menuitem" data-task-manager-action="exit">Exit Task Manager</button></div>
    <div class="task-manager-menu-popup" data-task-manager-popup="options" role="menu" hidden><button role="menuitem" data-task-manager-action="always-on-top">✓ Always On Top</button><button role="menuitem">Minimize On Use</button><button role="menuitem">Hide When Minimized</button></div>
    <div class="task-manager-menu-popup" data-task-manager-popup="view" role="menu" hidden><button role="menuitem" data-task-manager-action="refresh">Refresh Now</button><hr><button role="menuitem">Update Speed <span>▶</span></button><button role="menuitem">CPU History <span>▶</span></button><button role="menuitem">Show Kernel Times</button></div>
    <div class="task-manager-menu-popup" data-task-manager-popup="windows" role="menu" hidden><button role="menuitem" data-task-manager-action="cascade">Cascade</button><button role="menuitem" data-task-manager-action="tile-horizontal">Tile Horizontally</button><button role="menuitem" data-task-manager-action="tile-vertical">Tile Vertically</button><hr><button role="menuitem">Minimize</button><button role="menuitem">Maximize</button><button role="menuitem">Bring To Front</button></div>
    <div class="task-manager-menu-popup" data-task-manager-popup="shutdown" role="menu" hidden><button role="menuitem">Stand By</button><button role="menuitem">Hibernate</button><hr><button role="menuitem" data-task-manager-action="turn-off">Turn Off</button><button role="menuitem" data-task-manager-action="restart">Restart</button><hr><button role="menuitem" data-task-manager-action="log-off">Log Off Administrator</button><button role="menuitem">Switch User</button></div>
    <div class="task-manager-menu-popup" data-task-manager-popup="help" role="menu" hidden><button role="menuitem" data-task-manager-action="help">Task Manager Help Topics</button><hr><button role="menuitem" data-task-manager-action="about">About Task Manager</button></div>
    <div class="task-manager-tabs" role="tablist" aria-label="Windows Task Manager">
      <button type="button" role="tab" data-task-manager-tab="applications" aria-selected="true">Applications</button>
      <button type="button" role="tab" data-task-manager-tab="processes" aria-selected="false" tabindex="-1">Processes</button>
      <button type="button" role="tab" data-task-manager-tab="performance" aria-selected="false" tabindex="-1">Performance</button>
      <button type="button" role="tab" data-task-manager-tab="networking" aria-selected="false" tabindex="-1">Networking</button>
      <button type="button" role="tab" data-task-manager-tab="users" aria-selected="false" tabindex="-1">Users</button>
    </div>
    <div class="task-manager-panel task-manager-applications" data-task-manager-panel="applications">
      <div class="task-manager-list-head"><span>Task</span><span>Status</span></div>
      <div class="task-manager-app-list" role="listbox">${applicationRows}</div>
      <div class="task-manager-panel-buttons"><button type="button" class="xp-btn" data-task-manager-action="end-task">End Task</button><button type="button" class="xp-btn" data-task-manager-action="switch-to">Switch To</button><button type="button" class="xp-btn" data-task-manager-action="new-task">New Task...</button></div>
    </div>
    <div class="task-manager-panel task-manager-processes" data-task-manager-panel="processes" hidden>
      <div class="task-manager-process-head"><span>Image Name</span><span>User Name</span><span>CPU</span><span>Mem Usage</span></div>
      <div class="task-manager-process-list" role="listbox">${processRows}</div>
      <label><input type="checkbox"> Show processes from all users</label><button type="button" class="xp-btn">End Process</button>
    </div>
    <div class="task-manager-panel task-manager-performance" data-task-manager-panel="performance" hidden>
      <fieldset class="task-manager-meter cpu-meter"><legend>CPU Usage</legend><div class="task-manager-black-meter"><span></span><b>5%</b></div></fieldset>
      <fieldset class="task-manager-chart cpu-history"><legend>CPU Usage History</legend><div class="task-manager-graph"><svg viewBox="0 0 230 58" preserveAspectRatio="none"><polyline points="0,55 120,55 122,2 126,52 180,55 183,45 186,55 230,52"/></svg></div></fieldset>
      <fieldset class="task-manager-meter pf-meter"><legend>PF Usage</legend><div class="task-manager-black-meter"><span></span><b>81.0 MB</b></div></fieldset>
      <fieldset class="task-manager-chart pf-history"><legend>Page File Usage History</legend><div class="task-manager-graph"><svg viewBox="0 0 230 58" preserveAspectRatio="none"><polyline points="0,53 110,53 115,51 230,51"/></svg></div></fieldset>
      <fieldset class="task-manager-stats totals"><legend>Totals</legend><dl><dt>Handles</dt><dd>4061</dd><dt>Threads</dt><dd>243</dd><dt>Processes</dt><dd>17</dd></dl></fieldset>
      <fieldset class="task-manager-stats physical"><legend>Physical Memory (K)</legend><dl><dt>Total</dt><dd>523696</dd><dt>Available</dt><dd>400248</dd><dt>System Cache</dt><dd>126496</dd></dl></fieldset>
      <fieldset class="task-manager-stats commit"><legend>Commit Charge (K)</legend><dl><dt>Total</dt><dd>83032</dd><dt>Limit</dt><dd>1279408</dd><dt>Peak</dt><dd>108992</dd></dl></fieldset>
      <fieldset class="task-manager-stats kernel"><legend>Kernel Memory (K)</legend><dl><dt>Total</dt><dd>18640</dd><dt>Paged</dt><dd>15004</dd><dt>Nonpaged</dt><dd>3636</dd></dl></fieldset>
    </div>
    <div class="task-manager-panel task-manager-networking" data-task-manager-panel="networking" hidden><p>No Active Network Adapters Found.</p></div>
    <div class="task-manager-panel task-manager-users" data-task-manager-panel="users" hidden>
      <div class="task-manager-user-head"><span>User</span><span>ID</span><span>Status</span><span>Client Name</span></div>
      <button type="button" class="task-manager-user-row selected"><span>♟ Administrator</span><span>0</span><span>Active</span><span></span></button>
      <div class="task-manager-panel-buttons"><button type="button" class="xp-btn">Disconnect</button><button type="button" class="xp-btn" data-task-manager-action="log-off">Logoff</button><button type="button" class="xp-btn" disabled>Send Message...</button></div>
    </div>
    <div class="task-manager-status"><span>Processes: 17</span><span>CPU Usage: 5%</span><span>Commit Charge: 81M / 1249M</span></div>`;

  const tabs = [...dialog.body.querySelectorAll("[data-task-manager-tab]")];
  const panels = [...dialog.body.querySelectorAll("[data-task-manager-panel]")];
  const closeMenus = () =>
    dialog.body
      .querySelectorAll("[data-task-manager-popup]")
      .forEach((popup) => (popup.hidden = true));
  tabs.forEach((tab) =>
    tab.addEventListener("click", () => {
      tabs.forEach((entry) => {
        const selected =
          entry.dataset.taskManagerTab === tab.dataset.taskManagerTab;
        entry.setAttribute("aria-selected", String(selected));
        entry.tabIndex = selected ? 0 : -1;
      });
      panels.forEach((panel) => {
        panel.hidden =
          panel.dataset.taskManagerPanel !== tab.dataset.taskManagerTab;
      });
    }),
  );
  dialog.body.querySelectorAll("[data-task-manager-menu]").forEach((button) =>
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const popup = dialog.body.querySelector(
        `[data-task-manager-popup="${button.dataset.taskManagerMenu}"]`,
      );
      const open = popup.hidden;
      closeMenus();
      popup.hidden = !open;
      popup.style.left = `${button.offsetLeft}px`;
    }),
  );
  dialog.body.addEventListener("click", (event) => {
    const row = event.target.closest(".task-manager-row");
    if (row) {
      dialog.body.querySelectorAll(".task-manager-row").forEach((entry) => {
        const selected = entry === row;
        entry.classList.toggle("selected", selected);
        entry.setAttribute("aria-selected", String(selected));
      });
    }
    const action = event.target.closest("[data-task-manager-action]")?.dataset
      .taskManagerAction;
    if (!action) return;
    const selectedWindow = dialog.body.querySelector(
      ".task-manager-row.selected",
    )?.dataset.taskManagerWindow;
    closeMenus();
    if (action === "new-task") openRunDialog();
    else if (action === "exit") dialog.close("exit");
    else if (action === "end-task" && selectedWindow) {
      closeGameWindow(selectedWindow);
      dialog.body.querySelector(".task-manager-row.selected")?.remove();
    } else if (action === "switch-to" && selectedWindow) {
      dialog.close("switch");
      restoreWindow(selectedWindow);
      focusWindow(selectedWindow);
    } else if (action === "help") openHelpAndSupport();
    else if (action === "about") openAboutWindows();
    else if (action === "cascade") arrangeTaskbarWindows("cascade");
    else if (action === "tile-horizontal")
      arrangeTaskbarWindows("tile-horizontal");
    else if (action === "tile-vertical") arrangeTaskbarWindows("tile-vertical");
    else if (action === "turn-off" || action === "restart") {
      dialog.close(action);
      showShutdownDialog();
    } else if (action === "log-off") {
      dialog.close(action);
      showLogoffDialog();
    }
  });
  document.addEventListener("pointerdown", closeMenus, { once: true });
  minimize.addEventListener("click", () =>
    dialog.el.classList.toggle("task-manager-minimized"),
  );
  maximize.addEventListener("click", () =>
    dialog.el.classList.toggle("task-manager-maximized"),
  );
};

const openKeyboardProperties = (initialTab = "speed") => {
  const dialog = XPDialogs.createDialog({ title: "Keyboard Properties" });
  dialog.el.classList.add("keyboard-properties-dialog");
  Object.assign(dialog.el.style, {
    position: "fixed",
    left: `${Math.min(110, Math.max(4, window.innerWidth - 404))}px`,
    top: `${Math.min(144, Math.max(4, window.innerHeight - 454))}px`,
  });
  const help = document.createElement("button");
  help.type = "button";
  help.className = "tb-btn help-btn";
  help.setAttribute("aria-label", "Help");
  help.addEventListener("click", openHelpAndSupport);
  dialog.el.querySelector(".title-buttons").prepend(help);
  dialog.body.innerHTML = `
    <div class="keyboard-properties-tabs" role="tablist"><button type="button" role="tab" data-keyboard-tab="speed">Speed</button><button type="button" role="tab" data-keyboard-tab="hardware">Hardware</button></div>
    <div class="keyboard-properties-panels">
      <section data-keyboard-panel="speed"><fieldset class="keyboard-repeat"><legend>Character repeat</legend><img class="keyboard-delay-icon" src="assets/xp/icons/KeyboardRepeatDelay.png" alt=""><img class="keyboard-rate-icon" src="assets/xp/icons/KeyboardRepeatRate.png" alt=""><label><b>Repeat delay:</b><span>Long</span><input type="range" min="0" max="10" value="7"><span>Short</span></label><label><b>Repeat rate:</b><span>Slow</span><input type="range" min="0" max="10" value="10"><span>Fast</span></label><label>Click here and hold down a key to test repeat rate:<input type="text"></label></fieldset><fieldset class="keyboard-cursor"><legend>Cursor blink rate</legend><i aria-hidden="true"></i><label><span>None</span><input type="range" min="0" max="10" value="6"><span>Fast</span></label></fieldset></section>
      <section data-keyboard-panel="hardware" hidden><p class="keyboard-devices-label">Devices:</p><div class="keyboard-hardware-list" role="listbox"><strong><span>Name</span><span>Type</span></strong><span class="selected"><img src="assets/xp/system/KeyboardDevice.png" alt="">Standard 101/102-Key or Microsoft Natural PS/2 Keyboard <i>Keyboards</i></span></div><fieldset class="keyboard-device-properties"><legend>Device Properties</legend><p>Manufacturer: (Standard keyboards)</p><p>Location: plugged into keyboard port</p><p>Device Status: This device is working properly.</p><button class="xp-btn">Troubleshoot...</button><button class="xp-btn">Properties</button></fieldset></section>
    </div>`;
  const activate = (tab) => {
    dialog.body
      .querySelectorAll("[data-keyboard-tab]")
      .forEach((button) =>
        button.setAttribute(
          "aria-selected",
          String(button.dataset.keyboardTab === tab),
        ),
      );
    dialog.body.querySelectorAll("[data-keyboard-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.keyboardPanel !== tab;
    });
  };
  dialog.body.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-keyboard-tab]")?.dataset
      .keyboardTab;
    if (tab) activate(tab);
  });
  XPDialogs.addButtonRow(dialog, [
    { id: "ok", label: "OK", isDefault: true },
    { id: "cancel", label: "Cancel", isCancel: true },
    { id: "apply", label: "Apply" },
  ]);
  dialog.body.lastElementChild.classList.add("keyboard-properties-buttons");
  dialog.body.querySelector('[data-action="apply"]').disabled = true;
  activate(initialTab);
};

const addDialogHelpButton = (dialog) => {
  const help = document.createElement("button");
  help.type = "button";
  help.className = "tb-btn help-btn";
  help.setAttribute("aria-label", "Help");
  help.addEventListener("click", openHelpAndSupport);
  dialog.el.querySelector(".title-buttons").prepend(help);
};

const openAdvancedGameControllerSettings = () => {
  const dialog = XPDialogs.createDialog({ title: "Advanced Settings" });
  dialog.el.classList.add("game-controller-advanced-dialog");
  Object.assign(dialog.el.style, {
    position: "fixed",
    left: `${Math.min(28, Math.max(4, window.innerWidth - 335))}px`,
    top: `${Math.min(80, Math.max(4, window.innerHeight - 171))}px`,
  });
  addDialogHelpButton(dialog);
  dialog.body.innerHTML = `
    <p>Select the device you want to use with older programs.</p>
    <div class="game-controller-preferred"><img src="assets/xp/icons/GameControllers.png" alt=""><label>Preferred device:<select><option>(none)</option></select></label></div>`;
  XPDialogs.addButtonRow(dialog, XPDialogs.BUTTON_SETS.okCancel);
};

const openAddGameController = (onAdd) => {
  const dialog = XPDialogs.createDialog({ title: "Add Game Controller" });
  dialog.el.classList.add("add-game-controller-dialog");
  Object.assign(dialog.el.style, {
    position: "fixed",
    left: `${Math.min(28, Math.max(4, window.innerWidth - 404))}px`,
    top: `${Math.min(80, Math.max(4, window.innerHeight - 356))}px`,
  });
  addDialogHelpButton(dialog);
  const controllerTypes = [
    "2-axis, 2-button joystick",
    "2-axis, 4-button joystick",
    "2-button flight yoke",
    "2-button flight yoke w/throttle",
    "2-button gamepad",
    "3-axis, 2-button joystick",
    "3-axis, 4-button joystick",
    "3-axis, 4-button flight yoke",
    "3-axis, 4-button flight yoke w/throttle",
    "4-button gamepad",
  ];
  dialog.body.innerHTML = `
    <div class="add-game-controller-intro"><img src="assets/xp/icons/GameControllers.png" alt=""><p>Select a game controller from the list below, and then click OK. If<br>your game controller does not appear in the list, click Custom.</p></div>
    <label class="game-controller-types">Game controllers:<select size="7">${controllerTypes.map((type) => `<option>${type}</option>`).join("")}</select></label>
    <label class="game-controller-rudders"><input type="checkbox"> Enable rudders and pedals</label>
    <button type="button" class="xp-btn game-controller-custom">Custom...</button>
    <hr>`;
  const select = dialog.body.querySelector("select");
  select.selectedIndex = 0;
  dialog.body
    .querySelector(".game-controller-custom")
    .addEventListener("click", () =>
      XPDialogs.alert(
        "Custom game controllers can be configured after compatible hardware is connected.",
        "Custom Game Controller",
      ),
    );
  XPDialogs.addButtonRow(dialog, XPDialogs.BUTTON_SETS.okCancel);
  dialog.onResult((result) => {
    if (result === "ok") onAdd(select.value);
  });
};

const openGameControllers = () => {
  const dialog = XPDialogs.createDialog({ title: "Game Controllers" });
  dialog.el.classList.add("game-controllers-dialog");
  Object.assign(dialog.el.style, {
    position: "fixed",
    left: `${Math.min(25, Math.max(4, window.innerWidth - 383))}px`,
    top: `${Math.min(51, Math.max(4, window.innerHeight - 369))}px`,
  });
  addDialogHelpButton(dialog);
  dialog.body.innerHTML = `
    <div class="game-controllers-intro"><img src="assets/xp/icons/GameControllers.png" alt=""><p>These settings help you configure the game controllers installed on<br>your computer.</p></div>
    <fieldset><legend>Installed game controllers</legend><div class="game-controller-list" role="listbox" tabindex="0"><div class="game-controller-list-header"><span>Controller</span><span>Status</span></div><div class="game-controller-list-items"></div></div><div class="game-controller-actions"><button type="button" class="xp-btn" data-game-controller-action="add">Add...</button><button type="button" class="xp-btn" data-game-controller-action="remove" disabled>Remove</button><button type="button" class="xp-btn" data-game-controller-action="properties" disabled>Properties</button></div></fieldset>
    <div class="game-controller-secondary"><button type="button" class="xp-btn" data-game-controller-action="advanced">Advanced...</button><button type="button" class="xp-btn" data-game-controller-action="troubleshoot">Troubleshoot...</button></div>`;
  const items = dialog.body.querySelector(".game-controller-list-items");
  const remove = dialog.body.querySelector(
    '[data-game-controller-action="remove"]',
  );
  const properties = dialog.body.querySelector(
    '[data-game-controller-action="properties"]',
  );
  let selected = null;
  const addController = (name) => {
    const item = document.createElement("button");
    item.type = "button";
    item.innerHTML = `<span>${name}</span><span>OK</span>`;
    item.addEventListener("click", () => {
      items
        .querySelectorAll("button")
        .forEach((entry) =>
          entry.setAttribute("aria-selected", String(entry === item)),
        );
      selected = item;
      remove.disabled = false;
      properties.disabled = false;
    });
    items.appendChild(item);
    item.click();
  };
  dialog.body.addEventListener("click", (event) => {
    const action = event.target.closest("[data-game-controller-action]")
      ?.dataset.gameControllerAction;
    if (action === "add") openAddGameController(addController);
    if (action === "advanced") openAdvancedGameControllerSettings();
    if (action === "troubleshoot") openHelpAndSupport();
    if (action === "remove" && selected) {
      selected.remove();
      selected = null;
      remove.disabled = true;
      properties.disabled = true;
    }
    if (action === "properties" && selected) {
      XPDialogs.alert(
        "This game controller is connected and working properly.",
        "Game Controller Properties",
      );
    }
  });
  XPDialogs.addButtonRow(dialog, XPDialogs.BUTTON_SETS.ok);
};

const openPowerOptions = (initialTab = "power-schemes") => {
  const dialog = XPDialogs.createDialog({ title: "Power Options Properties" });
  dialog.el.classList.add("power-options-dialog");
  Object.assign(dialog.el.style, {
    position: "fixed",
    left: `${Math.min(22, Math.max(4, window.innerWidth - 404))}px`,
    top: `${Math.min(30, Math.max(4, window.innerHeight - 454))}px`,
  });
  addDialogHelpButton(dialog);
  const select = (options, selected) =>
    `<select>${options.map((option) => `<option${option === selected ? " selected" : ""}>${option}</option>`).join("")}</select>`;
  const timeOptions = [
    "After 1 min",
    "After 5 mins",
    "After 10 mins",
    "After 20 mins",
    "After 30 mins",
    "After 45 mins",
    "After 1 hour",
    "Never",
  ];
  dialog.body.innerHTML = `
    <div class="power-options-tabs" role="tablist"><button type="button" role="tab" data-power-tab="power-schemes">Power Schemes</button><button type="button" role="tab" data-power-tab="advanced">Advanced</button><button type="button" role="tab" data-power-tab="hibernate">Hibernate</button><button type="button" role="tab" data-power-tab="ups">UPS</button></div>
    <div class="power-options-panels">
      <section class="power-schemes-panel" data-power-panel="power-schemes"><div class="power-options-intro"><img src="assets/xp/icons/PowerOptions.png" alt=""><p>Select the power scheme with the most appropriate settings for<br>this computer. Note that changing the settings below will modify<br>the selected scheme.</p></div><fieldset class="power-scheme-picker"><legend>Power schemes</legend>${select(["Home/Office Desk", "Portable/Laptop", "Presentation", "Always On", "Minimal Power Management", "Max Battery"], "Home/Office Desk")}<div><button class="xp-btn">Save As...</button><button class="xp-btn">Delete</button></div></fieldset><fieldset class="power-scheme-settings"><legend>Settings for Home/Office Desk power scheme</legend><label>Turn off monitor:${select(timeOptions, "After 20 mins")}</label><label>Turn off hard disks:${select(timeOptions, "Never")}</label><hr><label>System standby:${select(timeOptions, "Never")}</label><label>System hibernates:${select(timeOptions, "Never")}</label></fieldset></section>
      <section class="power-advanced-panel" data-power-panel="advanced" hidden><div class="power-options-intro"><img src="assets/xp/icons/PowerOptions.png" alt=""><p>Select the power-saving settings you want to use.</p></div><fieldset><legend>Options</legend><label><input type="checkbox"> Always show icon on the taskbar</label><label><input type="checkbox" checked> Prompt for password when computer resumes from standby</label></fieldset><fieldset class="power-buttons-field"><legend>Power buttons</legend><label>When I press the power button on my computer:${select(["Do nothing", "Ask me what to do", "Stand by", "Shut down"], "Shut down")}</label></fieldset></section>
      <section class="power-hibernate-panel" data-power-panel="hibernate" hidden><div class="power-hibernate-intro"><img src="assets/xp/icons/PowerHibernate.png" alt=""><p>When your computer hibernates, it stores whatever it has in<br>memory on your hard disk and then shuts down. When your<br>computer comes out of hibernation, it returns to its previous state.</p></div><fieldset><legend>Hibernate</legend><label><input type="checkbox" checked> Enable hibernation</label></fieldset><fieldset><legend>Disk space for hibernation</legend><p>Free disk space: <span>5,682 MB</span></p><p>Disk space required to hibernate: <span>512 MB</span></p></fieldset></section>
      <section class="power-ups-panel" data-power-panel="ups" hidden><h2>Uninterruptible Power Supply</h2><fieldset class="power-ups-status"><legend>Status</legend><img src="assets/xp/icons/PowerUpsStatus.png" alt=""><div><p>Current power source:</p><p>Estimated UPS runtime:</p><p>Estimated UPS capacity:</p><p>Battery condition:</p></div></fieldset><fieldset class="power-ups-details"><legend>Details</legend><img src="assets/xp/icons/PowerUpsDetails.png" alt=""><p>Manufacturer: <span>(None)</span><br>Model:</p><div><button class="xp-btn" disabled>Configure...</button><button class="xp-btn">Select...</button></div></fieldset><div class="power-ups-warning"><img src="assets/xp/icons/SystemWarning.png" alt=""><p>The UPS service is currently stopped.</p></div><button class="xp-btn power-ups-about">About...</button></section>
    </div>`;
  const activate = (tab) => {
    dialog.body
      .querySelectorAll("[data-power-tab]")
      .forEach((button) =>
        button.setAttribute(
          "aria-selected",
          String(button.dataset.powerTab === tab),
        ),
      );
    dialog.body.querySelectorAll("[data-power-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.powerPanel !== tab;
    });
  };
  dialog.body.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-power-tab]")?.dataset.powerTab;
    if (tab) activate(tab);
  });
  XPDialogs.addButtonRow(dialog, [
    { id: "ok", label: "OK", isDefault: true },
    { id: "cancel", label: "Cancel", isCancel: true },
    { id: "apply", label: "Apply" },
  ]);
  dialog.body.lastElementChild.classList.add("power-options-buttons");
  const apply = dialog.body.querySelector('[data-action="apply"]');
  apply.disabled = true;
  dialog.body.addEventListener("change", () => {
    apply.disabled = false;
  });
  activate(initialTab);
};

const openRegionalLanguageOptions = (initialTab = "regional-options") => {
  const dialog = XPDialogs.createDialog({
    title: "Regional and Language Options",
  });
  dialog.el.classList.add("regional-language-dialog");
  Object.assign(dialog.el.style, {
    position: "fixed",
    left: `${Math.min(44, Math.max(4, window.innerWidth - 404))}px`,
    top: `${Math.min(58, Math.max(4, window.innerHeight - 484))}px`,
  });
  addDialogHelpButton(dialog);
  dialog.body.innerHTML = `
    <div class="regional-language-tabs" role="tablist"><button type="button" role="tab" data-regional-tab="regional-options">Regional Options</button><button type="button" role="tab" data-regional-tab="languages">Languages</button><button type="button" role="tab" data-regional-tab="advanced">Advanced</button></div>
    <div class="regional-language-panels">
      <section class="regional-options-panel" data-regional-panel="regional-options"><fieldset class="regional-formats"><legend>Standards and formats</legend><p>This option affects how some programs format numbers, currencies,<br>dates, and time.</p><p>Select an item to match its preferences, or click Customize to choose<br>your own formats:</p><div class="regional-format-select"><select><option>English (United States)</option></select><button class="xp-btn">Customize...</button></div><p>Samples</p><div class="regional-samples"><label>Number:<input readonly value="123,456,789.00"></label><label>Currency:<input readonly value="$123,456,789.00"></label><label>Time:<input readonly value="3:22:38 AM"></label><label>Short date:<input readonly value="8/2/2026"></label><label>Long date:<input readonly value="Sunday, August 02, 2026"></label></div></fieldset><fieldset class="regional-location"><legend>Location</legend><p>To help services provide you with local information, such as news and<br>weather, select your present location:</p><select><option>United States</option></select></fieldset></section>
      <section class="regional-languages-panel" data-regional-panel="languages" hidden><fieldset><legend>Text services and input languages</legend><p>To view or change the languages and methods you can use to enter<br>text, click Details.</p><button class="xp-btn">Details...</button></fieldset><fieldset><legend>Supplemental language support</legend><p>Most languages are installed by default. To install additional languages,<br>select the appropriate check box below.</p><label><input type="checkbox"> Install files for complex script and right-to-left languages (including<br><span>Thai)</span></label><label><input type="checkbox"> Install files for East Asian languages</label></fieldset></section>
      <section class="regional-advanced-panel" data-regional-panel="advanced" hidden><fieldset><legend>Language for non-Unicode programs</legend><p>This system setting enables non-Unicode programs to display menus<br>and dialogs in their native language. It does not affect Unicode<br>programs, but it does apply to all users of this computer.</p><p>Select a language to match the language version of the non-Unicode<br>programs you want to use:</p><select><option>English (United States)</option></select></fieldset><fieldset><legend>Code page conversion tables</legend><div class="regional-code-pages">${["10000 (MAC - Roman)", "10001 (MAC - Japanese)", "10002 (MAC - Traditional Chinese Big5)", "10003 (MAC - Korean)", "10004 (MAC - Arabic)", "10005 (MAC - Hebrew)"].map((label, index) => `<label><input type="checkbox" ${index === 0 ? "checked disabled" : ""}> ${label}</label>`).join("")}</div></fieldset><fieldset><legend>Default user account settings</legend><label><input type="checkbox"> Apply all settings to the current user account and to the default<br><span>user profile</span></label></fieldset></section>
    </div>`;
  const activate = (tab) => {
    dialog.body
      .querySelectorAll("[data-regional-tab]")
      .forEach((button) =>
        button.setAttribute(
          "aria-selected",
          String(button.dataset.regionalTab === tab),
        ),
      );
    dialog.body.querySelectorAll("[data-regional-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.regionalPanel !== tab;
    });
  };
  dialog.body.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-regional-tab]")?.dataset
      .regionalTab;
    if (tab) activate(tab);
  });
  XPDialogs.addButtonRow(dialog, [
    { id: "ok", label: "OK", isDefault: true },
    { id: "cancel", label: "Cancel", isCancel: true },
    { id: "apply", label: "Apply" },
  ]);
  dialog.body.lastElementChild.classList.add("regional-language-buttons");
  const apply = dialog.body.querySelector('[data-action="apply"]');
  apply.disabled = true;
  dialog.body.addEventListener("change", () => {
    apply.disabled = false;
  });
  activate(initialTab);
};

const openMouseProperties = (initialTab = "buttons") => {
  const dialog = XPDialogs.createDialog({ title: "Mouse Properties" });
  dialog.el.classList.add("mouse-properties-dialog");
  Object.assign(dialog.el.style, {
    position: "fixed",
    left: `${Math.min(88, Math.max(4, window.innerWidth - 404))}px`,
    top: `${Math.min(117, Math.max(4, window.innerHeight - 454))}px`,
  });
  const help = document.createElement("button");
  help.type = "button";
  help.className = "tb-btn help-btn";
  help.setAttribute("aria-label", "Help");
  help.addEventListener("click", openHelpAndSupport);
  dialog.el.querySelector(".title-buttons").prepend(help);
  const tabs = ["Buttons", "Pointers", "Pointer Options", "Wheel", "Hardware"];
  dialog.body.innerHTML = `
    <div class="mouse-properties-tabs" role="tablist">${tabs.map((tab) => `<button type="button" role="tab" data-mouse-tab="${tab.toLowerCase().replace(" ", "-")}">${tab}</button>`).join("")}</div>
    <div class="mouse-properties-panels">
      <section data-mouse-panel="buttons">
        <fieldset class="mouse-buttons-configuration"><legend>Button configuration</legend><label><input type="checkbox"> Switch primary and secondary buttons</label><p>Select this check box to make the button on the<br>right the one you use for primary functions such<br>as selecting and dragging.</p><img src="assets/xp/system/MouseButtonConfiguration.png" alt=""></fieldset>
        <fieldset class="mouse-double-click"><legend>Double-click speed</legend><p>Double-click the folder to test your setting. If the<br>folder does not open or close, try using a slower<br>setting.</p><label>Speed: <span>Slow</span><input type="range" min="0" max="10" value="5"><span>Fast</span></label><button type="button" aria-label="Test double-click"><img src="assets/xp/system/MouseDoubleClickFolder.png" alt=""></button></fieldset>
        <fieldset class="mouse-click-lock"><legend>ClickLock</legend><label><input type="checkbox"> Turn on ClickLock</label><button class="xp-btn" disabled>Settings...</button><p>Enables you to highlight or drag without holding down the mouse<br>button. To set, briefly press the mouse button. To release, click the<br>mouse button again.</p></fieldset>
      </section>
      <section data-mouse-panel="pointers"><fieldset class="mouse-scheme"><legend>Scheme</legend><select><option>Windows Default (system scheme)</option></select><button class="xp-btn">Save As...</button><button class="xp-btn" disabled>Delete</button></fieldset><div class="mouse-pointer-preview"><img src="assets/xp/system/cursors/NormalSelect.png" alt=""></div><p class="mouse-customize-label">Customize:</p><div class="mouse-pointer-list" role="listbox"><span class="selected">Normal Select <img src="assets/xp/system/cursors/NormalSelect.png" alt=""></span><span>Help Select <img src="assets/xp/system/cursors/HelpSelect.png" alt=""></span><span>Working In Background <img src="assets/xp/system/cursors/WorkingInBackground.png" alt=""></span><span>Busy <img src="assets/xp/system/cursors/Busy.png" alt=""></span><span>Precision Select <img src="assets/xp/system/cursors/PrecisionSelect.png" alt=""></span><span>Text Select <img src="assets/xp/system/cursors/TextSelect.png" alt=""></span><span>Handwriting <img src="assets/xp/system/cursors/Handwriting.png" alt=""></span><span>Unavailable <img src="assets/xp/system/cursors/Unavailable.png" alt=""></span></div><label class="mouse-pointer-shadow"><input type="checkbox" checked> Enable pointer shadow</label><button class="xp-btn mouse-pointer-default" disabled>Use Default</button><button class="xp-btn mouse-pointer-browse">Browse...</button></section>
      <section data-mouse-panel="pointer-options" hidden><fieldset class="mouse-motion"><legend>Motion</legend><img src="assets/xp/system/MouseMotion.png" alt=""><p>Select a pointer speed:</p><label><span>Slow</span><input type="range" min="0" max="10" value="5"><span>Fast</span></label><label><input type="checkbox" checked> Enhance pointer precision</label></fieldset><fieldset class="mouse-snap"><legend>Snap To</legend><img src="assets/xp/system/MouseSnapTo.png" alt=""><label><input type="checkbox"> Automatically move pointer to the default button in a<br>dialog box</label></fieldset><fieldset class="mouse-visibility"><legend>Visibility</legend><label><img src="assets/xp/system/MouseTrails.png" alt=""><input type="checkbox"> Display pointer trails</label><div><span>Short</span><input type="range" min="0" max="10" value="8" disabled><span>Long</span></div><label><img src="assets/xp/system/MouseHideWhileTyping.png" alt=""><input type="checkbox" checked> Hide pointer while typing</label><label><img src="assets/xp/system/MouseLocate.png" alt=""><input type="checkbox"> Show location of pointer when I press the CTRL key</label></fieldset></section>
      <section data-mouse-panel="wheel" hidden><fieldset class="mouse-wheel-scroll"><legend>Scrolling</legend><img src="assets/xp/system/MouseWheel.png" alt=""><p>Roll the wheel one notch to scroll:</p><label><input type="radio" name="wheel-scroll" checked> The following number of lines at a time:</label><input type="number" value="3" min="1"><label><input type="radio" name="wheel-scroll"> One screen at a time</label></fieldset></section>
      <section data-mouse-panel="hardware" hidden><p class="mouse-devices-label">Devices:</p><div class="mouse-hardware-list" role="listbox"><strong><span>Name</span><span>Type</span></strong><span class="selected"><img src="assets/xp/system/MouseDevice.png" alt="">PS/2 Compatible Mouse <i>Mouse and other pointing devices</i></span><span><img src="assets/xp/system/MouseDevice.png" alt="">HID-compliant mouse <i>Mouse and other pointing devices</i></span></div><fieldset class="mouse-device-properties"><legend>Device Properties</legend><p>Manufacturer: Microsoft</p><p>Location: plugged into PS/2 mouse port</p><p>Device Status: This device is working properly.</p><button class="xp-btn">Troubleshoot...</button><button class="xp-btn">Properties</button></fieldset></section>
    </div>`;
  const activate = (tab) => {
    dialog.body
      .querySelectorAll("[data-mouse-tab]")
      .forEach((button) =>
        button.setAttribute(
          "aria-selected",
          String(button.dataset.mouseTab === tab),
        ),
      );
    dialog.body.querySelectorAll("[data-mouse-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.mousePanel !== tab;
    });
  };
  dialog.body.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-mouse-tab]")?.dataset.mouseTab;
    if (tab) activate(tab);
  });
  XPDialogs.addButtonRow(dialog, [
    { id: "ok", label: "OK", isDefault: true },
    { id: "cancel", label: "Cancel", isCancel: true },
    { id: "apply", label: "Apply" },
  ]);
  dialog.body.lastElementChild.classList.add("mouse-properties-buttons");
  dialog.body.querySelector('[data-action="apply"]').disabled = true;
  activate(initialTab);
};

const openInternetProperties = (initialTab = "general") => {
  const dialog = XPDialogs.createDialog({ title: "Internet Properties" });
  dialog.el.classList.add("internet-properties-dialog");
  Object.assign(dialog.el.style, {
    position: "fixed",
    left: `${Math.min(44, Math.max(4, window.innerWidth - 404))}px`,
    top: `${Math.min(58, Math.max(4, window.innerHeight - 458))}px`,
  });
  const help = document.createElement("button");
  help.type = "button";
  help.className = "tb-btn help-btn";
  help.setAttribute("aria-label", "Help");
  help.addEventListener("click", openHelpAndSupport);
  dialog.el.querySelector(".title-buttons").prepend(help);
  const tabs = [
    "General",
    "Security",
    "Privacy",
    "Content",
    "Connections",
    "Programs",
    "Advanced",
  ];
  dialog.body.innerHTML = `
    <div class="internet-properties-tabs" role="tablist">${tabs.map((tab) => `<button type="button" role="tab" data-internet-tab="${tab.toLowerCase()}">${tab}</button>`).join("")}</div>
    <div class="internet-properties-panels">
      <section data-internet-panel="general">
        <fieldset><legend>Home page</legend><img src="assets/xp/system/InternetHomePage.png" alt=""><p>You can change which page to use for your home page.</p><label>Address: <input type="text" value="isapi/redir.dll?prd=ie&amp;pver=6&amp;ar=msnhome"></label><div><button class="xp-btn" disabled>Use Current</button><button class="xp-btn">Use Default</button><button class="xp-btn">Use Blank</button></div></fieldset>
        <fieldset><legend>Temporary Internet files</legend><img src="assets/xp/system/TemporaryInternetFiles.png" alt=""><p>Pages you view on the Internet are stored in a special folder<br>for quick viewing later.</p><div><button class="xp-btn">Delete Cookies...</button><button class="xp-btn">Delete Files...</button><button class="xp-btn">Settings...</button></div></fieldset>
        <fieldset><legend>History</legend><img src="assets/xp/system/InternetHistory.png" alt=""><p>The History folder contains links to pages you've visited, for<br>quick access to recently viewed pages.</p><label>Days to keep pages in history: <input type="number" value="20" min="0"></label><button class="xp-btn">Clear History</button></fieldset>
        <div class="internet-general-actions"><button class="xp-btn">Colors...</button><button class="xp-btn">Fonts...</button><button class="xp-btn">Languages...</button><button class="xp-btn">Accessibility...</button></div>
      </section>
      <section data-internet-panel="security" hidden><p class="internet-security-intro">Select a Web content zone to specify its security settings.</p><div class="internet-zone-list">${[
        ["Internet", "assets/xp/system/InternetZone.png"],
        ["Local intranet", "assets/xp/system/LocalIntranetZone.png"],
        ["Trusted sites", "assets/xp/system/TrustedSitesZone.png"],
        ["Restricted sites", "assets/xp/system/RestrictedSitesZone.png"],
      ]
        .map(
          ([label, icon], index) =>
            `<button class="${index === 0 ? "selected" : ""}"><img src="${icon}" alt=""><span>${label}</span></button>`,
        )
        .join(
          "",
        )}</div><div class="internet-zone-description"><img src="assets/xp/system/InternetZone.png" alt=""><strong>Internet</strong><p>This zone contains all Web sites you<br>haven't placed in other zones.</p><button class="xp-btn" disabled>Sites...</button></div><fieldset class="internet-security-level"><legend>Security level for this zone</legend><strong>Custom</strong><p>Custom settings.<br>· To change the settings, click Custom Level.<br>· To use the recommended settings, click Default Level.</p><button class="xp-btn">Custom Level...</button><button class="xp-btn">Default Level</button></fieldset></section>
      <section data-internet-panel="privacy" hidden><fieldset class="internet-privacy-settings"><legend>Settings</legend><img src="assets/xp/system/PrivacySettings.png" alt=""><p>Move the slider to select a privacy setting for the Internet<br>zone.</p><div class="internet-privacy-scale"><input type="range" min="0" max="5" value="2"><i aria-hidden="true"></i></div><strong>Medium</strong><ul><li>Blocks third-party cookies that do not have a compact<br>privacy policy</li><li>Blocks third-party cookies that use personally identifiable<br>information without your implicit consent</li><li>Restricts first-party cookies that use personally identifiable<br>information without implicit consent</li></ul><div><button class="xp-btn">Sites...</button><button class="xp-btn">Import...</button><button class="xp-btn">Advanced...</button><button class="xp-btn" disabled>Default</button></div></fieldset><fieldset class="internet-popup-settings"><legend>Pop-up Blocker</legend><img src="assets/xp/system/PopUpBlocker.png" alt=""><p>Prevent most pop-up windows from appearing.</p><label><input type="checkbox" checked> Block pop-ups</label><button class="xp-btn">Settings...</button></fieldset></section>
      <section data-internet-panel="content" hidden><fieldset><legend>Content Advisor</legend><img src="assets/xp/system/TrustedSitesZone.png" alt=""><p>Ratings help you control the Internet content that can be<br>viewed on this computer.</p><button class="xp-btn">Enable...</button><button class="xp-btn" disabled>Settings...</button></fieldset><fieldset><legend>Certificates</legend><img src="assets/xp/system/PrivacySettings.png" alt=""><p>Use certificates to positively identify yourself, certification<br>authorities, and publishers.</p><button class="xp-btn">Clear SSL State</button><button class="xp-btn">Certificates...</button><button class="xp-btn">Publishers...</button></fieldset><fieldset><legend>Personal information</legend><img src="assets/xp/icons/RecentDocuments.png" alt=""><p>AutoComplete stores previous entries<br>and suggests matches for you.</p><button class="xp-btn">AutoComplete...</button><p>Microsoft Profile Assistant stores your<br>personal information.</p><button class="xp-btn">My Profile...</button></fieldset></section>
      <section data-internet-panel="connections" hidden><div class="internet-setup-copy"><img src="assets/xp/system/LocalIntranetZone.png" alt=""><p>To set up an Internet connection, click<br>Setup.</p><button class="xp-btn">Setup...</button></div><fieldset class="internet-dialup-settings"><legend>Dial-up and Virtual Private Network settings</legend><div class="internet-connection-list"></div><button class="xp-btn">Add...</button><button class="xp-btn" disabled>Remove</button><button class="xp-btn" disabled>Settings...</button><p>Choose Settings if you need to configure a proxy<br>server for a connection.</p><label><input type="radio" disabled> Never dial a connection</label><label><input type="radio" disabled> Dial whenever a network connection is not present</label><label><input type="radio" disabled> Always dial my default connection</label><span>Current: <i>None</i></span><button class="xp-btn" disabled>Set Default</button></fieldset><fieldset class="internet-lan-settings"><legend>Local Area Network (LAN) settings</legend><p>LAN Settings do not apply to dial-up connections.<br>Choose Settings above for dial-up settings.</p><button class="xp-btn">LAN Settings...</button></fieldset></section>
      <section data-internet-panel="programs" hidden><fieldset><legend>Internet programs</legend><img src="assets/xp/system/InternetPrograms.png" alt=""><p>You can specify which program Windows automatically uses<br>for each Internet service.</p>${[
        ["HTML editor:", ""],
        ["E-mail:", "Outlook Express"],
        ["Newsgroups:", "Outlook Express"],
        ["Internet call:", "NetMeeting"],
        ["Calendar:", ""],
        ["Contact list:", "Address Book"],
      ]
        .map(
          ([label, value]) =>
            `<label>${label}<select><option>${value}</option></select></label>`,
        )
        .join(
          "",
        )}</fieldset><div class="internet-program-actions"><button class="xp-btn">Reset Web Settings...</button><p>You can reset Internet Explorer to the default<br>home and search pages.</p><button class="xp-btn">Manage Add-ons...</button><p>Enable or disable browser add-ons installed on<br>your computer.</p><label><input type="checkbox" checked> Internet Explorer should check to see whether it is the default browser</label></div></section>
      <section data-internet-panel="advanced" hidden><p>Settings:</p><div class="internet-advanced-list"><strong>🌐 Accessibility</strong>${["Always expand ALT text for images", "Move system caret with focus/selection changes"].map((label) => `<label><input type="checkbox"> ${label}</label>`).join("")}<strong>▣ Browsing</strong>${["Always send URLs as UTF-8 (requires restart)", "Automatically check for Internet Explorer updates", "Close unused folders in History and Favorites (requires restart)", "Disable Script Debugging (Internet Explorer)", "Disable Script Debugging (Other)", "Display a notification about every script error", "Enable folder view for FTP sites", "Enable Install On Demand (Internet Explorer)", "Enable Install On Demand (Other)", "Enable offline items to be synchronized on a schedule", "Enable page transitions", "Enable Personalized Favorites Menu"].map((label, index) => `<label><input type="checkbox" ${[0, 2, 3, 4, 6, 8, 9, 10].includes(index) ? "checked" : ""}> ${label}</label>`).join("")}</div><button class="xp-btn internet-restore-defaults">Restore Defaults</button></section>
    </div>`;
  const activate = (tab) => {
    dialog.body
      .querySelectorAll("[data-internet-tab]")
      .forEach((button) =>
        button.setAttribute(
          "aria-selected",
          String(button.dataset.internetTab === tab),
        ),
      );
    dialog.body.querySelectorAll("[data-internet-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.internetPanel !== tab;
    });
  };
  dialog.body.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-internet-tab]")?.dataset
      .internetTab;
    if (tab) activate(tab);
  });
  XPDialogs.addButtonRow(dialog, [
    { id: "ok", label: "OK", isDefault: true },
    { id: "cancel", label: "Cancel", isCancel: true },
    { id: "apply", label: "Apply" },
  ]);
  dialog.body.lastElementChild.classList.add("internet-properties-buttons");
  dialog.body.querySelector('[data-action="apply"]').disabled = true;
  activate(initialTab);
};

const openFolderOptions = () => {
  const dialog = XPDialogs.createDialog({ title: "Folder Options" });
  dialog.el.classList.add("folder-options-dialog");
  const parentRect = openWindows
    .get("__control-panel")
    ?.el.getBoundingClientRect();
  if (parentRect) {
    Object.assign(dialog.el.style, {
      position: "fixed",
      left: `${parentRect.left}px`,
      top: `${parentRect.top}px`,
    });
  }
  const help = document.createElement("button");
  help.type = "button";
  help.className = "tb-btn help-btn";
  help.title = "Help";
  help.setAttribute("aria-label", "Help");
  help.addEventListener("click", openHelpAndSupport);
  dialog.el.querySelector(".title-buttons").prepend(help);
  dialog.body.innerHTML = `
    <div class="folder-options-tabs" role="tablist" aria-label="Folder Options">
      <button type="button" role="tab" data-folder-options-tab="general" aria-selected="true">General</button>
      <button type="button" role="tab" data-folder-options-tab="view" aria-selected="false" tabindex="-1">View</button>
      <button type="button" role="tab" data-folder-options-tab="file-types" aria-selected="false" tabindex="-1">File Types</button>
      <button type="button" role="tab" data-folder-options-tab="offline" aria-selected="false" tabindex="-1">Offline Files</button>
    </div>
    <div class="folder-options-panel" data-folder-options-panel="general">
      <fieldset><legend>Tasks</legend><img src="assets/xp/icons/FolderViewClassic.png" alt="">
        <label><input type="radio" name="folder-tasks" checked> Show common tasks in folders</label>
        <label><input type="radio" name="folder-tasks"> Use Windows classic folders</label>
      </fieldset>
      <fieldset><legend>Browse folders</legend><img src="assets/xp/system/FolderBrowse.png" alt="">
        <label><input type="radio" name="browse-folders" checked> Open each folder in the same window</label>
        <label><input type="radio" name="browse-folders"> Open each folder in its own window</label>
      </fieldset>
      <fieldset class="folder-click-options"><legend>Click items as follows</legend><img class="folder-click-illustration" src="assets/xp/system/FolderClickItems.png" alt="">
        <label><input type="radio" name="click-items"> Single-click to open an item (point to select)</label>
        <label class="folder-suboption"><input type="radio" name="underline-items" disabled> Underline icon titles consistent with my browser</label>
        <label class="folder-suboption"><input type="radio" name="underline-items" disabled> Underline icon titles only when I point at them</label>
        <label><input type="radio" name="click-items" checked> Double-click to open an item (single-click to select)</label>
      </fieldset>
      <button type="button" class="xp-btn folder-restore-defaults">Restore Defaults</button>
    </div>
    <div class="folder-options-panel folder-view-panel" data-folder-options-panel="view" hidden>
      <fieldset class="folder-views-group"><legend>Folder views</legend><img src="assets/xp/system/FolderViews.png" alt=""><p>You can apply the view (such as Details or Tiles) that<br>you are using for this folder to all folders.</p><button type="button" class="xp-btn" disabled>Apply to All Folders</button><button type="button" class="xp-btn">Reset All Folders</button></fieldset>
      <label class="folder-advanced-label">Advanced settings:</label>
      <div class="folder-advanced-list">
        <strong><img src="assets/xp/system/FolderTree.png" alt="">Files and Folders</strong>
        <label><input type="checkbox" checked> Automatically search for network folders and printers</label>
        <label><input type="checkbox" checked> Display file size information in folder tips</label>
        <label><input type="checkbox" checked> Display simple folder view in Explorer's Folders list</label>
        <label><input type="checkbox"> Display the contents of system folders</label>
        <label><input type="checkbox" checked> Display the full path in the address bar</label>
        <label><input type="checkbox"> Display the full path in the title bar</label>
        <label><input type="checkbox"> Do not cache thumbnails</label>
        <strong><img src="assets/xp/system/FolderTree.png" alt="">Hidden files and folders</strong>
        <label class="folder-indented"><input type="radio" name="hidden-files" checked> Do not show hidden files and folders</label>
        <label class="folder-indented"><input type="radio" name="hidden-files"> Show hidden files and folders</label>
        <label><input type="checkbox" checked> Hide extensions for known file types</label>
        <label><input type="checkbox" checked> Hide protected operating system files (Recommended)</label>
      </div>
      <button type="button" class="xp-btn folder-restore-defaults">Restore Defaults</button>
    </div>
    <div class="folder-options-panel folder-file-types-panel" data-folder-options-panel="file-types" hidden>
      <p>Registered file types:</p>
      <div class="folder-file-types-list" role="listbox" aria-label="Registered file types">
        <div class="folder-file-types-head"><span>Extensions</span><span>File Types</span></div>
        <button type="button" class="selected"><img src="assets/xp/icons/LocalDisk.png" alt=""><span>(NONE)</span><span>AudioCD</span></button>
        <button type="button"><img src="assets/xp/icons/LocalDisk.png" alt=""><span>(NONE)</span><span>Drive</span></button>
        <button type="button"><img src="assets/xp/icons/FolderOptions.png" alt=""><span>(NONE)</span><span>DVD</span></button>
        <button type="button"><img src="assets/xp/icons/SharedFolder.png" alt=""><span>(NONE)</span><span>File Folder</span></button>
        <button type="button"><img src="assets/xp/icons/FolderOptions.png" alt=""><span>(NONE)</span><span>Folder</span></button>
        <button type="button"><img src="assets/xp/icons/HelpAndSupport.png" alt=""><span>(NONE)</span><span>Help and Support Center protocol</span></button>
      </div>
      <button type="button" class="xp-btn folder-file-new">New</button><button type="button" class="xp-btn folder-file-delete" disabled>Delete</button>
      <fieldset class="folder-file-details"><legend>Details for 'AudioCD' file type</legend><label>Opens with:</label><button type="button" class="xp-btn" disabled>Change...</button><p>To change settings that affect all 'AudioCD' files, click Advanced.</p><button type="button" class="xp-btn">Advanced</button></fieldset>
    </div>
    <div class="folder-options-panel folder-offline-panel" data-folder-options-panel="offline" hidden>
      <img src="assets/xp/icons/OfflineFiles.png" alt=""><p>Use Offline Files to work with files and programs stored on the<br>network even when you are not connected.</p>
      <p>Fast User Switching is enabled on this computer. &nbsp;Offline Files<br>cannot be enabled while Fast User Switching is enabled.</p>
      <p>To change your Fast User Switching setting, open User Accounts<br>in Control Panel and select "Change the way users log on or off."</p>
    </div>
    <div class="dlg-buttons folder-options-buttons"></div>`;

  const tabs = [...dialog.body.querySelectorAll("[data-folder-options-tab]")];
  const panels = [
    ...dialog.body.querySelectorAll("[data-folder-options-panel]"),
  ];
  tabs.forEach((tab) =>
    tab.addEventListener("click", () => {
      tabs.forEach((entry) => {
        const selected =
          entry.dataset.folderOptionsTab === tab.dataset.folderOptionsTab;
        entry.setAttribute("aria-selected", String(selected));
        entry.tabIndex = selected ? 0 : -1;
      });
      panels.forEach((panel) => {
        panel.hidden =
          panel.dataset.folderOptionsPanel !== tab.dataset.folderOptionsTab;
      });
    }),
  );
  const buttons = dialog.body.querySelector(".folder-options-buttons");
  const apply = XPDialogs.createDialogButton(
    { id: "apply", label: "Apply" },
    () => {
      apply.disabled = true;
    },
  );
  apply.disabled = true;
  const ok = XPDialogs.createDialogButton(
    { id: "ok", label: "OK", isDefault: true },
    () => {
      dialog.close("ok");
    },
  );
  const cancel = XPDialogs.createDialogButton(
    { id: "cancel", label: "Cancel", isCancel: true },
    () => dialog.close("cancel"),
  );
  dialog.defaultButton = ok;
  buttons.append(ok, cancel, apply);
  dialog.body.addEventListener("change", () => {
    apply.disabled = false;
  });
  dialog.body.querySelectorAll(".folder-restore-defaults").forEach((button) =>
    button.addEventListener("click", () => {
      dialog.body
        .querySelectorAll('input[type="checkbox"]')
        .forEach((input) => (input.checked = input.defaultChecked));
      dialog.body
        .querySelectorAll('input[type="radio"]')
        .forEach((input) => (input.checked = input.defaultChecked));
      apply.disabled = false;
    }),
  );
  dialog.body
    .querySelectorAll(".folder-file-types-list button")
    .forEach((button) =>
      button.addEventListener("click", () => {
        dialog.body
          .querySelectorAll(".folder-file-types-list button")
          .forEach((entry) =>
            entry.classList.toggle("selected", entry === button),
          );
      }),
    );
};

const getStartMenuStyle = () =>
  localStorage.getItem(START_MENU_STYLE_KEY) === "classic"
    ? "classic"
    : "start";

const applyStartMenuStyle = (style, persist = true) => {
  const normalized = style === "classic" ? "classic" : "start";
  document.documentElement.dataset.xpStartMenu = normalized;
  renderedPlacesStyle = null;
  if (persist) localStorage.setItem(START_MENU_STYLE_KEY, normalized);
  closeStartMenu();
};

const openTaskbarProperties = () => {
  const dialog = XPDialogs.createDialog({
    title: "Taskbar and Start Menu Properties",
  });
  dialog.el.classList.add("taskbar-properties-dialog");
  const help = document.createElement("button");
  help.type = "button";
  help.className = "tb-btn help-btn";
  help.title = "Help";
  help.setAttribute("aria-label", "Help");
  help.addEventListener("click", openHelpAndSupport);
  dialog.el.querySelector(".title-buttons").prepend(help);
  const currentStartMenuStyle = getStartMenuStyle();
  dialog.body.innerHTML = `
    <div class="taskbar-properties-tabs" role="tablist">
      <button type="button" role="tab" data-taskbar-properties-tab="taskbar" aria-selected="true">Taskbar</button>
      <button type="button" role="tab" data-taskbar-properties-tab="start-menu">Start Menu</button>
    </div>
    <div class="taskbar-properties-panel" data-taskbar-properties-panel="taskbar">
      <div class="taskbar-properties-group taskbar-appearance-group"><span class="taskbar-properties-legend">Taskbar appearance</span>
        <img class="taskbar-properties-preview" src="assets/xp/system/TaskbarPreview.png" alt="Taskbar preview">
        <label><input type="checkbox" data-taskbar-setting="locked" ${taskbarLocked ? "checked" : ""}> Lock the taskbar</label>
        <label><input type="checkbox" data-taskbar-setting="auto-hide"> Auto-hide the taskbar</label>
        <label><input type="checkbox" data-taskbar-setting="keep-on-top" checked> Keep the taskbar on top of other windows</label>
        <label><input type="checkbox" data-taskbar-setting="group" checked> Group similar taskbar buttons</label>
        <label><input type="checkbox" data-taskbar-setting="quick-launch"> Show Quick Launch</label>
      </div>
      <div class="taskbar-properties-group notification-area-group"><span class="taskbar-properties-legend">Notification area</span>
        <img class="taskbar-properties-preview" src="assets/xp/system/NotificationAreaPreview.png" alt="Notification area preview">
        <label><input type="checkbox" data-taskbar-setting="show-clock" checked> Show the clock</label>
        <p>You can keep the notification area uncluttered by hiding icons that you<br>have not clicked recently.</p>
        <label><input type="checkbox" data-taskbar-setting="hide-inactive" checked> Hide inactive icons</label>
        <button type="button" class="xp-btn">Customize...</button>
      </div>
    </div>
    <div class="taskbar-properties-panel taskbar-start-menu-panel" data-taskbar-properties-panel="start-menu" hidden>
      <img class="taskbar-start-menu-preview" src="assets/xp/system/StartMenuPreview.png" alt="Start menu preview">
      <label class="taskbar-start-menu-choice"><input type="radio" name="taskbar-start-menu-style" value="start" ${currentStartMenuStyle === "start" ? "checked" : ""}> Start menu</label>
      <p class="taskbar-start-menu-description">Select this menu style for easy access to the<br>Internet, e-mail, and your favorite programs.</p>
      <button type="button" class="xp-btn taskbar-start-customize" ${currentStartMenuStyle === "classic" ? "disabled" : ""}>Customize...</button>
      <label class="taskbar-classic-menu-choice"><input type="radio" name="taskbar-start-menu-style" value="classic" ${currentStartMenuStyle === "classic" ? "checked" : ""}> Classic Start menu</label>
      <p class="taskbar-classic-menu-description">Select this option to use the menu style from<br>earlier versions of Windows.</p>
      <button type="button" class="xp-btn taskbar-classic-customize" ${currentStartMenuStyle === "start" ? "disabled" : ""}>Customize...</button>
    </div>
    <div class="dlg-buttons taskbar-properties-buttons"></div>
  `;
  if (currentStartMenuStyle === "classic") {
    dialog.body.querySelector(".taskbar-start-menu-preview").src =
      "assets/xp/system/ClassicStartMenuPreview.png";
  }
  const tabs = [
    ...dialog.body.querySelectorAll("[data-taskbar-properties-tab]"),
  ];
  const panels = [
    ...dialog.body.querySelectorAll("[data-taskbar-properties-panel]"),
  ];
  tabs.forEach((tab) =>
    tab.addEventListener("click", () => {
      tabs.forEach((entry) =>
        entry.setAttribute(
          "aria-selected",
          String(
            entry.dataset.taskbarPropertiesTab ===
              tab.dataset.taskbarPropertiesTab,
          ),
        ),
      );
      panels.forEach((panel) => {
        panel.hidden =
          panel.dataset.taskbarPropertiesPanel !==
          tab.dataset.taskbarPropertiesTab;
      });
    }),
  );
  const buttonRow = dialog.body.querySelector(".taskbar-properties-buttons");
  const apply = XPDialogs.createDialogButton(
    { id: "apply", label: "Apply" },
    () => {
      setTaskbarLocked(
        dialog.body.querySelector('[data-taskbar-setting="locked"]').checked,
      );
      document.getElementById("taskbar-clock").hidden =
        !dialog.body.querySelector('[data-taskbar-setting="show-clock"]')
          .checked;
      applyStartMenuStyle(
        dialog.body.querySelector('[name="taskbar-start-menu-style"]:checked')
          .value,
      );
      apply.disabled = true;
    },
  );
  apply.disabled = true;
  const ok = XPDialogs.createDialogButton(
    { id: "ok", label: "OK", isDefault: true },
    () => {
      apply.click();
      dialog.close("ok");
    },
  );
  const cancel = XPDialogs.createDialogButton(
    { id: "cancel", label: "Cancel", isCancel: true },
    () => dialog.close("cancel"),
  );
  dialog.defaultButton = ok;
  buttonRow.append(ok, cancel, apply);
  dialog.body.addEventListener("change", (event) => {
    apply.disabled = false;
    if (event.target.name === "taskbar-start-menu-style") {
      const classic = event.target.value === "classic";
      dialog.body.querySelector(".taskbar-start-menu-preview").src = classic
        ? "assets/xp/system/ClassicStartMenuPreview.png"
        : "assets/xp/system/StartMenuPreview.png";
      dialog.body.querySelector(".taskbar-start-customize").disabled = classic;
      dialog.body.querySelector(".taskbar-classic-customize").disabled =
        !classic;
    }
  });
  dialog.body
    .querySelector(".notification-area-group .xp-btn")
    .addEventListener("click", () =>
      XPDialogs.alert(
        "Select which notification icons should be hidden when inactive.",
        "Customize Notifications",
        "info",
      ),
    );
  ok.focus();
};

let taskbarLocked = true;

const setTaskbarLocked = (locked) => {
  taskbarLocked = locked;
  const button = document.querySelector('[data-taskbar-action="lock"]');
  button.setAttribute("aria-checked", String(locked));
  button.querySelector(".context-check").textContent = locked ? "✓" : "";
};

const setupTaskbarContextMenu = () => {
  const taskbar = document.getElementById("taskbar");
  const menu = document.getElementById("taskbar-context-menu");
  const toolbarParent = document.getElementById("taskbar-toolbar-parent");
  const toolbarButton = toolbarParent.firstElementChild;
  const toolbarSubmenu = document.getElementById("taskbar-toolbar-submenu");
  wireTaskbarMenuKeyboard(menu);
  wireTaskbarMenuKeyboard(toolbarSubmenu);
  wireTaskbarMenuKeyboard(document.getElementById("taskbar-overflow-menu"));
  const openToolbarSubmenu = () => {
    toolbarParent.classList.add("open");
    toolbarButton.setAttribute("aria-expanded", "true");
    toolbarSubmenu.style.left = "calc(100% - 2px)";
    if (toolbarSubmenu.getBoundingClientRect().right > innerWidth)
      toolbarSubmenu.style.left = `${-toolbarSubmenu.offsetWidth + 5}px`;
  };
  const closeToolbarSubmenu = () => {
    toolbarParent.classList.remove("open");
    toolbarButton.setAttribute("aria-expanded", "false");
  };
  toolbarParent.addEventListener("pointerenter", openToolbarSubmenu);
  toolbarParent.addEventListener("pointerleave", closeToolbarSubmenu);
  toolbarButton.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight") return;
    event.preventDefault();
    event.stopPropagation();
    openToolbarSubmenu();
    toolbarSubmenu.querySelector("button")?.focus();
  });
  toolbarSubmenu.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft") return;
    event.preventDefault();
    event.stopPropagation();
    closeToolbarSubmenu();
    toolbarButton.focus();
  });
  toolbarSubmenu.addEventListener("click", closeTaskbarMenus);
  taskbar.addEventListener("contextmenu", (event) => {
    if (event.target.closest(".task-button, #tray-volume-popup")) return;
    event.preventDefault();
    closeWindowSystemMenu();
    closeTaskbarMenus();
    closeToolbarSubmenu();
    const canArrange = [...openWindows.values()].some((win) => !win.minimized);
    ["cascade", "tile-horizontal", "tile-vertical"].forEach((action) => {
      menu.querySelector(`[data-taskbar-action="${action}"]`).disabled =
        !canArrange;
    });
    positionTaskbarMenu(menu, event.clientX, event.clientY);
  });
  menu.addEventListener("click", (event) => {
    const action = event.target.closest("[data-taskbar-action]")?.dataset
      .taskbarAction;
    if (!action || event.target.closest("button")?.disabled) return;
    if (action === "toolbars") {
      openToolbarSubmenu();
      return;
    }
    closeTaskbarMenus();
    if (action === "show-desktop") toggleShowDesktop();
    else if (action === "cascade" || action.startsWith("tile-"))
      arrangeTaskbarWindows(action);
    else if (action === "task-manager") openTaskManager();
    else if (action === "lock") setTaskbarLocked(!taskbarLocked);
    else if (action === "properties") openTaskbarProperties();
  });
};

const CLOCK_OFFSET_KEY = "clockOffsetMs";

const getClockOffset = () => {
  const offset = parseInt(localStorage.getItem(CLOCK_OFFSET_KEY) || "0", 10);
  return Number.isFinite(offset) ? offset : 0;
};

const getShellTime = () => new Date(Date.now() + getClockOffset());

let updateClockDisplay = () => {};

const startClock = () => {
  const clock = document.getElementById("taskbar-clock");
  const update = () => {
    const now = getShellTime();
    clock.textContent = now.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    // XP tooltip: hovering the clock shows the full date.
    clock.title = now.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };
  updateClockDisplay = update;
  update();
  setInterval(update, 5000);
};
