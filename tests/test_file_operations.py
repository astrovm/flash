import subprocess
import unittest
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]


class FileOperationsTests(unittest.TestCase):
    def test_file_operations_node_suite(self):
        result = subprocess.run(
            ["node", str(PROJECT_DIR / "tests" / "file_operations_node_tests.js")],
            capture_output=True,
            text=True,
            cwd=PROJECT_DIR,
        )
        self.assertEqual(result.returncode, 0, msg=f"{result.stdout}\n{result.stderr}")


if __name__ == "__main__":
    unittest.main()
