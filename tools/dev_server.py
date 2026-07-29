from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
from urllib.parse import parse_qs, urlparse
import argparse
import json
import re

try:
    from tools.flashpoint_catalog import CatalogClient, UUID_PATTERN
except ModuleNotFoundError:
    from flashpoint_catalog import CatalogClient, UUID_PATTERN


class NoCacheHandler(SimpleHTTPRequestHandler):
    """Serve built files with no-cache headers."""

    catalog = CatalogClient()

    def _json(self, value, status=200):
        content = json.dumps(value, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def _proxy(self, response):
        self.send_response(response.status_code)
        for name in (
            "Content-Type",
            "Content-Length",
            "Content-Disposition",
            "ETag",
            "Last-Modified",
        ):
            if response.headers.get(name):
                self.send_header(name, response.headers[name])
        self.end_headers()
        for chunk in response.iter_content(chunk_size=64 * 1024):
            if chunk:
                self.wfile.write(chunk)

    def _handle_catalog(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        origin = f"http://{self.headers.get('Host', 'localhost')}"
        try:
            if path == "/api/games":
                query = parse_qs(parsed.query).get("q", [""])[0]
                self._json({"games": self.catalog.search(query)})
                return
            match = re.fullmatch(
                r"/api/games/([0-9a-f-]{36})(?:/(download|logo|asset))?",
                path,
                re.I,
            )
            if not match or not UUID_PATTERN.fullmatch(match[1]):
                self._json({"error": "Not found."}, 404)
                return
            uuid, action = match.groups()
            if action == "download":
                self._proxy(self.catalog.download(uuid, origin))
            elif action == "asset":
                archive_path = parse_qs(parsed.query).get("path", [""])[0]
                self._proxy(self.catalog.asset(uuid, origin, archive_path))
            elif action == "logo":
                self._proxy(self.catalog.logo(uuid))
            else:
                details = self.catalog.details(uuid, origin)
                details.pop("_gameZipUrl", None)
                details.pop("_legacyServerUrl", None)
                self._json(details)
        except ValueError as error:
            self._json({"error": str(error)}, 400)
        except Exception as error:
            self.log_error("Catalog request failed: %s", error)
            self._json({"error": "The Flashpoint catalog is unavailable."}, 502)

    def do_GET(self):
        if urlparse(self.path).path.startswith("/api/games"):
            self._handle_catalog()
            return
        super().do_GET()

    def end_headers(self):
        # Add headers to prevent caching
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

def main():
    parser = argparse.ArgumentParser(description="Local development server for dist/")
    parser.add_argument(
        "--port", type=int, default=8000, help="Port to serve on (default: 8000)"
    )
    parser.add_argument(
        "--directory",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "dist",
        help="Directory to serve (default: dist/)",
    )
    args = parser.parse_args()

    directory = args.directory.resolve()
    if not (directory / "index.html").is_file():
        parser.error(f"{directory} is not built; run `bun run build` first")
    handler = partial(NoCacheHandler, directory=directory)
    server_address = ("", args.port)
    httpd = ThreadingHTTPServer(server_address, handler)
    print(f"Server running on http://localhost:{args.port}/")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
