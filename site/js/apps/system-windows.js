"use strict";

const createControlPanelContent = () => {
  const content = document.createElement("div");
  content.className = "control-panel-content";
  content.innerHTML = `
    <div class="explorer-chrome control-panel-chrome">
      <div class="explorer-menu-row">
        <div class="explorer-menu-bar" role="menubar">
          <button type="button" role="menuitem">File</button>
          <button type="button" role="menuitem">Edit</button>
          <button type="button" role="menuitem">View</button>
          <button type="button" role="menuitem">Favorites</button>
          <button type="button" role="menuitem">Tools</button>
          <button type="button" role="menuitem">Help</button>
        </div>
        <div class="explorer-brand" aria-hidden="true"><img src="assets/xp/WindowsFlag.png" alt=""></div>
      </div>
      <div class="explorer-toolbar">
        <button type="button" disabled><img src="assets/xp/icons/Back.png" alt=""> Back <span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
        <button type="button" disabled aria-label="Forward"><img src="assets/xp/icons/Forward.png" alt=""><span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
        <button type="button" disabled aria-label="Up"><img src="assets/xp/icons/Up.png" alt=""></button>
        <span class="explorer-toolbar-separator" aria-hidden="true"></span>
        <button type="button" data-control-panel-action="search"><img src="assets/xp/icons/Search.png" alt=""> Search</button>
        <button type="button" data-control-panel-action="folders" aria-pressed="false"><img src="assets/xp/icons/NewFolder.png" alt=""> Folders</button>
        <span class="explorer-toolbar-separator" aria-hidden="true"></span>
        <button type="button" aria-label="Views"><img src="assets/xp/icons/FolderViewClassic.png" alt=""><span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
      </div>
      <label class="explorer-address"><span>Address</span><span class="explorer-address-field"><img src="assets/xp/icons/ControlPanel.png" alt=""><input type="text" aria-label="Address" value="Control Panel" readonly></span><button type="button" aria-label="Go"><img src="assets/xp/icons/Go.png" alt=""></button></label>
    </div>
    <div class="control-panel-body">
      <aside class="explorer-sidebar control-panel-sidebar">
        <section>
          <h3><button type="button" class="explorer-section-toggle" aria-expanded="true"><img src="assets/xp/icons/ControlPanel.png" alt=""><span>Control Panel</span><b aria-hidden="true">⌃</b></button></h3>
          <div class="explorer-section-body"><button type="button" data-control-panel-action="classic"><img src="assets/xp/icons/FolderViewClassic.png" alt=""><span>Switch to Classic View</span></button></div>
        </section>
        <section>
          <h3><button type="button" class="explorer-section-toggle" aria-expanded="true"><span>See Also</span><b aria-hidden="true">⌃</b></button></h3>
          <div class="explorer-section-body">
            <button type="button" data-control-panel-action="updates"><span class="control-panel-see-icon windows-update" aria-hidden="true"></span><span>Windows Update</span></button>
            <button type="button" data-control-panel-action="help"><img src="assets/xp/icons/HelpAndSupport.png" alt=""><span>Help and Support</span></button>
          </div>
        </section>
      </aside>
      <main class="control-panel-main">
        <h1>Pick a category</h1>
        <div class="control-panel-categories"></div>
      </main>
    </div>
  `;

  const categories = [
    ["appearance", "Appearance and Themes", "AppearanceAndThemes.png", "left"],
    [
      "printers",
      "Printers and Other Hardware",
      "PrintersAndHardware.png",
      "right",
    ],
    [
      "network",
      "Network and Internet Connections",
      "NetworkAndInternet.png",
      "left",
    ],
    ["users", "User Accounts", "UserAccounts.png", "right"],
    ["programs", "Add or Remove Programs", "AddRemovePrograms.png", "left"],
    [
      "datetime",
      "Date, Time, Language, and Regional Options",
      "DateTimeRegional.png",
      "right",
    ],
    [
      "sounds",
      "Sounds, Speech, and Audio Devices",
      "SoundsSpeechAudio.png",
      "left",
    ],
    [
      "accessibility",
      "Accessibility Options",
      "AccessibilityOptions.png",
      "right",
    ],
    [
      "performance",
      "Performance and Maintenance",
      "PerformanceAndMaintenance.png",
      "left",
    ],
    ["security", "Security Center", "SecurityCenter.png", "right"],
  ];
  const categoryGrid = content.querySelector(".control-panel-categories");
  categories.forEach(([id, label, icon, column]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.controlPanelCategory = id;
    button.dataset.column = column;
    const image = document.createElement("img");
    image.src = XP_ICON_PATHS[icon];
    image.alt = "";
    const text = document.createElement("span");
    text.textContent = label;
    button.append(image, text);
    categoryGrid.appendChild(button);
  });
  return content;
};

const wireControlPanel = (win) => {
  const content = win.el.querySelector(".control-panel-content");
  const titleText = win.el.querySelector(".title-text");
  const titleIcon = win.el.querySelector(".title-icon img");
  const address = content.querySelector(".explorer-address input");
  const addressIcon = content.querySelector(".explorer-address-field img");
  const backButton = content.querySelector(
    '.explorer-toolbar button[aria-label="Back"], .explorer-toolbar button:first-child',
  );
  const upButton = content.querySelector(
    '.explorer-toolbar button[aria-label="Up"]',
  );
  backButton.dataset.controlPanelAction = "back";
  upButton.dataset.controlPanelAction = "back";
  const categoryGrid = content.querySelector(".control-panel-categories");
  const categoryMarkup = categoryGrid.innerHTML;
  const classicIconPaths = {
    "AccessibilityOptions.png": "assets/xp/icons/AccessibilityOptions.png",
    "AddHardware.png": "assets/xp/icons/AddHardware.png",
    "AddRemovePrograms.png": "assets/xp/icons/AddRemovePrograms.png",
    "AdministrativeTools.png": "assets/xp/icons/AdministrativeTools.png",
    "UpdateEnabled.png": "assets/xp/system/UpdateEnabled.png",
    "DateAndTime.png": "assets/xp/icons/DateAndTime.png",
    "Display.png": "assets/xp/icons/Display.png",
    "FolderOptions.png": "assets/xp/icons/FolderOptions.png",
    "Fonts.png": "assets/xp/icons/Fonts.png",
    "GameControllers.png": "assets/xp/icons/GameControllers.png",
    "InternetOptions.png": "assets/xp/icons/InternetOptions.png",
    "Keyboard.png": "assets/xp/icons/Keyboard.png",
    "Mouse.png": "assets/xp/icons/Mouse.png",
    "NetworkConnections.png": "assets/xp/icons/NetworkConnections.png",
    "NetworkSetupWizard.png": "assets/xp/icons/NetworkSetupWizard.png",
    "PhoneAndModemOptionsLarge.png":
      "assets/xp/icons/PhoneAndModemOptionsLarge.png",
    "PowerOptions.png": "assets/xp/icons/PowerOptions.png",
    "PrintersAndFaxesLarge.png": "assets/xp/icons/PrintersAndFaxesLarge.png",
    "RegionalAndLanguage.png": "assets/xp/icons/RegionalAndLanguage.png",
    "ScannersAndCameras.png": "assets/xp/icons/ScannersAndCameras.png",
    "ScheduledTasks.png": "assets/xp/icons/ScheduledTasks.png",
    "SecurityCenter.png": "assets/xp/icons/SecurityCenter.png",
    "SoundsAndAudioDevices.png": "assets/xp/icons/SoundsAndAudioDevices.png",
    "Speech.png": "assets/xp/icons/Speech.png",
    "System.png": "assets/xp/icons/System.png",
    "TaskbarAndStartMenu.png": "assets/xp/icons/TaskbarAndStartMenu.png",
    "UserAccounts.png": "assets/xp/icons/UserAccounts.png",
    "WindowsFirewall.png": "assets/xp/icons/WindowsFirewall.png",
    "WirelessNetworkSetupWizard.png":
      "assets/xp/icons/WirelessNetworkSetupWizard.png",
  };
  const classicItems = [
    [
      "accessibility-options",
      "Accessibility Options",
      "AccessibilityOptions.png",
    ],
    ["add-hardware", "Add Hardware", "AddHardware.png"],
    ["programs", "Add or Remove Programs", "AddRemovePrograms.png"],
    ["administrative-tools", "Administrative Tools", "AdministrativeTools.png"],
    ["updates", "Automatic Updates", "UpdateEnabled.png"],
    ["date-time", "Date and Time", "DateAndTime.png"],
    ["display", "Display", "Display.png"],
    ["folder-options", "Folder Options", "FolderOptions.png"],
    ["fonts", "Fonts", "Fonts.png"],
    ["game-controllers", "Game Controllers", "GameControllers.png"],
    ["internet-options", "Internet Options", "InternetOptions.png"],
    ["keyboard", "Keyboard", "Keyboard.png"],
    ["mouse", "Mouse", "Mouse.png"],
    ["network-connections", "Network Connections", "NetworkConnections.png"],
    ["network-setup", "Network Setup Wizard", "NetworkSetupWizard.png"],
    ["phone-modem", "Phone and Modem Options", "PhoneAndModemOptionsLarge.png"],
    ["power-options", "Power Options", "PowerOptions.png"],
    ["view-printers", "Printers and Faxes", "PrintersAndFaxesLarge.png"],
    [
      "regional-language",
      "Regional and Language Options",
      "RegionalAndLanguage.png",
    ],
    ["scanners-cameras", "Scanners and Cameras", "ScannersAndCameras.png"],
    ["scheduled-tasks", "Scheduled Tasks", "ScheduledTasks.png"],
    ["security-center", "Security Center", "SecurityCenter.png"],
    ["sounds-audio", "Sounds and Audio Devices", "SoundsAndAudioDevices.png"],
    ["speech", "Speech", "Speech.png"],
    ["system", "System", "System.png"],
    ["taskbar-properties", "Taskbar and Start Menu", "TaskbarAndStartMenu.png"],
    ["users", "User Accounts", "UserAccounts.png"],
    ["firewall", "Windows Firewall", "WindowsFirewall.png"],
    [
      "wireless-network",
      "Wireless Network Setup Wizard",
      "WirelessNetworkSetupWizard.png",
    ],
  ];
  const renderClassicItems = () => {
    categoryGrid.innerHTML = classicItems
      .map(
        ([action, label, icon]) =>
          `<button type="button" data-control-panel-action="${action}" title="${label}"><img src="${classicIconPaths[icon]}" alt=""><span>${label}</span></button>`,
      )
      .join("");
  };

  const setWindowIdentity = (title, icon) => {
    win.title = title;
    win.icon = icon;
    titleText.textContent = title;
    titleIcon.src = icon;
    address.value = title;
    addressIcon.src = icon;
    renderTaskButtons();
  };

  const openDisplayTab = (tab) => {
    openSystemWindow("__display-properties");
    openWindows
      .get("__display-properties")
      ?.el.querySelector(`#display-tab-${tab}`)
      ?.click();
  };

  const renderAppearanceCategory = () => {
    content.classList.add("control-panel-category-page");
    content.classList.remove("classic-view", "folders-visible");
    setWindowIdentity(
      "Appearance and Themes",
      XP_ICON_PATHS["AppearanceAndThemes.png"],
    );
    backButton.disabled = false;
    upButton.disabled = false;
    content.querySelector(".control-panel-sidebar").innerHTML = `
      <section>
        <h3><button type="button" class="explorer-section-toggle" aria-expanded="true"><span>See Also</span><b aria-hidden="true">⌃</b></button></h3>
        <div class="explorer-section-body">
          <button type="button" data-control-panel-action="fonts"><img src="assets/xp/icons/FolderOptions.png" alt=""><span>Fonts</span></button>
          <button type="button" data-control-panel-action="mouse"><span class="control-panel-small-glyph mouse-glyph" aria-hidden="true"></span><span>Mouse Pointers</span></button>
          <button type="button" data-control-panel-action="contrast"><span class="control-panel-small-glyph contrast-glyph" aria-hidden="true"></span><span>High Contrast</span></button>
          <button type="button" data-control-panel-action="user-picture"><img src="assets/xp/icons/UserAccounts.png" alt=""><span>User Account Picture</span></button>
        </div>
      </section>
      <section>
        <h3><button type="button" class="explorer-section-toggle" aria-expanded="true"><span>Troubleshooters</span><b aria-hidden="true">⌃</b></button></h3>
        <div class="explorer-section-body">
          <button type="button" data-control-panel-action="display-help"><span class="control-panel-help-glyph" aria-hidden="true">?</span><span>Display</span></button>
          <button type="button" data-control-panel-action="sound-help"><span class="control-panel-help-glyph" aria-hidden="true">?</span><span>Sound</span></button>
        </div>
      </section>`;
    content.querySelector(".control-panel-main").innerHTML = `
      <div class="control-panel-category-heading"><img src="assets/xp/icons/AppearanceAndThemes.png" alt=""><strong>Appearance and Themes</strong></div>
      <h1>Pick a task...</h1>
      <div class="control-panel-task-links">
        <button type="button" data-control-panel-action="theme"><img src="assets/xp/icons/Go.png" alt=""><span>Change the computer's theme</span></button>
        <button type="button" data-control-panel-action="desktop"><img src="assets/xp/icons/Go.png" alt=""><span>Change the desktop background</span></button>
        <button type="button" data-control-panel-action="screen-saver"><img src="assets/xp/icons/Go.png" alt=""><span>Choose a screen saver</span></button>
        <button type="button" data-control-panel-action="resolution"><img src="assets/xp/icons/Go.png" alt=""><span>Change the screen resolution</span></button>
      </div>
      <h2>or pick a Control Panel icon</h2>
      <div class="control-panel-category-icons">
        <button type="button" data-control-panel-action="display"><img src="assets/xp/icons/Display.png" alt=""><span>Display</span></button>
        <button type="button" data-control-panel-action="folder-options"><img src="assets/xp/icons/FolderOptions.png" alt=""><span>Folder Options</span></button>
        <button type="button" data-control-panel-action="taskbar-properties"><img src="assets/xp/icons/TaskbarAndStartMenu.png" alt=""><span>Taskbar and Start Menu</span></button>
      </div>`;
  };

  const renderPerformanceCategory = () => {
    content.classList.add("control-panel-category-page");
    content.classList.remove("classic-view", "folders-visible");
    setWindowIdentity(
      "Performance and Maintenance",
      XP_ICON_PATHS["PerformanceAndMaintenance.png"],
    );
    backButton.disabled = false;
    upButton.disabled = false;
    content.querySelector(".control-panel-sidebar").innerHTML = `
      <section>
        <h3><button type="button" class="explorer-section-toggle" aria-expanded="true"><span>See Also</span><b aria-hidden="true">⌃</b></button></h3>
        <div class="explorer-section-body">
          <button type="button" data-control-panel-action="file-types"><img src="assets/xp/icons/FolderOptions.png" alt=""><span>File Types</span></button>
          <button type="button" data-control-panel-action="system-restore"><img src="assets/xp/system/SystemRestore.png" alt=""><span>System Restore</span></button>
        </div>
      </section>
      <section>
        <h3><button type="button" class="explorer-section-toggle" aria-expanded="true"><span>Troubleshooters</span><b aria-hidden="true">⌃</b></button></h3>
        <div class="explorer-section-body">
          <button type="button" data-control-panel-action="startup-help"><span class="control-panel-help-glyph" aria-hidden="true">?</span><span>Startup and Shutdown</span></button>
        </div>
      </section>`;
    content.querySelector(".control-panel-main").innerHTML = `
      <div class="control-panel-category-heading"><img src="assets/xp/icons/PerformanceAndMaintenance.png" alt=""><strong>Performance and Maintenance</strong></div>
      <h1>Pick a task...</h1>
      <div class="control-panel-task-links performance-task-links">
        <button type="button" data-control-panel-action="system-info"><img src="assets/xp/icons/Go.png" alt=""><span>See basic information about your computer</span></button>
        <button type="button" data-control-panel-action="visual-effects"><img src="assets/xp/icons/Go.png" alt=""><span>Adjust visual effects</span></button>
        <button type="button" data-control-panel-action="disk-cleanup"><img src="assets/xp/icons/Go.png" alt=""><span>Free up space on your hard disk</span></button>
        <button type="button" data-control-panel-action="backup"><img src="assets/xp/icons/Go.png" alt=""><span>Back up your data</span></button>
        <button type="button" data-control-panel-action="defrag"><img src="assets/xp/icons/Go.png" alt=""><span>Rearrange items on your hard disk to make programs run faster</span></button>
      </div>
      <h2>or pick a Control Panel icon</h2>
      <div class="control-panel-category-icons">
        <button type="button" data-control-panel-action="administrative-tools"><img src="assets/xp/icons/AdministrativeTools.png" alt=""><span>Administrative Tools</span></button>
        <button type="button" data-control-panel-action="power-options"><img src="assets/xp/icons/PowerOptions.png" alt=""><span>Power Options</span></button>
        <button type="button" data-control-panel-action="scheduled-tasks"><img src="assets/xp/icons/ScheduledTasks.png" alt=""><span>Scheduled Tasks</span></button>
        <button type="button" data-control-panel-action="system"><img src="assets/xp/icons/System.png" alt=""><span>System</span></button>
      </div>`;
  };

  const renderAccessibilityCategory = () => {
    content.classList.add("control-panel-category-page");
    content.classList.remove("classic-view", "folders-visible");
    setWindowIdentity(
      "Accessibility Options",
      XP_ICON_PATHS["AccessibilityOptions.png"],
    );
    backButton.disabled = false;
    upButton.disabled = false;
    content.querySelector(".control-panel-sidebar").innerHTML = `
      <section>
        <h3><button type="button" class="explorer-section-toggle" aria-expanded="true"><span>See Also</span><b aria-hidden="true">⌃</b></button></h3>
        <div class="explorer-section-body">
          <button type="button" data-control-panel-action="magnifier"><img src="assets/xp/icons/Magnifier.png" alt=""><span>Magnifier</span></button>
          <button type="button" data-control-panel-action="on-screen-keyboard"><img src="assets/xp/icons/OnScreenKeyboard.png" alt=""><span>On-Screen Keyboard</span></button>
        </div>
      </section>`;
    content.querySelector(".control-panel-main").innerHTML = `
      <div class="control-panel-category-heading"><img src="assets/xp/icons/AccessibilityOptions.png" alt=""><strong>Accessibility Options</strong></div>
      <h1>Pick a task...</h1>
      <div class="control-panel-task-links">
        <button type="button" data-control-panel-action="accessibility-contrast"><img src="assets/xp/icons/Go.png" alt=""><span>Adjust the contrast for text and colors on your screen</span></button>
        <button type="button" data-control-panel-action="accessibility-wizard"><img src="assets/xp/icons/Go.png" alt=""><span>Configure Windows to work for your vision, hearing, and mobility needs</span></button>
      </div>
      <h2>or pick a Control Panel icon</h2>
      <div class="control-panel-category-icons accessibility-category-icons">
        <button type="button" data-control-panel-action="accessibility-options"><img src="assets/xp/icons/AccessibilityOptions.png" alt=""><span>Accessibility Options</span></button>
      </div>`;
  };

  const renderSoundsCategory = () => {
    content.classList.add("control-panel-category-page");
    content.classList.remove("classic-view", "folders-visible");
    setWindowIdentity(
      "Sounds, Speech, and Audio Devices",
      XP_ICON_PATHS["SoundsSpeechAudio.png"],
    );
    backButton.disabled = false;
    upButton.disabled = false;
    content.querySelector(".control-panel-sidebar").innerHTML = `
      <section>
        <h3><button type="button" class="explorer-section-toggle" aria-expanded="true"><span>See Also</span><b aria-hidden="true">⌃</b></button></h3>
        <div class="explorer-section-body">
          <button type="button" data-control-panel-action="accessibility-sound"><img src="assets/xp/icons/AccessibilitySound.png" alt=""><span>Accessibility Sound Options</span></button>
          <button type="button" data-control-panel-action="advanced-volume"><img src="assets/xp/icons/AdvancedVolumeControls.png" alt=""><span>Advanced Volume Controls</span></button>
        </div>
      </section>
      <section>
        <h3><button type="button" class="explorer-section-toggle" aria-expanded="true"><span>Troubleshooters</span><b aria-hidden="true">⌃</b></button></h3>
        <div class="explorer-section-body">
          <button type="button" data-control-panel-action="sound-help"><span class="control-panel-help-glyph" aria-hidden="true">?</span><span>Sound</span></button>
          <button type="button" data-control-panel-action="dvd-help"><span class="control-panel-help-glyph" aria-hidden="true">?</span><span>DVD</span></button>
        </div>
      </section>`;
    content.querySelector(".control-panel-main").innerHTML = `
      <div class="control-panel-category-heading"><img src="assets/xp/icons/SoundsSpeechAudio.png" alt=""><strong>Sounds, Speech, and Audio Devices</strong></div>
      <h1>Pick a task...</h1>
      <div class="control-panel-task-links">
        <button type="button" data-control-panel-action="system-volume"><img src="assets/xp/icons/Go.png" alt=""><span>Adjust the system volume</span></button>
        <button type="button" data-control-panel-action="sound-scheme"><img src="assets/xp/icons/Go.png" alt=""><span>Change the sound scheme</span></button>
        <button type="button" data-control-panel-action="speaker-settings"><img src="assets/xp/icons/Go.png" alt=""><span>Change the speaker settings</span></button>
      </div>
      <h2>or pick a Control Panel icon</h2>
      <div class="control-panel-category-icons sounds-category-icons">
        <button type="button" data-control-panel-action="sounds-audio"><img src="assets/xp/icons/SoundsAndAudioDevices.png" alt=""><span>Sounds and Audio Devices</span></button>
        <button type="button" data-control-panel-action="speech"><img src="assets/xp/icons/Speech.png" alt=""><span>Speech</span></button>
      </div>`;
  };

  const renderDateRegionalCategory = () => {
    content.classList.add("control-panel-category-page");
    content.classList.remove("classic-view", "folders-visible");
    setWindowIdentity(
      "Date, Time, Language, and Regional Options",
      XP_ICON_PATHS["DateTimeRegional.png"],
    );
    backButton.disabled = false;
    upButton.disabled = false;
    content.querySelector(".control-panel-sidebar").innerHTML = `
      <section>
        <h3><button type="button" class="explorer-section-toggle" aria-expanded="true"><span>See Also</span><b aria-hidden="true">⌃</b></button></h3>
        <div class="explorer-section-body">
          <button type="button" data-control-panel-action="scheduled-tasks"><img src="assets/xp/icons/ScheduledTasks.png" alt=""><span>Scheduled Tasks</span></button>
        </div>
      </section>`;
    content.querySelector(".control-panel-main").innerHTML = `
      <div class="control-panel-category-heading"><img src="assets/xp/icons/DateTimeRegional.png" alt=""><strong>Date, Time, Language, and Regional Options</strong></div>
      <h1>Pick a task...</h1>
      <div class="control-panel-task-links">
        <button type="button" data-control-panel-action="date-time"><img src="assets/xp/icons/Go.png" alt=""><span>Change the date and time</span></button>
        <button type="button" data-control-panel-action="regional-format"><img src="assets/xp/icons/Go.png" alt=""><span>Change the format of numbers, dates, and times</span></button>
        <button type="button" data-control-panel-action="languages"><img src="assets/xp/icons/Go.png" alt=""><span>Add other languages</span></button>
      </div>
      <h2>or pick a Control Panel icon</h2>
      <div class="control-panel-category-icons date-regional-category-icons">
        <button type="button" data-control-panel-action="date-time"><img src="assets/xp/icons/DateAndTime.png" alt=""><span>Date and Time</span></button>
        <button type="button" data-control-panel-action="regional-language"><img src="assets/xp/icons/RegionalAndLanguage.png" alt=""><span>Regional and Language Options</span></button>
      </div>`;
  };

  const renderNetworkCategory = () => {
    content.classList.add("control-panel-category-page");
    content.classList.remove("classic-view", "folders-visible");
    setWindowIdentity(
      "Network and Internet Connections",
      XP_ICON_PATHS["NetworkAndInternet.png"],
    );
    backButton.disabled = false;
    upButton.disabled = false;
    content.querySelector(".control-panel-sidebar").innerHTML = `
      <section>
        <h3><button type="button" class="explorer-section-toggle" aria-expanded="true"><span>See Also</span><b aria-hidden="true">⌃</b></button></h3>
        <div class="explorer-section-body">
          <button type="button" data-control-panel-action="my-network-places"><img src="assets/xp/icons/MyNetworkPlacesSmall.png" alt=""><span>My Network Places</span></button>
          <button type="button" data-control-panel-action="printers"><img src="assets/xp/icons/PrintersAndFaxesSmall.png" alt=""><span>Printers and Other Hardware</span></button>
          <button type="button" data-control-panel-action="remote-desktop"><img src="assets/xp/icons/RemoteDesktop.png" alt=""><span>Remote Desktop</span></button>
          <button type="button" data-control-panel-action="phone-modem"><img src="assets/xp/icons/PhoneAndModemOptions.png" alt=""><span>Phone and Modem Options</span></button>
        </div>
      </section>
      <section>
        <h3><button type="button" class="explorer-section-toggle" aria-expanded="true"><span>Troubleshooters</span><b aria-hidden="true">⌃</b></button></h3>
        <div class="explorer-section-body">
          <button type="button" data-control-panel-action="network-help"><span class="control-panel-help-glyph" aria-hidden="true">?</span><span>Home or Small Office Networking</span></button>
          <button type="button" data-control-panel-action="internet-help"><span class="control-panel-help-glyph" aria-hidden="true">?</span><span>Internet Explorer</span></button>
          <button type="button" data-control-panel-action="network-diagnostics"><span class="control-panel-help-glyph" aria-hidden="true">?</span><span>Network Diagnostics</span></button>
        </div>
      </section>`;
    content.querySelector(".control-panel-main").innerHTML = `
      <div class="control-panel-category-heading"><img src="assets/xp/icons/NetworkAndInternet.png" alt=""><strong>Network and Internet Connections</strong></div>
      <h1>Pick a task...</h1>
      <div class="control-panel-task-links network-task-links">
        <button type="button" data-control-panel-action="internet-connection"><img src="assets/xp/icons/Go.png" alt=""><span>Set up or change your Internet connection</span></button>
        <button type="button" data-control-panel-action="workplace-connection"><img src="assets/xp/icons/Go.png" alt=""><span>Create a connection to the network at your workplace</span></button>
        <button type="button" data-control-panel-action="home-network"><img src="assets/xp/icons/Go.png" alt=""><span>Set up or change your home or small office network</span></button>
        <button type="button" data-control-panel-action="wireless-network"><img src="assets/xp/icons/Go.png" alt=""><span>Set up a wireless network for a home or small office</span></button>
        <button type="button" data-control-panel-action="firewall"><img src="assets/xp/icons/Go.png" alt=""><span>Change Windows Firewall settings</span></button>
      </div>
      <h2>or pick a Control Panel icon</h2>
      <div class="control-panel-category-icons network-category-icons">
        <button type="button" data-control-panel-action="internet-options"><img src="assets/xp/icons/InternetOptions.png" alt=""><span>Internet Options</span></button>
        <button type="button" data-control-panel-action="network-connections"><img src="assets/xp/icons/NetworkConnections.png" alt=""><span>Network Connections</span></button>
        <button type="button" data-control-panel-action="network-setup"><img src="assets/xp/icons/NetworkSetupWizard.png" alt=""><span>Network Setup Wizard</span></button>
        <button type="button" data-control-panel-action="firewall"><img src="assets/xp/icons/WindowsFirewall.png" alt=""><span>Windows Firewall</span></button>
        <button type="button" data-control-panel-action="wireless-network"><img src="assets/xp/icons/WirelessNetworkSetupWizard.png" alt=""><span>Wireless Network Setup Wizard</span></button>
      </div>`;
  };

  const renderHardwareCategory = () => {
    content.classList.add("control-panel-category-page");
    content.classList.remove("classic-view", "folders-visible");
    setWindowIdentity(
      "Printers and Other Hardware",
      XP_ICON_PATHS["PrintersAndHardware.png"],
    );
    backButton.disabled = false;
    upButton.disabled = false;
    content.querySelector(".control-panel-sidebar").innerHTML = `
      <section>
        <h3><button type="button" class="explorer-section-toggle" aria-expanded="true"><span>See Also</span><b aria-hidden="true">⌃</b></button></h3>
        <div class="explorer-section-body">
          <button type="button" data-control-panel-action="add-hardware"><img src="assets/xp/icons/AddHardwareSmall.png" alt=""><span>Add Hardware</span></button>
          <button type="button" data-control-panel-action="display"><img src="assets/xp/icons/DisplaySmall.png" alt=""><span>Display</span></button>
          <button type="button" data-control-panel-action="sounds-audio"><img src="assets/xp/icons/SoundsAudioSmall.png" alt=""><span>Sounds, Speech, and Audio Devices</span></button>
          <button type="button" data-control-panel-action="power-options"><img src="assets/xp/icons/PowerOptionsSmall.png" alt=""><span>Power Options</span></button>
          <button type="button" data-control-panel-action="system"><img src="assets/xp/icons/SystemSmall.png" alt=""><span>System</span></button>
        </div>
      </section>
      <section>
        <h3><button type="button" class="explorer-section-toggle" aria-expanded="true"><span>Troubleshooters</span><b aria-hidden="true">⌃</b></button></h3>
        <div class="explorer-section-body">
          <button type="button" data-control-panel-action="hardware-help"><span class="control-panel-help-glyph" aria-hidden="true">?</span><span>Hardware</span></button>
          <button type="button" data-control-panel-action="printing-help"><span class="control-panel-help-glyph" aria-hidden="true">?</span><span>Printing</span></button>
          <button type="button" data-control-panel-action="network-help"><span class="control-panel-help-glyph" aria-hidden="true">?</span><span>Home or Small Office Networking</span></button>
        </div>
      </section>`;
    content.querySelector(".control-panel-main").innerHTML = `
      <div class="control-panel-category-heading"><img src="assets/xp/icons/PrintersAndHardware.png" alt=""><strong>Printers and Other Hardware</strong></div>
      <h1>Pick a task...</h1>
      <div class="control-panel-task-links">
        <button type="button" data-control-panel-action="view-printers"><img src="assets/xp/icons/Go.png" alt=""><span>View installed printers or fax printers</span></button>
        <button type="button" data-control-panel-action="add-printer"><img src="assets/xp/icons/Go.png" alt=""><span>Add a printer</span></button>
      </div>
      <h2>or pick a Control Panel icon</h2>
      <div class="control-panel-category-icons hardware-category-icons">
        <button type="button" data-control-panel-action="game-controllers"><img src="assets/xp/icons/GameControllers.png" alt=""><span>Game Controllers</span></button>
        <button type="button" data-control-panel-action="keyboard"><img src="assets/xp/icons/Keyboard.png" alt=""><span>Keyboard</span></button>
        <button type="button" data-control-panel-action="mouse"><img src="assets/xp/icons/Mouse.png" alt=""><span>Mouse</span></button>
        <button type="button" data-control-panel-action="phone-modem"><img src="assets/xp/icons/PhoneAndModemOptionsLarge.png" alt=""><span>Phone and Modem Options</span></button>
        <button type="button" data-control-panel-action="view-printers"><img src="assets/xp/icons/PrintersAndFaxesLarge.png" alt=""><span>Printers and Faxes</span></button>
        <button type="button" data-control-panel-action="scanners-cameras"><img src="assets/xp/icons/ScannersAndCameras.png" alt=""><span>Scanners and Cameras</span></button>
      </div>`;
  };

  const actions = {
    appearance: renderAppearanceCategory,
    printers: renderHardwareCategory,
    network: renderNetworkCategory,
    users: () => openSystemWindow("__user-accounts"),
    programs: () => openSystemWindow("__add-remove-programs"),
    datetime: renderDateRegionalCategory,
    sounds: renderSoundsCategory,
    accessibility: renderAccessibilityCategory,
    performance: renderPerformanceCategory,
    security: () => openSystemWindow("__security-center"),
  };
  content.addEventListener("click", (event) => {
    const sectionToggle = event.target.closest(".explorer-section-toggle");
    if (sectionToggle) {
      const collapsed = sectionToggle
        .closest("section")
        .classList.toggle("collapsed");
      sectionToggle.setAttribute("aria-expanded", String(!collapsed));
      sectionToggle.querySelector("b").textContent = collapsed ? "⌄" : "⌃";
      return;
    }
    const category = event.target.closest("[data-control-panel-category]");
    if (category) {
      actions[category.dataset.controlPanelCategory]?.();
      return;
    }
    const action = event.target.closest("[data-control-panel-action]")?.dataset
      .controlPanelAction;
    if (action === "classic") {
      const classic = content.classList.toggle("classic-view");
      content.querySelector(".control-panel-main h1").textContent =
        "Pick a category";
      if (classic) renderClassicItems();
      else categoryGrid.innerHTML = categoryMarkup;
      event.target.closest("button").querySelector("span").textContent = classic
        ? "Switch to Category View"
        : "Switch to Classic View";
    } else if (action === "search") {
      openSearchDialog();
    } else if (action === "folders") {
      const pressed = content.classList.toggle("folders-visible");
      event.target
        .closest("button")
        .setAttribute("aria-pressed", String(pressed));
    } else if (action === "help") {
      openHelpAndSupport();
    } else if (action === "updates") {
      XPDialogs.alert(
        "Astro Flash Collection does not connect to Windows Update.",
        "Windows Update",
        "info",
      );
    } else if (action === "security-center") {
      openSystemWindow("__security-center");
    } else if (action === "programs") {
      openSystemWindow("__add-remove-programs");
    } else if (action === "users") {
      openSystemWindow("__user-accounts");
    } else if (action === "back") {
      closeGameWindow("__control-panel");
      setTimeout(openControlPanel, 0);
    } else if (action === "theme" || action === "display") {
      openDisplayTab("themes");
    } else if (action === "desktop") {
      openDisplayTab("desktop");
    } else if (action === "screen-saver") {
      openDisplayTab("saver");
    } else if (action === "resolution") {
      openDisplayTab("settings");
    } else if (action === "taskbar-properties") {
      openTaskbarProperties();
    } else if (action === "folder-options") {
      openFolderOptions();
    } else if (action === "file-types") {
      openFolderOptions();
      document
        .querySelector(".folder-options-dialog [data-folder-tab='file-types']")
        ?.click();
    } else if (action === "system-info" || action === "system") {
      openSystemProperties();
    } else if (action === "visual-effects") {
      openSystemProperties();
      document
        .querySelector(".system-properties-dialog [data-system-tab='advanced']")
        ?.click();
    } else if (action === "system-restore") {
      openSystemProperties();
      document
        .querySelector(".system-properties-dialog [data-system-tab='restore']")
        ?.click();
    } else if (action === "startup-help") {
      openHelpAndSupport();
    } else if (
      action === "accessibility-contrast" ||
      action === "accessibility-options"
    ) {
      openAccessibilityOptions(
        action === "accessibility-contrast" ? "display" : "keyboard",
      );
    } else if (action === "accessibility-wizard") {
      openHelpAndSupport();
    } else if (action === "magnifier" || action === "on-screen-keyboard") {
      XPDialogs.alert(
        `${action === "magnifier" ? "Magnifier" : "On-Screen Keyboard"} is not available in Astro Flash Collection.`,
        action === "magnifier" ? "Magnifier" : "On-Screen Keyboard",
        "info",
      );
    } else if (action === "accessibility-sound") {
      openAccessibilityOptions("sound");
    } else if (action === "system-volume") {
      openSoundsAudioProperties("volume");
    } else if (action === "advanced-volume") {
      toggleTrayVolumePopup();
    } else if (action === "sound-help" || action === "dvd-help") {
      openHelpAndSupport();
    } else if (action === "sound-scheme") {
      openSoundsAudioProperties("sounds");
    } else if (action === "speaker-settings" || action === "sounds-audio") {
      openSoundsAudioProperties("volume");
    } else if (action === "speech") {
      XPDialogs.alert(
        "Speech Properties is not available in Astro Flash Collection.",
        "Speech Properties",
        "info",
      );
    } else if (action === "date-time") {
      openDateTimeProperties();
    } else if (
      action === "network-connections" ||
      action === "my-network-places"
    ) {
      openNetworkStatus();
    } else if (action === "printers") {
      openPrintersAndFaxes();
    } else if (action === "view-printers" || action === "add-printer") {
      openPrintersAndFaxes();
    } else if (
      action === "network-help" ||
      action === "internet-help" ||
      action === "network-diagnostics" ||
      action === "remote-desktop" ||
      action === "hardware-help" ||
      action === "printing-help"
    ) {
      openHelpAndSupport();
    } else if (
      [
        "internet-connection",
        "workplace-connection",
        "home-network",
        "network-setup",
      ].includes(action)
    ) {
      XPDialogs.alert(
        "The Network Setup Wizard is not available in Astro Flash Collection.",
        "Network Setup Wizard",
        "info",
      );
    } else if (action === "wireless-network") {
      XPDialogs.alert(
        "The Wireless Network Setup Wizard is not available in Astro Flash Collection.",
        "Wireless Network Setup Wizard",
        "info",
      );
    } else if (action === "firewall") {
      XPDialogs.alert(
        "Windows Firewall settings are not available in Astro Flash Collection.",
        "Windows Firewall",
        "info",
      );
    } else if (action === "internet-options") {
      openInternetProperties();
    } else if (action === "mouse") {
      openMouseProperties();
    } else if (action === "keyboard") {
      openKeyboardProperties();
    } else if (action === "game-controllers") {
      openGameControllers();
    } else if (action === "power-options") {
      openPowerOptions();
    } else if (
      action === "phone-modem" ||
      action === "add-hardware" ||
      action === "scanners-cameras"
    ) {
      const hardwareLabels = {
        "add-hardware": "Add Hardware Wizard",
        "game-controllers": "Game Controllers",
        keyboard: "Keyboard Properties",
        mouse: "Mouse Properties",
        "scanners-cameras": "Scanners and Cameras",
      };
      const label =
        action === "phone-modem"
          ? "Phone and Modem Options"
          : hardwareLabels[action];
      XPDialogs.alert(
        `${label} is not available in Astro Flash Collection.`,
        label,
        "info",
      );
    } else if (action === "languages") {
      openRegionalLanguageOptions("languages");
    } else if (action === "regional-format" || action === "regional-language") {
      openRegionalLanguageOptions();
    } else if (
      [
        "disk-cleanup",
        "backup",
        "defrag",
        "administrative-tools",
        "scheduled-tasks",
      ].includes(action)
    ) {
      const labels = {
        "disk-cleanup": "Disk Cleanup",
        backup: "Backup Utility",
        defrag: "Disk Defragmenter",
        "administrative-tools": "Administrative Tools",
        "scheduled-tasks": "Scheduled Tasks",
      };
      XPDialogs.alert(
        `${labels[action]} is not available in Astro Flash Collection.`,
        labels[action],
        "info",
      );
    } else if (
      [
        "fonts",
        "mouse",
        "contrast",
        "user-picture",
        "display-help",
        "sound-help",
      ].includes(action)
    ) {
      openHelpAndSupport();
    }
  });
};

const createUserAccountsContent = () => {
  const content = document.createElement("div");
  content.className = "user-accounts-content";
  content.innerHTML = `
    <div class="user-accounts-toolbar">
      <button type="button" data-user-accounts-action="back" disabled><img src="assets/xp/icons/Back.png" alt=""> Back</button>
      <button type="button" disabled aria-label="Forward"><img src="assets/xp/icons/Forward.png" alt=""></button>
      <button type="button" data-user-accounts-action="home"><img src="assets/xp/icons/UserAccounts.png" alt=""> Home</button>
    </div>
    <div class="user-accounts-body">
      <aside class="user-accounts-sidebar">
        <section><h2>Learn About</h2>
          <button type="button" data-user-accounts-action="help"><span>?</span> User accounts</button>
          <button type="button" data-user-accounts-action="help"><span>?</span> User account types</button>
          <button type="button" data-user-accounts-action="help"><span>?</span> Switching users</button>
        </section>
      </aside>
      <main class="user-accounts-main"></main>
    </div>`;
  const main = content.querySelector(".user-accounts-main");
  const sidebar = content.querySelector(".user-accounts-sidebar");
  const back = content.querySelector('[data-user-accounts-action="back"]');
  const home = content.querySelector('[data-user-accounts-action="home"]');
  const renderHeader = () => `
    <div class="user-accounts-heading"><img src="assets/xp/icons/UserAccounts.png" alt=""><strong>User Accounts</strong></div>`;
  const learnLink = (label) =>
    `<button type="button" data-user-accounts-action="help"><span>?</span> ${label}</button>`;
  const renderSidebar = (markup) => {
    sidebar.innerHTML = markup;
  };
  const showSubpage = (sidebarMarkup, pageMarkup) => {
    back.disabled = false;
    home.disabled = false;
    main.className = "user-accounts-main user-accounts-subpage";
    renderSidebar(sidebarMarkup);
    main.innerHTML = pageMarkup;
  };
  const renderHome = () => {
    back.disabled = true;
    home.disabled = true;
    main.className = "user-accounts-main";
    renderSidebar(`<section><h2>Learn About</h2>
      ${learnLink("User accounts")}
      ${learnLink("User account types")}
      ${learnLink("Switching users")}
    </section>`);
    main.innerHTML = `${renderHeader()}
      <div class="user-accounts-page">
        <h1>Pick a task...</h1>
        <div class="user-account-task-links">
          <button type="button" data-user-accounts-action="change"><img src="assets/xp/icons/Go.png" alt="">Change an account</button>
          <button type="button" data-user-accounts-action="create"><img src="assets/xp/icons/Go.png" alt="">Create a new account</button>
          <button type="button" data-user-accounts-action="logon"><img src="assets/xp/icons/Go.png" alt="">Change the way users log on or off</button>
        </div>
        <h2>or pick an account to change</h2>
        <div class="user-account-choices">
          <button type="button" data-user-accounts-action="administrator"><img src="assets/xp/system/UserAdministrator.bmp" alt=""><span><strong>Administrator</strong><small>Computer administrator</small></span></button>
          <button type="button" data-user-accounts-action="guest"><img src="assets/xp/system/UserGuest.bmp" alt=""><span><strong>Guest</strong><small>Guest account is off</small></span></button>
        </div>
      </div>`;
  };
  const accountChoice = (guest = false, selected = false) => {
    const name = guest ? "Guest" : "Administrator";
    const detail = guest ? "Guest account is off" : "Computer administrator";
    const image = guest
      ? "assets/xp/system/UserGuest.bmp"
      : "assets/xp/system/UserAdministrator.bmp";
    return `<button type="button" class="${selected ? "selected" : ""}" data-user-accounts-action="${guest ? "guest" : "administrator"}"><img src="${image}" alt=""><span><strong>${name}</strong><small>${detail}</small></span></button>`;
  };
  const renderChange = () => {
    showSubpage(
      `<section><h2>Related Tasks</h2><button type="button" data-user-accounts-action="create">Create a new account</button></section>
       <section><h2>Learn About</h2>${learnLink("User accounts")}</section>`,
      `<div class="user-account-change"><h1>Pick an account to change</h1><div class="user-account-picker">${accountChoice(false, true)}${accountChoice(true)}</div></div>`,
    );
  };
  const renderAccount = (guest = false) => {
    if (guest) {
      showSubpage(
        `<div class="user-account-sidebar-summary"><img src="assets/xp/system/UserGuest.bmp" alt=""><span><strong>Guest</strong><small>Guest account is off</small></span></div><section><h2>Learn About</h2>${learnLink("Using the guest account")}</section>`,
        `<div class="user-account-guest"><h1>Do you want to turn on the guest account?</h1><p>If you turn on the guest account, people who do not have an account can use the guest account to log on to the computer. Password-protected files, folders, or settings are not accessible to guest users.</p><div class="user-account-divider"></div><div class="user-account-page-buttons"><button type="button" class="xp-btn default">Turn On the Guest Account</button><button type="button" class="xp-btn" data-user-accounts-action="home">Cancel</button></div></div>`,
      );
      return;
    }
    showSubpage(
      `<section><h2>Related Tasks</h2><button type="button" data-user-accounts-action="help">Manage my network passwords</button><button type="button" data-user-accounts-action="help">Prevent a forgotten password</button><button type="button" data-user-accounts-action="change">Change another account</button><button type="button" data-user-accounts-action="create">Create a new account</button></section><section><h2>Learn About</h2>${learnLink("Deleting your own account")}${learnLink("Switching users")}${learnLink("Using a .NET Passport")}</section>`,
      `<div class="user-account-administrator"><h1>What do you want to change about your<br>account?</h1><div class="user-account-summary"><img src="assets/xp/system/UserAdministrator.bmp" alt=""><span><strong>Administrator</strong><small>Computer administrator</small></span></div><div class="user-account-detail-links"><button type="button"><img src="assets/xp/icons/Go.png" alt="">Create a password</button><button type="button"><img src="assets/xp/icons/Go.png" alt="">Change my picture</button><button type="button"><img src="assets/xp/icons/Go.png" alt="">Set up my account to use a .NET Passport</button></div><p>The administrator account is only visible on the Welcome screen when no other user accounts exist (except the guest account), or when you start your computer in Safe Mode.</p></div>`,
    );
  };
  const renderCreate = () => {
    showSubpage(
      "",
      `<div class="user-account-create"><h1>Name the new account</h1><label for="new-account-name">Type a name for the new account:</label><input id="new-account-name" type="text" aria-label="New account name"><p>This name will appear on the <button type="button" data-user-accounts-action="help">Welcome screen</button> and on the <button type="button" data-user-accounts-action="help">Start menu</button>.</p><div class="user-account-divider"></div><div class="user-account-page-buttons"><button type="button" class="xp-btn default">Next &gt;</button><button type="button" class="xp-btn" data-user-accounts-action="home">Cancel</button></div></div>`,
    );
    main.querySelector("input").focus();
  };
  const renderLogon = () => {
    showSubpage(
      `<section><h2>Related Tasks</h2><button type="button" data-user-accounts-action="change">Manage accounts</button></section><section><h2>Learn About</h2>${learnLink("Logon options")}</section>`,
      `<div class="user-account-logon"><h1>Select logon and logoff options</h1><label><input type="checkbox" checked><span><strong>Use the Welcome screen</strong><small>By using the Welcome screen, you can simply click your account name to log on. For added security, you can turn off this feature and use the classic logon prompt which requires users to type an account name.</small></span></label><label><input type="checkbox" checked><span><strong>Use Fast User Switching</strong><small>With Fast User Switching, you can quickly switch to another user account without having to close any programs. Then, when the other user is finished, you can switch back to your own account.</small></span></label><div class="user-account-divider"></div><div class="user-account-page-buttons"><button type="button" class="xp-btn default" data-user-accounts-action="home">Apply Options</button><button type="button" class="xp-btn" data-user-accounts-action="home">Cancel</button></div></div>`,
    );
  };
  content.addEventListener("click", (event) => {
    const action = event.target.closest("[data-user-accounts-action]")?.dataset
      .userAccountsAction;
    if (action === "home" || action === "back") renderHome();
    else if (action === "change") renderChange();
    else if (action === "administrator") renderAccount(false);
    else if (action === "guest") renderAccount(true);
    else if (action === "create") renderCreate();
    else if (action === "logon") renderLogon();
    else if (action === "help") openHelpAndSupport();
  });
  renderHome();
  return content;
};

const createAddRemoveProgramsContent = () => {
  const content = document.createElement("div");
  content.className = "add-remove-programs-content";
  content.innerHTML = `
    <nav class="add-remove-programs-nav" aria-label="Add or Remove Programs tasks">
      <button type="button" data-add-remove-page="change" class="selected"><img src="assets/xp/system/ChangeRemovePrograms.png" alt=""><span>Change or<br>Remove<br>Programs</span></button>
      <button type="button" data-add-remove-page="add"><img src="assets/xp/system/AddNewPrograms.png" alt=""><span>Add New<br>Programs</span></button>
      <button type="button" data-add-remove-page="components"><img src="assets/xp/system/AddRemoveWindowsComponents.png" alt=""><span>Add/Remove<br>Windows<br>Components</span></button>
      <button type="button" data-add-remove-page="defaults"><img src="assets/xp/system/ProgramAccessDefaults.png" alt=""><span>Set Program<br>Access and<br>Defaults</span></button>
    </nav>
    <main class="add-remove-programs-main"></main>`;
  const main = content.querySelector(".add-remove-programs-main");
  const selectPage = (page) =>
    content
      .querySelectorAll("[data-add-remove-page]")
      .forEach((button) =>
        button.classList.toggle(
          "selected",
          button.dataset.addRemovePage === page,
        ),
      );
  const renderChange = () => {
    selectPage("change");
    main.innerHTML = `<div class="add-remove-programs-toolbar"><span>Currently installed programs:</span><label><input type="checkbox"> Show updates</label><label>Sort by: <select><option>Name</option><option>Size</option><option>Frequency of Use</option><option>Date Last Used</option></select></label></div><div class="add-remove-programs-list" aria-label="Currently installed programs"></div>`;
  };
  const renderAdd = () => {
    selectPage("add");
    main.innerHTML = `<section class="add-new-program-section"><h2>Add a program from CD-ROM or floppy disk</h2><img src="assets/xp/system/ChangeRemovePrograms.png" alt=""><p>To add a program from a CD-ROM or floppy disk, click CD or Floppy.</p><button type="button" class="xp-btn" data-add-remove-action="cd">CD or Floppy</button></section><section class="add-new-program-section"><h2>Add programs from Microsoft</h2><img src="assets/xp/system/ProgramAccessDefaults.png" alt=""><p>To add new Windows features, device drivers, and system updates over the Internet, click<br>Windows Update.</p><button type="button" class="xp-btn" data-add-remove-action="update">Windows Update</button></section>`;
  };
  const renderDefaults = () => {
    selectPage("defaults");
    main.innerHTML = `<div class="program-defaults-intro"><p>A program configuration specifies default programs for certain activities, such as Web browsing or sending e-mail, and which<br>programs are accessible from the Start menu, desktop, and other locations.</p><p>Choose a configuration:</p></div><div class="program-defaults-list"><label><input type="radio" name="program-default" value="microsoft"> Microsoft Windows <button type="button" aria-label="Expand Microsoft Windows">⌄</button></label><label><input type="radio" name="program-default" value="other"> Non-Microsoft <button type="button" aria-label="Expand Non-Microsoft">⌄</button></label><label class="selected"><input type="radio" name="program-default" value="custom" checked> Custom <button type="button" aria-label="Expand Custom">⌄</button></label></div><div class="program-defaults-buttons"><button type="button" class="xp-btn" data-add-remove-action="ok">OK</button><button type="button" class="xp-btn" data-add-remove-action="cancel">Cancel</button><button type="button" class="xp-btn" data-add-remove-action="help">Help</button></div>`;
  };
  content.addEventListener("click", (event) => {
    const page = event.target.closest("[data-add-remove-page]")?.dataset
      .addRemovePage;
    if (page === "change") renderChange();
    else if (page === "add") renderAdd();
    else if (page === "components") {
      selectPage("components");
      const setup = XPDialogs.createDialog({ title: "Windows XP Setup" });
      setup.el.classList.add("windows-setup-wait-dialog");
      setup.body.innerHTML = "<p>Please wait...</p>";
      setTimeout(() => setup.close("ready"), 1800);
    } else if (page === "defaults") renderDefaults();
    const action = event.target.closest("[data-add-remove-action]")?.dataset
      .addRemoveAction;
    if (action === "cd")
      XPDialogs.alert(
        "Please insert the program installation disc.",
        "Install Program From Floppy Disk or CD-ROM",
        "info",
      );
    else if (action === "update")
      XPDialogs.alert(
        "Windows Update is not available in Astro Flash Collection.",
        "Windows Update",
        "info",
      );
    else if (action === "cancel") renderChange();
    else if (action === "help") openHelpAndSupport();
  });
  renderChange();
  return content;
};

const createSecurityCenterContent = () => {
  const content = document.createElement("div");
  content.className = "security-center-content";
  content.innerHTML = `
    <header class="security-center-header">
      <img src="assets/xp/system/SecurityCenterHeader.png" alt="">
      <span><strong>Security Center</strong><small>Help protect your PC</small></span>
    </header>
    <div class="security-center-body">
      <aside class="security-center-resources">
        <section>
          <h2><img src="assets/xp/system/SecurityHelp.png" alt=""> Resources <img class="security-section-toggle" src="assets/xp/system/SecurityCollapse.png" alt=""></h2>
          <button type="button">Get the latest security and virus<br>information from Microsoft</button>
          <button type="button">Check for the latest updates from<br>Windows Update</button>
          <button type="button">Get support for security-related<br>issues</button>
          <button type="button">Get help about Security Center</button>
          <button type="button">Change the way Security Center<br>alerts me</button>
        </section>
      </aside>
      <main class="security-center-main">
        <h1>Security essentials</h1>
        <p>Security Center helps you manage your Windows security settings. To help protect your computer,<br>make sure the three security essentials are marked ON. If the settings are not ON, follow the<br>recommendations. To return to the Security Center later, open Control Panel.<br><a href="#">What's new in Windows to help protect my computer?</a></p>
        <section class="security-status security-firewall">
          <h2><img src="assets/xp/system/SecurityFirewall.png" alt=""> <span>Firewall</span><strong><img src="assets/xp/system/SecurityStatusGreen.png" alt=""> ON</strong><button type="button" aria-label="Expand Firewall"><img src="assets/xp/system/SecurityExpand.png" alt=""></button></h2>
        </section>
        <section class="security-status security-updates">
          <h2><img src="assets/xp/system/SecurityAutomaticUpdates.png" alt=""> <span>Automatic Updates</span><strong><img data-security-update-indicator src="assets/xp/system/SecurityStatusYellow.png" alt=""> <b data-security-update-status>CHECK SETTINGS</b></strong><button type="button" aria-label="Collapse Automatic Updates"><img src="assets/xp/system/SecurityCollapse.png" alt=""></button></h2>
          <div><p>Automatic Updates is not yet configured for this computer. Click Turn on Automatic Updates to<br>have Windows automatically keep your computer current with important updates<br>(recommended). <a href="#">How does Automatic Updates help protect my computer?</a></p><button type="button" class="xp-btn" data-security-action="updates">Turn on Automatic Updates</button></div>
        </section>
        <section class="security-status security-virus">
          <h2><img src="assets/xp/system/SecurityVirusProtection.png" alt=""> <span>Virus Protection</span><strong><img src="assets/xp/system/SecurityStatusRed.png" alt=""> NOT FOUND</strong><button type="button" aria-label="Collapse Virus Protection"><img src="assets/xp/system/SecurityCollapse.png" alt=""></button></h2>
          <div><p>Windows did not find antivirus software on this computer. Antivirus software helps protect your<br>computer against viruses and other security threats. Click Recommendations for<br>suggested actions you can take. <a href="#">How does antivirus software help protect my computer?</a></p><p>Note: Windows does not detect all antivirus programs.</p><button type="button" class="xp-btn">Recommendations...</button></div>
        </section>
        <h2 class="security-manage-heading">Manage security settings for:</h2>
        <div class="security-manage-links">
          <button type="button"><img src="assets/xp/icons/InternetOptions.png" alt="">Internet Options</button>
          <button type="button"><img src="assets/xp/icons/WindowsFirewall.png" alt="">Windows Firewall</button>
          <button type="button"><img src="assets/xp/system/SecurityAutomaticUpdates.png" alt="">Automatic Updates</button>
        </div>
      </main>
    </div>
    <footer>At Microsoft, we care about your privacy. Please read our <a href="#">privacy statement.</a></footer>`;
  content.addEventListener("click", (event) => {
    if (event.target.closest('[data-security-action="updates"]')) {
      content.querySelector("[data-security-update-status]").textContent = "ON";
      content.querySelector("[data-security-update-indicator]").src =
        "assets/xp/system/SecurityStatusGreen.png";
      content.querySelector(".security-updates").classList.add("enabled");
      event.target.closest("button").disabled = true;
    }
  });
  return content;
};

const createSystemWindowContent = (shortcutId, win) => {
  const content = document.createElement("div");
  content.className = "explorer-content";

  if (shortcutId === "__control-panel") return createControlPanelContent();
  if (shortcutId === "__user-accounts") return createUserAccountsContent();
  if (shortcutId === "__add-remove-programs")
    return createAddRemoveProgramsContent();
  if (shortcutId === "__security-center") return createSecurityCenterContent();

  if (shortcutId === "__printers") {
    content.className = "explorer-content printers-content";
    content.innerHTML = `
      <div class="explorer-chrome printers-chrome">
        <div class="explorer-menu-row">
          <div class="explorer-menu-bar" role="menubar"><button data-printers-menu="file">File</button><button data-printers-menu="edit">Edit</button><button data-printers-menu="view">View</button><button data-printers-menu="favorites">Favorites</button><button data-printers-menu="tools">Tools</button><button data-printers-menu="help">Help</button></div>
          <div class="explorer-brand" aria-hidden="true"><img src="assets/xp/WindowsFlag.png" alt=""></div>
        </div>
        <div class="explorer-toolbar">
          <button disabled><img src="assets/xp/icons/Back.png" alt=""> Back <span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
          <button disabled aria-label="Forward"><img src="assets/xp/icons/Forward.png" alt=""><span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
          <button data-printers-action="control-panel" aria-label="Up"><img src="assets/xp/icons/Up.png" alt=""></button>
          <span class="explorer-toolbar-separator" aria-hidden="true"></span>
          <button data-printers-action="search"><img src="assets/xp/icons/Search.png" alt=""> Search</button>
          <button data-printers-action="folders"><img src="assets/xp/icons/NewFolder.png" alt=""> Folders</button>
          <span class="explorer-toolbar-separator" aria-hidden="true"></span>
          <button aria-label="Views"><img src="assets/xp/icons/FolderViewClassic.png" alt=""><span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
        </div>
        <label class="explorer-address"><span>Address</span><span class="explorer-address-field"><img src="assets/xp/icons/PrintersAndFaxes.png" alt=""><input type="text" aria-label="Address" value="Printers and Faxes" readonly></span><button type="button" aria-label="Go"><img src="assets/xp/icons/Go.png" alt=""></button></label>
        <div class="game-menu explorer-menu printers-menu" role="menu" hidden></div>
      </div>
      <div class="printers-body">
        <aside class="explorer-sidebar printers-sidebar">
          <section><h3><button type="button" class="explorer-section-toggle">Printer Tasks<span aria-hidden="true">⌃</span></button></h3><div class="explorer-section-body"><button data-printers-action="add"><img src="assets/xp/icons/PrintersAndFaxes.png" alt=""><span>Add a printer</span></button><button data-printers-action="fax"><img src="assets/xp/icons/PrintersAndFaxes.png" alt=""><span>Set up faxing</span></button></div></section>
          <section><h3><button type="button" class="explorer-section-toggle">See Also<span aria-hidden="true">⌃</span></button></h3><div class="explorer-section-body"><button data-printers-action="troubleshoot"><span>Troubleshoot printing</span></button><button data-printers-action="help"><span>Get help with printing</span></button></div></section>
          <section><h3><button type="button" class="explorer-section-toggle">Other Places<span aria-hidden="true">⌃</span></button></h3><div class="explorer-section-body"><button data-printers-action="control-panel"><img src="assets/xp/icons/ControlPanel.png" alt=""><span>Control Panel</span></button><button data-printers-action="scanners"><img src="assets/xp/icons/MyPictures.png" alt=""><span>Scanners and Cameras</span></button><button data-printers-action="documents"><img src="assets/xp/icons/MyDocuments.png" alt=""><span>My Documents</span></button><button data-printers-action="pictures"><img src="assets/xp/icons/MyPictures.png" alt=""><span>My Pictures</span></button><button data-printers-action="computer"><img src="assets/xp/icons/MyComputer.png" alt=""><span>My Computer</span></button></div></section>
          <section class="collapsed"><h3><button type="button" class="explorer-section-toggle">Details<span aria-hidden="true">⌄</span></button></h3></section>
        </aside>
        <main class="printers-main"></main>
      </div>`;
    return content;
  }

  if (shortcutId === "__help") {
    content.className = "help-center-content";
    content.innerHTML = `
      <nav class="help-center-toolbar" aria-label="Help navigation">
        <button type="button" disabled><span class="help-toolbar-icon help-toolbar-back"></span><span>Back</span><b aria-hidden="true">⌄</b></button>
        <button type="button" disabled aria-label="Forward"><span class="help-toolbar-icon help-toolbar-forward"></span></button>
        <button type="button" data-help-action="home" aria-label="Home"><span class="help-toolbar-icon help-toolbar-home"></span></button>
        <button type="button" data-help-action="index"><span class="help-toolbar-icon help-toolbar-index"></span><span>Index</span></button>
        <button type="button" data-help-action="favorites"><span class="help-toolbar-icon help-toolbar-favorites"></span><span>Favorites</span></button>
        <button type="button" data-help-action="history"><span class="help-toolbar-icon help-toolbar-history"></span><span>History</span></button>
        <button type="button" data-help-action="support"><span class="help-toolbar-icon help-toolbar-support"></span><span>Support</span></button>
        <button type="button" data-help-action="options"><span class="help-toolbar-icon help-toolbar-options"></span><span>Options</span></button>
      </nav>
      <header class="help-center-search">
        <form><label for="help-query">Search</label><input id="help-query" type="search"><button type="submit" aria-label="Search"><img src="assets/xp/icons/Go.png" alt=""></button><button type="button" class="help-search-options" data-help-action="search-options">Set search options</button></form>
        <div class="help-center-brand"><img src="assets/xp/icons/HelpAndSupport.png" alt=""><strong>Help and Support Center</strong><small>Windows XP Professional</small></div>
      </header>
      <main class="help-center-home">
        <section class="help-topic-column">
          <h1>Pick a Help topic</h1>
          <div class="help-topic-group"><img src="assets/xp/help/TopicComputer.png" alt=""><div><button data-help-topic>What's new in Windows XP</button><button data-help-topic>Music, video, games, and photos</button><button data-help-topic>Windows basics</button><button data-help-topic>Protecting your PC: security basics</button></div></div>
          <div class="help-topic-group"><img src="assets/xp/help/TopicNetwork.png" alt=""><div><button data-help-topic>Networking and the Web</button><button data-help-topic>Working remotely</button><button data-help-topic>System administration</button></div></div>
          <div class="help-topic-group"><img src="assets/xp/help/TopicAccessibility.png" alt=""><div><button data-help-topic>Customizing your computer</button><button data-help-topic>Accessibility</button></div></div>
          <div class="help-topic-group"><img src="assets/xp/help/TopicHardware.png" alt=""><div><button data-help-topic>Printing and faxing</button><button data-help-topic>Performance and maintenance</button><button data-help-topic>Hardware</button><button data-help-topic>Fixing a problem</button><button data-help-topic>Send your feedback to Microsoft</button></div></div>
        </section>
        <section class="help-task-column">
          <h1>Ask for assistance</h1>
          <button data-help-topic><img src="assets/xp/icons/Go.png" alt="">Invite a friend to connect to your computer with <strong>Remote Assistance</strong></button>
          <button data-help-topic><img src="assets/xp/icons/Go.png" alt="">Get support, or find information in Windows XP <strong>newsgroups</strong></button>
          <h1>Pick a task</h1>
          <button data-help-topic><img src="assets/xp/icons/Go.png" alt="">Keep your computer up-to-date with <strong>Windows Update</strong></button>
          <button data-help-topic><img src="assets/xp/icons/Go.png" alt="">Find compatible hardware and software for Windows XP</button>
          <button data-help-topic><img src="assets/xp/icons/Go.png" alt="">Undo changes to your computer with <strong>System Restore</strong></button>
          <button data-help-topic><img src="assets/xp/icons/Go.png" alt="">Use <strong>Tools</strong> to view your computer information and diagnose problems</button>
          <div class="help-did-you-know"><h1>Did you know?</h1><span>Updating...</span></div>
        </section>
      </main>`;
    return content;
  }

  if (shortcutId === "__astro-settings") {
    content.className = "project-settings-content";
    return content;
  }

  if (shortcutId === "__display-properties") {
    content.className = "display-properties-content";
    content.innerHTML = `
            <div class="display-tabs" role="tablist" aria-label="Display Properties">
                <button type="button" role="tab" id="display-tab-themes" aria-controls="display-panel-themes" aria-selected="true">Themes</button>
                <button type="button" role="tab" id="display-tab-desktop" aria-controls="display-panel-desktop" aria-selected="false" tabindex="-1">Desktop</button>
                <button type="button" role="tab" id="display-tab-saver" aria-controls="display-panel-saver" aria-selected="false" tabindex="-1">Screen Saver</button>
                <button type="button" role="tab" id="display-tab-appearance" aria-controls="display-panel-appearance" aria-selected="false" tabindex="-1">Appearance</button>
                <button type="button" role="tab" id="display-tab-settings" aria-controls="display-panel-settings" aria-selected="false" tabindex="-1">Settings</button>
            </div>
            <div class="display-panel" id="display-panel-desktop" role="tabpanel" aria-labelledby="display-tab-desktop" hidden>
                <div class="display-preview" aria-label="Desktop preview">
                    <img src="assets/xp/DisplaySettings.png" alt="">
                    <div class="display-preview-surface"></div>
                </div>
                <div class="display-desktop-controls">
                    <div class="display-background-column">
                        <label class="display-wallpaper-label" for="display-wallpaper">Background:</label>
                        <select id="display-wallpaper" aria-label="Desktop background" hidden>
                            <option value="none">None</option>
                            <option value="ascent">Ascent</option>
                            <option value="autumn">Autumn</option>
                            <option value="azul">Azul</option>
                            <option value="bliss">Bliss</option>
                            <option value="blue-lace">Blue Lace 16</option>
                            <option value="coffee">Coffee Bean</option>
                            <option value="crystal">Crystal</option>
                            <option value="follow">Follow</option>
                            <option value="friend">Friend</option>
                            <option value="greenstone">Greenstone</option>
                            <option value="home">Home</option>
                            <option value="moon-flower">Moon flower</option>
                            <option value="peace">Peace</option>
                            <option value="power">Power</option>
                            <option value="prairie-wind">Prairie Wind</option>
                            <option value="purple-flower">Purple flower</option>
                            <option value="radiance">Radiance</option>
                            <option value="red-moon-desert">Red moon desert</option>
                            <option value="ripple">Ripple</option>
                            <option value="stonehenge">Stonehenge</option>
                            <option value="tulips">Tulips</option>
                            <option value="vortec-space">Vortec space</option>
                            <option value="wind">Wind</option>
                            <option value="windows-xp">Windows XP</option>
                            <option value="zapotec">Zapotec</option>
                        </select>
                        <div class="display-wallpaper-list" role="listbox" aria-label="Desktop background">
                            <div class="display-wallpaper-items">
                                <button type="button" role="option" data-wallpaper="none"><span class="wallpaper-icon none"></span>(None)</button>
                                <button type="button" role="option" data-wallpaper="ascent"><span class="wallpaper-icon"></span>Ascent</button>
                                <button type="button" role="option" data-wallpaper="autumn"><span class="wallpaper-icon"></span>Autumn</button>
                                <button type="button" role="option" data-wallpaper="azul"><span class="wallpaper-icon"></span>Azul</button>
                                <button type="button" role="option" data-wallpaper="bliss"><span class="wallpaper-icon"></span>Bliss</button>
                                <button type="button" role="option" data-wallpaper="blue-lace"><span class="wallpaper-icon"></span>Blue Lace 16</button>
                                <button type="button" role="option" data-wallpaper="coffee"><span class="wallpaper-icon"></span>Coffee Bean</button>
                                <button type="button" role="option" data-wallpaper="crystal"><span class="wallpaper-icon"></span>Crystal</button>
                                <button type="button" role="option" data-wallpaper="follow"><span class="wallpaper-icon"></span>Follow</button>
                                <button type="button" role="option" data-wallpaper="friend"><span class="wallpaper-icon"></span>Friend</button>
                                <button type="button" role="option" data-wallpaper="greenstone"><span class="wallpaper-icon"></span>Greenstone</button>
                                <button type="button" role="option" data-wallpaper="home"><span class="wallpaper-icon"></span>Home</button>
                                <button type="button" role="option" data-wallpaper="moon-flower"><span class="wallpaper-icon"></span>Moon flower</button>
                                <button type="button" role="option" data-wallpaper="peace"><span class="wallpaper-icon"></span>Peace</button>
                                <button type="button" role="option" data-wallpaper="power"><span class="wallpaper-icon"></span>Power</button>
                                <button type="button" role="option" data-wallpaper="prairie-wind"><span class="wallpaper-icon"></span>Prairie Wind</button>
                                <button type="button" role="option" data-wallpaper="purple-flower"><span class="wallpaper-icon"></span>Purple flower</button>
                                <button type="button" role="option" data-wallpaper="radiance"><span class="wallpaper-icon"></span>Radiance</button>
                                <button type="button" role="option" data-wallpaper="red-moon-desert"><span class="wallpaper-icon"></span>Red moon desert</button>
                                <button type="button" role="option" data-wallpaper="ripple"><span class="wallpaper-icon"></span>Ripple</button>
                                <button type="button" role="option" data-wallpaper="stonehenge"><span class="wallpaper-icon"></span>Stonehenge</button>
                                <button type="button" role="option" data-wallpaper="tulips"><span class="wallpaper-icon"></span>Tulips</button>
                                <button type="button" role="option" data-wallpaper="vortec-space"><span class="wallpaper-icon"></span>Vortec space</button>
                                <button type="button" role="option" data-wallpaper="wind"><span class="wallpaper-icon"></span>Wind</button>
                                <button type="button" role="option" data-wallpaper="windows-xp"><span class="wallpaper-icon"></span>Windows XP</button>
                                <button type="button" role="option" data-wallpaper="zapotec"><span class="wallpaper-icon"></span>Zapotec</button>
                            </div>
                            <div class="display-scrollbar" aria-hidden="true">
                                <span class="scroll-arrow up"></span>
                                <span class="scroll-track">
                                    <span class="scroll-thumb"><i></i><i></i><i></i></span>
                                </span>
                                <span class="scroll-arrow down"></span>
                            </div>
                        </div>
                        <button type="button" class="display-customize">Customize Desktop...</button>
                    </div>
                    <div class="display-background-actions">
                        <button type="button" class="display-browse">Browse...</button>
                        <input id="display-image" type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden>
                        <label for="display-position">Position:</label>
                        <select id="display-position"><option value="center">Center</option><option value="tile">Tile</option><option value="stretch">Stretch</option></select>
                        <label for="display-color">Color:</label>
                        <label class="display-color-button" for="display-color"><span></span><b>▼</b></label>
                        <input id="display-color" type="color" value="#3a6ea5" hidden>
                    </div>
                </div>
                <button type="button" class="display-clear-image" hidden>Remove custom picture</button>
                <p class="display-status" aria-live="polite" hidden></p>
            </div>
            <div class="display-panel active" id="display-panel-themes" role="tabpanel" aria-labelledby="display-tab-themes">
                <p class="display-theme-description">A theme is a background plus a set of sounds, icons, and other elements<br>to help you personalize your computer with one click.</p>
                <label class="display-control-label" for="display-theme">Theme:</label>
                <div class="display-theme-row">
                    <select id="display-theme"><option value="windows-xp">Windows XP</option><option value="classic">Windows Classic</option><option value="online">More themes online...</option><option value="browse">Browse...</option></select>
                    <button type="button" class="xp-property-button display-theme-save">Save As...</button>
                    <button type="button" class="xp-property-button" disabled>Delete</button>
                </div>
                <span class="display-sample-label">Sample:</span>
                <div class="display-theme-sample" aria-label="Theme sample">
                    <div class="display-sample-window">
                        <strong>Active Window</strong><i>—</i><i>□</i><i>×</i>
                        <span>Window Text</span>
                        <b class="sample-scroll-up">▲</b><b class="sample-scroll-thumb">≡</b><b class="sample-scroll-down">▼</b>
                    </div>
                    <img src="assets/xp/icons/RecyclerFull.png" alt="">
                </div>
            </div>
            <div class="display-panel" id="display-panel-saver" role="tabpanel" aria-labelledby="display-tab-saver" hidden>
                <div class="display-saver-monitor" aria-label="Screen saver preview">
                    <img src="assets/xp/DisplaySettings.png" alt="">
                    <div class="screen-saver-preview"></div>
                </div>
                <fieldset class="display-saver-group"><legend>Screen saver</legend>
                    <div class="display-saver-row">
                        <select id="display-saver" aria-label="Screen saver"><option value="none">(None)</option><option value="flowerbox">3D FlowerBox</option><option value="flying-objects">3D Flying Objects</option><option value="pipes">3D Pipes</option><option value="text">3D Text</option><option value="beziers">Beziers</option><option value="blank">Blank</option><option value="marquee">Marquee</option><option value="pictures">My Pictures Slideshow</option><option value="mystify">Mystify</option><option value="stars">Starfield</option><option value="windows-xp">Windows XP</option></select>
                        <button type="button" class="xp-property-button display-saver-settings">Settings</button>
                        <button type="button" class="xp-property-button display-saver-preview-button">Preview</button>
                    </div>
                    <div class="display-saver-wait-row">
                        <label for="display-saver-wait">Wait:</label>
                        <input id="display-saver-wait" type="number" min="1" max="60">
                        <span>minutes</span>
                        <label><input type="checkbox" class="display-saver-login"> On resume, password protect</label>
                    </div>
                </fieldset>
                <fieldset class="display-power-group"><legend>Monitor power</legend>
                    <p>To adjust monitor power settings and save energy,<br>click <u>Power</u>.</p>
                    <button type="button" class="xp-property-button display-power-button">Power...</button>
                </fieldset>
            </div>
            <div class="display-panel" id="display-panel-appearance" role="tabpanel" aria-labelledby="display-tab-appearance" hidden>
                <div class="appearance-preview" aria-label="Appearance sample">
                    <div class="appearance-window inactive"><strong>Inactive Window</strong><i>—</i><i>□</i><i>×</i></div>
                    <div class="appearance-window active"><strong>Active Window</strong><i>—</i><i>□</i><i>×</i><span>Window Text</span></div>
                    <div class="appearance-message"><strong>Message Box</strong><i>×</i><button type="button" tabindex="-1">OK</button></div>
                </div>
                <label class="display-control-label" for="display-window-style">Windows and buttons:</label>
                <select id="display-window-style" disabled><option value="xp">Windows XP style</option><option value="classic">Windows Classic style</option></select>
                <label class="display-control-label" for="display-appearance">Color scheme:</label>
                <select id="display-appearance"><option value="blue">Default (blue)</option><option value="olive">Olive green</option><option value="silver">Silver</option><option value="classic">Windows Standard</option></select>
                <label class="display-control-label" for="display-font-size">Font size:</label>
                        <select id="display-font-size"><option value="normal">Normal</option><option value="large">Large Fonts</option><option value="extra-large">Extra Large Fonts</option></select>
                <div class="display-appearance-actions">
                    <button type="button" class="xp-property-button display-effects">Effects...</button>
                    <button type="button" class="xp-property-button display-advanced-appearance">Advanced</button>
                </div>
            </div>
            <div class="display-panel" id="display-panel-settings" role="tabpanel" aria-labelledby="display-tab-settings" hidden>
                <div class="display-settings-monitor" aria-label="Display preview">
                    <img src="assets/xp/DisplaySettings.png" alt="">
                    <div class="display-resolution-preview"><span></span></div>
                </div>
                <p class="display-device-label">Display:<br>Default Monitor on Cirrus Logic 5446 Compatible Graphics Adapter</p>
                <div class="display-settings-groups">
                    <fieldset class="display-resolution-group"><legend>Screen resolution</legend>
                        <div class="resolution-endpoints"><span>Less</span><span>More</span></div>
                        <input id="display-resolution-slider" type="range" min="0" max="3" step="1" aria-label="Screen resolution">
                        <select id="display-resolution" hidden><option value="800x600">800 by 600 pixels</option><option value="1024x768">1024 by 768 pixels</option><option value="1440x900">1440 by 900 pixels</option><option value="auto">Use browser size</option></select>
                        <p class="display-resolution-value"></p>
                    </fieldset>
                    <fieldset class="display-color-quality"><legend>Color quality</legend>
                        <select disabled><option>High (24 bit)</option></select>
                        <div class="display-color-spectrum"></div>
                    </fieldset>
                </div>
                <div class="display-settings-actions">
                    <button type="button" class="xp-property-button display-troubleshoot">Troubleshoot...</button>
                    <button type="button" class="xp-property-button display-monitor-advanced">Advanced</button>
                </div>
                <p class="display-settings-note" hidden>Changes are previewed on the simulated monitor and limited to the available browser viewport.</p>
            </div>
            <div class="display-dialog-buttons">
                <button type="button" data-display-action="ok">OK</button>
                <button type="button" data-display-action="cancel">Cancel</button>
                <button type="button" data-display-action="apply" disabled>Apply</button>
            </div>
        `;
    return content;
  }

  if (shortcutId === "__internet-games") {
    content.className = "internet-games-content";
    content.innerHTML = `
      <header class="internet-games-header">
        <div>
          <h1>Internet Games</h1>
          <p>Find and install playable Flash games from Flashpoint Archive.</p>
        </div>
        <img src="assets/xp/icons/AddRemovePrograms.png" alt="">
      </header>
      <div class="internet-games-tabs" role="tablist" aria-label="Internet Games">
        <button type="button" role="tab" aria-selected="true" data-internet-tab="browse">Find Games</button>
        <button type="button" role="tab" aria-selected="false" tabindex="-1" data-internet-tab="installed">Installed</button>
      </div>
      <section class="internet-games-panel" data-internet-panel="browse">
        <form class="internet-games-search" role="search">
          <label for="internet-games-query">Search Flashpoint:</label>
          <span>
            <input id="internet-games-query" class="xp-input" type="search" maxlength="100" autocomplete="off" placeholder="Try Bike Mania">
            <button class="xp-btn default" type="submit">Search</button>
          </span>
        </form>
        <p class="internet-games-status" aria-live="polite">Enter a game title to search the archive.</p>
        <div class="internet-games-results" aria-label="Game results"></div>
      </section>
      <section class="internet-games-panel" data-internet-panel="installed" hidden>
        <p class="internet-games-installed-status" aria-live="polite"></p>
        <div class="internet-games-installed"></div>
      </section>
    `;
    return content;
  }

  if (shortcutId === "__search") {
    content.className = "search-companion-content";
    content.innerHTML = `
            <div class="explorer-chrome search-explorer-chrome">
                <div class="explorer-menu-row">
                    <div class="explorer-menu-bar" role="menubar"><button>File</button><button>Edit</button><button>View</button><button>Favorites</button><button>Tools</button><button>Help</button></div>
                    <div class="explorer-brand" aria-hidden="true"><img src="assets/xp/WindowsFlag.png" alt=""></div>
                </div>
                <div class="explorer-toolbar">
                    <button disabled><img src="assets/xp/icons/Back.png" alt=""> Back <span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
                    <button disabled aria-label="Forward"><img src="assets/xp/icons/Forward.png" alt=""><span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
                    <button disabled aria-label="Up"><img src="assets/xp/icons/Up.png" alt=""></button>
                    <span class="explorer-toolbar-separator" aria-hidden="true"></span>
                    <button class="search-toolbar-active"><img src="assets/xp/icons/Search.png" alt=""> Search</button>
                    <button><img src="assets/xp/icons/NewFolder.png" alt=""> Folders</button>
                    <span class="explorer-toolbar-separator" aria-hidden="true"></span>
                    <button aria-label="Views"><img src="assets/xp/icons/FolderViewClassic.png" alt=""><span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
                </div>
                <label class="explorer-address"><span>Address</span><span class="explorer-address-field"><img src="assets/xp/icons/Search.png" alt=""><input type="text" aria-label="Address" value="Search Results" readonly></span><button type="button" aria-label="Go"><img src="assets/xp/icons/Go.png" alt=""></button></label>
            </div>
            <div class="search-column-header"><span>Search Companion</span><span><b>Name</b><b>In Folder</b><b>Size</b><b>Type</b></span></div>
            <div class="search-companion-body">
                <aside class="search-companion-panel">
                    <section class="search-start-panel">
                        <strong>What do you want to search for?</strong>
                        <button type="button" data-search-kind="media">Pictures, music, or video</button>
                        <button type="button" data-search-kind="documents">Documents (word processing, spreadsheet, etc.)</button>
                        <button type="button" data-search-kind="all">All files and folders</button>
                        <button type="button" data-search-kind="people">Computers or people</button>
                        <button type="button" data-search-kind="help">Information in Help and Support Center</button>
                        <span>You may also want to...</span>
                        <button type="button" data-search-extra>Search the Internet</button>
                        <button type="button" data-search-extra>Change preferences</button>
                        <button type="button" data-search-extra>Turn off animated character</button>
                    </section>
                    <section class="search-form-panel" hidden>
                        <button type="button" class="search-back" data-search-action="back">Back</button>
                        <strong>Search by any or all of the criteria below.</strong>
                        <label for="search-filename">All or part of the file name:</label>
                        <input id="search-filename" class="xp-input" type="search" autocomplete="off">
                        <label for="search-location">Look in:</label>
                        <select id="search-location" class="xp-input"></select>
                        <label for="search-type">What do you want to find?</label>
                        <select id="search-type" class="xp-input">
                            <option value="all">All files and folders</option>
                            <option value="files">Files</option>
                            <option value="folders">Folders</option>
                            <option value="games">Games</option>
                            <option value="applications">Applications</option>
                        </select>
                        <button type="button" class="xp-btn default" data-search-action="search">Search</button>
                    </section>
                    <img class="search-dog" src="assets/xp/SearchDog.bmp" alt="">
                </aside>
                <main class="search-results-pane">
                    <p class="search-results-status" aria-live="polite">To start your search, follow the instructions in the left pane.</p>
                    <div class="search-results-list" role="listbox" aria-label="Search results"></div>
                </main>
            </div>
        `;
    return content;
  }

  const taskTitles = {
    "__my-documents": "File and Folder Tasks",
    "__my-pictures": "Picture Tasks",
    "__my-music": "Music Tasks",
    "__my-computer": "System Tasks",
    "__recycle-bin": "Recycle Bin Tasks",
  };

  const sidebar = document.createElement("aside");
  sidebar.className = "explorer-sidebar";

  const tasksSection = document.createElement("section");
  const tasksTitle = document.createElement("h3");
  tasksTitle.innerHTML = `<button type="button" class="explorer-section-toggle" aria-expanded="true"><span class="explorer-section-label">${taskTitles[shortcutId]}</span><span aria-hidden="true">⌃</span></button>`;
  const tasksBody = document.createElement("div");
  tasksBody.className = "explorer-section-body";
  tasksSection.append(tasksTitle, tasksBody);
  const appendSidebarAction = (container, label, icon, onClick, place = "") => {
    const button = document.createElement("button");
    button.type = "button";
    if (place) button.dataset.place = place;
    const image = document.createElement("img");
    image.src = XP_ICON_PATHS[icon];
    image.alt = "";
    const text = document.createElement("span");
    text.textContent = label;
    button.append(image, text);
    if (onClick) button.addEventListener("click", onClick);
    container.appendChild(button);
    return button;
  };

  if (shortcutId === "__recycle-bin") {
    const emptyBin = document.createElement("button");
    emptyBin.type = "button";
    emptyBin.className = "recycle-task";
    emptyBin.textContent = "Empty Recycle Bin";
    emptyBin.addEventListener("click", confirmEmptyRecycleBin);

    const restoreAll = document.createElement("button");
    restoreAll.type = "button";
    restoreAll.className = "recycle-task";
    restoreAll.textContent = "Restore all items";
    restoreAll.addEventListener("click", () => {
      fs.getChildren(fs.RECYCLE_BIN).forEach((node) => {
        try {
          fileOps.restore([node.id]);
        } catch (error) {
          console.error(error);
        }
      });
    });

    tasksBody.append(emptyBin, restoreAll);
    const restoreSelected = document.createElement("button");
    restoreSelected.type = "button";
    restoreSelected.className = "recycle-task";
    restoreSelected.textContent = "Restore selected items";
    restoreSelected.addEventListener("click", () => {
      const ids = selectedExplorerNodes(win);
      if (ids.length) fileOps.restore(ids);
    });
    const deleteSelected = document.createElement("button");
    deleteSelected.type = "button";
    deleteSelected.className = "recycle-task";
    deleteSelected.textContent = "Delete selected items";
    deleteSelected.addEventListener("click", () => {
      const ids = selectedExplorerNodes(win);
      if (!ids.length) return;
      XPDialogs.confirm(
        "Are you sure you want to permanently delete the selected items?",
        "Confirm File Delete",
        "warning",
      ).then((yes) => yes && fileOps.permanentlyDelete(ids));
    });
    tasksBody.append(restoreSelected, deleteSelected);
  } else {
    [
      [
        "View System Information",
        "ExplorerProperties.png",
        openProjectSettings,
      ],
      ["Add or remove programs", "AddRemovePrograms.png", openControlPanel],
      ["Change a setting", "ControlPanel.png", openControlPanel],
    ].forEach(([label, icon, action]) =>
      appendSidebarAction(tasksBody, label, icon, action),
    );
  }

  const placesSection = document.createElement("section");
  placesSection.innerHTML =
    '<h3><button type="button" class="explorer-section-toggle" aria-expanded="true">Other Places<span aria-hidden="true">⌃</span></button></h3>';
  const placesBody = document.createElement("div");
  placesBody.className = "explorer-section-body";
  if (shortcutId === "__my-computer") {
    appendSidebarAction(
      placesBody,
      "My Computer",
      "MyComputer.png",
      () => navigateExplorer(win, fs.MY_COMPUTER),
      "computer",
    );
    appendSidebarAction(
      placesBody,
      "My Pictures",
      "MyPictures.png",
      () => navigateExplorer(win, fs.MY_PICTURES),
      "pictures",
    );
    appendSidebarAction(
      placesBody,
      "My Music",
      "MyMusic.png",
      () => navigateExplorer(win, fs.MY_MUSIC),
      "music",
    );
    appendSidebarAction(
      placesBody,
      "My Network Places",
      "MyNetworkPlaces.png",
      openNetworkStatus,
      "network",
    );
  } else {
    appendSidebarAction(
      placesBody,
      "My Computer",
      "MyComputer.png",
      () => navigateExplorer(win, fs.MY_COMPUTER),
      "computer",
    );
    appendSidebarAction(
      placesBody,
      "My Documents",
      "MyDocuments.png",
      () => navigateExplorer(win, fs.MY_DOCUMENTS),
      "documents",
    );
    appendSidebarAction(
      placesBody,
      "Control Panel",
      "ControlPanel.png",
      openControlPanel,
      "control-panel",
    );
  }
  placesSection.appendChild(placesBody);

  sidebar.append(tasksSection, placesSection);
  const treeSection = document.createElement("section");
  treeSection.className = "explorer-tree-section";
  treeSection.innerHTML = "<h3>Folders</h3>";
  const tree = document.createElement("div");
  tree.className = "explorer-tree";
  tree.setAttribute("role", "tree");
  treeSection.appendChild(tree);
  sidebar.appendChild(treeSection);
  sidebar.querySelectorAll(".explorer-section-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const section = toggle.closest("section");
      const collapsed = section.classList.toggle("collapsed");
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.querySelector("[aria-hidden]").textContent = collapsed ? "⌄" : "⌃";
    });
  });
  const main = document.createElement("main");
  main.className = "explorer-main";

  const heading = document.createElement("h2");
  main.appendChild(heading);

  const items = document.createElement("div");
  items.className = "explorer-items";
  items.tabIndex = 0;
  main.appendChild(items);
  main.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".explorer-item")) {
      items.focus({ preventScroll: true });
    }
  });

  const chrome = document.createElement("div");
  chrome.className = "explorer-chrome";
  chrome.innerHTML = `
        <div class="explorer-menu-row">
            <div class="explorer-menu-bar" role="menubar"><button data-explorer-menu="file">File</button><button data-explorer-menu="edit">Edit</button><button data-explorer-menu="view">View</button><button data-explorer-menu="favorites">Favorites</button><button data-explorer-menu="tools">Tools</button><button data-explorer-menu="help">Help</button></div>
            <div class="explorer-brand" aria-hidden="true"><img src="assets/xp/WindowsFlag.png" alt=""></div>
        </div>
        <div class="explorer-toolbar">
            <button data-explorer-action="back"><img src="assets/xp/icons/Back.png" alt=""> Back <span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
            <button data-explorer-action="forward" aria-label="Forward"><img src="assets/xp/icons/Forward.png" alt=""><span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
            <button data-explorer-action="up" aria-label="Up"><img src="assets/xp/icons/Up.png" alt=""></button>
            <span class="explorer-toolbar-separator" aria-hidden="true"></span>
            <button data-explorer-action="search"><img src="assets/xp/icons/Search.png" alt=""> Search</button>
            <button data-explorer-action="folders" aria-pressed="false"><img src="assets/xp/icons/NewFolder.png" alt=""> Folders</button>
            <span class="explorer-toolbar-separator" aria-hidden="true"></span>
            <button data-explorer-action="view" aria-label="Views"><img src="assets/xp/icons/FolderViewClassic.png" alt=""><span class="toolbar-drop-arrow" aria-hidden="true">▾</span></button>
        </div>
        <label class="explorer-address"><span>Address</span><span class="explorer-address-field"><img src="assets/xp/icons/MyComputer.png" alt=""><input type="text" aria-label="Address"></span><button type="button" data-explorer-action="go" aria-label="Go"><img src="assets/xp/icons/Go.png" alt=""></button></label>
    `;
  const body = document.createElement("div");
  body.className = "explorer-body";
  body.append(sidebar, main);
  const status = document.createElement("div");
  status.className = "explorer-status";
  status.hidden = true;
  content.append(chrome, body, status);
  const explorerMenu = document.createElement("div");
  explorerMenu.className = "game-menu explorer-menu";
  explorerMenu.setAttribute("role", "menu");
  explorerMenu.hidden = true;
  chrome.appendChild(explorerMenu);
  const explorerSubmenu = document.createElement("div");
  explorerSubmenu.className = "game-menu explorer-menu explorer-submenu";
  explorerSubmenu.setAttribute("role", "menu");
  explorerSubmenu.hidden = true;
  chrome.appendChild(explorerSubmenu);
  const explorerMenuLabels = {
    file: "&File",
    edit: "&Edit",
    view: "&View",
    favorites: "F&avorites",
    tools: "&Tools",
    help: "&Help",
  };
  const explorerMenuButtons = [
    ...chrome.querySelectorAll("[data-explorer-menu]"),
  ];
  const explorerSubmenus = {
    "folder-menu": [
      { label: "Explore", action: "explore", default: true },
      { label: "Open", action: "open-current" },
      { label: "Search...", action: "search-current" },
      { label: "Manage", action: "manage" },
      { separator: true },
      { label: "Map Network Drive...", action: "map-network-drive" },
      {
        label: "Disconnect Network Drive...",
        action: "disconnect-network-drive",
      },
      { separator: true },
      { label: "Create Shortcut", action: "create-shortcut-current" },
      { label: "Delete", action: "delete-current" },
      { separator: true },
      { label: "Properties", action: "properties-current" },
    ],
    toolbars: [
      { label: "Standard Buttons", action: "standard-buttons", checked: true },
      { label: "Address Bar", action: "address-bar", checked: true },
      { label: "Links", action: "links-toolbar" },
      { separator: true },
      { label: "Lock the Toolbars", action: "lock-toolbars", checked: true },
      { label: "Customize...", action: "customize-toolbar" },
    ],
    "explorer-bar": [
      { label: "Search", action: "search-current", shortcut: "Ctrl+E" },
      { label: "Favorites", action: "favorites-bar", shortcut: "Ctrl+I" },
      { label: "History", action: "history-bar", shortcut: "Ctrl+H" },
      { label: "Folders", action: "folders-bar", checked: true },
      { separator: true },
      { label: "Tip of the Day", action: "tip-of-day" },
    ],
    "arrange-icons": [
      { label: "Name", action: "arrange-name" },
      { label: "Type", action: "arrange-type", radio: true, checked: true },
      { label: "Total Size", action: "arrange-total-size" },
      { label: "Free Space", action: "arrange-free-space" },
      { label: "Comments", action: "arrange-comments" },
      { separator: true },
      { label: "Show in Groups", action: "show-groups", checked: true },
      { label: "Auto Arrange", action: "auto-arrange", disabled: true },
      { label: "Align to Grid", action: "align-grid", disabled: true },
    ],
    "go-to": [
      {
        label: "Back",
        action: "back",
        shortcut: "Alt+Left Arrow",
        disabled: true,
      },
      {
        label: "Forward",
        action: "forward",
        shortcut: "Alt+Right Arrow",
        disabled: true,
      },
      { label: "Up One Level", action: "up-one-level" },
      { separator: true },
      { label: "Home Page", action: "home-page", shortcut: "Alt+Home" },
      { separator: true },
      { label: "My Computer", action: "my-computer", checked: true },
    ],
  };
  explorerMenuButtons.forEach((button) => {
    const { key } = setAccessKeyText(
      button,
      explorerMenuLabels[button.dataset.explorerMenu],
    );
    button.dataset.accessKey = key;
    button.setAttribute("role", "menuitem");
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
  });
  const renderExplorerMenuEntries = (menu, entries, commandAttribute) => {
    menu.replaceChildren();
    entries.forEach((entry) => {
      if (entry.separator) {
        const separator = document.createElement("div");
        separator.className = "game-menu-separator";
        separator.setAttribute("role", "separator");
        menu.appendChild(separator);
        return;
      }
      const item = document.createElement("button");
      item.type = "button";
      item.className = "game-menu-item";
      item.dataset[commandAttribute] = entry.action;
      item.disabled = !!entry.disabled;
      item.setAttribute("role", "menuitem");
      if (entry.default) item.classList.add("explorer-menu-default");
      if (entry.checked) item.classList.add("checked");
      if (entry.radio || entry.checked) {
        const check = document.createElement("span");
        check.className = "menu-check explorer-menu-radio";
        check.textContent = entry.checked ? (entry.radio ? "•" : "✓") : "";
        item.appendChild(check);
      }
      const label = document.createElement("span");
      label.textContent = entry.label;
      item.appendChild(label);
      if (entry.shortcut) {
        const shortcut = document.createElement("span");
        shortcut.className = "menu-shortcut";
        shortcut.textContent = entry.shortcut;
        item.appendChild(shortcut);
      }
      if (entry.submenu) {
        item.classList.add("has-submenu");
        item.setAttribute("aria-haspopup", "menu");
        const arrow = document.createElement("span");
        arrow.className = "explorer-menu-arrow";
        arrow.textContent = "▶";
        item.appendChild(arrow);
      }
      menu.appendChild(item);
    });
  };
  const showExplorerSubmenu = (name, parentItem, focusFirst = false) => {
    const entries = explorerSubmenus[name];
    if (!entries) return false;
    renderExplorerMenuEntries(explorerSubmenu, entries, "explorerSubcommand");
    explorerSubmenu.dataset.explorerSubmenuName = name;
    explorerSubmenu.dataset.parentCommand = name;
    explorerSubmenu.style.left = `${explorerMenu.offsetLeft + explorerMenu.offsetWidth - 3}px`;
    explorerSubmenu.style.top = `${explorerMenu.offsetTop + parentItem.offsetTop - 1}px`;
    explorerSubmenu.hidden = false;
    if (focusFirst)
      explorerSubmenu.querySelector("button:not(:disabled)")?.focus();
    return true;
  };
  const showExplorerMenu = (name, button, focusFirst = false) => {
    const selected = selectedExplorerNodes(win);
    const protectedSelection = selected.some((id) => fs.isProtected(id));
    const writable = ![fs.RECYCLE_BIN, fs.MY_COMPUTER].includes(
      win.currentFolderId,
    );
    const currentFolderName = fs.getNode(win.currentFolderId)?.name || "Folder";
    const actions = {
      file: [
        { label: "Create Shortcut", action: "create-shortcut", disabled: true },
        {
          label: "Delete",
          action:
            win.currentFolderId === fs.MY_COMPUTER
              ? "delete-current"
              : "delete",
          disabled:
            win.currentFolderId !== fs.MY_COMPUTER &&
            (!selected.length || protectedSelection),
        },
        {
          label: "Rename",
          action:
            win.currentFolderId === fs.MY_COMPUTER
              ? "rename-current"
              : "rename",
          disabled:
            win.currentFolderId !== fs.MY_COMPUTER &&
            (selected.length !== 1 || protectedSelection),
        },
        { label: "Properties", action: "properties-current" },
        { separator: true },
        { label: currentFolderName, action: "folder-menu", submenu: true },
        { separator: true },
        { label: "Close", action: "close" },
      ],
      edit: [
        { label: "Undo", action: "undo", shortcut: "Ctrl+Z", disabled: true },
        { separator: true },
        {
          label: "Cut",
          action: "cut",
          shortcut: "Ctrl+X",
          disabled: !selected.length || protectedSelection,
        },
        {
          label: "Copy",
          action: "copy",
          shortcut: "Ctrl+C",
          disabled: !selected.length,
        },
        {
          label: "Paste",
          action: "paste",
          shortcut: "Ctrl+V",
          disabled: !writable || !fileOps.canPaste(win.currentFolderId),
        },
        { label: "Paste Shortcut", action: "paste-shortcut", disabled: true },
        { separator: true },
        { label: "Select All", action: "select-all", shortcut: "Ctrl+A" },
        { label: "Invert Selection", action: "invert-selection" },
      ],
      view: [
        { label: "Toolbars", action: "toolbars", submenu: true },
        { label: "Status Bar", action: "status-bar" },
        { label: "Explorer Bar", action: "explorer-bar", submenu: true },
        { separator: true },
        {
          label: "Thumbnails",
          action: "thumbnails",
          radio: true,
          checked: win.explorerView === "thumbnails",
        },
        {
          label: "Tiles",
          action: "tiles",
          radio: true,
          checked: (win.explorerView || "tiles") === "tiles",
        },
        {
          label: "Icons",
          action: "icons",
          radio: true,
          checked: win.explorerView === "icons",
        },
        {
          label: "List",
          action: "list",
          radio: true,
          checked: win.explorerView === "list",
        },
        {
          label: "Details",
          action: "details",
          radio: true,
          checked: win.explorerView === "details",
        },
        { separator: true },
        { label: "Arrange Icons By", action: "arrange-icons", submenu: true },
        { separator: true },
        { label: "Choose Details...", action: "choose-details" },
        { label: "Go To", action: "go-to", submenu: true },
        { label: "Refresh", action: "refresh" },
      ],
      favorites: [
        { label: "Add to Favorites...", action: "add-favorite" },
        { label: "Organize Favorites...", action: "organize-favorites" },
        { separator: true },
        { label: "Links", action: "links", submenu: true },
        { label: "MSN.com", action: "msn" },
        { label: "Radio Station Guide", action: "radio-guide" },
      ],
      tools: [
        { label: "Map Network Drive...", action: "map-network-drive" },
        {
          label: "Disconnect Network Drive...",
          action: "disconnect-network-drive",
        },
        { label: "Synchronize...", action: "synchronize" },
        { separator: true },
        { label: "Folder Options...", action: "folder-options" },
      ],
      help: [
        { label: "Help and Support Center", action: "help-center" },
        { separator: true },
        { label: "Is this copy of Windows legal?", action: "windows-legal" },
        { label: "About Windows", action: "about-windows" },
      ],
    }[name];
    explorerMenu.dataset.explorerMenuName = name;
    renderExplorerMenuEntries(explorerMenu, actions, "explorerCommand");
    explorerSubmenu.hidden = true;
    explorerMenu.hidden = false;
    explorerMenuButtons.forEach((entry) =>
      entry.setAttribute("aria-expanded", String(entry === button)),
    );
    explorerMenu.style.left = `${button.offsetLeft}px`;
    explorerMenu.style.top = `${button.offsetTop + button.offsetHeight}px`;
    if (focusFirst)
      explorerMenu.querySelector("button:not(:disabled)")?.focus();
  };
  chrome.addEventListener("click", (event) => {
    const menuButton = event.target.closest("[data-explorer-menu]");
    const menuName = menuButton?.dataset.explorerMenu;
    if (menuName) {
      showExplorerMenu(menuName, menuButton, false);
      return;
    }
    const commandButton = event.target.closest("[data-explorer-command]");
    const command = commandButton?.dataset.explorerCommand;
    if (command) {
      if (commandButton.classList.contains("has-submenu")) {
        showExplorerSubmenu(command, commandButton, false);
        return;
      }
      const selected = selectedExplorerNodes(win);
      if (
        command === "new" &&
        ![fs.RECYCLE_BIN, fs.MY_COMPUTER].includes(win.currentFolderId)
      )
        fileOps.createFolder(win.currentFolderId, "New Folder");
      if (command === "close") closeGameWindow(win.gameId);
      if (command === "cut") fileOps.cut(selected);
      if (command === "copy") fileOps.copy(selected);
      if (
        command === "paste" &&
        ![fs.RECYCLE_BIN, fs.MY_COMPUTER].includes(win.currentFolderId)
      )
        pasteIntoFolder(win.currentFolderId);
      if (command === "delete") confirmRecycleDelete(selected);
      if (command === "delete-current" || command === "rename-current")
        XPDialogs.alert(
          `Cannot ${command === "delete-current" ? "delete" : "rename"} My Computer.`,
          "Windows Explorer",
          "info",
        );
      if (command === "rename") {
        const name = window.prompt("Rename", fs.getNode(selected[0]).name);
        if (name !== null) fileOps.rename(selected[0], name);
      }
      if (
        ["thumbnails", "tiles", "icons", "list", "details"].includes(command)
      ) {
        win.explorerView = command;
        renderExplorerItems(win);
      }
      if (command === "documents") openSystemWindow("__my-documents");
      if (command === "properties-current")
        openShellProperties(selected[0] || win.currentFolderId);
      if (command === "select-all")
        win.el
          .querySelectorAll(".explorer-item")
          .forEach((item) => item.classList.add("selected"));
      if (command === "invert-selection")
        win.el
          .querySelectorAll(".explorer-item")
          .forEach((item) => item.classList.toggle("selected"));
      if (command === "refresh") renderExplorerItems(win);
      if (command === "help-center") openHelpAndSupport();
      if (command === "about-windows") openAboutWindows();
      if (
        [
          "add-favorite",
          "organize-favorites",
          "msn",
          "radio-guide",
          "map-network-drive",
          "disconnect-network-drive",
          "synchronize",
          "folder-options",
          "windows-legal",
          "choose-details",
        ].includes(command)
      )
        XPDialogs.alert(
          "This Windows XP feature is not available in Astro Flash Collection.",
          commandButton.textContent.trim() || "Windows Explorer",
          "info",
        );
      explorerMenu.hidden = true;
      explorerSubmenu.hidden = true;
      explorerMenuButtons.forEach((button) =>
        button.setAttribute("aria-expanded", "false"),
      );
      return;
    }
    const subcommandButton = event.target.closest("[data-explorer-subcommand]");
    const subcommand = subcommandButton?.dataset.explorerSubcommand;
    if (subcommand) {
      if (subcommand === "search-current") openSearchDialog();
      if (subcommand === "folders-bar") {
        content.classList.add("folders-visible");
        chrome
          .querySelector('[data-explorer-action="folders"]')
          ?.setAttribute("aria-pressed", "true");
      }
      if (subcommand === "up-one-level") {
        const parent =
          fs.getParent(win.currentFolderId) || fs.getNode(fs.DESKTOP);
        if (parent) navigateExplorer(win, parent.id);
      }
      if (subcommand === "my-computer") navigateExplorer(win, fs.MY_COMPUTER);
      if (subcommand === "properties-current")
        openShellProperties(win.currentFolderId);
      if (
        [
          "manage",
          "map-network-drive",
          "disconnect-network-drive",
          "create-shortcut-current",
          "delete-current",
          "standard-buttons",
          "address-bar",
          "links-toolbar",
          "lock-toolbars",
          "customize-toolbar",
          "favorites-bar",
          "history-bar",
          "tip-of-day",
          "home-page",
        ].includes(subcommand)
      )
        XPDialogs.alert(
          "This Windows XP feature is not available in Astro Flash Collection.",
          subcommandButton.textContent.trim() || "Windows Explorer",
          "info",
        );
      explorerMenu.hidden = true;
      explorerSubmenu.hidden = true;
      explorerMenuButtons.forEach((button) =>
        button.setAttribute("aria-expanded", "false"),
      );
      return;
    }
    const actionButton = event.target.closest("[data-explorer-action]");
    const action = actionButton?.dataset.explorerAction;
    if (!action) return;
    if (action === "back") explorerBack(win);
    if (action === "forward") explorerForward(win);
    if (action === "up") {
      const parent =
        fs.getParent(win.currentFolderId) ||
        ([fs.MY_COMPUTER, fs.RECYCLE_BIN].includes(win.currentFolderId)
          ? fs.getNode(fs.DESKTOP)
          : null);
      if (parent) navigateExplorer(win, parent.id);
    }
    if (action === "folders") {
      const foldersVisible = content.classList.toggle("folders-visible");
      actionButton.setAttribute("aria-pressed", String(foldersVisible));
    }
    if (action === "view") {
      const views = ["tiles", "thumbnails", "icons", "list", "details"];
      win.explorerView =
        views[(views.indexOf(win.explorerView || "tiles") + 1) % views.length];
      renderExplorerItems(win);
    }
    if (action === "search") openSearchDialog();
    if (action === "go") {
      const input = chrome.querySelector(".explorer-address input");
      const destination = fs.resolvePath(input.value);
      if (destination && fs.getNode(destination)?.type === "folder")
        navigateExplorer(win, destination);
      else input.value = fs.getPath(win.currentFolderId);
    }
  });
  explorerMenu.addEventListener("pointerover", (event) => {
    const parentItem = event.target.closest(".has-submenu");
    if (parentItem)
      showExplorerSubmenu(
        parentItem.dataset.explorerCommand,
        parentItem,
        false,
      );
    else if (event.target.closest(".game-menu-item"))
      explorerSubmenu.hidden = true;
  });
  chrome.querySelector("input").addEventListener("change", (event) => {
    const destination = fs.resolvePath(event.target.value);
    if (destination && fs.getNode(destination)?.type === "folder")
      navigateExplorer(win, destination);
    else event.target.value = fs.getPath(win.currentFolderId);
  });
  chrome.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const activeButton = explorerMenuButtons.find(
        (button) => button.getAttribute("aria-expanded") === "true",
      );
      explorerMenu.hidden = true;
      explorerSubmenu.hidden = true;
      explorerMenuButtons.forEach((button) =>
        button.setAttribute("aria-expanded", "false"),
      );
      activeButton?.focus();
      return;
    }
    const heading = document.activeElement?.closest?.("[data-explorer-menu]");
    if (event.altKey) {
      const target = explorerMenuButtons.find(
        (button) => button.dataset.accessKey === event.key.toLowerCase(),
      );
      if (target) {
        event.preventDefault();
        showExplorerMenu(target.dataset.explorerMenu, target, true);
      }
      return;
    }
    if (
      heading &&
      ["ArrowLeft", "ArrowRight", "ArrowDown", "Home", "End"].includes(
        event.key,
      )
    ) {
      event.preventDefault();
      const index = explorerMenuButtons.indexOf(heading);
      const target =
        event.key === "Home"
          ? explorerMenuButtons[0]
          : event.key === "End"
            ? explorerMenuButtons.at(-1)
            : event.key === "ArrowDown"
              ? heading
              : explorerMenuButtons[
                  (index +
                    (event.key === "ArrowRight" ? 1 : -1) +
                    explorerMenuButtons.length) %
                    explorerMenuButtons.length
                ];
      if (event.key === "ArrowDown")
        showExplorerMenu(heading.dataset.explorerMenu, heading, true);
      else {
        target.focus();
        showExplorerMenu(target.dataset.explorerMenu, target, true);
      }
      return;
    }
    const menuItems = [
      ...explorerMenu.querySelectorAll("button:not(:disabled)"),
    ];
    const activeMenuItem = document.activeElement?.closest?.(
      "[data-explorer-command]",
    );
    if (
      event.key === "ArrowRight" &&
      activeMenuItem?.classList.contains("has-submenu")
    ) {
      event.preventDefault();
      showExplorerSubmenu(
        activeMenuItem.dataset.explorerCommand,
        activeMenuItem,
        true,
      );
      return;
    }
    const activeSubmenuItem = document.activeElement?.closest?.(
      "[data-explorer-subcommand]",
    );
    if (event.key === "ArrowLeft" && activeSubmenuItem) {
      event.preventDefault();
      const parent = explorerMenu.querySelector(
        `[data-explorer-command="${CSS.escape(explorerSubmenu.dataset.parentCommand)}"]`,
      );
      explorerSubmenu.hidden = true;
      parent?.focus();
      return;
    }
    const submenuItems = [
      ...explorerSubmenu.querySelectorAll("button:not(:disabled)"),
    ];
    if (
      !explorerSubmenu.hidden &&
      activeSubmenuItem &&
      ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
    ) {
      event.preventDefault();
      const index = submenuItems.indexOf(activeSubmenuItem);
      const target =
        event.key === "Home"
          ? submenuItems[0]
          : event.key === "End"
            ? submenuItems.at(-1)
            : submenuItems[
                (index +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  submenuItems.length) %
                  submenuItems.length
              ];
      target?.focus();
      return;
    }
    if (
      !explorerMenu.hidden &&
      ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
    ) {
      event.preventDefault();
      const index = menuItems.indexOf(document.activeElement);
      const target =
        event.key === "Home"
          ? menuItems[0]
          : event.key === "End"
            ? menuItems.at(-1)
            : menuItems[
                (index +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  menuItems.length) %
                  menuItems.length
              ];
      target?.focus();
    }
    if (
      event.key === "Enter" &&
      !explorerMenu.hidden &&
      document.activeElement?.matches("[data-explorer-command]")
    ) {
      event.preventDefault();
      document.activeElement.click();
    }
  });
  renderExplorerItems(win, content);
  renderExplorerTree(win);
  return content;
};
