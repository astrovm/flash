import json
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

        with mock.patch.object(deploy.subprocess, "run", side_effect=fail_after_writing):
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


if __name__ == "__main__":
    unittest.main()
