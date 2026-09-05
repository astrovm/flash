"use strict";

// ============================================
// Start Menu
// ============================================

const createMenuGameItem = (gameId) => {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "sm-game";

  const icon = createGameIconElement(gameId, "sm-game-icon");

  const title = document.createElement("span");
  title.className = "sm-game-title";
  title.textContent = formatGameTitle(gameId);

  item.append(icon, title);

  const stats = getGameStats()[gameId];
  if (stats) {
    const playCount = document.createElement("span");
    playCount.className = "play-count";
    playCount.textContent = `${stats.plays} ${stats.plays === 1 ? "play" : "plays"}`;
    item.appendChild(playCount);
  }

  item.addEventListener("click", () => {
    closeStartMenu();
    openGameWindow(gameId);
  });
  return item;
};

const getProgramGroups = () => {
  const groups = {};
  const addToGroup = (category, gameId) => {
    if (!groups[category]) groups[category] = [];
    groups[category].push(gameId);
  };

  Object.entries(getGameStats())
    .sort((left, right) => right[1].lastPlayed - left[1].lastPlayed)
    .slice(0, 8)
    .forEach(([gameId]) => {
      if (gamesList[gameId]) addToGroup("Recently Played", gameId);
    });

  getFavorites().forEach((gameId) => {
    if (gamesList[gameId]) addToGroup("Favorites", gameId);
  });

  Object.entries(gamesList).forEach(([gameId, game]) =>
    addToGroup(game.category || "Other", gameId),
  );

  return Object.keys(groups)
    .sort((left, right) => {
      if (left === "Recently Played") return -1;
      if (right === "Recently Played") return 1;
      if (left === "Favorites") return -1;
      if (right === "Favorites") return 1;
      return left.localeCompare(right);
    })
    .map((category) => [
      category,
      groups[category]
        .slice()
        .sort((left, right) =>
          formatGameTitle(left).localeCompare(formatGameTitle(right)),
        ),
    ]);
};

const openRecentDocuments = () => {
  const dialog = XPDialogs.createDialog({ title: "My Recent Documents" });
  const recentGames = Object.entries(getGameStats())
    .filter(([gameId]) => gamesList[gameId])
    .sort(([, a], [, b]) => b.lastPlayed - a.lastPlayed)
    .slice(0, 10)
    .map(([gameId]) => gameId);

  const heading = document.createElement("p");
  heading.textContent = "Documents you have opened recently:";
  dialog.body.appendChild(heading);

  if (!recentGames.length) {
    const empty = document.createElement("p");
    empty.textContent = "There are no recent documents.";
    dialog.body.appendChild(empty);
  } else {
    const list = document.createElement("div");
    list.className = "shell-dialog-list";
    recentGames.forEach((gameId) => {
      const item = document.createElement("button");
      item.type = "button";
      item.textContent = formatGameTitle(gameId);
      item.addEventListener("click", () => {
        dialog.close();
        openGameWindow(gameId);
      });
      list.appendChild(item);
    });
    dialog.body.appendChild(list);
  }
  XPDialogs.addButtonRow(dialog, [
    { id: "close", label: "Close", isDefault: true, isCancel: true },
  ]);
};

const openControlPanel = () => openSystemWindow("__control-panel");

const openAboutWindows = () => {
  const dialog = XPDialogs.createDialog({ title: "About Windows" });
  dialog.el.classList.add("about-windows-dialog");
  dialog.body.innerHTML = `
    <img class="about-windows-banner" src="assets/xp/AboutWindows.png" alt="Microsoft Windows XP Professional">
    <div class="about-windows-copy">
      <p>Microsoft ® Windows<br>Version 5.1 (Build 2600.xpsp.080413-2111 : Service Pack 3)<br>Copyright © 2007 Microsoft Corporation</p>
      <p>This product is licensed under the terms of the <a href="https://www.microsoft.com/useterms/" target="_blank" rel="noreferrer">End-User<br>License Agreement</a> to:</p>
      <p class="about-windows-user">astro</p>
      <hr>
      <p>Physical memory available to Windows:&nbsp;&nbsp; 523,696 KB</p>
    </div>
  `;
  XPDialogs.addButtonRow(dialog, [
    { id: "ok", label: "OK", isDefault: true, isCancel: true },
  ]);
};

const openShellProperties = (nodeId) => XPDialogs.properties(nodeId);

const openSearchDialog = () => openSystemWindow("__search");

const openRunDialog = () => {
  const dialog = XPDialogs.createDialog({ title: "Run" });
  dialog.el.classList.add("run-dialog");
  const introRow = document.createElement("div");
  introRow.className = "run-dialog-intro";
  const icon = document.createElement("img");
  icon.src = "assets/xp/icons/Run.png";
  icon.alt = "";
  const intro = document.createElement("p");
  intro.textContent =
    "Type the name of a program, folder, document, or Internet resource, and Windows will open it for you.";
  introRow.append(icon, intro);
  const prompt = document.createElement("label");
  const promptText = document.createElement("span");
  setAccessKeyText(promptText, "&Open:");
  const input = document.createElement("input");
  input.type = "text";
  input.className = "shell-dialog-input";
  input.setAttribute("list", "run-command-history");
  input.id = "run-command";
  const history = document.createElement("datalist");
  history.id = "run-command-history";
  getRunHistory().forEach((entry) =>
    history.appendChild(new Option(entry, entry)),
  );
  prompt.append(promptText, input);
  const status = document.createElement("p");
  status.className = "shell-dialog-status";
  status.hidden = true;
  const run = () => {
    const resolved = resolveShellCommand(input.value);
    if (!resolved || resolved.run() === false) {
      status.textContent = `Windows cannot find "${input.value}". Make sure you typed the name correctly, and then try again.`;
      XPDialogs.alert(status.textContent, "Run", "error");
      return;
    }
    rememberRunCommand(input.value);
    dialog.close();
  };
  const runButton = XPDialogs.createDialogButton(
    { id: "run", label: "&OK" },
    run,
  );
  const browseButton = XPDialogs.createDialogButton(
    { id: "browse", label: "&Browse..." },
    async () => {
      const node = await XPDialogs.openFile({ title: "Browse" });
      if (node) input.value = fs.getPath(node.id);
      input.focus();
    },
  );
  const cancelButton = XPDialogs.createDialogButton(
    { id: "cancel", label: "Cancel" },
    () => dialog.close(),
  );
  const row = document.createElement("div");
  row.className = "dlg-buttons";
  row.append(runButton, cancelButton, browseButton);
  dialog.body.append(introRow, prompt, history, status, row);
  dialog.defaultButton = runButton;
  [
    [runButton, "&OK"],
    [cancelButton, "Cancel"],
    [browseButton, "&Browse..."],
  ].forEach(([button, label]) => {
    const { key } = XPDialogs.parseAccessKey(label);
    if (key && !dialog.accessKeys.has(key)) dialog.accessKeys.set(key, button);
  });
  dialog.accessKeys.set("o", { disabled: false, click: () => input.focus() });
  input.focus();
};

const startDestinationActions = {
  documents: () => openSystemWindow("__my-documents"),
  recent: openRecentDocuments,
  pictures: () => openSystemWindow("__my-pictures"),
  music: () => openSystemWindow("__my-music"),
  computer: () => openSystemWindow("__my-computer"),
  controlPanel: openControlPanel,
  search: openSearchDialog,
  run: openRunDialog,
};

const buildPlaces = () => {
  const container = document.getElementById("start-menu-places");
  const style = getStartMenuStyle();
  if (renderedPlacesStyle === style) return;
  renderedPlacesStyle = style;
  container.replaceChildren();

  const createPlace = ({
    id,
    label,
    icon,
    title = label,
    action,
    children,
  }) => {
    const { key } = XPDialogs.parseAccessKey(label);
    const item = document.createElement("button");
    item.className = "sm-place";
    item.type = "button";
    if (id) item.dataset.startAction = id;
    item.dataset.accessKey = key;
    item.title = XPDialogs.parseAccessKey(title).text;

    const glyph = document.createElement("span");
    glyph.className = "sm-place-icon";
    if (icon.endsWith(".png")) {
      const image = document.createElement("img");
      image.src = XP_ICON_PATHS[icon];
      image.alt = "";
      glyph.appendChild(image);
    } else {
      glyph.textContent = icon;
    }

    const text = document.createElement("span");
    setAccessKeyText(text, label);
    item.append(glyph, text);
    if (children) {
      item.classList.add("classic-start-folder");
      item.setAttribute("aria-haspopup", "menu");
      const arrow = document.createElement("span");
      arrow.className = "start-program-arrow";
      arrow.textContent = "▶";
      item.appendChild(arrow);
      const open = (focusFirst = false) => {
        openProgramSubmenu(children, item, 0);
        if (focusFirst)
          document
            .querySelector("#start-menu-flyouts .start-program-flyout button")
            ?.focus();
      };
      item.addEventListener("pointerenter", () => {
        clearTimeout(startFlyoutTimer);
        startFlyoutTimer = setTimeout(open, 220);
      });
      // Without clearing here, a hover just before the click leaves its
      // 220ms timer pending; it later fires open() again on its own stale
      // closure over this item, which can reposition the flyout against
      // whatever the anchor's rect happens to be by then.
      item.addEventListener("click", () => {
        clearTimeout(startFlyoutTimer);
        open(true);
      });
      item.addEventListener("keydown", (event) => {
        if (!["ArrowRight", "Enter"].includes(event.key)) return;
        event.preventDefault();
        clearTimeout(startFlyoutTimer);
        open(true);
      });
    } else {
      item.addEventListener("click", () => {
        closeStartMenu();
        (action || startDestinationActions[id])();
      });
    }
    return item;
  };

  container.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const item = container.querySelector(
      `[data-access-key="${event.key.toLowerCase()}"]`,
    );
    if (!item) return;
    event.preventDefault();
    item.click();
  });

  if (style === "classic") {
    const documents = [
      {
        label: "My &Documents",
        icon: "MyDocuments.png",
        action: startDestinationActions.documents,
      },
      {
        label: "My &Pictures",
        icon: "MyPictures.png",
        action: startDestinationActions.pictures,
      },
      {
        label: "My &Music",
        icon: "MyMusic.png",
        action: startDestinationActions.music,
      },
    ];
    const settings = [
      {
        label: "&Control Panel",
        icon: "ControlPanel.png",
        action: startDestinationActions.controlPanel,
      },

      {
        label: "Taskbar and Start &Menu",
        icon: "TaskbarAndStartMenu.png",
        action: openTaskbarProperties,
      },
    ];
    [
      { label: "&Documents", icon: "RecentDocuments.png", children: documents },
      { label: "&Settings", icon: "ControlPanel.png", children: settings },
      { id: "search", label: "&Search", icon: "Search.png" },

      { id: "run", label: "&Run...", icon: "Run.png" },
    ].forEach((definition) => container.appendChild(createPlace(definition)));
    return;
  }

  [
    ["documents", "My &Documents", "MyDocuments.png"],
    ["recent", "My &Recent Documents", "RecentDocuments.png"],
    ["pictures", "My &Pictures", "MyPictures.png"],
    ["music", "My &Music", "MyMusic.png"],
    ["computer", "My &Computer", "MyComputer.png"],
  ].forEach(([id, label, icon]) =>
    container.appendChild(createPlace({ id, label, icon })),
  );

  const separatorOne = document.createElement("div");
  separatorOne.className = "sm-place-separator";
  container.appendChild(separatorOne);

  [["controlPanel", "&Control Panel", "ControlPanel.png"]].forEach(
    ([id, label, icon]) =>
      container.appendChild(createPlace({ id, label, icon })),
  );

  [
    ["search", "&Search", "Search.png"],
    ["run", "&Run...", "Run.png"],
  ].forEach(([id, label, icon]) =>
    container.appendChild(createPlace({ id, label, icon })),
  );
};

const buildPinnedPrograms = () => {
  const container = document.getElementById("start-menu-pinned");
  container.innerHTML = "";

  const allProgramsLabel = document.querySelector(
    "#all-programs-button > .all-programs-label",
  );
  const allProgramsButton = document.getElementById("all-programs-button");
  allProgramsButton.querySelector(".all-programs-icon")?.remove();
  if (getStartMenuStyle() === "classic") {
    allProgramsLabel.textContent = "Programs";
    const programsIcon = document.createElement("span");
    programsIcon.className = "all-programs-icon";
    const programsImage = document.createElement("img");
    programsImage.src = XP_ICON_PATHS["Programs.png"];
    programsImage.alt = "";
    programsIcon.appendChild(programsImage);
    allProgramsButton.prepend(programsIcon);
    return;
  }
  allProgramsLabel.textContent = "All Programs";

  const internetGames = document.createElement("button");
  internetGames.type = "button";
  internetGames.className = "sm-game";
  const internetIcon = createGameIconElement(
    "__internet-games",
    "sm-game-icon",
  );
  const internetTitle = document.createElement("span");
  internetTitle.className = "sm-game-title";
  internetTitle.textContent = "Internet Games";
  internetGames.append(internetIcon, internetTitle);
  internetGames.addEventListener("click", () => {
    closeStartMenu();
    openSystemWindow("__internet-games");
  });
  container.appendChild(internetGames);

  const gameStats = getGameStats();
  const recentGames = Object.entries(gameStats)
    .filter(([gameId]) => gamesList[gameId])
    .sort((a, b) => b[1].lastPlayed - a[1].lastPlayed)
    .map(([gameId]) => gameId);

  const pinned = [
    ...getFavorites().filter((gameId) => gamesList[gameId]),
    ...recentGames,
    ...Object.keys(gamesList).sort((a, b) =>
      formatGameTitle(a).localeCompare(formatGameTitle(b)),
    ),
  ]
    .filter((gameId, index, all) => all.indexOf(gameId) === index)
    .slice(0, 6);

  pinned.forEach((gameId) => container.appendChild(createMenuGameItem(gameId)));
};

let startFlyoutTimer = null;
const closeAllPrograms = () => {
  clearTimeout(startFlyoutTimer);
  const host = document.getElementById("start-menu-flyouts");
  host.replaceChildren();
  host.hidden = true;
  document.getElementById("all-programs-button").classList.remove("active");
};

const positionStartFlyout = (panel, anchor) => {
  const rect = anchor.getBoundingClientRect();
  const taskbarTop =
    document.getElementById("taskbar")?.getBoundingClientRect().top ??
    innerHeight;
  panel.style.visibility = "hidden";
  panel.style.left = "0px";
  panel.style.top = "0px";
  panel.style.maxHeight = `${Math.max(80, taskbarTop - 4)}px`;
  const width = panel.offsetWidth;
  const height = panel.offsetHeight;
  const right = rect.right + width <= innerWidth - 2;
  panel.style.left = `${Math.max(2, Math.min(right ? rect.right : rect.left - width, innerWidth - width - 2))}px`;
  panel.style.top = `${Math.max(2, Math.min(rect.top, taskbarTop - height - 2))}px`;
  panel.style.visibility = "";
};

const wireStartFlyoutKeyboard = (panel, parentButton) => {
  panel.addEventListener("keydown", (event) => {
    const items = [...panel.querySelectorAll("button")];
    const index = items.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      closeAllPrograms();
      parentButton.focus();
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next =
        event.key === "Home"
          ? items[0]
          : event.key === "End"
            ? items.at(-1)
            : items[
                (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
                  items.length
              ];
      next?.focus();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      parentButton.focus();
      return;
    }
    const item = items.find(
      (entry) => entry.dataset.accessKey === event.key.toLowerCase(),
    );
    if (item) {
      event.preventDefault();
      item.click();
    }
  });
};

const xpProgramMenuItem = (programId, id = programId.slice(2)) => {
  const program = window.XPApplicationRegistry.get(programId);
  return {
    id,
    label: program.title,
    icon: program.icon,
    action: () => openXPProgram(programId),
  };
};

const getAllProgramsTree = () => {
  const programFolder = "ProgramFolder.png";
  const gameGroups = getProgramGroups().map(([category, games]) => ({
    label: category,
    icon: programFolder,
    children: games.map((gameId) => ({ gameId })),
  }));
  return [
    {
      id: "accessories",
      label: "Accessories",
      icon: programFolder,
      children: [
        {
          id: "entertainment",
          label: "Entertainment",
          icon: programFolder,
          children: [xpProgramMenuItem("__volume-control")],
        },
        xpProgramMenuItem("__calculator"),
        xpProgramMenuItem("__command-prompt"),
        {
          id: "notepad",
          label: "Notepad",
          icon: "Notepad.png",
          action: openNotepad,
        },
        xpProgramMenuItem("__paint"),
        xpProgramMenuItem("__wordpad"),
        {
          id: "windows-explorer",
          label: "Windows Explorer",
          icon: "WindowsExplorer.png",
          action: () => openSystemWindow("__my-documents"),
        },
      ],
    },
    {
      id: "games",
      label: "Games",
      icon: programFolder,
      children: [
        xpProgramMenuItem("__freecell"),
        xpProgramMenuItem("__hearts"),
        xpProgramMenuItem("__minesweeper"),
        xpProgramMenuItem("__pinball"),
        xpProgramMenuItem("__solitaire"),
        xpProgramMenuItem("__spider-solitaire"),
        { separator: true },
        ...gameGroups,
      ],
    },
    { separator: true },
    {
      id: "astro-settings",
      label: "Astro Flash Settings",
      icon: "ControlPanel.png",
      action: openProjectSettings,
    },
    {
      id: "internet-games",
      label: "Internet Games",
      icon: "AddRemovePrograms.png",
      action: () => openSystemWindow("__internet-games"),
    },
  ];
};

const createProgramMenuItem = (definition, depth) => {
  if (definition.gameId) {
    const item = createMenuGameItem(definition.gameId);
    item.setAttribute("role", "menuitem");
    return item;
  }
  const item = document.createElement("button");
  item.type = "button";
  item.className = definition.children
    ? "start-program-item start-program-folder"
    : "start-program-item";
  item.setAttribute("role", "menuitem");
  if (definition.id) item.dataset.programId = definition.id;
  const icon = document.createElement("span");
  icon.className = "start-program-icon";
  if (definition.icon) {
    const image = document.createElement("img");
    image.src = definition.icon.includes("/")
      ? definition.icon
      : XP_ICON_PATHS[definition.icon];
    image.alt = "";
    icon.appendChild(image);
  }
  const label = document.createElement("span");
  const { key } = setAccessKeyText(label, definition.label);
  item.dataset.accessKey = key;
  item.append(icon, label);
  if (definition.children) {
    item.setAttribute("aria-haspopup", "menu");
    const arrow = document.createElement("span");
    arrow.className = "start-program-arrow";
    arrow.textContent = "▶";
    item.appendChild(arrow);
    const open = (focusFirst = false) => {
      if (["accessories", "games"].includes(definition.id)) {
        window.XPBoxedWinePreload?.preload().catch(() => {});
      }
      openProgramSubmenu(definition.children, item, depth + 1);
      if (focusFirst)
        document
          .querySelectorAll("#start-menu-flyouts .start-program-flyout")
          [depth + 1]?.querySelector("button")
          ?.focus();
    };
    item.addEventListener("pointerenter", () => {
      clearTimeout(startFlyoutTimer);
      startFlyoutTimer = setTimeout(open, 220);
    });
    // Without clearing here, a hover just before the click leaves its
    // 220ms timer pending; it later fires open() again on its own stale
    // closure over this item, which can reposition the flyout against
    // whatever the anchor's rect happens to be by then.
    item.addEventListener("click", () => {
      clearTimeout(startFlyoutTimer);
      open(true);
    });
    item.addEventListener("keydown", (event) => {
      if (!["ArrowRight", "Enter"].includes(event.key)) return;
      event.preventDefault();
      clearTimeout(startFlyoutTimer);
      open(true);
    });
  } else {
    item.addEventListener("click", () => {
      closeStartMenu();
      definition.action();
    });
  }
  return item;
};

const openProgramSubmenu = (definitions, anchor, depth = 0) => {
  // A detached anchor (e.g. a stale hover-timer firing after the menu
  // already closed/rebuilt) has an all-zero getBoundingClientRect(), which
  // positionStartFlyout would otherwise clamp to the top-left corner.
  if (!anchor.isConnected) return;
  const host = document.getElementById("start-menu-flyouts");
  [...host.querySelectorAll(".start-program-flyout")]
    .slice(depth)
    .forEach((panel) => panel.remove());
  const panel = document.createElement("div");
  panel.className = "start-program-flyout";
  panel.setAttribute("role", "menu");
  panel.dataset.depth = String(depth);
  definitions.forEach((definition) => {
    if (definition.separator) {
      const separator = document.createElement("span");
      separator.className = "start-program-separator";
      separator.setAttribute("role", "separator");
      panel.appendChild(separator);
    } else {
      panel.appendChild(createProgramMenuItem(definition, depth));
    }
  });
  host.appendChild(panel);
  host.hidden = false;
  positionStartFlyout(panel, anchor);
  wireStartFlyoutKeyboard(panel, anchor);
  panel.addEventListener("pointerenter", () => clearTimeout(startFlyoutTimer));
  panel.addEventListener("pointerleave", () => {
    startFlyoutTimer = setTimeout(closeAllPrograms, 420);
  });
};

const openAllPrograms = (focusFirst = false) => {
  clearTimeout(startFlyoutTimer);
  const host = document.getElementById("start-menu-flyouts");
  const button = document.getElementById("all-programs-button");
  host.replaceChildren();
  host.hidden = false;
  button.classList.add("active");
  openProgramSubmenu(getAllProgramsTree(), button, 0);
  if (focusFirst) host.querySelector(".start-program-flyout button")?.focus();
};

const toggleAllPrograms = () => {
  const host = document.getElementById("start-menu-flyouts");
  if (host.hidden) openAllPrograms(true);
  else closeAllPrograms();
};

const openStartMenu = () => {
  const classic = getStartMenuStyle() === "classic";
  buildPinnedPrograms();
  buildPlaces();
  closeAllPrograms();
  document.querySelector(".start-menu-user").textContent = classic
    ? "Windows XP Professional"
    : "astro";
  document.getElementById("log-off-button").lastChild.textContent = classic
    ? " Log Off astro..."
    : " Log Off";
  document.getElementById("turn-off-button").lastChild.textContent = classic
    ? " Turn Off Computer..."
    : " Turn Off Computer";
  document.getElementById("start-menu").hidden = false;
  document.getElementById("start-button").classList.add("active");
};

const closeStartMenu = () => {
  closeAllPrograms();
  document.getElementById("start-menu").hidden = true;
  document.getElementById("start-button").classList.remove("active");
};

const toggleStartMenu = () => {
  const startMenu = document.getElementById("start-menu");
  if (startMenu.hidden) {
    openStartMenu();
  } else {
    closeStartMenu();
  }
};

const setupSearch = () => {
  const button = document.getElementById("all-programs-button");
  button.addEventListener("click", toggleAllPrograms);
  button.addEventListener("pointerenter", () => {
    if (!document.getElementById("start-menu").hidden) {
      clearTimeout(startFlyoutTimer);
      startFlyoutTimer = setTimeout(openAllPrograms, 220);
    }
  });
  button.addEventListener("keydown", (event) => {
    if (["ArrowRight", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      openAllPrograms(true);
    }
  });
};
