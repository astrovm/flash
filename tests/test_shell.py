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
            "additive && initialSelection.has(icon.dataset.game)",
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

    def test_my_computer_is_the_first_desktop_icon(self):
        match = re.search(
            r"const desktopItems = \[(.*?)\];", self.javascript, re.S
        )
        self.assertIsNotNone(match)
        items = match.group(1)
        my_computer = items.index('"__my-computer"')
        my_documents = items.index('"__my-documents"')
        recycle_bin = items.index('"__recycle-bin"')
        sorted_games = items.index("sortedGames")
        self.assertLess(my_computer, my_documents)
        self.assertLess(my_documents, sorted_games)
        self.assertLess(sorted_games, recycle_bin)

    def test_recycle_bin_defaults_to_bottom_right(self):
        match = re.search(
            r'icon\.dataset\.game === "__recycle-bin"\) \{(.*?)\}',
            self.javascript,
            re.S,
        )
        self.assertIsNotNone(match)
        block = match.group(1)
        self.assertIn("fallbackLeft = container.clientWidth", block)
        self.assertIn("fallbackTop = container.clientHeight", block)

    def test_start_menu_contains_only_xp_places(self):
        places = self.javascript[
            self.javascript.index("const buildPlaces = () =>"):
            self.javascript.index("const buildPinnedPrograms = () =>")
        ]
        self.assertIn("Astro Flash Settings", places)
        self.assertIn('id: "settings"', places)
        self.assertIn("settings: openProjectSettings", self.javascript)
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
        self.assertIn('title: "Search Results"', places)
        self.assertIn('title: "Run"', places)
        self.assertIn("const openAllPrograms", self.javascript)
        self.assertNotIn('search.addEventListener("click", () => {\n        openAllPrograms()', places)

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

    def test_taskbar_keeps_overflow_windows_reachable(self):
        self.assertIn('id="taskbar-overflow-menu"', self.html)
        self.assertIn("const capacity = Math.max(1, Math.floor(container.clientWidth / 94))", self.javascript)
        self.assertIn(
            "const appendTaskButton = ([gameId, win]) =>",
            self.javascript,
        )
        self.assertIn(
            "hidden.forEach(([gameId, win]) =>",
            self.javascript,
        )
        self.assertNotIn(
            "const appendTaskButton = ([win, gameId]) =>",
            self.javascript,
        )
        self.assertIn('overflow.className = "task-button task-button-grouped"', self.javascript)
        self.assertIn('overflow.setAttribute("aria-haspopup", "menu")', self.javascript)

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
