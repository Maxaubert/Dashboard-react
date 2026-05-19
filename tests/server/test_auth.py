"""Tests for server/auth.py -- password hashing + session ID + session lifecycle."""
import pytest

from server import auth as server_auth


def test_hash_password_returns_argon2id():
    """hash_password returns a string starting with the argon2id marker."""
    h = server_auth.hash_password('correct horse battery staple')
    assert h.startswith('$argon2id$')


def test_verify_password_accepts_correct():
    h = server_auth.hash_password('s3cret')
    assert server_auth.verify_password(h, 's3cret') is True


def test_verify_password_rejects_wrong():
    h = server_auth.hash_password('s3cret')
    assert server_auth.verify_password(h, 'wrong') is False


def test_verify_password_rejects_malformed_hash():
    """A garbage 'hash' should return False, not raise."""
    assert server_auth.verify_password('not-a-real-hash', 'anything') is False


def test_generate_session_id_returns_url_safe_token():
    """Session IDs are 43-char URL-safe base64 from 32 random bytes."""
    sid = server_auth.generate_session_id()
    assert len(sid) >= 32
    # URL-safe charset
    import string
    safe = set(string.ascii_letters + string.digits + '-_')
    assert all(c in safe for c in sid)


def test_generate_session_id_returns_unique():
    a = server_auth.generate_session_id()
    b = server_auth.generate_session_id()
    assert a != b


def test_generate_invite_code_returns_url_safe():
    code = server_auth.generate_invite_code()
    assert len(code) >= 16
    assert '/' not in code and '+' not in code  # URL-safe charset


import time
from datetime import datetime, timedelta, timezone

from server import db as server_db


def _setup_db(db_url, monkeypatch):
    """Initialize the pool and apply the schema for a session test."""
    from pathlib import Path
    monkeypatch.setattr(server_db, '_pool', None, raising=False)
    server_db.init_pool(db_url, min_size=1, max_size=2)
    sql = (Path(__file__).resolve().parents[2] / 'server' / 'migrations' / '001_initial.sql').read_text(encoding='utf-8')
    server_db.execute(sql)


def _make_user(email='a@b.co') -> int:
    """Insert a test user, return its id."""
    rows = server_db.query(
        "INSERT INTO users (email, password_hash, display_name) "
        "VALUES (%s, 'x', 'T') RETURNING id",
        (email,),
    )
    return rows[0]['id']


def test_create_session_inserts_row(db_url, monkeypatch):
    _setup_db(db_url, monkeypatch)
    user_id = _make_user()
    sid = server_auth.create_session(user_id, ttl_seconds=3600, user_agent='pytest')
    rows = server_db.query("SELECT user_id, user_agent FROM sessions WHERE id = %s", (sid,))
    assert rows == [{'user_id': user_id, 'user_agent': 'pytest'}]
    server_db.close_pool()


def test_load_session_returns_user_on_fresh(db_url, monkeypatch):
    _setup_db(db_url, monkeypatch)
    user_id = _make_user()
    sid = server_auth.create_session(user_id, ttl_seconds=3600)
    user = server_auth.load_session(sid)
    assert user is not None
    assert user['id'] == user_id
    assert user['email'] == 'a@b.co'
    server_db.close_pool()


def test_load_session_returns_none_on_expired(db_url, monkeypatch):
    _setup_db(db_url, monkeypatch)
    user_id = _make_user()
    # Make a session with negative TTL (immediately expired)
    sid = server_auth.create_session(user_id, ttl_seconds=-1)
    assert server_auth.load_session(sid) is None
    server_db.close_pool()


def test_load_session_returns_none_for_unknown_id(db_url, monkeypatch):
    _setup_db(db_url, monkeypatch)
    assert server_auth.load_session('not-a-real-id') is None
    server_db.close_pool()


def test_delete_session_removes_row(db_url, monkeypatch):
    _setup_db(db_url, monkeypatch)
    user_id = _make_user()
    sid = server_auth.create_session(user_id, ttl_seconds=3600)
    server_auth.delete_session(sid)
    rows = server_db.query("SELECT id FROM sessions WHERE id = %s", (sid,))
    assert rows == []
    server_db.close_pool()


def test_set_session_cookie_header_shape():
    header = server_auth.set_session_cookie_header('abc123', ttl_seconds=3600)
    assert header.startswith('session=abc123')
    assert 'HttpOnly' in header
    assert 'Secure' in header
    assert 'SameSite=Lax' in header
    assert 'Path=/' in header
    assert 'Max-Age=3600' in header


def test_clear_session_cookie_header():
    header = server_auth.clear_session_cookie_header()
    assert 'session=' in header
    assert 'Max-Age=0' in header


def test_parse_session_cookie_finds_value():
    raw = 'foo=bar; session=abc123; baz=qux'
    assert server_auth.parse_session_cookie(raw) == 'abc123'


def test_parse_session_cookie_handles_empty():
    assert server_auth.parse_session_cookie(None) is None
    assert server_auth.parse_session_cookie('') is None
    assert server_auth.parse_session_cookie('no-session-here') is None
