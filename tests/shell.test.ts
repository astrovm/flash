import { expect, test } from "bun:test";

const projectDir = new URL("..", import.meta.url);
const path = (relative: string) => new URL(relative, projectDir);
const [html, javascript, dialogs, offlineJavascript, css, workboxConfig] =
  await Promise.all([
    Bun.file(path("site/index.html")).text(),
    Bun.file(path("site/js/main.js")).text(),
    Bun.file(path("site/js/dialogs.js")).text(),
    Bun.file(path("site/js/offline.js")).text(),
    Bun.file(path("site/css/main.css")).text(),
    Bun.file(path("workbox-config.ts")).text(),
  ]);
const compact = (source: string) => source.replace(/\s+/g, " ");
const javascriptCompact = compact(javascript);
const js = (...tokens: string[]) =>
  tokens.forEach((token) =>
    expect(javascriptCompact).toContain(compact(token)),
  );
const contains = (source: string, ...tokens: string[]) =>
  tokens.forEach((token) => expect(source).toContain(token));
const absent = (source: string, ...tokens: string[]) =>
  tokens.forEach((token) => expect(source).not.toContain(token));
const between = (source: string, start: string, end: string) =>
  source.slice(
    source.indexOf(start),
    source.indexOf(end, source.indexOf(start)),
  );
const iconPath = (name: string) => path(`site/assets/xp/icons/${name}`);
const fontPath = (name: string) => path(`site/css/fonts/${name}`);
const elementById = (id: string) => {
  const match = html.match(
    new RegExp(`<([\\w-]+)\\b([^>]*\\bid=["']${id}["'][^>]*)>`, "i"),
  );
  expect(match).not.toBeNull();
  const attrs = Object.fromEntries(
    [...match![2].matchAll(/([\w-]+)(?:=["']([^"']*)["'])?/g)].map(
      ([, key, value]) => [key, value ?? ""],
    ),
  );
  return { tag: match![1].toLowerCase(), attrs };
};

test("every enabled desktop menu action has a handler", () => {
  const menu = html.slice(
    html.indexOf('id="desktop-context-menu"'),
    html.indexOf("</div>", html.indexOf('id="desktop-context-menu"')),
  );
  const actions = [...menu.matchAll(/<button\b([^>]*)>/g)]
    .filter(([, attrs]) => !/\bdisabled(?:[\s=>]|$)/.test(attrs))
    .map(([, attrs]) => attrs.match(/data-action="([^"]+)"/)?.[1])
    .filter((action): action is string => Boolean(action));
  const handled = new Set(
    [...javascript.matchAll(/action === "([^"]+)"/g)].map(
      ([, action]) => action,
    ),
  );
  expect(actions.filter((action) => !handled.has(action))).toEqual([]);
});
test("window manager never discards windows silently", () =>
  absent(javascript, "MAX_OPEN_WINDOWS", "ensureWindowCapacity"));
test("Flash games keep curated FPS defaults and allow user overrides", async () => {
  const games = await Bun.file(path("site/js/games.js")).text();
  contains(games, '"bike-mania": {', "frameRate: 60");
  js(
    'const GAME_PLAYBACK_SETTINGS_KEY = "gamePlaybackSettings"',
    "const getGameFrameRateSetting =",
    "const setGameFrameRate =",
    "const resolveGameFrameRate =",
    "...(frameRate === null ? {} : { frameRate })",
    "title: `${formatGameTitle(win.gameId)} Properties`",
    '"Default (native)"',
    '["native", "Native (from SWF)"]',
    'customInput.min = "1"',
    'customInput.max = "240"',
    "reloadRuffleSWF(win)",
  );
  contains(css, ".game-playback-settings", ".game-playback-row");
});
test("window dragging and resizing coalesce updates by animation frame", () => {
  const drag = between(javascript, "const wireDrag =", "const applyResize =");
  const resize = between(
    javascript,
    "const wireResize =",
    "// ============================================\n// Window System Menu",
  );

  contains(
    drag,
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "translate3d",
    'classList.add("moving")',
  );
  contains(
    resize,
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "const desktopSize = getDesktopSize()",
  );
  contains(css, ".xp-window.moving", "will-change: transform");
});
test("internet games is integrated with the shell", async () => {
  expect(await Bun.file(path("site/js/storage-policy.js")).exists()).toBe(true);
  expect(await Bun.file(path("site/js/game-installer.js")).exists()).toBe(true);
  expect(await Bun.file(path("site/js/game-library.js")).exists()).toBe(true);
  expect(await Bun.file(path("site/js/game-data.js")).exists()).toBe(true);
  expect(html.indexOf('src="js/storage-policy.js')).toBeLessThan(
    html.indexOf('src="js/game-library.js'),
  );
  expect(html.indexOf('src="js/game-installer.js')).toBeLessThan(
    html.indexOf('src="js/game-library.js'),
  );
  expect(html.indexOf('src="js/game-library.js')).toBeLessThan(
    html.indexOf('src="js/game-data.js'),
  );
  expect(html.indexOf('src="js/game-data.js')).toBeLessThan(
    html.indexOf('src="js/main.js'),
  );
  js(
    '"__internet-games": {',
    'title: "Internet Games"',
    'icon: "assets/xp/icons/AddRemovePrograms.png"',
    '<img src="assets/xp/icons/AddRemovePrograms.png" alt="">',
    "gameLibraryInitialization = initializeGameLibrary()",
    'if (shortcutId === "__internet-games") wireInternetGames(win)',
    "url: game.url ||",
    "base: game.base ||",
    "await gameLibrary.match(originalRequest)",
    "const findBundledGameByTitle =",
    'action.title = "This game is already included with Astro Flash."',
    "let availableGameId =",
    "availableGameId = gameId",
    "if (gameLibraryReady && gameLibrary && !gameLibraryError)",
  );
  contains(css, ".internet-games-content", ".internet-game-card");
  absent(offlineJavascript, "astro-flash-installed");
});
test("Flash URL routing is shared and uses exact archived assets", async () => {
  const games = await Bun.file(path("site/js/games.js")).text();
  contains(
    games,
    '"whack-a-kass": {',
    'flashpointId: "00d4f9a7-1453-4da3-a5d9-3c980abd9f17"',
    '"http://images.neopets.com/games/g381_v58_67047.swf"',
    '"http://swf.neopets.com/games/utilities/flash_bios/bios.swf"',
    '"https://www.neopets.com/transcontent/gettranslationxml.phtml"',
    '"swf/whack-a-kass/gettranslationxml.phtml"',
    'flashpointId: "9fb4b4ae-a0bc-4c49-9be1-8b776b8151bf"',
    '"http://simpsonsgames.ru/flash/wreckscore.swf"',
  );
  js(
    "window.AstroFlashUrlRouter.create(",
    "const routedFetch = flashUrlRouter.wrapFetch",
    "if (flashUrlRouter.resolve(originalRequest))",
  );
  const bundledRouteCheck = javascript.indexOf(
    "if (flashUrlRouter.resolve(originalRequest))",
  );
  const installedGameLookup = javascript.indexOf(
    "await gameLibrary.match(originalRequest)",
  );
  expect(bundledRouteCheck).toBeGreaterThan(-1);
  expect(bundledRouteCheck).toBeLessThan(installedGameLookup);
  contains(
    html,
    '<script src="js/games.js"></script>',
    '<script src="js/flash-url-router.js"></script>',
  );
  const capture = await Bun.file(path("site/capture.html")).text();
  contains(
    capture,
    '<script src="js/games.js"></script>',
    '<script src="js/flash-url-router.js"></script>',
    "window.FLASH_GAMES[gameId]",
    "router.wrapFetch(window.fetch)",
  );
  expect(capture.indexOf("if (!game)")).toBeLessThan(
    capture.indexOf("`${game.type}/${gameId}/`"),
  );
  absent(games, "spoofUrl", "externalHosts");
  absent(capture, "spoofUrls", "externalHosts", "frameRates");
});
test("boot screen uses XP artwork", () => {
  contains(html, 'src="assets/xp/BootLogo.png"', 'class="boot-microsoft"');
  contains(css, ".boot-footer");
});
test("XP fonts have authentic faces", async () => {
  const fonts: Record<string, Record<string, string>> = {
    Tahoma: {
      "tahoma.ttf":
        "08f45bf539954d3252df97a2ae563362ed2ad5ebe05f2d1f2bc54b931e4d0550",
      "tahomabd.ttf":
        "4ba89e145ff39f208151ce269841899fc4e4a360189a4a31dc2359168dae27d0",
    },
    "Trebuchet MS": {
      "trebuc.ttf":
        "9cf5777ebf93e9193d25ec0697976bb2dcad1637b73e9e36cfbf18d26ef262a9",
      "trebucbd.ttf":
        "73150ef5306b3651eac743ad570bc956c2ca41f5564e8700c8ae83928827441e",
    },
    Arial: {
      "arial.ttf":
        "413c78f91bd39e134f3c0bb204b1d5a90f29df9efddc8fd26950a178058d5d74",
      "arialbd.ttf":
        "df70597f0bdf49da3af270138f8a34396e4f5618c671a1db3480e626f38aaece",
      "arialbi.ttf":
        "722c61a99c1af1413d762d0a3b185dd497fe55b873c8672a0c3c4bfe05d29d92",
    },
    "Lucida Console": {
      "lucon.ttf":
        "6ddf64ee896d24cf9908f115ae220a7cfa18dc034bc4a68e4db68dcd57c71512",
    },
    "Franklin Gothic Medium": {
      "framdit.ttf":
        "02bf3f5c3289f66a314e9758f48ad729e3995b26ad74887b04ebbf0d775b2492",
    },
  };
  for (const [family, files] of Object.entries(fonts)) {
    contains(css, `font-family: "${family}"`);
    for (const [name, hash] of Object.entries(files)) {
      const file = Bun.file(fontPath(name));
      expect(await file.exists()).toBe(true);
      contains(css, `url("fonts/${name}")`);
      expect(
        new Bun.CryptoHasher("sha256")
          .update(await file.arrayBuffer())
          .digest("hex"),
      ).toBe(hash);
    }
  }
  contains(workboxConfig, "**/*.{ttf,woff,woff2");
  absent(css, 'url("trebuchet.ttf")');
  expect(css).toMatch(
    /\.welcome-message\s*\{[^}]*font-family: "Franklin Gothic Medium"/,
  );
  expect(css).toMatch(/\.start-menu-user\s*\{[^}]*font-family: "Tahoma"/);
});
test("game windows use XP menus for their controls", () => {
  js(
    'menuBar.className = "game-menu-bar"',
    'menuBar.setAttribute("role", "toolbar")',
    'menuItems.setAttribute("role", "menubar")',
    "menuItems.append(fileButton, helpButton)",
    "menuBar.append(menuItems, quickActions)",
    'makeMenuItem("Add to &Favorites", "favorite", { checkbox: true })',
    'makeMenuItem("&Mute", "mute", { checkbox: true })',
  );
  contains(
    javascript,
    'makeMenuButton("&File")',
    'makeMenuButton("&Help")',
    'el.querySelector(".favorite-btn")',
    'el.querySelector(".volume-btn")',
    'el.querySelector(".volume-slider")',
  );
  absent(
    javascript,
    'makeMenuButton("&View")',
    'makeMenuButton("F&avorites")',
    'makeMenuButton("&Sound")',
    "Aavorites",
  );
});
test("game menu supports access keys and keyboard navigation", () =>
  contains(
    javascript,
    "event.altKey || event.ctrlKey || event.metaKey",
    'event.key === "ArrowDown" || event.key === "ArrowUp"',
    'event.key === "ArrowLeft" || event.key === "ArrowRight"',
    'event.key === "Escape"',
    'e.key === "F11" && focusedGameId',
  ));
test("game menu styles cover active and disabled states", () =>
  contains(
    css,
    '.game-menu-button[aria-expanded="true"]',
    ".game-menu-item:disabled",
    ".game-menu-item.checked .menu-check",
  ));
test("additive marquee preserves initial selection", () =>
  contains(
    javascript,
    "const initialSelection = new Set(",
    "additive && initialSelection.has(icon.dataset.desktopId)",
  ));
test("desktop icon images are not natively draggable", () =>
  contains(javascript, "image.draggable = false"));
test("virtual folders use desktop sized folder icons", () => {
  contains(javascript, 'return addImage("NewFolder.png")');
  contains(css, ".desktop-icon .explorer-item-icon img");
  expect(css).toMatch(
    /\.desktop-icon \.explorer-item-icon img\s*\{[^}]*width:\s*32px/,
  );
});
test("text files open in filesystem backed notepad", () => {
  js(
    'fs.registerFileType(".txt", (file) => openNotepad(file))',
    "fs.setContent(node.id, editor.value)",
    'XPDialogs.openFile({ title: "Open"',
    'XPDialogs.saveFile({ title: "Save As"',
    "win.beforeClose = confirmSaveChanges",
  );
  contains(javascript, "&File", "&Edit", "F&ormat", "&View", "&Help");
  contains(
    javascript,
    'icon: "assets/xp/icons/Notepad.png"',
    "Math.min(768, desktopWidth - 16)",
    "Math.min(530, desktopHeight - 16)",
    "status.hidden = true",
  );
  contains(css, ".notepad-editor", "overflow: scroll");
});
test("selected desktop icon shows full label", () => {
  const match = css.match(
    /\.desktop-icon\.selected \.icon-label\s*\{([^}]*)\}/,
  );
  expect(match).not.toBeNull();
  expect(match![1]).toContain("-webkit-line-clamp: unset");
});
test("tray icons and clock are focusable buttons", () => {
  for (const id of [
    "tray-network-button",
    "tray-volume-button",
    "taskbar-clock",
  ]) {
    const el = elementById(id);
    expect(el.tag).toBe("button");
    expect(el.attrs.type).toBe("button");
  }
  expect(elementById("tray-network-button").attrs.title).toBe(
    "Local Area Connection",
  );
  expect(elementById("tray-volume-button").attrs.title).toBe("Volume");
});
test("tray volume popup has slider and mute", () => {
  expect(elementById("tray-volume-popup")).toBeDefined();
  expect(elementById("tray-volume-slider").attrs.type).toBe("range");
  expect(elementById("tray-mute-checkbox").attrs.type).toBe("checkbox");
});
test("clock tooltip shows full date", () =>
  contains(javascript, "clock.title", 'weekday: "long"'));
test("clock click opens date time properties", () => {
  contains(
    javascript,
    "openDateTimeProperties",
    'title: "Date and Time Properties"',
  );
  contains(
    between(
      javascript,
      "const openDateTimeProperties = () =>",
      "const setupSystemTray = () =>",
    ),
    "wide: true",
  );
});
test("date time properties matches the XP tabbed applet", () => {
  const applet = between(
    javascript,
    "const openDateTimeProperties = () =>",
    "const setupSystemTray = () =>",
  );
  contains(
    applet,
    '"Date & Time"',
    '"Time Zone"',
    '"Internet Time"',
    '"datetime-analog-clock"',
    '"assets/xp/TimeZoneMap.png"',
    "applyButton.disabled = true",
  );
  expect(css).toMatch(
    /\.datetime-dialog\s*\{[^}]*width:\s*min\(404px,[^}]*height:\s*min\(345px/s,
  );
});
test("Control Panel uses the XP category-view Explorer shell", () => {
  contains(
    javascript,
    'title: "Control Panel"',
    'const openControlPanel = () => openSystemWindow("__control-panel")',
    '"Appearance and Themes"',
    '"Network and Internet Connections"',
    '"Date, Time, Language, and Regional Options"',
    '"Performance and Maintenance"',
    '"Security Center"',
    '"Switch to Classic View"',
  );
  for (const icon of [
    "AppearanceAndThemes.png",
    "NetworkAndInternet.png",
    "PerformanceAndMaintenance.png",
    "SecurityCenter.png",
  ]) {
    expect(javascript).toContain(`assets/xp/icons/${icon}`);
  }
  contains(css, ".control-panel-content", ".control-panel-categories");
});

test("Control Panel Classic View uses the native XP applet grid", () => {
  contains(
    javascript,
    "const classicItems = [",
    "Accessibility Options",
    "Add Hardware",
    "Administrative Tools",
    "Automatic Updates",
    "Game Controllers",
    "Internet Options",
    "Network Setup Wizard",
    "Scanners and Cameras",
    "Taskbar and Start Menu",
    "Wireless Network Setup Wizard",
    "const renderClassicItems = () =>",
  );
  expect(css).toMatch(
    /\.control-panel-content\.classic-view \.control-panel-categories\s*\{[^}]*grid-template-columns:\s*repeat\(7, 75px\)/s,
  );
  contains(
    javascript,
    'action === "programs"',
    'openSystemWindow("__add-remove-programs")',
    'action === "users"',
    'openSystemWindow("__user-accounts")',
  );
});

test("Internet Properties matches the seven-tab XP applet", () => {
  contains(
    javascript,
    'const openInternetProperties = (initialTab = "general") =>',
    'title: "Internet Properties"',
    'data-internet-panel="general"',
    'data-internet-panel="security"',
    'data-internet-panel="privacy"',
    'data-internet-panel="content"',
    'data-internet-panel="connections"',
    'data-internet-panel="programs"',
    'data-internet-panel="advanced"',
    "Temporary Internet files",
    "Days to keep pages in history:",
    "assets/xp/system/InternetHomePage.png",
    "assets/xp/system/TemporaryInternetFiles.png",
    "assets/xp/system/InternetHistory.png",
    "assets/xp/system/InternetZone.png",
    "assets/xp/system/PrivacySettings.png",
    "assets/xp/system/PopUpBlocker.png",
    "assets/xp/system/InternetPrograms.png",
    "openInternetProperties();",
  );
  contains(css, ".internet-properties-dialog", ".internet-properties-tabs");
});

test("Mouse Properties matches the five-tab XP applet", () => {
  contains(
    javascript,
    'const openMouseProperties = (initialTab = "buttons") =>',
    'title: "Mouse Properties"',
    'data-mouse-panel="buttons"',
    'data-mouse-panel="pointers"',
    'data-mouse-panel="pointer-options"',
    'data-mouse-panel="wheel"',
    'data-mouse-panel="hardware"',
    "Switch primary and secondary buttons",
    "Double-click speed",
    "Turn on ClickLock",
    "Windows Default (system scheme)",
    "Enhance pointer precision",
    "One screen at a time",
    "HID-compliant mouse",
    "assets/xp/system/MouseButtonConfiguration.png",
    "assets/xp/system/MouseMotion.png",
    "assets/xp/system/MouseWheel.png",
    "assets/xp/system/MouseDevice.png",
    "assets/xp/system/cursors/NormalSelect.png",
    "assets/xp/system/cursors/WorkingInBackground.png",
    "openMouseProperties();",
  );
  contains(css, ".mouse-properties-dialog", ".mouse-properties-tabs");
});

test("Keyboard Properties matches the two-tab XP applet", () => {
  contains(
    javascript,
    'const openKeyboardProperties = (initialTab = "speed") =>',
    'title: "Keyboard Properties"',
    'data-keyboard-panel="speed"',
    'data-keyboard-panel="hardware"',
    "Character repeat",
    "Repeat delay:",
    "KeyboardRepeatDelay.png",
    "KeyboardRepeatRate.png",
    "assets/xp/system/KeyboardDevice.png",
    "Repeat rate:",
    "Cursor blink rate",
    "openKeyboardProperties();",
  );
  contains(css, ".keyboard-properties-dialog", ".keyboard-properties-tabs");
});

test("Game Controllers matches the native XP applet and child dialogs", () => {
  contains(
    javascript,
    "const openGameControllers = () =>",
    'title: "Game Controllers"',
    "Installed game controllers",
    "Controller</span><span>Status",
    "openAddGameController(addController)",
    'title: "Add Game Controller"',
    "2-axis, 2-button joystick",
    "Enable rudders and pedals",
    'title: "Advanced Settings"',
    "Preferred device:",
    "openGameControllers();",
  );
  contains(
    css,
    ".game-controllers-dialog",
    ".add-game-controller-dialog",
    ".game-controller-advanced-dialog",
  );
});

test("Power Options matches the four-tab native XP applet", () => {
  contains(
    javascript,
    'const openPowerOptions = (initialTab = "power-schemes") =>',
    'title: "Power Options Properties"',
    'data-power-panel="power-schemes"',
    'data-power-panel="advanced"',
    'data-power-panel="hibernate"',
    'data-power-panel="ups"',
    "Home/Office Desk",
    "Prompt for password when computer resumes from standby",
    "Enable hibernation",
    "Uninterruptible Power Supply",
    "PowerHibernate.png",
    "PowerUpsStatus.png",
    "PowerUpsDetails.png",
    "SystemWarning.png",
    "openPowerOptions();",
  );
  contains(css, ".power-options-dialog", ".power-options-tabs");
});

test("Regional and Language Options matches the native three-tab applet", () => {
  contains(
    javascript,
    'const openRegionalLanguageOptions = (initialTab = "regional-options") =>',
    'title: "Regional and Language Options"',
    'data-regional-panel="regional-options"',
    'data-regional-panel="languages"',
    'data-regional-panel="advanced"',
    "Standards and formats",
    "Supplemental language support",
    "Language for non-Unicode programs",
    "Code page conversion tables",
    'openRegionalLanguageOptions("languages");',
    "openRegionalLanguageOptions();",
  );
  contains(css, ".regional-language-dialog", ".regional-language-tabs");
});

test("Appearance and Themes uses the native XP category page and routes", () => {
  contains(
    javascript,
    "const renderAppearanceCategory = () =>",
    '"Appearance and Themes"',
    "Pick a task...",
    "Change the computer's theme",
    "Change the desktop background",
    "Choose a screen saver",
    "Change the screen resolution",
    "or pick a Control Panel icon",
    "assets/xp/icons/Display.png",
    "assets/xp/icons/FolderOptions.png",
    "assets/xp/icons/TaskbarAndStartMenu.png",
    'openDisplayTab("desktop")',
    'openDisplayTab("saver")',
    'openDisplayTab("settings")',
    "openTaskbarProperties();",
  );
  contains(
    css,
    ".control-panel-category-heading",
    ".control-panel-task-links",
    ".control-panel-category-icons",
  );
});

test("Performance and Maintenance uses the native XP category page", () => {
  contains(
    javascript,
    "const renderPerformanceCategory = () =>",
    '"Performance and Maintenance"',
    "See basic information about your computer",
    "Adjust visual effects",
    "Free up space on your hard disk",
    "Back up your data",
    "Rearrange items on your hard disk to make programs run faster",
    "Administrative Tools",
    "Power Options",
    "Scheduled Tasks",
    "assets/xp/icons/System.png",
    'data-control-panel-action="system-restore"',
    "openSystemProperties();",
  );
  contains(
    css,
    ".control-panel-category-page",
    ".control-panel-task-links",
    ".control-panel-category-icons",
  );
});

test("Accessibility Options uses the native XP category page", () => {
  contains(
    javascript,
    "const renderAccessibilityCategory = () =>",
    "Adjust the contrast for text and colors on your screen",
    "Configure Windows to work for your vision, hearing, and mobility needs",
    "assets/xp/icons/Magnifier.png",
    "assets/xp/icons/OnScreenKeyboard.png",
    'data-control-panel-action="accessibility-options"',
    'const openAccessibilityOptions = (initialTab = "keyboard") =>',
    'data-accessibility-panel="keyboard"',
    'data-accessibility-panel="sound"',
    'data-accessibility-panel="display"',
    'data-accessibility-panel="mouse"',
    'data-accessibility-panel="general"',
    "cursor-slider cursor-blink",
  );
  contains(css, ".accessibility-options-dialog", ".accessibility-tabs");
});

test("Sounds Speech and Audio Devices uses the native XP category page", () => {
  contains(
    javascript,
    "const renderSoundsCategory = () =>",
    "Adjust the system volume",
    "Change the sound scheme",
    "Change the speaker settings",
    "Accessibility Sound Options",
    "Advanced Volume Controls",
    "assets/xp/icons/SoundsAndAudioDevices.png",
    "assets/xp/icons/Speech.png",
    'openAccessibilityOptions("sound")',
    'const openSoundsAudioProperties = (initialTab = "volume") =>',
    'data-sounds-panel="volume"',
    'data-sounds-panel="sounds"',
    'data-sounds-panel="audio"',
    'data-sounds-panel="voice"',
    'data-sounds-panel="hardware"',
    "assets/xp/system/SpeakerSettings.png",
    "assets/xp/system/AudioRecording.png",
    "assets/xp/system/MidiPlayback.png",
  );
  contains(css, ".sounds-audio-properties-dialog", ".sounds-properties-tabs");
});

test("Date Time Language and Regional Options uses the native XP category page", () => {
  contains(
    javascript,
    "const renderDateRegionalCategory = () =>",
    "Change the date and time",
    "Change the format of numbers, dates, and times",
    "Add other languages",
    "assets/xp/icons/DateAndTime.png",
    "assets/xp/icons/RegionalAndLanguage.png",
    "openDateTimeProperties();",
  );
});

test("Network and Internet Connections uses the native XP category page", () => {
  contains(
    javascript,
    "const renderNetworkCategory = () =>",
    "Set up or change your Internet connection",
    "Create a connection to the network at your workplace",
    "Set up or change your home or small office network",
    "Set up a wireless network for a home or small office",
    "Change Windows Firewall settings",
    "assets/xp/icons/InternetOptions.png",
    "assets/xp/icons/NetworkConnections.png",
    "assets/xp/icons/NetworkSetupWizard.png",
    "assets/xp/icons/WindowsFirewall.png",
    "assets/xp/icons/WirelessNetworkSetupWizard.png",
    "assets/xp/icons/MyNetworkPlacesSmall.png",
    "assets/xp/icons/PrintersAndFaxesSmall.png",
    "assets/xp/icons/RemoteDesktop.png",
    "assets/xp/icons/PhoneAndModemOptions.png",
    "Home or Small Office Networking",
    "Network Diagnostics",
    "network: renderNetworkCategory",
  );
  contains(css, ".network-category-icons");
});

test("Printers and Other Hardware uses the native XP category page", () => {
  contains(
    javascript,
    "const renderHardwareCategory = () =>",
    "View installed printers or fax printers",
    "Add a printer",
    "assets/xp/icons/GameControllers.png",
    "assets/xp/icons/Keyboard.png",
    "assets/xp/icons/Mouse.png",
    "assets/xp/icons/PhoneAndModemOptionsLarge.png",
    "assets/xp/icons/PrintersAndFaxesLarge.png",
    "assets/xp/icons/ScannersAndCameras.png",
    "assets/xp/icons/AddHardwareSmall.png",
    "assets/xp/icons/DisplaySmall.png",
    "assets/xp/icons/SoundsAudioSmall.png",
    "assets/xp/icons/PowerOptionsSmall.png",
    "assets/xp/icons/SystemSmall.png",
    "printers: renderHardwareCategory",
  );
  contains(css, ".hardware-category-icons");
});

test("Windows Security Center uses the native XP status dashboard", () => {
  contains(
    javascript,
    '"__security-center"',
    "const createSecurityCenterContent = () =>",
    "Security essentials",
    "Firewall",
    "Automatic Updates",
    "Virus Protection",
    "CHECK SETTINGS",
    "NOT FOUND",
    "Manage security settings for:",
    "assets/xp/system/SecurityHelp.png",
    "assets/xp/system/SecurityFirewall.png",
    "assets/xp/system/SecurityAutomaticUpdates.png",
    "assets/xp/system/SecurityVirusProtection.png",
    "assets/xp/system/SecurityStatusGreen.png",
    "assets/xp/system/SecurityStatusYellow.png",
    "assets/xp/system/SecurityStatusRed.png",
    "assets/xp/system/SecurityCenterHeader.png",
    'security: () => openSystemWindow("__security-center")',
  );
  contains(
    css,
    ".security-center-content",
    ".security-center-header",
    ".security-center-resources",
    ".security-status",
    ".security-virus",
  );
});

test("Folder Options matches the four-tab XP shell applet", () => {
  contains(
    javascript,
    "const openFolderOptions = () =>",
    'title: "Folder Options"',
    'data-folder-options-tab="general"',
    'data-folder-options-tab="view"',
    'data-folder-options-tab="file-types"',
    'data-folder-options-tab="offline"',
    "Show common tasks in folders",
    "Advanced settings:",
    "Registered file types:",
    "Fast User Switching is enabled on this computer.",
    "assets/xp/icons/FolderViewClassic.png",
    "assets/xp/system/FolderBrowse.png",
    "assets/xp/system/FolderClickItems.png",
    "assets/xp/system/FolderViews.png",
    "assets/xp/system/FolderTree.png",
    "assets/xp/icons/OfflineFiles.png",
  );
  contains(
    css,
    ".folder-options-dialog",
    ".folder-options-panel",
    ".folder-advanced-list",
    ".folder-file-types-list",
    ".folder-offline-panel",
  );
});

test("User Accounts uses the native XP task page and account pictures", () => {
  contains(
    javascript,
    'title: "User Accounts"',
    "const createUserAccountsContent = () =>",
    'openSystemWindow("__user-accounts")',
    "Pick a task...",
    "Change an account",
    "Create a new account",
    "Change the way users log on or off",
    "or pick an account to change",
    "UserAdministrator.bmp",
    "UserGuest.bmp",
    "Computer administrator",
    "Guest account is off",
    "Pick an account to change",
    "What do you want to change about your<br>account?",
    "Do you want to turn on the guest account?",
    "Turn On the Guest Account",
    "Name the new account",
    "Select logon and logoff options",
    "Use Fast User Switching",
  );
  contains(
    css,
    ".user-accounts-content",
    ".user-accounts-toolbar",
    ".user-accounts-sidebar",
    ".user-account-choices",
    ".user-accounts-main.user-accounts-subpage",
    ".user-account-picker",
    ".user-account-administrator",
    ".user-account-guest",
    ".user-account-create",
    ".user-account-logon",
  );
});

test("Add or Remove Programs matches the XP appwiz shell", () => {
  contains(
    javascript,
    'title: "Add or Remove Programs"',
    "const createAddRemoveProgramsContent = () =>",
    'openSystemWindow("__add-remove-programs")',
    "Currently installed programs:",
    "Change or<br>Remove<br>Programs",
    "Add New<br>Programs",
    "Add/Remove<br>Windows<br>Components",
    "Set Program<br>Access and<br>Defaults",
    "assets/xp/system/ChangeRemovePrograms.png",
    "assets/xp/system/AddNewPrograms.png",
    "assets/xp/system/AddRemoveWindowsComponents.png",
    "assets/xp/system/ProgramAccessDefaults.png",
    'title: "Windows XP Setup"',
  );
  contains(
    css,
    ".add-remove-programs-content",
    ".add-remove-programs-nav",
    ".add-remove-programs-list",
    ".program-defaults-list",
  );
});
test("desktop renders system places then virtual files", () => {
  const desktop = javascript.indexOf("const buildDesktopIcons = () =>");
  const start = javascript.indexOf("const entries = [", desktop);
  const entries = javascript.slice(
    start,
    javascript.indexOf("entries.forEach", start),
  );
  expect(entries.indexOf("desktopItems.map")).toBeLessThan(
    entries.indexOf(".getChildren(fs.DESKTOP)"),
  );
  expect(entries.indexOf(".getChildren(fs.DESKTOP)")).toBeLessThan(
    entries.indexOf("recycleBinItems.map"),
  );
  expect(javascript).toMatch(/fs\s*\.getChildren\(fs\.DESKTOP\)/);
  contains(javascript, "fileOps = window.FileOperations");
});
test("game file sync preserves user files and moved shortcuts", () => {
  const block = between(
    javascript,
    "const syncGameFiles = () =>",
    'fs.registerFileType(".game"',
  );
  contains(block, "fs.findByApp(gameId)");
  absent(block, "fs.destroy(", "fs.rename(");
});
test("legacy game icon positions migrate to VFS ids", () => {
  const block = between(
    javascript,
    "const getDesktopIconPositions = () =>",
    "const saveDesktopIconPosition",
  );
  contains(
    block,
    "positions[node.id] = positions[node.app]",
    "delete positions[node.app]",
    'writeJsonStorage("desktopIconPositions", positions)',
  );
});
test("recycle bin defaults to bottom right", () => {
  const match = javascript.match(
    /icon\.dataset\.desktopId === "__recycle-bin"\) \{(.*?)\}/s,
  );
  expect(match).not.toBeNull();
  contains(
    match![1],
    "fallbackLeft = container.clientWidth",
    "fallbackTop = container.clientHeight",
  );
});
test("desktop uses shared file operations and keyboard commands", () =>
  contains(
    javascript,
    "fileOps.copy(selectedFsIds)",
    "fileOps.cut(selectedFsIds)",
    "pasteIntoFolder(fs.DESKTOP)",
    "confirmRecycleDelete(selectedFsIds)",
    "beginDesktopRename(selectedFsIds[0])",
    'e.key === "F2"',
    'e.shiftKey && e.key === "F10"',
    'action === "new-folder"',
  ));
test("desktop context menu uses real submenus and safe multiselection", () => {
  js(
    'addDesktopSubmenu(menu, "Arrange Icons By"',
    'addDesktopSubmenu(menu, "New"',
    "child.style.left = `${-child.offsetWidth + 2}px`",
    'event.key === "ArrowRight"',
    'event.key === "ArrowLeft"',
    "const clampedX = Math.max(",
    "const clampedY = Math.max(",
    "-groupLeft",
    "-groupTop",
    "const getDesktopSelectionEligibility = () =>",
    "const movable = allFilesystem",
    "if (finished) return;",
    '"Show Desktop Icons", "show-icons"',
    '"Bitmap Image", "new-bitmap"',
    '"Upload from Computer...", "upload"',
  );
  contains(
    css,
    ".context-parent.open > .context-submenu",
    "#desktop-icons:not(:focus-within)",
  );
});
test("Recycle Bin desktop context menu matches Windows XP commands", () => {
  contains(
    javascript,
    'if (itemId === "__recycle-bin")',
    'addDesktopMenuItem(menu, "Open", "open", { defaultItem: true })',
    'addDesktopMenuItem(menu, "Explore", "explore")',
    '"Empty Recycle Bin", "empty-recycle-bin"',
    "disabled: !fs.getChildren(fs.RECYCLE_BIN).length",
    '"Create Shortcut", "create-recycle-shortcut"',
    '"Properties", "recycle-properties"',
    'fs.DESKTOP,\n        "Shortcut to Recycle Bin.game"',
    '{ app: "__recycle-bin" }',
    'fs.registerFileType("app:__recycle-bin"',
    "confirmEmptyRecycleBin()",
    "openShellProperties(fs.RECYCLE_BIN)",
  );
  contains(css, ".xp-context-menu button.context-default");
  contains(
    dialogs,
    "node.id === fs().RECYCLE_BIN",
    '"assets/xp/icons/RecyclerFull.png"',
    '"assets/xp/icons/RecyclerEmpty.png"',
  );
});
test("explorer and recycle bin use shared filesystem controls", () => {
  contains(
    javascript,
    "const navigateExplorer = (win, folderId",
    "const explorerBack = (win) =>",
    "const explorerForward = (win) =>",
    'class="explorer-menu-bar"',
    'data-explorer-action="back"',
    'data-explorer-action="forward"',
    'data-explorer-action="up"',
    'class="explorer-address"',
    'status.className = "explorer-status"',
    "fileOps.restore(ids)",
    "fileOps.permanentlyDelete(ids)",
    "fileOps.emptyRecycleBin()",
    'XP_ICON_PATHS["RecyclerFull.png"]',
    "getRecycleBinIconPath()",
  );
  contains(css, ".explorer-body", '.explorer-items[data-view="details"]');
  absent(css, ".recycle-full::before");
});
test("explorer item context menu supports normal and recycle commands", () =>
  contains(
    javascript,
    "const openExplorerContextMenu = (win, clientX, clientY)",
    'menu.setAttribute("role", "menu")',
    'add("Restore", "restore"',
    'add("Delete Permanently", "permanent"',
    'add("Open", "open"',
    'add("Cut", "cut"',
    'add("Rename", "rename"',
    'event.key === "Escape"',
    'event.key === "Enter"',
    '"ArrowUp", "ArrowDown", "Home", "End"',
    "openExplorerContextMenu(win, event.clientX, event.clientY)",
  ));
test("explorer menu bar has access keys and keyboard navigation", () =>
  contains(
    javascript,
    'file: "&File",',
    'edit: "&Edit",',
    "F&avorites",
    "button.dataset.accessKey = key",
    "event.altKey",
    '"ArrowLeft", "ArrowRight", "ArrowDown", "Home", "End"',
    'button.setAttribute("aria-expanded", "false")',
  ));
test("explorer menu clicks nested access key content and exposes edit commands", () =>
  contains(
    javascript,
    'event.target.closest("[data-explorer-menu]")',
    'event.target.closest("[data-explorer-command]")',
    'data-explorer-menu="edit"',
    "edit: [",
    "const protectedSelection = selected.some((id) => fs.isProtected(id))",
    'label: "Cut",',
    'action: "cut",',
    'label: "Copy",',
    'action: "copy",',
    'label: "Delete",',
    'if (command === "delete")',
    "selected.length !== 1 || protectedSelection",
    'label: "Select All", action: "select-all", shortcut: "Ctrl+A"',
    'label: "Help and Support Center", action: "help-center"',
    "const explorerSubmenus = {",
    '"arrange-icons": [',
    'event.key === "ArrowRight"',
    'event.key === "ArrowLeft"',
  ));
test("explorer task pane tracks current folder", async () => {
  contains(
    javascript,
    'class="explorer-section-label"',
    "const renderExplorerTaskPane = (win) =>",
    "win.currentFolderId === fs.MY_COMPUTER",
    "win.currentFolderId === fs.MY_PICTURES",
    "win.currentFolderId === fs.MY_MUSIC",
    '"System Tasks"',
    '"Picture Tasks"',
    '"Music Tasks"',
    '"File and Folder Tasks"',
    "body.replaceChildren()",
    '"View as a slide show"',
    '"Play all"',
    '"Make a new folder"',
    "renderExplorerTaskPane(win);",
  );
  for (const icon of [
    "MyPictures.png",
    "PrintersAndFaxes.png",
    "MyMusic.png",
    "NewFolder.png",
    "PublishToWeb.png",
    "SharedFolder.png",
  ])
    expect(await Bun.file(iconPath(icon)).exists()).toBe(true);
});
test("explorer matches XP task pane toolbar and drive groups", () => {
  contains(
    javascript,
    'class="explorer-section-toggle"',
    'placesBody.className = "explorer-section-body"',
    'content.classList.toggle("folders-visible")',
    'aria-pressed="false"',
    'data-explorer-action="go"',
    '"Files Stored on This Computer"',
    '"Hard Disk Drives"',
    '"Devices with Removable Storage"',
    '"Shared Documents"',
    '"Administrator\'s Documents"',
    '"3½ Floppy (A:)"',
    '"GRTMPVOL_EN (D:)"',
    'XP_ICON_PATHS["OpticalDrive.png"]',
    "node.id === fs.DRIVE_F",
    'className = "explorer-group-heading"',
    '"My Pictures",',
    '"MyPictures.png",',
    'src="assets/xp/icons/Back.png"',
    'src="assets/xp/WindowsFlag.png"',
  );
  contains(
    compact(css),
    ".explorer-toolbar-separator",
    ".explorer-content:not(.folders-visible) .explorer-tree-section",
    ".explorer-content.folders-visible .explorer-sidebar > section:not(.explorer-tree-section)",
    ".explorer-section-toggle",
    ".explorer-group-heading",
    "grid-template-columns: 211px minmax(0, 1fr)",
  );
});
test("Printers and Faxes uses the XP Explorer folder shell", () => {
  contains(
    javascript,
    "__printers: {",
    'title: "Printers and Faxes"',
    'content.className = "explorer-content printers-content"',
    'class="printers-body"',
    'data-printers-action="add"',
    'const openPrintersAndFaxes = () => openSystemWindow("__printers")',
    "const wirePrintersAndFaxes = (win) =>",
  );
  contains(
    css,
    ".printers-body",
    "grid-template-columns: 211px minmax(0, 1fr)",
  );
});
test("Help and Support Center uses the native XP home surface", () => {
  contains(
    javascript,
    "__help: {",
    'title: "Help and Support Center"',
    'content.className = "help-center-content"',
    'class="help-center-toolbar"',
    'class="help-center-search"',
    'class="help-center-home"',
    'const openHelpAndSupport = () => openSystemWindow("__help")',
    "const wireHelpAndSupport = (win) =>",
  );
  contains(
    css,
    ".help-center-content",
    ".help-center-toolbar",
    ".help-center-search",
    ".help-center-home",
    'url("../assets/xp/help/Toolbar.png")',
  );
});
test("About Windows uses the ISO shell32 banner and XP build copy", () => {
  contains(
    javascript,
    "const openAboutWindows = () =>",
    'src="assets/xp/AboutWindows.png"',
    "Version 5.1 (Build 2600.xpsp.080413-2111 : Service Pack 3)",
    "Physical memory available to Windows",
  );
  contains(
    css,
    ".about-windows-dialog",
    "width: min(418px",
    "height: min(354px",
  );
});
test("System Properties uses ISO artwork and native content for all seven tabs", () => {
  contains(
    javascript,
    "const openSystemProperties = () =>",
    'src="assets/xp/SystemProperties.png"',
    'data-system-tab="general"',
    'data-system-tab="computer-name"',
    'data-system-tab="hardware"',
    'data-system-tab="advanced"',
    'data-system-tab="restore"',
    'data-system-tab="updates"',
    'data-system-tab="remote"',
    'src="assets/xp/system/ComputerName.png"',
    'src="assets/xp/system/DeviceManager.png"',
    'src="assets/xp/system/DriverSigning.png"',
    'src="assets/xp/system/SystemRestore.png"',
    'src="assets/xp/system/UpdateShield.png"',
    'src="assets/xp/system/UpdateEnabled.png"',
    'src="assets/xp/system/UpdateDisabled.png"',
    'src="assets/xp/system/RemoteSettings.png"',
    'data-active-row="lower"',
    "].includes(tab.dataset.systemTab)",
    "Allow Remote Assistance invitations",
    "Select Remote Users...",
    'aliases: ["sysdm.cpl", "system properties"]',
  );
  contains(
    css,
    ".system-properties-dialog",
    "width: min(418px",
    "height: min(491px",
  );
});
test("shutdown dialog uses the native XP geometry and grayscale fade", () => {
  contains(
    css,
    "backdrop-filter: grayscale(1)",
    "width: min(313px, calc(100vw - 24px))",
    "margin-top: min(191px, calc(50vh - 96px))",
    ".shutdown-actions button",
    "transform: translateY(7px)",
    'url("../assets/xp/dialogs/ShutdownDialog.png")',
    'url("../assets/xp/dialogs/ShutdownIcons.png")',
  );
});
test("shell paste uses one conflict aware progress helper", () =>
  js(
    "const pasteIntoFolder = async (destinationId)",
    "fileOps.pasteWithConflicts(",
    'clipboard.mode === "cut" ? "Moving..." : "Copying..."',
    "Confirm File Replace",
    "pasteIntoFolder(win.currentFolderId)",
    "pasteIntoFolder(fs.DESKTOP)",
  ));
test("desktop drag moves into folders or the Recycle Bin without a modifier", () => {
  const block = between(
    javascript,
    "const findDesktopDropTarget = (clientX, clientY, draggedIds) =>",
    "const wireDesktopSelectionRectangle = () =>",
  );
  contains(
    block,
    "const eligibility = getDesktopSelectionEligibility()",
    '"[data-drop-action], [data-drop-destination-id]"',
    'target.dataset.dropAction === "recycle"',
    "dropTarget = eligibility.movable",
    'upEvent.type === "pointerup"',
    'dropTarget.action === "recycle"',
    "fileOps.removeToBin(eligibility.filesystemIds)",
    "fileOps.cut(eligibility.filesystemIds)",
    "await pasteIntoFolder(dropTarget.destinationId)",
    "saveDesktopIconPosition(item)",
  );
  contains(
    javascript,
    'if (id === "__recycle-bin") icon.dataset.dropAction = "recycle"',
  );
  absent(block, "event.altKey", "Alt+drag");
});
test("desktop rename commits on an outside pointer press", () => {
  const block = between(
    javascript,
    "const beginDesktopRename = (id) =>",
    "const addDesktopMenuItem = (",
  );
  contains(
    block,
    "if (!input.contains(event.target)) finish(true)",
    'document.addEventListener("pointerdown", onOutsidePointerDown, true)',
    'document.removeEventListener("pointerdown", onOutsidePointerDown, true)',
    'if (event.key === "Enter" || event.key === "Escape")',
    "event.stopPropagation()",
    'finish(event.key === "Enter")',
  );
});
test("start menu contains only XP places", () => {
  const places = between(
    javascript,
    "const buildPlaces = () =>",
    "const buildPinnedPrograms = () =>",
  );
  absent(
    places,
    "Astro Flash Settings",
    'id: "settings"',
    "Send suggestions",
    "games installed",
    "separatorTwo",
  );
  contains(
    javascript,
    '"__astro-settings"',
    'if (itemId === "__astro-settings")',
  );
});
test("every start destination has a functional route", () => {
  const places = between(
    javascript,
    "const startDestinationActions = {",
    "const buildPinnedPrograms = () =>",
  );
  for (const action of [
    "documents",
    "recent",
    "pictures",
    "music",
    "computer",
    "controlPanel",
    "printers",
    "help",
    "search",
    "run",
  ])
    expect(places).toMatch(new RegExp(`${action}: .+(?:,|\\n)`));
  contains(
    places,
    "item.dataset.startAction = id",
    "item.title = XPDialogs.parseAccessKey(title).text",
    "setAccessKeyText(text, label)",
    "closeStartMenu();",
    "startDestinationActions[id]();",
    "MyDocuments.png",
    "RecentDocuments.png",
    "MyPictures.png",
    "MyMusic.png",
    "MyComputer.png",
    "ControlPanel.png",
    "PrintersAndFaxes.png",
    "HelpAndSupport.png",
    "Search.png",
    "Run.png",
  );
});
test("start search and run open their own dialogs", () => {
  const places = between(
    javascript,
    "const openSearchDialog = () =>",
    "const buildPinnedPrograms = () =>",
  );
  contains(
    places,
    'openSystemWindow("__search")',
    'title: "Run"',
    'XPDialogs.openFile({ title: "Browse" })',
    "resolveShellCommand(input.value)",
    "rememberRunCommand(input.value)",
    'setAccessKeyText(promptText, "&Open:")',
    'dialog.el.classList.add("run-dialog")',
    'icon.src = "assets/xp/icons/Run.png"',
    'dialog.accessKeys.set("o"',
    "XPDialogs.parseAccessKey(label)",
  );
  contains(css, "width: min(346px, calc(100vw - 8px))", "bottom: 35px");
  contains(javascript, "const openAllPrograms");
  absent(
    places,
    'search.addEventListener("click", () => {\n        openAllPrograms()',
  );
});
test("game files use Windows compatible names", () =>
  js(
    "const gameFileName = (gameId) =>",
    '.replace(/[<>:"/',
    ".trim()}.game",
    "fs.createFile(fs.DESKTOP, gameFileName(gameId)",
  ));
test("all programs uses separate cascading flyouts", () => {
  contains(html, 'id="start-menu-flyouts"');
  absent(html, 'id="game-search"');
  contains(
    javascript,
    "const getProgramGroups = () =>",
    "const positionStartFlyout =",
    'document.getElementById("taskbar")?.getBoundingClientRect().top',
    "const openProgramsFolder =",
    "start-program-flyout",
    "start-program-folder",
    "setTimeout(open, 220)",
    'event.key === "ArrowRight"',
    'event.key === "Escape"',
    'e.target.closest("#start-menu-flyouts")',
    "const getUniqueCategoryMnemonics =",
    "setAccessKeyText(label, mnemonic)",
  );
});
test("favorite refresh does not depend on removed start search", () => {
  const block = between(
    javascript,
    "const toggleFavorite =",
    "const trackGamePlay =",
  );
  contains(block, "buildPinnedPrograms();", "openAllPrograms();");
  absent(block, "game-search");
});
test("search companion uses virtual filesystem filters and open actions", () =>
  contains(
    javascript,
    '"__search"',
    "const searchVirtualNodes =",
    "fs.MY_COMPUTER",
    'id="search-filename"',
    'id="search-location"',
    'id="search-type"',
    'class="explorer-chrome search-explorer-chrome"',
    'class="search-start-panel"',
    'src="assets/xp/SearchDog.bmp"',
    'data-search-kind="all"',
    'value="files"',
    'value="folders"',
    'value="games"',
    'value="applications"',
    "wireSearchCompanion(win)",
    "fs.open(result.node.id)",
    'const showForm = (kind = "all") =>',
    "const representedGameIds = new Set()",
    "!representedGameIds.has(id)",
  ));
test("project controls live in a taskbar window", () => {
  js(
    'shortcutId === "__astro-settings"',
    'content.className = "project-settings-content"',
    'openSystemWindow("__astro-settings")',
    "wireProjectSettings(win)",
    'const isProjectSettings = shortcutId === "__astro-settings"',
    'const isInternetGames = shortcutId === "__internet-games"',
    "? 540",
    "? 760",
    'role="tablist" aria-label="Astro Flash Settings"',
    ">General</button>",
    ">Offline</button>",
    ">Game Data</button>",
    ">Updates</button>",
    ">Recovery</button>",
    '"Connected to the internet"',
    '"Ready for offline use"',
    'data-project-action="manage-games"',
    "gameDataManager.list()",
    "gameLibrary.uninstall(",
    "gameDataManager.remove(",
    'data-internet-tab="installed"',
    "offlineManager.checkForUpdates()",
    "offlineManager.applyUpdate()",
    "offlineManager.repair()",
    "offlineManager.downloadGame(",
    "offlineManager.removeGame(",
    "offlineManager.downloadAllGames()",
    "offlineManager.removeAllGames()",
    ">Check for Updates</button>",
    ">Repair System Files</button>",
    ">Download All Games</button>",
    ">Remove Offline Games</button>",
    '"Offline download progress"',
    "state.downloadBytes",
    "state.downloadMetadataError",
    "formatProjectState(",
    '"https://github.com/astrovm/flash/issues"',
    'case "project": openProjectSettings();',
  );
  contains(css, ".project-settings-content");
  absent(
    javascript,
    'XPDialogs.createDialog({\n    title: "Astro Flash Collection"',
    'closeRow.className = "dlg-buttons"',
    'heading.textContent = "Astro Flash Collection"',
  );
  absent(css, "linear-gradient(135deg, transparent");
  contains(
    offlineJavascript,
    "navigatorObject.serviceWorker.register(",
    '{ updateViaCache: "none" }',
    '"updatefound"',
    '"controllerchange"',
    '{ type: "SKIP_WAITING" }',
    'cache: "no-store"',
    '"visibilitychange"',
    '"online"',
  );
  contains(
    workboxConfig,
    '"swf/**"',
    '"iframe/**"',
    '"dos/**"',
    '"js/*.wasm"',
    '"js/core.ruffle.*.js"',
    "dontCacheBustURLsMatching:",
    "importScripts: []",
    "skipWaiting: false",
    "clientsClaim: true",
  );
});
test("game controls share one compact menu row", () => {
  js(
    'quickActions.className = "game-quick-actions"',
    'quickFavoriteBtn.className = "quick-access-btn favorite-btn"',
    'quickVolumeBtn.className = "quick-access-btn volume-btn"',
    'fullscreenBtn.className = "quick-access-btn fullscreen-btn"',
    'menuBar.setAttribute("role", "toolbar")',
    'menuItems.setAttribute("role", "menubar")',
    'volumeSlider.className = "volume-slider game-volume-slider"',
    'volumeSlider.type = "range"',
    'win.volumeSlider.addEventListener("input"',
  );
  absent(javascript, "window-toolbar");
  contains(css, ".game-volume-slider");
});
test("startup screens have pointer and keyboard skip paths", () => {
  expect(elementById("boot-screen").attrs.role).toBe("button");
  expect(elementById("boot-screen").attrs.tabindex).toBe("0");
  js(
    'bootScreen.addEventListener("click", skipBootScreen)',
    'bootScreen.addEventListener("keydown"',
    '["Enter", " "].includes(event.key)',
    'getElementById("welcome-screen")',
    'addEventListener("click", (event)',
    'event.target.closest("#welcome-turn-off")',
    'addEventListener("keydown", (event)',
    "event.target !== event.currentTarget",
    'welcomeScreen.setAttribute("role", "button")',
    'welcomeScreen.setAttribute("tabindex", "0")',
    "const focusTarget = autoLogin ? welcomeScreen : loginUser",
    "focusTarget.focus({ preventScroll: true })",
    "requestAnimationFrame(() =>",
    "if (!welcomeScreen.hidden) focusTarget.focus",
  );
  expect(elementById("login-user").tag).toBe("button");
});
test("display properties has a validated persisted pending model", () => {
  js(
    'const DISPLAY_SETTINGS_KEY = "displaySettings"',
    "const isDisplaySettings = (value) =>",
    "const getDisplaySettings = () =>",
    "const saveDisplaySettings = (settings) =>",
    "const applyDisplaySettings = (settings) =>",
    "const wireDisplayProperties = (win) =>",
    "let pending = { ...current };",
    "controls.apply.disabled = JSON.stringify(pending) === JSON.stringify(current);",
  );
  contains(
    javascript,
    'data-display-action="apply"',
    'data-display-action="ok"',
    'data-display-action="cancel"',
    'class="display-wallpaper-list"',
    'class="display-color-button"',
    'el.classList.add("display-properties-window")',
    'helpBtn.className = "tb-btn help-btn"',
  );
});
test("display properties uses Windows XP desktop-tab geometry and labels", () => {
  contains(
    javascript,
    'data-wallpaper="none"><span class="wallpaper-icon none"></span>(None)',
    'class="display-customize">Customize Desktop...</button>',
    'class="display-status" aria-live="polite" hidden',
    'data-wallpaper="greenstone"',
    'data-wallpaper="windows-xp"',
    'data-wallpaper="zapotec"',
    "controls.status.hidden = !message",
  );
  expect(javascript).toMatch(/isDisplayProperties\s*\?\s*404/);
  expect(javascript).toMatch(/isDisplayProperties\s*\?\s*454/);
  absent(javascript, 'controls.status.textContent = "Settings applied."');
  contains(
    css,
    "grid-template-columns: minmax(0, 1fr) 73px",
    "width: 354px",
    "width: 189px",
    "height: 170px",
    "width: 162px",
    "height: 120px",
    "min-width: 75px",
    "height: 23px",
  );
});
test("display properties exposes all tabs and safe wallpaper controls", () => {
  for (const tab of ["themes", "desktop", "saver", "appearance", "settings"])
    contains(javascript, `display-tab-${tab}`, `display-panel-${tab}`);
  contains(
    javascript,
    'accept="image/png,image/jpeg,image/gif,image/webp"',
    'reader.result.startsWith("data:image/")',
    'wallpaperList.addEventListener("keydown"',
    'item.scrollIntoView({ block: "nearest" })',
    'event.key === "ArrowDown"',
    'class="display-theme-sample"',
    'class="display-saver-monitor"',
    'class="appearance-message"',
    'class="display-settings-groups"',
    "const openDesktopItemsDialog =",
    "const openDisplayEffectsDialog =",
    "const openAdvancedAppearanceDialog =",
    'querySelector(".advanced-appearance-preview").dataset.appearance',
    'querySelector("[data-advanced-color]").value',
    "const openMonitorPropertiesDialog =",
    "const openWallpaperBrowseDialog =",
    'title: "Desktop Items"',
    'title: "Effects"',
    'title: "Advanced Appearance"',
    'title: "(Default Monitor) and Properties"',
    'data-monitor-tab="adapter"',
    'data-monitor-panel="adapter"',
    'tab.addEventListener("click", () => selectTab(tab))',
    'event.key === "ArrowRight"',
    'title: "Browse"',
    'data-system-icon="__my-documents"',
    'data-system-icon="__my-computer"',
    "saveDesktopSystemIcons(next)",
    "buildDesktopIcons()",
    "const syncWallpaperScrollbar =",
    'wallpaperScroller.addEventListener("scroll", syncWallpaperScrollbar)',
    "wallpaperScrollThumb.style.transform = `translateY(${thumbTop}px)`",
    'wallpaperScrollThumb.addEventListener("pointerdown"',
    "wallpaperScroller.scrollBy({ top: -18 })",
    "const scheduleScreenSaver =",
    'id = "screen-saver-overlay"',
    "settings.screenSaverWait * 60 * 1000",
    "requireLoginOnResume: false",
    'transitionEffect: "fade"',
    'fontSmoothing: "standard"',
    'id="display-resolution-slider"',
    'event.key === "Home"',
    'event.key === "End"',
    "display-resolution-preview",
    "controls.resolutionPreview.dataset.resolution = pending.resolution",
    "const applySimulatedMonitor = (resolution, { reflow = true } = {}) =>",
    "const SIMULATED_RESOLUTIONS",
    "desktop.dataset.monitorLimited",
    "resolutionPreviewActive",
    "let resolutionPreviewSnapshot = null",
    "snapshotWindowState()",
    "restoreWindowState(resolutionPreviewSnapshot)",
    "rollbackResolutionPreview",
    "applySimulatedMonitor(activeMonitorResolution)",
  );
  contains(
    css,
    '#desktop[data-wallpaper-position="tile"]',
    "overflow-y: auto",
    "scrollbar-width: none",
    ".scroll-track",
    "touch-action: none",
    ".desktop-items-dialog",
    ".desktop-icon-choices",
    ".monitor-property-panel[hidden]",
    'html[data-xp-appearance="olive"]',
    "#desktop[data-monitor-resolution]",
  );
  absent(
    javascript,
    "MAX_CUSTOM_WALLPAPER_BYTES",
    "file.size >",
    "smaller than 1 MB",
    'data-appearance="${settings.appearance}"',
    'value="${settings.backgroundColor}"',
  );
});
test("simulated monitor bounds common resolutions and narrow viewports", () =>
  contains(
    javascript,
    '"800x600": { width: 800, height: 600 }',
    '"1024x768": { width: 1024, height: 768 }',
    "width: Math.min(requested.width, window.innerWidth)",
    "height: Math.min(requested.height, window.innerHeight)",
    "desktop.style.height = `${Math.max(1, monitor.height - TASKBAR_HEIGHT)}px`",
    "taskbar.style.width = `${monitor.width}px`",
    "keepWindowsInWorkArea();",
    "layoutDesktopIcons();",
    "delete desktop.dataset.monitorLimited",
  ));
test("desktop icons use compact metrics and non-overlapping overflow", () => {
  js(
    "compact: { width: 60, height: 58, gap: 4, margin: 4 }",
    "const getDesktopIconMetrics",
    "container.clientWidth <= 480",
    "const overflowsViewport = icons.length > columns * rows",
    'container.classList.toggle("desktop-icons-overflow"',
    "overflowsViewport ? index % columns",
    "getDesktopIconMetrics(container)",
  );
  contains(
    css,
    "#desktop-icons.desktop-icons-overflow",
    "@media (max-width: 480px)",
    "width: 60px",
  );
});
test("desktop game labels hide virtual extension", () =>
  contains(
    javascript,
    'node.ext === ".game"',
    "node.name.slice(0, -node.ext.length)",
  ));
test("desktop games use natural title order", () =>
  contains(
    javascript,
    "const desktopNodeSortName =",
    'node.ext === ".game" ? node.name.slice(0, -node.ext.length) : node.name',
    "numeric: true",
    'sensitivity: "base"',
  ));
test("anchored recycle bin does not consume an early grid slot", () => {
  const entries = javascript.indexOf("const entries = [");
  const files = javascript.indexOf(".getChildren(fs.DESKTOP)", entries);
  const recycle = javascript.indexOf("...recycleBinItems.map", entries);
  expect(files).toBeLessThan(recycle);
});
test("taskbar keeps overflow windows reachable", () => {
  contains(html, 'id="taskbar-overflow-menu"');
  js(
    "--task-button-min-width",
    "const contentWidth = Math.max(",
    "container.clientWidth -",
    "const overflowMinWidth",
    "contentWidth - overflowMinWidth - taskGap",
    "const appendTaskButton = ([gameId, win]) =>",
    "const appendWindowItem = ([gameId, win]) =>",
    'overflow.className = "task-button task-button-grouped"',
    'overflow.setAttribute("aria-haspopup", "menu")',
    "Windows Explorer (${explorerWindows.length})",
  );
  absent(javascript, "const appendTaskButton = ([win, gameId]) =>");
});
test("taskbar attention and lock state are explicit", () => {
  contains(
    javascript,
    "const setWindowAttention =",
    "window.XPShell = Object.assign",
    "win.needsAttention = false",
    "hiddenNeedsAttention",
    "taskbar-overflow-item",
  );
  contains(
    css,
    ".task-button.needs-attention",
    ".taskbar-overflow-item.needs-attention",
  );
  contains(
    compact(html),
    'role="menuitemcheckbox" aria-checked="true" data-taskbar-action="lock"',
  );
  contains(javascript, "const setTaskbarLocked =", "!taskbarLocked");
});
test("taskbar supports window and taskbar context menus", () => {
  contains(
    javascript,
    'btn.addEventListener("contextmenu"',
    "openWindowSystemMenu(win, event.clientX, event.clientY)",
    "const setupTaskbarContextMenu = () =>",
    "const toggleShowDesktop = () =>",
    "let showDesktopSnapshot = null",
  );
  contains(
    html,
    "Cascade Windows",
    "Tile Windows Horizontally",
    "Tile Windows Vertically",
    "Show the Desktop",
    "Task Manager",
    "Quick Launch",
    "New Toolbar...",
    "Lock the Taskbar",
    "Properties",
  );
});
test("Taskbar and Start Menu Properties uses the native XP previews and tabs", () => {
  contains(
    javascript,
    'title: "Taskbar and Start Menu Properties"',
    'src="assets/xp/system/TaskbarPreview.png"',
    'src="assets/xp/system/NotificationAreaPreview.png"',
    'src="assets/xp/system/StartMenuPreview.png"',
    'data-taskbar-properties-tab="taskbar"',
    'data-taskbar-properties-tab="start-menu"',
    "Group similar taskbar buttons",
    "Classic Start menu",
    'document.getElementById("taskbar-clock").hidden',
  );
  contains(
    css,
    ".taskbar-properties-dialog",
    "width: min(403px",
    "height: min(454px",
  );
});

test("Windows Task Manager matches the five-tab XP application", () => {
  contains(
    javascript,
    "const openTaskManager = () =>",
    'title: "Windows Task Manager"',
    "assets/xp/icons/TaskManager.png",
    'data-task-manager-tab="applications"',
    'data-task-manager-tab="processes"',
    'data-task-manager-tab="performance"',
    'data-task-manager-tab="networking"',
    'data-task-manager-tab="users"',
    "No Active Network Adapters Found.",
    "Commit Charge: 81M / 1249M",
    'data-task-manager-action="new-task"',
    'data-task-manager-action="end-task"',
    'data-task-manager-action="switch-to"',
  );
  contains(
    css,
    ".task-manager-dialog",
    ".task-manager-menu-bar",
    ".task-manager-process-list",
    ".task-manager-graph",
    ".task-manager-status",
  );
});
test("taskbar keyboard and state styles are present", () => {
  js('taskButton && ["ArrowLeft", "ArrowRight", "Home", "End"]');
  contains(javascript, "const wireTaskbarMenuKeyboard = (menu) =>");
  contains(
    css,
    ".task-button:focus-visible",
    '.task-button[aria-pressed="true"]',
  );
});
test("shell keyboard router covers window switching and file shortcuts", () =>
  js(
    "const cycleShellWindow =",
    "const getMruWindows =",
    "window-switcher",
    'e.altKey && e.key === "Tab"',
    'e.altKey && e.key === "Escape"',
    'e.altKey && e.key === "F4" && !focusedGameId',
    'e.shiftKey && e.key === "F10"',
    "isEditableTarget",
    "xp-dialog-overlay",
    "fileOps.permanentlyDelete(selected)",
    "pasteIntoFolder(explorerWin.currentFolderId)",
    ".system-dialog-overlay:not([hidden])",
    "altTabIndex = windows.findIndex",
    "if (!showSwitcher) altTabIndex = order.findIndex",
    "altTabIndex = 0;",
  ));
test("desktop folders and menus cycle matching items by first letter", () => {
  contains(html, 'id="desktop-icons" tabindex="0"');
  js(
    "const typeaheadState = new WeakMap()",
    "const cycleTypeaheadItem =",
    "document.activeElement === previous.target",
    "matches[(matches.indexOf(previous.target) + 1) % matches.length]",
    "event.stopImmediatePropagation()",
    "selectDesktopIcon(typeaheadTarget.dataset.desktopId)",
    'document.activeElement?.closest?.(".explorer-items")',
    'typeaheadTarget.classList.add("selected")',
    "items.tabIndex = 0",
  );
  contains(css, "#desktop-icons", "outline: none", ".explorer-items:focus");
});
test("show desktop restores focus and resize reflows tasks", () => {
  contains(javascript, "focusedGameId,", "showDesktopSnapshot.windows.forEach");
  contains(
    between(
      javascript,
      'window.addEventListener("resize"',
      'window.addEventListener("hashchange"',
    ),
    "renderTaskButtons();",
  );
});
test("screen saver is rescheduled for every login", () => {
  const login = between(
    javascript,
    "const login = (playSound = true) =>",
    "const setupScreenFlow = () =>",
  );
  expect(login.indexOf("loggedIn = true")).toBeLessThan(
    login.indexOf("applyDisplaySettings"),
  );
  expect(login.lastIndexOf("scheduleScreenSaver();")).toBeGreaterThan(
    login.indexOf("if (!shellInitialized)"),
  );
});
test("start destinations have working access keys", () =>
  contains(
    javascript,
    "item.dataset.accessKey = key",
    '`[data-access-key="${event.key.toLowerCase()}"]`',
  ));
test("start menu footer has only XP power actions", () => {
  const footer = html.match(/<div class="start-menu-footer">(.*?)<\/div>/s);
  expect(footer).not.toBeNull();
  contains(footer![1], 'id="log-off-button"', 'id="turn-off-button"');
  absent(footer![1], "<h6");
});
