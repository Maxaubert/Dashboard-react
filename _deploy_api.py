#!/usr/bin/env python3
"""Upload server/api.py + the server-module dependencies to the VPS
and restart todo-api.

Phase 2 of multi-user-backend introduced `server/db.py`, `server/auth.py`,
`server/crypto.py`, `server/rate_limit.py`, and `server/__init__.py`
that api.py imports. Previously this script only uploaded api.py, which
crashed the service on import. The fix: upload the whole module dir.

Auth: SSH key at ~/.ssh/dashboard_ed25519 (preferred). Falls back to
password from dashboard.txt if the key is missing.
"""
import io
import os
import sys
import paramiko

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HERE = os.path.dirname(os.path.abspath(__file__))
LOCAL_API = os.path.join(HERE, 'server', 'api.py')
REMOTE_API = '/opt/dashboard/www/api.py'

# Server-side Python modules api.py imports. Uploaded into
# /opt/dashboard/www/server/ so `from server import db` etc. resolve.
SERVER_MODULES = ['__init__.py', 'db.py', 'auth.py', 'crypto.py', 'rate_limit.py']
LOCAL_SERVER_DIR = os.path.join(HERE, 'server')
REMOTE_SERVER_DIR = '/opt/dashboard/www/server'

SSH_KEY_PATH = os.path.expanduser('~/.ssh/dashboard_ed25519')


def _creds_path():
    """`dashboard.txt` is gitignored, so it only exists in the main checkout."""
    local = os.path.join(HERE, 'dashboard.txt')
    if os.path.isfile(local):
        return local
    parent = os.path.normpath(os.path.join(HERE, '..', '..', 'dashboard.txt'))
    if os.path.isfile(parent):
        return parent
    return local


def load_creds():
    creds = {}
    with open(_creds_path(), 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if '=' in line:
                k, v = line.split('=', 1)
                creds[k.strip()] = v.strip()
    return creds


def connect():
    """SSH connect — prefer key, fall back to password."""
    creds = load_creds()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    if os.path.isfile(SSH_KEY_PATH):
        client.connect(creds['HOST'], username=creds['USER'],
                       key_filename=SSH_KEY_PATH, look_for_keys=False,
                       allow_agent=False, timeout=15)
    else:
        client.connect(creds['HOST'], username=creds['USER'],
                       password=creds['PASS'], timeout=15)
    return client


def main():
    if not os.path.isfile(LOCAL_API):
        print(f'ERROR: {LOCAL_API} not found', file=sys.stderr)
        sys.exit(1)

    client = connect()
    sftp = client.open_sftp()

    print(f'Uploading server modules to {REMOTE_SERVER_DIR}/...')
    # Ensure remote server dir exists (probably already does — it has
    # other unrelated files from previous deploys).
    _, sout, _ = client.exec_command(f'mkdir -p {REMOTE_SERVER_DIR}')
    sout.channel.recv_exit_status()
    for mod in SERVER_MODULES:
        local = os.path.join(LOCAL_SERVER_DIR, mod)
        if not os.path.isfile(local):
            print(f'  WARNING: {local} not present locally, skipping')
            continue
        remote = REMOTE_SERVER_DIR + '/' + mod
        sftp.put(local, remote)
        print(f'  uploaded server/{mod}')

    print(f'\nUploading {LOCAL_API} -> {REMOTE_API}...')
    sftp.put(LOCAL_API, REMOTE_API)
    sftp.close()

    print('\nRestarting todo-api service...')
    _, stdout, stderr = client.exec_command(
        'systemctl restart todo-api && sleep 2 && systemctl is-active todo-api'
    )
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    print(f'  service status: {out or "(no output)"}')
    if err:
        print(f'  stderr: {err}')

    if 'active' not in out.lower():
        print('\nService failed to start. Last 20 journal lines:')
        _, sout, _ = client.exec_command('journalctl -u todo-api -n 20 --no-pager')
        print(sout.read().decode('utf-8', errors='replace'))
        client.close()
        sys.exit(1)

    print('\nSmoke testing endpoints (direct to api.py on 127.0.0.1:3001):')
    smoke_ok = True

    # Each tuple: (path, expected HTTP code). Phase 3+ endpoints behind
    # auth return 401 to anonymous — that's a passing test, not a failure.
    checks = [
        ('/api/news?source=vg',     200),
        ('/api/auth/me',            401),   # anon, expect 401 (Phase 2)
        ('/api/todos',              401),   # anon, expect 401 (Phase 3)
        ('/api/plan',               401),   # anon, expect 401 (Phase 4)
        ('/api/links',              401),   # anon, expect 401 (Phase 4)
        ('/api/home',               401),   # anon, expect 401 (Phase 4)
        ('/api/notes',              401),   # anon, expect 401 (Phase 4)
        ('/api/skole',              401),   # anon, expect 401 (Phase 5)
        ('/api/wishlist',           401),   # anon, expect 401 (Phase 5)
        ('/api/pdf?stat=foo',       401),   # anon, expect 401 (Phase 5)
    ]
    for path, want in checks:
        _, sout, _ = client.exec_command(
            f"curl -s -o /dev/null -w '%{{http_code}}' http://127.0.0.1:3001{path}"
        )
        code = sout.read().decode().strip()
        ok = code == str(want)
        smoke_ok = smoke_ok and ok
        print(f'  {path} -> HTTP {code} {"OK" if ok else f"FAIL (expected {want})"}')

    client.close()
    print('\nDone.' if smoke_ok else '\nDone with failures — check above.')
    sys.exit(0 if smoke_ok else 1)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'ERROR: {type(e).__name__}: {e}', file=sys.stderr)
        sys.exit(1)
