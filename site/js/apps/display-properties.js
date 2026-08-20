"use strict";

const openDesktopItemsDialog = (ownerWindow) => {
  const current = getDesktopSystemIcons();
  const dialog = XPDialogs.createDialog({
    title: "Desktop Items",
    onCancel: () => dialog.close("cancel"),
  });
  dialog.el.classList.add("desktop-items-dialog");
  ownerWindow.el.classList.remove("active");

  const titleButtons = dialog.el.querySelector(".title-buttons");
  const help = document.createElement("button");
  help.type = "button";
  help.className = "tb-btn help-btn";
  help.title = "Help";
  help.setAttribute("aria-label", "Help");
  titleButtons.prepend(help);

  const tabs = document.createElement("div");
  tabs.className = "desktop-items-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.innerHTML = `
    <button type="button" role="tab" aria-selected="true" data-desktop-items-tab="general">General</button>
    <button type="button" role="tab" aria-selected="false" tabindex="-1" data-desktop-items-tab="web">Web</button>
  `;
  const panels = document.createElement("div");
  panels.className = "desktop-items-panels";
  panels.innerHTML = `
    <section role="tabpanel" data-desktop-items-panel="general">
      <fieldset class="desktop-icons-group"><legend>Desktop icons</legend>
        <label><input type="checkbox" data-system-icon="__my-documents"> My Documents</label>
        <label><input type="checkbox" data-system-icon="__my-computer"> My Computer</label>
        <label><input type="checkbox" disabled> My Network Places</label>
      </fieldset>
      <div class="desktop-icon-choices" role="listbox" aria-label="Desktop icons">
        <button type="button" class="selected"><img src="assets/xp/icons/MyComputer.png" alt=""><span>My Computer</span></button>
        <button type="button"><img src="assets/xp/icons/MyDocuments.png" alt=""><span>My Documents</span></button>
        <button type="button"><img src="assets/xp/icons/MyNetworkPlaces.png" alt=""><span>My Network<br>Places</span></button>
        <button type="button"><img src="assets/xp/icons/RecyclerFull.png" alt=""><span>Recycle Bin<br>(full)</span></button>
        <button type="button"><img src="assets/xp/icons/RecyclerEmpty.png" alt=""><span>Recycle Bin<br>(empty)</span></button>
      </div>
      <div class="desktop-icon-actions"><button type="button" class="xp-btn">Change Icon...</button><button type="button" class="xp-btn">Restore Default</button></div>
      <fieldset class="desktop-cleanup-group"><legend>Desktop cleanup</legend>
        <p>Desktop Cleanup moves unused desktop items to a folder.</p>
        <label><input type="checkbox"> Run Desktop Cleanup Wizard every 60 days</label>
        <button type="button" class="xp-btn">Clean Desktop Now</button>
      </fieldset>
    </section>
    <section role="tabpanel" data-desktop-items-panel="web" hidden>
      <p>Web pages can be shown directly on your desktop.</p>
      <div class="desktop-web-empty">No Web pages are currently displayed.</div>
    </section>
  `;

  panels.querySelectorAll("[data-system-icon]").forEach((checkbox) => {
    checkbox.checked = current[checkbox.dataset.systemIcon] !== false;
  });
  tabs.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-desktop-items-tab]");
    if (!tab) return;
    tabs.querySelectorAll('[role="tab"]').forEach((item) => {
      const active = item === tab;
      item.setAttribute("aria-selected", String(active));
      item.tabIndex = active ? 0 : -1;
    });
    panels.querySelectorAll('[role="tabpanel"]').forEach((panel) => {
      panel.hidden =
        panel.dataset.desktopItemsPanel !== tab.dataset.desktopItemsTab;
    });
    tab.focus();
  });
  panels
    .querySelector(".desktop-icon-choices")
    .addEventListener("click", (event) => {
      const item = event.target.closest("button");
      if (!item) return;
      panels
        .querySelectorAll(".desktop-icon-choices button")
        .forEach((button) =>
          button.classList.toggle("selected", button === item),
        );
    });

  const buttons = document.createElement("div");
  buttons.className = "dlg-buttons";
  const ok = XPDialogs.createDialogButton(
    { id: "ok", label: "OK", isDefault: true },
    () => {
      const next = { ...current };
      panels.querySelectorAll("[data-system-icon]").forEach((checkbox) => {
        next[checkbox.dataset.systemIcon] = checkbox.checked;
      });
      saveDesktopSystemIcons(next);
      buildDesktopIcons();
      dialog.close("ok");
    },
  );
  const cancel = XPDialogs.createDialogButton(
    { id: "cancel", label: "Cancel", isCancel: true },
    () => dialog.close("cancel"),
  );
  buttons.append(ok, cancel);
  dialog.body.append(tabs, panels, buttons);
  dialog.defaultButton = ok;
  dialog.onResult(() => {
    ownerWindow.el.classList.add("active");
    focusWindow(ownerWindow.gameId);
  });
  panels.querySelector("[data-system-icon]").focus();
};

const setDisplayDialogOwnerActive = (ownerWindow, active) => {
  ownerWindow.el.classList.toggle("active", active);
  if (active) focusWindow(ownerWindow.gameId);
};

const openDisplayNotice = (ownerWindow, title, message) => {
  setDisplayDialogOwnerActive(ownerWindow, false);
  XPDialogs.alert(message, title, "info").finally(() =>
    setDisplayDialogOwnerActive(ownerWindow, true),
  );
};

const addDisplayDialogHelpButton = (dialog) => {
  const help = document.createElement("button");
  help.type = "button";
  help.className = "tb-btn help-btn";
  help.title = "Help";
  help.setAttribute("aria-label", "Help");
  dialog.el.querySelector(".title-buttons").prepend(help);
};

const openDisplayEffectsDialog = (ownerWindow, settings, onCommit) => {
  const draft = { ...settings };
  const dialog = XPDialogs.createDialog({
    title: "Effects",
    onCancel: () => dialog.close("cancel"),
  });
  dialog.el.classList.add("display-effects-dialog");
  setDisplayDialogOwnerActive(ownerWindow, false);
  addDisplayDialogHelpButton(dialog);
  dialog.body.innerHTML = `
    <div class="effects-option"><label><input type="checkbox" data-effect-enabled="transition"> Use the following transition effect for menus and tooltips:</label><select class="xp-select" data-effect="transitionEffect"><option value="fade">Fade effect</option><option value="scroll">Scroll effect</option></select></div>
    <div class="effects-option"><label><input type="checkbox" data-effect-enabled="smoothing"> Use the following method to smooth edges of screen fonts:</label><select class="xp-select" data-effect="fontSmoothing"><option value="standard">Standard</option><option value="cleartype">ClearType</option></select></div>
    <label class="effects-check"><input type="checkbox" data-effect="largeIcons"> Use large icons</label>
    <label class="effects-check"><input type="checkbox" data-effect="menuShadows"> Show shadows under menus</label>
    <label class="effects-check"><input type="checkbox" data-effect="showWindowContents"> Show window contents while dragging</label>
    <label class="effects-check"><input type="checkbox" data-effect="hideKeyboardCues"> Hide underlined letters for keyboard navigation until I press the Alt key</label>
  `;
  const transitionEnabled = dialog.body.querySelector(
    '[data-effect-enabled="transition"]',
  );
  const smoothingEnabled = dialog.body.querySelector(
    '[data-effect-enabled="smoothing"]',
  );
  const transition = dialog.body.querySelector(
    '[data-effect="transitionEffect"]',
  );
  const smoothing = dialog.body.querySelector('[data-effect="fontSmoothing"]');
  transitionEnabled.checked = draft.transitionEffect !== "none";
  smoothingEnabled.checked = draft.fontSmoothing !== "none";
  transition.value = draft.transitionEffect === "scroll" ? "scroll" : "fade";
  smoothing.value =
    draft.fontSmoothing === "cleartype" ? "cleartype" : "standard";
  [
    "largeIcons",
    "menuShadows",
    "showWindowContents",
    "hideKeyboardCues",
  ].forEach((key) => {
    dialog.body.querySelector(`[data-effect="${key}"]`).checked = !!draft[key];
  });
  const syncEnabled = () => {
    transition.disabled = !transitionEnabled.checked;
    smoothing.disabled = !smoothingEnabled.checked;
  };
  transitionEnabled.addEventListener("change", syncEnabled);
  smoothingEnabled.addEventListener("change", syncEnabled);
  syncEnabled();

  const buttons = document.createElement("div");
  buttons.className = "dlg-buttons";
  const ok = XPDialogs.createDialogButton(
    { id: "ok", label: "OK", isDefault: true },
    () => {
      draft.transitionEffect = transitionEnabled.checked
        ? transition.value
        : "none";
      draft.fontSmoothing = smoothingEnabled.checked ? smoothing.value : "none";
      [
        "largeIcons",
        "menuShadows",
        "showWindowContents",
        "hideKeyboardCues",
      ].forEach((key) => {
        draft[key] = dialog.body.querySelector(
          `[data-effect="${key}"]`,
        ).checked;
      });
      onCommit(draft);
      dialog.close("ok");
    },
  );
  const cancel = XPDialogs.createDialogButton(
    { id: "cancel", label: "Cancel", isCancel: true },
    () => dialog.close("cancel"),
  );
  buttons.append(ok, cancel);
  dialog.body.append(buttons);
  dialog.defaultButton = ok;
  dialog.onResult(() => setDisplayDialogOwnerActive(ownerWindow, true));
  transitionEnabled.focus();
};

const openAdvancedAppearanceDialog = (ownerWindow, settings, onCommit) => {
  const dialog = XPDialogs.createDialog({
    title: "Advanced Appearance",
    onCancel: () => dialog.close("cancel"),
  });
  dialog.el.classList.add("advanced-appearance-dialog");
  setDisplayDialogOwnerActive(ownerWindow, false);
  addDisplayDialogHelpButton(dialog);
  dialog.body.innerHTML = `
    <div class="advanced-appearance-preview">
      <div class="advanced-inactive">Inactive Window <b>_</b><b>□</b><b>×</b></div>
      <div class="advanced-active">Active Window <b>_</b><b>□</b><b>×</b></div>
      <div class="advanced-menu">Normal &nbsp;&nbsp; <span>Disabled</span> &nbsp;&nbsp; Selected</div>
      <div class="advanced-window-text">Window Text</div>
      <div class="advanced-message"><strong>Message Box</strong><b>×</b><span>Message Text</span><button type="button" tabindex="-1">OK</button></div>
    </div>
    <p class="advanced-appearance-copy">If you select a windows and buttons setting other than Windows Classic,<br>it will override the following settings, except in some older programs.</p>
    <div class="advanced-controls">
      <label>Item:<select class="xp-select" disabled><option>Desktop</option></select></label>
      <label class="advanced-size">Size:<input class="xp-input" disabled></label>
      <label>Color 1:<input type="color" data-advanced-color></label>
      <label class="advanced-disabled">Color 2:<input disabled></label>
      <label class="advanced-disabled">Font:<select class="xp-select" disabled></select></label>
      <label class="advanced-disabled">Size:<input class="xp-input" disabled></label>
      <label class="advanced-disabled">Color:<input disabled></label>
    </div>
  `;
  dialog.body.querySelector(".advanced-appearance-preview").dataset.appearance =
    settings.appearance;
  dialog.body.querySelector("[data-advanced-color]").value =
    settings.backgroundColor;
  const buttons = document.createElement("div");
  buttons.className = "dlg-buttons";
  const ok = XPDialogs.createDialogButton(
    { id: "ok", label: "OK", isDefault: true },
    () => {
      onCommit({
        ...settings,
        backgroundColor: dialog.body.querySelector("[data-advanced-color]")
          .value,
      });
      dialog.close("ok");
    },
  );
  const cancel = XPDialogs.createDialogButton(
    { id: "cancel", label: "Cancel", isCancel: true },
    () => dialog.close("cancel"),
  );
  buttons.append(ok, cancel);
  dialog.body.append(buttons);
  dialog.defaultButton = ok;
  dialog.onResult(() => setDisplayDialogOwnerActive(ownerWindow, true));
  dialog.body.querySelector("[data-advanced-color]").focus();
};

const openMonitorPropertiesDialog = (ownerWindow) => {
  const dialog = XPDialogs.createDialog({
    title: "(Default Monitor) and Properties",
    onCancel: () => dialog.close("cancel"),
  });
  dialog.el.classList.add("monitor-properties-dialog");
  setDisplayDialogOwnerActive(ownerWindow, false);
  addDisplayDialogHelpButton(dialog);
  dialog.body.innerHTML = `
    <div class="monitor-property-tabs" role="tablist" aria-label="Monitor properties">
      <button type="button" class="selected" role="tab" aria-selected="true" aria-controls="monitor-general-panel" data-monitor-tab="general">General</button>
      <button type="button" role="tab" aria-selected="false" aria-controls="monitor-adapter-panel" data-monitor-tab="adapter" tabindex="-1">Adapter</button>
      <button type="button" role="tab" aria-selected="false" aria-controls="monitor-monitor-panel" data-monitor-tab="monitor" tabindex="-1">Monitor</button>
      <button type="button" role="tab" aria-selected="false" aria-controls="monitor-troubleshoot-panel" data-monitor-tab="troubleshoot" tabindex="-1">Troubleshoot</button>
    </div>
    <section class="monitor-property-panel" id="monitor-general-panel" role="tabpanel" data-monitor-panel="general">
      <fieldset><legend>Display</legend><p>If your screen resolution makes screen items too small to view<br>comfortably, you can increase the DPI to compensate. To change<br>font sizes only, click Cancel and go to the Appearance tab.</p><label>DPI setting:<select class="xp-select" disabled><option>Normal size (96 DPI)</option></select></label><p>Normal size (96 dpi)</p></fieldset>
      <fieldset><legend>Compatibility</legend><p>Some programs might not operate properly unless you restart the<br>computer after changing display settings.</p><p>After I change display settings:</p><label><input type="radio" name="display-compatibility"> Restart the computer before applying the new display settings</label><label><input type="radio" name="display-compatibility" checked> Apply the new display settings without restarting</label><label><input type="radio" name="display-compatibility"> Ask me before applying the new display settings</label><p>Some games and other programs must be run in 256-color mode.<br>Learn more about <u>running programs in 256-color mode</u>.</p></fieldset>
    </section>
    <section class="monitor-property-panel" id="monitor-adapter-panel" role="tabpanel" data-monitor-panel="adapter" hidden>
      <fieldset><legend>Adapter Information</legend><p>Chip Type: Browser display adapter</p><p>DAC Type: Internal</p><p>Memory Size: Not available</p><p>Adapter String: Browser virtual display</p></fieldset>
      <fieldset><legend>Adapter</legend><p>This desktop uses the browser's active graphics adapter.</p><button type="button" class="xp-property-button" disabled>List All Modes...</button></fieldset>
    </section>
    <section class="monitor-property-panel" id="monitor-monitor-panel" role="tabpanel" data-monitor-panel="monitor" hidden>
      <fieldset><legend>Monitor type</legend><p>(Default Monitor)</p><button type="button" class="xp-property-button" disabled>Properties</button></fieldset>
      <fieldset><legend>Monitor settings</legend><label>Screen refresh rate:<select class="xp-select" disabled><option>Use hardware default setting</option></select></label><label><input type="checkbox" checked disabled> Hide modes that this monitor cannot display</label></fieldset>
    </section>
    <section class="monitor-property-panel" id="monitor-troubleshoot-panel" role="tabpanel" data-monitor-panel="troubleshoot" hidden>
      <fieldset><legend>Hardware acceleration</legend><p>If your computer is having problems with graphics, move the slider toward None.</p><label class="monitor-acceleration"><span>None</span><input type="range" min="0" max="5" value="5"><span>Full</span></label><p>All cursor and advanced drawing accelerations are enabled.</p></fieldset>
      <label><input type="checkbox" checked> Enable write combining</label>
    </section>
  `;
  const tabs = [...dialog.body.querySelectorAll("[data-monitor-tab]")];
  const panels = [...dialog.body.querySelectorAll("[data-monitor-panel]")];
  const selectTab = (tab) => {
    tabs.forEach((candidate) => {
      const selected = candidate === tab;
      candidate.classList.toggle("selected", selected);
      candidate.setAttribute("aria-selected", String(selected));
      candidate.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.monitorPanel !== tab.dataset.monitorTab;
    });
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (event) => {
      const direction =
        event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (!direction && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      const nextIndex =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : (index + direction + tabs.length) % tabs.length;
      selectTab(tabs[nextIndex]);
      tabs[nextIndex].focus();
    });
  });
  const buttons = document.createElement("div");
  buttons.className = "dlg-buttons";
  const ok = XPDialogs.createDialogButton(
    { id: "ok", label: "OK", isDefault: true },
    () => dialog.close("ok"),
  );
  const cancel = XPDialogs.createDialogButton(
    { id: "cancel", label: "Cancel", isCancel: true },
    () => dialog.close("cancel"),
  );
  const apply = XPDialogs.createDialogButton(
    { id: "apply", label: "Apply" },
    () => {},
  );
  apply.disabled = true;
  buttons.append(ok, cancel, apply);
  dialog.body.append(buttons);
  dialog.defaultButton = ok;
  dialog.onResult(() => setDisplayDialogOwnerActive(ownerWindow, true));
  tabs[0].focus();
};

const openWallpaperBrowseDialog = (ownerWindow, fileInput) => {
  const dialog = XPDialogs.createDialog({
    title: "Browse",
    onCancel: () => dialog.close("cancel"),
  });
  dialog.el.classList.add("wallpaper-browse-dialog");
  setDisplayDialogOwnerActive(ownerWindow, false);
  addDisplayDialogHelpButton(dialog);
  dialog.body.innerHTML = `
    <div class="browse-location"><label>Look in:</label><span><img src="assets/xp/icons/MyPictures.png" alt="">My Pictures</span><button type="button" disabled>◀</button><button type="button" disabled>↥</button><button type="button" disabled>☆</button><button type="button" disabled>▦</button></div>
    <div class="browse-body"><aside><button><img src="assets/xp/icons/RecentDocuments.png" alt="">My Recent<br>Documents</button><button><img src="assets/xp/icons/Programs.png" alt="">Desktop</button><button><img src="assets/xp/icons/MyDocuments.png" alt="">My Documents</button><button><img src="assets/xp/icons/MyComputer.png" alt="">My Computer</button><button><img src="assets/xp/icons/MyNetworkPlaces.png" alt="">My Network</button></aside><main><button type="button" class="sample-pictures-folder"><span><i></i><i></i><i></i><i></i></span>Sample Pictures</button></main></div>
    <div class="browse-fields"><label>File name:<input class="xp-input browse-file-name" readonly></label><label>Files of type:<select class="xp-select" disabled><option>Background Files</option></select></label></div>
  `;
  const buttons = document.createElement("div");
  buttons.className = "browse-buttons";
  const open = XPDialogs.createDialogButton(
    { id: "open", label: "Open", isDefault: true },
    () => fileInput.click(),
  );
  const cancel = XPDialogs.createDialogButton(
    { id: "cancel", label: "Cancel", isCancel: true },
    () => dialog.close("cancel"),
  );
  buttons.append(open, cancel);
  dialog.body.append(buttons);
  dialog.defaultButton = open;
  dialog.onResult(() => setDisplayDialogOwnerActive(ownerWindow, true));
  dialog.setChosenFile = (name) => {
    if (!dialog.el.isConnected) return;
    dialog.body.querySelector(".browse-file-name").value = name;
    dialog.close("open");
  };
  dialog.body.querySelector(".sample-pictures-folder").focus();
  return dialog;
};

const wireDisplayProperties = (win) => {
  const content = win.el.querySelector(".display-properties-content");
  if (!content) return;

  let current = getDisplaySettings();
  let pending = { ...current };
  let resolutionPreviewActive = false;
  let resolutionPreviewSnapshot = null;
  const tabs = [...content.querySelectorAll('[role="tab"]')];
  const panels = [...content.querySelectorAll('[role="tabpanel"]')];
  const controls = {
    theme: content.querySelector("#display-theme"),
    wallpaper: content.querySelector("#display-wallpaper"),
    position: content.querySelector("#display-position"),
    color: content.querySelector("#display-color"),
    image: content.querySelector("#display-image"),
    clearImage: content.querySelector(".display-clear-image"),
    saver: content.querySelector("#display-saver"),
    saverSettings: content.querySelector(".display-saver-settings"),
    saverPreviewButton: content.querySelector(".display-saver-preview-button"),
    saverWait: content.querySelector("#display-saver-wait"),
    saverLogin: content.querySelector(".display-saver-login"),
    appearance: content.querySelector("#display-appearance"),
    windowStyle: content.querySelector("#display-window-style"),
    fontSize: content.querySelector("#display-font-size"),
    resolution: content.querySelector("#display-resolution"),
    resolutionSlider: content.querySelector("#display-resolution-slider"),
    preview: content.querySelector(".display-preview-surface"),
    saverPreview: content.querySelector(".screen-saver-preview"),
    appearancePreview: content.querySelector(".appearance-preview"),
    themeSample: content.querySelector(".display-theme-sample"),
    resolutionPreview: content.querySelector(".display-resolution-preview"),
    resolutionValue: content.querySelector(".display-resolution-value"),
    status: content.querySelector(".display-status"),
    customize: content.querySelector(".display-customize"),
    browse: content.querySelector(".display-browse"),
    apply: content.querySelector('[data-display-action="apply"]'),
  };
  const setStatus = (message = "") => {
    controls.status.textContent = message;
    controls.status.hidden = !message;
  };
  const syncScreenSaverPreview = () =>
    renderScreenSaver(
      controls.saverPreview,
      pending.screenSaver,
      !content.querySelector("#display-panel-saver").hidden,
    );
  const themes = {
    "windows-xp": {
      appearance: "blue",
      wallpaper: "bliss",
      backgroundColor: "#3a6ea5",
    },
    classic: {
      appearance: "classic",
      wallpaper: "none",
      backgroundColor: "#3a6ea5",
    },
    olive: {
      appearance: "olive",
      wallpaper: "autumn",
      backgroundColor: "#586b2f",
    },
  };
  const sync = () => {
    controls.theme.value = pending.theme;
    controls.wallpaper.value = pending.wallpaper;
    content.querySelectorAll("[data-wallpaper]").forEach((item) => {
      const selected = item.dataset.wallpaper === pending.wallpaper;
      item.classList.toggle("selected", selected);
      item.setAttribute("aria-selected", String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    controls.position.value = pending.position;
    controls.color.value = pending.backgroundColor;
    controls.saver.value = pending.screenSaver;
    controls.saverSettings.disabled = pending.screenSaver === "none";
    controls.saverPreviewButton.disabled = pending.screenSaver === "none";
    controls.saverWait.value = String(pending.screenSaverWait);
    controls.saverLogin.checked = pending.requireLoginOnResume;
    controls.appearance.value = pending.appearance;
    controls.appearance.disabled = pending.appearance === "classic";
    controls.windowStyle.value =
      pending.appearance === "classic" ? "classic" : "xp";
    controls.fontSize.value = pending.fontSize;
    controls.resolution.value = pending.resolution;
    controls.resolutionSlider.value = String(
      pending.resolution === "auto"
        ? 1
        : ["800x600", "1024x768", "1440x900"].indexOf(pending.resolution),
    );
    controls.clearImage.hidden = !pending.customWallpaper;
    controls.preview.style.backgroundColor = pending.backgroundColor;
    controls.preview.style.backgroundImage = displayBackground(pending);
    controls.preview.dataset.position = pending.position;
    content.querySelector(".display-color-button span").style.backgroundColor =
      pending.backgroundColor;
    controls.saverPreview.dataset.saver = pending.screenSaver;
    syncScreenSaverPreview();
    controls.appearancePreview.dataset.appearance = pending.appearance;
    controls.themeSample.dataset.appearance = pending.appearance;
    controls.themeSample.style.backgroundColor = pending.backgroundColor;
    controls.themeSample.style.backgroundImage = displayBackground(pending);
    controls.resolutionPreview.dataset.resolution = pending.resolution;
    const monitor = getSimulatedMonitorSize(pending.resolution);
    controls.resolutionValue.textContent =
      pending.resolution === "auto"
        ? `${window.innerWidth} by ${window.innerHeight} pixels`
        : `${pending.resolution.replace("x", " by ")} pixels${monitor.limited ? ` (limited to ${monitor.width} by ${monitor.height})` : ""}`;
    controls.apply.disabled =
      JSON.stringify(pending) === JSON.stringify(current);
  };
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
    if (panelId === "display-panel-desktop")
      requestAnimationFrame(syncWallpaperScrollbar);
    syncScreenSaverPreview();
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
  controls.theme.addEventListener("change", () => {
    if (!Object.hasOwn(themes, controls.theme.value)) {
      openDisplayNotice(
        win,
        controls.theme.value === "online" ? "Windows Themes" : "Open Theme",
        controls.theme.value === "online"
          ? "More themes are not available in Astro Flash Collection."
          : "Select Windows XP or Windows Classic to change the current theme.",
      );
      controls.theme.value = pending.theme;
      return;
    }
    pending = {
      ...pending,
      theme: controls.theme.value,
      customWallpaper: "",
      ...themes[controls.theme.value],
    };
    sync();
  });
  controls.wallpaper.addEventListener("change", () => {
    pending = {
      ...pending,
      wallpaper: controls.wallpaper.value,
      customWallpaper: "",
    };
    sync();
  });
  const wallpaperList = content.querySelector(".display-wallpaper-list");
  const wallpaperItems = [
    ...wallpaperList.querySelectorAll("[data-wallpaper]"),
  ];
  const wallpaperScroller = wallpaperList.querySelector(
    ".display-wallpaper-items",
  );
  const wallpaperScrollbar = wallpaperList.querySelector(".display-scrollbar");
  const wallpaperScrollTrack =
    wallpaperScrollbar.querySelector(".scroll-track");
  const wallpaperScrollThumb =
    wallpaperScrollbar.querySelector(".scroll-thumb");
  const syncWallpaperScrollbar = () => {
    const maxScroll = Math.max(
      0,
      wallpaperScroller.scrollHeight - wallpaperScroller.clientHeight,
    );
    const trackHeight = wallpaperScrollTrack.clientHeight;
    const thumbHeight =
      maxScroll === 0
        ? trackHeight
        : Math.max(
            22,
            Math.round(
              trackHeight *
                (wallpaperScroller.clientHeight /
                  wallpaperScroller.scrollHeight),
            ),
          );
    const thumbTravel = Math.max(0, trackHeight - thumbHeight);
    const thumbTop =
      maxScroll === 0
        ? 0
        : Math.round((wallpaperScroller.scrollTop / maxScroll) * thumbTravel);
    wallpaperScrollThumb.style.height = `${thumbHeight}px`;
    wallpaperScrollThumb.style.transform = `translateY(${thumbTop}px)`;
    wallpaperScrollbar.classList.toggle("disabled", maxScroll === 0);
  };
  wallpaperScroller.addEventListener("scroll", syncWallpaperScrollbar);
  wallpaperScrollbar
    .querySelector(".scroll-arrow.up")
    .addEventListener("pointerdown", (event) => {
      event.preventDefault();
      wallpaperScroller.scrollBy({ top: -18 });
    });
  wallpaperScrollbar
    .querySelector(".scroll-arrow.down")
    .addEventListener("pointerdown", (event) => {
      event.preventDefault();
      wallpaperScroller.scrollBy({ top: 18 });
    });
  wallpaperScrollTrack.addEventListener("pointerdown", (event) => {
    if (event.target === wallpaperScrollThumb) return;
    event.preventDefault();
    const thumbBounds = wallpaperScrollThumb.getBoundingClientRect();
    const direction = event.clientY < thumbBounds.top ? -1 : 1;
    wallpaperScroller.scrollBy({
      top: direction * wallpaperScroller.clientHeight,
    });
  });
  wallpaperScrollThumb.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY;
    const startScrollTop = wallpaperScroller.scrollTop;
    const maxScroll =
      wallpaperScroller.scrollHeight - wallpaperScroller.clientHeight;
    const thumbTravel =
      wallpaperScrollTrack.clientHeight - wallpaperScrollThumb.offsetHeight;
    wallpaperScrollThumb.setPointerCapture(event.pointerId);
    const dragThumb = (moveEvent) => {
      if (thumbTravel <= 0) return;
      wallpaperScroller.scrollTop =
        startScrollTop +
        ((moveEvent.clientY - startY) / thumbTravel) * maxScroll;
    };
    const stopDragging = () => {
      wallpaperScrollThumb.removeEventListener("pointermove", dragThumb);
      wallpaperScrollThumb.removeEventListener("pointerup", stopDragging);
      wallpaperScrollThumb.removeEventListener("pointercancel", stopDragging);
    };
    wallpaperScrollThumb.addEventListener("pointermove", dragThumb);
    wallpaperScrollThumb.addEventListener("pointerup", stopDragging);
    wallpaperScrollThumb.addEventListener("pointercancel", stopDragging);
  });
  requestAnimationFrame(syncWallpaperScrollbar);
  const selectWallpaper = (item, { focus = false } = {}) => {
    pending = {
      ...pending,
      wallpaper: item.dataset.wallpaper,
      customWallpaper: "",
    };
    sync();
    item.scrollIntoView({ block: "nearest" });
    if (focus) item.focus();
  };
  wallpaperList.addEventListener("click", (event) => {
    const item = event.target.closest("[data-wallpaper]");
    if (!item) return;
    selectWallpaper(item);
  });
  wallpaperList.addEventListener("keydown", (event) => {
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const selectedIndex = wallpaperItems.findIndex(
      (item) => item.dataset.wallpaper === pending.wallpaper,
    );
    const targetIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? wallpaperItems.length - 1
          : Math.max(
              0,
              Math.min(
                wallpaperItems.length - 1,
                selectedIndex + (event.key === "ArrowDown" ? 1 : -1),
              ),
            );
    selectWallpaper(wallpaperItems[targetIndex], { focus: true });
  });
  ["position", "appearance", "saver"].forEach((name) => {
    controls[name].addEventListener("change", () => {
      pending = {
        ...pending,
        [name === "saver" ? "screenSaver" : name]: controls[name].value,
      };
      sync();
    });
  });
  const setPendingResolution = (resolution) => {
    pending = { ...pending, resolution };
    if (pending.resolution === current.resolution) {
      applySimulatedMonitor(current.resolution, { reflow: false });
      restoreWindowState(resolutionPreviewSnapshot);
      resolutionPreviewSnapshot = null;
      resolutionPreviewActive = false;
    } else {
      resolutionPreviewSnapshot ||= snapshotWindowState();
      resolutionPreviewActive = true;
      applySimulatedMonitor(pending.resolution);
    }
    sync();
  };
  controls.resolution.addEventListener("change", () => {
    setPendingResolution(controls.resolution.value);
  });
  controls.resolutionSlider.addEventListener("input", () => {
    setPendingResolution(
      ["800x600", "1024x768", "1440x900", "auto"][
        Number(controls.resolutionSlider.value)
      ],
    );
  });
  controls.color.addEventListener("input", () => {
    pending = { ...pending, backgroundColor: controls.color.value };
    sync();
  });
  controls.saverWait.addEventListener("change", () => {
    const wait = Math.min(
      60,
      Math.max(1, Number.parseInt(controls.saverWait.value, 10) || 1),
    );
    pending = { ...pending, screenSaverWait: wait };
    sync();
  });
  controls.saverLogin.addEventListener("change", () => {
    pending = {
      ...pending,
      requireLoginOnResume: controls.saverLogin.checked,
    };
    sync();
  });
  controls.fontSize.addEventListener("change", () => {
    pending = { ...pending, fontSize: controls.fontSize.value };
    sync();
  });
  let wallpaperBrowseDialog = null;
  controls.browse.addEventListener("click", () => {
    wallpaperBrowseDialog = openWallpaperBrowseDialog(win, controls.image);
  });
  controls.image.addEventListener("change", () => {
    const [file] = controls.image.files;
    if (!file) return;
    const supportedTypes = [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
    ];
    if (!supportedTypes.includes(file.type)) {
      setStatus("Choose a PNG, JPEG, GIF, or WebP image.");
      controls.image.value = "";
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (
        typeof reader.result !== "string" ||
        !reader.result.startsWith("data:image/")
      )
        return;
      pending = { ...pending, customWallpaper: reader.result };
      setStatus(`${file.name} will be used after you apply changes.`);
      sync();
      wallpaperBrowseDialog?.setChosenFile(file.name);
      wallpaperBrowseDialog = null;
    });
    reader.readAsDataURL(file);
  });
  controls.clearImage.addEventListener("click", () => {
    pending = { ...pending, customWallpaper: "" };
    controls.image.value = "";
    sync();
  });
  controls.customize.addEventListener("click", () => {
    openDesktopItemsDialog(win);
  });
  content.querySelector(".display-effects").addEventListener("click", () => {
    openDisplayEffectsDialog(win, pending, (next) => {
      pending = next;
      sync();
    });
  });
  content
    .querySelector(".display-advanced-appearance")
    .addEventListener("click", () => {
      openAdvancedAppearanceDialog(win, pending, (next) => {
        pending = next;
        sync();
      });
    });
  content
    .querySelector(".display-monitor-advanced")
    .addEventListener("click", () => openMonitorPropertiesDialog(win));
  content
    .querySelector(".display-theme-save")
    .addEventListener("click", () =>
      openDisplayNotice(
        win,
        "Save Theme",
        "The current theme settings are already saved for this desktop.",
      ),
    );
  controls.saverSettings.addEventListener("click", () =>
    openDisplayNotice(
      win,
      "Screen Saver Settings",
      "This screen saver has no options that you can set.",
    ),
  );
  content
    .querySelector(".display-power-button")
    .addEventListener("click", () =>
      openDisplayNotice(
        win,
        "Power Options Properties",
        "Power management is controlled by your browser and operating system.",
      ),
    );
  content
    .querySelector(".display-troubleshoot")
    .addEventListener("click", () =>
      openDisplayNotice(
        win,
        "Display Troubleshooter",
        "Use the screen resolution slider or restore Use browser size to return to the full desktop.",
      ),
    );
  content
    .querySelector(".display-saver-preview-button")
    .addEventListener("click", () => {
      const saver = document.getElementById("screen-saver-overlay");
      if (!saver || pending.screenSaver === "none") return;
      showScreenSaver(saver, pending.screenSaver);
      const closePreview = () => {
        hideScreenSaver(saver);
      };
      screenSaverPreviewCleanup = () => {
        document.removeEventListener("keydown", closePreview);
        saver.removeEventListener("pointerdown", closePreview);
      };
      document.addEventListener("keydown", closePreview, { once: true });
      saver.addEventListener("pointerdown", closePreview, { once: true });
    });
  content
    .querySelector('[data-display-action="apply"]')
    .addEventListener("click", () => {
      if (!isDisplaySettings(pending)) return;
      if (!saveDisplaySettings(pending)) {
        setStatus("Windows could not save this picture. Try a smaller image.");
        return;
      }
      current = { ...pending };
      applyDisplaySettings(current);
      resolutionPreviewActive = false;
      resolutionPreviewSnapshot = null;
      setStatus();
      sync();
    });
  content
    .querySelector('[data-display-action="ok"]')
    .addEventListener("click", () => {
      if (!controls.apply.disabled) controls.apply.click();
      if (controls.apply.disabled) closeGameWindow(win.gameId);
    });
  const rollbackResolutionPreview = () => {
    if (resolutionPreviewActive) {
      applySimulatedMonitor(current.resolution, { reflow: false });
      restoreWindowState(resolutionPreviewSnapshot);
    }
    resolutionPreviewActive = false;
    resolutionPreviewSnapshot = null;
  };
  win.beforeClose = () => {
    rollbackResolutionPreview();
    renderScreenSaver(controls.saverPreview, pending.screenSaver, false);
  };
  content
    .querySelector('[data-display-action="cancel"]')
    .addEventListener("click", () => closeGameWindow(win.gameId));
  sync();
};
