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

def get_latest_ruffle_version():
    """Get the latest Ruffle version from unpkg"""
    url = "https://unpkg.com/@ruffle-rs/ruffle/package.json"
    response = requests.get(url)
    return response.json()["version"]

def get_ruffle_files(version):
    """Extract core and wasm filenames from ruffle.js"""
    base_url = f"https://unpkg.com/@ruffle-rs/ruffle@{version}/"
    main_js = requests.get(base_url + "ruffle.js").text
    
    # Extract core filename
    core_match = re.search(r'r\.u=e=>"core\.ruffle\."\+{[^}]*69:"([a-f0-9]+)"', main_js)
    if not core_match:
        raise Exception("Could not find core file name in ruffle.js")
    core_file = f"core.ruffle.{core_match.group(1)}.js"
    
    # Extract wasm filename
    wasm_match = re.search(r'"([a-f0-9]+\.wasm)"', main_js)
    if not wasm_match:
        raise Exception("Could not find wasm file name in ruffle.js")
    wasm_file = wasm_match.group(1)
    
    print(f"Found Ruffle files: core={core_file}, wasm={wasm_file}")
    return core_file, wasm_file

def get_file_hash(file_path):
    """Calculate SHA-384 hash of a file for integrity attribute"""
    sha384 = hashlib.sha384()
    
    mode = 'rb' if str(file_path).endswith('.wasm') else 'r'
    with open(file_path, mode) as f:
        content = f.read()
        if mode == 'r':
            content = content.encode()
        sha384.update(content)
        
    return f"sha384-{base64.b64encode(sha384.digest()).decode('utf-8')}"

def download_ruffle(version):
    """Download Ruffle files"""
    JS_DIR.mkdir(parents=True, exist_ok=True)
    
    core_file, wasm_file = get_ruffle_files(version)
    files_to_download = [
        ("ruffle.js", ASSET_PATHS['ruffle']),
        (core_file, JS_DIR / core_file),
        (wasm_file, JS_DIR / wasm_file)
    ]
    
    base_url = f"https://unpkg.com/@ruffle-rs/ruffle@{version}/"
    
    for src_file, dest_path in files_to_download:
        print(f"Downloading {src_file}...")
        response = requests.get(base_url + src_file)
        
        mode = 'wb' if src_file.endswith('.wasm') else 'w'
        with open(dest_path, mode) as f:
            f.write(response.content if mode == 'wb' else response.text)
        print(f"Saved as {dest_path}")

def get_current_version():
    """Get current version from HTML file"""
    if not HTML_PATH.exists():
        return None
    
    with open(HTML_PATH, "r") as f:
        content = f.read()
    
    version_match = re.search(r'<h6>v([0-9.]+(?:-\d+)?)</h6>', content)
    return version_match.group(1) if version_match else None

def get_next_version():
    """Generate next version string"""
    today = datetime.now().strftime("%y.%m.%d")
    current = get_current_version()
    
    if not current:
        return today
        
    # If current version is from today, increment the build number
    if current.startswith(today):
        # Extract build number if it exists, otherwise start at 1
        build_match = re.search(r'-(\d+)$', current)
        build_num = int(build_match.group(1)) + 1 if build_match else 1
        return f"{today}-{build_num}"
    
    # If it's a new day, start fresh
    return today

def update_html():
    """Update index.html with integrity hashes and version"""
    version_str = get_next_version()
    
    # Calculate integrity hashes for all assets
    integrity_hashes = {
        name: get_file_hash(path) 
        for name, path in ASSET_PATHS.items()
    }
    
    with open(HTML_PATH, "r") as f:
        content = f.read()

    # Update script and link tags
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
    print(f"Updated {HTML_PATH} with integrity hashes (version {version_str})")

def cleanup_old_files():
    """Remove old Ruffle core and wasm files"""
    if not JS_DIR.exists():
        return
        
    with open(ASSET_PATHS['ruffle'], 'r') as f:
        current_content = f.read()
    
    for file in JS_DIR.iterdir():
        # Remove old core and wasm files not referenced in current ruffle.js
        if ((file.name.startswith("core.ruffle.") and file.name.endswith(".js")) or 
            file.name.endswith(".wasm")):
            if file.name not in current_content:
                file.unlink()
                print(f"Removed old file: {file.name}")

def cleanup_workbox_files():
    """Remove workbox files"""
    print("\nCleaning up workbox files...")
    patterns = ["sw.js", "sw.js.map", "workbox-*.js", "workbox-*.js.map"]
    
    for pattern in patterns:
        if "*" in pattern:
            base, ext = pattern.split("*")
            for file in DOCS_DIR.glob(pattern):
                file.unlink()
                print(f"Removed {file.name}")
        else:
            file = DOCS_DIR / pattern
            if file.exists():
                file.unlink()
                print(f"Removed {pattern}")

def generate_service_worker():
    """Generate service worker using workbox"""
    print("\nGenerating service worker...")
    try:
        cleanup_workbox_files()
        subprocess.run(["npx", "workbox", "generateSW", "workbox-config.js"], check=True)
        print("Service worker generated successfully!")
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(f"Error generating service worker: {e}")

def deploy():
    """Main deployment function"""
    try:
        cleanup_old_files()
        
        print("\nUpdating Ruffle...")
        version = get_latest_ruffle_version()
        download_ruffle(version)
        
        print("\nUpdating HTML...")
        update_html()
        
        generate_service_worker()
        
        print("\nDeployment completed successfully!")
    except Exception as e:
        print(f"Error during deployment: {e}")

if __name__ == "__main__":
    deploy() 