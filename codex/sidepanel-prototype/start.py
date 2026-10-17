"""Start the preview independently of a terminal session."""
from pathlib import Path
import subprocess
import sys
import time
import urllib.request
ROOT = Path(__file__).resolve().parent
URL = 'http://127.0.0.1:8766/'
def is_preview():
    try:
        with urllib.request.urlopen(URL, timeout=1) as response:
            return b'<title>QA Guide' in response.read(2048)
    except OSError:
        return False
if __name__ == '__main__':
    if is_preview():
        print('Preview already running: ' + URL)
        raise SystemExit(0)
    with (ROOT / 'server.log').open('ab') as log:
        process = subprocess.Popen([sys.executable, str(ROOT / 'serve.py')], cwd=ROOT,
            stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
    for attempt in range(20):
        if process.poll() is not None:
            raise SystemExit('Preview could not start. See server.log (port 8766 may be in use).')
        if is_preview():
            (ROOT / 'server.pid').write_text(str(process.pid) + '\n')
            print('Preview running: ' + URL)
            break
        time.sleep(0.25)
    else:
        process.terminate()
        raise SystemExit('Preview did not become ready. See server.log.')
