"""Exercise real detached startup, concurrent reuse, and checkout isolation."""
from pathlib import Path
import os
import shutil
import signal
import socket
import subprocess
import sys
import tempfile

SOURCE = Path(__file__).resolve().parent
with tempfile.TemporaryDirectory(prefix='qa-preview-check-') as temporary:
    root = Path(temporary)
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
    env = {**os.environ, 'QA_PREVIEW_PORT': str(port)}
    def fixture(name):
        target = root / name
        target.mkdir()
        for file in ('serve.py', 'start.py'):
            shutil.copyfile(SOURCE / file, target / file)
        (target / 'index.html').write_text('<title>QA Guide test</title>')
        (target / 'panel.html').write_text('<p>Built test panel</p>')
        (target / 'sample-question.json').write_text('{}')
        return target
    first, other, unbuilt = [fixture(name) for name in ('first', 'other', 'unbuilt')]
    (unbuilt / 'panel.html').unlink()
    def run(target):
        return subprocess.run([sys.executable, str(target / 'start.py')], env=env,
                              capture_output=True, text=True, timeout=15)
    try:
        bad = run(unbuilt)
        assert bad.returncode != 0 and 'not built' in bad.stderr, bad
        launches = [subprocess.Popen([sys.executable, str(first / 'start.py')], env=env,
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) for _ in range(2)]
        for launch in launches:
            out, err = launch.communicate(timeout=15)
            assert launch.returncode == 0, (out, err)
        repeated = run(first)
        assert repeated.returncode == 0 and 'already running' in repeated.stdout, repeated
        unrelated = run(other)
        assert unrelated.returncode != 0 and 'another checkout' in unrelated.stderr, unrelated
        print('PASS: missing build rejected, concurrent start succeeds, same checkout reused, other checkout rejected')
    finally:
        pid_file = first / 'server.pid'
        if pid_file.exists():
            try:
                os.kill(int(pid_file.read_text()), signal.SIGTERM)
            except ProcessLookupError:
                pass
