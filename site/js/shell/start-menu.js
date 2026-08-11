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

const openPrintersAndFaxes = () => openSystemWindow("__printers");

const wirePrintersAndFaxes = (win) => {
  const content = win.el.querySelector(".printers-content");
  const menu = content.querySelector(".printers-menu");
  const closeMenu = () => {
    menu.hidden = true;
    content
      .querySelectorAll("[data-printers-menu]")
      .forEach((button) => button.setAttribute("aria-expanded", "false"));
  };
  const showMenu = (button) => {
    const labels =
      button.dataset.printersMenu === "file"
        ? [["Close", "close"]]
        : button.dataset.printersMenu === "help"
          ? [
              ["Help and Support", "help"],
              ["About Windows", "about"],
            ]
          : [["No commands available", "none"]];
    menu.replaceChildren();
    labels.forEach(([label, command]) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "game-menu-item";
      item.textContent = label;
      item.dataset.printersCommand = command;
      item.disabled = command === "none";
      menu.appendChild(item);
    });
    menu.style.left = `${button.offsetLeft}px`;
    menu.style.top = `${button.offsetTop + button.offsetHeight}px`;
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
  };
  content.addEventListener("click", (event) => {
    const menuButton = event.target.closest("[data-printers-menu]");
    if (menuButton) return showMenu(menuButton);
    const command = event.target.closest("[data-printers-command]")?.dataset
      .printersCommand;
    if (command === "close") closeGameWindow("__printers");
    if (command === "help") openHelpAndSupport();
    if (command === "about") openProjectSettings();
    if (command) return closeMenu();
    const action = event.target.closest("[data-printers-action]")?.dataset
      .printersAction;
    if (action === "add" || action === "fax") {
      XPDialogs.message({
        title: action === "add" ? "Add Printer Wizard" : "Fax Setup Wizard",
        text: "This setup wizard is not available in Astro Flash Collection.",
        icon: "info",
      });
    } else if (action === "search") openSearchDialog();
    else if (action === "folders") content.classList.toggle("folders-visible");
    else if (action === "control-panel") openControlPanel();
    else if (action === "documents") openSystemWindow("__my-documents");
    else if (action === "pictures") openSystemWindow("__my-pictures");
    else if (action === "computer") openSystemWindow("__my-computer");
    else if (action === "scanners")
      XPDialogs.alert(
        "No scanners or cameras are installed.",
        "Scanners and Cameras",
        "info",
      );
    else if (action === "troubleshoot" || action === "help")
      openHelpAndSupport();
    const toggle = event.target.closest(".explorer-section-toggle");
    if (toggle) {
      const section = toggle.closest("section");
      section.classList.toggle("collapsed");
      toggle.querySelector("[aria-hidden]").textContent =
        section.classList.contains("collapsed") ? "⌄" : "⌃";
    }
  });
};

const wireHelpAndSupport = (win) => {
  const content = win.el.querySelector(".help-center-content");
  const query = content.querySelector("#help-query");
  const topics = [...content.querySelectorAll("[data-help-topic]")];
  const filterTopics = () => {
    const needle = query.value.trim().toLocaleLowerCase();
    topics.forEach((topic) => {
      topic.hidden =
        Boolean(needle) &&
        !topic.textContent.toLocaleLowerCase().includes(needle);
    });
  };
  content.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    filterTopics();
  });
  content.addEventListener("click", (event) => {
    const action =
      event.target.closest("[data-help-action]")?.dataset.helpAction;
    if (action === "home") {
      query.value = "";
      filterTopics();
    } else if (action === "support") {
      window.open(
        "https://github.com/astrovm/flash/issues",
        "_blank",
        "noopener",
      );
    } else if (action) {
      XPDialogs.alert(
        `${event.target.closest("[data-help-action]").textContent.trim() || "This option"} is not available in Astro Flash Collection.`,
        "Help and Support Center",
        "info",
      );
    }
    const topic = event.target.closest("[data-help-topic]");
    if (topic)
      XPDialogs.alert(
        `Help content for “${topic.textContent.trim()}” is not available in Astro Flash Collection.`,
        "Help and Support Center",
        "info",
      );
  });
};

const openHelpAndSupport = () => openSystemWindow("__help");

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

const openSoundsAudioProperties = (initialTab = "volume") => {
  const dialog = XPDialogs.createDialog({
    title: "Sounds and Audio Devices Properties",
  });
  dialog.el.classList.add("sounds-audio-properties-dialog");
  const help = document.createElement("button");
  help.type = "button";
  help.className = "tb-btn help-btn";
  help.setAttribute("aria-label", "Help");
  dialog.el.querySelector(".title-buttons").prepend(help);
  const tabs = ["Volume", "Sounds", "Audio", "Voice", "Hardware"];
  const deviceGroup = (title, icon, device, second = "Advanced...") =>
    `<fieldset><legend>${title}</legend><img src="${icon}" alt=""><label>Default device:<select disabled><option>${device}</option></select></label><button class="xp-btn" disabled>Volume...</button><button class="xp-btn" disabled>${second}</button></fieldset>`;
  dialog.body.innerHTML = `<div class="sounds-properties-tabs" role="tablist">${tabs.map((tab) => `<button type="button" role="tab" data-sounds-tab="${tab.toLowerCase()}">${tab}</button>`).join("")}</div><div class="sounds-properties-panels">
    <section data-sounds-panel="volume"><div class="sounds-no-device"><img src="assets/xp/icons/SoundsAndAudioDevices.png" alt=""><span>No Audio Device</span></div><fieldset class="device-volume-settings"><legend>Device volume</legend><img src="assets/xp/icons/SoundsAndAudioDevices.png" alt=""><div class="device-volume-slider"><input type="range" value="0" disabled><span class="volume-ticks" aria-hidden="true"></span><span class="volume-low">Low</span><span class="volume-high">High</span></div><label class="volume-mute"><input type="checkbox" disabled> Mute</label><label class="volume-taskbar"><input type="checkbox" disabled> Place volume icon in the taskbar</label><button class="xp-btn" disabled>Advanced...</button></fieldset><fieldset class="speaker-settings"><legend>Speaker settings</legend><img class="speaker-pair" src="assets/xp/system/SpeakerSettings.png" alt=""><p>Use the settings below to change individual<br>speaker volume and other settings.</p><button class="xp-btn" disabled>Speaker Volume...</button><button class="xp-btn" disabled>Advanced...</button></fieldset></section>
    <section data-sounds-panel="sounds"><p class="sounds-intro">A sound scheme is a set of sounds applied to events in Windows<br>and programs. You can select an existing scheme or save one you<br>have modified.</p><label class="sound-scheme">Sound scheme:<select><option></option></select></label><div class="sounds-scheme-buttons"><button class="xp-btn">Save As...</button><button class="xp-btn">Delete</button></div><p class="sounds-help">To change sounds, click a program event in the following list and<br>then select a sound to apply. You can save the changes as a new<br>sound scheme.</p><label class="program-events-label">Program events:</label><div class="program-events"><strong><span class="tree-toggle">−</span> Windows</strong>${["Asterisk", "Close program", "Critical Battery Alarm", "Critical Stop", "Default Beep"].map((name) => `<span><img src="assets/xp/icons/SoundsAudioSmall.png" alt="">${name}</span>`).join("")}</div><label class="sounds-picker disabled-copy">Sounds:<select disabled><option></option></select><button class="xp-btn sound-play" aria-label="Play" disabled></button><button class="xp-btn sound-browse" disabled>Browse...</button></label></section>
    <section data-sounds-panel="audio">${deviceGroup("Sound playback", "assets/xp/icons/SoundsAndAudioDevices.png", "No Playback Devices")}${deviceGroup("Sound recording", "assets/xp/system/AudioRecording.png", "No Recording Devices")}${deviceGroup("MIDI music playback", "assets/xp/system/MidiPlayback.png", "No MIDI Playback Devices", "About...")}<label class="audio-default-devices"><input type="checkbox" disabled> Use only default devices</label></section>
    <section data-sounds-panel="voice"><p class="voice-intro">These settings control volume and advanced options for the voice<br>playback or recording device you selected.</p>${deviceGroup("Voice playback", "assets/xp/icons/SoundsAndAudioDevices.png", "No Playback Devices")}${deviceGroup("Voice recording", "assets/xp/system/AudioRecording.png", "No Recording Devices")}<button class="xp-btn voice-test" disabled>Test hardware...</button></section>
    <section data-sounds-panel="hardware"><label class="hardware-devices-label">Devices:</label><div class="audio-hardware-list"><strong><span>Name</span><span>Type</span></strong>${[
      ["QEMU QEMU DVD-ROM", "DVD/CD-R...", "assets/xp/icons/OpticalDrive.png"],
      ["Audio Codecs", "Sound, vid...", "assets/xp/icons/SoundsAudioSmall.png"],
      [
        "Legacy Audio Drivers",
        "Sound, vid...",
        "assets/xp/icons/SoundsAudioSmall.png",
      ],
      [
        "Media Control Devices",
        "Sound, vid...",
        "assets/xp/icons/SoundsAudioSmall.png",
      ],
      [
        "Legacy Video Capture Devices",
        "Sound, vid...",
        "assets/xp/icons/SoundsAudioSmall.png",
      ],
      ["Video Codecs", "Sound, vid...", "assets/xp/icons/SoundsAudioSmall.png"],
    ]
      .map(
        ([name, type, icon]) =>
          `<span><img src="${icon}" alt=""><span>${name}</span><span>${type}</span></span>`,
      )
      .join(
        "",
      )}</div><fieldset><legend>Device Properties</legend><p>Manufacturer: (Standard CD-ROM drives)</p><p>Location: Location 0 (0)</p><p>Device Status: This device is working properly.</p><button class="xp-btn">Troubleshoot...</button><button class="xp-btn">Properties</button></fieldset></section>
  </div>`;
  const activate = (tab) => {
    dialog.body
      .querySelectorAll("[data-sounds-tab]")
      .forEach((button) =>
        button.setAttribute(
          "aria-selected",
          String(button.dataset.soundsTab === tab),
        ),
      );
    dialog.body.querySelectorAll("[data-sounds-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.soundsPanel !== tab;
    });
  };
  dialog.body.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-sounds-tab]")?.dataset.soundsTab;
    if (tab) activate(tab);
  });
  activate(initialTab);
  XPDialogs.addButtonRow(dialog, [
    { id: "ok", label: "OK", isDefault: true },
    { id: "cancel", label: "Cancel", isCancel: true },
    { id: "apply", label: "Apply" },
  ]);
  dialog.body.querySelector('[data-action="apply"]').disabled = true;
};

const openAccessibilityOptions = (initialTab = "keyboard") => {
  const dialog = XPDialogs.createDialog({ title: "Accessibility Options" });
  dialog.el.classList.add("accessibility-options-dialog");
  const help = document.createElement("button");
  help.type = "button";
  help.className = "tb-btn help-btn";
  help.setAttribute("aria-label", "Help");
  dialog.el.querySelector(".title-buttons").prepend(help);
  const group = (title, body) =>
    `<fieldset><legend>${title}</legend>${body}</fieldset>`;
  dialog.body.innerHTML = `<div class="accessibility-tabs" role="tablist">${["Keyboard", "Sound", "Display", "Mouse", "General"].map((tab) => `<button type="button" role="tab" data-accessibility-tab="${tab.toLowerCase()}">${tab}</button>`).join("")}</div><div class="accessibility-panels">
    <section data-accessibility-panel="keyboard">${group("StickyKeys", '<p>Use StickyKeys if you want to use SHIFT, CTRL, ALT, or<br>Windows logo key by pressing one key at a time.</p><label><input type="checkbox"> Use StickyKeys</label><button class="xp-btn">Settings</button>')}${group("FilterKeys", '<p>Use FilterKeys if you want Windows to ignore brief or repeated<br>keystrokes, or slow the repeat rate.</p><label><input type="checkbox"> Use FilterKeys</label><button class="xp-btn">Settings</button>')}${group("ToggleKeys", '<p>Use ToggleKeys if you want to hear tones when pressing<br>CAPS LOCK, NUM LOCK, and SCROLL LOCK.</p><label><input type="checkbox"> Use ToggleKeys</label><button class="xp-btn">Settings</button>')}<label><input type="checkbox"> Show extra keyboard help in programs</label></section>
    <section data-accessibility-panel="sound">${group("SoundSentry", '<p>Use SoundSentry if you want Windows to generate visual<br>warnings when your system makes a sound.</p><label><input type="checkbox"> Use SoundSentry</label><p class="disabled-copy">Choose the visual warning:</p>')}</section>
    <section data-accessibility-panel="display">${group("High Contrast", '<p>Use this option if you want Windows to use colors and fonts<br>designed for easy reading.</p><label><input type="checkbox"> Use High Contrast</label><button class="xp-btn">Settings</button>')}${group("Cursor Options", '<p>Move the sliders to change the speed that the cursor blinks<br>(cursor blink rate) and the width of the cursor.</p><div class="cursor-slider cursor-blink"><span class="cursor-slider-title">Blink Rate:</span><span>None</span><input type="range" min="0" max="10" value="6"><span>Fast</span><i aria-hidden="true"></i></div><div class="cursor-slider cursor-width"><span class="cursor-slider-title">Width:</span><span>Narrow</span><input type="range" min="0" max="10" value="0"><span>Wide</span><i aria-hidden="true"></i></div>')}</section>
    <section data-accessibility-panel="mouse">${group("MouseKeys", '<p>Use MouseKeys if you want to control the pointer with the<br>numeric keypad on your keyboard.</p><label><input type="checkbox"> Use MouseKeys</label><button class="xp-btn">Settings</button>')}</section>
    <section data-accessibility-panel="general">${group("Automatic reset", '<label><input type="checkbox"> Turn off accessibility features after idle for:</label><select disabled><option>5 minutes</option></select>')}${group("Notification", '<label><input type="checkbox" checked> Give warning message when turning a feature on</label><label><input type="checkbox" checked> Make a sound when turning a feature on or off</label>')}${group("SerialKey devices", '<p>SerialKey devices allow alternative access to keyboard and<br>mouse features.</p><label><input type="checkbox"> Use Serial Keys</label><button class="xp-btn">Settings</button>')}${group("Administrative options", '<label><input type="checkbox"> Apply all settings to logon desktop</label><label><input type="checkbox"> Apply all settings to defaults for new users</label>')}</section>
  </div>`;
  const activate = (tab) => {
    dialog.body
      .querySelectorAll("[data-accessibility-tab]")
      .forEach((button) =>
        button.setAttribute(
          "aria-selected",
          String(button.dataset.accessibilityTab === tab),
        ),
      );
    dialog.body
      .querySelectorAll("[data-accessibility-panel]")
      .forEach((panel) => {
        panel.hidden = panel.dataset.accessibilityPanel !== tab;
      });
  };
  dialog.body.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-accessibility-tab]")?.dataset
      .accessibilityTab;
    if (tab) activate(tab);
  });
  activate(initialTab);
  XPDialogs.addButtonRow(dialog, [
    { id: "ok", label: "OK", isDefault: true },
    { id: "cancel", label: "Cancel", isCancel: true },
    { id: "apply", label: "Apply" },
  ]);
  dialog.body.querySelector('[data-action="apply"]').disabled = true;
};

const openSystemProperties = () => {
  const dialog = XPDialogs.createDialog({ title: "System Properties" });
  dialog.el.classList.add("system-properties-dialog");
  const help = document.createElement("button");
  help.type = "button";
  help.className = "tb-btn help-btn";
  help.title = "Help";
  help.setAttribute("aria-label", "Help");
  dialog.el.querySelector(".title-buttons").prepend(help);
  dialog.body.innerHTML = `
    <div class="system-properties-tabs" role="tablist" data-active-row="lower">
      <button type="button" role="tab" data-system-tab="restore">System Restore</button>
      <button type="button" role="tab" data-system-tab="updates">Automatic Updates</button>
      <button type="button" role="tab" data-system-tab="remote">Remote</button>
      <button type="button" role="tab" data-system-tab="general" aria-selected="true">General</button>
      <button type="button" role="tab" data-system-tab="computer-name">Computer Name</button>
      <button type="button" role="tab" data-system-tab="hardware">Hardware</button>
      <button type="button" role="tab" data-system-tab="advanced">Advanced</button>
    </div>
    <div class="system-properties-panels">
      <section data-system-panel="general">
        <img class="system-properties-logo" src="assets/xp/SystemProperties.png" alt="">
        <div class="system-properties-general-copy">
          <p>System:<br><span>Microsoft Windows XP<br>Professional<br>Version 2002<br>Service Pack 3</span></p>
          <p>Registered to:<br><span>astro<br><br>76487-640-8834005-23175</span></p>
          <p>Computer:<br><span>Intel Pentium III Xeon<br>processor<br>1.00 GHz, 512 MB of RAM</span></p>
        </div>
      </section>
      <section data-system-panel="computer-name" hidden>
        <div class="system-computer-name-intro">
          <img src="assets/xp/system/ComputerName.png" alt="">
          <p>Windows uses the following information to identify your computer<br>on the network.</p>
        </div>
        <div class="system-computer-description">
          <label for="system-computer-description">Computer description:</label>
          <input id="system-computer-description" class="xp-input">
          <p>For example: "Kitchen Computer" or "Mary's<br>Computer".</p>
        </div>
        <dl class="system-computer-identity">
          <dt>Full computer name:</dt><dd>astro-295e53a14.</dd>
          <dt>Workgroup:</dt><dd>WORKGROUP</dd>
        </dl>
        <div class="system-computer-action">
          <p>To use the Network Identification Wizard to join a<br>domain and create a local user account, click Network<br>ID.</p>
          <button type="button" class="xp-btn">Network ID</button>
        </div>
        <div class="system-computer-action system-computer-change">
          <p>To rename this computer or join a domain, click Change.</p>
          <button type="button" class="xp-btn">Change...</button>
        </div>
      </section>
      <section data-system-panel="hardware" hidden>
        <div class="system-properties-group system-hardware-group system-device-manager"><span class="system-group-title">Device Manager</span>
          <img src="assets/xp/system/DeviceManager.png" alt="">
          <p>The Device Manager lists all the hardware devices installed<br>on your computer. Use the Device Manager to change the<br>properties of any device.</p>
          <button type="button" class="xp-btn">Device Manager</button>
        </div>
        <div class="system-properties-group system-hardware-group system-driver-signing"><span class="system-group-title">Drivers</span>
          <img src="assets/xp/system/DriverSigning.png" alt="">
          <p>Driver Signing lets you make sure that installed drivers are<br>compatible with Windows. Windows Update lets you set up<br>how Windows connects to Windows Update for drivers.</p>
          <button type="button" class="xp-btn">Driver Signing</button>
        </div>
      </section>
      <section data-system-panel="advanced" hidden>
        <p class="system-advanced-intro">You must be logged on as an Administrator to make most of these changes.</p>
        <div class="system-properties-group system-advanced-group"><span class="system-group-title">Performance</span><p>Visual effects, processor scheduling, memory usage, and virtual memory</p><button type="button" class="xp-btn">Settings</button></div>
        <div class="system-properties-group system-advanced-group"><span class="system-group-title">User Profiles</span><p>Desktop settings related to your logon</p><button type="button" class="xp-btn">Settings</button></div>
        <div class="system-properties-group system-advanced-group"><span class="system-group-title">Startup and Recovery</span><p>System startup, system failure, and debugging information</p><button type="button" class="xp-btn">Settings</button></div>
        <div class="system-advanced-actions"><button type="button" class="xp-btn">Environment Variables</button><button type="button" class="xp-btn">Error Reporting</button></div>
      </section>
      <section data-system-panel="restore" hidden>
        <div class="system-restore-intro"><img src="assets/xp/system/SystemRestore.png" alt=""><p>System Restore can track and reverse harmful changes to your<br>computer.</p></div>
        <label class="system-restore-off"><input type="checkbox"> Turn off System Restore</label>
        <div class="system-properties-group system-restore-space"><span class="system-group-title">Disk space usage</span>
          <p>Move the slider to the right to increase or to the left to decrease the<br>amount of disk space for System Restore. Decreasing the disk space<br>may reduce the number of available restore points.</p>
          <div class="system-restore-slider-label"><span>Disk space to use:</span><span>Min</span><span>Max</span></div>
          <input type="range" min="0" max="100" value="100" aria-label="Disk space to use">
          <output>12% (981 MB)</output>
        </div>
        <div class="system-properties-group system-restore-status"><span class="system-group-title">Status</span><p><img class="system-drive-icon" src="assets/xp/icons/LocalDisk.png" alt=""> (C:) Monitoring</p></div>
      </section>
      <section data-system-panel="updates" hidden>
        <div class="system-updates-banner"><img src="assets/xp/system/UpdateShield.png" alt=""><span>Help protect your PC</span></div>
        <p class="system-updates-copy">Windows can regularly check for important updates and install them for you.<br>(Turning on Automatic Updates may automatically update Windows Update<br>software first, before any other updates.)<br><a href="https://support.microsoft.com/windows" target="_blank" rel="noreferrer">How does Automatic Updates work?</a></p>
        <label class="system-update-option system-update-auto"><input type="radio" name="system-updates" checked> <strong>Automatic (recommended)</strong></label>
        <div class="system-update-detail"><img src="assets/xp/system/UpdateEnabled.png" alt=""><p>Automatically download recommended updates for my computer<br>and install them:</p><div><select disabled aria-label="Update frequency"><option>Every day</option></select><span>at</span><select disabled aria-label="Update time"><option>3:00 AM</option></select></div></div>
        <label class="system-update-option"><input type="radio" name="system-updates"> Download updates for me, but let me choose when to install them.</label>
        <label class="system-update-option"><input type="radio" name="system-updates"> Notify me but don't automatically download or install them.</label>
        <label class="system-update-option"><input type="radio" name="system-updates"> Turn off Automatic Updates.</label>
        <div class="system-update-warning"><img src="assets/xp/system/UpdateDisabled.png" alt=""><p>Your computer will be more vulnerable unless you install updates<br>regularly.<br>Install updates from the <a href="https://update.microsoft.com/" target="_blank" rel="noreferrer">Windows Update Web site</a>.</p></div>
        <a class="system-updates-hidden" href="#">Offer updates again that I've previously hidden</a>
      </section>
      <section data-system-panel="remote" hidden>
        <div class="system-remote-intro"><img src="assets/xp/system/RemoteSettings.png" alt=""><p>Select the ways that this computer can be used from another<br>location.</p></div>
        <div class="system-properties-group system-remote-assistance"><span class="system-group-title">Remote Assistance</span>
          <label><input type="checkbox" checked> Allow Remote Assistance invitations to be sent from this computer</label>
          <a href="https://support.microsoft.com/windows" target="_blank" rel="noreferrer">What is Remote Assistance?</a>
          <button type="button" class="xp-btn">Advanced...</button>
        </div>
        <div class="system-properties-group system-remote-desktop"><span class="system-group-title">Remote Desktop</span>
          <label><input type="checkbox"> Allow users to connect remotely to this computer</label>
          <p class="system-remote-computer">Full computer name:<br><span>astro-295e53a14</span></p>
          <a class="system-remote-help" href="https://support.microsoft.com/windows" target="_blank" rel="noreferrer">What is Remote Desktop?</a>
          <button type="button" class="xp-btn system-remote-users">Select Remote Users...</button>
          <p class="system-remote-password">For users to connect remotely to this computer, the user account must<br>have a password.</p>
          <p class="system-remote-firewall"><a href="https://support.microsoft.com/windows" target="_blank" rel="noreferrer">Windows Firewall</a> will be configured to allow Remote Desktop<br>connections to this computer.</p>
        </div>
      </section>
    </div>
  `;
  const tabs = [...dialog.body.querySelectorAll("[data-system-tab]")];
  const panels = [...dialog.body.querySelectorAll("[data-system-panel]")];
  tabs.forEach((tab) =>
    tab.addEventListener("click", () => {
      tabs.forEach((entry) =>
        entry.setAttribute(
          "aria-selected",
          String(entry.dataset.systemTab === tab.dataset.systemTab),
        ),
      );
      panels.forEach((panel) => {
        panel.hidden = panel.dataset.systemPanel !== tab.dataset.systemTab;
      });
      dialog.body.querySelector(".system-properties-tabs").dataset.activeRow = [
        "restore",
        "updates",
        "remote",
      ].includes(tab.dataset.systemTab)
        ? "upper"
        : "lower";
    }),
  );
  help.addEventListener("click", openHelpAndSupport);
  XPDialogs.addButtonRow(dialog, [
    { id: "ok", label: "OK", isDefault: true },
    { id: "cancel", label: "Cancel", isCancel: true },
    { id: "apply", label: "Apply" },
  ]);
  dialog.body.querySelector('[data-action="apply"]').disabled = true;
};

const openShellProperties = (nodeId) =>
  nodeId === fs.MY_COMPUTER
    ? openSystemProperties()
    : XPDialogs.properties(nodeId);

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
  printers: openPrintersAndFaxes,
  help: openHelpAndSupport,
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
      item.addEventListener("click", () => open(true));
      item.addEventListener("keydown", (event) => {
        if (!["ArrowRight", "Enter"].includes(event.key)) return;
        event.preventDefault();
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
        label: "&Printers and Faxes",
        icon: "PrintersAndFaxes.png",
        action: startDestinationActions.printers,
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
      { id: "help", label: "&Help and Support", icon: "HelpAndSupport.png" },
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

  [
    ["controlPanel", "&Control Panel", "ControlPanel.png"],
    ["printers", "&Printers and Faxes", "PrintersAndFaxes.png"],
    ["help", "&Help and Support", "HelpAndSupport.png"],
  ].forEach(([id, label, icon]) =>
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
    const createCommand = ({ label, icon, action }) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "sm-game classic-start-command";
      const glyph = document.createElement("span");
      glyph.className = "sm-game-icon has-image";
      const image = document.createElement("img");
      image.src = XP_ICON_PATHS[icon];
      image.alt = "";
      glyph.appendChild(image);
      const title = document.createElement("span");
      title.className = "sm-game-title";
      title.textContent = label;
      item.append(glyph, title);
      item.addEventListener("click", () => {
        closeStartMenu();
        action();
      });
      return item;
    };
    [
      {
        label: "Set Program Access and Defaults",
        icon: "ProgramAccessDefaultsMenu.png",
        action: () => openSystemWindow("__add-remove-programs"),
      },
      {
        label: "Windows Catalog",
        icon: "WindowsCatalogMenu.png",
        action: () =>
          XPDialogs.alert(
            "Windows Catalog is not available in Astro Flash Collection.",
            "Windows Catalog",
            "info",
          ),
      },
      {
        label: "Windows Update",
        icon: "WindowsUpdateMenu.png",
        action: () => openSystemWindow("__security-center"),
      },
    ].forEach((definition) => container.appendChild(createCommand(definition)));
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
    xpProgramMenuItem("__program-access-defaults", "program-access-defaults"),
    xpProgramMenuItem("__windows-catalog", "windows-catalog"),
    xpProgramMenuItem("__windows-update", "windows-update"),
    { separator: true },
    {
      id: "accessories",
      label: "Accessories",
      icon: programFolder,
      children: [
        {
          id: "accessibility",
          label: "Accessibility",
          icon: programFolder,
          children: [
            xpProgramMenuItem("__accessibility-wizard"),
            xpProgramMenuItem("__magnifier"),
            xpProgramMenuItem("__narrator"),
            xpProgramMenuItem("__on-screen-keyboard"),
            xpProgramMenuItem("__utility-manager"),
          ],
        },
        {
          id: "communications",
          label: "Communications",
          icon: programFolder,
          children: [
            xpProgramMenuItem("__hyperterminal"),
            xpProgramMenuItem("__network-connections"),
            xpProgramMenuItem("__network-setup-wizard"),
            xpProgramMenuItem("__new-connection-wizard"),
            xpProgramMenuItem("__wireless-network-setup-wizard"),
          ],
        },
        {
          id: "entertainment",
          label: "Entertainment",
          icon: programFolder,
          children: [
            xpProgramMenuItem("__sound-recorder"),
            xpProgramMenuItem("__volume-control"),
            xpProgramMenuItem("__windows-media-player"),
          ],
        },
        {
          id: "system-tools",
          label: "System Tools",
          icon: programFolder,
          children: [
            xpProgramMenuItem("__backup"),
            xpProgramMenuItem("__character-map"),
            xpProgramMenuItem("__disk-cleanup"),
            xpProgramMenuItem("__disk-defragmenter"),
            xpProgramMenuItem("__files-settings-transfer"),
            xpProgramMenuItem("__scheduled-tasks"),
            {
              id: "security-center",
              label: "Security Center",
              icon: "SecurityCenter.png",
              action: () => openSystemWindow("__security-center"),
            },
            xpProgramMenuItem("__system-information"),
            xpProgramMenuItem("__system-restore"),
          ],
        },
        xpProgramMenuItem("__address-book"),
        xpProgramMenuItem("__calculator"),
        xpProgramMenuItem("__command-prompt"),
        {
          id: "notepad",
          label: "Notepad",
          icon: "Notepad.png",
          action: openNotepad,
        },
        xpProgramMenuItem("__paint"),
        xpProgramMenuItem("__program-compatibility-wizard"),
        xpProgramMenuItem("__remote-desktop", "remote-desktop-connection"),
        xpProgramMenuItem("__synchronize"),
        xpProgramMenuItem("__tour-windows-xp"),
        {
          id: "windows-explorer",
          label: "Windows Explorer",
          icon: "WindowsExplorer.png",
          action: () => openSystemWindow("__my-documents"),
        },
        xpProgramMenuItem("__wordpad"),
      ],
    },
    {
      id: "games",
      label: "Games",
      icon: programFolder,
      children: [
        xpProgramMenuItem("__freecell"),
        xpProgramMenuItem("__hearts"),
        xpProgramMenuItem("__internet-backgammon"),
        xpProgramMenuItem("__internet-checkers"),
        xpProgramMenuItem("__internet-hearts"),
        xpProgramMenuItem("__internet-reversi"),
        xpProgramMenuItem("__internet-spades"),
        xpProgramMenuItem("__minesweeper"),
        xpProgramMenuItem("__pinball"),
        xpProgramMenuItem("__solitaire"),
        xpProgramMenuItem("__spider-solitaire"),
        { separator: true },
        ...gameGroups,
      ],
    },
    {
      id: "startup",
      label: "Startup",
      icon: programFolder,
      children: [],
    },
    xpProgramMenuItem("__internet-explorer"),
    xpProgramMenuItem("__msn"),
    xpProgramMenuItem("__outlook-express"),
    xpProgramMenuItem("__remote-assistance"),
    xpProgramMenuItem("__windows-media-player"),
    xpProgramMenuItem("__windows-messenger"),
    xpProgramMenuItem("__windows-movie-maker"),
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
    image.src = XP_ICON_PATHS[definition.icon];
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
    item.addEventListener("click", () => open(true));
    item.addEventListener("keydown", (event) => {
      if (!["ArrowRight", "Enter"].includes(event.key)) return;
      event.preventDefault();
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
