import requests
import subprocess
import re
import hashlib
from datetime import datetime
from pathlib import Path

# Constants
DOCS_DIR = Path("docs")
JS_DIR = DOCS_DIR / "js"
CSS_DIR = DOCS_DIR / "css"
HTML_PATH = DOCS_DIR / "index.html"

ASSET_PATHS = {
    'ruffle': JS_DIR / "ruffle.js",
    'main_js': JS_DIR / "main.js",
    'main_css': CSS_DIR / "main.css"
}

def extract_ruffle_assets(content):
    """Extract the core Ruffle filename and associated wasm assets."""
    core_match = re.search(r'r\.u=e=>"core\.ruffle\."\+\{[^}]*\d+:"([a-f0-9]+)"', content)
    wasm_matches = re.findall(r'e\.exports=t\.p\+"([a-f0-9]+\.wasm)"', content)

    if not core_match or not wasm_matches:
        raise ValueError("Could not find core or wasm file names in ruffle.js")

    core_file = f"core.ruffle.{core_match.group(1)}.js"
    return core_file, wasm_matches

def download_ruffle():
    JS_DIR.mkdir(parents=True, exist_ok=True)
    base_url = "https://unpkg.com/@ruffle-rs/ruffle"
    print("Downloading Ruffle files...")

    # Download and save ruffle.js
    response = requests.get(f"{base_url}/ruffle.js")
    with open(ASSET_PATHS['ruffle'], 'w') as f:
        f.write(response.text)

    # Extract filenames and download dependencies
    core_file, wasm_matches = extract_ruffle_assets(response.text)
    files_to_download = [core_file] + wasm_matches
    
    for filename in files_to_download:
        print(f"  - Downloading {filename}")
        response = requests.get(f"{base_url}/{filename}")
        mode = 'wb' if filename.endswith('.wasm') else 'w'
        with open(JS_DIR / filename, mode) as f:
            f.write(response.content if mode == 'wb' else response.text)

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

def cleanup_old_files():
    if not JS_DIR.exists():
        return
        
    print("Cleaning up old files...")
    
    # Skip cleanup if ruffle.js doesn't exist yet
    if not ASSET_PATHS['ruffle'].exists():
        return
        
    with open(ASSET_PATHS['ruffle'], 'r') as f:
        current_content = f.read()

    try:
        current_core, wasm_matches = extract_ruffle_assets(current_content)
    except ValueError:
        return

    current_wasms = set(wasm_matches)

    for file in JS_DIR.iterdir():
        if file.name.startswith("core.ruffle.") and file.name.endswith(".js"):
            if file.name != current_core:
                file.unlink()
                print(f"  - Removed {file.name}")
        elif file.name.endswith(".wasm"):
            if file.name not in current_wasms:
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
        download_ruffle()
        cleanup_old_files()
        update_html()
        generate_service_worker()
        print("\nDeployment completed successfully!")
    except Exception as e:
        print(f"\nError during deployment: {e}")

if __name__ == "__main__":
    deploy()
