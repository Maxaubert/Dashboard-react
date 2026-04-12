#!/usr/bin/env python3
"""
End-to-end test of the YouTube residential-proxy flow.

Starts the SOCKS5 proxy locally, opens an SSH reverse port forward to
the dashboard server (using paramiko so we don't need an interactive
password prompt), and stays alive until killed.

While running, the dashboard server can route YouTube traffic through
this PC's residential IP via socks5h://127.0.0.1:1080.

Press Ctrl+C to stop.
"""
import io
import os
import select
import socket
import sys
import threading
import time

import paramiko

# Re-wrap stdio as UTF-8 — but only if it actually exists. Under
# pythonw.exe (used by the Task Scheduler entry so the tunnel runs
# hidden) sys.stdout/sys.stderr are None, so we just leave them alone.
if sys.stdout is not None and hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if sys.stderr is not None and hasattr(sys.stderr, 'buffer'):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# print() crashes if stdout is None (pythonw). Replace with a no-op
# so the rest of the script doesn't need conditionals everywhere.
if sys.stdout is None:
    import builtins
    builtins.print = lambda *a, **k: None

HERE = os.path.dirname(os.path.abspath(__file__))
PROXY_PORT = 1080

# Reuse the same SOCKS5 implementation we ship to the user
sys.path.insert(0, os.path.join(HERE, 'youtube-proxy-helper'))
from socks5_proxy import Socks5Handler, ThreadingTCPServer  # noqa: E402


def load_creds() -> dict:
    creds: dict = {}
    with open(os.path.join(HERE, 'dashboard.txt'), 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if '=' in line:
                k, v = line.split('=', 1)
                creds[k.strip()] = v.strip()
    return creds


def pipe_channel(channel: paramiko.Channel) -> None:
    """Bidirectionally relay bytes between an SSH channel (incoming
    forwarded connection from the server) and the local SOCKS5 proxy
    on PROXY_PORT."""
    try:
        sock = socket.create_connection(('127.0.0.1', PROXY_PORT))
    except OSError:
        channel.close()
        return
    try:
        while True:
            r, _, _ = select.select([sock, channel], [], [], 60)
            if not r:
                break
            if sock in r:
                data = sock.recv(4096)
                if not data:
                    break
                channel.send(data)
            if channel in r:
                data = channel.recv(4096)
                if not data:
                    break
                sock.send(data)
    finally:
        try:
            sock.close()
        except OSError:
            pass
        try:
            channel.close()
        except OSError:
            pass


def main() -> int:
    # ── Start SOCKS5 proxy locally ───────────────────────────────────
    print(f'[1/3] Starting SOCKS5 proxy on 127.0.0.1:{PROXY_PORT}', flush=True)
    socks_server = ThreadingTCPServer(('127.0.0.1', PROXY_PORT), Socks5Handler)
    socks_thread = threading.Thread(target=socks_server.serve_forever, daemon=True)
    socks_thread.start()
    time.sleep(0.5)

    # ── Connect to server via SSH ────────────────────────────────────
    creds = load_creds()
    print(f'[2/3] Connecting to {creds["USER"]}@{creds["HOST"]}', flush=True)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(
            hostname=creds['HOST'],
            username=creds['USER'],
            password=creds['PASS'],
            timeout=15,
        )
    except Exception as e:
        print(f'    !! SSH connect failed: {e}', flush=True)
        socks_server.shutdown()
        return 1

    transport = client.get_transport()
    if transport is None:
        print('    !! No transport from SSH client', flush=True)
        client.close()
        socks_server.shutdown()
        return 1
    transport.set_keepalive(30)

    # ── Set up reverse port forward ──────────────────────────────────
    # Server side: open a listening socket on 127.0.0.1:PROXY_PORT
    # When a server-side process connects to it, paramiko delivers a
    # channel via transport.accept() which we pipe to the local SOCKS5.
    try:
        transport.request_port_forward('127.0.0.1', PROXY_PORT)
    except Exception as e:
        print(f'    !! request_port_forward failed: {e}', flush=True)
        client.close()
        socks_server.shutdown()
        return 1
    print(f'[3/3] Reverse forward active: server:{PROXY_PORT} -> local:{PROXY_PORT}', flush=True)
    print()
    print('Tunnel ready. The dashboard server can now use this PC for YouTube.', flush=True)
    print('(Press Ctrl+C to stop)', flush=True)
    print()

    # ── Accept loop: spawn a relay thread per incoming channel ───────
    try:
        while transport.is_active():
            chan = transport.accept(timeout=1.0)
            if chan is None:
                continue
            t = threading.Thread(target=pipe_channel, args=(chan,), daemon=True)
            t.start()
    except KeyboardInterrupt:
        print('\nStopping...', flush=True)
    finally:
        try:
            transport.cancel_port_forward('127.0.0.1', PROXY_PORT)
        except Exception:
            pass
        client.close()
        socks_server.shutdown()

    return 0


if __name__ == '__main__':
    sys.exit(main())
