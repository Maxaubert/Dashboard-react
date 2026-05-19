"""End-to-end tests for /api/auth/* via an in-process HTTPServer.

Spins up api.py's Handler on a random port, hits it with urllib.
Each test gets a fresh Postgres (via the existing db_url fixture)."""
import json
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

from server import api as server_api
from server import db as server_db
from server import rate_limit


@pytest.fixture
def api_server(db_url, monkeypatch):
    """Start api.py's Handler on a random port. Yields the base URL."""
    monkeypatch.setattr(server_db, '_pool', None, raising=False)
    server_db.init_pool(db_url, min_size=1, max_size=2)
    # Apply schema
    sql = (Path(__file__).resolve().parents[2] / 'server' / 'migrations' / '001_initial.sql').read_text(encoding='utf-8')
    server_db.execute(sql)
    # Reset rate limiter state between tests
    rate_limit._buckets.clear()

    srv = ThreadingHTTPServer(('127.0.0.1', 0), server_api.Handler)
    srv.daemon_threads = True
    port = srv.server_address[1]
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    try:
        yield f'http://127.0.0.1:{port}'
    finally:
        srv.shutdown()
        srv.server_close()
        server_db.close_pool()


def _post(url, body, cookies=None):
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method='POST')
    req.add_header('Content-Type', 'application/json')
    if cookies:
        req.add_header('Cookie', cookies)
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, dict(r.headers), r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode()


def _seed_invite(code='abc123'):
    server_db.execute(
        "INSERT INTO invite_codes (code) VALUES (%s)", (code,)
    )


def test_signup_with_valid_invite_creates_user(api_server):
    _seed_invite('inv-ok')
    status, headers, body = _post(api_server + '/api/auth/signup', {
        'code': 'inv-ok',
        'email': 'a@b.co',
        'password': 'hunter2_long_pass',
        'display_name': 'Alice',
    })
    assert status == 200, body
    payload = json.loads(body)
    assert payload['user']['email'] == 'a@b.co'
    assert payload['user']['display_name'] == 'Alice'
    assert 'Set-Cookie' in headers
    assert 'session=' in headers['Set-Cookie']


def test_signup_with_invalid_invite_returns_401(api_server):
    status, _, body = _post(api_server + '/api/auth/signup', {
        'code': 'not-real',
        'email': 'a@b.co',
        'password': 'hunter2_long_pass',
        'display_name': 'Alice',
    })
    assert status == 401


def test_signup_consumed_invite_returns_401(api_server):
    _seed_invite('one-shot')
    # First signup consumes the code
    _post(api_server + '/api/auth/signup', {
        'code': 'one-shot', 'email': 'a@b.co',
        'password': 'pw1234567890', 'display_name': 'A',
    })
    # Second attempt with same code fails
    status, _, _ = _post(api_server + '/api/auth/signup', {
        'code': 'one-shot', 'email': 'b@b.co',
        'password': 'pw1234567890', 'display_name': 'B',
    })
    assert status == 401


def test_signup_duplicate_email_returns_409(api_server):
    _seed_invite('inv1')
    _seed_invite('inv2')
    _post(api_server + '/api/auth/signup', {
        'code': 'inv1', 'email': 'dup@b.co',
        'password': 'pw1234567890', 'display_name': 'A',
    })
    status, _, _ = _post(api_server + '/api/auth/signup', {
        'code': 'inv2', 'email': 'dup@b.co',
        'password': 'pw1234567890', 'display_name': 'B',
    })
    assert status == 409


def test_signup_short_password_returns_400(api_server):
    _seed_invite('inv')
    status, _, _ = _post(api_server + '/api/auth/signup', {
        'code': 'inv', 'email': 'a@b.co',
        'password': 'short', 'display_name': 'A',
    })
    assert status == 400
