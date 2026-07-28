from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
import argparse


class NoCacheHandler(SimpleHTTPRequestHandler):
    """Serve built files with no-cache headers."""

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
