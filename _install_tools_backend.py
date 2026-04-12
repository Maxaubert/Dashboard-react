#!/usr/bin/env python3
"""
One-off setup script: installs all backend dependencies needed for the
upcoming Verktøy tools (Video downloader, Reader mode, Background remover,
Universal File Converter, PDF tools).

Idempotent — re-running will skip anything already installed and only
add what's missing. Safe to run multiple times.

Run from the dashboard-react/ folder:
    python _install_tools_backend.py
"""
import io
import os
import sys
import paramiko

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

HERE = os.path.dirname(os.path.abspath(__file__))

# System packages (apt)
APT_PACKAGES = [
    'ffmpeg',         # audio/video conversion + yt-dlp post-processing
    'poppler-utils',  # backing for pdf2image (renders PDF pages)
]

# Python packages (pip3 with --break-system-packages)
PIP_PACKAGES = [
    'yt-dlp',           # video downloader (A1)
    'readability-lxml', # reader mode (A5)
    'lxml',             # explicit dep of readability-lxml
    'rembg',            # background remover (B1) — large, pulls onnxruntime
    'pypdf',            # PDF merge/split/rotate (C1)
    'pdf2image',        # PDF → image (C1)
    'Pillow',           # image format conversion (universal converter)
    'PySocks',          # SOCKS5 proxy support for yt-dlp (residential proxy workaround)
]

# Module names to import-test (some pip names differ from import names)
IMPORT_NAMES = {
    'yt-dlp':           'yt_dlp',
    'readability-lxml': 'readability',
    'lxml':             'lxml',
    'rembg':            'rembg',
    'pypdf':            'pypdf',
    'pdf2image':        'pdf2image',
    'Pillow':           'PIL',
    'PySocks':          'socks',
}


def load_creds():
    creds = {}
    with open(os.path.join(HERE, 'dashboard.txt'), 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if '=' in line:
                k, v = line.split('=', 1)
                creds[k.strip()] = v.strip()
    return creds


def run(client, cmd, timeout=600, quiet=False):
    """Run a remote command, stream limited output. Returns (rc, out, err)."""
    if not quiet:
        # Show a one-line preview of what we're running
        preview = cmd if len(cmd) < 110 else cmd[:107] + '...'
        print(f'    $ {preview}')
    _stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    rc = stdout.channel.recv_exit_status()
    return rc, out, err


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
    print('Connected.\n')

    try:
        # ── Pre-flight: disk space + python version ──────────────────────
        step('Pre-flight checks')
        rc, out, _ = run(client, 'df -h / | tail -1', quiet=True)
        print(f'    disk: {out.strip()}')
        rc, out, _ = run(client, 'python3 --version', quiet=True)
        print(f'    python: {out.strip()}')

        # ── apt: check what's already installed ──────────────────────────
        step('Checking system packages')
        missing_apt = []
        for pkg in APT_PACKAGES:
            rc, out, _ = run(
                client,
                f'dpkg -s {pkg} >/dev/null 2>&1 && echo INSTALLED || echo MISSING',
                quiet=True,
            )
            status = out.strip()
            print(f'    {pkg:20} {status}')
            if status == 'MISSING':
                missing_apt.append(pkg)

        # ── apt: install missing ─────────────────────────────────────────
        if missing_apt:
            step(f'Installing apt packages: {", ".join(missing_apt)}')
            run(client, 'apt-get update -qq', timeout=300)
            cmd = (
                'DEBIAN_FRONTEND=noninteractive apt-get install -y -qq '
                + ' '.join(missing_apt)
            )
            rc, out, err = run(client, cmd, timeout=600)
            if rc != 0:
                print(f'    !! apt install failed (rc={rc})')
                print(f'    stderr: {err[-500:]}')
            else:
                print('    ok')
        else:
            step('All apt packages already installed')

        # ── pip: check what's already installed ──────────────────────────
        step('Checking Python packages')
        missing_pip = []
        for pkg in PIP_PACKAGES:
            mod = IMPORT_NAMES[pkg]
            # Suppress BOTH stdout and stderr from the python import
            # because some packages (e.g. rembg) print error messages
            # to stdout when their runtime backend is missing.
            rc, out, _ = run(
                client,
                f'python3 -c "import {mod}" >/dev/null 2>&1 && echo INSTALLED || echo MISSING',
                quiet=True,
            )
            status = out.strip()
            print(f'    {pkg:20} {status}')
            if status != 'INSTALLED':
                missing_pip.append(pkg)

        # ── pip: install missing ─────────────────────────────────────────
        if missing_pip:
            step(f'Installing pip packages: {", ".join(missing_pip)}')
            # Install one at a time so a single failure doesn't kill the rest
            for pkg in missing_pip:
                print(f'    >>> {pkg}')
                # rembg pulls in a newer jsonschema, but Debian's
                # jsonschema 4.10.3 was installed via apt without a
                # RECORD file, so pip can't uninstall it.
                # `--ignore-installed jsonschema` tells pip to install
                # the new version on top instead of trying to remove
                # the system one.
                if pkg == 'rembg':
                    # `rembg[cpu]` pulls in onnxruntime as the inference
                    # backend (server has no GPU). Without the [cpu]
                    # extra, rembg installs but raises at runtime.
                    cmd = (
                        'pip3 install --break-system-packages -q '
                        '--ignore-installed jsonschema "rembg[cpu]"'
                    )
                else:
                    cmd = f'pip3 install --break-system-packages -q {pkg}'
                # rembg can take 5+ minutes (it's a fat package). Give it
                # a generous timeout. Other packages are fast.
                tout = 1800 if pkg == 'rembg' else 600
                rc, out, err = run(client, cmd, timeout=tout, quiet=True)
                if rc != 0:
                    print(f'    !! FAILED (rc={rc})')
                    print(f'    stderr: {err[-700:]}')
                else:
                    print('    ok')
        else:
            step('All Python packages already installed')

        # ── Verify everything imports ───────────────────────────────────
        step('Final verification — import every module')
        all_ok = True
        for pkg in PIP_PACKAGES:
            mod = IMPORT_NAMES[pkg]
            rc, out, err = run(
                client,
                f'python3 -c "import {mod}; print({mod}.__version__ if hasattr({mod}, \'__version__\') else \'(no version attr)\')" 2>&1',
                quiet=True,
            )
            if rc == 0:
                print(f'    OK    {pkg:20} {out.strip()}')
            else:
                all_ok = False
                print(f'    FAIL  {pkg:20} {(err or out).strip()[:200]}')

        # Verify ffmpeg works
        rc, out, _ = run(client, 'ffmpeg -version 2>&1 | head -1', quiet=True)
        if rc == 0:
            print(f'    OK    ffmpeg               {out.strip()}')
        else:
            all_ok = False
            print('    FAIL  ffmpeg               not callable')

        # Verify poppler is callable
        rc, out, _ = run(client, 'pdftoppm -v 2>&1 | head -1', quiet=True)
        if rc == 0:
            print(f'    OK    poppler-utils        {out.strip()}')
        else:
            all_ok = False
            print('    FAIL  poppler-utils        not callable')

        # ── Disk usage after install ─────────────────────────────────────
        step('Post-install disk check')
        rc, out, _ = run(client, 'df -h / | tail -1', quiet=True)
        print(f'    disk: {out.strip()}')

        print()
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        if all_ok:
            print('  ✓ All backend dependencies installed and verified.')
        else:
            print('  ✗ Some dependencies failed — see log above.')
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    finally:
        client.close()


if __name__ == '__main__':
    main()
