#!/usr/bin/env python3
"""Mirror /opt/dashboard/reports/*.md from the VPS into ./reports/.

The production api.py appends bug/feature reports filed from any
authenticated browser to /opt/dashboard/reports/{bugs,features}.md.
This script pulls the latest copy down so they're easy to read
locally (and so the dashboard's dev plugin reads from the same
folder when you run `npm run dev`).

The local ./reports/ folder is gitignored — these are personal notes,
not pushed to the public repo.

Usage:
    python _pull_reports.py
"""
import io
import os
import sys
import paramiko

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HERE = os.path.dirname(os.path.abspath(__file__))
LOCAL_DIR = os.path.join(HERE, 'reports')
REMOTE_DIR = '/opt/dashboard/reports'
FILES = ('bugs.md', 'features.md')


def _creds_path():
    """`dashboard.txt` is gitignored; from a worktree, walk up to the main checkout."""
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


def _count_entries(path):
    """Each report entry starts with `### ` — counting these gives a quick "how many reports" number without parsing the structure."""
    if not os.path.isfile(path):
        return 0
    n = 0
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.startswith('### '):
                n += 1
    return n


def main():
    creds = load_creds()
    print(f'Connecting to {creds["HOST"]} as {creds["USER"]}...')
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        creds['HOST'], username=creds['USER'], password=creds['PASS'], timeout=15
    )

    os.makedirs(LOCAL_DIR, exist_ok=True)
    sftp = client.open_sftp()

    pulled = 0
    for fname in FILES:
        remote_path = f'{REMOTE_DIR}/{fname}'
        local_path = os.path.join(LOCAL_DIR, fname)
        try:
            sftp.stat(remote_path)
        except FileNotFoundError:
            print(f'  {fname}: (not on server yet — no reports of that type)')
            continue
        before = _count_entries(local_path)
        sftp.get(remote_path, local_path)
        after = _count_entries(local_path)
        delta = after - before
        size = os.path.getsize(local_path)
        marker = ''
        if delta > 0:
            marker = f'  +{delta} new'
        elif delta < 0:
            marker = f'  ({delta} — local had more, overwritten)'
        else:
            marker = '  (no change)'
        print(f'  {fname}: {after} entries, {size:,} bytes{marker}')
        pulled += 1

    sftp.close()
    client.close()

    if pulled:
        print(f'\nMirrored to: {LOCAL_DIR}')
    else:
        print('\nNothing to pull yet.')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'ERROR: {type(e).__name__}: {e}', file=sys.stderr)
        sys.exit(1)
