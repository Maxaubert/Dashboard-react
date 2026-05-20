"""End-to-end tests for the Postgres-backed /api/plan."""
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


def _ev(ev_id, date, **overrides):
    base = {
        'id': ev_id, 'title': 'untitled', 'date': date,
        'startTime': '', 'endTime': '',
        'tag': '', 'location': '', 'color': '', 'recurring': False,
    }
    base.update(overrides)
    return base


def test_anonymous_get_returns_401(api_server):
    status, _, _ = _request('GET', api_server + '/api/plan')
    assert status == 401


def test_anonymous_post_returns_401(api_server):
    status, _, _ = _request('POST', api_server + '/api/plan', [])
    assert status == 401


def test_authed_get_empty_initially(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    status, _, body = _request('GET', api_server + '/api/plan', cookies=cookie)
    assert status == 200
    assert json.loads(body) == []


def test_post_then_get_round_trip(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    events = [
        _ev('uuid-1', '2026-12-31', title='New Year Eve',
            startTime='20:00', endTime='23:59', color='#ff0000',
            location='Oslo', tag='party', recurring=False),
        _ev('uuid-2', '2026-06-15', title='Mid-year check'),
    ]
    status, _, _ = _request('POST', api_server + '/api/plan', events, cookies=cookie)
    assert status == 200
    status, _, body = _request('GET', api_server + '/api/plan', cookies=cookie)
    assert status == 200
    got = json.loads(body)
    assert len(got) == 2
    # Ordered by date: 2026-06-15 first, then 2026-12-31
    assert got[0]['id'] == 'uuid-2'
    assert got[1]['id'] == 'uuid-1'
    assert got[1]['title'] == 'New Year Eve'
    assert got[1]['startTime'] == '20:00'
    assert got[1]['endTime'] == '23:59'
    assert got[1]['location'] == 'Oslo'
    assert got[1]['tag'] == 'party'
    assert got[1]['color'] == '#ff0000'


def test_empty_times_round_trip_as_empty_strings(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    _request('POST', api_server + '/api/plan',
             [_ev('uuid-1', '2026-07-04', title='All-day')],
             cookies=cookie)
    _, _, body = _request('GET', api_server + '/api/plan', cookies=cookie)
    got = json.loads(body)
    assert got[0]['startTime'] == ''
    assert got[0]['endTime'] == ''


def test_post_deletes_omitted_events(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    _request('POST', api_server + '/api/plan', [
        _ev('uuid-a', '2026-01-01', title='A'),
        _ev('uuid-b', '2026-02-01', title='B'),
    ], cookies=cookie)
    _request('POST', api_server + '/api/plan', [
        _ev('uuid-a', '2026-01-01', title='A renamed'),
    ], cookies=cookie)
    _, _, body = _request('GET', api_server + '/api/plan', cookies=cookie)
    got = json.loads(body)
    assert len(got) == 1
    assert got[0]['id'] == 'uuid-a'
    assert got[0]['title'] == 'A renamed'


def test_post_empty_list_deletes_everything(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    _request('POST', api_server + '/api/plan',
             [_ev('uuid-a', '2026-01-01')], cookies=cookie)
    _request('POST', api_server + '/api/plan', [], cookies=cookie)
    _, _, body = _request('GET', api_server + '/api/plan', cookies=cookie)
    assert json.loads(body) == []


def test_users_are_isolated(api_server):
    alice = _signup(api_server, 'alice@x.co', 'inv-a')
    bob = _signup(api_server, 'bob@x.co', 'inv-b')
    _request('POST', api_server + '/api/plan',
             [_ev('uuid-a', '2026-01-01', title='alice-only')],
             cookies=alice)
    _, _, body = _request('GET', api_server + '/api/plan', cookies=bob)
    assert json.loads(body) == []
    _, _, body = _request('GET', api_server + '/api/plan', cookies=alice)
    assert len(json.loads(body)) == 1


def test_events_without_date_are_skipped(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    payload = [
        _ev('uuid-good', '2026-01-01', title='ok'),
        {'id': 'uuid-nodate', 'title': 'broken'},  # no date, skip
        {'title': 'no-id'},                          # no id, skip
    ]
    status, _, _ = _request('POST', api_server + '/api/plan', payload, cookies=cookie)
    assert status == 200
    _, _, body = _request('GET', api_server + '/api/plan', cookies=cookie)
    got = json.loads(body)
    assert len(got) == 1
    assert got[0]['id'] == 'uuid-good'
