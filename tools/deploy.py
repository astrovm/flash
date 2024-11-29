import os
import subprocess
from datetime import datetime
from update_ruffle import main as update_ruffle

def update_asset_versions():
    """Update CSS and JS file versions"""
    version_str = datetime.now().strftime("%y.%m.%d")
    js_dir = "docs/js"
    css_dir = "docs/css"
    
    # Rename main.js
    old_js = None
    new_js = f"main.{version_str}.js"
    for file in os.listdir(js_dir):
        if file.startswith("main.") and file.endswith(".js"):
            old_js = file
            if old_js != new_js:
                os.rename(
                    os.path.join(js_dir, old_js),
                    os.path.join(js_dir, new_js)
                )
                print(f"Renamed {old_js} to {new_js}")
    
    # Rename main.css
    old_css = None
    new_css = f"main.{version_str}.css"
    for file in os.listdir(css_dir):
        if file.startswith("main.") and file.endswith(".css"):
            old_css = file
            if old_css != new_css:
                os.rename(
                    os.path.join(css_dir, old_css),
                    os.path.join(css_dir, new_css)
                )
                print(f"Renamed {old_css} to {new_css}")
    
    # Update references in index.html
    if old_js != new_js or old_css != new_css:
        html_path = "docs/index.html"
        with open(html_path, "r") as f:
            content = f.read()
        
        if old_js:
            content = content.replace(old_js, new_js)
        if old_css:
            content = content.replace(old_css, new_css)
        
        with open(html_path, "w") as f:
            f.write(content)
        print(f"Updated {html_path} with new asset versions")

def cleanup_workbox_files():
    """Remove workbox files"""
    print("\nCleaning up workbox files...")
    docs_dir = "docs"
    workbox_files = [
        "sw.js",
        "sw.js.map",
        "workbox-*.js",
        "workbox-*.js.map"
    ]
    
    for pattern in workbox_files:
        if "*" in pattern:
            # Handle wildcard patterns
            base = pattern.split("*")[0]
            ext = pattern.split("*")[1]
            for file in os.listdir(docs_dir):
                if file.startswith(base) and file.endswith(ext):
                    os.remove(os.path.join(docs_dir, file))
                    print(f"Removed {file}")
        else:
            # Handle exact filenames
            file_path = os.path.join(docs_dir, pattern)
            if os.path.exists(file_path):
                os.remove(file_path)
                print(f"Removed {pattern}")

def generate_service_worker():
    """Generate service worker using workbox"""
    print("\nGenerating service worker...")
    try:
        # Clean up old files first
        cleanup_workbox_files()
        # Generate new service worker
        subprocess.run(["npx", "workbox", "generateSW", "workbox-config.js"], check=True)
        print("Service worker generated successfully!")
    except subprocess.CalledProcessError as e:
        print(f"Error generating service worker: {e}")
    except FileNotFoundError:
        print("workbox command not found. Make sure workbox-cli is installed globally.")

def deploy():
    # Update Ruffle
    print("Updating Ruffle...")
    update_ruffle()
    
    # Update asset versions
    print("\nUpdating asset versions...")
    update_asset_versions()
    
    # Generate service worker
    generate_service_worker()
    
    print("Deployment completed!")

if __name__ == "__main__":
    deploy() 