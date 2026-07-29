import html
import re
from urllib.parse import quote, urlparse

import requests


SEARCH_ORIGIN = "https://flashpointarchive.org"
PLAYER_ORIGIN = "https://ooooooooo.ooo"
DOWNLOAD_ORIGIN = "https://download.unstable.life"
IMAGE_ORIGIN = "https://infinity.unstable.life"
LEGACY_SERVER = "https://infinity.unstable.life/Flashpoint/Legacy/htdocs"
UUID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.I,
)
USER_AGENT = "Astro-Flash-Catalog/1.0"


def plain_text(value):
    return html.unescape(re.sub(r"<[^>]*>", " ", value or "")).strip()


def parse_search_results(source):
    blocks = re.findall(
        r'<div class="fp-search-result">([\s\S]*?)(?=<div class="fp-search-result">|'
        r"</div>\s*</div>\s*<div class=\"fp-search-navigation\">|$)",
        source,
        re.I,
    )
    games = []
    for block in blocks:
        id_match = re.search(r"/view\?id=([0-9a-f-]{36})", block, re.I)
        title_match = re.search(
            r'class="fp-search-result-title"[^>]*>([\s\S]*?)</a>',
            block,
            re.I,
        )
        if not id_match or not title_match or not UUID_PATTERN.fullmatch(id_match[1]):
            continue
        creator_match = re.search(
            r'class="fp-search-result-creator"[^>]*>([\s\S]*?)</span>',
            block,
            re.I,
        )
        info_match = re.search(
            r'class="fp-search-result-info"[^>]*>([\s\S]*?)</div>',
            block,
            re.I,
        )
        info = re.sub(r"\s+", " ", plain_text(info_match[1] if info_match else ""))
        info_parts = re.split(r"\s+game\s+-\s+", info, maxsplit=1, flags=re.I)
        platform = info_parts[0]
        tags = (
            [part.strip() for part in re.split(r"\s+-\s+", info_parts[1])]
            if len(info_parts) > 1
            else []
        )
        uuid = id_match[1].lower()
        games.append(
            {
                "uuid": uuid,
                "title": plain_text(title_match[1]),
                "developer": re.sub(
                    r"^by\s+",
                    "",
                    plain_text(creator_match[1] if creator_match else ""),
                    flags=re.I,
                ),
                "platform": platform,
                "tags": [tag for tag in tags if tag],
                "logoUrl": f"/api/games/{uuid}/logo",
                "potentiallyCompatible": platform.lower() == "flash",
            }
        )
    return games


def _attribute(source, name):
    match = re.search(rf"\b{re.escape(name)}=\"([^\"]*)\"", source, re.I)
    return html.unescape(match[1]) if match else ""


def _detail_rows(source):
    rows = {}
    for label, value in re.findall(
        r'<div class="row">\s*<div class="field">([\s\S]*?)</div>\s*'
        r'<div class="value">([\s\S]*?)</div>\s*</div>',
        source,
        re.I,
    ):
        rows.setdefault(plain_text(label).removesuffix(":"), plain_text(value))
    return rows


def parse_game_details(source, request_origin, uuid):
    if not UUID_PATTERN.fullmatch(uuid):
        raise ValueError("Invalid game UUID")
    uuid = uuid.lower()
    rows = _detail_rows(source)
    title_match = re.search(
        r'<div class="header-large">([\s\S]*?)</div>',
        source,
        re.I,
    )
    tags_match = re.search(
        r'<div class="field">Tags:</div>\s*<div class="value">([\s\S]*?)</div>',
        source,
        re.I,
    )
    tags = (
        [plain_text(item) for item in re.findall(r"<li>([\s\S]*?)</li>", tags_match[1], re.I)]
        if tags_match
        else []
    )
    game_zip_url = _attribute(source, "data-game-zip")
    legacy_server = _attribute(source, "data-legacy-server").rstrip("/")
    launch_command = _attribute(source, "data-launch-command")
    parsed_zip = urlparse(game_zip_url)
    safe_zip = bool(
        game_zip_url
        and f"{parsed_zip.scheme}://{parsed_zip.netloc}" == DOWNLOAD_ORIGIN
        and re.fullmatch(
            rf"/gib-roms/Games/{re.escape(uuid)}-\d+\.zip",
            parsed_zip.path,
            re.I,
        )
    )
    platform = rows.get("Platform", "")
    library = rows.get("Library", "")
    status = rows.get("Status", "")
    application_path = rows.get("Application Path", "")
    safe_legacy = legacy_server == LEGACY_SERVER
    playable_flash = bool(
        platform.lower() == "flash"
        and library.lower() == "games"
        and status.lower() == "playable"
        and re.search(r"(?:flash\s*player|flashplayer)", application_path, re.I)
        and re.search(r"\.swf(?:$|[?#])", launch_command, re.I)
    )
    compatible = playable_flash and (safe_zip or safe_legacy)
    package_type = "gamezip" if safe_zip else "legacy" if safe_legacy else None
    return {
        "uuid": uuid,
        "title": plain_text(title_match[1] if title_match else ""),
        "developer": rows.get("Developer", ""),
        "sourceUrl": rows.get("Source", ""),
        "library": library,
        "platform": platform,
        "status": status,
        "applicationPath": application_path,
        "launchCommand": launch_command,
        "tags": tags,
        "logoUrl": f"{request_origin}/api/games/{uuid}/logo",
        "downloadUrl": f"{request_origin}/api/games/{uuid}/download",
        "packageType": package_type,
        "legacyFallback": safe_legacy,
        "compatible": compatible,
        "incompatibleReason": (
            None
            if compatible
            else (
                "This entry is not a playable Flash game."
                if not playable_flash
                else "This entry does not have supported Flashpoint game data."
            )
        ),
        "upstreamUrl": f"{SEARCH_ORIGIN}/view?id={uuid}",
        "_gameZipUrl": game_zip_url if safe_zip else None,
        "_legacyServerUrl": LEGACY_SERVER if safe_legacy else None,
    }


def legacy_asset_url(archive_path):
    archive_path = str(archive_path or "")
    if (
        len(archive_path) > 2048
        or not archive_path.startswith("content/")
        or "\\" in archive_path
        or "\0" in archive_path
    ):
        raise ValueError("Invalid Legacy asset path.")
    parts = archive_path.split("/")
    if (
        len(parts) < 3
        or any(part in ("", ".", "..") for part in parts)
        or not re.fullmatch(r"[a-z0-9.-]+", parts[1], re.I)
    ):
        raise ValueError("Invalid Legacy asset path.")
    return f"{LEGACY_SERVER}/{'/'.join(quote(part, safe='') for part in parts[1:])}"


class CatalogClient:
    def __init__(self, session=requests):
        self.session = session

    def _get_text(self, url):
        response = self.session.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=30,
        )
        response.raise_for_status()
        return response.text

    def search(self, query):
        query = str(query or "").strip()
        if not 1 <= len(query) <= 100:
            raise ValueError("Enter a search between 1 and 100 characters.")
        source = self._get_text(f"{SEARCH_ORIGIN}/search?query={quote(query)}")
        return parse_search_results(source)

    def details(self, uuid, request_origin):
        if not UUID_PATTERN.fullmatch(uuid):
            raise ValueError("Invalid game UUID")
        source = self._get_text(f"{PLAYER_ORIGIN}/?id={quote(uuid)}")
        return parse_game_details(source, request_origin, uuid)

    def download(self, uuid, request_origin):
        details = self.details(uuid, request_origin)
        if not details["compatible"]:
            raise ValueError(details["incompatibleReason"])
        if details["packageType"] == "gamezip":
            upstream_url = details["_gameZipUrl"]
        else:
            launch = urlparse(details["launchCommand"])
            upstream_url = legacy_asset_url(
                f"content/{launch.hostname}{launch.path}"
            )
        response = self.session.get(
            upstream_url,
            headers={"User-Agent": USER_AGENT},
            timeout=120,
            stream=True,
        )
        response.raise_for_status()
        return response

    def asset(self, uuid, request_origin, archive_path):
        details = self.details(uuid, request_origin)
        if not details["compatible"] or not details["_legacyServerUrl"]:
            raise ValueError("Legacy assets are not available for this game.")
        response = self.session.get(
            legacy_asset_url(archive_path),
            headers={"User-Agent": USER_AGENT},
            timeout=120,
            stream=True,
        )
        response.raise_for_status()
        return response

    def logo(self, uuid):
        if not UUID_PATTERN.fullmatch(uuid):
            raise ValueError("Invalid game UUID")
        uuid = uuid.lower()
        path = f"Logos/{uuid[:2]}/{uuid[2:4]}/{uuid}.png"
        response = self.session.get(
            f"{IMAGE_ORIGIN}/images/{path}?type=jpg",
            timeout=30,
            stream=True,
        )
        response.raise_for_status()
        return response
