"""Phase 5: verify the cached/integration endpoints reject anonymous
callers with 401.

We don't test the actual Canvas/Steam fetches here (those need network
+ live credentials). We just confirm the auth fence fires before any
external call happens."""
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


def test_anonymous_skole_returns_401(api_server):
    status, _, _ = _request('GET', api_server + '/api/skole')
    assert status == 401


def test_anonymous_wishlist_returns_401(api_server):
    status, _, _ = _request('GET', api_server + '/api/wishlist')
    assert status == 401


def test_anonymous_pdf_returns_401(api_server):
    status, _, _ = _request('GET', api_server + '/api/pdf?stat=foo')
    assert status == 401


def test_anonymous_report_returns_401(api_server):
    status, _, _ = _request(
        'POST', api_server + '/api/report',
        {'type': 'bug', 'title': 'spam', 'body': 'noauth'},
    )
    assert status == 401


def test_anonymous_news_still_public(api_server):
    """News is purely scraping public RSS; no user data attached, so
    it stays open. This test catches accidentally auth-gating it."""
    # We can't easily verify a 200 here without network, but we can
    # at least verify it's NOT 401 (the auth fence didn't fire). It
    # may return 200 with [] (network unreachable in CI) or 500.
    status, _, _ = _request('GET', api_server + '/api/news?source=vg')
    assert status != 401


def test_anonymous_favicon_still_public(api_server):
    """Same reasoning as news: it's a public-image proxy, no user data."""
    status, _, _ = _request('GET', api_server + '/api/favicon?domain=example.com')
    assert status != 401
