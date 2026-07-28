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
        self.assertIn('makeMenuButton("File", "F")', self.javascript)
        self.assertIn('makeMenuButton("View", "V")', self.javascript)
        self.assertIn('makeMenuButton("Favorites", "A")', self.javascript)
        self.assertIn('makeMenuButton("Sound", "S")', self.javascript)
        self.assertIn('makeMenuItem("Full Screen", "fullscreen"', self.javascript)
        self.assertIn('makeMenuItem("Add to Favorites", "favorite"', self.javascript)
        self.assertIn('makeMenuItem("Mute", "mute"', self.javascript)
        self.assertIn('volumeSlider.className = "game-volume-slider"', self.javascript)
        self.assertNotIn('window-toolbar', self.javascript)

    def test_game_menu_supports_access_keys_and_keyboard_navigation(self):
        self.assertIn('event.altKey || event.ctrlKey || event.metaKey', self.javascript)
        self.assertIn('event.key === "ArrowDown" || event.key === "ArrowUp"', self.javascript)
        self.assertIn('event.key === "ArrowLeft" || event.key === "ArrowRight"', self.javascript)
        self.assertIn('event.key === "Escape"', self.javascript)

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
        self.assertNotIn("Offline Mode", self.javascript)
        self.assertNotIn("offline-mode", self.javascript)
        self.assertNotIn("Send suggestions", self.javascript)
        self.assertNotIn("games installed", self.javascript)
        self.assertNotIn("separatorTwo", self.javascript)

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
