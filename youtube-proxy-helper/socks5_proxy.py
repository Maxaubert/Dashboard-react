#!/usr/bin/env python3
"""
Tiny pure-Python SOCKS5 proxy server. No third-party dependencies.

Used as one half of the Dashboard YouTube downloader workaround:

  +---------+         SSH reverse tunnel         +-----------+
  | server  | <-- localhost:1080 forwarded --   | this PC   |
  | yt-dlp  | --> via socks5h://127.0.0.1:1080 -+--> proxy  |
  +---------+                                    +-----------+
                                                       |
                                                       v  (residential IP)
                                                  youtube.com

Run via the start_youtube_proxy.bat launcher in the same folder. The
launcher starts this script, opens an SSH tunnel to the dashboard
server, and tears both down when its window is closed.

Listens on 127.0.0.1:1080 by default. No authentication. Only forwards
TCP — UDP and BIND commands are rejected.
"""
import argparse
import select
import socket
import socketserver
import struct
import sys


SOCKS_VERSION = 5
NO_AUTH = 0x00
CMD_CONNECT = 0x01
ATYP_IPV4 = 0x01
ATYP_DOMAIN = 0x03
ATYP_IPV6 = 0x04
REPLY_SUCCESS = 0x00
REPLY_GENERAL_FAILURE = 0x01
REPLY_HOST_UNREACHABLE = 0x04
REPLY_CONNECTION_REFUSED = 0x05
REPLY_COMMAND_NOT_SUPPORTED = 0x07
REPLY_ATYPE_NOT_SUPPORTED = 0x08

BUFFER = 8192
RELAY_TIMEOUT = 60.0


class Socks5Handler(socketserver.StreamRequestHandler):
    def handle(self) -> None:  # noqa: C901  (protocol code is naturally branchy)
        try:
            self._handle()
        except (ConnectionResetError, BrokenPipeError, OSError):
            # Client/remote went away mid-stream — nothing actionable.
            pass

    def _handle(self) -> None:
        # ── Greeting ────────────────────────────────────────────────
        header = self._recv_exact(2)
        if not header or header[0] != SOCKS_VERSION:
            return
        nmethods = header[1]
        if nmethods == 0:
            return
        self._recv_exact(nmethods)  # methods list — we don't care, we accept no-auth
        self.connection.sendall(struct.pack('!BB', SOCKS_VERSION, NO_AUTH))

        # ── Connect request ────────────────────────────────────────
        req = self._recv_exact(4)
        if not req or req[0] != SOCKS_VERSION:
            return
        cmd = req[1]
        atyp = req[3]
        if cmd != CMD_CONNECT:
            self._reply(REPLY_COMMAND_NOT_SUPPORTED)
            return

        if atyp == ATYP_IPV4:
            raw = self._recv_exact(4)
            if not raw:
                return
            address = socket.inet_ntoa(raw)
        elif atyp == ATYP_DOMAIN:
            length_byte = self._recv_exact(1)
            if not length_byte:
                return
            length = length_byte[0]
            domain = self._recv_exact(length)
            if not domain:
                return
            try:
                address = domain.decode('idna')
            except UnicodeError:
                self._reply(REPLY_HOST_UNREACHABLE)
                return
        elif atyp == ATYP_IPV6:
            raw = self._recv_exact(16)
            if not raw:
                return
            address = socket.inet_ntop(socket.AF_INET6, raw)
        else:
            self._reply(REPLY_ATYPE_NOT_SUPPORTED)
            return

        port_bytes = self._recv_exact(2)
        if not port_bytes:
            return
        port = struct.unpack('!H', port_bytes)[0]

        # ── Open the upstream TCP connection ───────────────────────
        try:
            remote = socket.create_connection((address, port), timeout=15)
        except socket.gaierror:
            self._reply(REPLY_HOST_UNREACHABLE)
            return
        except (TimeoutError, ConnectionRefusedError):
            self._reply(REPLY_CONNECTION_REFUSED)
            return
        except OSError:
            self._reply(REPLY_GENERAL_FAILURE)
            return

        try:
            self._reply(REPLY_SUCCESS)
            self._relay(self.connection, remote)
        finally:
            try:
                remote.close()
            except OSError:
                pass

    def _recv_exact(self, n: int) -> bytes:
        """Read exactly `n` bytes or return empty on short read."""
        buf = bytearray()
        while len(buf) < n:
            chunk = self.connection.recv(n - len(buf))
            if not chunk:
                return b''
            buf.extend(chunk)
        return bytes(buf)

    def _reply(self, code: int) -> None:
        # The bind addr/port fields are unused by clients but must be present.
        try:
            self.connection.sendall(
                struct.pack('!BBBB4sH', SOCKS_VERSION, code, 0, ATYP_IPV4, b'\x00\x00\x00\x00', 0)
            )
        except OSError:
            pass

    def _relay(self, client: socket.socket, remote: socket.socket) -> None:
        """Bidirectionally pump bytes between client and remote until
        either side closes or there's no traffic for RELAY_TIMEOUT."""
        sockets = [client, remote]
        while True:
            r, _, _ = select.select(sockets, [], [], RELAY_TIMEOUT)
            if not r:
                # Idle timeout — kill the connection so we don't leak fds.
                return
            for s in r:
                try:
                    data = s.recv(BUFFER)
                except OSError:
                    return
                if not data:
                    return
                target = remote if s is client else client
                try:
                    target.sendall(data)
                except OSError:
                    return


class ThreadingTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True


def main() -> int:
    parser = argparse.ArgumentParser(description='Tiny SOCKS5 proxy.')
    parser.add_argument('--host', default='127.0.0.1', help='listen host')
    parser.add_argument('--port', type=int, default=1080, help='listen port')
    args = parser.parse_args()

    print(f'SOCKS5 proxy listening on {args.host}:{args.port}', flush=True)
    print('(Ctrl+C to stop)', flush=True)

    server = ThreadingTCPServer((args.host, args.port), Socks5Handler)
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        print('\nStopping...', flush=True)
        server.shutdown()
        server.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
