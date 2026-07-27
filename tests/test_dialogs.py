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


if __name__ == "__main__":
    unittest.main()
