import argparse
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path

import requests


PROJECT_DIR = Path(__file__).resolve().parents[1]
SOURCE_DIR = PROJECT_DIR / "site"
DEFAULT_OUTPUT_DIR = PROJECT_DIR / "dist"
RUFFLE_RELEASE_PATH = PROJECT_DIR / "tools" / "ruffle-release.json"
RUFFLE_DOWNLOAD_ROOT = "https://github.com/ruffle-rs/ruffle/releases/download"
RUFFLE_FILE_SUFFIXES = (".js", ".js.map", ".wasm")
APP_VERSION_PATTERN = re.compile(r'const APP_VERSION = "[^"]+";')


@dataclass(frozen=True)
class BuildPaths:
    root: Path

    @property
    def js(self):
        return self.root / "js"

    @property
    def css(self):
        return self.root / "css"

    @property
    def html(self):
        return self.root / "index.html"

    @property
    def main_js(self):
        return self.js / "main.js"

    @property
    def asset_paths(self):
        return {
            "ruffle": self.js / "ruffle.js",
            "games_js": self.js / "games.js",
            "filesystem_js": self.js / "filesystem.js",
            "file_operations_js": self.js / "file-operations.js",
            "dialogs_js": self.js / "dialogs.js",
            "main_js": self.main_js,
            "main_css": self.css / "main.css",
        }


def load_ruffle_release(path=RUFFLE_RELEASE_PATH):
    release = json.loads(path.read_text(encoding="utf-8"))
    required = {"tag", "asset", "sha256"}
    if set(release) != required:
        raise ValueError("Ruffle release metadata must contain tag, asset, and sha256")
    if not re.fullmatch(r"v\d+\.\d+\.\d+", release["tag"]):
        raise ValueError("Ruffle release tag is invalid")
    if not release["asset"].endswith("-web-selfhosted.zip"):
        raise ValueError("Ruffle release asset is not the self-hosted web package")
    if not re.fullmatch(r"[a-f0-9]{64}", release["sha256"]):
        raise ValueError("Ruffle release checksum is invalid")
    return release


def ruffle_download_url(release):
    return f"{RUFFLE_DOWNLOAD_ROOT}/{release['tag']}/{release['asset']}"


def download_ruffle(js_dir, release=None, session=requests):
    """Download, verify, and install the pinned self-hosted Ruffle package."""
    release = release or load_ruffle_release()
    js_dir.mkdir(parents=True, exist_ok=True)
    print(f"Downloading Ruffle {release['tag']}...")

    response = session.get(ruffle_download_url(release), timeout=120)
    response.raise_for_status()
    actual_checksum = hashlib.sha256(response.content).hexdigest()
    if actual_checksum != release["sha256"]:
        raise ValueError(
            "Ruffle archive checksum mismatch: "
            f"expected {release['sha256']}, got {actual_checksum}"
        )

    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        files = {
            Path(info.filename).name: archive.read(info)
            for info in archive.infolist()
            if (
                not info.is_dir()
                and Path(info.filename).parent == Path(".")
                and info.filename.endswith(RUFFLE_FILE_SUFFIXES)
            )
        }

    if (
        "ruffle.js" not in files
        or not any(
            name.startswith("core.ruffle.") and name.endswith(".js") for name in files
        )
        or not any(name.endswith(".wasm") for name in files)
    ):
        raise ValueError("Downloaded Ruffle package is missing required runtime files")

    for filename, content in files.items():
        (js_dir / filename).write_bytes(content)
    print(f"  - Installed {len(files)} Ruffle runtime files")


def get_short_hash(file_path):
    sha384 = hashlib.sha384()
    sha384.update(file_path.read_bytes())
    return sha384.hexdigest()[:8]


def run_git(arguments, project_dir=PROJECT_DIR):
    try:
        result = subprocess.run(
            ["git", *arguments],
            cwd=project_dir,
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError) as error:
        raise RuntimeError(
            f"Could not resolve deployment revision with git {' '.join(arguments)}"
        ) from error
    return result.stdout.strip()


def get_deployment_version(revision="HEAD", project_dir=PROJECT_DIR):
    commit_date = run_git(
        ["show", "-s", "--format=%cs", revision],
        project_dir=project_dir,
    )
    short_revision = run_git(
        ["rev-parse", "--short=7", revision],
        project_dir=project_dir,
    )
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", commit_date):
        raise RuntimeError(f"Git returned an invalid commit date: {commit_date}")
    if not re.fullmatch(r"[a-f0-9]{7,}", short_revision):
        raise RuntimeError(f"Git returned an invalid revision: {short_revision}")
    year, month, day = commit_date.split("-")
    return f"{year[2:]}.{month}.{day}-{short_revision[:7]}"


def update_html(paths, version):
    print("Updating output with version and cache-busting hashes...")
    main_javascript = paths.main_js.read_text(encoding="utf-8")
    main_javascript, replacements = APP_VERSION_PATTERN.subn(
        f'const APP_VERSION = "{version}";',
        main_javascript,
    )
    if replacements != 1:
        raise RuntimeError("Could not update APP_VERSION in output js/main.js")
    paths.main_js.write_text(main_javascript, encoding="utf-8")

    short_hashes = {
        name: get_short_hash(path) for name, path in paths.asset_paths.items()
    }
    content = paths.html.read_text(encoding="utf-8")
    replacements = {
        r'<script src="js/ruffle\.[^"]+" ?[^>]*></script>': (
            f'<script src="js/ruffle.js?v={short_hashes["ruffle"]}"></script>'
        ),
        r'<script src="js/games\.[^"]+" ?[^>]*></script>': (
            f'<script src="js/games.js?v={short_hashes["games_js"]}"></script>'
        ),
        r'<script src="js/filesystem\.[^"]+" ?[^>]*></script>': (
            f'<script src="js/filesystem.js?v={short_hashes["filesystem_js"]}"></script>'
        ),
        r'<script src="js/file-operations\.[^"]+" ?[^>]*></script>': (
            '<script src="js/file-operations.js?'
            f'v={short_hashes["file_operations_js"]}"></script>'
        ),
        r'<script src="js/dialogs\.[^"]+" ?[^>]*></script>': (
            f'<script src="js/dialogs.js?v={short_hashes["dialogs_js"]}"></script>'
        ),
        r'<script src="js/main\.[^"]+" ?[^>]*></script>': (
            f'<script src="js/main.js?v={short_hashes["main_js"]}"></script>'
        ),
        r'<link rel="stylesheet" href="css/main\.[^"]+" ?[^>]*>': (
            f'<link rel="stylesheet" href="css/main.css?v={short_hashes["main_css"]}">'
        ),
    }
    for pattern, replacement in replacements.items():
        content, count = re.subn(pattern, replacement, content)
        if count != 1:
            raise RuntimeError(f"Could not update asset reference matching {pattern}")
    paths.html.write_text(content, encoding="utf-8")
    print(f"  - Set deployment version to {version}")


def get_workbox_files(output_dir):
    patterns = ("sw.js", "sw.js.map", "workbox-*.js", "workbox-*.js.map")
    files = set()
    for pattern in patterns:
        files.update(path for path in output_dir.glob(pattern) if path.is_file())
    return files


def generate_service_worker(output_dir, project_dir=PROJECT_DIR):
    print("Generating service worker...")
    environment = dict(os.environ)
    environment["SITE_OUTPUT_DIR"] = str(output_dir.resolve())
    subprocess.run(
        [
            "bunx",
            "--package",
            "workbox-cli",
            "workbox",
            "generateSW",
            "workbox-config.js",
        ],
        check=True,
        cwd=project_dir,
        env=environment,
    )

    service_worker = output_dir / "sw.js"
    if not service_worker.is_file():
        raise RuntimeError("Workbox did not generate output sw.js")
    worker_source = service_worker.read_text(encoding="utf-8")
    referenced_runtime_names = {
        f"{name}.js" if not name.endswith(".js") else name
        for name in re.findall(r"workbox-[a-f0-9]+(?:\.js)?", worker_source)
    }
    if not referenced_runtime_names:
        raise RuntimeError("Generated service worker references no Workbox runtime")
    if not all((output_dir / name).is_file() for name in referenced_runtime_names):
        raise RuntimeError(
            "Generated service worker references a missing Workbox runtime"
        )
    for path in get_workbox_files(output_dir):
        if (
            path.name.startswith("workbox-")
            and path.name not in referenced_runtime_names
        ):
            path.unlink()
    print("  - Service worker generated successfully")


def validate_output(output_dir):
    paths = BuildPaths(output_dir)
    required = (
        paths.html,
        output_dir / "sw.js",
        output_dir / "swf" / "bike-mania" / "main.swf",
        output_dir / "iframe" / "doom" / "index.html",
        output_dir / "iframe" / "inside-the-firewall" / "index.html",
        output_dir / "dos" / "doom" / "doom.jsdos",
    )
    missing = [path.relative_to(output_dir) for path in required if not path.is_file()]
    if missing:
        raise RuntimeError(f"Build output is missing required files: {missing}")

    html = paths.html.read_text(encoding="utf-8")
    for asset in (
        "js/ruffle.js",
        "js/games.js",
        "js/filesystem.js",
        "js/file-operations.js",
        "js/dialogs.js",
        "js/main.js",
        "css/main.css",
    ):
        if not re.search(rf'{re.escape(asset)}\?v=[a-f0-9]{{8}}"', html):
            raise RuntimeError(f"Build output has no hashed reference for {asset}")
    if not any(paths.js.glob("core.ruffle.*.js")):
        raise RuntimeError("Build output has no Ruffle core JavaScript")
    if not any(paths.js.glob("*.wasm")):
        raise RuntimeError("Build output has no Ruffle WebAssembly")
    print("Build output validated successfully")


def replace_output(staging_dir, output_dir):
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    backup_dir = staging_dir.parent / "previous-output"
    if output_dir.exists():
        output_dir.replace(backup_dir)
    try:
        staging_dir.replace(output_dir)
    except Exception:
        if backup_dir.exists():
            backup_dir.replace(output_dir)
        raise


def build(output_dir=DEFAULT_OUTPUT_DIR, revision="HEAD"):
    output_dir = Path(output_dir).resolve()
    source_dir = SOURCE_DIR.resolve()
    if output_dir == source_dir or source_dir in output_dir.parents:
        raise ValueError("Build output must be outside the site source directory")

    version = get_deployment_version(revision)
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(
        dir=output_dir.parent,
        prefix=f".{output_dir.name}-build-",
    ) as temporary_directory:
        staging_dir = Path(temporary_directory) / "output"
        shutil.copytree(source_dir, staging_dir)
        paths = BuildPaths(staging_dir)
        download_ruffle(paths.js)
        update_html(paths, version)
        generate_service_worker(staging_dir)
        validate_output(staging_dir)
        replace_output(staging_dir, output_dir)
    print(f"Build completed successfully: {output_dir}")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Build the static site into a deployable directory."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Output directory (default: dist/)",
    )
    parser.add_argument(
        "--revision",
        default="HEAD",
        help="Git revision used for the deployment version (default: HEAD)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    build(arguments.output, arguments.revision)
