import json
import re
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from tools import deploy


class DeployTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.project_dir = Path(self.temporary_directory.name)
        self.docs_dir = self.project_dir / "docs"
        self.js_dir = self.docs_dir / "js"
        self.js_dir.mkdir(parents=True)

        self.path_patches = [
            mock.patch.object(deploy, "PROJECT_DIR", self.project_dir),
            mock.patch.object(deploy, "DOCS_DIR", self.docs_dir),
            mock.patch.object(deploy, "JS_DIR", self.js_dir),
            mock.patch.object(deploy, "HTML_PATH", self.docs_dir / "index.html"),
            mock.patch.object(deploy, "MAIN_JS_PATH", self.js_dir / "main.js"),
            mock.patch.object(
                deploy,
                "RUFFLE_MANIFEST_PATH",
                self.js_dir / "ruffle-manifest.json",
            ),
        ]
        for patch in self.path_patches:
            patch.start()
            self.addCleanup(patch.stop)

    def test_workbox_failure_restores_previous_generated_files(self):
        service_worker = self.docs_dir / "sw.js"
        runtime = self.docs_dir / "workbox-old.js"
        service_worker.write_text("old worker", encoding="utf-8")
        runtime.write_text("old runtime", encoding="utf-8")

        def fail_after_writing(*_args, **_kwargs):
            service_worker.write_text("partial worker", encoding="utf-8")
            (self.docs_dir / "workbox-new.js").write_text(
                "partial runtime",
                encoding="utf-8",
            )
            raise subprocess.CalledProcessError(1, "workbox")

        with mock.patch.object(
            deploy.subprocess, "run", side_effect=fail_after_writing
        ):
            with self.assertRaises(subprocess.CalledProcessError):
                deploy.generate_service_worker()

        self.assertEqual(service_worker.read_text(encoding="utf-8"), "old worker")
        self.assertEqual(runtime.read_text(encoding="utf-8"), "old runtime")
        self.assertFalse((self.docs_dir / "workbox-new.js").exists())

    def test_cleanup_only_removes_files_owned_by_ruffle_manifest(self):
        tracked_old = self.js_dir / "old-runtime.wasm"
        unrelated = self.js_dir / "custom-engine.wasm"
        tracked_old.write_bytes(b"old")
        unrelated.write_bytes(b"keep")
        deploy.RUFFLE_MANIFEST_PATH.write_text(
            json.dumps({"files": [tracked_old.name]}),
            encoding="utf-8",
        )

        deploy.cleanup_old_files({"ruffle.js"})

        self.assertFalse(tracked_old.exists())
        self.assertTrue(unrelated.exists())
        self.assertEqual(
            json.loads(deploy.RUFFLE_MANIFEST_PATH.read_text(encoding="utf-8")),
            {"files": ["ruffle.js"]},
        )

    def test_successful_workbox_generation_keeps_only_referenced_runtime(self):
        stale_runtime = self.docs_dir / "workbox-deadbeef.js"
        stale_runtime.write_text("stale", encoding="utf-8")

        def generate_worker(*_args, **_kwargs):
            (self.docs_dir / "sw.js").write_text(
                's("workbox-f9030226", import.meta.url)',
                encoding="utf-8",
            )
            (self.docs_dir / "workbox-f9030226.js").write_text(
                "runtime",
                encoding="utf-8",
            )

        with mock.patch.object(deploy.subprocess, "run", side_effect=generate_worker):
            deploy.generate_service_worker()

        self.assertFalse(stale_runtime.exists())
        self.assertTrue((self.docs_dir / "workbox-f9030226.js").exists())

    def test_invalid_generated_worker_restores_previous_files(self):
        service_worker = self.docs_dir / "sw.js"
        runtime = self.docs_dir / "workbox-old.js"
        service_worker.write_text("old worker", encoding="utf-8")
        runtime.write_text("old runtime", encoding="utf-8")

        def generate_invalid_worker(*_args, **_kwargs):
            service_worker.write_text("no runtime import", encoding="utf-8")

        with mock.patch.object(
            deploy.subprocess,
            "run",
            side_effect=generate_invalid_worker,
        ):
            with self.assertRaisesRegex(RuntimeError, "references no Workbox"):
                deploy.generate_service_worker()

        self.assertEqual(service_worker.read_text(encoding="utf-8"), "old worker")
        self.assertEqual(runtime.read_text(encoding="utf-8"), "old runtime")

    def test_deploy_propagates_download_failure(self):
        with mock.patch.object(
            deploy,
            "download_ruffle",
            side_effect=RuntimeError("network failed"),
        ):
            with self.assertRaisesRegex(RuntimeError, "network failed"):
                deploy.deploy()

    def test_deploy_failure_restores_all_managed_files(self):
        html = self.docs_dir / "index.html"
        main = self.js_dir / "main.js"
        manifest = self.js_dir / "ruffle-manifest.json"
        old_runtime = self.js_dir / "core.ruffle.old.js"
        old_worker = self.docs_dir / "sw.js"
        old_workbox = self.docs_dir / "workbox-old.js"
        originals = {
            html: b"old html",
            main: b'const APP_VERSION = "26.07.27";',
            manifest: b'{"files":["core.ruffle.old.js"]}',
            old_runtime: b"old runtime",
            old_worker: b"old worker",
            old_workbox: b"old workbox",
        }
        for path, content in originals.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)

        new_runtime = self.js_dir / "core.ruffle.new.js"
        new_workbox = self.docs_dir / "workbox-new.js"

        def download():
            new_runtime.write_bytes(b"new runtime")
            return {"core.ruffle.new.js"}

        def update():
            html.write_text("new html", encoding="utf-8")
            main.write_text(
                'const APP_VERSION = "26.07.28";',
                encoding="utf-8",
            )

        def fail_workbox():
            old_worker.write_text("partial worker", encoding="utf-8")
            new_workbox.write_text("new workbox", encoding="utf-8")
            raise RuntimeError("workbox failed")

        with (
            mock.patch.object(deploy, "download_ruffle", side_effect=download),
            mock.patch.object(deploy, "update_html", side_effect=update),
            mock.patch.object(
                deploy,
                "generate_service_worker",
                side_effect=fail_workbox,
            ),
        ):
            with self.assertRaisesRegex(RuntimeError, "workbox failed"):
                deploy.deploy()

        for path, content in originals.items():
            self.assertEqual(path.read_bytes(), content)
        self.assertFalse(new_runtime.exists())
        self.assertFalse(new_workbox.exists())

    def test_workbox_ignores_cache_busting_version_parameter(self):
        project_dir = Path(__file__).resolve().parents[1]
        config = (project_dir / "workbox-config.js").read_text(encoding="utf-8")
        self.assertRegex(
            config,
            r"ignoreURLParametersMatching:\s*\[[^\]]*/\^v\$/",
        )
        generated_worker = (project_dir / "docs" / "sw.js").read_text(
            encoding="utf-8",
        )
        self.assertIn(
            "ignoreURLParametersMatching:[/^utm_/,/^fbclid$/,/^v$/]",
            generated_worker,
        )

    def test_checked_in_asset_hashes_match_sources(self):
        project_dir = Path(__file__).resolve().parents[1]
        html = (project_dir / "docs" / "index.html").read_text(encoding="utf-8")
        asset_urls = {
            "ruffle": "js/ruffle.js",
            "games_js": "js/games.js",
            "filesystem_js": "js/filesystem.js",
            "file_operations_js": "js/file-operations.js",
            "dialogs_js": "js/dialogs.js",
            "main_js": "js/main.js",
            "main_css": "css/main.css",
        }
        for name, url in asset_urls.items():
            expected_hash = deploy.get_short_hash(deploy.ASSET_PATHS[name])
            self.assertIn(f'{url}?v={expected_hash}"', html, name)

    def test_update_html_updates_app_version_before_hashing_main(self):
        html_path = self.docs_dir / "index.html"
        css_dir = self.docs_dir / "css"
        css_dir.mkdir()

        assets = {
            "ruffle": self.js_dir / "ruffle.js",
            "games_js": self.js_dir / "games.js",
            "filesystem_js": self.js_dir / "filesystem.js",
            "file_operations_js": self.js_dir / "file-operations.js",
            "dialogs_js": self.js_dir / "dialogs.js",
            "main_js": self.js_dir / "main.js",
            "main_css": css_dir / "main.css",
        }
        for name, path in assets.items():
            content = (
                'const APP_VERSION = "26.07.27-2";\n' if name == "main_js" else name
            )
            path.write_text(content, encoding="utf-8")

        html_path.write_text(
            "\n".join(
                [
                    '<script src="js/ruffle.js?v=old"></script>',
                    '<script src="js/games.js?v=old"></script>',
                    '<script src="js/filesystem.js?v=old"></script>',
                    '<script src="js/file-operations.js?v=old"></script>',
                    '<script src="js/dialogs.js?v=old"></script>',
                    '<script src="js/main.js?v=old"></script>',
                    '<link rel="stylesheet" href="css/main.css?v=old">',
                ]
            ),
            encoding="utf-8",
        )

        with (
            mock.patch.object(deploy, "HTML_PATH", html_path),
            mock.patch.object(deploy, "MAIN_JS_PATH", assets["main_js"]),
            mock.patch.object(deploy, "ASSET_PATHS", assets),
            mock.patch.object(deploy, "get_next_version", return_value="26.07.28"),
        ):
            deploy.update_html()

        main_javascript = assets["main_js"].read_text(encoding="utf-8")
        self.assertIn('const APP_VERSION = "26.07.28";', main_javascript)
        expected_hash = deploy.get_short_hash(assets["main_js"])
        deployed_html = html_path.read_text(encoding="utf-8")
        self.assertRegex(
            deployed_html,
            rf'<script src="js/main\.js\?v={re.escape(expected_hash)}"></script>',
        )
        file_operations_hash = deploy.get_short_hash(assets["file_operations_js"])
        self.assertRegex(
            deployed_html,
            (
                r'<script src="js/file-operations\.js\?v='
                rf'{re.escape(file_operations_hash)}"></script>'
            ),
        )

    def test_get_current_version_reads_main_javascript(self):
        main_javascript = self.js_dir / "main.js"
        main_javascript.write_text(
            'const APP_VERSION = "26.07.27-2";\n',
            encoding="utf-8",
        )

        with mock.patch.object(deploy, "MAIN_JS_PATH", main_javascript):
            self.assertEqual(deploy.get_current_version(), "26.07.27-2")

    def test_get_main_version_reads_committed_main_branch(self):
        main_javascript = self.js_dir / "main.js"
        main_javascript.write_text(
            'const APP_VERSION = "99.12.31-99";\n',
            encoding="utf-8",
        )
        completed = subprocess.CompletedProcess(
            args=[],
            returncode=0,
            stdout='const APP_VERSION = "26.07.28-3";\n',
            stderr="",
        )

        with mock.patch.object(
            deploy.subprocess,
            "run",
            return_value=completed,
        ) as run:
            self.assertEqual(deploy.get_main_version(), "26.07.28-3")

        run.assert_called_once_with(
            ["git", "show", "main:docs/js/main.js"],
            cwd=self.project_dir,
            check=True,
            capture_output=True,
            text=True,
        )

    def test_get_main_version_fails_when_main_cannot_be_read(self):
        with mock.patch.object(
            deploy.subprocess,
            "run",
            side_effect=subprocess.CalledProcessError(128, ["git", "show"]),
        ):
            with self.assertRaisesRegex(
                RuntimeError,
                'Could not read APP_VERSION from the "main" branch',
            ):
                deploy.get_main_version()

    def test_next_version_only_increments_version_from_main(self):
        (self.js_dir / "main.js").write_text(
            'const APP_VERSION = "26.07.28-99";\n',
            encoding="utf-8",
        )

        with mock.patch.object(
            deploy,
            "get_main_version",
            return_value="26.07.28-3",
        ):
            self.assertEqual(deploy.get_next_version("26.07.28"), "26.07.28-4")

    def test_next_version_uses_new_date_after_main(self):
        with mock.patch.object(
            deploy,
            "get_main_version",
            return_value="26.07.27-8",
        ):
            self.assertEqual(deploy.get_next_version("26.07.28"), "26.07.28")

    def test_next_version_never_decreases_if_main_is_ahead(self):
        with mock.patch.object(
            deploy,
            "get_main_version",
            return_value="26.07.29-2",
        ):
            self.assertEqual(deploy.get_next_version("26.07.28"), "26.07.29-3")


if __name__ == "__main__":
    unittest.main()
