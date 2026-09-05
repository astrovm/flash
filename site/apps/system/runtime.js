export const createSystemRuntime = (context) => {
  const {
    XPDialogs,
    XP_ICON_PATHS,
    closeGameWindow,
    confirmEmptyRecycleBin,
    confirmRecycleDelete,
    explorerBack,
    explorerForward,
    fileOps,
    fs,
    navigateExplorer,
    openAboutWindows,
    openControlPanel,
    openDateTimeProperties,
    openFolderOptions,
    openInternetProperties,
    openNetworkStatus,
    openPowerOptions,
    openProjectSettings,
    openRegionalLanguageOptions,
    openSearchDialog,
    openShellProperties,
    openSystemWindow,
    openTaskbarProperties,
    openWindows,
    pasteIntoFolder,
    renderExplorerItems,
    renderExplorerTree,
    renderTaskButtons,
    selectedExplorerNodes,
    setAccessKeyText,
    toggleTrayVolumePopup,
    wireProjectSettings,
  } = context;

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

      </aside>
      <main class="control-panel-main">
        <h1>Pick a category</h1>
        <div class="control-panel-categories"></div>
      </main>
    </div>
  `;

    const categories = [
      [
        "appearance",
        "Appearance and Themes",
        "AppearanceAndThemes.png",
        "left",
      ],
      [
        "network",
        "Network and Internet Connections",
        "NetworkAndInternet.png",
        "left",
      ],
      [
        "datetime",
        "Date, Time, Language, and Regional Options",
        "DateTimeRegional.png",
        "right",
      ],
      [
        "performance",
        "Performance and Maintenance",
        "PerformanceAndMaintenance.png",
        "left",
      ],
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
      ["date-time", "Date and Time", "DateAndTime.png"],
      ["display", "Display", "Display.png"],
      ["folder-options", "Folder Options", "FolderOptions.png"],
      ["internet-options", "Internet Options", "InternetOptions.png"],
      ["network-connections", "Network Connections", "NetworkConnections.png"],
      ["power-options", "Power Options", "PowerOptions.png"],
      [
        "regional-language",
        "Regional and Language Options",
        "RegionalAndLanguage.png",
      ],
      [
        "taskbar-properties",
        "Taskbar and Start Menu",
        "TaskbarAndStartMenu.png",
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

      `;
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
        </div>
      </section>
      `;
      content.querySelector(".control-panel-main").innerHTML = `
      <div class="control-panel-category-heading"><img src="assets/xp/icons/PerformanceAndMaintenance.png" alt=""><strong>Performance and Maintenance</strong></div>
      <h1>Pick a task...</h1>
      <div class="control-panel-task-links performance-task-links">


      </div>
      <h2>or pick a Control Panel icon</h2>
      <div class="control-panel-category-icons">
        <button type="button" data-control-panel-action="power-options"><img src="assets/xp/icons/PowerOptions.png" alt=""><span>Power Options</span></button>
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
      `;
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

        </div>
      </section>
      `;
      content.querySelector(".control-panel-main").innerHTML = `
      <div class="control-panel-category-heading"><img src="assets/xp/icons/NetworkAndInternet.png" alt=""><strong>Network and Internet Connections</strong></div>
      <h1>Pick a task...</h1>
      <div class="control-panel-task-links network-task-links">


      </div>
      <h2>or pick a Control Panel icon</h2>
      <div class="control-panel-category-icons network-category-icons">
        <button type="button" data-control-panel-action="internet-options"><img src="assets/xp/icons/InternetOptions.png" alt=""><span>Internet Options</span></button>
        <button type="button" data-control-panel-action="network-connections"><img src="assets/xp/icons/NetworkConnections.png" alt=""><span>Network Connections</span></button>

      </div>`;
    };

    const actions = {
      appearance: renderAppearanceCategory,
      network: renderNetworkCategory,
      datetime: renderDateRegionalCategory,
      performance: renderPerformanceCategory,
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
      const action = event.target.closest("[data-control-panel-action]")
        ?.dataset.controlPanelAction;
      if (action === "classic") {
        const classic = content.classList.toggle("classic-view");
        content.querySelector(".control-panel-main h1").textContent =
          "Pick a category";
        if (classic) renderClassicItems();
        else categoryGrid.innerHTML = categoryMarkup;
        event.target.closest("button").querySelector("span").textContent =
          classic ? "Switch to Category View" : "Switch to Classic View";
      } else if (action === "search") {
        openSearchDialog();
      } else if (action === "folders") {
        const pressed = content.classList.toggle("folders-visible");
        event.target
          .closest("button")
          .setAttribute("aria-pressed", String(pressed));
      } else if (action === "updates") {
        XPDialogs.alert(
          "Astro Flash Collection does not connect to Windows Update.",
          "Windows Update",
          "info",
        );
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
          .querySelector(
            ".folder-options-dialog [data-folder-tab='file-types']",
          )
          ?.click();
      } else if (action === "magnifier" || action === "on-screen-keyboard") {
        XPDialogs.alert(
          `${action === "magnifier" ? "Magnifier" : "On-Screen Keyboard"} is not available in Astro Flash Collection.`,
          action === "magnifier" ? "Magnifier" : "On-Screen Keyboard",
          "info",
        );
      } else if (action === "advanced-volume") {
        toggleTrayVolumePopup();
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
      } else if (
        action === "regional-format" ||
        action === "regional-language"
      ) {
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
      }
    });
  };

  const createSystemContentRoot = () => {
    const content = document.createElement("div");
    content.className = "explorer-content";
    return content;
  };

  const XP_SYSTEM_RENDERERS = Object.freeze({
    "__control-panel": (win) => {
      return createControlPanelContent();
    },
    "__astro-settings": (win) => {
      const content = createSystemContentRoot();

      content.className = "project-settings-content";
      return content;
    },
    "__display-properties": (win) => {
      const content = createSystemContentRoot();

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
                        <select id="display-saver" aria-label="Screen saver"><option value="none">(None)</option><option value="pipes">3D Pipes</option><option value="blank">Blank</option><option value="marquee">Marquee</option><option value="stars">Starfield</option><option value="windows-xp">Windows XP</option></select>
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
    },
    "__internet-games": (win) => {
      const content = createSystemContentRoot();

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
    },
    __search: (win) => {
      const content = createSystemContentRoot();

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
    },
    explorer: (shortcutId, win) => {
      const content = createSystemContentRoot();

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
      const appendSidebarAction = (
        container,
        label,
        icon,
        onClick,
        place = "",
      ) => {
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
        restoreAll.addEventListener("click", async () => {
          try {
            try {
              await fileOps.restore(
                fs.getChildren(fs.RECYCLE_BIN).map((node) => node.id),
              );
            } catch (error) {
              await XPDialogs.alert(error.message, "Restore files", "error");
            }
          } catch (error) {
            await XPDialogs.alert(
              error.message || "The file operation failed.",
              "File operation",
              "error",
            );
          }
        });

        tasksBody.append(emptyBin, restoreAll);
        const restoreSelected = document.createElement("button");
        restoreSelected.type = "button";
        restoreSelected.className = "recycle-task";
        restoreSelected.textContent = "Restore selected items";
        restoreSelected.addEventListener("click", async () => {
          try {
            const ids = selectedExplorerNodes(win);
            if (ids.length) await fileOps.restore(ids);
          } catch (error) {
            await XPDialogs.alert(
              error.message || "The file operation failed.",
              "File operation",
              "error",
            );
          }
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
          ).then(async (yes) => yes && (await fileOps.permanentlyDelete(ids)));
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
          toggle.querySelector("[aria-hidden]").textContent = collapsed
            ? "⌄"
            : "⌃";
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
          {
            label: "Standard Buttons",
            action: "standard-buttons",
            checked: true,
          },
          { label: "Address Bar", action: "address-bar", checked: true },
          { label: "Links", action: "links-toolbar" },
          { separator: true },
          {
            label: "Lock the Toolbars",
            action: "lock-toolbars",
            checked: true,
          },
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
        renderExplorerMenuEntries(
          explorerSubmenu,
          entries,
          "explorerSubcommand",
        );
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
        const currentFolderName =
          fs.getNode(win.currentFolderId)?.name || "Folder";
        const actions = {
          file: [
            {
              label: "Create Shortcut",
              action: "create-shortcut",
              disabled: true,
            },
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
            {
              label: "Undo",
              action: "undo",
              shortcut: "Ctrl+Z",
              disabled: true,
            },
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
            {
              label: "Paste Shortcut",
              action: "paste-shortcut",
              disabled: true,
            },
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
            {
              label: "Arrange Icons By",
              action: "arrange-icons",
              submenu: true,
            },
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
            { separator: true },
            {
              label: "Is this copy of Windows legal?",
              action: "windows-legal",
            },
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
      chrome.addEventListener("click", async (event) => {
        try {
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
              await fileOps.createFolder(win.currentFolderId, "New Folder");
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
              const name = window.prompt(
                "Rename",
                fs.getNode(selected[0]).name,
              );
              if (name !== null) await fileOps.rename(selected[0], name);
            }
            if (
              ["thumbnails", "tiles", "icons", "list", "details"].includes(
                command,
              )
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
          const subcommandButton = event.target.closest(
            "[data-explorer-subcommand]",
          );
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
            if (subcommand === "my-computer")
              navigateExplorer(win, fs.MY_COMPUTER);
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
              views[
                (views.indexOf(win.explorerView || "tiles") + 1) % views.length
              ];
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
        } catch (error) {
          await XPDialogs.alert(
            error.message || "The file operation failed.",
            "File operation",
            "error",
          );
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
        const heading = document.activeElement?.closest?.(
          "[data-explorer-menu]",
        );
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
    },
  });

  const createSystemWindowContent = (shortcutId, win) =>
    (XP_SYSTEM_RENDERERS[shortcutId] || XP_SYSTEM_RENDERERS.explorer)(
      shortcutId,
      win,
    );

  const activators = Object.freeze({
    "display-properties": context.wireDisplayProperties,
    "project-settings": wireProjectSettings,
    search: context.wireSearchCompanion,
    "internet-games": context.wireInternetGames,
    "control-panel": wireControlPanel,
  });

  return Object.freeze({
    render: createSystemWindowContent,
    activate(name, win) {
      activators[name]?.(win);
    },
  });
};
