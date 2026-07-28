import hashlib
import json
import re
from pathlib import Path

import requests


PROJECT_DIR = Path(__file__).resolve().parents[1]
RUFFLE_RELEASE_PATH = PROJECT_DIR / "tools" / "ruffle-release.json"
RUFFLE_LATEST_RELEASE_URL = (
    "https://api.github.com/repos/ruffle-rs/ruffle/releases/latest"
)
RUFFLE_ASSET_SUFFIX = "-web-selfhosted.zip"


def get_release_metadata(session=requests):
    response = session.get(RUFFLE_LATEST_RELEASE_URL, timeout=30)
    response.raise_for_status()
    release = response.json()
    tag = release.get("tag_name", "")
    if (
        release.get("draft")
        or release.get("prerelease")
        or not re.fullmatch(r"v\d+\.\d+\.\d+", tag)
    ):
        raise ValueError("GitHub did not return a stable semantic Ruffle release")

    asset = next(
        (
            item
            for item in release.get("assets", [])
            if item.get("name", "").endswith(RUFFLE_ASSET_SUFFIX)
        ),
        None,
    )
    if asset is None:
        raise ValueError("Stable Ruffle release has no self-hosted web package")

    digest = asset.get("digest", "")
    if digest.startswith("sha256:"):
        checksum = digest.removeprefix("sha256:")
    else:
        archive_response = session.get(asset["browser_download_url"], timeout=120)
        archive_response.raise_for_status()
        checksum = hashlib.sha256(archive_response.content).hexdigest()
    if not re.fullmatch(r"[a-f0-9]{64}", checksum):
        raise ValueError("Stable Ruffle release has no valid SHA-256 digest")

    return {
        "tag": tag,
        "asset": asset["name"],
        "sha256": checksum,
    }


def update_release_file(path=RUFFLE_RELEASE_PATH, session=requests):
    latest = get_release_metadata(session)
    current = json.loads(path.read_text(encoding="utf-8"))
    if latest == current:
        print(f"Ruffle {latest['tag']} is already pinned.")
        return False
    path.write_text(json.dumps(latest, indent=2) + "\n", encoding="utf-8")
    print(f"Updated Ruffle pin from {current.get('tag')} to {latest['tag']}.")
    return True


if __name__ == "__main__":
    update_release_file()
