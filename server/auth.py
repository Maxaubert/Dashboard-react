"""Auth helpers for the multi-user dashboard backend.

Two responsibilities in this module:
  1. Password hashing (argon2id) -- see hash_password / verify_password
  2. Cryptographically random ID generation -- session IDs + invite codes

Session lookup, cookie parsing, and the do_GET/do_POST middleware
that ties them together live in this file too -- see the next section
(added by Phase 2 / Task 3).
"""
from __future__ import annotations

import secrets

import argon2
from argon2.exceptions import VerifyMismatchError, InvalidHashError


# argon2id with sensible defaults. time_cost=3, memory_cost=64MiB,
# parallelism=4 is on the recommended side per OWASP 2024.
_HASHER = argon2.PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def hash_password(password: str) -> str:
    """Return an argon2id hash string. Includes the algorithm marker,
    parameters, salt, and hash -- verifiable with verify_password alone."""
    return _HASHER.hash(password)


def verify_password(hash_str: str, password: str) -> bool:
    """Constant-time verify. Returns False for wrong password, malformed
    hash, or any other failure (never raises)."""
    try:
        _HASHER.verify(hash_str, password)
        return True
    except (VerifyMismatchError, InvalidHashError, argon2.exceptions.Argon2Error):
        return False


def generate_session_id() -> str:
    """32 random bytes -> URL-safe base64 (43 chars, no padding)."""
    return secrets.token_urlsafe(32)


def generate_invite_code() -> str:
    """16 chars of URL-safe random. Used as the primary key in invite_codes."""
    return secrets.token_urlsafe(12)  # 12 random bytes -> 16 chars b64


# ---------------------------------------------------------------------------
# Session DB layer  (Phase 2 / Task 3)
# ---------------------------------------------------------------------------

from datetime import datetime, timedelta, timezone
from typing import Any

from server import db as server_db


def create_session(user_id: int, *, ttl_seconds: int, user_agent: str | None = None) -> str:
    """Insert a new sessions row and return the cookie token.

    The session expires `ttl_seconds` from now. Pass a negative ttl in
    tests to simulate an already-expired session."""
    sid = generate_session_id()
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
    server_db.execute(
        "INSERT INTO sessions (id, user_id, expires_at, user_agent) "
        "VALUES (%s, %s, %s, %s)",
        (sid, user_id, expires_at, user_agent),
    )
    return sid


def load_session(sid: str) -> dict[str, Any] | None:
    """Return the current_user dict if the session is valid, else None.

    Also updates last_seen as a side effect. Expired sessions are NOT
    auto-deleted here -- that's a separate cron's job."""
    rows = server_db.query(
        "SELECT u.id, u.email, u.display_name, s.expires_at "
        "FROM sessions s JOIN users u ON u.id = s.user_id "
        "WHERE s.id = %s",
        (sid,),
    )
    if not rows:
        return None
    row = rows[0]
    if row['expires_at'] <= datetime.now(timezone.utc):
        return None
    # Update last_seen (fire-and-forget -- failure here shouldn't break auth)
    try:
        server_db.execute(
            "UPDATE sessions SET last_seen = now() WHERE id = %s", (sid,)
        )
    except Exception:
        pass
    return {'id': row['id'], 'email': row['email'], 'display_name': row['display_name']}


def delete_session(sid: str) -> None:
    server_db.execute("DELETE FROM sessions WHERE id = %s", (sid,))


# --- Cookie helpers --------------------------------------------------

_COOKIE_NAME = 'session'


def _secure_attr() -> str:
    """Return 'Secure; ' unless DASHBOARD_COOKIE_INSECURE is set.

    The production VPS is served over plain HTTP (bare IP, no TLS), and
    browsers refuse to store a Secure cookie over HTTP -- which is why
    the pre-login-page workaround was to install the cookie by hand in
    DevTools. To make the real login form work over HTTP we let the
    deployment opt out of Secure. REMOVE the env var (restoring Secure)
    the moment the site gets HTTPS."""
    import os
    if os.environ.get('DASHBOARD_COOKIE_INSECURE') in ('1', 'true', 'True'):
        return ''
    return 'Secure; '


def set_session_cookie_header(sid: str, *, ttl_seconds: int) -> str:
    """Return a Set-Cookie header value for the session cookie."""
    return (
        f'{_COOKIE_NAME}={sid}; '
        f'HttpOnly; {_secure_attr()}SameSite=Lax; Path=/; Max-Age={ttl_seconds}'
    )


def clear_session_cookie_header() -> str:
    return f'{_COOKIE_NAME}=; HttpOnly; {_secure_attr()}SameSite=Lax; Path=/; Max-Age=0'


def parse_session_cookie(raw_cookie_header: str | None) -> str | None:
    """Pull the session value out of a raw Cookie header. Returns None
    if absent or malformed."""
    if not raw_cookie_header:
        return None
    for part in raw_cookie_header.split(';'):
        kv = part.strip()
        if kv.startswith(_COOKIE_NAME + '='):
            return kv[len(_COOKIE_NAME) + 1:]
    return None
