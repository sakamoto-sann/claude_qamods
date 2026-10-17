"""Serve only the prototype directory on loopback."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from functools import partial
class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    handler = partial(PreviewHandler, directory=str(Path(__file__).parent.resolve()))
    ThreadingHTTPServer(('127.0.0.1', 8766), handler).serve_forever()
