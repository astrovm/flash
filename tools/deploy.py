import io
import requests
import subprocess
import re
import hashlib
import zipfile
from datetime import datetime
from pathlib import Path

# Constants
DOCS_DIR = Path("docs")
JS_DIR = DOCS_DIR / "js"
CSS_DIR = DOCS_DIR / "css"
HTML_PATH = DOCS_DIR / "index.html"
RUFFLE_LATEST_RELEASE_URL = "https://api.github.com/repos/ruffle-rs/ruffle/releases/latest"
RUFFLE_ASSET_SUFFIX = "-web-selfhosted.zip"
RUFFLE_FILE_SUFFIXES = (".js", ".js.map", ".wasm")

ASSET_PATHS = {
    'ruffle': JS_DIR / "ruffle.js",
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
        (JS_DIR / filename).write_bytes(content)
        print(f"  - Installed {filename}")

    return set(files)

def get_short_hash(file_path):
    """Get first 8 characters of the file's hash for cache busting"""
    sha384 = hashlib.sha384()
    mode = 'rb' if str(file_path).endswith('.wasm') else 'r'
    with open(file_path, mode) as f:
        content = f.read()
        if mode == 'r':
            content = content.encode()
        sha384.update(content)
    return sha384.hexdigest()[:8]

def get_current_version():
    if not HTML_PATH.exists():
        return None
    with open(HTML_PATH, "r") as f:
        content = f.read()
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
    
    with open(HTML_PATH, "r") as f:
        content = f.read()

    replacements = {
        r'<script src="js/ruffle\.[^"]+" ?[^>]*></script>': 
            f'<script src="js/ruffle.js?v={short_hashes["ruffle"]}"></script>',
        r'<script src="js/main\.[^"]+" ?[^>]*></script>':
            f'<script src="js/main.js?v={short_hashes["main_js"]}"></script>',
        r'<link rel="stylesheet" href="css/main\.[^"]+" ?[^>]*>':
            f'<link rel="stylesheet" href="css/main.css?v={short_hashes["main_css"]}">',
        r'<h6>v[0-9.]+(?:-\d+)?</h6>':
            f'<h6>v{version_str}</h6>'
    }
    
    for pattern, replacement in replacements.items():
        content = re.sub(pattern, replacement, content)

    with open(HTML_PATH, "w") as f:
        f.write(content)
    print(f"  - Updated to version {version_str}")

def cleanup_old_files(current_files):
    if not JS_DIR.exists():
        return

    print("Cleaning up old files...")

    for file in JS_DIR.iterdir():
        is_ruffle_asset = (
            file.name.startswith("core.ruffle.")
            or file.name.endswith(".wasm")
            or file.name == "ruffle.js.map"
        )
        if is_ruffle_asset and file.name not in current_files:
            file.unlink()
            print(f"  - Removed {file.name}")

def cleanup_workbox_files():
    patterns = ["sw.js", "sw.js.map", "workbox-*.js", "workbox-*.js.map"]

    for pattern in patterns:
        for file in DOCS_DIR.glob(pattern):
            file.unlink()

def generate_service_worker():
    print("Generating service worker...")
    try:
        cleanup_workbox_files()
        subprocess.run(["bunx", "workbox", "generateSW", "workbox-config.js"], check=True)
        print("  - Service worker generated successfully")
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(f"Error generating service worker: {e}")

def deploy():
    try:
        print("\nStarting deployment...")
        ruffle_files = download_ruffle()
        cleanup_old_files(ruffle_files)
        update_html()
        generate_service_worker()
        print("\nDeployment completed successfully!")
    except Exception as e:
        print(f"\nError during deployment: {e}")

if __name__ == "__main__":
    deploy()
