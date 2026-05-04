#!/usr/bin/env python3
"""Upload api.py to the VPS and restart the todo-api systemd service."""
import io
import os
import sys
import paramiko

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HERE = os.path.dirname(os.path.abspath(__file__))
# api.py lives in this repo at server/api.py — the React app and the
# Python API are deployed from the same source tree.
LOCAL_API = os.path.join(HERE, 'server', 'api.py')
REMOTE_API = '/opt/dashboard/www/api.py'


def _creds_path():
    """`dashboard.txt` is gitignored, so it only exists in the main checkout.
    When this script is run from a worktree, walk up two levels (.worktrees/<branch>/)
    to reach the main repo's copy; otherwise fall back to next-to-script."""
    local = os.path.join(HERE, 'dashboard.txt')
    if os.path.isfile(local):
        return local
    parent = os.path.normpath(os.path.join(HERE, '..', '..', 'dashboard.txt'))
    if os.path.isfile(parent):
        return parent
    return local  # let load_creds raise the clear FileNotFoundError


def load_creds():
    creds = {}
    with open(_creds_path(), 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if '=' in line:
                k, v = line.split('=', 1)
                creds[k.strip()] = v.strip()
    return creds


def main():
    if not os.path.isfile(LOCAL_API):
        print(f'ERROR: {LOCAL_API} not found', file=sys.stderr)
        sys.exit(1)

    creds = load_creds()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(creds['HOST'], username=creds['USER'], password=creds['PASS'], timeout=15)

    print(f'Uploading {LOCAL_API} -> {REMOTE_API}...')
    sftp = client.open_sftp()
    sftp.put(LOCAL_API, REMOTE_API)
    sftp.close()

    print('Restarting todo-api service...')
    _, stdout, stderr = client.exec_command('systemctl restart todo-api && sleep 1 && systemctl is-active todo-api')
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    print(f'  service status: {out or "(no output)"}')
    if err:
        print(f'  stderr: {err}')

    print('\nSmoke testing endpoints (direct to api.py on 127.0.0.1:3001 — bypasses nginx basic auth):')

    # /api/news still works
    for source in ('vg',):
        _, sout, _ = client.exec_command(
            f"curl -s -o /dev/null -w '%{{http_code}}' http://127.0.0.1:3001/api/news?source={source}"
        )
        code = sout.read().decode().strip()
        print(f'  /api/news?source={source} -> HTTP {code}')

    # New /api/report — POST a sentinel entry, verify it lands in the markdown file.
    sentinel = '__deploy_smoke_' + os.urandom(4).hex()
    payload = (
        '{"type":"bug","title":"' + sentinel + '","body":"deploy smoke",'
        '"page":"/__deploy"}'
    )
    cmd = (
        "curl -s -o /dev/null -w '%{http_code}' "
        "-X POST -H 'Content-Type: application/json' "
        f"--data '{payload}' http://127.0.0.1:3001/api/report"
    )
    _, sout, _ = client.exec_command(cmd)
    code = sout.read().decode().strip()
    print(f'  POST /api/report (sentinel) -> HTTP {code}')

    # Verify the entry actually hit the file, then strip it back out so
    # production logs aren't polluted with deploy-smoke noise.
    _, sout, _ = client.exec_command(
        f"grep -c '{sentinel}' /opt/dashboard/reports/bugs.md 2>/dev/null || echo 0"
    )
    count = sout.read().decode().strip()
    print(f'  bugs.md contains sentinel: {count} occurrence(s)')

    if count.isdigit() and int(count) > 0:
        # Remove the smoke entry — match the heading line and drop until
        # the next "---" or EOF. Keep this idempotent and bounded.
        _, sout, serr = client.exec_command(
            "python3 -c \""
            "import re; "
            "p = '/opt/dashboard/reports/bugs.md'; "
            "s = open(p, encoding='utf-8').read(); "
            f"pat = re.compile(r'\\n---\\n\\n### [^\\n]*{sentinel}.*?(?=\\n---\\n|$)', re.S); "
            "out, n = pat.subn('', s); "
            "open(p, 'w', encoding='utf-8').write(out); "
            "print(f'cleaned {n} smoke entries')\""
        )
        out = sout.read().decode().strip()
        err = serr.read().decode().strip()
        if out:
            print(f'  {out}')
        if err:
            print(f'  cleanup stderr: {err}')

    client.close()
    print('\nDone.')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'ERROR: {type(e).__name__}: {e}', file=sys.stderr)
        sys.exit(1)
