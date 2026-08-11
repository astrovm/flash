"use strict";

const openNotepad = (file = null) => {
  const existing = openWindows.get(NOTEPAD_ID);
  if (existing) {
    const switchDocument = async () => {
      if (!(await existing.confirmSaveChanges())) return;
      existing.loadDocument(file);
      restoreWindow(NOTEPAD_ID);
      focusWindow(NOTEPAD_ID);
    };
    switchDocument();
    return;
  }

  const { width: desktopWidth, height: desktopHeight } = getDesktopSize();
  const el = createWindowElement(NOTEPAD_ID);
  el.classList.add("notepad-window");
  el.querySelectorAll(".game-menu-bar, .game-menu").forEach((node) =>
    node.remove(),
  );
  const windowWidth = Math.min(768, desktopWidth - 16);
  const windowHeight = Math.min(530, desktopHeight - 16);
  el.style.width = `${windowWidth}px`;
  el.style.height = `${windowHeight}px`;
  el.style.left = `${Math.min(44, Math.max(8, desktopWidth - windowWidth))}px`;
  el.style.top = `${Math.min(58, Math.max(8, desktopHeight - windowHeight))}px`;

  const content = el.querySelector(".window-content");
  content.className = "notepad-content";
  content.replaceChildren();

  const menuBar = document.createElement("div");
  menuBar.className = "notepad-menu-bar";
  menuBar.setAttribute("role", "menubar");
  const editor = document.createElement("textarea");
  editor.className = "notepad-editor";
  editor.setAttribute("aria-label", "Notepad document");
  editor.spellcheck = false;
  editor.wrap = "off";
  const status = document.createElement("div");
  status.className = "notepad-status";
  status.hidden = true;
  content.append(menuBar, editor, status);
  document.getElementById("desktop").appendChild(el);

  const win = {
    gameId: NOTEPAD_ID,
    el,
    type: "system",
    player: null,
    minimized: false,
    maximized: false,
    prevRect: null,
    zIndex: 0,
    lastUsed: Date.now(),
    nodeId: null,
    dirty: false,
    maximizeBtn: el.querySelector(".maximize-btn"),
    favoriteBtn: null,
    volumeBtn: null,
  };
  openWindows.set(NOTEPAD_ID, win);

  const updateTitle = () => {
    const node = win.nodeId && fs.getNode(win.nodeId);
    const documentName = node?.name || "Untitled";
    const title = `${documentName} - Notepad`;
    systemShortcuts[NOTEPAD_ID].title = title;
    el.querySelector(".title-text").textContent = title;
    renderTaskButtons();
    updateDocumentTitle();
  };

  const updateStatus = () => {
    const beforeCaret = editor.value.slice(0, editor.selectionStart);
    const lines = beforeCaret.split("\n");
    status.textContent = `Ln ${lines.length}, Col ${lines.at(-1).length + 1}`;
  };

  const loadDocument = (node) => {
    win.nodeId = node?.id || null;
    editor.value = node ? fs.getContent(node.id) || "" : "";
    win.dirty = false;
    updateTitle();
    updateStatus();
    editor.focus();
  };

  const saveAs = async () => {
    const current = win.nodeId && fs.getNode(win.nodeId);
    const result = await XPDialogs.saveFile({
      title: "Save As",
      startFolder: current?.parent || fs.MY_DOCUMENTS,
      defaultName: current?.name || "Untitled.txt",
      filter: [".txt"],
    });
    if (!result) return false;
    const name = result.name.toLowerCase().endsWith(".txt")
      ? result.name
      : `${result.name}.txt`;
    try {
      let target = result.existingId && fs.getNode(result.existingId);
      if (target && target.type !== "file") {
        throw new Error(`"${name}" is not a text file.`);
      }
      if (target && target.id !== win.nodeId) {
        fs.destroy(target.id);
        target = null;
      }
      if (!target) {
        target = fileOps.createFile(result.parentId, name, {
          content: editor.value,
        });
      } else {
        if (target.name !== name) fileOps.rename(target.id, name);
        fs.setContent(target.id, editor.value);
      }
      win.nodeId = target.id;
      win.dirty = false;
      updateTitle();
      return true;
    } catch (error) {
      XPDialogs.alert(
        error.message || "The file could not be saved.",
        "Notepad",
        "error",
      );
      return false;
    }
  };

  const save = async () => {
    const node = win.nodeId && fs.getNode(win.nodeId);
    if (!node) return saveAs();
    fs.setContent(node.id, editor.value);
    win.dirty = false;
    updateTitle();
    return true;
  };

  const confirmSaveChanges = async () => {
    if (!win.dirty) return true;
    const node = win.nodeId && fs.getNode(win.nodeId);
    const answer = await XPDialogs.message({
      title: "Notepad",
      text: `The text in the ${node?.name || "Untitled"} file has changed.\n\nDo you want to save the changes?`,
      icon: "warning",
      buttons: XPDialogs.BUTTON_SETS.yesNoCancel,
      defaultButton: "yes",
    });
    if (answer === "cancel") return false;
    if (answer === "no") return true;
    return save();
  };

  Object.assign(win, { loadDocument, confirmSaveChanges });
  win.beforeClose = confirmSaveChanges;

  const insertText = (text) => {
    editor.setRangeText(
      text,
      editor.selectionStart,
      editor.selectionEnd,
      "end",
    );
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const commands = {
    new: async () => {
      if (await confirmSaveChanges()) loadDocument(null);
    },
    open: async () => {
      if (!(await confirmSaveChanges())) return;
      const chosen = await XPDialogs.openFile({
        title: "Open",
        startFolder: fs.MY_DOCUMENTS,
        filter: [".txt"],
      });
      if (chosen) loadDocument(chosen);
    },
    save,
    "save-as": saveAs,
    exit: () => closeGameWindow(NOTEPAD_ID),
    undo: () => {
      editor.focus();
      document.execCommand("undo");
    },
    cut: async () => {
      const selected = editor.value.slice(
        editor.selectionStart,
        editor.selectionEnd,
      );
      if (selected) {
        await navigator.clipboard?.writeText(selected);
        insertText("");
      }
    },
    copy: () =>
      navigator.clipboard?.writeText(
        editor.value.slice(editor.selectionStart, editor.selectionEnd),
      ),
    paste: async () => {
      const text = await navigator.clipboard?.readText();
      if (typeof text === "string") insertText(text);
    },
    delete: () => insertText(""),
    "select-all": () => {
      editor.focus();
      editor.select();
      updateStatus();
    },
    "time-date": () => insertText(new Date().toLocaleString()),
    "word-wrap": (item) => {
      const enabled = editor.wrap === "off";
      editor.wrap = enabled ? "soft" : "off";
      editor.classList.toggle("word-wrap", enabled);
      item.classList.toggle("checked", enabled);
      item.setAttribute("aria-checked", String(enabled));
    },
    "status-bar": (item) => {
      status.hidden = !status.hidden;
      item.classList.toggle("checked", !status.hidden);
      item.setAttribute("aria-checked", String(!status.hidden));
    },
    about: () =>
      XPDialogs.alert("Microsoft Windows XP\nNotepad", "About Notepad", "info"),
  };

  const menuDefinitions = [
    [
      "&File",
      [
        ["&New", "new", "Ctrl+N"],
        ["&Open...", "open", "Ctrl+O"],
        ["&Save", "save", "Ctrl+S"],
        ["Save &As...", "save-as", ""],
        ["-", "", ""],
        ["E&xit", "exit", ""],
      ],
    ],
    [
      "&Edit",
      [
        ["&Undo", "undo", "Ctrl+Z"],
        ["-", "", ""],
        ["Cu&t", "cut", "Ctrl+X"],
        ["&Copy", "copy", "Ctrl+C"],
        ["&Paste", "paste", "Ctrl+V"],
        ["De&lete", "delete", "Del"],
        ["-", "", ""],
        ["Select &All", "select-all", "Ctrl+A"],
        ["Time/&Date", "time-date", "F5"],
      ],
    ],
    ["F&ormat", [["&Word Wrap", "word-wrap", ""]]],
    ["&View", [["&Status Bar", "status-bar", ""]]],
    ["&Help", [["&About Notepad", "about", ""]]],
  ];

  const closeMenus = () => {
    menuBar.querySelectorAll(".notepad-menu").forEach((menu) => {
      menu.hidden = true;
    });
    menuBar.querySelectorAll(".notepad-menu-button").forEach((button) => {
      button.setAttribute("aria-expanded", "false");
    });
  };

  menuDefinitions.forEach(([label, items]) => {
    const group = document.createElement("div");
    group.className = "notepad-menu-group";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "notepad-menu-button";
    button.setAttribute("role", "menuitem");
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
    setAccessKeyText(button, label);
    const menu = document.createElement("div");
    menu.className = "notepad-menu";
    menu.setAttribute("role", "menu");
    menu.hidden = true;
    items.forEach(([itemLabel, command, shortcut, checked]) => {
      if (itemLabel === "-") {
        const separator = document.createElement("div");
        separator.className = "notepad-menu-separator";
        menu.appendChild(separator);
        return;
      }
      const item = document.createElement("button");
      item.type = "button";
      item.className = "notepad-menu-item";
      item.dataset.command = command;
      item.setAttribute("role", checked ? "menuitemcheckbox" : "menuitem");
      if (checked) {
        item.classList.add("checked");
        item.setAttribute("aria-checked", "true");
      }
      const check = document.createElement("span");
      check.className = "notepad-menu-check";
      check.textContent = "✓";
      const text = document.createElement("span");
      setAccessKeyText(text, itemLabel);
      const key = document.createElement("span");
      key.className = "notepad-menu-shortcut";
      key.textContent = shortcut;
      item.append(check, text, key);
      item.addEventListener("click", () => {
        closeMenus();
        commands[command]?.(item);
      });
      menu.appendChild(item);
    });
    button.addEventListener("click", () => {
      const shouldOpen = menu.hidden;
      closeMenus();
      menu.hidden = !shouldOpen;
      button.setAttribute("aria-expanded", String(shouldOpen));
      if (shouldOpen) menu.querySelector("button")?.focus();
    });
    group.append(button, menu);
    menuBar.appendChild(group);
  });

  editor.addEventListener("input", () => {
    win.dirty = true;
    updateStatus();
  });
  ["click", "keyup", "select"].forEach((eventName) =>
    editor.addEventListener(eventName, updateStatus),
  );
  el.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".notepad-menu-group")) closeMenus();
  });
  el.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      save();
    } else if (event.ctrlKey && event.key.toLowerCase() === "o") {
      event.preventDefault();
      commands.open();
    } else if (event.ctrlKey && event.key.toLowerCase() === "n") {
      event.preventDefault();
      commands.new();
    } else if (event.key === "F5") {
      event.preventDefault();
      commands["time-date"]();
    }
  });

  wireSystemWindowControls(win);
  loadDocument(file);
  focusWindow(NOTEPAD_ID);
};

fs.registerFileType(".txt", (file) => openNotepad(file));

fs.registerFolderHandler((folder) => {
  openSystemWindow("__my-documents");
  const win = openWindows.get("__my-documents");
  if (win) navigateExplorer(win, folder.id);
});

// Keep open explorer windows in sync with filesystem changes.
fs.subscribe(() => {
  openWindows.forEach((win) => {
    if (win.type !== "system" || !win.currentFolderId) return;
    if (!fs.getNode(win.currentFolderId)) {
      win.currentFolderId = fs.MY_COMPUTER;
    }
    renderExplorerItems(win);
  });
  if (iconsBuilt) buildDesktopIcons();
  renderTaskButtons();
});
