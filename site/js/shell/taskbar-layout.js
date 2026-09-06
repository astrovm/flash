"use strict";

const TASKBAR_SETTINGS_KEY = "taskbarSettings";
const taskbarDefaults = {
  edge: "bottom",
  rows: 1,
  width: 106,
  locked: true,
  autoHide: false,
  onTop: true,
  group: true,
  quickLaunch: false,
  quickLaunchItems: ["__show-desktop"],
  desktopToolbar: false,
  folders: [],
  hideInactive: true,
  volumeBehavior: "auto",
};
const getTaskbarSettings = () => {
  const saved = readJsonStorage(
    TASKBAR_SETTINGS_KEY,
    {},
    (value) => value && typeof value === "object",
  );
  const settings = { ...taskbarDefaults, ...saved };
  if (!["bottom", "top", "left", "right"].includes(settings.edge))
    settings.edge = "bottom";
  settings.rows = Math.max(
    1,
    Math.min(100, Math.round(Number(settings.rows)) || 1),
  );
  settings.width = Math.max(99, Math.min(4096, Number(settings.width) || 106));
  settings.quickLaunchItems = Array.isArray(settings.quickLaunchItems)
    ? [
        ...new Set(
          settings.quickLaunchItems.filter((id) => typeof id === "string"),
        ),
      ]
    : ["__show-desktop"];
  settings.folders = Array.isArray(settings.folders)
    ? settings.folders.filter((id) => typeof id === "string")
    : [];
  return settings;
};
const saveTaskbarSettings = (changes) => {
  writeJsonStorage(TASKBAR_SETTINGS_KEY, {
    ...getTaskbarSettings(),
    ...changes,
  });
  applyTaskbarSettings();
};
let taskbarHideTimer;
let taskbarVolumeLastUsed = Date.now();
let taskbarTrayExpanded = false;

const revealTaskbar = () => {
  clearTimeout(taskbarHideTimer);
  document.getElementById("taskbar").classList.remove("auto-hidden");
};
const scheduleTaskbarHide = () => {
  clearTimeout(taskbarHideTimer);
  if (!getTaskbarSettings().autoHide) return;
  taskbarHideTimer = setTimeout(() => {
    const bar = document.getElementById("taskbar");
    if (
      bar.matches(":hover") ||
      (bar.contains(document.activeElement) &&
        document.activeElement.matches(":focus-visible")) ||
      [
        "start-menu",
        "taskbar-context-menu",
        "taskbar-overflow-menu",
        "tray-volume-popup",
        "tray-volume-menu",
      ].some((id) => !document.getElementById(id).hidden)
    ) {
      scheduleTaskbarHide();
      return;
    }
    bar.classList.add("auto-hidden");
  }, 500);
};

const layoutTaskbar = (monitor, left, top) => {
  const settings = getTaskbarSettings();
  const bar = document.getElementById("taskbar");
  const desktop = document.getElementById("desktop");
  const vertical = ["left", "right"].includes(settings.edge);
  const thickness = vertical
    ? Math.min(settings.width, monitor.width / 2)
    : Math.min(
        getTaskbarHeight() +
          (settings.locked ? 0 : 4) +
          (settings.rows - 1) * 26,
        monitor.height / 2,
      );
  const reserved = settings.autoHide ? 2 : settings.onTop ? thickness : 0;
  const inset = {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    [settings.edge]: reserved,
  };
  Object.assign(desktop.style, {
    left: `${left + inset.left}px`,
    top: `${top + inset.top}px`,
    right: "auto",
    bottom: "auto",
    width: `${monitor.width - inset.left - inset.right}px`,
    height: `${monitor.height - inset.top - inset.bottom}px`,
  });
  desktop.style.setProperty(
    "--desktop-taskbar-height",
    `${inset.top + inset.bottom}px`,
  );
  Object.assign(bar.style, {
    left: `${left + (settings.edge === "right" ? monitor.width - thickness : 0)}px`,
    top: `${top + (settings.edge === "bottom" ? monitor.height - thickness : 0)}px`,
    width: `${vertical ? thickness : monitor.width}px`,
    height: `${vertical ? monitor.height : thickness}px`,
    right: "auto",
    bottom: "auto",
    zIndex: settings.onTop || settings.autoHide ? "8000" : "90",
  });
  bar.dataset.edge = settings.edge;
  bar.style.setProperty("--taskbar-thickness", `${thickness}px`);
  bar.classList.toggle("vertical", vertical);
  bar.classList.toggle("unlocked", !settings.locked);
  if (!settings.autoHide) revealTaskbar();
};

const renderTrayVisibility = () => {
  const settings = getTaskbarSettings();
  const hidden =
    settings.hideInactive &&
    (settings.volumeBehavior === "hide" ||
      (settings.volumeBehavior === "auto" &&
        Date.now() - taskbarVolumeLastUsed >= 10 * 60 * 1000));
  const expand = document.getElementById("tray-expand");
  if (!expand) return;
  expand.hidden = !hidden;
  expand.textContent = taskbarTrayExpanded ? "›" : "‹";
  expand.setAttribute(
    "aria-label",
    taskbarTrayExpanded ? "Hide inactive icons" : "Show hidden icons",
  );
  expand.setAttribute("aria-expanded", String(taskbarTrayExpanded));
  document.getElementById("tray-volume-button").hidden =
    hidden && !taskbarTrayExpanded;
};

const openTaskbarFolderMenu = (folderId, anchor) => {
  const menu = document.getElementById("taskbar-overflow-menu");
  closeTaskbarMenus();
  menu.replaceChildren();
  const children =
    folderId === fs.DESKTOP
      ? [...document.querySelectorAll(".desktop-icon")].map((icon) => ({
          id: icon.dataset.desktopId,
          name: icon.getAttribute("aria-label") || icon.textContent.trim(),
        }))
      : fs.getChildren(folderId);
  for (const node of children) {
    const item = document.createElement("button");
    item.type = "button";
    item.setAttribute("role", "menuitem");
    item.textContent = node.name;
    item.addEventListener("click", () => {
      closeTaskbarMenus();
      openDesktopItem(node.id);
    });
    menu.append(item);
  }
  if (!children.length) {
    const empty = document.createElement("button");
    empty.textContent = "(Empty)";
    empty.disabled = true;
    menu.append(empty);
  }
  const rect = anchor.getBoundingClientRect();
  positionTaskbarMenu(menu, rect.left, rect.top);
};

const renderTaskbarToolbars = () => {
  const settings = getTaskbarSettings();
  const toolbars = document.getElementById("taskbar-toolbars");
  toolbars.replaceChildren();
  if (settings.quickLaunch) {
    const quickLaunch = document.createElement("div");
    quickLaunch.className = "quick-launch-toolbar";
    quickLaunch.setAttribute("aria-label", "Quick Launch");
    for (const id of settings.quickLaunchItems) {
      const node = fs.getNode(id);
      if (
        id !== "__show-desktop" &&
        !node &&
        !systemShortcuts[id] &&
        !gamesList[id]
      )
        continue;
      const button = document.createElement("button");
      button.className = "quick-launch-button";
      button.title =
        id === "__show-desktop"
          ? "Show Desktop"
          : node?.name || systemShortcuts[id]?.title || formatGameTitle(id);
      button.setAttribute("aria-label", button.title);
      const icon = document.createElement("img");
      const desktopIcon = [...document.querySelectorAll(".desktop-icon")]
        .find((entry) => entry.dataset.desktopId === id)
        ?.querySelector("img");
      icon.src =
        id === "__show-desktop"
          ? "assets/xp/icons/ShowDesktop.png"
          : desktopIcon?.src ||
            systemShortcuts[id]?.icon ||
            "assets/xp/icons/NewFolder.png";
      icon.alt = "";
      button.append(icon);
      button.addEventListener("click", () =>
        id === "__show-desktop" ? toggleShowDesktop() : openDesktopItem(id),
      );
      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeTaskbarMenus();
        const menu = document.getElementById("taskbar-overflow-menu");
        menu.replaceChildren();
        const remove = document.createElement("button");
        remove.textContent = "Delete";
        remove.setAttribute("role", "menuitem");
        remove.addEventListener("click", () => {
          closeTaskbarMenus();
          saveTaskbarSettings({
            quickLaunchItems: getTaskbarSettings().quickLaunchItems.filter(
              (item) => item !== id,
            ),
          });
        });
        menu.append(remove);
        positionTaskbarMenu(menu, event.clientX, event.clientY);
      });
      quickLaunch.append(button);
    }
    toolbars.append(quickLaunch);
  }
  const folders = [
    ...(settings.desktopToolbar ? [fs.DESKTOP] : []),
    ...settings.folders,
  ];
  for (const id of new Set(folders)) {
    const node = fs.getNode(id);
    if (!node || node.type !== "folder") continue;
    const button = document.createElement("button");
    button.className = "taskbar-folder-toolbar";
    button.textContent = `${node.name} »`;
    button.setAttribute("aria-haspopup", "menu");
    button.addEventListener("click", () => openTaskbarFolderMenu(id, button));
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const menu = document.getElementById("taskbar-overflow-menu");
      closeTaskbarMenus();
      menu.replaceChildren();
      const close = document.createElement("button");
      close.textContent = "Close Toolbar";
      close.setAttribute("role", "menuitem");
      close.addEventListener("click", () => {
        closeTaskbarMenus();
        saveTaskbarSettings(
          id === fs.DESKTOP
            ? { desktopToolbar: false }
            : { folders: settings.folders.filter((entry) => entry !== id) },
        );
      });
      menu.append(close);
      positionTaskbarMenu(menu, event.clientX, event.clientY);
    });
    toolbars.append(button);
  }
  toolbars.hidden = !toolbars.children.length;
  for (const [name, value] of [
    ["quick-launch", settings.quickLaunch],
    ["desktop", settings.desktopToolbar],
  ]) {
    const button = document.querySelector(`[data-taskbar-toolbar="${name}"]`);
    button.setAttribute("role", "menuitemcheckbox");
    button.setAttribute("aria-checked", String(value));
    button.querySelector(".context-check").textContent = value ? "✓" : "";
  }
};

const applyTaskbarSettings = () => {
  const settings = getTaskbarSettings();
  taskbarLocked = settings.locked;
  const lock = document.querySelector('[data-taskbar-action="lock"]');
  lock.setAttribute("aria-checked", String(settings.locked));
  lock.querySelector(".context-check").textContent = settings.locked ? "✓" : "";
  applySimulatedMonitor(activeMonitorResolution);
  renderTaskbarToolbars();
  renderTrayVisibility();
  updateClockDisplay();
  renderTaskButtons();
  scheduleTaskbarHide();
};

const openNewTaskbarToolbar = () => {
  const dialog = XPDialogs.createDialog({ title: "New Toolbar" });
  dialog.el.classList.add("taskbar-new-toolbar-dialog");
  dialog.body.innerHTML = `<p>Choose a folder</p><div class="toolbar-folder-tree" role="tree" aria-label="Folders"></div><label class="toolbar-folder-path">Folder: <input aria-label="Folder"></label><div class="toolbar-folder-buttons"></div>`;
  const tree = dialog.body.querySelector(".toolbar-folder-tree");
  const path = dialog.body.querySelector("input");
  let selected = fs.MY_DOCUMENTS;
  const choose = (id) => {
    selected = id;
    path.value = fs.getNode(id).name;
    for (const row of tree.querySelectorAll("[data-folder]")) {
      row.setAttribute("aria-selected", String(row.dataset.folder === id));
    }
  };
  const render = () => {
    tree.replaceChildren();
    const seen = new Set();
    const ancestors = new Set();
    let parent = fs.getNode(selected)?.parent;
    while (parent && !ancestors.has(parent)) {
      ancestors.add(parent);
      parent = fs.getNode(parent)?.parent;
    }
    const add = (id, parent, depth = 0) => {
      if (seen.has(id)) return;
      const node = fs.getNode(id);
      if (!node || node.type !== "folder") return;
      seen.add(id);
      const row = document.createElement("button");
      row.type = "button";
      row.dataset.folder = id;
      row.setAttribute("role", "treeitem");
      row.setAttribute("aria-level", String(depth + 1));
      row.style.paddingLeft = `${depth * 16 + 4}px`;
      const icon = document.createElement("img");
      icon.src =
        id === fs.DESKTOP
          ? "assets/xp/icons/ShowDesktop.png"
          : id === fs.MY_DOCUMENTS
            ? "assets/xp/icons/MyDocuments.png"
            : "assets/xp/icons/NewFolder.png";
      icon.alt = "";
      const text = document.createElement("span");
      text.textContent = node.name;
      row.append(icon, text);
      row.addEventListener("click", () => choose(id));
      parent.append(row);
      const children = fs
        .getChildren(id)
        .filter((child) => child.type === "folder");
      if (children.length) {
        row.setAttribute("aria-expanded", "false");
        const toggle = document.createElement("span");
        toggle.className = "toolbar-tree-toggle";
        toggle.textContent = "+";
        toggle.setAttribute("aria-hidden", "true");
        row.prepend(toggle);
        const group = document.createElement("div");
        group.setAttribute("role", "group");
        group.hidden = true;
        const expand = () => {
          group.hidden = !group.hidden;
          toggle.textContent = group.hidden ? "+" : "−";
          row.setAttribute("aria-expanded", String(!group.hidden));
          if (!group.children.length)
            children.forEach((child) => add(child.id, group, depth + 1));
        };
        if (ancestors.has(id)) expand();
        toggle.addEventListener("click", (event) => {
          event.stopPropagation();
          expand();
        });
        row.addEventListener("dblclick", expand);
        row.addEventListener("keydown", (event) => {
          if (
            (event.key === "ArrowRight" && group.hidden) ||
            (event.key === "ArrowLeft" && !group.hidden)
          ) {
            event.preventDefault();
            expand();
          }
        });
        parent.append(group);
      }
    };
    add(fs.DESKTOP, tree);
    add(fs.MY_DOCUMENTS, tree, 1);
    choose(selected);
  };
  render();
  tree.addEventListener("keydown", (event) => {
    if (
      event.defaultPrevented ||
      !["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)
    )
      return;
    const rows = [...tree.querySelectorAll("[data-folder]")].filter(
      (row) => !row.closest("[hidden]"),
    );
    const index = rows.indexOf(event.target);
    const next =
      event.key === "Home"
        ? rows[0]
        : event.key === "End"
          ? rows.at(-1)
          : rows[
              Math.max(
                0,
                Math.min(
                  rows.length - 1,
                  index + (event.key === "ArrowDown" ? 1 : -1),
                ),
              )
            ];
    if (next) {
      event.preventDefault();
      next.focus();
      choose(next.dataset.folder);
    }
  });
  const buttons = dialog.body.querySelector(".toolbar-folder-buttons");
  buttons.append(
    XPDialogs.createDialogButton(
      { id: "new-folder", label: "Make New Folder" },
      async () => {
        try {
          const node = await fileOps.createFolder(selected, "New Folder");
          selected = node.id;
          render();
        } catch (error) {
          void XPDialogs.alert(error.message, "New Toolbar", "error");
        }
      },
    ),
    XPDialogs.createDialogButton({ id: "ok", label: "OK" }, () => {
      const id =
        path.value === fs.getNode(selected)?.name
          ? selected
          : fs.resolvePath(path.value);
      if (fs.getNode(id)?.type !== "folder") {
        void XPDialogs.alert(
          "The folder could not be found.",
          "New Toolbar",
          "error",
        );
        return;
      }
      saveTaskbarSettings({
        folders: [...new Set([...getTaskbarSettings().folders, id])],
      });
      dialog.close("ok");
    }),
    XPDialogs.createDialogButton({ id: "cancel", label: "Cancel" }, () =>
      dialog.close("cancel"),
    ),
  );
};

const setupTaskbarLayout = () => {
  const bar = document.getElementById("taskbar");
  const handle = document.getElementById("taskbar-resize");
  bar.addEventListener("pointerenter", revealTaskbar);
  bar.addEventListener("pointerdown", () => {
    bar.style.zIndex = "8000";
  });
  document.addEventListener("pointerdown", (event) => {
    const settings = getTaskbarSettings();
    if (
      !settings.onTop &&
      !settings.autoHide &&
      !event.target.closest(
        "#taskbar, #start-menu, #taskbar-context-menu, #taskbar-overflow-menu",
      )
    )
      bar.style.zIndex = "90";
  });
  bar.addEventListener("focusin", revealTaskbar);
  bar.addEventListener("pointerleave", scheduleTaskbarHide);
  bar.addEventListener("focusout", scheduleTaskbarHide);
  let drag = null;
  bar.addEventListener("pointerdown", (event) => {
    if (
      event.button !== 0 ||
      getTaskbarSettings().locked ||
      event.target.closest("button, input")
    )
      return;
    const settings = getTaskbarSettings();
    drag = { id: event.pointerId, resize: event.target === handle, settings };
    bar.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  bar.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const monitor = getSimulatedMonitorSize(activeMonitorResolution);
    const left = Math.max(0, (innerWidth - monitor.width) / 2);
    const top = Math.max(0, (innerHeight - monitor.height) / 2);
    const x = event.clientX - left,
      y = event.clientY - top;
    if (drag.resize) {
      const edge = drag.settings.edge;
      if (["left", "right"].includes(edge)) {
        saveTaskbarSettings({
          width: Math.max(
            99,
            Math.min(
              monitor.width / 2,
              edge === "left" ? x : monitor.width - x,
            ),
          ),
        });
      } else {
        const size = edge === "top" ? y : monitor.height - y;
        saveTaskbarSettings({
          rows: Math.max(
            1,
            Math.min(100, Math.round((size - getTaskbarHeight()) / 26) + 1),
          ),
        });
      }
    } else {
      const distances = {
        left: x,
        right: monitor.width - x,
        top: y,
        bottom: monitor.height - y,
      };
      const edge = Object.keys(distances).sort(
        (a, b) => distances[a] - distances[b],
      )[0];
      if (
        distances[edge] < Math.min(monitor.width, monitor.height) / 4 &&
        edge !== getTaskbarSettings().edge
      )
        saveTaskbarSettings({ edge });
    }
  });
  const finish = () => {
    drag = null;
  };
  bar.addEventListener("pointerup", finish);
  bar.addEventListener("pointercancel", finish);
  bar.addEventListener("lostpointercapture", finish);
  document.getElementById("tray-expand").addEventListener("click", () => {
    taskbarTrayExpanded = !taskbarTrayExpanded;
    renderTrayVisibility();
  });
  document
    .getElementById("tray-volume-button")
    .addEventListener("pointerdown", () => {
      taskbarVolumeLastUsed = Date.now();
    });
  setInterval(renderTrayVisibility, 30000);
  fs.subscribe(() => {
    renderTaskbarToolbars();
    renderTaskButtons();
  });
  applyTaskbarSettings();
};
