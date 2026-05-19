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
