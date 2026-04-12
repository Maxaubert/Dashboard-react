#!/usr/bin/env python3
"""Emergency: re-upload index.html that was accidentally deleted by the deploy script."""
import io
import os
import sys
import paramiko

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))


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
    creds = load_creds()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(creds['HOST'], username=creds['USER'], password=creds['PASS'], timeout=15)

    sftp = client.open_sftp()
    local = os.path.join(HERE, 'dist', 'index.html')
    remote = '/opt/dashboard/www/index.html'
    sftp.put(local, remote)
    print(f'Uploaded {local} -> {remote}')

    _, stdout, _ = client.exec_command('chown www-data:www-data /opt/dashboard/www/index.html && ls -la /opt/dashboard/www/index.html')
    print(stdout.read().decode())

    sftp.close()
    client.close()


if __name__ == '__main__':
    main()
