"""End-to-end tests for the Postgres-backed /api/home."""
import json
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import pytest

from server import api as server_api
from server import db as server_db
from server import rate_limit


@pytest.fixture
def api_server(db_url, monkeypatch, apply_migrations):
    monkeypatch.setattr(server_db, '_pool', None, raising=False)
    server_db.init_pool(db_url, min_size=1, max_size=2)
    apply_migrations(server_db.execute)
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


def _request(method, url, body=None, cookies=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    if data is not None:
        req.add_header('Content-Type', 'application/json')
    if cookies:
        req.add_header('Cookie', cookies)
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, dict(r.headers), r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode()


def _seed_invite(code):
    server_db.execute("INSERT INTO invite_codes (code) VALUES (%s)", (code,))


def _signup(api_server, email, code):
    _seed_invite(code)
    _, headers, _ = _request('POST', api_server + '/api/auth/signup', {
        'code': code, 'email': email,
        'password': 'pw1234567890', 'display_name': email.split('@')[0],
    })
    return headers['Set-Cookie'].split(';')[0]


def test_anonymous_get_returns_401(api_server):
    status, _, _ = _request('GET', api_server + '/api/home')
    assert status == 401


def test_anonymous_post_returns_401(api_server):
    status, _, _ = _request('POST', api_server + '/api/home', {'version': 1})
    assert status == 401


def test_authed_get_returns_empty_default_initially(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    status, _, body = _request('GET', api_server + '/api/home', cookies=cookie)
    assert status == 200
    got = json.loads(body)
    assert got['version'] == 1
    assert got['sections'] == []
    assert got['widgets'] == []
    assert got['habits'] == []


def test_post_then_get_round_trip(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    payload = {
        'version': 1,
        'sections': ['widgets', 'dagens-plan', 'vaer'],
        'widgets': [
            {'id': 'w1', 'type': 'alarm', 'refId': 'alarm'},
            {'id': 'w2', 'type': 'habit', 'refId': 'habit-a'},
        ],
        'habits': [
            {'id': 'habit-a', 'name': 'test', 'color': '#34d399',
             'completedDays': ['2026-05-19']},
        ],
    }
    status, _, _ = _request('POST', api_server + '/api/home', payload, cookies=cookie)
    assert status == 200
    status, _, body = _request('GET', api_server + '/api/home', cookies=cookie)
    assert status == 200
    got = json.loads(body)
    assert got == payload


def test_post_replaces_previous_payload_entirely(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    _request('POST', api_server + '/api/home', {
        'version': 1, 'sections': ['a', 'b'], 'widgets': [], 'habits': [],
    }, cookies=cookie)
    _request('POST', api_server + '/api/home', {
        'version': 1, 'sections': ['z'], 'widgets': [], 'habits': [],
    }, cookies=cookie)
    _, _, body = _request('GET', api_server + '/api/home', cookies=cookie)
    assert json.loads(body)['sections'] == ['z']


def test_users_are_isolated(api_server):
    alice = _signup(api_server, 'alice@x.co', 'inv-a')
    bob = _signup(api_server, 'bob@x.co', 'inv-b')
    _request('POST', api_server + '/api/home', {
        'version': 1, 'sections': ['alice-section'],
        'widgets': [], 'habits': [],
    }, cookies=alice)
    _, _, body = _request('GET', api_server + '/api/home', cookies=bob)
    got = json.loads(body)
    # Bob hasn't saved anything yet, gets the default layout
    assert got['sections'] == []


def test_post_with_non_dict_body_returns_400(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    status, _, _ = _request('POST', api_server + '/api/home', ['not', 'a', 'dict'], cookies=cookie)
    assert status == 400
