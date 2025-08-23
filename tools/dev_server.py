from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse


class NoCacheHandler(SimpleHTTPRequestHandler):
    """Serve files from the docs directory with no-cache headers."""

    def end_headers(self):
        # Add headers to prevent caching
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def translate_path(self, path):
        # Serve from docs directory
        docs_dir = Path.cwd() / "docs"
        full_path = Path(super().translate_path(path))
        rel_path = full_path.relative_to(Path.cwd())
        return str(docs_dir / rel_path)


def main():
    parser = argparse.ArgumentParser(description="Local development server for docs/")
    parser.add_argument(
        "--port", type=int, default=8000, help="Port to serve on (default: 8000)"
    )
    args = parser.parse_args()

    server_address = ("", args.port)
    httpd = HTTPServer(server_address, NoCacheHandler)
    print(f"Server running on http://localhost:{args.port}/")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
