"""End-to-end tests for the Postgres-backed /api/links."""
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


def _link(ln_id, url='https://x.co', name='X', **overrides):
    base = {
        'id': ln_id, 'url': url, 'name': name, 'sub': '',
        'color': '', 'iconType': 'favicon', 'iconValue': '',
        'favorite': False, 'category': '',
    }
    base.update(overrides)
    return base


def _cat(cat_id, name='Untitled', order=0, **overrides):
    base = {'id': cat_id, 'name': name, 'order': order}
    base.update(overrides)
    return base


def _envelope(categories, links):
    return {'version': 2, 'categories': categories, 'links': links}


def test_anonymous_get_returns_401(api_server):
    status, _, _ = _request('GET', api_server + '/api/links')
    assert status == 401


def test_anonymous_post_returns_401(api_server):
    status, _, _ = _request('POST', api_server + '/api/links', _envelope([], []))
    assert status == 401


def test_authed_get_empty_initially(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    status, _, body = _request('GET', api_server + '/api/links', cookies=cookie)
    assert status == 200
    got = json.loads(body)
    assert got['version'] == 2
    assert got['categories'] == []
    assert got['links'] == []


def test_post_then_get_round_trip(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    payload = _envelope(
        categories=[
            _cat('__favorites', name='Favorites', order=0),
            _cat('cat-tools', name='Tools', order=10),
        ],
        links=[
            _link('lnk-1', url='https://claude.ai', name='Claude', sub='AI',
                  color='#d97757', favorite=True, category='__favorites'),
            _link('lnk-2', url='https://github.com', name='GitHub',
                  category='cat-tools', iconType='favicon'),
        ],
    )
    status, _, _ = _request('POST', api_server + '/api/links', payload, cookies=cookie)
    assert status == 200
    status, _, body = _request('GET', api_server + '/api/links', cookies=cookie)
    assert status == 200
    got = json.loads(body)
    assert got['version'] == 2
    assert len(got['categories']) == 2
    assert got['categories'][0]['id'] == '__favorites'
    assert got['categories'][0]['name'] == 'Favorites'
    assert got['categories'][1]['id'] == 'cat-tools'
    assert len(got['links']) == 2
    assert got['links'][0]['id'] == 'lnk-1'
    assert got['links'][0]['favorite'] is True
    assert got['links'][0]['category'] == '__favorites'
    assert got['links'][1]['category'] == 'cat-tools'


def test_post_deletes_omitted_links_and_categories(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    _request('POST', api_server + '/api/links', _envelope(
        [_cat('cat-a', 'A', 0), _cat('cat-b', 'B', 1)],
        [_link('lnk-1', category='cat-a'), _link('lnk-2', category='cat-b')],
    ), cookies=cookie)
    _request('POST', api_server + '/api/links', _envelope(
        [_cat('cat-a', 'A renamed', 0)],
        [_link('lnk-1', category='cat-a')],
    ), cookies=cookie)
    _, _, body = _request('GET', api_server + '/api/links', cookies=cookie)
    got = json.loads(body)
    assert [c['id'] for c in got['categories']] == ['cat-a']
    assert got['categories'][0]['name'] == 'A renamed'
    assert [ln['id'] for ln in got['links']] == ['lnk-1']


def test_link_referencing_unknown_category_falls_back_to_null(api_server):
    """Defensive: if a payload assigns a link to a category id that
    isn't in the same payload, store the link with no category."""
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    _request('POST', api_server + '/api/links', _envelope(
        [_cat('cat-known', 'Known', 0)],
        [_link('lnk-orphan', category='cat-ghost')],
    ), cookies=cookie)
    _, _, body = _request('GET', api_server + '/api/links', cookies=cookie)
    got = json.loads(body)
    assert got['links'][0]['category'] == ''


def test_users_are_isolated(api_server):
    alice = _signup(api_server, 'alice@x.co', 'inv-a')
    bob = _signup(api_server, 'bob@x.co', 'inv-b')
    _request('POST', api_server + '/api/links', _envelope(
        [_cat('cat-a', 'A', 0)], [_link('lnk-a')],
    ), cookies=alice)
    _, _, body = _request('GET', api_server + '/api/links', cookies=bob)
    got = json.loads(body)
    assert got['links'] == []
    assert got['categories'] == []


def test_links_without_url_or_name_are_skipped(api_server):
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    _request('POST', api_server + '/api/links', _envelope([], [
        _link('lnk-ok'),
        {'id': 'lnk-nourl', 'name': 'no url'},
        {'id': 'lnk-noname', 'url': 'https://x.co'},
    ]), cookies=cookie)
    _, _, body = _request('GET', api_server + '/api/links', cookies=cookie)
    got = json.loads(body)
    assert len(got['links']) == 1
    assert got['links'][0]['id'] == 'lnk-ok'


def test_legacy_bare_array_post_works(api_server):
    """Old clients POST a bare LinkItem[]; the server treats it as a v2
    envelope with no categories."""
    cookie = _signup(api_server, 'alice@x.co', 'inv-a')
    _request('POST', api_server + '/api/links',
             [_link('lnk-1', url='https://a.co', name='A')],
             cookies=cookie)
    _, _, body = _request('GET', api_server + '/api/links', cookies=cookie)
    got = json.loads(body)
    assert got['categories'] == []
    assert got['links'][0]['id'] == 'lnk-1'
