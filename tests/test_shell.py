import hashlib
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
INDEX_HTML = PROJECT_DIR / "docs" / "index.html"
MAIN_JS = PROJECT_DIR / "docs" / "js" / "main.js"


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


class ShellSourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = INDEX_HTML.read_text(encoding="utf-8")
        cls.javascript = MAIN_JS.read_text(encoding="utf-8")

    def test_every_enabled_desktop_menu_action_has_a_handler(self):
        parser = _EnabledDesktopActionsParser()
        parser.feed(self.html)
        handled_actions = set(
            re.findall(r'action === "([^"]+)"', self.javascript)
        )
        self.assertEqual(parser.actions - handled_actions, set())

    def test_all_window_entrypoints_enforce_capacity(self):
        for function_name in ("openSystemWindow", "openGameWindow"):
            match = re.search(
                rf"const {function_name} = .*?\n}};",
                self.javascript,
                re.DOTALL,
            )
            self.assertIsNotNone(match)
            self.assertIn("ensureWindowCapacity();", match.group(0))

    def test_additive_marquee_preserves_initial_selection(self):
        self.assertIn("const initialSelection = new Set(", self.javascript)
        self.assertIn(
            "additive && initialSelection.has(icon.dataset.game)",
            self.javascript,
        )

    def test_xp_icon_assets_have_provenance_and_matching_hashes(self):
        icon_dir = PROJECT_DIR / "docs" / "assets" / "xp" / "icons"
        provenance = (icon_dir.parent / "README.md").read_text(encoding="utf-8")
        for icon in icon_dir.glob("*.png"):
            digest = hashlib.sha256(icon.read_bytes()).hexdigest()
            self.assertIn(icon.name, provenance)
            self.assertIn(digest, provenance)


if __name__ == "__main__":
    unittest.main()
