import subprocess
import unittest
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]


class GameLibraryTests(unittest.TestCase):
    def test_game_library_node_suite(self):
        subprocess.run(
            ["node", "tests/game_library_node_tests.js"],
            cwd=PROJECT_DIR,
            check=True,
        )


if __name__ == "__main__":
    unittest.main()
