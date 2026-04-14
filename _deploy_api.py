#!/usr/bin/env python3
"""Upload api.py to the VPS and restart the todo-api systemd service."""
import io
import os
import sys
import paramiko

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HERE = os.path.dirname(os.path.abspath(__file__))
LOCAL_API = os.path.normpath(os.path.join(HERE, '..', 'Dashboard', 'api.py'))
REMOTE_API = '/opt/dashboard/www/api.py'


def load_creds():
    creds = {}
    with open(os.path.join(HERE, 'dashboard.txt'), 'r', encoding='utf-8') as f:
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

    print('\nSmoke testing new endpoints (will return 401 due to basic auth — that just means nginx is alive):')
    for source in ('vg', 'nrk', 'aftenposten'):
        _, sout, _ = client.exec_command(
            f"curl -s -o /dev/null -w '%{{http_code}}' http://127.0.0.1:3001/api/news?source={source}"
        )
        code = sout.read().decode().strip()
        print(f'  /api/news?source={source} (direct to api.py) -> HTTP {code}')

    client.close()
    print('\nDone.')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'ERROR: {type(e).__name__}: {e}', file=sys.stderr)
        sys.exit(1)
