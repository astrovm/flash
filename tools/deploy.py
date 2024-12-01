import requests
import subprocess
import re
import hashlib
import base64
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

def download_ruffle():
    JS_DIR.mkdir(parents=True, exist_ok=True)
    base_url = "https://unpkg.com/@ruffle-rs/ruffle"
    print("Downloading Ruffle files...")
    
    # Download and save ruffle.js
    response = requests.get(f"{base_url}/ruffle.js")
    with open(ASSET_PATHS['ruffle'], 'w') as f:
        f.write(response.text)
    
    # Extract filenames and download dependencies
    core_match = re.search(r'r\.u=e=>"core\.ruffle\."\+{[^}]*69:"([a-f0-9]+)"', response.text)
    wasm_match = re.search(r'"([a-f0-9]+\.wasm)"', response.text)
    
    if not core_match or not wasm_match:
        raise Exception("Could not find core or wasm file names in ruffle.js")
    
    core_file = f"core.ruffle.{core_match.group(1)}.js"
    wasm_file = wasm_match.group(1)
    
    for filename in [core_file, wasm_file]:
        print(f"  - Downloading {filename}")
        response = requests.get(f"{base_url}/{filename}")
        mode = 'wb' if filename.endswith('.wasm') else 'w'
        with open(JS_DIR / filename, mode) as f:
            f.write(response.content if mode == 'wb' else response.text)

def get_file_hash(file_path):
    sha384 = hashlib.sha384()
    mode = 'rb' if str(file_path).endswith('.wasm') else 'r'
    with open(file_path, mode) as f:
        content = f.read()
        if mode == 'r':
            content = content.encode()
        sha384.update(content)
    return f"sha384-{base64.b64encode(sha384.digest()).decode('utf-8')}"

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
    print("Updating HTML with integrity hashes...")
    integrity_hashes = {name: get_file_hash(path) for name, path in ASSET_PATHS.items()}
    
    with open(HTML_PATH, "r") as f:
        content = f.read()

    replacements = {
        r'<script src="js/ruffle\.[^"]+" ?[^>]*>': 
            f'<script src="js/ruffle.js" integrity="{integrity_hashes["ruffle"]}" crossorigin="anonymous">',
        r'<script src="js/main\.[^"]+" ?[^>]*>':
            f'<script src="js/main.js" integrity="{integrity_hashes["main_js"]}" crossorigin="anonymous">',
        r'<link rel="stylesheet" href="css/main\.[^"]+" ?[^>]*>':
            f'<link rel="stylesheet" href="css/main.css" integrity="{integrity_hashes["main_css"]}" crossorigin="anonymous">',
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
    
    core_match = re.search(r'r\.u=e=>"core\.ruffle\."\+{[^}]*69:"([a-f0-9]+)"', current_content)
    wasm_match = re.search(r'"([a-f0-9]+\.wasm)"', current_content)
    
    if core_match and wasm_match:
        current_core = f"core.ruffle.{core_match.group(1)}.js"
        current_wasm = wasm_match.group(1)
        
        for file in JS_DIR.iterdir():
            if file.name.startswith("core.ruffle.") and file.name.endswith(".js"):
                if file.name != current_core:
                    file.unlink()
                    print(f"  - Removed {file.name}")
            elif file.name.endswith(".wasm"):
                if file.name != current_wasm:
                    file.unlink()
                    print(f"  - Removed {file.name}")

def cleanup_workbox_files():
    patterns = ["sw.js", "sw.js.map", "workbox-*.js", "workbox-*.js.map"]
    
    for pattern in patterns:
        if "*" in pattern:
            for file in DOCS_DIR.glob(pattern):
                file.unlink()
        else:
            file = DOCS_DIR / pattern
            if file.exists():
                file.unlink()

def generate_service_worker():
    print("Generating service worker...")
    try:
        cleanup_workbox_files()
        subprocess.run(["npx", "workbox", "generateSW", "workbox-config.js"], check=True)
        print("  - Service worker generated successfully")
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(f"Error generating service worker: {e}")

def deploy():
    try:
        print("\nStarting deployment...")
        cleanup_old_files()
        download_ruffle()
        update_html()
        generate_service_worker()
        print("\nDeployment completed successfully!")
    except Exception as e:
        print(f"\nError during deployment: {e}")

if __name__ == "__main__":
    deploy() 