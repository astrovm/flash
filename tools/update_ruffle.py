import requests
import os
from datetime import datetime
import re

def get_latest_ruffle_version():
    """Get the latest Ruffle version from unpkg"""
    url = "https://unpkg.com/@ruffle-rs/ruffle/package.json"
    response = requests.get(url)
    data = response.json()
    return data["version"]

def get_ruffle_files(version):
    """Get list of files from unpkg"""
    base_url = f"https://unpkg.com/@ruffle-rs/ruffle@{version}/"
    
    # Get the main ruffle.js first to find the core file name
    main_js = requests.get(base_url + "ruffle.js").text
    
    # Find the core file name from the main js content using the exact pattern
    core_match = re.search(r'r\.u=e=>"core\.ruffle\."\+{[^}]*69:"([a-f0-9]+)"', main_js)
    if not core_match:
        print("Core file pattern not found")
        print("Content sample:", main_js[:200])
        raise Exception("Could not find core file name in ruffle.js")
    core_file = f"core.ruffle.{core_match.group(1)}.js"
    
    # Find the wasm file name
    wasm_match = re.search(r'"([a-f0-9]+\.wasm)"', main_js)
    if not wasm_match:
        print("WASM file pattern not found")
        print("Content sample:", main_js[:200]) 
        raise Exception("Could not find wasm file name in ruffle.js")
    wasm_file = wasm_match.group(1)
    
    print(f"Found files in ruffle.js: core={core_file}, wasm={wasm_file}")
    return core_file, wasm_file

def download_ruffle(version):
    """Download Ruffle files"""
    today = datetime.now()
    version_str = today.strftime("%y.%m.%d")
    
    os.makedirs("docs/js", exist_ok=True)
    
    # Get the correct filenames
    core_file, wasm_file = get_ruffle_files(version)
    
    # Files to download with their destinations
    files_to_download = [
        ("ruffle.js", f"docs/js/ruffle.{version_str}.min.js"),
        (core_file, f"docs/js/{core_file}"),
        (wasm_file, f"docs/js/{wasm_file}")
    ]
    
    base_url = f"https://unpkg.com/@ruffle-rs/ruffle@{version}/"
    
    for (src_file, dest_file) in files_to_download:
        print(f"Downloading {src_file}...")
        response = requests.get(base_url + src_file)
        
        # Handle binary files (wasm)
        if src_file.endswith('.wasm'):
            with open(dest_file, "wb") as f:
                f.write(response.content)
        else:
            with open(dest_file, "w", encoding='utf-8') as f:
                f.write(response.text)
                
        print(f"Saved as {dest_file}")
    
    return version_str

def update_html(version_str):
    """Update index.html with new Ruffle version"""
    html_path = "docs/index.html"
    with open(html_path, "r") as f:
        content = f.read()

    # Update ruffle script src
    content = re.sub(
        r'<script src="js/ruffle\.[0-9.]+\.min\.js"><\/script>',
        f'<script src="js/ruffle.{version_str}.min.js"></script>',
        content
    )

    # Update version in footer
    content = re.sub(
        r'<h6>v[0-9.]+</h6>',
        f'<h6>v{version_str}</h6>',
        content
    )

    with open(html_path, "w") as f:
        f.write(content)

    print(f"Updated {html_path}")

def cleanup_old_versions():
    """Remove old Ruffle files"""
    js_dir = "docs/js"
    if not os.path.exists(js_dir):
        return
        
    current_date = datetime.now().strftime('%y.%m.%d')
    for file in os.listdir(js_dir):
        if file.startswith("ruffle.") and not current_date in file:
            os.remove(os.path.join(js_dir, file))
            print(f"Removed old file: {file}")

def main():
    try:
        cleanup_old_versions()
        version = get_latest_ruffle_version()
        version_str = download_ruffle(version)
        update_html(version_str)
        print("Ruffle update completed successfully!")
    except Exception as e:
        print(f"Error updating Ruffle: {e}")

if __name__ == "__main__":
    main() 