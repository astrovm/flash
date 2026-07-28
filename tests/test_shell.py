import re
import unittest
from html.parser import HTMLParser
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
INDEX_HTML = PROJECT_DIR / "docs" / "index.html"
MAIN_JS = PROJECT_DIR / "docs" / "js" / "main.js"
MAIN_CSS = PROJECT_DIR / "docs" / "css" / "main.css"


class _EnabledDesktopActionsParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_desktop_menu = False
        self.actions = set()

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if attributes.get("id") == "desktop-context-menu":
            self.in_desktop_menu = True
        if (
            self.in_desktop_menu
            and tag == "button"
            and "disabled" not in attributes
            and attributes.get("data-action")
        ):
            self.actions.add(attributes["data-action"])

    def handle_endtag(self, tag):
        if self.in_desktop_menu and tag == "div":
            self.in_desktop_menu = False


class _ElementByIdParser(HTMLParser):
    """Collects (tag, attrs) for elements carrying any of the given ids."""

    def __init__(self, ids):
        super().__init__()
        self.ids = set(ids)
        self.elements = {}

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        element_id = attributes.get("id")
        if element_id in self.ids:
            self.elements[element_id] = (tag, attributes)


class ShellSourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = INDEX_HTML.read_text(encoding="utf-8")
        cls.javascript = MAIN_JS.read_text(encoding="utf-8")
        cls.css = MAIN_CSS.read_text(encoding="utf-8")

    def test_every_enabled_desktop_menu_action_has_a_handler(self):
        parser = _EnabledDesktopActionsParser()
        parser.feed(self.html)
        handled_actions = set(
            re.findall(r'action === "([^"]+)"', self.javascript)
        )
        self.assertEqual(parser.actions - handled_actions, set())

    def test_window_manager_never_discards_windows_silently(self):
        self.assertNotIn("MAX_OPEN_WINDOWS", self.javascript)
        self.assertNotIn("ensureWindowCapacity", self.javascript)

    def test_game_windows_use_xp_menus_for_their_controls(self):
        self.assertIn('menuBar.className = "game-menu-bar"', self.javascript)
        self.assertIn('menuBar.setAttribute("role", "menubar")', self.javascript)
        self.assertIn('makeMenuButton("&File")', self.javascript)
        self.assertIn('makeMenuButton("&Help")', self.javascript)
        self.assertNotIn('makeMenuButton("&View")', self.javascript)
        self.assertNotIn('makeMenuButton("F&avorites")', self.javascript)
        self.assertNotIn('makeMenuButton("&Sound")', self.javascript)
        self.assertIn('el.querySelector(".favorite-btn")', self.javascript)
        self.assertIn('el.querySelector(".volume-btn")', self.javascript)
        self.assertIn('el.querySelector(".volume-slider")', self.javascript)
        self.assertNotIn("Aavorites", self.javascript)

    def test_game_menu_supports_access_keys_and_keyboard_navigation(self):
        self.assertIn('event.altKey || event.ctrlKey || event.metaKey', self.javascript)
        self.assertIn('event.key === "ArrowDown" || event.key === "ArrowUp"', self.javascript)
        self.assertIn('event.key === "ArrowLeft" || event.key === "ArrowRight"', self.javascript)
        self.assertIn('event.key === "Escape"', self.javascript)
        self.assertIn('e.key === "F11" && focusedGameId', self.javascript)

    def test_game_menu_styles_cover_active_and_disabled_states(self):
        self.assertIn('.game-menu-button[aria-expanded="true"]', self.css)
        self.assertIn('.game-menu-item:disabled', self.css)
        self.assertIn('.game-menu-item.checked .menu-check', self.css)

    def test_additive_marquee_preserves_initial_selection(self):
        self.assertIn("const initialSelection = new Set(", self.javascript)
        self.assertIn(
            "additive && initialSelection.has(icon.dataset.desktopId)",
            self.javascript,
        )

    def test_desktop_icon_images_are_not_natively_draggable(self):
        # A native image drag cancels the pointer stream used by the
        # custom desktop icon drag, so images must opt out of it.
        self.assertIn("image.draggable = false", self.javascript)

    def test_selected_desktop_icon_shows_full_label(self):
        match = re.search(
            r"\.desktop-icon\.selected \.icon-label\s*\{([^}]*)\}",
            self.css,
        )
        self.assertIsNotNone(match)
        self.assertIn("-webkit-line-clamp: unset", match.group(1))

    def test_tray_icons_and_clock_are_focusable_buttons(self):
        parser = _ElementByIdParser(
            ["tray-network-button", "tray-volume-button", "taskbar-clock"]
        )
        parser.feed(self.html)
        for element_id in parser.ids:
            self.assertIn(element_id, parser.elements)
            tag, attributes = parser.elements[element_id]
            self.assertEqual(tag, "button", element_id)
            self.assertEqual(attributes.get("type"), "button", element_id)
        self.assertEqual(
            parser.elements["tray-network-button"][1].get("title"),
            "Local Area Connection",
        )
        self.assertEqual(
            parser.elements["tray-volume-button"][1].get("title"), "Volume"
        )

    def test_tray_volume_popup_has_slider_and_mute(self):
        parser = _ElementByIdParser(
            ["tray-volume-popup", "tray-volume-slider", "tray-mute-checkbox"]
        )
        parser.feed(self.html)
        self.assertIn("tray-volume-popup", parser.elements)
        slider = parser.elements["tray-volume-slider"][1]
        self.assertEqual(slider.get("type"), "range")
        mute = parser.elements["tray-mute-checkbox"][1]
        self.assertEqual(mute.get("type"), "checkbox")

    def test_clock_tooltip_shows_full_date(self):
        self.assertIn("clock.title", self.javascript)
        self.assertIn('weekday: "long"', self.javascript)

    def test_clock_click_opens_date_time_properties(self):
        self.assertIn("openDateTimeProperties", self.javascript)
        self.assertIn(
            'title: "Date and Time Properties"', self.javascript
        )
        date_time_block = self.javascript[
            self.javascript.index("const openDateTimeProperties = () =>"):
            self.javascript.index("const setupSystemTray = () =>")
        ]
        self.assertIn("wide: true", date_time_block)

    def test_desktop_renders_system_places_then_virtual_files(self):
        match = re.search(
            r"const desktopItems = \[(.*?)\];", self.javascript, re.S
        )
        self.assertIsNotNone(match)
        items = match.group(1)
        my_computer = items.index('"__my-computer"')
        my_documents = items.index('"__my-documents"')
        recycle_bin = items.index('"__recycle-bin"')
        self.assertLess(my_computer, my_documents)
        self.assertLess(my_documents, recycle_bin)
        self.assertIn("fs.getChildren(fs.DESKTOP)", self.javascript)
        self.assertIn("fileOps = window.FileOperations", self.javascript)

    def test_recycle_bin_defaults_to_bottom_right(self):
        match = re.search(r'icon\.dataset\.desktopId === "__recycle-bin"\) \{(.*?)\}', self.javascript, re.S)
        self.assertIsNotNone(match)
        block = match.group(1)
        self.assertIn("fallbackLeft = container.clientWidth", block)
        self.assertIn("fallbackTop = container.clientHeight", block)

    def test_desktop_uses_shared_file_operations_and_keyboard_commands(self):
        for command in (
            'fileOps.copy(selectedFsIds)', 'fileOps.cut(selectedFsIds)',
            'pasteIntoFolder(fs.DESKTOP)', 'confirmRecycleDelete(selectedFsIds)',
            'beginDesktopRename(selectedFsIds[0])', 'e.key === "F2"',
            'e.shiftKey && e.key === "F10"', 'action === "new-folder"',
        ):
            self.assertIn(command, self.javascript)

    def test_desktop_context_menu_uses_real_submenus_and_safe_multiselection(self):
        for token in (
            'addDesktopSubmenu(menu, "Arrange Icons By"',
            'addDesktopSubmenu(menu, "New"',
            'child.style.left = `${-child.offsetWidth + 2}px`',
            'event.key === "ArrowRight"',
            'event.key === "ArrowLeft"',
            'const clampedX = Math.max(-groupLeft',
            'const clampedY = Math.max(-groupTop',
            'const getDesktopSelectionEligibility = () =>',
            'const movable = allFilesystem',
            'if (finished) return;',
        ):
            self.assertIn(token, self.javascript)
        self.assertIn('.context-parent.open > .context-submenu', self.css)
        self.assertIn('#desktop-icons:not(:focus-within)', self.css)

    def test_explorer_and_recycle_bin_use_shared_filesystem_controls(self):
        for token in (
            'const navigateExplorer = (win, folderId',
            'const explorerBack = (win) =>',
            'const explorerForward = (win) =>',
            'class="explorer-menu-bar"',
            'data-explorer-action="back"',
            'data-explorer-action="forward"',
            'data-explorer-action="up"',
            'class="explorer-address"',
            'status.className = "explorer-status"',
            'fileOps.restore(ids)',
            'fileOps.permanentlyDelete(ids)',
            'fileOps.emptyRecycleBin()',
            'icon.classList.add("recycle-full")',
        ):
            self.assertIn(token, self.javascript)
        for token in ('.explorer-body', '.explorer-items[data-view="details"]', '.recycle-full::before'):
            self.assertIn(token, self.css)

    def test_explorer_item_context_menu_supports_normal_and_recycle_commands(self):
        for token in (
            'const openExplorerContextMenu = (win, clientX, clientY)',
            'menu.setAttribute("role", "menu")',
            'add("Restore", "restore"',
            'add("Delete Permanently", "permanent"',
            'add("Open", "open"', 'add("Cut", "cut"',
            'add("Rename", "rename"', 'event.key === "Escape"',
            'event.key === "Enter"', '"ArrowUp", "ArrowDown", "Home", "End"',
            'openExplorerContextMenu(win, event.clientX, event.clientY)',
        ):
            self.assertIn(token, self.javascript)

    def test_explorer_menu_bar_has_access_keys_and_keyboard_navigation(self):
        for token in (
            'file: "&File", edit: "&Edit"', 'F&avorites',
            'button.dataset.accessKey = key', 'event.altKey',
            '"ArrowLeft", "ArrowRight", "ArrowDown", "Home", "End"',
            'explorerMenuButtons.forEach((button) => button.setAttribute("aria-expanded", "false"))',
        ):
            self.assertIn(token, self.javascript)

    def test_shell_paste_uses_one_conflict_aware_progress_helper(self):
        for token in (
            'const pasteIntoFolder = async (destinationId)',
            'fileOps.pasteWithConflicts(destinationId',
            'XPDialogs.progress({ title: clipboard.mode === "cut" ? "Moving..." : "Copying..."',
            'Confirm File Replace',
            'pasteIntoFolder(win.currentFolderId)',
            'pasteIntoFolder(fs.DESKTOP)',
        ):
            self.assertIn(token, self.javascript)

    def test_desktop_alt_drag_uses_internal_filesystem_payload(self):
        for token in (
            'icon.title = "Alt+drag to move this item to a folder"',
            'icon.draggable = event.altKey',
            'application/x-astro-vfs-ids',
            'event.dataTransfer.effectAllowed = "move"',
            'if (!event.altKey || !eligibility.movable)',
        ):
            self.assertIn(token, self.javascript)

    def test_start_menu_contains_only_xp_places(self):
        places = self.javascript[
            self.javascript.index("const buildPlaces = () =>"):
            self.javascript.index("const buildPinnedPrograms = () =>")
        ]
        self.assertNotIn("Astro Flash Settings", places)
        self.assertNotIn('id: "settings"', places)
        self.assertIn('"__astro-settings"', self.javascript)
        self.assertIn(
            'if (itemId === "__astro-settings")',
            self.javascript,
        )
        self.assertNotIn("Send suggestions", places)
        self.assertNotIn("games installed", places)
        self.assertNotIn("separatorTwo", places)

    def test_every_start_destination_has_a_functional_route(self):
        places = self.javascript[
            self.javascript.index("const startDestinationActions = {"):
            self.javascript.index("const buildPinnedPrograms = () =>")
        ]
        for action in (
            "documents", "recent", "pictures", "music", "computer",
            "controlPanel", "printers", "help", "search", "run",
        ):
            self.assertRegex(places, rf"{action}: .+(?:,|\n)")
        self.assertIn('item.dataset.startAction = id', places)
        self.assertIn("item.title = XPDialogs.parseAccessKey(title).text", places)
        self.assertIn("setAccessKeyText(text, label)", places)
        self.assertIn("closeStartMenu();", places)
        self.assertIn("startDestinationActions[id]();", places)
        for icon in (
            "MyDocuments.png", "RecentDocuments.png", "MyPictures.png",
            "MyMusic.png", "MyComputer.png", "ControlPanel.png",
            "PrintersandFaxes.png", "HelpandSupport.png", "Search.png",
            "Run.png",
        ):
            self.assertIn(icon, places)

    def test_start_search_and_run_open_their_own_dialogs(self):
        places = self.javascript[
            self.javascript.index("const openSearchDialog = () =>"):
            self.javascript.index("const buildPinnedPrograms = () =>")
        ]
        self.assertIn('openSystemWindow("__search")', places)
        self.assertIn('title: "Run"', places)
        self.assertIn('XPDialogs.openFile({ title: "Browse" })', places)
        self.assertIn("resolveShellCommand(input.value)", places)
        self.assertIn("rememberRunCommand(input.value)", places)
        self.assertIn('setAccessKeyText(prompt, "&Open:")', places)
        self.assertIn('dialog.accessKeys.set("o"', places)
        self.assertIn("const openAllPrograms", self.javascript)
        self.assertNotIn('search.addEventListener("click", () => {\n        openAllPrograms()', places)

    def test_all_programs_uses_separate_cascading_flyouts(self):
        self.assertIn('id="start-menu-flyouts"', self.html)
        self.assertNotIn('id="game-search"', self.html)
        for token in (
            "const getProgramGroups = () =>", "const positionStartFlyout =",
            "const openProgramsFolder =", "start-program-flyout",
            "start-program-folder", "setTimeout(open, 220)",
            'event.key === "ArrowRight"', 'event.key === "Escape"',
            'e.target.closest("#start-menu-flyouts")',
            "const getUniqueCategoryMnemonics =", "setAccessKeyText(label, mnemonic)",
        ):
            self.assertIn(token, self.javascript)

    def test_favorite_refresh_does_not_depend_on_removed_start_search(self):
        favorite_block = self.javascript[
            self.javascript.index("const toggleFavorite ="):
            self.javascript.index("const trackGamePlay =")
        ]
        self.assertIn("buildPinnedPrograms();", favorite_block)
        self.assertIn("openAllPrograms();", favorite_block)
        self.assertNotIn("game-search", favorite_block)

    def test_search_companion_uses_virtual_filesystem_filters_and_open_actions(self):
        for token in (
            '"__search"', "const searchVirtualNodes =", "fs.MY_COMPUTER",
            'id="search-filename"', 'id="search-location"', 'id="search-type"',
            'value="files"', 'value="folders"', 'value="games"',
            'value="applications"', "wireSearchCompanion(win)", "fs.open(result.node.id)",
            "const representedGameIds = new Set()", "!representedGameIds.has(id)",
        ):
            self.assertIn(token, self.javascript)

    def test_project_controls_live_in_a_separate_dialog(self):
        self.assertIn('title: "Astro Flash Collection"', self.javascript)
        self.assertIn('localStorage.getItem("offlineModeEnabled")', self.javascript)
        self.assertIn('navigator.serviceWorker.register("sw.js")', self.javascript)
        self.assertIn(
            '"https://github.com/astrovm/flash/issues"',
            self.javascript,
        )
        self.assertIn('case "project": openProjectSettings();', self.javascript)

    def test_game_controls_are_available_without_opening_menus(self):
        self.assertIn('toolbar.className = "window-toolbar"', self.javascript)
        self.assertIn('fullscreenBtn.textContent = "Full Screen"', self.javascript)
        self.assertIn('toolbarFavoriteBtn.textContent = "Favorite"', self.javascript)
        self.assertIn('toolbarVolumeBtn.textContent = "Sound"', self.javascript)
        self.assertIn('toolbarVolumeSlider.className = "volume-slider"', self.javascript)
        self.assertIn(
            "menuBar.append(fileButton, helpButton, toolbar)",
            self.javascript,
        )

    def test_display_properties_has_a_validated_persisted_pending_model(self):
        self.assertIn('const DISPLAY_SETTINGS_KEY = "displaySettings"', self.javascript)
        self.assertIn("const isDisplaySettings = (value) =>", self.javascript)
        self.assertIn("const getDisplaySettings = () =>", self.javascript)
        self.assertIn("const saveDisplaySettings = (settings) =>", self.javascript)
        self.assertIn("const applyDisplaySettings = (settings) =>", self.javascript)
        self.assertIn("const wireDisplayProperties = (win) =>", self.javascript)
        self.assertIn("let pending = { ...current };", self.javascript)
        self.assertIn("controls.apply.disabled = JSON.stringify(pending) === JSON.stringify(current);", self.javascript)
        self.assertIn('data-display-action="apply"', self.javascript)
        self.assertIn('data-display-action="ok"', self.javascript)
        self.assertIn('data-display-action="cancel"', self.javascript)

    def test_display_properties_exposes_all_tabs_and_safe_wallpaper_controls(self):
        for tab in ("themes", "desktop", "saver", "appearance", "settings"):
            self.assertIn(f'display-tab-{tab}', self.javascript)
            self.assertIn(f'display-panel-{tab}', self.javascript)
        self.assertIn('accept="image/png,image/jpeg,image/gif,image/webp"', self.javascript)
        self.assertIn("MAX_CUSTOM_WALLPAPER_BYTES", self.javascript)
        self.assertIn('reader.result.startsWith("data:image/")', self.javascript)
        self.assertIn("const scheduleScreenSaver =", self.javascript)
        self.assertIn('id = "screen-saver-overlay"', self.javascript)
        self.assertIn("settings.screenSaverWait * 60 * 1000", self.javascript)
        self.assertIn('event.key === "Home"', self.javascript)
        self.assertIn('event.key === "End"', self.javascript)
        self.assertIn('#desktop[data-wallpaper-position="tile"]', self.css)
        self.assertIn('html[data-xp-appearance="olive"]', self.css)
        self.assertIn("display-resolution-preview", self.javascript)
        self.assertIn(
            "controls.resolutionPreview.dataset.resolution = pending.resolution",
            self.javascript,
        )
        self.assertIn("const applySimulatedMonitor = (resolution, { reflow = true } = {}) =>", self.javascript)
        self.assertIn("const SIMULATED_RESOLUTIONS", self.javascript)
        self.assertIn("desktop.dataset.monitorLimited", self.javascript)
        self.assertIn("resolutionPreviewActive", self.javascript)
        self.assertIn("let resolutionPreviewSnapshot = null", self.javascript)
        self.assertIn("snapshotWindowState()", self.javascript)
        self.assertIn("restoreWindowState(resolutionPreviewSnapshot)", self.javascript)
        self.assertIn("rollbackResolutionPreview", self.javascript)
        self.assertIn("applySimulatedMonitor(activeMonitorResolution)", self.javascript)
        self.assertIn("#desktop[data-monitor-resolution]", self.css)

    def test_simulated_monitor_bounds_common_resolutions_and_narrow_viewports(self):
        self.assertIn('"800x600": { width: 800, height: 600 }', self.javascript)
        self.assertIn('"1024x768": { width: 1024, height: 768 }', self.javascript)
        self.assertIn("width: Math.min(requested.width, window.innerWidth)", self.javascript)
        self.assertIn("height: Math.min(requested.height, window.innerHeight)", self.javascript)
        self.assertIn("desktop.style.height = `${Math.max(1, monitor.height - TASKBAR_HEIGHT)}px`", self.javascript)
        self.assertIn("taskbar.style.width = `${monitor.width}px`", self.javascript)
        self.assertIn("keepWindowsInWorkArea();", self.javascript)
        self.assertIn("layoutDesktopIcons();", self.javascript)
        self.assertIn("delete desktop.dataset.monitorLimited", self.javascript)

    def test_taskbar_keeps_overflow_windows_reachable(self):
        self.assertIn('id="taskbar-overflow-menu"', self.html)
        self.assertIn("--task-button-min-width", self.javascript)
        self.assertIn("const contentWidth = Math.max(0, container.clientWidth", self.javascript)
        self.assertIn("const overflowMinWidth", self.javascript)
        self.assertIn("contentWidth - overflowMinWidth - taskGap", self.javascript)
        self.assertIn(
            "const appendTaskButton = ([gameId, win]) =>",
            self.javascript,
        )
        self.assertIn("const appendWindowItem = ([gameId, win]) =>", self.javascript)
        self.assertNotIn(
            "const appendTaskButton = ([win, gameId]) =>",
            self.javascript,
        )
        self.assertIn('overflow.className = "task-button task-button-grouped"', self.javascript)
        self.assertIn('overflow.setAttribute("aria-haspopup", "menu")', self.javascript)
        self.assertIn("Windows Explorer (${explorerWindows.length})", self.javascript)

    def test_taskbar_attention_and_fixed_lock_state_are_explicit(self):
        self.assertIn("const setWindowAttention =", self.javascript)
        self.assertIn("window.XPShell = Object.assign", self.javascript)
        self.assertIn("win.needsAttention = false", self.javascript)
        self.assertIn(".task-button.needs-attention", self.css)
        self.assertIn("hiddenNeedsAttention", self.javascript)
        self.assertIn("taskbar-overflow-item", self.javascript)
        self.assertIn(".taskbar-overflow-item.needs-attention", self.css)
        self.assertIn('data-taskbar-action="lock" disabled', self.html)

    def test_taskbar_supports_window_and_taskbar_context_menus(self):
        self.assertIn('btn.addEventListener("contextmenu"', self.javascript)
        self.assertIn("openWindowSystemMenu(win, event.clientX, event.clientY)", self.javascript)
        for label in (
            "Cascade Windows", "Tile Windows Horizontally",
            "Tile Windows Vertically", "Show the Desktop", "Task Manager",
            "Lock the Taskbar", "Properties",
        ):
            self.assertIn(label, self.html)
        self.assertIn("const setupTaskbarContextMenu = () =>", self.javascript)
        self.assertIn("const toggleShowDesktop = () =>", self.javascript)
        self.assertIn("let showDesktopSnapshot = null", self.javascript)

    def test_taskbar_keyboard_and_state_styles_are_present(self):
        self.assertIn('taskButton && ["ArrowLeft", "ArrowRight", "Home", "End"]', self.javascript)
        self.assertIn("const wireTaskbarMenuKeyboard = (menu) =>", self.javascript)
        self.assertIn('.task-button:focus-visible', self.css)
        self.assertIn('.task-button[aria-pressed="true"]', self.css)

    def test_shell_keyboard_router_covers_window_switching_and_file_shortcuts(self):
        for token in (
            "const cycleShellWindow =", "const getMruWindows =", "window-switcher",
            'e.altKey && e.key === "Tab"', 'e.altKey && e.key === "Escape"',
            'e.altKey && e.key === "F4" && !focusedGameId',
            'e.shiftKey && e.key === "F10"', "isEditableTarget", "xp-dialog-overlay",
            "fileOps.permanentlyDelete(selected)", "pasteIntoFolder(explorerWin.currentFolderId)",
            ".system-dialog-overlay:not([hidden])", "altTabIndex = windows.findIndex",
            "if (!showSwitcher) altTabIndex = order.findIndex", "altTabIndex = 0;",
        ):
            self.assertIn(token, self.javascript)

    def test_show_desktop_restores_focus_and_resize_reflows_tasks(self):
        self.assertIn("focusedGameId,", self.javascript)
        self.assertIn("showDesktopSnapshot.windows.forEach", self.javascript)
        resize = self.javascript[
            self.javascript.index('window.addEventListener("resize"'):
            self.javascript.index('window.addEventListener("hashchange"')
        ]
        self.assertIn("renderTaskButtons();", resize)

    def test_screen_saver_is_rescheduled_for_every_login(self):
        login = self.javascript[
            self.javascript.index("const login = (playSound = true) =>"):
            self.javascript.index("const setupScreenFlow = () =>")
        ]
        self.assertLess(login.index("loggedIn = true"), login.index("applyDisplaySettings"))
        self.assertGreater(login.rindex("scheduleScreenSaver();"), login.index("if (!shellInitialized)"))

    def test_start_destinations_have_working_access_keys(self):
        self.assertIn("item.dataset.accessKey = key", self.javascript)
        self.assertIn(
            '`[data-access-key="${event.key.toLowerCase()}"]`',
            self.javascript,
        )

    def test_start_menu_footer_has_only_xp_power_actions(self):
        footer = re.search(
            r'<div class="start-menu-footer">(.*?)</div>', self.html, re.S
        )
        self.assertIsNotNone(footer)
        self.assertIn('id="log-off-button"', footer.group(1))
        self.assertIn('id="turn-off-button"', footer.group(1))
        self.assertNotIn("<h6", footer.group(1))


if __name__ == "__main__":
    unittest.main()
