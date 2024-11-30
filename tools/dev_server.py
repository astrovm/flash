from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add headers to prevent caching
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def translate_path(self, path):
        # Serve from docs directory
        path = super().translate_path(path)
        rel_path = os.path.relpath(path, os.getcwd())
        return os.path.join(os.getcwd(), 'docs', rel_path)

if __name__ == '__main__':
    server_address = ('', 8000)
    httpd = HTTPServer(server_address, NoCacheHandler)
    print("Server running on http://localhost:8000/")
    httpd.serve_forever() 