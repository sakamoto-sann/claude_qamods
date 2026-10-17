"""Serve only this prototype on loopback, with a checkout-specific health check."""
from functools import partial
from hashlib import sha256
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json
import os

ROOT = Path(__file__).resolve().parent
INSTANCE_ID = sha256(str(ROOT).encode()).hexdigest()
PORT = int(os.environ.get('QA_PREVIEW_PORT', '8766'))

def assets_ready():
    return all((ROOT / name).is_file() and (ROOT / name).stat().st_size > 0
               for name in ('index.html', 'panel.html', 'sample-question.json'))

class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        if self.path == '/health':
            body = json.dumps({'instance': INSTANCE_ID, 'ready': assets_ready(), 'pid': os.getpid()}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()

if __name__ == '__main__':
    handler = partial(PreviewHandler, directory=str(ROOT))
    ThreadingHTTPServer(('127.0.0.1', PORT), handler).serve_forever()
