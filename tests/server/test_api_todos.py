"""End-to-end tests for the Postgres-backed /api/todos.

Reuses the fixtures pattern from test_api_auth.py: in-process
HTTPServer + ephemeral Postgres + urllib for the HTTP calls."""
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
    status, _, _ = _request('GET', api_server + '/api/todos')
    assert status == 401


def test_anonymous_post_returns_401(api_server):
    status, _, _ = _request('POST', api_server + '/api/todos', [])
    assert status == 401


def test_authed_get_empty_initially(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    status, _, body = _request('GET', api_server + '/api/todos', cookies=cookie)
    assert status == 200
    assert json.loads(body) == []


def test_post_then_get_round_trip(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    todos = [
        {'id': '1001', 'text': 'first', 'priority': 'high', 'deadline': None,
         'done': False, 'pinned': False, 'completedAt': None},
        {'id': '1002', 'text': 'second', 'priority': 'medium', 'deadline': '2026-12-31',
         'done': True, 'pinned': False, 'completedAt': '2026-05-19T12:00:00+00:00'},
    ]
    status, _, _ = _request('POST', api_server + '/api/todos', todos, cookies=cookie)
    assert status == 200
    status, _, body = _request('GET', api_server + '/api/todos', cookies=cookie)
    assert status == 200
    got = json.loads(body)
    assert len(got) == 2
    assert got[0]['id'] == '1001'
    assert got[0]['text'] == 'first'
    assert got[0]['priority'] == 'high'
    assert got[1]['id'] == '1002'
    assert got[1]['done'] is True
    assert got[1]['deadline'] == '2026-12-31'


def test_post_deletes_omitted_todos(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    _request('POST', api_server + '/api/todos', [
        {'id': '1', 'text': 'A', 'priority': 'medium', 'deadline': None,
         'done': False, 'pinned': False, 'completedAt': None},
        {'id': '2', 'text': 'B', 'priority': 'medium', 'deadline': None,
         'done': False, 'pinned': False, 'completedAt': None},
    ], cookies=cookie)
    _request('POST', api_server + '/api/todos', [
        {'id': '1', 'text': 'A renamed', 'priority': 'high', 'deadline': None,
         'done': False, 'pinned': False, 'completedAt': None},
    ], cookies=cookie)
    _, _, body = _request('GET', api_server + '/api/todos', cookies=cookie)
    got = json.loads(body)
    assert len(got) == 1
    assert got[0]['id'] == '1'
    assert got[0]['text'] == 'A renamed'
    assert got[0]['priority'] == 'high'


def test_post_empty_list_deletes_everything(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    _request('POST', api_server + '/api/todos', [
        {'id': '1', 'text': 'A', 'priority': 'medium', 'deadline': None,
         'done': False, 'pinned': False, 'completedAt': None},
    ], cookies=cookie)
    _request('POST', api_server + '/api/todos', [], cookies=cookie)
    _, _, body = _request('GET', api_server + '/api/todos', cookies=cookie)
    assert json.loads(body) == []


def test_users_are_isolated(api_server):
    alice = _signup(api_server, 'alice@x.co', 'inv-a')
    bob = _signup(api_server, 'bob@x.co', 'inv-b')
    _request('POST', api_server + '/api/todos', [
        {'id': '100', 'text': 'alice-only', 'priority': 'medium', 'deadline': None,
         'done': False, 'pinned': False, 'completedAt': None},
    ], cookies=alice)
    _, _, body = _request('GET', api_server + '/api/todos', cookies=bob)
    assert json.loads(body) == []
    _, _, body = _request('GET', api_server + '/api/todos', cookies=alice)
    assert len(json.loads(body)) == 1


def test_position_preserved_in_get(api_server):
    """GET orders by position, set from POST array index."""
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    _request('POST', api_server + '/api/todos', [
        {'id': '3', 'text': 'third', 'priority': 'medium', 'deadline': None,
         'done': False, 'pinned': False, 'completedAt': None},
        {'id': '1', 'text': 'first', 'priority': 'medium', 'deadline': None,
         'done': False, 'pinned': False, 'completedAt': None},
        {'id': '2', 'text': 'second', 'priority': 'medium', 'deadline': None,
         'done': False, 'pinned': False, 'completedAt': None},
    ], cookies=cookie)
    _, _, body = _request('GET', api_server + '/api/todos', cookies=cookie)
    got = json.loads(body)
    assert [t['text'] for t in got] == ['third', 'first', 'second']


def test_invalid_priority_normalized(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    _request('POST', api_server + '/api/todos', [
        {'id': '1', 'text': 'x', 'priority': 'urgent', 'deadline': None,
         'done': False, 'pinned': False, 'completedAt': None},
    ], cookies=cookie)
    _, _, body = _request('GET', api_server + '/api/todos', cookies=cookie)
    assert json.loads(body)[0]['priority'] == 'medium'
