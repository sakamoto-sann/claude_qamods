"""Start only this checkout's built preview independently of a terminal session."""
import json
import subprocess
import sys
import time
import urllib.request
from serve import ROOT, INSTANCE_ID, PORT, assets_ready

URL = f'http://127.0.0.1:{PORT}/'

def health():
    try:
        with urllib.request.urlopen(URL + 'health', timeout=1) as response:
            health = json.load(response)
        return health if isinstance(health, dict) else {}
    except (OSError, ValueError, AttributeError):
        return {}

def is_preview():
    status = health()
    return status.get('instance') == INSTANCE_ID and status.get('ready') is True

if __name__ == '__main__':
    if not assets_ready():
        raise SystemExit('Preview is not built. Run: node codex/sidepanel-prototype/build-native.mjs')
    if is_preview():
        print('Preview already running: ' + URL)
        raise SystemExit(0)
    with (ROOT / 'server.log').open('ab') as log:
        process = subprocess.Popen([sys.executable, str(ROOT / 'serve.py')], cwd=ROOT,
            stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
    for attempt in range(20):
        status = health()
        if status.get('instance') == INSTANCE_ID and status.get('ready') is True:
            if isinstance(status.get('pid'), int):
                (ROOT / 'server.pid').write_text(str(status['pid']) + '\n')
            print('Preview running: ' + URL)
            break
        if process.poll() is not None:
            if is_preview():
                print('Preview already running: ' + URL)
                break
            raise SystemExit('Preview could not start. Port may belong to another checkout. See server.log.')
        time.sleep(0.25)
    else:
        process.terminate()
        raise SystemExit('Preview did not become ready. See server.log.')
