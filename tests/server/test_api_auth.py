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


def _signup_and_get_cookie(api_server, email='a@b.co', code='inv'):
    """Helper: seed an invite, signup, return the session cookie value."""
    _seed_invite(code)
    _, headers, _ = _post(api_server + '/api/auth/signup', {
        'code': code, 'email': email,
        'password': 'pw1234567890', 'display_name': 'A',
    })
    raw = headers['Set-Cookie']
    # 'session=abc; HttpOnly; ...' -> extract 'session=abc'
    return raw.split(';')[0]


def _get(url, cookies=None):
    req = urllib.request.Request(url, method='GET')
    if cookies:
        req.add_header('Cookie', cookies)
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, dict(r.headers), r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode()


# ---- Login tests ----

def test_login_with_correct_password_returns_cookie(api_server):
    _signup_and_get_cookie(api_server, email='login@b.co', code='inv-login')
    status, headers, body = _post(api_server + '/api/auth/login', {
        'email': 'login@b.co', 'password': 'pw1234567890',
    })
    assert status == 200, body
    assert 'Set-Cookie' in headers


def test_login_with_wrong_password_returns_401(api_server):
    _signup_and_get_cookie(api_server, email='login2@b.co', code='inv-l2')
    status, _, _ = _post(api_server + '/api/auth/login', {
        'email': 'login2@b.co', 'password': 'wrong-password-here',
    })
    assert status == 401


def test_login_with_unknown_email_returns_401(api_server):
    status, _, _ = _post(api_server + '/api/auth/login', {
        'email': 'nobody@nowhere.co', 'password': 'pw1234567890',
    })
    assert status == 401


# ---- Me tests ----

def test_me_returns_current_user_when_logged_in(api_server):
    cookie = _signup_and_get_cookie(api_server, email='me@b.co', code='inv-me')
    status, _, body = _get(api_server + '/api/auth/me', cookies=cookie)
    assert status == 200
    payload = json.loads(body)
    assert payload['user']['email'] == 'me@b.co'


def test_me_returns_401_when_anonymous(api_server):
    status, _, _ = _get(api_server + '/api/auth/me')
    assert status == 401


# ---- Logout tests ----

def test_logout_clears_session(api_server):
    cookie = _signup_and_get_cookie(api_server, email='lo@b.co', code='inv-lo')
    status, _, _ = _post(api_server + '/api/auth/logout', {}, cookies=cookie)
    assert status == 204
    # /api/auth/me should now return 401 with the same cookie
    status, _, _ = _get(api_server + '/api/auth/me', cookies=cookie)
    assert status == 401


# ---- Admin invite tests ----

def test_admin_invites_creates_codes(api_server):
    # First user is user_id = 1 -> admin
    cookie = _signup_and_get_cookie(api_server, email='admin@b.co', code='inv-admin')
    status, _, body = _post(
        api_server + '/api/admin/invites',
        {'count': 3},
        cookies=cookie,
    )
    assert status == 200, body
    payload = json.loads(body)
    assert len(payload['codes']) == 3
    # Each code should be a non-empty string
    for code in payload['codes']:
        assert isinstance(code, str) and len(code) >= 8


def test_admin_invites_requires_admin(api_server):
    # First user (admin) signup
    _signup_and_get_cookie(api_server, email='admin2@b.co', code='inv-a2')
    # Second user (regular) - user_id will be 2, not admin
    _seed_invite('inv-reg')
    _, headers, _ = _post(api_server + '/api/auth/signup', {
        'code': 'inv-reg', 'email': 'regular@b.co',
        'password': 'pw1234567890', 'display_name': 'R',
    })
    regular_cookie = headers['Set-Cookie'].split(';')[0]
    status, _, _ = _post(
        api_server + '/api/admin/invites',
        {'count': 1},
        cookies=regular_cookie,
    )
    assert status == 403


def test_admin_invites_anonymous_returns_401(api_server):
    status, _, _ = _post(api_server + '/api/admin/invites', {'count': 1})
    assert status == 401
