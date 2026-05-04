#!/usr/bin/env python3
"""End-to-end smoke test for the deployed report endpoint:

  1. Hit https://nginx-host/api/report from OUTSIDE the server. This
     exercises the path the user's other PCs will take.
  2. Verify the POST returns 200.
  3. SSH in, grep the markdown log on disk to confirm the entry landed.
  4. Strip the sentinel back out so prod logs aren't polluted.

Uses the credentials from dashboard.txt — same nginx basic auth the
browser will be challenged for when reporting from another PC.
"""
import json
import os
import sys
import urllib.request
import urllib.error
import urllib.parse
import base64

import paramiko

HERE = os.path.dirname(os.path.abspath(__file__))


def _creds_path():
    local = os.path.join(HERE, 'dashboard.txt')
    if os.path.isfile(local):
        return local
    return os.path.normpath(os.path.join(HERE, '..', '..', 'dashboard.txt'))


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
    c = load_creds()
    host = c['HOST']
    sentinel = '__remote_smoke_' + os.urandom(4).hex()

    # 1) POST to the live endpoint via nginx (port 80).
    payload = {
        'type': 'bug',
        'title': sentinel,
        'body': 'Remote smoke test from another machine.',
        'page': '/__remote',
    }
    url = f'http://{host}/api/report'
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    # If basic auth is enforced, reuse SSH creds (they match per dashboard.txt convention).
    if 'BASIC_USER' in c and 'BASIC_PASS' in c:
        token = base64.b64encode(f"{c['BASIC_USER']}:{c['BASIC_PASS']}".encode()).decode()
        req.add_header('Authorization', f'Basic {token}')

    print(f'POST {url}  (sentinel={sentinel})')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            code = resp.status
            body = resp.read().decode('utf-8', errors='replace')
    except urllib.error.HTTPError as e:
        code = e.code
        body = e.read().decode('utf-8', errors='replace')
        # If we got a 401, retry with the SSH user's basic auth. nginx
        # might be configured to use the same set of credentials.
        if code == 401 and 'WWW-Authenticate' in (e.headers or {}):
            token = base64.b64encode(f"{c['USER']}:{c['PASS']}".encode()).decode()
            req.add_header('Authorization', f'Basic {token}')
            try:
                with urllib.request.urlopen(req, timeout=10) as resp:
                    code = resp.status
                    body = resp.read().decode('utf-8', errors='replace')
            except urllib.error.HTTPError as e2:
                code = e2.code
                body = e2.read().decode('utf-8', errors='replace')

    print(f'  HTTP {code}')
    print(f'  body: {body[:200]}')

    # 2) Verify on disk via SSH.
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=c['USER'], password=c['PASS'], timeout=15)

    _, sout, _ = client.exec_command(
        f"grep -c '{sentinel}' /opt/dashboard/reports/bugs.md 2>/dev/null || echo 0"
    )
    count = sout.read().decode().strip()
    print(f'\nbugs.md occurrences of sentinel: {count}')

    failures = 0
    if not (code == 200 and count.isdigit() and int(count) >= 1):
        print('FAIL: end-to-end did not write the report')
        failures += 1
        # Pull last 30 lines of the systemd journal for diagnostic context.
        _, sout, _ = client.exec_command('journalctl -u todo-api -n 30 --no-pager')
        print('\n--- journalctl -u todo-api (tail) ---')
        print(sout.read().decode('utf-8', errors='replace'))
    else:
        print('OK: end-to-end report write succeeded')
        # Strip the sentinel out of the log file.
        _, sout, _ = client.exec_command(
            "python3 -c \""
            "import re; "
            "p = '/opt/dashboard/reports/bugs.md'; "
            "s = open(p, encoding='utf-8').read(); "
            f"pat = re.compile(r'\\n---\\n\\n### [^\\n]*{sentinel}.*?(?=\\n---\\n|$)', re.S); "
            "out, n = pat.subn('', s); "
            "open(p, 'w', encoding='utf-8').write(out); "
            "print(f'cleaned {n} smoke entries')\""
        )
        print(sout.read().decode().strip())

    client.close()
    sys.exit(1 if failures else 0)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'ERROR: {type(e).__name__}: {e}', file=sys.stderr)
        sys.exit(1)
