"""End-to-end tests for the Postgres-backed /api/notes CRUD."""
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
    status, _, _ = _request('GET', api_server + '/api/notes')
    assert status == 401


def test_anonymous_post_returns_401(api_server):
    status, _, _ = _request('POST', api_server + '/api/notes', {'title': 'x'})
    assert status == 401


def test_anonymous_put_returns_401(api_server):
    status, _, _ = _request('PUT', api_server + '/api/notes/foo', {'title': 'x'})
    assert status == 401


def test_anonymous_delete_returns_401(api_server):
    status, _, _ = _request('DELETE', api_server + '/api/notes/foo')
    assert status == 401


def test_authed_get_empty_initially(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    status, _, body = _request('GET', api_server + '/api/notes', cookies=cookie)
    assert status == 200
    assert json.loads(body) == []


def test_post_creates_note_and_get_returns_it(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    status, _, body = _request('POST', api_server + '/api/notes',
                               {'id': 'note_1', 'title': 'A', 'body': 'first'},
                               cookies=cookie)
    assert status == 201
    created = json.loads(body)
    assert created['id'] == 'note_1'
    assert created['title'] == 'A'
    assert created['body'] == 'first'
    assert isinstance(created['updatedAt'], int)
    _, _, body = _request('GET', api_server + '/api/notes', cookies=cookie)
    got = json.loads(body)
    assert len(got) == 1
    assert got[0]['id'] == 'note_1'


def test_post_without_id_assigns_one(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    status, _, body = _request('POST', api_server + '/api/notes',
                               {'title': 'untitled', 'body': ''},
                               cookies=cookie)
    assert status == 201
    created = json.loads(body)
    assert created['id'].startswith('note_')


def test_put_patches_only_provided_fields(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    _request('POST', api_server + '/api/notes',
             {'id': 'note_1', 'title': 'orig title', 'body': 'orig body'},
             cookies=cookie)
    status, _, body = _request('PUT', api_server + '/api/notes/note_1',
                               {'title': 'new title'}, cookies=cookie)
    assert status == 200
    got = json.loads(body)
    assert got['title'] == 'new title'
    assert got['body'] == 'orig body'  # untouched


def test_put_unknown_id_returns_404(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    status, _, _ = _request('PUT', api_server + '/api/notes/missing',
                            {'title': 'x'}, cookies=cookie)
    assert status == 404


def test_delete_removes_note(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    _request('POST', api_server + '/api/notes',
             {'id': 'note_1', 'title': 'A'}, cookies=cookie)
    status, _, body = _request('DELETE', api_server + '/api/notes/note_1',
                               cookies=cookie)
    assert status == 200
    assert json.loads(body)['ok'] is True
    _, _, body = _request('GET', api_server + '/api/notes', cookies=cookie)
    assert json.loads(body) == []


def test_delete_unknown_id_is_idempotent_success(api_server):
    """Matches the legacy Flask sidecar contract: deleting a missing
    id returns 200 ok:true (frontend optimistic-deletes)."""
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    status, _, body = _request('DELETE', api_server + '/api/notes/missing',
                               cookies=cookie)
    assert status == 200
    assert json.loads(body)['ok'] is True


def test_users_cannot_modify_each_others_notes(api_server):
    alice = _signup(api_server, 'alice@x.co', 'inv-a')
    bob = _signup(api_server, 'bob@x.co', 'inv-b')
    _request('POST', api_server + '/api/notes',
             {'id': 'alice-note', 'title': 'private'}, cookies=alice)
    # Bob cannot see it
    _, _, body = _request('GET', api_server + '/api/notes', cookies=bob)
    assert json.loads(body) == []
    # Bob cannot update it
    status, _, _ = _request('PUT', api_server + '/api/notes/alice-note',
                            {'title': 'hijacked'}, cookies=bob)
    assert status == 404
    # Bob cannot see it after his "delete" attempt either (his delete
    # is a no-op against his own scope, but alice still has it)
    _request('DELETE', api_server + '/api/notes/alice-note', cookies=bob)
    _, _, body = _request('GET', api_server + '/api/notes', cookies=alice)
    got = json.loads(body)
    assert len(got) == 1
    assert got[0]['title'] == 'private'


def test_get_orders_newest_first(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    _request('POST', api_server + '/api/notes',
             {'id': 'first', 'title': 'first'}, cookies=cookie)
    _request('POST', api_server + '/api/notes',
             {'id': 'second', 'title': 'second'}, cookies=cookie)
    _, _, body = _request('GET', api_server + '/api/notes', cookies=cookie)
    got = json.loads(body)
    # 'second' was created later, so it has a newer updated_at and
    # appears first.
    assert [n['id'] for n in got] == ['second', 'first']


def test_put_unknown_method_path_returns_404(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    status, _, _ = _request('PUT', api_server + '/api/notes/',
                            {'title': 'x'}, cookies=cookie)
    assert status == 404
    status, _, _ = _request('PUT', api_server + '/api/notes/foo/bar',
                            {'title': 'x'}, cookies=cookie)
    assert status == 404
