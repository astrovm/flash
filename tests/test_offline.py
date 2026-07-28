import subprocess
import unittest
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]


class OfflineUpdateTests(unittest.TestCase):
    def test_offline_update_node_suite(self):
        subprocess.run(
            ["node", "tests/offline_node_tests.js"],
            cwd=PROJECT_DIR,
            check=True,
        )


if __name__ == "__main__":
    unittest.main()
