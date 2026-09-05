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
  if (
    gameId === focusedGameId &&
    !win.minimized &&
    !win.nativeOwnedWindows?.size
  ) {
    minimizeWindow(gameId);
  } else {
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
  dialog.body.innerHTML = `
    <div class="task-manager-menu-bar" role="menubar">
      <button type="button" role="menuitem" data-task-manager-menu="file">File</button>

      <button type="button" role="menuitem" data-task-manager-menu="windows">Windows</button>
      <button type="button" role="menuitem" data-task-manager-menu="shutdown">Shut Down</button>
      <button type="button" role="menuitem" data-task-manager-menu="help">Help</button>
    </div>
    <div class="task-manager-menu-popup" data-task-manager-popup="file" role="menu" hidden><button role="menuitem" data-task-manager-action="new-task">New Task (Run...)</button><hr><button role="menuitem" data-task-manager-action="exit">Exit Task Manager</button></div>

    <div class="task-manager-menu-popup" data-task-manager-popup="windows" role="menu" hidden><button role="menuitem" data-task-manager-action="cascade">Cascade</button><button role="menuitem" data-task-manager-action="tile-horizontal">Tile Horizontally</button><button role="menuitem" data-task-manager-action="tile-vertical">Tile Vertically</button><hr></div>
    <div class="task-manager-menu-popup" data-task-manager-popup="shutdown" role="menu" hidden><hr><button role="menuitem" data-task-manager-action="turn-off">Turn Off</button><button role="menuitem" data-task-manager-action="restart">Restart</button><hr><button role="menuitem" data-task-manager-action="log-off">Log Off Administrator</button></div>
    <div class="task-manager-menu-popup" data-task-manager-popup="help" role="menu" hidden><hr><button role="menuitem" data-task-manager-action="about">About Task Manager</button></div>
    <div class="task-manager-tabs" role="tablist" aria-label="Windows Task Manager">
      <button type="button" role="tab" data-task-manager-tab="applications" aria-selected="true">Applications</button>

    </div>
    <div class="task-manager-panel task-manager-applications" data-task-manager-panel="applications">
      <div class="task-manager-list-head"><span>Task</span><span>Status</span></div>
      <div class="task-manager-app-list" role="listbox">${applicationRows}</div>
      <div class="task-manager-panel-buttons"><button type="button" class="xp-btn" data-task-manager-action="end-task">End Task</button><button type="button" class="xp-btn" data-task-manager-action="switch-to">Switch To</button><button type="button" class="xp-btn" data-task-manager-action="new-task">New Task...</button></div>
    </div>
`;

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
  dialog.body.addEventListener("click", async (event) => {
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
      if (await closeGameWindow(selectedWindow))
        dialog.body
          .querySelector(`[data-task-manager-window="${selectedWindow}"]`)
          ?.remove();
    } else if (action === "switch-to" && selectedWindow) {
      dialog.close("switch");
      restoreWindow(selectedWindow);
      focusWindow(selectedWindow);
    } else if (action === "about") openAboutWindows();
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
