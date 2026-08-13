"use strict";

// ============================================
// System Tray
// ============================================

const getMasterVolume = () => ({
  volume: parseInt(localStorage.getItem("volume") || "100", 10),
  isMuted: localStorage.getItem("isMuted") === "true",
});

const syncTrayVolumeUI = () => {
  const { volume, isMuted } = getMasterVolume();
  const button = document.getElementById("tray-volume-button");
  const slider = document.getElementById("tray-volume-slider");
  const muteBox = document.getElementById("tray-mute-checkbox");
  button.classList.toggle("muted", isMuted || volume === 0);
  button.title = isMuted ? "Volume (muted)" : "Volume";
  slider.value = String(volume);
  muteBox.checked = isMuted;
};

const setMasterVolume = (volume, isMuted) => {
  localStorage.setItem("volume", String(volume));
  localStorage.setItem("isMuted", String(isMuted));
  applyFocusVolumes();
  openWindows.forEach((win) => syncWindowVolumeUI(win));
  syncTrayVolumeUI();
};

const closeTrayVolumePopup = () => {
  const popup = document.getElementById("tray-volume-popup");
  const button = document.getElementById("tray-volume-button");
  if (!popup || !button) return;
  popup.hidden = true;
  button.classList.remove("pressed");
};

const openTrayVolumePopup = () => {
  const popup = document.getElementById("tray-volume-popup");
  const button = document.getElementById("tray-volume-button");
  syncTrayVolumeUI();
  popup.hidden = false;
  button.classList.add("pressed");
  const rect = button.getBoundingClientRect();
  const left = Math.max(
    4,
    Math.min(
      rect.left + rect.width / 2 - popup.offsetWidth / 2,
      window.innerWidth - popup.offsetWidth - 4,
    ),
  );
  popup.style.left = `${left}px`;
  popup.style.top = `${rect.top - popup.offsetHeight - 4}px`;
  document.getElementById("tray-volume-slider").focus();
};

const toggleTrayVolumePopup = () => {
  if (document.getElementById("tray-volume-popup").hidden) {
    openTrayVolumePopup();
  } else {
    closeTrayVolumePopup();
  }
};

// Connection "duration" counts from logon, like an XP dial-up/LAN session.
let networkConnectedAt = Date.now();

const formatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
};

const openNetworkStatus = () => {
  const dialog = XPDialogs.createDialog({
    title: "Local Area Connection Status",
  });

  const header = document.createElement("div");
  header.className = "dlg-props-header";
  const icon = document.createElement("img");
  icon.className = "dlg-network-icon";
  icon.src = "assets/xp/icons/NetworkConnection.png";
  icon.alt = "";
  icon.draggable = false;
  const name = document.createElement("span");
  name.className = "dlg-props-name";
  name.textContent = "Local Area Connection";
  header.append(icon, name);

  const table = document.createElement("dl");
  table.className = "dlg-props-table";
  const cells = {};
  const addRow = (label, id, value) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.id = id;
    dd.textContent = value;
    table.append(dt, dd);
    cells[id] = dd;
  };
  addRow("Status:", "network-status-state", "Connected");
  addRow("Duration:", "network-status-duration", "00:00:00");
  addRow("Speed:", "network-status-speed", "100.0 Mbps");
  addRow("Packets Sent:", "network-status-sent", "0");
  addRow("Packets Received:", "network-status-received", "0");

  dialog.body.append(header, table);
  XPDialogs.addButtonRow(dialog, [
    { id: "close", label: "Close", isDefault: true, isCancel: true },
  ]);

  let sent = Math.floor(1000 + Math.random() * 9000);
  let received = Math.floor(sent * (1.4 + Math.random()));
  const tick = () => {
    sent += Math.floor(Math.random() * 40);
    received += Math.floor(Math.random() * 60);
    cells["network-status-duration"].textContent = formatDuration(
      Date.now() - networkConnectedAt,
    );
    cells["network-status-sent"].textContent = sent.toLocaleString("en-US");
    cells["network-status-received"].textContent =
      received.toLocaleString("en-US");
  };
  tick();
  const timer = setInterval(tick, 1000);
  dialog.onResult(() => clearInterval(timer));
};

let offlineManagerInitialized = false;

const offlineStatusText = (state) => {
  const messages = {
    starting: "Preparing Windows XP system files...",
    downloading: "Downloading Windows XP system files...",
    ready: "Windows XP system files are available offline.",
    checking: "Checking for updates...",
    updating: "Downloading the latest update...",
    "update-available": state.enabled
      ? "An update is downloading..."
      : "An update is available.",
    "update-pending": "A newer update is waiting for its stability delay.",
    "update-ready":
      "An update is ready and will install automatically on the next load.",
    "repair-required":
      "The installed update is incomplete. Repair the system files.",
    applying: "Applying the update...",
    repairing: "Clearing and downloading system files again...",
    error: "Offline system files are incomplete.",
  };
  const message = messages[state.phase] || "Offline status is unavailable.";
  return state.error ? `${message} ${state.error}` : message;
};

const formatUpdateCheckTime = (timestamp) =>
  timestamp ? new Date(timestamp).toLocaleString() : "Never";

const formatProjectBytes = (bytes) =>
  XPDialogs.formatBytes(bytes).replace(/\s+\([^)]*\)$/, "");

const projectStorageText = (state) => {
  if (state.usage === null) return "Unavailable";
  return formatProjectBytes(state.usage);
};

const formatProjectState = (value) =>
  value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : "Unavailable";

const initializeOfflineMode = () => {
  if (offlineManagerInitialized || window.ASTRO_DEV) {
    return offlineManagerInitialization;
  }
  offlineManagerInitialized = true;
  offlineManagerInitialization = offlineManager.initialize().catch((error) => {
    console.error("Offline mode initialization failed:", error);
    throw error;
  });
  return offlineManagerInitialization;
};

const saveBundledGameForOffline = (gameId) => {
  if (window.ASTRO_DEV || navigator.onLine === false) {
    return;
  }

  automaticOfflineDownloadQueue = automaticOfflineDownloadQueue
    .catch(() => {})
    .then(async () => {
      await offlineManagerInitialization;
      const snapshot = offlineManager.getSnapshot();
      if (!snapshot.bundledGames.some((game) => game.id === gameId)) {
        return;
      }
      if (snapshot.downloadedGameIds.includes(gameId)) {
        return;
      }
      await offlineManager.downloadGame(gameId);
    })
    .catch((error) => {
      console.warn(
        "Could not save game for offline play:",
        formatGameTitle(gameId),
        error,
      );
    });
};

const wireProjectSettings = (win) => {
  const content = win.el.querySelector(".project-settings-content");
  const bundledGameCount = Object.keys(window.FLASH_GAMES).length;
  content.innerHTML = `
    <div class="project-settings-tabs" role="tablist" aria-label="Astro Flash Settings">
      <button type="button" role="tab" class="active" id="project-tab-general" aria-controls="project-panel-general" aria-selected="true">General</button>
      <button type="button" role="tab" id="project-tab-offline" aria-controls="project-panel-offline" aria-selected="false" tabindex="-1">Offline</button>
      <button type="button" role="tab" id="project-tab-game-data" aria-controls="project-panel-game-data" aria-selected="false" tabindex="-1">Game Data</button>
      <button type="button" role="tab" id="project-tab-updates" aria-controls="project-panel-updates" aria-selected="false" tabindex="-1">Updates</button>
      <button type="button" role="tab" id="project-tab-recovery" aria-controls="project-panel-recovery" aria-selected="false" tabindex="-1">Recovery</button>
    </div>
    <section class="project-settings-panel active" id="project-panel-general" role="tabpanel" aria-labelledby="project-tab-general">
      <div class="project-settings-product">
        <img src="assets/xp/icons/ControlPanel.png" alt="">
        <div>
          <h2>Astro Flash</h2>
          <p data-project-value="connection"></p>
        </div>
      </div>
      <fieldset>
        <legend>Game library</legend>
        <dl class="dlg-props-table project-settings-details">
          <dt>Included games:</dt><dd data-project-value="includedGames"></dd>
          <dt>Downloaded games:</dt><dd data-project-value="downloadedGames"></dd>
        </dl>
        <button type="button" class="xp-btn" data-project-action="manage-games">Manage Games...</button>
      </fieldset>
      <fieldset>
        <legend>Storage</legend>
        <p>Astro Flash Collection is using <strong data-project-value="storage"></strong> of browser storage.</p>
      </fieldset>
      <a class="project-suggestions-link" href="https://github.com/astrovm/flash/issues" target="_blank" rel="noopener noreferrer">Send suggestions or report a problem</a>
    </section>
    <section class="project-settings-panel" id="project-panel-offline" role="tabpanel" aria-labelledby="project-tab-offline" hidden>
      <fieldset>
        <legend>Windows XP system files</legend>
        <p class="project-settings-description">The desktop, settings, artwork, fonts, and sounds are saved automatically for offline use.</p>
        <dl class="dlg-props-table project-settings-details">
          <dt>System download:</dt><dd data-project-value="downloadSize"></dd>
          <dt>Offline status:</dt><dd data-project-value="offlineFiles"></dd>
        </dl>
        <p class="project-settings-status" data-project-status="offline" aria-live="polite"></p>
        <progress class="project-settings-progress" aria-label="Offline download progress" hidden></progress>
        <div class="project-settings-actions">
          <button type="button" class="xp-btn" data-project-action="repair">Repair System Files</button>
        </div>
      </fieldset>
      <fieldset>
        <legend>Included games</legend>
        <p class="project-settings-description">Choose which of the ${bundledGameCount} included games should work offline. The shared Flash runtime is downloaded once when needed.</p>
        <dl class="dlg-props-table project-settings-details">
          <dt>Downloaded:</dt><dd data-project-value="offlineGames"></dd>
          <dt>Game storage:</dt><dd data-project-value="offlineGameStorage"></dd>
        </dl>
        <div class="project-offline-game-list" data-project-offline-games role="group" aria-label="Included games available offline"></div>
        <progress class="project-settings-progress" data-project-game-progress aria-label="Included game download progress" hidden></progress>
        <p class="project-settings-status" data-project-status="offline-games" aria-live="polite"></p>
        <div class="project-settings-actions">
          <button type="button" class="xp-btn" data-project-action="download-all-games">Download All Games</button>
          <button type="button" class="xp-btn" data-project-action="remove-all-games">Remove Offline Games</button>
        </div>
      </fieldset>
      <p class="project-settings-description">Games installed from Internet Games use separate storage and remain available after installation. Legacy games may fetch additional files the first time they are used.</p>
    </section>
    <section class="project-settings-panel" id="project-panel-game-data" role="tabpanel" aria-labelledby="project-tab-game-data" hidden>
      <fieldset>
        <legend>Installed game data</legend>
        <p class="project-settings-description">Remove games installed from Internet Games, reVCDOS game data, or saved Pink Panther CD images. Saved games are preserved.</p>
        <div class="project-game-data-list" data-project-game-data aria-live="polite"></div>
        <p class="project-settings-status" data-project-status="game-data" aria-live="polite"></p>
      </fieldset>
    </section>
    <section class="project-settings-panel" id="project-panel-updates" role="tabpanel" aria-labelledby="project-tab-updates" hidden>
      <fieldset>
        <legend>Astro Flash updates</legend>
        <dl class="dlg-props-table project-settings-details">
          <dt>Installed version:</dt><dd data-project-value="version"></dd>
          <dt>Available version:</dt><dd data-project-value="availableVersion"></dd>
          <dt>Last checked:</dt><dd data-project-value="lastChecked"></dd>
        </dl>
        <p class="project-settings-status" data-project-status="updates" aria-live="polite"></p>
        <div class="project-settings-actions">
          <button type="button" class="xp-btn" data-project-action="check">Check for Updates</button>
        </div>
      </fieldset>
    </section>
    <section class="project-settings-panel" id="project-panel-recovery" role="tabpanel" aria-labelledby="project-tab-recovery" hidden>
      <fieldset class="project-recovery-group">
        <legend>Restore the desktop</legend>
        <p>Restore all game shortcuts and their default positions. Personal files, downloaded games, and preferences are preserved.</p>
        <button type="button" class="xp-btn" data-project-action="restore-desktop">Restore Default Desktop</button>
      </fieldset>
      <fieldset class="project-recovery-group project-recovery-danger">
        <legend>Reset Astro Flash</legend>
        <p>Permanently delete personal files and reset all preferences. Downloaded games and offline files are preserved.</p>
        <button type="button" class="xp-btn" data-project-action="reset">Reset Astro Flash</button>
      </fieldset>
    </section>
  `;

  const tabs = [...content.querySelectorAll('[role="tab"]')];
  const panels = [...content.querySelectorAll('[role="tabpanel"]')];
  const value = (name) =>
    content.querySelector(`[data-project-value="${name}"]`);
  const offlineStatus = content.querySelector(
    '[data-project-status="offline"]',
  );
  const offlineGamesStatus = content.querySelector(
    '[data-project-status="offline-games"]',
  );
  const offlineGamesList = content.querySelector(
    "[data-project-offline-games]",
  );
  const updateStatus = content.querySelector('[data-project-status="updates"]');
  const gameDataList = content.querySelector("[data-project-game-data]");
  const gameDataStatus = content.querySelector(
    '[data-project-status="game-data"]',
  );
  const downloadProgress = content.querySelector(".project-settings-progress");
  const gameDownloadProgress = content.querySelector(
    "[data-project-game-progress]",
  );
  const checkButton = content.querySelector('[data-project-action="check"]');
  const repairButton = content.querySelector('[data-project-action="repair"]');
  const downloadAllGamesButton = content.querySelector(
    '[data-project-action="download-all-games"]',
  );
  const removeAllGamesButton = content.querySelector(
    '[data-project-action="remove-all-games"]',
  );
  const restoreDesktopButton = content.querySelector(
    '[data-project-action="restore-desktop"]',
  );
  const resetButton = content.querySelector('[data-project-action="reset"]');

  const showTab = (tab) => {
    const panelId = tab.getAttribute("aria-controls");
    tabs.forEach((item) => {
      const active = item === tab;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
      item.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => {
      const active = panel.id === panelId;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
    });
    if (panelId === "project-panel-game-data") void renderGameData();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => showTab(tab));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      event.preventDefault();
      const target =
        event.key === "Home"
          ? tabs[0]
          : event.key === "End"
            ? tabs.at(-1)
            : tabs[
                (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
                  tabs.length
              ];
      showTab(target);
      target.focus();
    });
  });

  const transientPhases = new Set([
    "starting",
    "downloading",
    "checking",
    "updating",
    "applying",
    "repairing",
  ]);
  let offlineListSignature = "";
  let gameDataRefresh = 0;
  const renderGameData = async () => {
    const refresh = ++gameDataRefresh;
    gameDataStatus.textContent = "Checking installed game data...";
    try {
      const [internetGames, externalGames] = await Promise.all([
        gameLibrary?.getInstallations?.() || [],
        gameDataManager.list(),
      ]);
      if (refresh !== gameDataRefresh) return;
      const items = [
        ...internetGames.map((item) => ({
          ...item,
          detail: "Internet Game",
          removeId: item.id,
          owner: "internet",
        })),
        ...externalGames.map((item) => ({
          ...item,
          removeId: item.id,
          owner: "external",
        })),
      ];
      gameDataList.replaceChildren();
      if (!items.length) {
        const empty = document.createElement("p");
        empty.className = "project-settings-description";
        empty.textContent = "No downloaded or stored game data was found.";
        gameDataList.appendChild(empty);
      }
      items.forEach((item) => {
        const row = document.createElement("div");
        row.className = "project-game-data";
        const text = document.createElement("span");
        const title = document.createElement("strong");
        title.textContent = item.title;
        const detail = document.createElement("small");
        detail.textContent = `${item.detail} · ${formatProjectBytes(item.bytes)}`;
        text.append(title, detail);
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "xp-btn";
        remove.textContent = "Remove";
        remove.dataset.gameDataId = item.removeId;
        remove.dataset.gameDataOwner = item.owner;
        remove.dataset.gameDataTitle = item.title;
        row.append(text, remove);
        gameDataList.appendChild(row);
      });
      gameDataStatus.textContent = items.length
        ? `${items.length} stored game ${items.length === 1 ? "item" : "items"} found.`
        : "";
    } catch (error) {
      if (refresh !== gameDataRefresh) return;
      gameDataStatus.textContent = error.message;
    }
  };

  gameDataList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-game-data-id]");
    if (!button) return;
    const accepted = await XPDialogs.confirm(
      `Remove ${button.dataset.gameDataTitle} from browser storage?\n\nSaved games will be preserved.`,
      "Remove Game Data",
      "question",
    );
    if (!accepted) return;
    button.disabled = true;
    gameDataStatus.textContent = "Removing game data...";
    try {
      if (button.dataset.gameDataOwner === "internet") {
        await gameLibrary.uninstall(button.dataset.gameDataId);
      } else {
        await gameDataManager.remove(button.dataset.gameDataId);
      }
      await offlineManager.refreshStorageEstimate();
      await renderGameData();
    } catch (error) {
      button.disabled = false;
      gameDataStatus.textContent = error.message;
    }
  });

  const renderOfflineGameList = (state) => {
    const downloaded = new Set(state.downloadedGameIds);
    const busy = ["downloading", "removing"].includes(state.gamePhase);
    const signature = JSON.stringify([
      state.bundledGames.map((game) => [
        game.id,
        game.bytes,
        downloaded.has(game.id),
      ]),
      busy,
      state.activeGameId,
    ]);
    if (signature === offlineListSignature) return;
    offlineListSignature = signature;
    offlineGamesList.replaceChildren();
    if (!state.bundledGames.length) {
      const empty = document.createElement("p");
      empty.className = "project-settings-description";
      empty.textContent = "Loading the included-game catalog...";
      offlineGamesList.appendChild(empty);
      return;
    }
    const games = [...state.bundledGames].sort((left, right) => {
      const leftTitle = gamesList[left.id]?.title || formatGameTitle(left.id);
      const rightTitle =
        gamesList[right.id]?.title || formatGameTitle(right.id);
      return leftTitle.localeCompare(rightTitle);
    });
    games.forEach((game) => {
      const label = document.createElement("label");
      label.className = "project-offline-game";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = downloaded.has(game.id);
      checkbox.disabled = busy;
      checkbox.dataset.offlineGame = game.id;
      const title = document.createElement("span");
      title.textContent = gamesList[game.id]?.title || formatGameTitle(game.id);
      const size = document.createElement("span");
      size.className = "project-offline-game-size";
      size.textContent = formatProjectBytes(game.bytes);
      label.append(checkbox, title, size);
      offlineGamesList.appendChild(label);
    });
  };

  offlineGamesList.addEventListener("change", (event) => {
    const control = event.target.closest("[data-offline-game]");
    if (!control) return;
    const action = control.checked
      ? offlineManager.downloadGame(control.dataset.offlineGame)
      : offlineManager.removeGame(control.dataset.offlineGame);
    action.catch((error) => {
      offlineGamesStatus.textContent = error.message;
    });
  });

  const render = (state) => {
    value("version").textContent = APP_VERSION;
    value("availableVersion").textContent = state.availableVersion
      ? state.availableVersion
      : state.lastChecked
        ? "Up to date"
        : "Not checked";
    value("includedGames").textContent = String(bundledGameCount);
    value("downloadedGames").textContent = String(installedGameIds.size);
    value("downloadSize").textContent =
      state.downloadBytes === null
        ? state.downloadMetadataError
          ? "Unavailable"
          : "Checking..."
        : formatProjectBytes(state.downloadBytes);
    value("connection").textContent = state.online
      ? "Connected to the internet"
      : "Working offline";
    value("offlineFiles").textContent =
      state.workerState === "active"
        ? "Ready for offline use"
        : formatProjectState(state.workerState);
    value("offlineGames").textContent =
      `${state.downloadedGameIds.length} of ${state.bundledGames.length || bundledGameCount}`;
    value("offlineGameStorage").textContent = formatProjectBytes(
      state.downloadedGameBytes,
    );
    value("storage").textContent = projectStorageText(state);
    value("lastChecked").textContent = formatUpdateCheckTime(state.lastChecked);
    offlineStatus.textContent = offlineStatusText(state);
    const activeGameTitle = state.activeGameId
      ? gamesList[state.activeGameId]?.title ||
        formatGameTitle(state.activeGameId)
      : "included games";
    offlineGamesStatus.textContent = state.gameError
      ? state.gameError
      : state.gamePhase === "downloading"
        ? `Downloading ${activeGameTitle}...`
        : state.gamePhase === "removing"
          ? "Removing offline game files..."
          : state.downloadedGameIds.length
            ? "Selected games are ready for offline use."
            : "No included games are downloaded for offline use.";
    updateStatus.textContent =
      state.phase === "checking"
        ? "Checking for updates..."
        : state.phase === "update-pending"
          ? `Astro Flash Collection ${state.availableVersion} will become eligible after ${formatUpdateCheckTime(state.updateEligibleAt)} if no newer update is released.`
          : state.updateReady
            ? `Astro Flash Collection ${state.availableVersion || "update"} will install automatically the next time you load it.`
            : state.availableVersion
              ? `Astro Flash Collection ${state.availableVersion} is available.`
              : state.lastChecked
                ? "Astro Flash Collection is up to date."
                : "Updates have not been checked yet.";
    if (state.error) {
      updateStatus.textContent = state.error;
    }
    downloadProgress.hidden = ![
      "starting",
      "downloading",
      "updating",
      "repairing",
    ].includes(state.phase);
    gameDownloadProgress.hidden = state.gamePhase !== "downloading";
    if (state.gameProgressTotal > 0) {
      gameDownloadProgress.max = state.gameProgressTotal;
      gameDownloadProgress.value = state.gameProgressLoaded;
    } else {
      gameDownloadProgress.removeAttribute("value");
    }
    checkButton.disabled = !state.online || transientPhases.has(state.phase);
    repairButton.disabled = !state.online || transientPhases.has(state.phase);
    const gameBusy = ["downloading", "removing"].includes(state.gamePhase);
    downloadAllGamesButton.disabled =
      !state.online ||
      gameBusy ||
      !state.bundledGames.length ||
      state.downloadedGameIds.length === state.bundledGames.length;
    removeAllGamesButton.disabled =
      gameBusy || state.downloadedGameIds.length === 0;
    renderOfflineGameList(state);
  };
  const unsubscribe = offlineManager.subscribe(render);
  const unsubscribeGames = gameLibrary?.subscribe(() => {
    render(offlineManager.getSnapshot());
    void offlineManager.refreshStorageEstimate();
    void renderGameData();
  });
  const refreshStoredGameData = (event) => {
    if (
      event.type === "storage" ||
      (event.origin === window.location.origin &&
        event.data?.event === "astro.game-data-changed")
    ) {
      void renderGameData();
    }
  };
  window.addEventListener("storage", refreshStoredGameData);
  window.addEventListener("message", refreshStoredGameData);
  win.beforeClose = () => {
    unsubscribe();
    unsubscribeGames?.();
    window.removeEventListener("storage", refreshStoredGameData);
    window.removeEventListener("message", refreshStoredGameData);
    return true;
  };

  checkButton.addEventListener("click", () => {
    offlineManager.checkForUpdates().catch(() => {});
  });
  repairButton.addEventListener("click", async () => {
    const accepted = await XPDialogs.confirm(
      "Clear and download the Windows XP system files again?",
      "Repair System Files",
      "question",
    );
    if (!accepted) return;
    offlineManager.repair().catch((error) => {
      offlineStatus.textContent = error.message;
    });
  });
  downloadAllGamesButton.addEventListener("click", () => {
    offlineManager.downloadAllGames().catch((error) => {
      offlineGamesStatus.textContent = error.message;
    });
  });
  removeAllGamesButton.addEventListener("click", async () => {
    const accepted = await XPDialogs.confirm(
      "Remove the offline copies of all included games? Internet Games installations will be preserved.",
      "Remove Offline Games",
      "question",
    );
    if (!accepted) return;
    offlineManager.removeAllGames().catch((error) => {
      offlineGamesStatus.textContent = error.message;
    });
  });
  content
    .querySelector('[data-project-action="manage-games"]')
    .addEventListener("click", () => {
      openSystemWindow("__internet-games");
      openWindows
        .get("__internet-games")
        ?.el.querySelector('[data-internet-tab="installed"]')
        ?.click();
    });
  restoreDesktopButton.addEventListener("click", async () => {
    const accepted = await XPDialogs.confirm(
      "Restore all game shortcuts and the default desktop layout?\n\nYour personal files and other settings will be preserved.",
      "Restore Default Desktop",
      "question",
    );
    if (!accepted) return;
    restoreDefaultDesktop();
    window.location.reload();
  });
  resetButton.addEventListener("click", async () => {
    const accepted = await XPDialogs.confirm(
      "Reset Astro Flash Collection to its original state?\n\nThis will permanently delete your personal files and reset all preferences. This cannot be undone.",
      "Reset Astro Flash",
      "warning",
    );
    if (!accepted) return;
    resetAstroFlash();
    window.location.reload();
  });
};

const openProjectSettings = () => openSystemWindow("__astro-settings");

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

const openDateTimeProperties = () => {
  const dialog = XPDialogs.createDialog({
    title: "Date and Time Properties",
    wide: true,
  });
  dialog.el.classList.add("datetime-dialog");

  const titleButtons = dialog.el.querySelector(".title-buttons");
  const helpButton = document.createElement("button");
  helpButton.type = "button";
  helpButton.className = "tb-btn help-btn";
  helpButton.title = "Help";
  helpButton.setAttribute("aria-label", "Help");
  titleButtons.prepend(helpButton);

  const shellNow = getShellTime();
  const state = {
    year: shellNow.getFullYear(),
    month: shellNow.getMonth(),
    day: shellNow.getDate(),
  };

  const tabs = document.createElement("div");
  tabs.className = "datetime-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Date and Time Properties");
  const panelHost = document.createElement("div");
  panelHost.className = "datetime-panel-host";

  // ---- Date group ----
  const dateGroup = document.createElement("fieldset");
  dateGroup.className = "dlg-group datetime-date-group";
  const dateLegend = document.createElement("legend");
  dateLegend.textContent = "Date";
  dateGroup.appendChild(dateLegend);

  const monthSelect = document.createElement("select");
  monthSelect.className = "xp-select dlg-month-select";
  monthSelect.setAttribute("aria-label", "Month");
  MONTH_NAMES.forEach((monthName, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = monthName;
    monthSelect.appendChild(option);
  });
  monthSelect.value = String(state.month);

  const yearInput = document.createElement("input");
  yearInput.type = "number";
  yearInput.min = "1901";
  yearInput.max = "2099";
  yearInput.className = "xp-input dlg-year-input";
  yearInput.setAttribute("aria-label", "Year");
  yearInput.value = String(state.year);

  const monthYearRow = document.createElement("div");
  monthYearRow.className = "dlg-month-year";
  monthYearRow.append(monthSelect, yearInput);

  const calendar = document.createElement("div");
  calendar.className = "dlg-calendar";
  dateGroup.append(monthYearRow, calendar);

  // ---- Time group ----
  const timeGroup = document.createElement("fieldset");
  timeGroup.className = "dlg-group datetime-time-group";
  const timeLegend = document.createElement("legend");
  timeLegend.textContent = "Time";
  timeGroup.appendChild(timeLegend);

  const analogClock = document.createElement("div");
  analogClock.className = "datetime-analog-clock";
  analogClock.setAttribute("aria-hidden", "true");
  for (let tick = 0; tick < 60; tick += 1) {
    const mark = document.createElement("i");
    mark.className = tick % 5 === 0 ? "hour-tick" : "minute-tick";
    mark.style.setProperty("--tick", tick);
    analogClock.appendChild(mark);
  }
  const hourHand = document.createElement("span");
  hourHand.className = "datetime-clock-hand hour";
  const minuteHand = document.createElement("span");
  minuteHand.className = "datetime-clock-hand minute";
  const secondHand = document.createElement("span");
  secondHand.className = "datetime-clock-hand second";
  const clockPin = document.createElement("span");
  clockPin.className = "datetime-clock-pin";
  analogClock.append(hourHand, minuteHand, secondHand, clockPin);

  const timeEdit = document.createElement("div");
  timeEdit.className = "datetime-time-edit";
  const timeInput = document.createElement("input");
  timeInput.type = "text";
  timeInput.className = "xp-input";
  timeInput.setAttribute("aria-label", "Time");
  const spinner = document.createElement("span");
  spinner.className = "datetime-spinner";
  spinner.innerHTML =
    '<button type="button" aria-label="Increase time">▲</button><button type="button" aria-label="Decrease time">▼</button>';
  timeEdit.append(timeInput, spinner);
  timeGroup.append(analogClock, timeEdit);

  const datePanel = document.createElement("section");
  datePanel.className = "datetime-panel datetime-date-panel";
  datePanel.setAttribute("role", "tabpanel");
  datePanel.append(dateGroup, timeGroup);
  const timeZoneText = document.createElement("p");
  timeZoneText.className = "datetime-current-zone";
  timeZoneText.textContent = "Current time zone:  SA Eastern Standard Time";
  datePanel.appendChild(timeZoneText);

  const timeZonePanel = document.createElement("section");
  timeZonePanel.className = "datetime-panel datetime-time-zone-panel";
  timeZonePanel.setAttribute("role", "tabpanel");
  timeZonePanel.hidden = true;
  const timeZoneSelect = document.createElement("select");
  timeZoneSelect.className = "xp-select datetime-zone-select";
  timeZoneSelect.setAttribute("aria-label", "Time zone");
  const timeZoneOption = document.createElement("option");
  timeZoneOption.textContent = "(GMT-03:00) Buenos Aires, Georgetown";
  timeZoneSelect.appendChild(timeZoneOption);
  const timeZoneMap = document.createElement("img");
  timeZoneMap.className = "datetime-zone-map";
  timeZoneMap.src = "assets/xp/TimeZoneMap.png";
  timeZoneMap.alt = "World time zone map";
  timeZoneMap.draggable = false;
  timeZonePanel.append(timeZoneSelect, timeZoneMap);

  const internetPanel = document.createElement("section");
  internetPanel.className = "datetime-panel datetime-internet-panel";
  internetPanel.setAttribute("role", "tabpanel");
  internetPanel.hidden = true;
  const syncLabel = document.createElement("label");
  syncLabel.className = "datetime-sync-label";
  const syncCheckbox = document.createElement("input");
  syncCheckbox.type = "checkbox";
  syncCheckbox.checked = true;
  syncLabel.append(
    syncCheckbox,
    "Automatically synchronize with an Internet time server",
  );
  const serverRow = document.createElement("div");
  serverRow.className = "datetime-server-row";
  const serverLabel = document.createElement("label");
  serverLabel.textContent = "Server:";
  const serverSelect = document.createElement("select");
  serverSelect.className = "xp-select";
  serverSelect.innerHTML =
    "<option>time.windows.com</option><option>time.nist.gov</option>";
  const updateNow = document.createElement("button");
  updateNow.type = "button";
  updateNow.className = "xp-btn";
  updateNow.textContent = "Update Now";
  serverRow.append(serverLabel, serverSelect, updateNow);
  const syncStatus = document.createElement("p");
  syncStatus.className = "datetime-sync-status";
  syncStatus.textContent =
    "Windows has never attempted to synchronize with an Internet time server.";
  const nextSync = document.createElement("p");
  nextSync.className = "datetime-next-sync";
  nextSync.textContent = `Next synchronization: ${shellNow.toLocaleDateString("en-US")} at ${shellNow.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  const syncNote = document.createElement("p");
  syncNote.className = "datetime-sync-note";
  syncNote.innerHTML =
    "Synchronization can occur only when your computer is connected to the Internet. Learn more about <u>time synchronization</u> in Help and Support Center.";
  internetPanel.append(syncLabel, serverRow, syncStatus, nextSync, syncNote);

  const panels = [datePanel, timeZonePanel, internetPanel];
  const tabDefinitions = [
    ["Date & Time", datePanel],
    ["Time Zone", timeZonePanel],
    ["Internet Time", internetPanel],
  ];
  tabDefinitions.forEach(([label, panel], index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(index === 0));
    tab.classList.toggle("active", index === 0);
    tab.textContent = label;
    tab.addEventListener("click", () => {
      panels.forEach((candidate) => {
        candidate.hidden = candidate !== panel;
      });
      [...tabs.children].forEach((candidate) => {
        const selected = candidate === tab;
        candidate.classList.toggle("active", selected);
        candidate.setAttribute("aria-selected", String(selected));
      });
    });
    tabs.appendChild(tab);
  });
  panelHost.append(...panels);
  dialog.body.append(tabs, panelHost);

  const renderCalendar = () => {
    calendar.innerHTML = "";
    DAY_LETTERS.forEach((letter) => {
      const head = document.createElement("span");
      head.className = "dlg-calendar-head";
      head.textContent = letter;
      calendar.appendChild(head);
    });
    const today = getShellTime();
    const firstWeekday = new Date(state.year, state.month, 1).getDay();
    for (let i = 0; i < firstWeekday; i += 1) {
      const blank = document.createElement("span");
      calendar.appendChild(blank);
    }
    const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dayButton = document.createElement("button");
      dayButton.type = "button";
      dayButton.className = "dlg-calendar-day";
      dayButton.textContent = String(day);
      if (day === state.day) {
        dayButton.classList.add("selected");
      }
      if (
        day === today.getDate() &&
        state.month === today.getMonth() &&
        state.year === today.getFullYear()
      ) {
        dayButton.classList.add("today");
      }
      dayButton.addEventListener("click", () => {
        state.day = day;
        renderCalendar();
      });
      calendar.appendChild(dayButton);
    }
  };

  const formatTime = (date) =>
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  const renderAnalogClock = (date) => {
    const seconds = date.getSeconds();
    const minutes = date.getMinutes() + seconds / 60;
    const hours = (date.getHours() % 12) + minutes / 60;
    hourHand.style.setProperty("--angle", `${hours * 30}deg`);
    minuteHand.style.setProperty("--angle", `${minutes * 6}deg`);
    secondHand.style.setProperty("--angle", `${seconds * 6}deg`);
  };
  timeInput.value = formatTime(shellNow);
  renderAnalogClock(shellNow);

  monthSelect.addEventListener("change", () => {
    state.month = parseInt(monthSelect.value, 10);
    state.day = Math.min(
      state.day,
      new Date(state.year, state.month + 1, 0).getDate(),
    );
    renderCalendar();
  });
  yearInput.addEventListener("change", () => {
    const year = parseInt(yearInput.value, 10);
    state.year = Number.isFinite(year)
      ? Math.min(Math.max(year, 1901), 2099)
      : state.year;
    yearInput.value = String(state.year);
    state.day = Math.min(
      state.day,
      new Date(state.year, state.month + 1, 0).getDate(),
    );
    renderCalendar();
  });

  const applyDateTime = () => {
    const match = /^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i.exec(
      timeInput.value.trim(),
    );
    let hours = match ? Math.min(Math.max(parseInt(match[1], 10), 1), 12) : 12;
    const minutes = match ? Math.min(parseInt(match[2], 10), 59) : 0;
    const seconds = match ? Math.min(parseInt(match[3], 10), 59) : 0;
    hours %= 12;
    if (match?.[4].toUpperCase() === "PM") hours += 12;
    const chosen = new Date(
      state.year,
      state.month,
      state.day,
      hours,
      minutes,
      seconds,
    );
    localStorage.setItem(
      CLOCK_OFFSET_KEY,
      String(chosen.getTime() - Date.now()),
    );
    updateClockDisplay();
    renderAnalogClock(chosen);
  };

  const row = document.createElement("div");
  row.className = "dlg-buttons";
  const okButton = XPDialogs.createDialogButton(
    { id: "ok", label: "OK", isDefault: true },
    () => {
      applyDateTime();
      dialog.close("ok");
    },
  );
  const cancelButton = XPDialogs.createDialogButton(
    { id: "cancel", label: "Cancel" },
    () => dialog.close(null),
  );
  const applyButton = XPDialogs.createDialogButton(
    { id: "apply", label: "Apply" },
    () => {
      applyDateTime();
      applyButton.disabled = true;
    },
  );
  applyButton.disabled = true;
  row.append(okButton, cancelButton, applyButton);
  dialog.body.appendChild(row);
  dialog.defaultButton = okButton;

  const markDirty = () => {
    applyButton.disabled = false;
  };
  [
    monthSelect,
    yearInput,
    timeInput,
    timeZoneSelect,
    syncCheckbox,
    serverSelect,
  ].forEach((control) => control.addEventListener("change", markDirty));
  calendar.addEventListener("click", markDirty);
  spinner.querySelectorAll("button").forEach((button, index) => {
    button.addEventListener("click", () => {
      const value = new Date(2000, 0, 1);
      const match = /^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i.exec(
        timeInput.value.trim(),
      );
      if (match) {
        let hours = parseInt(match[1], 10) % 12;
        if (match[4].toUpperCase() === "PM") hours += 12;
        value.setHours(hours, parseInt(match[2], 10), parseInt(match[3], 10));
      }
      value.setSeconds(value.getSeconds() + (index === 0 ? 1 : -1));
      timeInput.value = formatTime(value);
      renderAnalogClock(value);
      markDirty();
    });
  });
  syncCheckbox.addEventListener("change", () => {
    serverSelect.disabled = !syncCheckbox.checked;
    updateNow.disabled = !syncCheckbox.checked;
  });
  updateNow.addEventListener("click", () => {
    syncStatus.textContent =
      "An error occurred while Windows was synchronizing with time.windows.com.";
  });
  helpButton.addEventListener("click", () => {
    XPDialogs.alert(
      "Select a tab to change the date, time, time zone, or Internet time settings.",
      "Date and Time Help",
      "info",
    );
  });

  renderCalendar();
  okButton.focus();
};

const setupSystemTray = () => {
  document
    .getElementById("tray-volume-button")
    .addEventListener("click", toggleTrayVolumePopup);
  document
    .getElementById("tray-network-button")
    .addEventListener("click", openNetworkStatus);
  document
    .getElementById("taskbar-clock")
    .addEventListener("click", openDateTimeProperties);

  document
    .getElementById("tray-volume-slider")
    .addEventListener("input", (event) => {
      const volume = parseInt(event.target.value, 10);
      if (Number.isFinite(volume)) {
        // Moving the XP volume slider clears the mute flag.
        setMasterVolume(volume, false);
      }
    });
  document
    .getElementById("tray-mute-checkbox")
    .addEventListener("change", (event) => {
      setMasterVolume(getMasterVolume().volume, event.target.checked);
    });

  syncTrayVolumeUI();
};
