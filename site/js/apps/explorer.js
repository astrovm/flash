"use strict";

// ============================================
// Virtual Filesystem integration
// ============================================

const fs = window.VirtualFS;
const fileOps = window.FileOperations;

const refreshInstalledGames = (installedGames) => {
  const nextIds = new Set(Object.keys(installedGames));
  installedGameIds.forEach((gameId) => {
    if (nextIds.has(gameId)) return;
    closeGameWindow(gameId);
    fs.findByApp(gameId).forEach((node) => fs.destroy(node.id));
    delete gamesList[gameId];
    const favorites = getFavorites().filter((id) => id !== gameId);
    setFavorites(favorites);
  });
  Object.entries(installedGames).forEach(([gameId, game]) => {
    gamesList[gameId] = game;
  });
  installedGameIds.clear();
  nextIds.forEach((gameId) => installedGameIds.add(gameId));

  if (!shellInitialized) return;
  syncGameFiles();
  buildDesktopIcons();
  if (!document.getElementById("start-menu").hidden) buildPinnedPrograms();
  const internetWindow = openWindows.get("__internet-games");
  if (internetWindow) renderInstalledInternetGames(internetWindow);
};

const initializeGameLibrary = async () => {
  try {
    gameLibrary = window.AstroGameLibrary.createManager();
    gameLibrary.subscribe(refreshInstalledGames);
    refreshInstalledGames(await gameLibrary.initialize());
    gameLibraryReady = true;
  } catch (error) {
    console.error("Internet Games initialization failed:", error);
    gameLibraryError = error;
  }
};

// Shared names understood by Run, Search, and the shell. Keep these routes in
// one place so adding a simulated application does not create another parser.
const SHELL_COMMANDS = [
  {
    id: "documents",
    title: "My Documents",
    aliases: ["documents", "my documents"],
    run: () => openSystemWindow("__my-documents"),
  },
  {
    id: "pictures",
    title: "My Pictures",
    aliases: ["pictures", "my pictures"],
    run: () => openSystemWindow("__my-pictures"),
  },
  {
    id: "music",
    title: "My Music",
    aliases: ["music", "my music"],
    run: () => openSystemWindow("__my-music"),
  },
  {
    id: "computer",
    title: "My Computer",
    aliases: ["computer", "my computer"],
    run: () => openSystemWindow("__my-computer"),
  },
  {
    id: "control-panel",
    title: "Control Panel",
    aliases: ["control panel"],
    run: () => openControlPanel(),
  },
  {
    id: "system-properties",
    title: "System Properties",
    aliases: ["sysdm.cpl", "system properties"],
    run: () => openSystemProperties(),
  },
  {
    id: "printers",
    title: "Printers and Faxes",
    aliases: ["printers", "printers and faxes"],
    run: () => openPrintersAndFaxes(),
  },
  {
    id: "help",
    title: "Help and Support",
    aliases: ["help", "help and support"],
    run: () => openHelpAndSupport(),
  },
  {
    id: "notepad",
    title: "Notepad",
    aliases: ["notepad"],
    run: () => openNotepad(),
  },
  {
    id: "search",
    title: "Search",
    aliases: ["search"],
    run: () => openSystemWindow("__search"),
  },
  {
    id: "internet-games",
    title: "Internet Games",
    aliases: ["internet games", "game store", "games online"],
    run: () => openSystemWindow("__internet-games"),
  },
  { id: "run", title: "Run", aliases: ["run"], run: () => openRunDialog() },
];

const normalizeShellCommand = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
const resolveShellCommand = (value) => {
  const command = normalizeShellCommand(value);
  if (!command) return null;
  const shell = SHELL_COMMANDS.find((entry) => entry.aliases.includes(command));
  if (shell) return { kind: "application", title: shell.title, run: shell.run };
  const gameId = Object.keys(gamesList).find(
    (id) =>
      id.toLowerCase() === command ||
      formatGameTitle(id).toLowerCase() === command,
  );
  if (gameId)
    return {
      kind: "game",
      title: formatGameTitle(gameId),
      run: () => openGameWindow(gameId),
    };
  const nodeId = fs.resolvePath(String(value).trim());
  const node = nodeId && fs.getNode(nodeId);
  if (node)
    return {
      kind: node.type === "folder" ? "folder" : "file",
      title: node.name,
      run: () => fs.open(node.id),
    };
  return null;
};

const RUN_HISTORY_KEY = "runHistory";
const getRunHistory = () =>
  readJsonStorage(
    RUN_HISTORY_KEY,
    [],
    (history) =>
      Array.isArray(history) &&
      history.every((entry) => typeof entry === "string"),
  ).slice(0, 10);
const rememberRunCommand = (value) => {
  const text = String(value).trim();
  if (!text) return;
  const history = getRunHistory().filter(
    (entry) => entry.toLowerCase() !== text.toLowerCase(),
  );
  writeJsonStorage(RUN_HISTORY_KEY, [text, ...history].slice(0, 10));
};

const searchVirtualNodes = ({
  query = "",
  locationId = fs.MY_COMPUTER,
  type = "all",
} = {}) => {
  const wanted = normalizeShellCommand(query);
  const matches = (name) => !wanted || name.toLowerCase().includes(wanted);
  const results = [];
  const representedGameIds = new Set();
  const pending = [locationId];
  const seen = new Set();
  while (pending.length) {
    const id = pending.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    const node = fs.getNode(id);
    if (!node) continue;
    if (
      id !== locationId &&
      matches(node.name) &&
      (type === "all" ||
        (type === "files" && node.type === "file") ||
        (type === "folders" && node.type === "folder") ||
        (type === "games" && !!node.app))
    ) {
      results.push({ kind: node.app ? "game-file" : node.type, node });
      if (node.app) representedGameIds.add(node.app);
    }
    if (node.type === "folder")
      fs.getChildren(id).forEach((child) => pending.push(child.id));
  }
  if (type === "all" || type === "games") {
    Object.keys(gamesList)
      .filter(
        (id) => !representedGameIds.has(id) && matches(formatGameTitle(id)),
      )
      .forEach((gameId) => {
        results.push({ kind: "game", gameId, title: formatGameTitle(gameId) });
      });
  }
  if (type === "all" || type === "applications") {
    SHELL_COMMANDS.filter((entry) => matches(entry.title)).forEach((entry) => {
      results.push({ kind: "application", command: entry, title: entry.title });
    });
  }
  return results.sort((a, b) =>
    (a.title || a.node.name).localeCompare(b.title || b.node.name),
  );
};

const wireSearchCompanion = (win) => {
  const content = win.el.querySelector(".search-companion-content");
  if (!content) return;
  const startPanel = content.querySelector(".search-start-panel");
  const formPanel = content.querySelector(".search-form-panel");
  const query = content.querySelector("#search-filename");
  const location = content.querySelector("#search-location");
  const type = content.querySelector("#search-type");
  const status = content.querySelector(".search-results-status");
  const list = content.querySelector(".search-results-list");
  const showForm = (kind = "all") => {
    startPanel.hidden = true;
    formPanel.hidden = false;
    type.value = ["media", "documents"].includes(kind) ? "files" : "all";
    query.focus();
  };
  content.querySelectorAll("[data-search-kind]").forEach((button) => {
    button.addEventListener("click", () => showForm(button.dataset.searchKind));
  });
  content
    .querySelector('[data-search-action="back"]')
    .addEventListener("click", () => {
      formPanel.hidden = true;
      startPanel.hidden = false;
    });
  [
    [fs.MY_COMPUTER, "My Computer"],
    [fs.DESKTOP, "Desktop"],
    [fs.MY_DOCUMENTS, "My Documents"],
    [fs.MY_PICTURES, "My Pictures"],
    [fs.MY_MUSIC, "My Music"],
  ]
    .filter(([id]) => fs.getNode(id))
    .forEach(([id, label]) => {
      const option = new Option(label, id);
      location.appendChild(option);
    });
  const openResult = (result) => {
    if (result.gameId) return openGameWindow(result.gameId);
    if (result.command) return result.command.run();
    return fs.open(result.node.id);
  };
  const render = () => {
    const results = searchVirtualNodes({
      query: query.value,
      locationId: location.value,
      type: type.value,
    });
    list.replaceChildren();
    status.textContent = results.length
      ? `${results.length} result${results.length === 1 ? "" : "s"} found.`
      : "No results found.";
    results.forEach((result) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "explorer-item";
      item.setAttribute("role", "option");
      const label = document.createElement("span");
      const name = document.createElement("b");
      name.textContent = result.title || result.node.name;
      const description = document.createElement("small");
      description.textContent = result.command
        ? "Application"
        : result.gameId
          ? "Game"
          : `${result.kind === "folder" ? "File folder" : explorerItemDescription(result.node)} — ${fs.getPath(result.node.id)}`;
      label.append(name, description);
      item.append(
        result.gameId
          ? createGameIconElement(result.gameId, "explorer-item-icon")
          : result.command
            ? createGameIconElement("__search", "explorer-item-icon")
            : createExplorerIcon(result.node),
        label,
      );
      item.addEventListener("dblclick", () => openResult(result));
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          openResult(result);
        }
      });
      item.addEventListener("click", () => {
        list
          .querySelectorAll(".selected")
          .forEach((entry) => entry.classList.remove("selected"));
        item.classList.add("selected");
      });
      list.appendChild(item);
    });
  };
  content
    .querySelector('[data-search-action="search"]')
    .addEventListener("click", render);
  query.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      render();
    }
  });
  [location, type].forEach((control) =>
    control.addEventListener("change", render),
  );
};

const findBundledGameByTitle = (title) => {
  const wanted = String(title || "")
    .trim()
    .toLowerCase();
  if (!wanted) return null;
  return (
    Object.keys(window.FLASH_GAMES).find(
      (gameId) => formatGameTitle(gameId).toLowerCase() === wanted,
    ) || null
  );
};

const createInternetGameCard = (game, win, { installed = false } = {}) => {
  const card = document.createElement("article");
  card.className = "internet-game-card";

  const artwork = document.createElement("div");
  artwork.className = "internet-game-artwork";
  const image = document.createElement("img");
  image.src = game.icon || game.logoUrl || "";
  image.alt = "";
  image.loading = "lazy";
  image.addEventListener("error", () => {
    image.hidden = true;
    artwork.classList.add("missing");
  });
  artwork.appendChild(image);

  const body = document.createElement("div");
  body.className = "internet-game-card-body";
  const title = document.createElement("h2");
  title.textContent = game.title || "Untitled game";
  const developer = document.createElement("p");
  developer.className = "internet-game-developer";
  developer.textContent = game.developer || "Unknown developer";
  const tags = document.createElement("p");
  tags.className = "internet-game-tags";
  tags.textContent = Array.isArray(game.tags)
    ? game.tags.slice(0, 4).join(" · ")
    : "Flash";
  body.append(title, developer, tags);

  const actions = document.createElement("div");
  actions.className = "internet-game-actions";
  const action = document.createElement("button");
  action.type = "button";
  action.className = "xp-btn";

  if (installed) {
    action.textContent = "Play";
    action.addEventListener("click", () =>
      openGameWindow(`flashpoint:${game.uuid}`),
    );
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "xp-btn";
    remove.textContent = "Uninstall";
    remove.addEventListener("click", async () => {
      const confirmed = await XPDialogs.confirm(
        `Remove ${game.title || "this game"} from this computer?`,
        "Uninstall Game",
        "warning",
      );
      if (!confirmed) return;
      action.disabled = true;
      remove.disabled = true;
      try {
        await gameLibrary.uninstall(game.uuid);
      } catch (error) {
        XPDialogs.alert(
          error.message || "The game could not be uninstalled.",
          "Internet Games",
          "error",
        );
        action.disabled = false;
        remove.disabled = false;
      }
    });
    actions.append(action, remove);
  } else {
    const gameId = `flashpoint:${game.uuid}`;
    const includedGameId = findBundledGameByTitle(game.title);
    let availableGameId = gamesList[gameId] ? gameId : includedGameId;
    action.textContent = availableGameId
      ? "Play"
      : game.potentiallyCompatible === false
        ? "Not compatible"
        : "Install";
    if (includedGameId && !gamesList[gameId]) {
      action.title =
        "This game is already included with Astro Flash Collection.";
    }
    action.disabled = game.potentiallyCompatible === false;
    action.addEventListener("click", async () => {
      if (availableGameId) {
        openGameWindow(availableGameId);
        return;
      }
      const status = win.el.querySelector(".internet-games-status");
      action.disabled = true;
      action.textContent = "Checking...";
      try {
        const details = await gameLibrary.details(game.uuid);
        if (!details.compatible) {
          throw new Error(
            details.incompatibleReason || "This game is not compatible.",
          );
        }
        action.textContent = "Downloading...";
        await gameLibrary.install(details, {
          onProgress: ({ loaded, total }) => {
            if (total) {
              const percent = Math.min(100, Math.round((loaded / total) * 100));
              action.textContent = `Downloading ${percent}%`;
            } else {
              action.textContent = `Downloading ${XPDialogs.formatBytes(loaded)}`;
            }
          },
        });
        availableGameId = gameId;
        action.textContent = "Play";
        action.disabled = false;
        status.textContent = `${details.title} was installed successfully.`;
      } catch (error) {
        action.textContent = "Install";
        action.disabled = false;
        status.textContent =
          error.message || "The game could not be installed.";
      }
    });
    actions.appendChild(action);
  }

  card.append(artwork, body, actions);
  return card;
};

const renderInstalledInternetGames = (win) => {
  if (!win?.el) return;
  const container = win.el.querySelector(".internet-games-installed");
  const status = win.el.querySelector(".internet-games-installed-status");
  if (!container || !status) return;
  container.replaceChildren();
  const records = gameLibrary
    ? [...installedGameIds]
        .map((id) => gameLibrary.getRecord(id))
        .filter(Boolean)
        .sort((a, b) => (a.title || "").localeCompare(b.title || ""))
    : [];
  status.textContent = records.length
    ? `${records.length} installed game${records.length === 1 ? "" : "s"}.`
    : "No internet games are installed yet.";
  records.forEach((record) =>
    container.appendChild(
      createInternetGameCard(record, win, { installed: true }),
    ),
  );
};

const wireInternetGames = (win) => {
  const content = win.el.querySelector(".internet-games-content");
  if (!content) return;
  const tabs = [...content.querySelectorAll("[data-internet-tab]")];
  const panels = [...content.querySelectorAll("[data-internet-panel]")];
  const query = content.querySelector("#internet-games-query");
  const form = content.querySelector(".internet-games-search");
  const status = content.querySelector(".internet-games-status");
  const results = content.querySelector(".internet-games-results");

  const selectTab = (name) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.internetTab === name;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.internetPanel !== name;
    });
    if (name === "installed") renderInstalledInternetGames(win);
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab.dataset.internetTab));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const offset = event.key === "ArrowRight" ? 1 : -1;
      const next = tabs[(index + offset + tabs.length) % tabs.length];
      selectTab(next.dataset.internetTab);
      next.focus();
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const term = query.value.trim();
    if (!term) {
      status.textContent = "Enter a game title.";
      query.focus();
      return;
    }
    if (!gameLibrary || gameLibraryError) {
      status.textContent =
        gameLibraryError?.message ||
        "The Internet Games service is unavailable.";
      return;
    }
    const submit = form.querySelector("button");
    submit.disabled = true;
    status.textContent = `Searching for “${term}”...`;
    results.replaceChildren();
    try {
      const games = await gameLibrary.search(term);
      status.textContent = games.length
        ? `${games.length} result${games.length === 1 ? "" : "s"} found.`
        : "No games found.";
      games.forEach((game) =>
        results.appendChild(createInternetGameCard(game, win)),
      );
    } catch (error) {
      status.textContent =
        error.message || "The Flashpoint catalog could not be searched.";
    } finally {
      submit.disabled = false;
    }
  });

  renderInstalledInternetGames(win);
  query.focus();
};

const confirmRecycleDelete = (ids) =>
  XPDialogs.confirm(
    ids.length === 1
      ? "Are you sure you want to send this item to the Recycle Bin?"
      : "Are you sure you want to send these items to the Recycle Bin?",
    "Confirm File Delete",
    "warning",
  ).then((yes) => yes && fileOps.removeToBin(ids));

const confirmEmptyRecycleBin = () => {
  const count = fs.getChildren(fs.RECYCLE_BIN).length;
  if (!count) return Promise.resolve(false);
  const single = count === 1;
  return XPDialogs.confirm(
    single
      ? "Are you sure you want to delete this item?"
      : `Are you sure you want to delete these ${count} items?`,
    single ? "Confirm File Delete" : "Confirm Multiple File Delete",
    "warning",
  ).then((yes) => {
    if (!yes) return false;
    fileOps.emptyRecycleBin();
    return true;
  });
};

const choosePasteConflict = ({ existing }) =>
  new Promise((resolve) => {
    const dialog = XPDialogs.createDialog({
      title: "Confirm File Replace",
      onCancel: () => dialog.close("cancel"),
    });
    const text = document.createElement("p");
    text.className = "dlg-text";
    text.textContent = `${existing.name} already exists. What do you want to do?`;
    const row = document.createElement("div");
    row.className = "dlg-buttons";
    [
      ["Replace", "replace"],
      ["Keep Both", "rename"],
      ["Cancel", "cancel"],
    ].forEach(([label, value]) => {
      row.appendChild(
        XPDialogs.createDialogButton({ id: value, label }, () =>
          dialog.close(value),
        ),
      );
    });
    dialog.body.append(text, row);
    dialog.onResult(resolve);
    dialog.defaultButton = row.firstChild;
    row.firstChild.focus();
  });
let pasteBusy = false;
const pasteIntoFolder = async (destinationId) => {
  if (pasteBusy) return null;
  const clipboard = fileOps.getClipboard();
  if (!clipboard) return;
  pasteBusy = true;
  let cancelled = false;
  const progress =
    clipboard.ids.length > 1
      ? XPDialogs.progress({
          title: clipboard.mode === "cut" ? "Moving..." : "Copying...",
          text: "Preparing file operation...",
          cancellable: true,
          onCancel: () => {
            cancelled = true;
          },
        })
      : null;
  try {
    const result = await fileOps.pasteWithConflicts(
      destinationId,
      choosePasteConflict,
      {
        isCancelled: () => cancelled,
        onProgress: ({ completed, total, mode }) =>
          progress?.update(
            completed / total,
            `${mode === "cut" ? "Moving" : "Copying"} ${completed} of ${total}...`,
          ),
      },
    );
    progress?.close?.(result.cancelled ? "cancelled" : "complete");
    return result;
  } catch (error) {
    progress?.close?.("error");
    console.error(error);
    XPDialogs.alert(
      error.message || "The file operation could not be completed.",
      "File Operation Error",
      "error",
    );
    return null;
  } finally {
    pasteBusy = false;
  }
};
// Browser DataTransfer exposes file bytes, but directory traversal is only
// available through the non-standard webkitGetAsEntry API. Unsupported
// browsers import the flat FileList and cannot preserve directory structure.
const readAllDirectoryEntries = (reader) =>
  new Promise((resolve, reject) => {
    const entries = [];
    const read = () =>
      reader.readEntries((batch) => {
        if (!batch.length) resolve(entries);
        else {
          entries.push(...batch);
          read();
        }
      }, reject);
    read();
  });
const importFileEntry = (entry, destinationId, state = {}) =>
  new Promise((resolve, reject) =>
    entry.file(async (file) => {
      try {
        if (state.cancelled) return resolve(false);
        const content = file.type.startsWith("text/") ? await file.text() : "";
        const existing = fs.findChild(destinationId, file.name);
        if (existing) {
          const choice = await choosePasteConflict({ existing });
          if (choice === "cancel") {
            state.cancelled = true;
            return resolve(false);
          }
          if (choice === "replace" && existing.type === "file")
            fs.destroy(existing.id);
        }
        fileOps.createFile(destinationId, file.name, {
          content,
          size: file.size,
        });
        state.completed = (state.completed || 0) + 1;
        state.progress?.update(0, `Imported ${state.completed} item(s)...`);
        resolve(true);
      } catch (error) {
        reject(error);
      }
    }, reject),
  );
const importDirectoryEntry = async (entry, destinationId, state = {}) => {
  if (state.cancelled) return;
  const created = [];
  try {
    const existing = fs.findChild(destinationId, entry.name);
    if (existing) {
      const choice = await choosePasteConflict({ existing });
      if (choice === "cancel") {
        state.cancelled = true;
        return;
      }
      if (choice === "replace" && existing.type === "folder")
        fs.destroy(existing.id);
    }
    const folder = fileOps.createFolder(destinationId, entry.name);
    created.push(folder.id);
    const entries = await readAllDirectoryEntries(entry.createReader());
    for (const child of entries) {
      if (state.cancelled) throw new Error("Directory import cancelled");
      if (child.isDirectory)
        await importDirectoryEntry(child, folder.id, state);
      else if (child.isFile) await importFileEntry(child, folder.id, state);
    }
  } catch (error) {
    created.reverse().forEach((id) => {
      if (fs.getNode(id)) fs.destroy(id);
    });
    if (error.message === "Directory import cancelled") return;
    throw error;
  }
};
const importDroppedFiles = async (destinationId, dataTransfer) => {
  if ([fs.RECYCLE_BIN, fs.MY_COMPUTER].includes(destinationId)) {
    XPDialogs.alert(
      "This location cannot accept dropped files.",
      "File Operation Error",
      "error",
    );
    return;
  }
  const progress = XPDialogs.progress({
    title: "Importing...",
    text: "Preparing dropped files...",
    cancellable: true,
  });
  const state = { cancelled: false, completed: 0, progress };
  const cancelButton = progress.el.querySelector("button");
  cancelButton?.addEventListener("click", () => {
    state.cancelled = true;
  });
  try {
    const entries = [...(dataTransfer.items || [])]
      .map((item) => item.webkitGetAsEntry?.())
      .filter(Boolean);
    if (entries.length) {
      for (const entry of entries) {
        if (state.cancelled) break;
        if (entry.isDirectory)
          await importDirectoryEntry(entry, destinationId, state);
        else if (entry.isFile)
          await importFileEntry(entry, destinationId, state);
      }
      return;
    }
    for (const file of [...(dataTransfer.files || [])]) {
      if (state.cancelled) break;
      await importFileEntry({ file: (ok) => ok(file) }, destinationId, state);
    }
  } finally {
    progress.close();
  }
};
const wireFolderDropTarget = (element, destinationId) => {
  element.dataset.dropDestinationId = destinationId;
  element.addEventListener("dragover", (event) => {
    const internal = event.dataTransfer?.types?.includes(
      "application/x-astro-vfs-ids",
    );
    if (
      internal ||
      fileOps.canPaste(destinationId) ||
      event.dataTransfer?.files?.length
    ) {
      event.preventDefault();
      element.classList.add("drop-target");
    }
  });
  element.addEventListener("dragleave", () =>
    element.classList.remove("drop-target"),
  );
  element.addEventListener("drop", async (event) => {
    event.preventDefault();
    element.classList.remove("drop-target");
    try {
      const payload = event.dataTransfer?.getData(
        "application/x-astro-vfs-ids",
      );
      const ids = payload ? JSON.parse(payload) : [];
      if (!Array.isArray(ids)) throw new Error("Invalid dropped item list");
      if (ids.length) {
        fileOps.cut(ids);
        await pasteIntoFolder(destinationId);
      } else await importDroppedFiles(destinationId, event.dataTransfer);
    } catch (error) {
      XPDialogs.alert(
        error.message || "The dropped files could not be imported.",
        "File Operation Error",
        "error",
      );
    }
  });
};
const closeExplorerMenu = (root = document) => {
  root.querySelectorAll(".explorer-menu").forEach((menu) => {
    menu.hidden = true;
  });
  root
    .querySelectorAll('[data-explorer-menu][aria-expanded="true"]')
    .forEach((button) => button.setAttribute("aria-expanded", "false"));
};

const systemFolderShortcuts = {
  "__my-documents": () => fs.MY_DOCUMENTS,
  "__my-computer": () => fs.MY_COMPUTER,
  "__my-pictures": () => fs.MY_PICTURES,
  "__my-music": () => fs.MY_MUSIC,
  "__recycle-bin": () => fs.RECYCLE_BIN,
};

const explorerDescriptions = {
  "__my-documents": "Files stored on this computer",
  "__my-computer": "",
  "__my-pictures": "Files stored in My Pictures",
  "__my-music": "Files stored in My Music",
};

const navigateExplorer = (win, folderId, { history = true } = {}) => {
  const folder = fs.getNode(folderId);
  if (!folder || folder.type !== "folder") return false;
  if (history) {
    const entries = (win.history || []).slice(0, (win.historyIndex ?? -1) + 1);
    if (entries.at(-1) !== folderId) entries.push(folderId);
    win.history = entries;
    win.historyIndex = entries.length - 1;
  }
  win.currentFolderId = folderId;
  renderExplorerItems(win);
  return true;
};

const explorerBack = (win) => {
  if ((win.historyIndex ?? 0) <= 0) return;
  win.historyIndex -= 1;
  navigateExplorer(win, win.history[win.historyIndex], { history: false });
};

const explorerForward = (win) => {
  if ((win.historyIndex ?? -1) >= (win.history?.length ?? 0) - 1) return;
  win.historyIndex += 1;
  navigateExplorer(win, win.history[win.historyIndex], { history: false });
};

const selectedExplorerNodes = (win) =>
  [...win.el.querySelectorAll(".explorer-item.selected")]
    .map((item) => item.dataset.nodeId)
    .filter((id) => !!fs.getNode(id));

const renderExplorerTaskPane = (win) => {
  if (win.currentFolderId === fs.RECYCLE_BIN) return;
  const title = win.el.querySelector(
    ".explorer-sidebar > section:first-child .explorer-section-label",
  );
  const body = win.el.querySelector(
    ".explorer-sidebar > section:first-child .explorer-section-body",
  );
  if (!title || !body) return;

  const isComputer = win.currentFolderId === fs.MY_COMPUTER;
  const isPictures = win.currentFolderId === fs.MY_PICTURES;
  const isMusic = win.currentFolderId === fs.MY_MUSIC;
  title.textContent = isComputer
    ? "System Tasks"
    : isPictures
      ? "Picture Tasks"
      : isMusic
        ? "Music Tasks"
        : "File and Folder Tasks";
  body.replaceChildren();

  const addTask = (label, icon, action, disabled = false) => {
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = disabled;
    const image = document.createElement("img");
    image.src = XP_ICON_PATHS[icon];
    image.alt = "";
    const text = document.createElement("span");
    text.textContent = label;
    button.append(image, text);
    if (action) button.addEventListener("click", action);
    body.appendChild(button);
  };

  if (isComputer) {
    addTask(
      "View System Information",
      "ExplorerProperties.png",
      openProjectSettings,
    );
    addTask(
      "Add or remove programs",
      "AddRemovePrograms.png",
      openControlPanel,
    );
    addTask("Change a setting", "ControlPanel.png", openControlPanel);
    return;
  }

  if (isPictures) {
    addTask("View as a slide show", "MyPictures.png", null, true);
    addTask("Order prints online", "MyPictures.png", null, true);
    addTask("Print pictures", "PrintersAndFaxes.png", null, true);
    return;
  }

  if (isMusic) {
    addTask("Play all", "MyMusic.png", null, true);
    addTask("Shop for music online", "MyMusic.png", null, true);
    addTask("Copy all items to audio CD", "MyMusic.png", null, true);
    return;
  }

  const writable = ![fs.RECYCLE_BIN, fs.MY_COMPUTER].includes(
    win.currentFolderId,
  );
  addTask(
    "Make a new folder",
    "NewFolder.png",
    () => fileOps.createFolder(win.currentFolderId, "New Folder"),
    !writable,
  );
  addTask("Publish this folder to the Web", "PublishToWeb.png", null, true);
  addTask("Share this folder", "SharedFolder.png", null, true);
};

const renderExplorerTree = (win) => {
  const tree = win.el.querySelector(".explorer-tree");
  if (!tree) return;
  tree.replaceChildren();
  const expanded =
    win.expandedFolders ||
    new Set([
      fs.MY_COMPUTER,
      fs.DRIVE_C,
      fs.DOCUMENTS_AND_SETTINGS,
      fs.USER_PROFILE,
    ]);
  win.expandedFolders = expanded;
  const addNode = (id, depth = 0) => {
    const node = fs.getNode(id);
    if (!node || node.type !== "folder") return;
    const row = document.createElement("button");
    row.type = "button";
    row.className = "explorer-tree-item";
    row.dataset.nodeId = id;
    row.style.paddingLeft = `${6 + depth * 14}px`;
    const hasFolders = fs
      .getChildren(id)
      .some((child) => child.type === "folder");
    row.textContent = `${hasFolders ? (expanded.has(id) ? "− " : "+ ") : "  "}${node.name}`;
    row.classList.toggle("active", id === win.currentFolderId);
    row.addEventListener("click", () => {
      if (hasFolders) expanded.add(id);
      navigateExplorer(win, id);
    });
    row.addEventListener("dblclick", () => {
      if (expanded.has(id)) expanded.delete(id);
      else expanded.add(id);
      renderExplorerTree(win);
    });
    tree.appendChild(row);
    if (expanded.has(id))
      fs.getChildren(id)
        .filter((child) => child.type === "folder")
        .forEach((child) => addNode(child.id, depth + 1));
  };
  addNode(fs.MY_COMPUTER);
  addNode(fs.RECYCLE_BIN);
};

const openExplorerContextMenu = (win, clientX, clientY) => {
  const selected = selectedExplorerNodes(win);
  const recycle = win.currentFolderId === fs.RECYCLE_BIN;
  const protectedSelection = selected.some((id) => fs.isProtected(id));
  const menu = document.createElement("div");
  menu.className = "xp-context-menu explorer-context-menu";
  menu.setAttribute("role", "menu");
  const close = () => menu.remove();
  const add = (label, command, disabled = false) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.command = command;
    button.disabled = disabled;
    button.setAttribute("role", "menuitem");
    menu.appendChild(button);
  };
  if (recycle) {
    add("Restore", "restore", !selected.length);
    add("Delete Permanently", "permanent", !selected.length);
    add("Properties", "properties", selected.length !== 1);
  } else {
    add("Open", "open", selected.length !== 1);
    add("Cut", "cut", !selected.length || protectedSelection);
    add("Copy", "copy", !selected.length);
    add("Delete", "delete", !selected.length || protectedSelection);
    add("Rename", "rename", selected.length !== 1 || protectedSelection);
    add("Properties", "properties", selected.length !== 1);
  }
  win.el.appendChild(menu);
  const rect = win.el.getBoundingClientRect();
  menu.style.left = `${Math.max(0, Math.min(clientX - rect.left, rect.width - menu.offsetWidth - 2))}px`;
  menu.style.top = `${Math.max(25, Math.min(clientY - rect.top, rect.height - menu.offsetHeight - 2))}px`;
  menu.querySelector("button:not(:disabled)")?.focus();
  menu.addEventListener("click", (event) => {
    const command = event.target.dataset.command;
    if (!command) return;
    if (command === "open") fs.open(selected[0]);
    if (command === "cut") fileOps.cut(selected);
    if (command === "copy") fileOps.copy(selected);
    if (command === "restore") fileOps.restore(selected);
    if (command === "properties") XPDialogs.properties(selected[0]);
    if (command === "rename") {
      const name = window.prompt("Rename", fs.getNode(selected[0]).name);
      if (name !== null) fileOps.rename(selected[0], name);
    }
    if (command === "delete" || command === "permanent")
      XPDialogs.confirm(
        command === "permanent"
          ? "Are you sure you want to permanently delete the selected items?"
          : "Are you sure you want to send the selected items to the Recycle Bin?",
        "Confirm File Delete",
        "warning",
      ).then(
        (yes) =>
          yes &&
          (command === "permanent"
            ? fileOps.permanentlyDelete(selected)
            : confirmRecycleDelete(selected)),
      );
    close();
  });
  menu.addEventListener("keydown", (event) => {
    const buttons = [...menu.querySelectorAll("button:not(:disabled)")];
    const index = buttons.indexOf(document.activeElement);
    if (event.key === "Escape") {
      close();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      document.activeElement?.click();
      return;
    }
    if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const target =
        event.key === "Home"
          ? buttons[0]
          : event.key === "End"
            ? buttons.at(-1)
            : buttons[
                (index +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  buttons.length) %
                  buttons.length
              ];
      target?.focus();
    }
  });
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!menu.contains(event.target)) close();
    },
    { once: true },
  );
};

const createExplorerIcon = (node) => {
  const icon = document.createElement("span");
  icon.className = "explorer-item-icon";
  const addImage = (fileName) => {
    const image = document.createElement("img");
    image.src = XP_ICON_PATHS[fileName];
    image.alt = "";
    icon.appendChild(image);
    return icon;
  };

  if (node.id === fs.DRIVE_C || node.id === fs.DRIVE_D)
    return addImage("LocalDisk.png");
  if (node.id === fs.DRIVE_F) return addImage("RemovableMedia.png");
  if (node.id === fs.MY_MUSIC) return addImage("MyMusic.png");
  if (node.id === fs.MY_PICTURES) return addImage("MyPictures.png");
  if (node.id === fs.MY_COMPUTER) return addImage("MyComputer.png");
  if (node.app && systemShortcuts[node.app]) {
    const shortcut = createGameIconElement(node.app, "explorer-item-icon");
    shortcut.classList.remove("system-icon");
    return shortcut;
  }
  if (node.type === "folder") {
    return addImage("NewFolder.png");
  }

  const game = node.app ? gamesList[node.app] : null;
  if (game) {
    if (game.icon) {
      const image = document.createElement("img");
      image.src = game.icon;
      image.alt = "";
      icon.appendChild(image);
    } else {
      icon.classList.add("explorer-item-emoji");
      icon.textContent = getGameIcon(node.app);
    }
    return icon;
  }

  icon.classList.add("explorer-item-emoji");
  icon.textContent = "📄";
  return icon;
};

const explorerItemDescription = (node) => {
  if (node.id === fs.DRIVE_C || node.id === fs.DRIVE_D) return "Local Disk";
  if (node.id === fs.DRIVE_F) return "Removable Disk";
  if (node.type === "folder") return "File folder";
  if (node.app && gamesList[node.app]) return "Game";
  return `${(node.ext || "").replace(".", "").toUpperCase() || "File"} file`;
};

const openExplorerNode = (win, node) => {
  if (node.type === "folder") {
    navigateExplorer(win, node.id);
    return;
  }
  try {
    fs.open(node.id);
  } catch (error) {
    console.error(error);
  }
};

const renderExplorerItems = (win, contentRoot = win.el) => {
  const main = contentRoot.querySelector(".explorer-main");
  if (!main || !win.currentFolderId) return;
  const folder = fs.getNode(win.currentFolderId);
  if (!folder) return;

  win.el.querySelector(".title-text").textContent =
    folder.id === fs.MY_COMPUTER ? "My Computer" : folder.name;
  const titleIcon = win.el.querySelector(".title-icon");
  if (titleIcon) {
    titleIcon.replaceChildren();
    const image = document.createElement("img");
    image.src =
      folder.id === fs.RECYCLE_BIN
        ? getRecycleBinIconPath()
        : folder.id === fs.MY_COMPUTER
          ? "assets/xp/icons/MyComputer.png"
          : folder.id === fs.MY_MUSIC
            ? "assets/xp/icons/MyMusic.png"
            : folder.id === fs.MY_PICTURES
              ? "assets/xp/icons/MyPictures.png"
              : "assets/xp/icons/MyDocuments.png";
    image.alt = "";
    titleIcon.appendChild(image);
  }
  renderExplorerTree(win);
  renderExplorerTaskPane(win);

  const explorerContent = main.closest(".explorer-content");
  const chrome = explorerContent?.querySelector(".explorer-chrome");
  if (chrome) {
    chrome.querySelector("input").value = fs.getPath(folder.id);
    const addressIcon = chrome.querySelector(".explorer-address-field img");
    if (addressIcon) {
      addressIcon.src =
        folder.id === fs.RECYCLE_BIN
          ? getRecycleBinIconPath()
          : folder.id === fs.MY_COMPUTER
            ? XP_ICON_PATHS["MyComputer.png"]
            : folder.id === fs.MY_MUSIC
              ? XP_ICON_PATHS["MyMusic.png"]
              : folder.id === fs.MY_PICTURES
                ? XP_ICON_PATHS["MyPictures.png"]
                : XP_ICON_PATHS["MyDocuments.png"];
    }
    chrome.querySelector('[data-explorer-action="back"]').disabled =
      (win.historyIndex ?? 0) <= 0;
    chrome.querySelector('[data-explorer-action="forward"]').disabled =
      (win.historyIndex ?? -1) >= (win.history?.length ?? 0) - 1;
    chrome.querySelector('[data-explorer-action="up"]').disabled =
      !folder.parent &&
      ![fs.MY_COMPUTER, fs.RECYCLE_BIN].includes(win.currentFolderId);
  }

  const heading = main.querySelector("h2");
  if (win.currentFolderId === fs.RECYCLE_BIN) {
    const count = fs.getChildren(fs.RECYCLE_BIN).length;
    heading.textContent = count
      ? `${count} ${count === 1 ? "object" : "objects"}`
      : "The Recycle Bin is empty.";
  } else if (win.currentFolderId === systemFolderShortcuts[win.gameId]?.()) {
    heading.textContent = explorerDescriptions[win.gameId] || folder.name;
  } else {
    heading.textContent = folder.name;
  }
  heading.hidden = !heading.textContent || folder.id === fs.MY_COMPUTER;

  const items = main.querySelector(".explorer-items");
  items.dataset.view = win.explorerView || "tiles";
  items.innerHTML = "";

  const myComputerGroup = (node) =>
    [fs.MY_MUSIC, fs.MY_PICTURES].includes(node.id)
      ? "Files Stored on This Computer"
      : [fs.DRIVE_D, fs.DRIVE_F].includes(node.id)
        ? "Devices with Removable Storage"
        : "Hard Disk Drives";
  const myComputerGroupOrder = [
    "Files Stored on This Computer",
    "Hard Disk Drives",
    "Devices with Removable Storage",
  ];
  const myComputerOrder = [
    fs.MY_MUSIC,
    fs.MY_PICTURES,
    fs.DRIVE_C,
    fs.DRIVE_F,
    fs.DRIVE_D,
  ];
  const children = [
    ...(folder.id === fs.MY_COMPUTER
      ? [fs.getNode(fs.MY_MUSIC), fs.getNode(fs.MY_PICTURES)]
      : []),
    ...fs.getChildren(folder.id),
  ]
    .filter(Boolean)
    .sort((a, b) =>
      folder.id === fs.MY_COMPUTER
        ? myComputerGroupOrder.indexOf(myComputerGroup(a)) -
            myComputerGroupOrder.indexOf(myComputerGroup(b)) ||
          myComputerOrder.indexOf(a.id) - myComputerOrder.indexOf(b.id)
        : a.type === b.type
          ? a.name.localeCompare(b.name)
          : a.type === "folder"
            ? -1
            : 1,
    );

  if (!children.length) {
    const empty = document.createElement("p");
    empty.className = "explorer-empty";
    empty.textContent =
      win.currentFolderId === fs.RECYCLE_BIN
        ? "The Recycle Bin is empty."
        : "There are no items to show in this view.";
    items.appendChild(empty);
    const status = explorerContent?.querySelector(".explorer-status");
    if (status) status.textContent = "0 objects";
    if (win.currentFolderId === fs.RECYCLE_BIN) {
      win.el.querySelectorAll(".recycle-task").forEach((button) => {
        button.disabled = true;
      });
    }
    return;
  }

  if (items.dataset.view === "details") {
    const header = document.createElement("div");
    header.className = "explorer-details-header";
    header.innerHTML = "<span>Name</span><span>Type</span><span>Size</span>";
    items.appendChild(header);
  }

  let currentGroup = "";
  children.forEach((node) => {
    if (folder.id === fs.MY_COMPUTER) {
      const group = myComputerGroup(node);
      if (group !== currentGroup) {
        const groupHeading = document.createElement("h3");
        groupHeading.className = "explorer-group-heading";
        groupHeading.textContent = group;
        items.appendChild(groupHeading);
        currentGroup = group;
      }
    }
    const item = document.createElement("button");
    item.type = "button";
    item.className = "explorer-item";
    item.dataset.nodeId = node.id;
    item.draggable = !node.protected;
    item.title = node.name;

    const label = document.createElement("span");
    const name = document.createElement("b");
    const myComputerNames = {
      [fs.MY_MUSIC]: "Shared Documents",
      [fs.MY_PICTURES]: "Administrator's Documents",
      [fs.DRIVE_F]: "3½ Floppy (A:)",
      [fs.DRIVE_D]: "GRTMPVOL_EN (D:)",
    };
    name.textContent =
      folder.id === fs.MY_COMPUTER
        ? myComputerNames[node.id] || node.name
        : node.name;
    const description = document.createElement("small");
    description.textContent = explorerItemDescription(node);
    label.appendChild(name);
    if (folder.id !== fs.MY_COMPUTER) label.appendChild(description);

    const itemIcon = createExplorerIcon(node);
    if (
      folder.id === fs.MY_COMPUTER &&
      [fs.MY_MUSIC, fs.MY_PICTURES].includes(node.id)
    ) {
      itemIcon.querySelector("img").src = XP_ICON_PATHS["NewFolder.png"];
    } else if (folder.id === fs.MY_COMPUTER && node.id === fs.DRIVE_D) {
      itemIcon.querySelector("img").src = XP_ICON_PATHS["OpticalDrive.png"];
    }
    item.append(itemIcon, label);
    if (folder.id === fs.MY_COMPUTER) item.classList.add("my-computer-item");
    if (items.dataset.view === "details") {
      item.classList.add("explorer-details-row");
      const type = document.createElement("span");
      type.className = "explorer-detail-type";
      type.textContent = explorerItemDescription(node);
      const size = document.createElement("span");
      size.className = "explorer-detail-size";
      size.textContent =
        node.type === "folder"
          ? ""
          : XPDialogs.formatBytes(fs.getSize(node.id));
      item.append(type, size);
    }
    item.addEventListener("click", (event) => {
      if (!event.ctrlKey && !event.metaKey) {
        items
          .querySelectorAll(".selected")
          .forEach((entry) => entry.classList.remove("selected"));
      }
      item.classList.add("selected");
    });
    item.addEventListener("dragstart", (event) => {
      const ids = selectedExplorerNodes(win);
      event.dataTransfer.setData(
        "application/x-astro-vfs-ids",
        JSON.stringify(ids.includes(node.id) ? ids : [node.id]),
      );
      event.dataTransfer.effectAllowed = "move";
    });
    item.addEventListener("dblclick", () => openExplorerNode(win, node));
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        openExplorerNode(win, node);
      }
      if (e.key === "F2" && !node.protected) {
        e.preventDefault();
        const next = window.prompt("Rename", node.name);
        if (next !== null) fileOps.rename(node.id, next);
      }
    });
    item.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      item.click();
      openExplorerContextMenu(win, event.clientX, event.clientY);
    });
    if (node.type === "folder") wireFolderDropTarget(item, node.id);
    items.appendChild(item);
  });
  const status = explorerContent?.querySelector(".explorer-status");
  if (status)
    status.textContent = `${children.length} ${children.length === 1 ? "object" : "objects"}`;
  if (win.currentFolderId === fs.RECYCLE_BIN) {
    win.el.querySelectorAll(".recycle-task").forEach((button) => {
      button.disabled = false;
    });
  }
};

// Games participate in the filesystem as ".game" files on the Desktop,
// opened through the registered file association.
const gameFileName = (gameId) =>
  `${formatGameTitle(gameId)
    // eslint-disable-next-line no-control-regex -- Windows rejects ASCII control characters.
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()}.game`;

const syncGameFiles = () => {
  Object.keys(gamesList).forEach((gameId) => {
    // Managed shortcuts remain valid after the user renames, moves, or
    // recycles them. Only recreate one after it has been destroyed.
    if (fs.findByApp(gameId).length) return;
    try {
      fs.createFile(fs.DESKTOP, gameFileName(gameId), { app: gameId });
    } catch (error) {
      console.error(error);
    }
  });
};

window.addEventListener("message", (event) => {
  if (event.origin !== location.origin) return;
  const message = event.data;
  if (message?.event === "astro.game-data-retention") {
    const win = openWindows.get(message.gameId);
    if (win && event.source === win.player?.contentWindow) {
      win.removeGameDataOnClose =
        message.keep === false
          ? {
              storageId: message.storageId || message.gameId,
              fileName: message.fileName,
            }
          : false;
    }
    return;
  }
  if (message?.event !== "astro.offline-game-ready") {
    return;
  }
  const offlineGameIds = new Set([
    "revcdos",
    "pink-panther-passport-to-peril",
    "pink-panther-hokus-pokus",
  ]);
  if (!offlineGameIds.has(message.gameId)) return;
  const win = openWindows.get(message.gameId);
  if (!win || event.source !== win.player?.contentWindow) return;
  offlineManager.downloadGame(message.gameId).catch((error) => {
    console.error("Could not add reVCDOS to Offline Games:", error);
  });
});

fs.registerFileType(".game", (file) => {
  if (file.app && gamesList[file.app]) {
    openGameWindow(file.app);
  }
});
fs.registerFileType("app:__recycle-bin", () =>
  openSystemWindow("__recycle-bin"),
);

const restoreDefaultDesktop = () => {
  Object.keys(gamesList).forEach((gameId) => {
    fs.findByApp(gameId).forEach((node) => fs.destroy(node.id));
  });
  localStorage.removeItem("desktopIconPositions");
  localStorage.removeItem("desktopLayoutSettings");
  syncGameFiles();
};

const resetAstroFlash = () => {
  USER_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  fs.reset();
  syncGameFiles();
};

const NOTEPAD_ID = "__notepad";
