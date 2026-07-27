import io
import hashlib
import json
import re
import subprocess
import sys
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path

import requests


PROJECT_DIR = Path(__file__).resolve().parents[1]
DOCS_DIR = PROJECT_DIR / "docs"
JS_DIR = DOCS_DIR / "js"
CSS_DIR = DOCS_DIR / "css"
HTML_PATH = DOCS_DIR / "index.html"
RUFFLE_MANIFEST_PATH = JS_DIR / "ruffle-manifest.json"
RUFFLE_LATEST_RELEASE_URL = "https://api.github.com/repos/ruffle-rs/ruffle/releases/latest"
RUFFLE_ASSET_SUFFIX = "-web-selfhosted.zip"
RUFFLE_FILE_SUFFIXES = (".js", ".js.map", ".wasm")

ASSET_PATHS = {
    'ruffle': JS_DIR / "ruffle.js",
    'games_js': JS_DIR / "games.js",
    'filesystem_js': JS_DIR / "filesystem.js",
    'main_js': JS_DIR / "main.js",
    'main_css': CSS_DIR / "main.css"
}

def download_ruffle():
    """Download and install the latest stable self-hosted Ruffle web package."""
    JS_DIR.mkdir(parents=True, exist_ok=True)
    print("Finding latest stable Ruffle release...")

    release_response = requests.get(RUFFLE_LATEST_RELEASE_URL, timeout=30)
    release_response.raise_for_status()
    release = release_response.json()
    asset = next(
        (
            item for item in release.get("assets", [])
            if item.get("name", "").endswith(RUFFLE_ASSET_SUFFIX)
        ),
        None,
    )
    if asset is None:
        raise ValueError("Latest Ruffle release has no self-hosted web package")

    version = release.get("tag_name", "unknown")
    print(f"Downloading Ruffle {version}...")
    archive_response = requests.get(
        asset["browser_download_url"],
        timeout=120,
    )
    archive_response.raise_for_status()

    with zipfile.ZipFile(io.BytesIO(archive_response.content)) as archive:
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
        or not any(name.startswith("core.ruffle.") and name.endswith(".js") for name in files)
        or not any(name.endswith(".wasm") for name in files)
    ):
        raise ValueError("Downloaded Ruffle package is missing required runtime files")

    for filename, content in files.items():
        write_bytes_atomic(JS_DIR / filename, content)
        print(f"  - Installed {filename}")

    return set(files)


def write_bytes_atomic(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as temporary:
        temporary.write(content)
        temporary_path = Path(temporary.name)
    temporary_path.replace(path)


def write_text_atomic(path, content):
    write_bytes_atomic(path, content.encode("utf-8"))


def get_short_hash(file_path):
    """Get first 8 characters of the file's hash for cache busting"""
    sha384 = hashlib.sha384()
    sha384.update(file_path.read_bytes())
    return sha384.hexdigest()[:8]

def get_current_version():
    if not HTML_PATH.exists():
        return None
    content = HTML_PATH.read_text(encoding="utf-8")
    version_match = re.search(r'<h6>v([0-9.]+(?:-\d+)?)</h6>', content)
    return version_match.group(1) if version_match else None

def get_next_version():
    today = datetime.now().strftime("%y.%m.%d")
    current = get_current_version()
    
    if not current:
        return today
    
    if current.startswith(today):
        build_match = re.search(r'-(\d+)$', current)
        build_num = int(build_match.group(1)) + 1 if build_match else 1
        return f"{today}-{build_num}"
    
    return today

def update_html():
    version_str = get_next_version()
    print("Updating HTML with cache-busting hashes...")
    
    short_hashes = {name: get_short_hash(path) for name, path in ASSET_PATHS.items()}
    
    content = HTML_PATH.read_text(encoding="utf-8")

    replacements = {
        r'<script src="js/ruffle\.[^"]+" ?[^>]*></script>': 
            f'<script src="js/ruffle.js?v={short_hashes["ruffle"]}"></script>',
        r'<script src="js/games\.[^"]+" ?[^>]*></script>':
            f'<script src="js/games.js?v={short_hashes["games_js"]}"></script>',
        r'<script src="js/filesystem\.[^"]+" ?[^>]*></script>':
            f'<script src="js/filesystem.js?v={short_hashes["filesystem_js"]}"></script>',
        r'<script src="js/main\.[^"]+" ?[^>]*></script>':
            f'<script src="js/main.js?v={short_hashes["main_js"]}"></script>',
        r'<link rel="stylesheet" href="css/main\.[^"]+" ?[^>]*>':
            f'<link rel="stylesheet" href="css/main.css?v={short_hashes["main_css"]}">',
        r'<h6>v[0-9.]+(?:-\d+)?</h6>':
            f'<h6>v{version_str}</h6>'
    }
    
    for pattern, replacement in replacements.items():
        content = re.sub(pattern, replacement, content)

    write_text_atomic(HTML_PATH, content)
    print(f"  - Updated to version {version_str}")


def read_ruffle_manifest():
    if not RUFFLE_MANIFEST_PATH.exists():
        return set()
    try:
        manifest = json.loads(RUFFLE_MANIFEST_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return set()
    return {
        filename
        for filename in manifest.get("files", [])
        if isinstance(filename, str) and Path(filename).name == filename
    }


def write_ruffle_manifest(current_files):
    manifest = json.dumps({"files": sorted(current_files)}, indent=2) + "\n"
    write_text_atomic(RUFFLE_MANIFEST_PATH, manifest)


def cleanup_old_files(current_files):
    if not JS_DIR.exists():
        return

    print("Cleaning up old files...")
    previous_files = read_ruffle_manifest()
    for filename in previous_files - current_files:
        file = JS_DIR / filename
        if file.is_file():
            file.unlink()
            print(f"  - Removed {filename}")
    write_ruffle_manifest(current_files)


def get_workbox_files():
    patterns = ("sw.js", "sw.js.map", "workbox-*.js", "workbox-*.js.map")
    files = set()
    for pattern in patterns:
        files.update(path for path in DOCS_DIR.glob(pattern) if path.is_file())
    return files


def generate_service_worker():
    print("Generating service worker...")
    previous_files = get_workbox_files()
    backups = {path: path.read_bytes() for path in previous_files}
    try:
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
            cwd=PROJECT_DIR,
        )

        current_files = get_workbox_files()
        generated_worker = DOCS_DIR / "sw.js"
        if generated_worker not in current_files:
            raise RuntimeError("Workbox did not generate docs/sw.js")

        worker_source = generated_worker.read_text(encoding="utf-8")
        referenced_runtime_names = {
            f"{name}.js" if not name.endswith(".js") else name
            for name in re.findall(r"workbox-[a-f0-9]+(?:\.js)?", worker_source)
        }
        if not referenced_runtime_names:
            raise RuntimeError("Generated service worker references no Workbox runtime")
        if not all((DOCS_DIR / name).is_file() for name in referenced_runtime_names):
            raise RuntimeError("Generated service worker references a missing Workbox runtime")

        for path in previous_files - current_files:
            path.unlink()
        for path in current_files:
            if (
                path.name.startswith("workbox-")
                and path.name not in referenced_runtime_names
            ):
                path.unlink()
    except (subprocess.CalledProcessError, FileNotFoundError, OSError, RuntimeError):
        for path in get_workbox_files() - previous_files:
            path.unlink()
        for path, content in backups.items():
            write_bytes_atomic(path, content)
        raise
    print("  - Service worker generated successfully")

def deploy():
    print("\nStarting deployment...")
    ruffle_files = download_ruffle()
    cleanup_old_files(ruffle_files)
    update_html()
    generate_service_worker()
    print("\nDeployment completed successfully!")

if __name__ == "__main__":
    try:
        deploy()
    except Exception as error:
        print(f"\nError during deployment: {error}", file=sys.stderr)
        raise SystemExit(1) from error
