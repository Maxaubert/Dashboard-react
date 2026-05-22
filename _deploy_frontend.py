#!/usr/bin/env python3
"""Deploy the built dist/ to the VPS over SFTP (paramiko, no ssh password prompt).

Mirrors deploy.bat steps:
  1. Assumes `npm run build` has already run and dist/ exists.
  2. Clears /opt/dashboard/www/ of previous HTML/assets.
  3. Uploads dist/* via SFTP.
  4. Uploads server/nginx.conf to /etc/nginx/sites-enabled/default.
  5. Runs `nginx -t && nginx -s reload`.
"""
import os
import posixpath
import sys

import paramiko

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, 'dist')
NGINX_SRC = os.path.join(HERE, 'server', 'nginx.conf')
REMOTE_WWW = '/opt/dashboard/www'
REMOTE_NGINX = '/etc/nginx/sites-enabled/default'


def _creds_path():
    """`dashboard.txt` is gitignored; from a worktree, walk up to the main checkout."""
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


def mkdir_p(sftp, path):
    """Recursively mkdir on the remote (like `mkdir -p`)."""
    parts = path.strip('/').split('/')
    cur = ''
    for p in parts:
        cur = cur + '/' + p
        try:
            sftp.stat(cur)
        except FileNotFoundError:
            sftp.mkdir(cur)


def upload_dir(sftp, local_dir, remote_dir):
    for root, _dirs, files in os.walk(local_dir):
        rel = os.path.relpath(root, local_dir).replace('\\', '/')
        target = remote_dir if rel == '.' else posixpath.join(remote_dir, rel)
        mkdir_p(sftp, target)
        for name in files:
            local_path = os.path.join(root, name)
            remote_path = posixpath.join(target, name)
            sftp.put(local_path, remote_path)
            print(f'  uploaded {rel}/{name}')


def run(client, cmd):
    print(f'$ {cmd}')
    _, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out:
        print(out)
    if err:
        print(f'stderr: {err}')
    return stdout.channel.recv_exit_status()


def main():
    if not os.path.isdir(DIST):
        print(f'ERROR: {DIST} not found — run `npm run build` first.', file=sys.stderr)
        sys.exit(1)

    creds = load_creds()
    print(f'Connecting to {creds["HOST"]} as {creds["USER"]}...')
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        creds['HOST'], username=creds['USER'], password=creds['PASS'], timeout=15
    )

    print('[2/5] Clearing old static files...')
    run(
        client,
        f"rm -rf {REMOTE_WWW}/index.html {REMOTE_WWW}/assets {REMOTE_WWW}/*.svg",
    )

    print('[3/5] Uploading new build...')
    sftp = client.open_sftp()
    mkdir_p(sftp, REMOTE_WWW)
    upload_dir(sftp, DIST, REMOTE_WWW)

    if os.path.isfile(NGINX_SRC):
        print('[4/5] Uploading nginx config...')
        sftp.put(NGINX_SRC, REMOTE_NGINX)
    else:
        print(f'[4/5] Skipping nginx config — {NGINX_SRC} not found')
    sftp.close()

    print('[5/5] Reloading nginx...')
    rc = run(client, 'nginx -t && nginx -s reload')
    if rc != 0:
        print('ERROR: nginx reload failed. Check config.', file=sys.stderr)
        sys.exit(1)

    client.close()
    print('\nDone. Visit https://37-27-210-14.sslip.io to verify.')


if __name__ == '__main__':
    main()
