import subprocess
import unittest
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]


class ReusableDialogTests(unittest.TestCase):
    def test_dialog_node_suite(self):
        result = subprocess.run(
            ["node", str(PROJECT_DIR / "tests" / "dialog_node_tests.js")],
            capture_output=True,
            text=True,
            cwd=PROJECT_DIR,
        )
        self.assertEqual(
            result.returncode,
            0,
            msg=f"{result.stdout}\n{result.stderr}",
        )

    def test_index_loads_dialogs_before_main(self):
        html = (PROJECT_DIR / "docs" / "index.html").read_text(encoding="utf-8")
        filesystem_at = html.index('src="js/filesystem.')
        dialogs_at = html.index('src="js/dialogs.')
        main_at = html.index('src="js/main.')
        self.assertLess(filesystem_at, dialogs_at)
        self.assertLess(dialogs_at, main_at)

    def test_session_actions_have_distinct_transitions(self):
        main = (PROJECT_DIR / "docs" / "js" / "main.js").read_text(encoding="utf-8")
        index = (PROJECT_DIR / "docs" / "index.html").read_text(encoding="utf-8")

        self.assertIn('const switchUser = () =>', main)
        self.assertIn('const logOff = () =>', main)
        self.assertIn('const restart = () =>', main)
        self.assertIn('const turnOff = () =>', main)
        self.assertIn('const setSuspended = (value) =>', main)
        self.assertIn('const closeCurrentSession = () =>', main)
        self.assertIn('Array.from(openWindows.keys()).forEach(closeGameWindow);', main)
        self.assertIn('setSuspended(true);', main)
        self.assertIn('startShutdown(true);', main)
        self.assertIn('startShutdown(false);', main)
        self.assertIn(
            'document.getElementById("shutdown-confirm")\n'
            '        .addEventListener("click", turnOff);',
            main,
        )
        self.assertIn('id="standby-screen"', index)
        self.assertIn('id="standby-resume"', index)

    def test_reusable_dialogs_are_draggable_and_viewport_clamped(self):
        dialogs = (PROJECT_DIR / "docs" / "js" / "dialogs.js").read_text(
            encoding="utf-8"
        )

        self.assertIn('titleBar.addEventListener("pointerdown"', dialogs)
        self.assertIn('event.target.closest(".title-buttons")', dialogs)
        self.assertIn("titleBar.setPointerCapture(event.pointerId)", dialogs)
        self.assertIn('document.addEventListener("pointermove", move)', dialogs)
        self.assertIn("overlay.clientWidth - el.offsetWidth", dialogs)
        self.assertIn("overlay.clientHeight - el.offsetHeight", dialogs)


if __name__ == "__main__":
    unittest.main()
