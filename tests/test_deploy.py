import hashlib
import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

from tools import deploy


class FakeResponse:
    def __init__(self, content):
        self.content = content

    def raise_for_status(self):
        return None


def make_ruffle_archive(include_core=True, include_wasm=True):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("ruffle.js", "ruffle")
        archive.writestr("ruffle.js.map", "map")
        if include_core:
            archive.writestr("core.ruffle.abc123.js", "core")
        if include_wasm:
            archive.writestr("abc123.wasm", b"wasm")
        archive.writestr("nested/ignored.js", "ignored")
    return output.getvalue()


class DeployTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.project_dir = Path(self.temporary_directory.name)
        self.source_dir = self.project_dir / "site"
        self.output_dir = self.project_dir / "dist"

    def make_source(self):
        files = {
            "index.html": "\n".join(
                [
                    '<script src="js/ruffle.js?v=old"></script>',
                    '<script src="vendor/fflate/0.8.3/index.js?v=old"></script>',
                    '<script src="js/games.js?v=old"></script>',
                    '<script src="js/game-installer.js?v=old"></script>',
                    '<script src="js/game-library.js?v=old"></script>',
                    '<script src="js/filesystem.js?v=old"></script>',
                    '<script src="js/file-operations.js?v=old"></script>',
                    '<script src="js/dialogs.js?v=old"></script>',
                    '<script src="js/offline.js?v=old"></script>',
                    '<script src="js/main.js?v=old"></script>',
                    '<link rel="stylesheet" href="css/main.css?v=old">',
                ]
            ),
            "js/games.js": "games",
            "js/game-installer.js": "game installer",
            "js/game-library.js": "game library",
            "js/filesystem.js": "filesystem",
            "js/file-operations.js": "file operations",
            "js/dialogs.js": "dialogs",
            "js/offline.js": "offline",
            "js/main.js": 'const APP_VERSION = "old";\n',
            "css/main.css": "css",
            "vendor/fflate/0.8.3/index.js": "fflate",
            "swf/bike-mania/main.swf": "swf",
            "iframe/doom/index.html": "doom",
            "iframe/inside-the-firewall/index.html": "firewall",
            "dos/doom/doom.jsdos": "jsdos",
        }
        for relative_path, content in files.items():
            path = self.source_dir / relative_path
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")

    def add_generated_runtime(self, root):
        js_dir = root / "js"
        js_dir.mkdir(parents=True, exist_ok=True)
        (js_dir / "ruffle.js").write_text("ruffle", encoding="utf-8")
        (js_dir / "core.ruffle.abc123.js").write_text("core", encoding="utf-8")
        (js_dir / "abc123.wasm").write_bytes(b"wasm")
        (root / "sw.js").write_text(
            's("workbox-f9030226", import.meta.url)',
            encoding="utf-8",
        )
        (root / "workbox-f9030226.js").write_text("workbox", encoding="utf-8")

    def test_load_ruffle_release_accepts_complete_metadata(self):
        metadata = self.project_dir / "ruffle.json"
        metadata.write_text(
            json.dumps(
                {
                    "tag": "v0.4.1",
                    "asset": "ruffle-0.4.1-web-selfhosted.zip",
                    "sha256": "a" * 64,
                }
            ),
            encoding="utf-8",
        )
        self.assertEqual(deploy.load_ruffle_release(metadata)["tag"], "v0.4.1")

    def test_load_ruffle_release_rejects_invalid_metadata(self):
        metadata = self.project_dir / "ruffle.json"
        metadata.write_text('{"tag": "nightly"}', encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "tag, asset, and sha256"):
            deploy.load_ruffle_release(metadata)

    def test_download_ruffle_verifies_checksum_and_extracts_root_files(self):
        archive = make_ruffle_archive()
        release = {
            "tag": "v0.4.1",
            "asset": "ruffle-0.4.1-web-selfhosted.zip",
            "sha256": hashlib.sha256(archive).hexdigest(),
        }
        session = mock.Mock()
        session.get.return_value = FakeResponse(archive)

        deploy.download_ruffle(self.output_dir / "js", release, session)

        self.assertTrue((self.output_dir / "js" / "ruffle.js").is_file())
        self.assertTrue((self.output_dir / "js" / "abc123.wasm").is_file())
        self.assertFalse((self.output_dir / "js" / "ignored.js").exists())

    def test_download_ruffle_rejects_checksum_mismatch(self):
        archive = make_ruffle_archive()
        release = {
            "tag": "v0.4.1",
            "asset": "ruffle-0.4.1-web-selfhosted.zip",
            "sha256": "0" * 64,
        }
        session = mock.Mock()
        session.get.return_value = FakeResponse(archive)
        with self.assertRaisesRegex(ValueError, "checksum mismatch"):
            deploy.download_ruffle(self.output_dir / "js", release, session)

    def test_download_ruffle_rejects_incomplete_runtime(self):
        archive = make_ruffle_archive(include_wasm=False)
        release = {
            "tag": "v0.4.1",
            "asset": "ruffle-0.4.1-web-selfhosted.zip",
            "sha256": hashlib.sha256(archive).hexdigest(),
        }
        session = mock.Mock()
        session.get.return_value = FakeResponse(archive)
        with self.assertRaisesRegex(ValueError, "missing required runtime"):
            deploy.download_ruffle(self.output_dir / "js", release, session)

    def test_deployment_version_uses_commit_date_and_short_revision(self):
        with mock.patch.object(
            deploy,
            "run_git",
            side_effect=["2026-07-28", "abcdef123456"],
        ):
            version = deploy.get_deployment_version("main", self.project_dir)
        self.assertEqual(version, "26.07.28-abcdef1")

    def test_deployment_version_rejects_invalid_git_output(self):
        with mock.patch.object(
            deploy,
            "run_git",
            side_effect=["not-a-date", "abcdef1"],
        ):
            with self.assertRaisesRegex(RuntimeError, "invalid commit date"):
                deploy.get_deployment_version()

    def test_update_html_versions_main_before_hashing_assets(self):
        self.make_source()
        self.add_generated_runtime(self.source_dir)
        paths = deploy.BuildPaths(self.source_dir)

        deploy.update_html(paths, "26.07.28-abcdef1")
        deploy.write_version_metadata(paths, "26.07.28-abcdef1")

        main = paths.main_js.read_text(encoding="utf-8")
        html = paths.html.read_text(encoding="utf-8")
        self.assertIn('const APP_VERSION = "26.07.28-abcdef1";', main)
        self.assertIn(
            f'js/main.js?v={deploy.get_short_hash(paths.main_js)}"',
            html,
        )
        self.assertIn(
            "js/game-installer.js?v="
            f'{deploy.get_short_hash(paths.js / "game-installer.js")}"',
            html,
        )
        self.assertIn(
            "js/game-library.js?v="
            f'{deploy.get_short_hash(paths.js / "game-library.js")}"',
            html,
        )
        self.assertIn(
            "js/file-operations.js?v="
            f'{deploy.get_short_hash(paths.js / "file-operations.js")}"',
            html,
        )
        self.assertIn(
            f'js/offline.js?v={deploy.get_short_hash(paths.js / "offline.js")}"',
            html,
        )
        metadata = json.loads(paths.version_json.read_text(encoding="utf-8"))
        self.assertGreater(metadata.pop("offlineBytes"), 0)
        self.assertEqual(
            metadata,
            {"revision": "abcdef1", "version": "26.07.28-abcdef1"},
        )

    def test_update_html_fails_if_an_asset_reference_is_missing(self):
        self.make_source()
        self.add_generated_runtime(self.source_dir)
        html = self.source_dir / "index.html"
        html.write_text(
            html.read_text(encoding="utf-8").replace(
                '<script src="js/dialogs.js?v=old"></script>',
                "",
            ),
            encoding="utf-8",
        )
        with self.assertRaisesRegex(RuntimeError, "Could not update asset reference"):
            deploy.update_html(deploy.BuildPaths(self.source_dir), "26.07.28-abcdef1")

    def test_generate_service_worker_validates_runtime_reference(self):
        self.output_dir.mkdir()

        def generate(*_args, **_kwargs):
            self.add_generated_runtime(self.output_dir)

        with mock.patch.object(deploy.subprocess, "run", side_effect=generate):
            deploy.generate_service_worker(self.output_dir, self.project_dir)
        self.assertTrue((self.output_dir / "workbox-f9030226.js").is_file())

    def test_generate_service_worker_rejects_missing_runtime(self):
        self.output_dir.mkdir()

        def generate(*_args, **_kwargs):
            (self.output_dir / "sw.js").write_text(
                's("workbox-deadbeef", import.meta.url)',
                encoding="utf-8",
            )

        with mock.patch.object(deploy.subprocess, "run", side_effect=generate):
            with self.assertRaisesRegex(RuntimeError, "missing Workbox runtime"):
                deploy.generate_service_worker(self.output_dir, self.project_dir)

    def test_validate_output_accepts_complete_artifact(self):
        self.make_source()
        self.add_generated_runtime(self.source_dir)
        deploy.update_html(
            deploy.BuildPaths(self.source_dir),
            "26.07.28-abcdef1",
        )
        deploy.write_version_metadata(
            deploy.BuildPaths(self.source_dir),
            "26.07.28-abcdef1",
        )
        deploy.validate_output(self.source_dir)

    def test_validate_output_rejects_missing_representative_asset(self):
        self.make_source()
        self.add_generated_runtime(self.source_dir)
        (self.source_dir / "swf" / "bike-mania" / "main.swf").unlink()
        with self.assertRaisesRegex(RuntimeError, "missing required files"):
            deploy.validate_output(self.source_dir)

    def test_build_does_not_mutate_source_and_replaces_old_output(self):
        self.make_source()
        original_files = {
            path.relative_to(self.source_dir): path.read_bytes()
            for path in self.source_dir.rglob("*")
            if path.is_file()
        }
        self.output_dir.mkdir()
        (self.output_dir / "stale.txt").write_text("stale", encoding="utf-8")

        def download(js_dir):
            self.add_generated_runtime(js_dir.parent)

        def workbox(output_dir):
            self.add_generated_runtime(output_dir)

        with (
            mock.patch.object(deploy, "SOURCE_DIR", self.source_dir),
            mock.patch.object(
                deploy,
                "get_deployment_version",
                return_value="26.07.28-abcdef1",
            ),
            mock.patch.object(deploy, "download_ruffle", side_effect=download),
            mock.patch.object(
                deploy,
                "generate_service_worker",
                side_effect=workbox,
            ),
        ):
            deploy.build(self.output_dir)

        current_files = {
            path.relative_to(self.source_dir): path.read_bytes()
            for path in self.source_dir.rglob("*")
            if path.is_file()
        }
        self.assertEqual(current_files, original_files)
        self.assertFalse((self.output_dir / "stale.txt").exists())
        self.assertTrue((self.output_dir / "sw.js").is_file())
        metadata = json.loads(
            (self.output_dir / "version.json").read_text(encoding="utf-8")
        )
        self.assertGreater(metadata.pop("offlineBytes"), 0)
        self.assertEqual(
            metadata,
            {"revision": "abcdef1", "version": "26.07.28-abcdef1"},
        )

    def test_failed_build_preserves_previous_output(self):
        self.make_source()
        self.output_dir.mkdir()
        previous = self.output_dir / "previous.txt"
        previous.write_text("keep", encoding="utf-8")

        with (
            mock.patch.object(deploy, "SOURCE_DIR", self.source_dir),
            mock.patch.object(
                deploy,
                "get_deployment_version",
                return_value="26.07.28-abcdef1",
            ),
            mock.patch.object(
                deploy,
                "download_ruffle",
                side_effect=RuntimeError("network failed"),
            ),
        ):
            with self.assertRaisesRegex(RuntimeError, "network failed"):
                deploy.build(self.output_dir)
        self.assertEqual(previous.read_text(encoding="utf-8"), "keep")

    def test_build_rejects_output_inside_source(self):
        self.make_source()
        with mock.patch.object(deploy, "SOURCE_DIR", self.source_dir):
            with self.assertRaisesRegex(ValueError, "outside"):
                deploy.build(self.source_dir / "dist")


if __name__ == "__main__":
    unittest.main()
