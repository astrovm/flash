import re
import unittest
from html.parser import HTMLParser
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
INDEX_HTML = PROJECT_DIR / "site" / "index.html"
MAIN_JS = PROJECT_DIR / "site" / "js" / "main.js"
OFFLINE_JS = PROJECT_DIR / "site" / "js" / "offline.js"
MAIN_CSS = PROJECT_DIR / "site" / "css" / "main.css"
WORKBOX_CONFIG = PROJECT_DIR / "workbox-config.js"
XP_ICONS_DIR = PROJECT_DIR / "site" / "assets" / "xp" / "icons"


def _compact_source(source):
    return re.sub(r"\s+", " ", source)


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
        cls.javascript_compact = _compact_source(cls.javascript)
        cls.offline_javascript = OFFLINE_JS.read_text(encoding="utf-8")
        cls.css = MAIN_CSS.read_text(encoding="utf-8")
        cls.workbox_config = WORKBOX_CONFIG.read_text(encoding="utf-8")

    def assertJavascriptContains(self, *tokens):
        for token in tokens:
            self.assertIn(_compact_source(token), self.javascript_compact)

    def test_every_enabled_desktop_menu_action_has_a_handler(self):
        parser = _EnabledDesktopActionsParser()
        parser.feed(self.html)
        handled_actions = set(re.findall(r'action === "([^"]+)"', self.javascript))
        self.assertEqual(parser.actions - handled_actions, set())

    def test_window_manager_never_discards_windows_silently(self):
        self.assertNotIn("MAX_OPEN_WINDOWS", self.javascript)
        self.assertNotIn("ensureWindowCapacity", self.javascript)

    def test_boot_screen_uses_xp_artwork(self):
        self.assertIn('src="assets/xp/loading-logo.jpg"', self.html)
        self.assertIn('src="assets/xp/loading-microsoft.jpg"', self.html)
        self.assertIn(".boot-footer", self.css)

    def test_game_windows_use_xp_menus_for_their_controls(self):
        self.assertJavascriptContains(
            'menuBar.className = "game-menu-bar"',
            'menuBar.setAttribute("role", "toolbar")',
            'menuItems.setAttribute("role", "menubar")',
            "menuItems.append(fileButton, helpButton)",
            "menuBar.append(menuItems, quickActions)",
        )
        self.assertIn('makeMenuButton("&File")', self.javascript)
        self.assertIn('makeMenuButton("&Help")', self.javascript)
        self.assertNotIn('makeMenuButton("&View")', self.javascript)
        self.assertNotIn('makeMenuButton("F&avorites")', self.javascript)
        self.assertNotIn('makeMenuButton("&Sound")', self.javascript)
        self.assertIn('el.querySelector(".favorite-btn")', self.javascript)
        self.assertIn('el.querySelector(".volume-btn")', self.javascript)
        self.assertIn('el.querySelector(".volume-slider")', self.javascript)
        self.assertJavascriptContains(
            'makeMenuItem("Add to &Favorites", "favorite", { checkbox: true })',
            'makeMenuItem("&Mute", "mute", { checkbox: true })',
        )
        self.assertNotIn("Aavorites", self.javascript)

    def test_game_menu_supports_access_keys_and_keyboard_navigation(self):
        self.assertIn("event.altKey || event.ctrlKey || event.metaKey", self.javascript)
        self.assertIn(
            'event.key === "ArrowDown" || event.key === "ArrowUp"', self.javascript
        )
        self.assertIn(
            'event.key === "ArrowLeft" || event.key === "ArrowRight"', self.javascript
        )
        self.assertIn('event.key === "Escape"', self.javascript)
        self.assertIn('e.key === "F11" && focusedGameId', self.javascript)

    def test_game_menu_styles_cover_active_and_disabled_states(self):
        self.assertIn('.game-menu-button[aria-expanded="true"]', self.css)
        self.assertIn(".game-menu-item:disabled", self.css)
        self.assertIn(".game-menu-item.checked .menu-check", self.css)

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

    def test_virtual_folders_use_desktop_sized_folder_icons(self):
        self.assertIn('return addImage("NewFolder.png")', self.javascript)
        self.assertIn(".desktop-icon .explorer-item-icon img", self.css)
        self.assertRegex(
            self.css,
            r"\.desktop-icon \.explorer-item-icon img\s*\{[^}]*width:\s*38px",
        )

    def test_text_files_open_in_filesystem_backed_notepad(self):
        self.assertJavascriptContains(
            'fs.registerFileType(".txt", (file) => openNotepad(file))',
            "fs.setContent(node.id, editor.value)",
            'XPDialogs.openFile({ title: "Open"',
            'XPDialogs.saveFile({ title: "Save As"',
            "win.beforeClose = confirmSaveChanges",
        )
        for label in ("&File", "&Edit", "F&ormat", "&View", "&Help"):
            self.assertIn(label, self.javascript)
        self.assertIn(".notepad-editor", self.css)

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
        self.assertIn('title: "Date and Time Properties"', self.javascript)
        date_time_block = self.javascript[
            self.javascript.index(
                "const openDateTimeProperties = () =>"
            ) : self.javascript.index("const setupSystemTray = () =>")
        ]
        self.assertIn("wide: true", date_time_block)

    def test_desktop_renders_system_places_then_virtual_files(self):
        desktop = self.javascript.index("const buildDesktopIcons = () =>")
        start = self.javascript.index("const entries = [", desktop)
        entries = self.javascript[
            start : self.javascript.index("entries.forEach", start)
        ]
        files = entries.index(".getChildren(fs.DESKTOP)")
        self.assertLess(entries.index("desktopItems.map"), files)
        self.assertLess(files, entries.index("recycleBinItems.map"))
        self.assertRegex(self.javascript, r"fs\s*\.getChildren\(fs\.DESKTOP\)")
        self.assertIn("fileOps = window.FileOperations", self.javascript)

    def test_game_file_sync_preserves_user_files_and_moved_shortcuts(self):
        block = self.javascript[
            self.javascript.index(
                "const syncGameFiles = () =>"
            ) : self.javascript.index('fs.registerFileType(".game"')
        ]
        self.assertIn("fs.findByApp(gameId)", block)
        self.assertNotIn("fs.destroy(", block)
        self.assertNotIn("fs.rename(", block)

    def test_legacy_game_icon_positions_migrate_to_vfs_ids(self):
        block = self.javascript[
            self.javascript.index(
                "const getDesktopIconPositions = () =>"
            ) : self.javascript.index("const saveDesktopIconPosition")
        ]
        self.assertIn("positions[node.id] = positions[node.app]", block)
        self.assertIn("delete positions[node.app]", block)
        self.assertIn('writeJsonStorage("desktopIconPositions", positions)', block)

    def test_recycle_bin_defaults_to_bottom_right(self):
        match = re.search(
            r'icon\.dataset\.desktopId === "__recycle-bin"\) \{(.*?)\}',
            self.javascript,
            re.S,
        )
        self.assertIsNotNone(match)
        block = match.group(1)
        self.assertIn("fallbackLeft = container.clientWidth", block)
        self.assertIn("fallbackTop = container.clientHeight", block)

    def test_desktop_uses_shared_file_operations_and_keyboard_commands(self):
        for command in (
            "fileOps.copy(selectedFsIds)",
            "fileOps.cut(selectedFsIds)",
            "pasteIntoFolder(fs.DESKTOP)",
            "confirmRecycleDelete(selectedFsIds)",
            "beginDesktopRename(selectedFsIds[0])",
            'e.key === "F2"',
            'e.shiftKey && e.key === "F10"',
            'action === "new-folder"',
        ):
            self.assertIn(command, self.javascript)

    def test_desktop_context_menu_uses_real_submenus_and_safe_multiselection(self):
        self.assertJavascriptContains(
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
        )
        self.assertIn(".context-parent.open > .context-submenu", self.css)
        self.assertIn("#desktop-icons:not(:focus-within)", self.css)

    def test_explorer_and_recycle_bin_use_shared_filesystem_controls(self):
        for token in (
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
            'icon.classList.add("recycle-full")',
        ):
            self.assertIn(token, self.javascript)
        for token in (
            ".explorer-body",
            '.explorer-items[data-view="details"]',
            ".recycle-full::before",
        ):
            self.assertIn(token, self.css)

    def test_explorer_item_context_menu_supports_normal_and_recycle_commands(self):
        for token in (
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
        ):
            self.assertIn(token, self.javascript)

    def test_explorer_menu_bar_has_access_keys_and_keyboard_navigation(self):
        for token in (
            'file: "&File",',
            'edit: "&Edit",',
            "F&avorites",
            "button.dataset.accessKey = key",
            "event.altKey",
            '"ArrowLeft", "ArrowRight", "ArrowDown", "Home", "End"',
            'button.setAttribute("aria-expanded", "false")',
        ):
            self.assertIn(token, self.javascript)

    def test_explorer_menu_clicks_nested_access_key_content_and_exposes_edit_commands(
        self,
    ):
        for token in (
            'event.target.closest("[data-explorer-menu]")',
            'event.target.closest("[data-explorer-command]")',
            'data-explorer-menu="edit"',
            "edit: [",
            "const protectedSelection = selected.some((id) => fs.isProtected(id))",
            '["Cut", "cut", !selected.length || protectedSelection]',
            '["Copy", "copy", !selected.length]',
            '["Delete", "delete", !selected.length || protectedSelection]',
            "selected.length !== 1 || protectedSelection",
        ):
            self.assertIn(token, self.javascript)

    def test_explorer_task_pane_tracks_the_current_folder(self):
        for token in (
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
        ):
            self.assertIn(token, self.javascript)
        for icon in (
            "MyPictures.png",
            "PrintersandFaxes.png",
            "MyMusic.png",
            "NewFolder.png",
            "Publishtoweb.png",
            "SharedFolder.png",
        ):
            self.assertTrue((XP_ICONS_DIR / icon).is_file(), icon)

    def test_explorer_matches_xp_task_pane_toolbar_and_drive_groups(self):
        for token in (
            'class="explorer-section-toggle"',
            'placesBody.className = "explorer-section-body"',
            'content.classList.toggle("folders-visible")',
            'aria-pressed="false"',
            'data-explorer-action="go"',
            '"Files Stored on This Computer"',
            '"Hard Disk Drives"',
            '"Devices with Removable Storage"',
            "node.id === fs.DRIVE_F",
            'className = "explorer-group-heading"',
            '"My Pictures",',
            '"MyPictures.png",',
            'src="assets/xp/icons/Back.png"',
            'src="assets/xp/ms.png"',
        ):
            self.assertIn(token, self.javascript)
        for token in (
            ".explorer-toolbar-separator",
            ".explorer-content:not(.folders-visible) .explorer-tree-section",
            ".explorer-content.folders-visible .explorer-sidebar > section:not(.explorer-tree-section)",
            ".explorer-section-toggle",
            ".explorer-group-heading",
        ):
            self.assertIn(token, self.css)

    def test_shell_paste_uses_one_conflict_aware_progress_helper(self):
        self.assertJavascriptContains(
            "const pasteIntoFolder = async (destinationId)",
            "fileOps.pasteWithConflicts(",
            'clipboard.mode === "cut" ? "Moving..." : "Copying..."',
            "Confirm File Replace",
            "pasteIntoFolder(win.currentFolderId)",
            "pasteIntoFolder(fs.DESKTOP)",
        )

    def test_desktop_alt_drag_uses_internal_filesystem_payload(self):
        for token in (
            'icon.title = "Alt+drag to move this item to a folder"',
            "icon.draggable = event.altKey",
            "application/x-astro-vfs-ids",
            'event.dataTransfer.effectAllowed = "move"',
            "if (!event.altKey || !eligibility.movable)",
        ):
            self.assertIn(token, self.javascript)

    def test_start_menu_contains_only_xp_places(self):
        places = self.javascript[
            self.javascript.index("const buildPlaces = () =>") : self.javascript.index(
                "const buildPinnedPrograms = () =>"
            )
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
            self.javascript.index(
                "const startDestinationActions = {"
            ) : self.javascript.index("const buildPinnedPrograms = () =>")
        ]
        for action in (
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
        ):
            self.assertRegex(places, rf"{action}: .+(?:,|\n)")
        self.assertIn("item.dataset.startAction = id", places)
        self.assertIn("item.title = XPDialogs.parseAccessKey(title).text", places)
        self.assertIn("setAccessKeyText(text, label)", places)
        self.assertIn("closeStartMenu();", places)
        self.assertIn("startDestinationActions[id]();", places)
        for icon in (
            "MyDocuments.png",
            "RecentDocuments.png",
            "MyPictures.png",
            "MyMusic.png",
            "MyComputer.png",
            "ControlPanel.png",
            "PrintersandFaxes.png",
            "HelpandSupport.png",
            "Search.png",
            "Run.png",
        ):
            self.assertIn(icon, places)

    def test_start_search_and_run_open_their_own_dialogs(self):
        places = self.javascript[
            self.javascript.index(
                "const openSearchDialog = () =>"
            ) : self.javascript.index("const buildPinnedPrograms = () =>")
        ]
        self.assertIn('openSystemWindow("__search")', places)
        self.assertIn('title: "Run"', places)
        self.assertIn('XPDialogs.openFile({ title: "Browse" })', places)
        self.assertIn("resolveShellCommand(input.value)", places)
        self.assertIn("rememberRunCommand(input.value)", places)
        self.assertIn('setAccessKeyText(prompt, "&Open:")', places)
        self.assertIn('dialog.accessKeys.set("o"', places)
        self.assertIn("XPDialogs.parseAccessKey(label)", places)
        self.assertIn("const openAllPrograms", self.javascript)
        self.assertNotIn(
            'search.addEventListener("click", () => {\n        openAllPrograms()',
            places,
        )

    def test_game_files_use_windows_compatible_names(self):
        self.assertJavascriptContains(
            "const gameFileName = (gameId) =>",
            '.replace(/[<>:"/',
            ".trim()}.game",
            "fs.createFile(fs.DESKTOP, gameFileName(gameId)",
        )

    def test_all_programs_uses_separate_cascading_flyouts(self):
        self.assertIn('id="start-menu-flyouts"', self.html)
        self.assertNotIn('id="game-search"', self.html)
        for token in (
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
        ):
            self.assertIn(token, self.javascript)

    def test_favorite_refresh_does_not_depend_on_removed_start_search(self):
        favorite_block = self.javascript[
            self.javascript.index("const toggleFavorite =") : self.javascript.index(
                "const trackGamePlay ="
            )
        ]
        self.assertIn("buildPinnedPrograms();", favorite_block)
        self.assertIn("openAllPrograms();", favorite_block)
        self.assertNotIn("game-search", favorite_block)

    def test_search_companion_uses_virtual_filesystem_filters_and_open_actions(self):
        for token in (
            '"__search"',
            "const searchVirtualNodes =",
            "fs.MY_COMPUTER",
            'id="search-filename"',
            'id="search-location"',
            'id="search-type"',
            'value="files"',
            'value="folders"',
            'value="games"',
            'value="applications"',
            "wireSearchCompanion(win)",
            "fs.open(result.node.id)",
            "const representedGameIds = new Set()",
            "!representedGameIds.has(id)",
        ):
            self.assertIn(token, self.javascript)

    def test_project_controls_live_in_a_separate_dialog(self):
        self.assertJavascriptContains(
            'title: "Astro Flash Collection"',
            "offlineManager.checkForUpdates()",
            "offlineManager.applyUpdate()",
            "offlineManager.repair()",
            '"Check for Updates"',
            '"Repair Offline Files"',
            '"Offline download progress"',
            "state.downloadBytes",
            '"https://github.com/astrovm/flash/issues"',
            'case "project": openProjectSettings();',
        )
        self.assertNotIn(
            'heading.textContent = "Astro Flash Collection"', self.javascript
        )
        for token in (
            "navigatorObject.serviceWorker.register(",
            '{ updateViaCache: "none" }',
            '"updatefound"',
            '"controllerchange"',
            '{ type: "SKIP_WAITING" }',
            'cache: "no-store"',
            '"visibilitychange"',
            '"online"',
        ):
            self.assertIn(token, self.offline_javascript)
        self.assertIn('globIgnores: ["version.json"]', self.workbox_config)
        self.assertIn("skipWaiting: false", self.workbox_config)
        self.assertIn("clientsClaim: true", self.workbox_config)

    def test_game_controls_share_one_compact_menu_row(self):
        self.assertJavascriptContains(
            'quickActions.className = "game-quick-actions"',
            'quickFavoriteBtn.className = "quick-access-btn favorite-btn"',
            'quickVolumeBtn.className = "quick-access-btn volume-btn"',
            'fullscreenBtn.className = "quick-access-btn fullscreen-btn"',
            'menuBar.setAttribute("role", "toolbar")',
            'menuItems.setAttribute("role", "menubar")',
        )
        self.assertNotIn("window-toolbar", self.javascript)
        self.assertJavascriptContains(
            'volumeSlider.className = "volume-slider game-volume-slider"',
            'volumeSlider.type = "range"',
            'win.volumeSlider.addEventListener("input"',
        )
        self.assertIn(".game-volume-slider", self.css)

    def test_startup_screens_have_pointer_and_keyboard_skip_paths(self):
        parser = _ElementByIdParser(["boot-screen", "welcome-screen", "login-user"])
        parser.feed(self.html)
        boot = parser.elements["boot-screen"][1]
        self.assertEqual(boot.get("role"), "button")
        self.assertEqual(boot.get("tabindex"), "0")
        self.assertJavascriptContains(
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
        )
        self.assertEqual(parser.elements["login-user"][0], "button")

    def test_display_properties_has_a_validated_persisted_pending_model(self):
        self.assertJavascriptContains(
            'const DISPLAY_SETTINGS_KEY = "displaySettings"',
            "const isDisplaySettings = (value) =>",
            "const getDisplaySettings = () =>",
            "const saveDisplaySettings = (settings) =>",
            "const applyDisplaySettings = (settings) =>",
            "const wireDisplayProperties = (win) =>",
            "let pending = { ...current };",
            "controls.apply.disabled = JSON.stringify(pending) === JSON.stringify(current);",
        )
        self.assertIn('data-display-action="apply"', self.javascript)
        self.assertIn('data-display-action="ok"', self.javascript)
        self.assertIn('data-display-action="cancel"', self.javascript)

    def test_display_properties_exposes_all_tabs_and_safe_wallpaper_controls(self):
        for tab in ("themes", "desktop", "saver", "appearance", "settings"):
            self.assertIn(f"display-tab-{tab}", self.javascript)
            self.assertIn(f"display-panel-{tab}", self.javascript)
        self.assertIn(
            'accept="image/png,image/jpeg,image/gif,image/webp"', self.javascript
        )
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
        self.assertIn(
            "const applySimulatedMonitor = (resolution, { reflow = true } = {}) =>",
            self.javascript,
        )
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
        self.assertIn(
            "width: Math.min(requested.width, window.innerWidth)", self.javascript
        )
        self.assertIn(
            "height: Math.min(requested.height, window.innerHeight)", self.javascript
        )
        self.assertIn(
            "desktop.style.height = `${Math.max(1, monitor.height - TASKBAR_HEIGHT)}px`",
            self.javascript,
        )
        self.assertIn("taskbar.style.width = `${monitor.width}px`", self.javascript)
        self.assertIn("keepWindowsInWorkArea();", self.javascript)
        self.assertIn("layoutDesktopIcons();", self.javascript)
        self.assertIn("delete desktop.dataset.monitorLimited", self.javascript)

    def test_desktop_icons_use_compact_metrics_and_non_overlapping_overflow(self):
        self.assertJavascriptContains(
            "compact: { width: 60, height: 58, gap: 4, margin: 4 }",
            "const getDesktopIconMetrics",
            "container.clientWidth <= 480",
            "const overflowsViewport = icons.length > columns * rows",
            'container.classList.toggle("desktop-icons-overflow"',
            "overflowsViewport ? index % columns",
            "getDesktopIconMetrics(container)",
        )
        self.assertIn("#desktop-icons.desktop-icons-overflow", self.css)
        self.assertIn("@media (max-width: 480px)", self.css)
        self.assertIn("width: 60px", self.css)

    def test_desktop_game_labels_hide_virtual_extension(self):
        self.assertIn('node.ext === ".game"', self.javascript)
        self.assertIn("node.name.slice(0, -node.ext.length)", self.javascript)

    def test_anchored_recycle_bin_does_not_consume_an_early_grid_slot(self):
        entries = self.javascript.index("const entries = [")
        files = self.javascript.index(".getChildren(fs.DESKTOP)", entries)
        recycle = self.javascript.index("...recycleBinItems.map", entries)
        self.assertLess(files, recycle)

    def test_taskbar_keeps_overflow_windows_reachable(self):
        self.assertIn('id="taskbar-overflow-menu"', self.html)
        self.assertJavascriptContains(
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
        )
        self.assertNotIn(
            "const appendTaskButton = ([win, gameId]) =>",
            self.javascript,
        )

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
        self.assertIn(
            "openWindowSystemMenu(win, event.clientX, event.clientY)", self.javascript
        )
        for label in (
            "Cascade Windows",
            "Tile Windows Horizontally",
            "Tile Windows Vertically",
            "Show the Desktop",
            "Task Manager",
            "Lock the Taskbar",
            "Properties",
        ):
            self.assertIn(label, self.html)
        self.assertIn("const setupTaskbarContextMenu = () =>", self.javascript)
        self.assertIn("const toggleShowDesktop = () =>", self.javascript)
        self.assertIn("let showDesktopSnapshot = null", self.javascript)

    def test_taskbar_keyboard_and_state_styles_are_present(self):
        self.assertJavascriptContains(
            'taskButton && ["ArrowLeft", "ArrowRight", "Home", "End"]'
        )
        self.assertIn("const wireTaskbarMenuKeyboard = (menu) =>", self.javascript)
        self.assertIn(".task-button:focus-visible", self.css)
        self.assertIn('.task-button[aria-pressed="true"]', self.css)

    def test_shell_keyboard_router_covers_window_switching_and_file_shortcuts(self):
        self.assertJavascriptContains(
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
        )

    def test_show_desktop_restores_focus_and_resize_reflows_tasks(self):
        self.assertIn("focusedGameId,", self.javascript)
        self.assertIn("showDesktopSnapshot.windows.forEach", self.javascript)
        resize = self.javascript[
            self.javascript.index(
                'window.addEventListener("resize"'
            ) : self.javascript.index('window.addEventListener("hashchange"')
        ]
        self.assertIn("renderTaskButtons();", resize)

    def test_screen_saver_is_rescheduled_for_every_login(self):
        login = self.javascript[
            self.javascript.index(
                "const login = (playSound = true) =>"
            ) : self.javascript.index("const setupScreenFlow = () =>")
        ]
        self.assertLess(
            login.index("loggedIn = true"), login.index("applyDisplaySettings")
        )
        self.assertGreater(
            login.rindex("scheduleScreenSaver();"),
            login.index("if (!shellInitialized)"),
        )

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
