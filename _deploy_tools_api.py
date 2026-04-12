#!/usr/bin/env python3
"""
Deploy script for the Tools API service.

Steps:
  1. SSH in (creds in dashboard.txt — same as the React deploy script).
  2. Upload server/tools_api.py → /opt/dashboard/tools_api.py
  3. Upload server/dashboard-tools.service → /etc/systemd/system/
  4. Upload server/nginx.conf → /etc/nginx/sites-available/dashboard
     (this also includes the existing /api/notes + /api/cart blocks, so
     it's a full replacement of the dashboard site config)
  5. Create the rembg model cache dir + chown to www-data
  6. systemctl daemon-reload, enable + restart dashboard-tools
  7. nginx -t, then reload nginx
  8. Hit /api/tools/ping to verify the service is up

Idempotent — safe to re-run after any backend change.

Usage:
    python _deploy_tools_api.py
"""
import io
import json
import os
import sys
import time
import paramiko

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

HERE = os.path.dirname(os.path.abspath(__file__))
SERVER_DIR = os.path.join(HERE, 'server')


def load_creds():
    creds = {}
    with open(os.path.join(HERE, 'dashboard.txt'), 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if '=' in line:
                k, v = line.split('=', 1)
                creds[k.strip()] = v.strip()
    return creds


def run(client, cmd, timeout=60, check=False):
    _stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    rc = stdout.channel.recv_exit_status()
    if check and rc != 0:
        raise RuntimeError(f'Command failed (rc={rc}): {cmd}\n{err}')
    return rc, out, err


def upload(sftp, local, remote):
    print(f'    upload {os.path.basename(local)} → {remote}')
    sftp.put(local, remote)


def step(label):
    print()
    print(f'━━ {label}')


def main():
    creds = load_creds()
    print(f'Connecting to {creds["HOST"]}…')
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=creds['HOST'],
        username=creds['USER'],
        password=creds['PASS'],
        timeout=30,
    )
    sftp = client.open_sftp()
    print('Connected.')

    try:
        # ── Upload tools_api.py ──────────────────────────────────────────
        step('Uploading tools_api.py')
        upload(sftp, os.path.join(SERVER_DIR, 'tools_api.py'),
               '/opt/dashboard/tools_api.py')
        run(client, 'chown www-data:www-data /opt/dashboard/tools_api.py', check=True)

        # ── Ensure yt-proxy.txt exists with the SOCKS5 default ──────────
        # This is the residential-proxy config file. tools_api.py reads
        # it on every request; the user can edit it to swap proxies
        # without re-deploying.
        step('Ensuring yt-proxy.txt config exists')
        rc, _, _ = run(client, '[ -f /opt/dashboard/yt-proxy.txt ]')
        if rc != 0:
            default_proxy = (
                '# Residential proxy URL for YouTube downloads.\n'
                '# Default: SOCKS5 SSH reverse tunnel from the user\'s home PC.\n'
                '# Use socks5h:// (with the h) so DNS resolution happens at the\n'
                '# proxy end — otherwise yt-dlp leaks DNS to the server\'s ISP.\n'
                'socks5h://127.0.0.1:1080\n'
            )
            sftp.putfo(io.BytesIO(default_proxy.encode('utf-8')),
                       '/opt/dashboard/yt-proxy.txt')
            run(client, 'chown www-data:www-data /opt/dashboard/yt-proxy.txt', check=True)
            run(client, 'chmod 644 /opt/dashboard/yt-proxy.txt', check=True)
            print('    created /opt/dashboard/yt-proxy.txt with SOCKS5 default')
        else:
            print('    /opt/dashboard/yt-proxy.txt already exists, leaving as-is')

        # ── Upload systemd service ──────────────────────────────────────
        step('Uploading dashboard-tools.service')
        upload(sftp, os.path.join(SERVER_DIR, 'dashboard-tools.service'),
               '/etc/systemd/system/dashboard-tools.service')

        # ── Cache directory for rembg + yt-dlp ───────────────────────────
        step('Setting up cache directories')
        run(client, 'mkdir -p /var/cache/dashboard-tools/u2net', check=True)
        run(client, 'chown -R www-data:www-data /var/cache/dashboard-tools', check=True)
        print('    /var/cache/dashboard-tools (owned by www-data)')

        # ── Reload + enable + start the service ──────────────────────────
        step('Reloading systemd, enabling, restarting service')
        run(client, 'systemctl daemon-reload', check=True)
        run(client, 'systemctl enable dashboard-tools', check=True)
        run(client, 'systemctl restart dashboard-tools', check=True)

        # Give Flask a moment to bind the port before we curl it
        time.sleep(1.5)

        rc, out, _ = run(client, 'systemctl is-active dashboard-tools')
        print(f'    service status: {out.strip()}')
        if out.strip() != 'active':
            rc, out, err = run(client, 'journalctl -u dashboard-tools -n 30 --no-pager')
            print(f'    !! service did not start, last 30 lines of journal:')
            print(out)
            print(err)
            return

        # ── Upload nginx config + validate + reload ──────────────────────
        step('Uploading nginx config')
        # Take a backup so we can restore if validation fails
        run(
            client,
            'cp /etc/nginx/sites-available/dashboard '
            '/root/dashboard-nginx-backup-$(date +%s).conf 2>/dev/null || true',
        )
        upload(
            sftp,
            os.path.join(SERVER_DIR, 'nginx.conf'),
            '/etc/nginx/sites-available/dashboard',
        )

        rc, out, err = run(client, 'nginx -t')
        if rc != 0:
            print('    !! nginx -t failed, NOT reloading nginx:')
            print(err)
            return
        print(f'    nginx -t: {(out + err).strip().splitlines()[-1]}')

        run(client, 'systemctl reload nginx', check=True)
        print('    nginx reloaded')

        # ── Verify /api/tools/ping ───────────────────────────────────────
        step('Verifying /api/tools/ping')
        # Hit it through localhost (no basic auth in the way) since we're
        # already on the server. -s for silent, -m 5 for max 5 sec.
        rc, out, _ = run(
            client,
            'curl -s -m 5 http://127.0.0.1:5002/api/tools/ping',
        )
        if rc == 0 and out.strip():
            print(f'    response: {out.strip()}')
            try:
                data = json.loads(out)
                ok_deps = sum(1 for v in data.get('deps', {}).values() if v)
                total = len(data.get('deps', {}))
                print(f'    deps: {ok_deps}/{total} available')
            except json.JSONDecodeError:
                print('    !! response was not JSON')
        else:
            print(f'    !! curl failed (rc={rc})')

        print()
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        print('  ✓ Tools API deployed.')
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    finally:
        sftp.close()
        client.close()


if __name__ == '__main__':
    main()
