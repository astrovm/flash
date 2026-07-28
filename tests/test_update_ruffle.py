import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from tools import update_ruffle


class FakeResponse:
    def __init__(self, payload=None, content=b""):
        self.payload = payload
        self.content = content

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class UpdateRuffleTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.release_path = Path(self.temporary_directory.name) / "ruffle.json"
        self.current = {
            "tag": "v0.4.1",
            "asset": "ruffle-0.4.1-web-selfhosted.zip",
            "sha256": "a" * 64,
        }
        self.release_path.write_text(
            json.dumps(self.current),
            encoding="utf-8",
        )

    def make_session(self, release):
        session = mock.Mock()
        session.get.return_value = FakeResponse(release)
        return session

    def test_stable_release_uses_api_digest(self):
        release = {
            "tag_name": "v0.4.2",
            "draft": False,
            "prerelease": False,
            "assets": [
                {
                    "name": "ruffle-0.4.2-web-selfhosted.zip",
                    "digest": f"sha256:{'b' * 64}",
                    "browser_download_url": "https://example.invalid/ruffle.zip",
                }
            ],
        }
        metadata = update_ruffle.get_release_metadata(self.make_session(release))
        self.assertEqual(metadata["tag"], "v0.4.2")
        self.assertEqual(metadata["sha256"], "b" * 64)

    def test_prerelease_is_rejected(self):
        release = {
            "tag_name": "v0.4.2",
            "draft": False,
            "prerelease": True,
            "assets": [],
        }
        with self.assertRaisesRegex(ValueError, "stable semantic"):
            update_ruffle.get_release_metadata(self.make_session(release))

    def test_release_file_is_only_written_when_pin_changes(self):
        unchanged = self.make_session(
            {
                "tag_name": "v0.4.1",
                "draft": False,
                "prerelease": False,
                "assets": [
                    {
                        "name": self.current["asset"],
                        "digest": f"sha256:{self.current['sha256']}",
                    }
                ],
            }
        )
        self.assertFalse(
            update_ruffle.update_release_file(self.release_path, unchanged)
        )


if __name__ == "__main__":
    unittest.main()
