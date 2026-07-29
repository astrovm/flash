import subprocess
import unittest
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]


class CatalogWorkerTests(unittest.TestCase):
    def test_catalog_worker_node_suite(self):
        subprocess.run(
            ["node", "tests/catalog_worker_node_tests.mjs"],
            cwd=PROJECT_DIR,
            check=True,
        )


if __name__ == "__main__":
    unittest.main()
