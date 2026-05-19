# Multi-User Backend — Phase 2: Auth + Sessions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the auth surface — signup, login, logout, current-user, plus admin invite generation. Sessions are server-side. Passwords use argon2id. Everything is exercised by `tests/server/test_auth.py`. After this phase, you can `curl` your way through a full signup → login → me → logout flow against the live site. No existing endpoint changes (those come in Phase 3).

**Architecture:** Adds `server/auth.py` (password hashing + session generation + middleware) and `server/crypto.py` (AES-GCM for per-user secrets, prep for Phase 3). Modifies `server/api.py` to load `current_user` from the session cookie at the top of every `do_GET` / `do_POST`, and adds 5 new endpoints under `/api/auth/*` and `/api/admin/invites`. An in-memory `server/rate_limit.py` guards signup and login.

**Tech Stack:** `argon2-cffi` (password hashing, pinned in Phase 1's `requirements.txt`); `cryptography` (AES-GCM via `Fernet`-style API); pure Python stdlib for everything else.

**Reference spec:** [`plans_md/2026-05-19-multi-user-backend-design.md`](2026-05-19-multi-user-backend-design.md) — Auth flow section.

**Non-goals in this plan:**
- Migrating any existing endpoint to require auth — Phase 3
- Frontend login/signup pages — Phase 6
- Data migration from JSON files — Phase 3
- Password reset via email — separate spec later
- OAuth providers — separate spec later

---

## File structure

```
server/
├── api.py            [MODIFY: add middleware + 5 endpoints]
├── auth.py           [NEW: password + session helpers]
├── crypto.py         [NEW: AES-GCM encrypt/decrypt]
├── rate_limit.py     [NEW: in-memory per-IP rate limit]
├── db.py             [unchanged]
└── migrations/       [unchanged - schema already supports auth]

tests/server/
├── conftest.py       [unchanged]
├── test_db.py        [unchanged]
├── test_auth.py      [NEW: password hashing + session lifecycle]
├── test_crypto.py    [NEW: AES-GCM round-trip]
├── test_rate_limit.py [NEW: limiter behavior]
└── test_api_auth.py  [NEW: end-to-end /api/auth/* via in-process Handler]
```

The `tests/server/test_api_auth.py` file uses `http.server.HTTPServer` started on a random port + `urllib.request` against the new endpoints. Keeps tests inside pytest, no separate runner.

---

## Task 0: Branch off main

- [ ] **Step 1: Sync main + create branch**

```bash
git checkout main
git pull --ff-only origin main
git checkout -b feat/multi-user-phase-2-auth
```

Verify: `git status` shows clean tree on the new branch.

---

## Task 1: `server/crypto.py` — AES-GCM helpers

**Why now (Phase 2, not Phase 3):** The dep (`cryptography`) is already installed from Phase 1. The helpers are tiny and pure. Land them now so Phase 3 just imports them.

**Files:**
- Create: `server/crypto.py`
- Create: `tests/server/test_crypto.py`

- [ ] **Step 1: Write the failing tests**

`tests/server/test_crypto.py`:

```python
"""Tests for server/crypto.py — AES-GCM encrypt/decrypt round-trip."""
import os

import pytest

from server import crypto as server_crypto


def _key() -> bytes:
    """Return a deterministic 32-byte key for tests."""
    return b'\x00' * 32


def test_encrypt_decrypt_round_trip():
    """Plaintext → encrypt → decrypt yields the same plaintext."""
    plaintext = b'{"steam_id":"12345","api_key":"deadbeef"}'
    iv, ciphertext = server_crypto.encrypt(plaintext, _key())
    assert iv != b''
    assert ciphertext != plaintext
    assert server_crypto.decrypt(iv, ciphertext, _key()) == plaintext


def test_different_iv_for_each_encryption():
    """Each encrypt() call generates a fresh IV (no nonce reuse)."""
    p = b'hello'
    iv1, _ = server_crypto.encrypt(p, _key())
    iv2, _ = server_crypto.encrypt(p, _key())
    assert iv1 != iv2


def test_decrypt_with_wrong_key_fails():
    """Wrong key → InvalidTag from cryptography."""
    iv, ct = server_crypto.encrypt(b'secret', _key())
    with pytest.raises(Exception):  # cryptography.exceptions.InvalidTag
        server_crypto.decrypt(iv, ct, b'\xff' * 32)


def test_decrypt_with_tampered_ciphertext_fails():
    """Tamper with one byte of ciphertext → InvalidTag."""
    iv, ct = server_crypto.encrypt(b'secret', _key())
    tampered = bytes([ct[0] ^ 0xff]) + ct[1:]
    with pytest.raises(Exception):
        server_crypto.decrypt(iv, tampered, _key())
```

- [ ] **Step 2: Run failing tests**

```bash
.venv\Scripts\activate
pytest tests/server/test_crypto.py -v
```

Expected: all 4 FAIL with `ModuleNotFoundError: No module named 'server.crypto'`.

- [ ] **Step 3: Write `server/crypto.py`**

```python
"""AES-GCM encrypt/decrypt for per-user secrets at rest.

Per-user integration tokens (Steam, Canvas, etc.) are stored encrypted
in user_integrations.payload_enc. The key lives in /etc/dashboard.env
as DASHBOARD_ENCRYPTION_KEY (32 bytes, base64-encoded). A compromised
DB dump without the env file leaks nothing usable.

Why AES-GCM (not pgcrypto): pgcrypto needs the DB process to hold the
key, breaking the "DB dump alone is useless" property. App-layer
encryption keeps the key off the DB host.
"""
from __future__ import annotations

import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


IV_SIZE = 12  # 96-bit nonce per AES-GCM spec recommendation


def encrypt(plaintext: bytes, key: bytes) -> tuple[bytes, bytes]:
    """Encrypt plaintext with a 32-byte key. Returns (iv, ciphertext).

    Generates a fresh random IV per call — never reuse an (iv, key) pair."""
    if len(key) != 32:
        raise ValueError('key must be 32 bytes')
    iv = os.urandom(IV_SIZE)
    ciphertext = AESGCM(key).encrypt(iv, plaintext, associated_data=None)
    return iv, ciphertext


def decrypt(iv: bytes, ciphertext: bytes, key: bytes) -> bytes:
    """Decrypt with the same key + iv used by encrypt(). Raises
    cryptography.exceptions.InvalidTag if the ciphertext or iv has been
    tampered with or the key is wrong."""
    if len(key) != 32:
        raise ValueError('key must be 32 bytes')
    if len(iv) != IV_SIZE:
        raise ValueError(f'iv must be {IV_SIZE} bytes')
    return AESGCM(key).decrypt(iv, ciphertext, associated_data=None)
```

- [ ] **Step 4: Run tests, expect pass**

```bash
pytest tests/server/test_crypto.py -v
```

Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add server/crypto.py tests/server/test_crypto.py
git commit -m "$(cat <<'EOF'
feat(crypto): AES-GCM encrypt/decrypt for per-user secrets at rest

server/crypto.py wraps cryptography.AESGCM with a tiny encrypt/decrypt
surface used by Phase 3 to protect Steam/Canvas tokens in
user_integrations.payload_enc. Fresh 12-byte IV per call; 32-byte key
loaded from /etc/dashboard.env at startup (in api.py later this phase).

Round-trip + tampering tests cover: clean encrypt→decrypt, fresh IV
per call (no nonce reuse), wrong key fails, tampered ciphertext fails.

Phase 2 of multi-user-backend.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `server/auth.py` — password hashing + session ID generation

**Files:**
- Create: `server/auth.py`
- Create: `tests/server/test_auth.py`

- [ ] **Step 1: Write the failing tests**

`tests/server/test_auth.py`:

```python
"""Tests for server/auth.py — password hashing + session ID + session lifecycle."""
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
```

- [ ] **Step 2: Run failing tests**

```bash
pytest tests/server/test_auth.py -v
```

Expected: 7 FAIL with `ModuleNotFoundError: No module named 'server.auth'`.

- [ ] **Step 3: Write `server/auth.py`**

```python
"""Auth helpers for the multi-user dashboard backend.

Two responsibilities in this module:
  1. Password hashing (argon2id) — see hash_password / verify_password
  2. Cryptographically random ID generation — session IDs + invite codes

Session lookup, cookie parsing, and the do_GET/do_POST middleware
that ties them together live in this file too — see the next section.
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
    parameters, salt, and hash — verifiable with verify_password alone."""
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
    """32 random bytes → URL-safe base64 (43 chars, no padding)."""
    return secrets.token_urlsafe(32)


def generate_invite_code() -> str:
    """16 chars of URL-safe random. Used as the primary key in invite_codes."""
    return secrets.token_urlsafe(12)  # 12 random bytes → 16 chars b64
```

- [ ] **Step 4: Run tests, expect pass**

```bash
pytest tests/server/test_auth.py -v
```

Expected: 7 PASS.

- [ ] **Step 5: Commit**

```bash
git add server/auth.py tests/server/test_auth.py
git commit -m "$(cat <<'EOF'
feat(auth): password hashing + session/invite ID generation

server/auth.py:
- hash_password / verify_password using argon2id (time_cost=3,
  memory_cost=65536, parallelism=4 — OWASP 2024 recommendations).
  verify_password never raises; returns False on any failure.
- generate_session_id returns 32 random bytes as URL-safe base64.
- generate_invite_code returns 16 chars of URL-safe random.

Tests cover: hash format starts with $argon2id$, correct password
verifies, wrong password rejects, malformed hash doesn't crash,
session IDs are unique + URL-safe, invite codes are URL-safe.

Phase 2 of multi-user-backend.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Session DB layer + cookie helpers

**Files:**
- Modify: `server/auth.py` (append session DB functions)
- Modify: `tests/server/test_auth.py` (append session tests)

- [ ] **Step 1: Write failing session tests**

Append to `tests/server/test_auth.py`:

```python
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
```

- [ ] **Step 2: Run, expect failures**

```bash
pytest tests/server/test_auth.py -v
```

Expected: previous 7 PASS, new tests FAIL on `AttributeError: module 'server.auth' has no attribute 'create_session'` etc.

- [ ] **Step 3: Append session functions to `server/auth.py`**

Add to the end of `server/auth.py`:

```python
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
    auto-deleted here — that's the daily cron's job."""
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
    # Update last_seen (fire-and-forget — failure here shouldn't break auth)
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


def set_session_cookie_header(sid: str, *, ttl_seconds: int) -> str:
    """Return a Set-Cookie header value for the session cookie."""
    return (
        f'{_COOKIE_NAME}={sid}; '
        f'HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age={ttl_seconds}'
    )


def clear_session_cookie_header() -> str:
    return f'{_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'


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
```

- [ ] **Step 4: Run, expect all 16 tests pass (7 + 9 new)**

```bash
pytest tests/server/test_auth.py -v
```

- [ ] **Step 5: Commit**

```bash
git add server/auth.py tests/server/test_auth.py
git commit -m "$(cat <<'EOF'
feat(auth): session DB layer + cookie helpers

Adds to server/auth.py:
- create_session(user_id, ttl_seconds): inserts a sessions row, returns
  the cookie token
- load_session(sid): joins sessions + users, returns current_user dict
  or None for expired/unknown
- delete_session(sid): logout path
- set_session_cookie_header / clear_session_cookie_header: build the
  Set-Cookie value (HttpOnly + Secure + SameSite=Lax + 30-day Max-Age)
- parse_session_cookie: pull the session= value from a raw Cookie header

Session expiry checked at load time (not auto-deleted). Daily cron
sweeps expired rows.

Tests cover: insert + read back, expired return None, unknown return
None, delete removes, cookie header shape, cookie parse edge cases.

Phase 2 of multi-user-backend.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `server/rate_limit.py` — in-memory rate limiter

**Files:**
- Create: `server/rate_limit.py`
- Create: `tests/server/test_rate_limit.py`

- [ ] **Step 1: Write failing tests**

`tests/server/test_rate_limit.py`:

```python
"""Tests for server/rate_limit.py — fixed-window per-IP-per-route counter."""
import time

import pytest

from server import rate_limit


@pytest.fixture(autouse=True)
def fresh_limiter():
    """Each test starts with an empty limiter."""
    rate_limit._buckets.clear()


def test_under_limit_allows():
    for _ in range(4):
        assert rate_limit.check('login', '1.1.1.1', max_count=5, window_seconds=60)


def test_at_limit_blocks():
    for _ in range(5):
        rate_limit.check('login', '1.1.1.1', max_count=5, window_seconds=60)
    assert rate_limit.check('login', '1.1.1.1', max_count=5, window_seconds=60) is False


def test_different_ips_independent():
    for _ in range(5):
        rate_limit.check('login', '1.1.1.1', max_count=5, window_seconds=60)
    # Different IP should still be allowed
    assert rate_limit.check('login', '2.2.2.2', max_count=5, window_seconds=60)


def test_different_routes_independent():
    for _ in range(5):
        rate_limit.check('login', '1.1.1.1', max_count=5, window_seconds=60)
    # Different route should still be allowed
    assert rate_limit.check('signup', '1.1.1.1', max_count=5, window_seconds=60)


def test_window_rollover(monkeypatch):
    fake_time = [1000.0]
    monkeypatch.setattr(rate_limit.time, 'time', lambda: fake_time[0])
    for _ in range(5):
        rate_limit.check('login', '1.1.1.1', max_count=5, window_seconds=60)
    assert rate_limit.check('login', '1.1.1.1', max_count=5, window_seconds=60) is False
    fake_time[0] = 1061.0  # 61 seconds later — new window
    assert rate_limit.check('login', '1.1.1.1', max_count=5, window_seconds=60)
```

- [ ] **Step 2: Run, expect FAIL on import**

```bash
pytest tests/server/test_rate_limit.py -v
```

- [ ] **Step 3: Write `server/rate_limit.py`**

```python
"""Fixed-window per-IP-per-route rate limiter.

In-memory only — state resets on process restart. Good enough for
small-community scale; if abuse becomes a real problem, move to a
failed_logins table in Postgres.

Usage:
    if not rate_limit.check('login', client_ip, max_count=5, window_seconds=900):
        # 429 Too Many Requests
"""
from __future__ import annotations

import time
from threading import Lock


# (route, ip) → (window_start_unix, count)
_buckets: dict[tuple[str, str], tuple[float, int]] = {}
_lock = Lock()


def check(route: str, ip: str, *, max_count: int, window_seconds: int) -> bool:
    """Return True if the call is allowed, False if the window cap is hit.

    A True return INCREMENTS the count. Failed-login callers should call
    this on failure only, so a successful login doesn't burn a slot."""
    now = time.time()
    key = (route, ip)
    with _lock:
        bucket = _buckets.get(key)
        if bucket is None or now - bucket[0] >= window_seconds:
            # New or expired window
            _buckets[key] = (now, 1)
            return True
        window_start, count = bucket
        if count >= max_count:
            return False
        _buckets[key] = (window_start, count + 1)
        return True
```

- [ ] **Step 4: Run, expect 5 PASS**

```bash
pytest tests/server/test_rate_limit.py -v
```

- [ ] **Step 5: Commit**

```bash
git add server/rate_limit.py tests/server/test_rate_limit.py
git commit -m "$(cat <<'EOF'
feat(auth): in-memory per-IP-per-route rate limiter

server/rate_limit.py — fixed-window counter, threading-safe, in-process
only. Used by signup/login to throttle credential stuffing and invite-
code brute force.

API: rate_limit.check(route, ip, max_count, window_seconds) returns
True (and increments) if allowed, False if at cap.

Tests cover: under cap allows, at cap blocks, IPs independent, routes
independent, window rollover allows again.

Phase 2 of multi-user-backend.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire session middleware into `server/api.py`

**Files:**
- Modify: `server/api.py`

This task adds the session-loading wrapper at the top of `do_GET` / `do_POST` so endpoints can call `self.current_user`. It does NOT add any new endpoint or require auth on existing ones — existing endpoints stay open. The plumbing is what lands here.

- [ ] **Step 1: Read the current api.py structure**

```bash
grep -n "def do_GET\|def do_POST\|class Handler" server/api.py
```

Note the line where `class Handler(BaseHTTPRequestHandler):` is defined and where `do_GET` / `do_POST` start. You'll add the session loader as a method on `Handler`.

- [ ] **Step 2: Add imports at the top of api.py**

Find the existing import block (top of file, around line 10–14). Add these lines after the existing imports:

```python
import base64
from server import db as server_db
from server import auth as server_auth
```

(`base64` is for decoding the encryption key from env later.)

- [ ] **Step 3: Add DB pool initialization to the `__main__` block**

Find the bottom of `server/api.py`:

```python
if __name__ == '__main__':
    server = ThreadingHTTPServer(('0.0.0.0', 3001), Handler)
    server.daemon_threads = True
    ...
```

Modify to initialize the pool first:

```python
if __name__ == '__main__':
    db_url = os.environ.get('DASHBOARD_DB_URL')
    if not db_url:
        raise SystemExit('ERROR: DASHBOARD_DB_URL is missing from /etc/dashboard.env')
    server_db.init_pool(db_url, min_size=2, max_size=10)
    server = ThreadingHTTPServer(('0.0.0.0', 3001), Handler)
    server.daemon_threads = True
    print('Dashboard API running on port 3001 (DB pool active)')
    server.serve_forever()
```

- [ ] **Step 4: Add a `current_user` property to `Handler`**

Inside `class Handler(BaseHTTPRequestHandler):`, before `do_OPTIONS`, add:

```python
    @property
    def current_user(self):
        """Lazily resolve the current user from the session cookie.
        Cached per-request via _current_user_cache."""
        if hasattr(self, '_current_user_cache'):
            return self._current_user_cache
        cookie = self.headers.get('Cookie', '')
        sid = server_auth.parse_session_cookie(cookie)
        if sid is None:
            self._current_user_cache = None
        else:
            try:
                self._current_user_cache = server_auth.load_session(sid)
            except Exception:
                self._current_user_cache = None
        return self._current_user_cache

    def require_auth(self):
        """Helper: return current_user or send 401 and return None.
        Endpoints that need auth start with: user = self.require_auth()
        if user is None: return"""
        user = self.current_user
        if user is None:
            self.send_response(401)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            body = b'{"error":"not authenticated"}'
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return None
        return user
```

- [ ] **Step 5: Local syntax check**

```bash
python -c "import ast; ast.parse(open('server/api.py', encoding='utf-8').read()); print('syntax OK')"
```

Expected: `syntax OK`. Don't deploy yet — the deploy step is Task 10.

- [ ] **Step 6: Commit**

```bash
git add server/api.py
git commit -m "$(cat <<'EOF'
feat(auth): wire session middleware into api.py

Adds DB pool initialization at startup (reads DASHBOARD_DB_URL from
env, fails closed if missing). Adds Handler.current_user and
Handler.require_auth helpers. Existing endpoints unchanged — they
just don't call require_auth.

This is plumbing-only. The auth endpoints that exercise this
foundation land in the next commit.

Phase 2 of multi-user-backend.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `POST /api/auth/signup`

**Files:**
- Modify: `server/api.py` (add the signup handler branch in `do_POST`)
- Create: `tests/server/test_api_auth.py`

- [ ] **Step 1: Write the end-to-end test harness + signup tests**

`tests/server/test_api_auth.py`:

```python
"""End-to-end tests for /api/auth/* via an in-process HTTPServer.

Spins up api.py's Handler on a random port, hits it with urllib.
Each test gets a fresh Postgres (via the existing db_url fixture)."""
import json
import threading
import time
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


# ---- Signup tests ----

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
        'password': 'pw123long', 'display_name': 'A',
    })
    # Second attempt with same code fails
    status, _, _ = _post(api_server + '/api/auth/signup', {
        'code': 'one-shot', 'email': 'b@b.co',
        'password': 'pw123long', 'display_name': 'B',
    })
    assert status == 401


def test_signup_duplicate_email_returns_409(api_server):
    _seed_invite('inv1')
    _seed_invite('inv2')
    _post(api_server + '/api/auth/signup', {
        'code': 'inv1', 'email': 'dup@b.co',
        'password': 'pw123long', 'display_name': 'A',
    })
    status, _, _ = _post(api_server + '/api/auth/signup', {
        'code': 'inv2', 'email': 'dup@b.co',
        'password': 'pw123long', 'display_name': 'B',
    })
    assert status == 409


def test_signup_short_password_returns_400(api_server):
    _seed_invite('inv')
    status, _, _ = _post(api_server + '/api/auth/signup', {
        'code': 'inv', 'email': 'a@b.co',
        'password': 'short', 'display_name': 'A',
    })
    assert status == 400
```

- [ ] **Step 2: Add the signup handler to `server/api.py`**

In the `do_POST` method, find where the existing path-matching block starts (probably `if self.path == '/api/report':` or similar). Add a new branch BEFORE the existing routes:

```python
        if self.path == '/api/auth/signup':
            return self._handle_signup()
```

Then add the implementation as a method on `Handler` (alongside `current_user`):

```python
    def _handle_signup(self):
        """POST /api/auth/signup: { code, email, password, display_name }"""
        client_ip = self.client_address[0]
        if not rate_limit.check('signup', client_ip, max_count=10, window_seconds=3600):
            return self._json(429, {'error': 'too many signup attempts'})

        try:
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length))
        except Exception:
            return self._json(400, {'error': 'invalid JSON'})

        code = (body.get('code') or '').strip()
        email = (body.get('email') or '').strip().lower()
        password = body.get('password') or ''
        display_name = (body.get('display_name') or '').strip()

        if not (code and email and password and display_name):
            return self._json(400, {'error': 'missing fields'})
        if len(password) < 10:
            return self._json(400, {'error': 'password must be at least 10 characters'})
        if '@' not in email:
            return self._json(400, {'error': 'invalid email'})

        # Validate + consume invite atomically. UPDATE returning 1 row =
        # we won the race; 0 rows = code was already used or doesn't exist.
        with server_db.tx() as conn:
            with conn.cursor() as cur:
                # Check email isn't taken first (separate query so we can
                # report 409 vs 401 cleanly)
                cur.execute("SELECT 1 FROM users WHERE email = %s", (email,))
                if cur.fetchone() is not None:
                    return self._json(409, {'error': 'email already registered'})

                # Try to claim the invite
                cur.execute(
                    "UPDATE invite_codes SET used_at = now() "
                    "WHERE code = %s AND used_at IS NULL "
                    "RETURNING code",
                    (code,),
                )
                if cur.fetchone() is None:
                    return self._json(401, {'error': 'invalid or used invite code'})

                # Create the user
                cur.execute(
                    "INSERT INTO users (email, password_hash, display_name) "
                    "VALUES (%s, %s, %s) RETURNING id",
                    (email, server_auth.hash_password(password), display_name),
                )
                user_id = cur.fetchone()['id']

                # Stamp the invite with who used it (the user_id wasn't
                # known when we did the UPDATE above)
                cur.execute(
                    "UPDATE invite_codes SET used_by_id = %s WHERE code = %s",
                    (user_id, code),
                )

        # Create session, set cookie, return user payload.
        sid = server_auth.create_session(
            user_id,
            ttl_seconds=30 * 24 * 3600,
            user_agent=self.headers.get('User-Agent'),
        )
        self._json(200, {
            'user': {'id': user_id, 'email': email, 'display_name': display_name}
        }, extra_headers=[
            ('Set-Cookie', server_auth.set_session_cookie_header(sid, ttl_seconds=30 * 24 * 3600))
        ])

    def _json(self, status, payload, *, extra_headers=()):
        """Send a JSON response. Used by all auth endpoints."""
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        for k, v in extra_headers:
            self.send_header(k, v)
        self._cors()
        self.end_headers()
        self.wfile.write(body)
```

Also add `from server import rate_limit` to the top of `api.py`.

- [ ] **Step 3: Run tests**

```bash
pytest tests/server/test_api_auth.py -v
```

Expected: 5 signup tests PASS.

- [ ] **Step 4: Commit**

```bash
git add server/api.py tests/server/test_api_auth.py
git commit -m "$(cat <<'EOF'
feat(auth): POST /api/auth/signup

Accepts { code, email, password, display_name }. Validates: code
exists and unused, email isn't already registered, password is at
least 10 chars, email contains @.

Atomic invite claim: a single UPDATE with `WHERE used_at IS NULL`
guards against two concurrent signups claiming the same code — the
loser's UPDATE returns 0 rows and we 401.

On success: creates the user (argon2id-hashed password), marks the
invite consumed by the new user_id, creates a 30-day session, sets
the session cookie, returns { user: {...} }.

Rate-limited: 10 signup attempts per hour per IP.

Tests cover: happy path, invalid invite, consumed invite, duplicate
email (409), short password (400). End-to-end via in-process
HTTPServer on a random port + urllib.

Phase 2 of multi-user-backend.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `POST /api/auth/login` + `POST /api/auth/logout` + `GET /api/auth/me`

**Files:**
- Modify: `server/api.py`
- Modify: `tests/server/test_api_auth.py`

- [ ] **Step 1: Write failing tests for the three endpoints**

Append to `tests/server/test_api_auth.py`:

```python
def _signup_and_get_cookie(api_server, email='a@b.co', code='inv'):
    """Helper: seed an invite, signup, return the session cookie value."""
    _seed_invite(code)
    _, headers, _ = _post(api_server + '/api/auth/signup', {
        'code': code, 'email': email,
        'password': 'pw1234567890', 'display_name': 'A',
    })
    raw = headers['Set-Cookie']
    # 'session=abc; HttpOnly; ...' → extract 'session=abc'
    return raw.split(';')[0]


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

def _get(url, cookies=None):
    req = urllib.request.Request(url, method='GET')
    if cookies:
        req.add_header('Cookie', cookies)
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, dict(r.headers), r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode()


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
```

- [ ] **Step 2: Add the three handlers to `server/api.py`**

In `do_POST`, after the signup branch:

```python
        if self.path == '/api/auth/login':
            return self._handle_login()
        if self.path == '/api/auth/logout':
            return self._handle_logout()
```

In `do_GET`, near the top of the routing block:

```python
        if self.path == '/api/auth/me':
            return self._handle_me()
```

Method bodies:

```python
    def _handle_login(self):
        client_ip = self.client_address[0]
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length))
        except Exception:
            return self._json(400, {'error': 'invalid JSON'})

        email = (body.get('email') or '').strip().lower()
        password = body.get('password') or ''
        if not (email and password):
            return self._json(400, {'error': 'missing fields'})

        rows = server_db.query(
            "SELECT id, password_hash, email, display_name "
            "FROM users WHERE email = %s",
            (email,),
        )
        if not rows or not server_auth.verify_password(rows[0]['password_hash'], password):
            # Only burn a rate-limit slot on actual failure so successful
            # logins don't penalize the user.
            if not rate_limit.check('login', client_ip, max_count=5, window_seconds=900):
                return self._json(429, {'error': 'too many failed login attempts'})
            return self._json(401, {'error': 'invalid credentials'})

        user = rows[0]
        sid = server_auth.create_session(
            user['id'], ttl_seconds=30 * 24 * 3600,
            user_agent=self.headers.get('User-Agent'),
        )
        self._json(200, {
            'user': {'id': user['id'], 'email': user['email'],
                     'display_name': user['display_name']}
        }, extra_headers=[
            ('Set-Cookie', server_auth.set_session_cookie_header(sid, ttl_seconds=30 * 24 * 3600))
        ])

    def _handle_logout(self):
        cookie = self.headers.get('Cookie', '')
        sid = server_auth.parse_session_cookie(cookie)
        if sid:
            try:
                server_auth.delete_session(sid)
            except Exception:
                pass
        self.send_response(204)
        self._cors()
        self.send_header('Set-Cookie', server_auth.clear_session_cookie_header())
        self.end_headers()

    def _handle_me(self):
        user = self.current_user
        if user is None:
            return self._json(401, {'error': 'not authenticated'})
        return self._json(200, {'user': user})
```

- [ ] **Step 3: Run tests**

```bash
pytest tests/server/test_api_auth.py -v
```

Expected: previous 5 + 7 new = 12 PASS.

- [ ] **Step 4: Commit**

```bash
git add server/api.py tests/server/test_api_auth.py
git commit -m "$(cat <<'EOF'
feat(auth): login, logout, me endpoints

- POST /api/auth/login: argon2 verify, create 30-day session, set
  cookie. Burns a rate-limit slot only on failure (5/15min/IP) so a
  successful login doesn't penalize the user.
- POST /api/auth/logout: delete session row, clear cookie, 204. No
  body needed.
- GET /api/auth/me: returns the current_user dict (id, email,
  display_name) or 401 when anonymous. Used by the frontend later
  to gate the app on auth state.

Tests cover the full signup → login → me → logout flow end-to-end.

Phase 2 of multi-user-backend.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `POST /api/admin/invites` — admin-only invite generation

**Files:**
- Modify: `server/api.py`
- Modify: `tests/server/test_api_auth.py`

- [ ] **Step 1: Write failing tests**

Append to `tests/server/test_api_auth.py`:

```python
def test_admin_invites_creates_codes(api_server):
    # First user is user_id = 1 → admin
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
    # Second user (regular) — user_id will be 2, not admin
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
```

- [ ] **Step 2: Add the admin handler**

In `do_POST` routing block:

```python
        if self.path == '/api/admin/invites':
            return self._handle_admin_invites()
```

Method:

```python
    def _handle_admin_invites(self):
        user = self.require_auth()
        if user is None:
            return
        if user['id'] != 1:
            return self._json(403, {'error': 'admin only'})

        try:
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length))
        except Exception:
            body = {}

        count = max(1, min(50, int(body.get('count', 1))))
        codes = []
        with server_db.tx() as conn:
            with conn.cursor() as cur:
                for _ in range(count):
                    code = server_auth.generate_invite_code()
                    cur.execute(
                        "INSERT INTO invite_codes (code, created_by_id) "
                        "VALUES (%s, %s)",
                        (code, user['id']),
                    )
                    codes.append(code)
        return self._json(200, {'codes': codes})
```

- [ ] **Step 3: Run tests**

```bash
pytest tests/server/test_api_auth.py -v
```

Expected: 15 PASS (12 prior + 3 new).

- [ ] **Step 4: Commit**

```bash
git add server/api.py tests/server/test_api_auth.py
git commit -m "$(cat <<'EOF'
feat(auth): POST /api/admin/invites — admin-only invite generation

Gated by user_id = 1 (admin per the spec's v1 admin model).
Accepts { count } (clamped 1..50), generates N invite codes, inserts
them with created_by_id = admin, returns the list.

Tests cover: admin can create, regular user gets 403, anonymous
gets 401.

Phase 2 of multi-user-backend.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Generate the encryption key + add to /etc/dashboard.env

**Files:**
- Create: `_setup_encryption_key.py` (gitignored, one-shot)

The AES-GCM helpers from Task 1 need a 32-byte key. Phase 3 will read it from `DASHBOARD_ENCRYPTION_KEY` in `/etc/dashboard.env`. Generate it now so it's there when Phase 3 deploys.

- [ ] **Step 1: Add the script to .gitignore**

Edit `.gitignore`, under the "Local discovery / deploy helpers" block, add:

```
_setup_encryption_key.py
```

Commit:
```bash
git add .gitignore
git commit -m "$(cat <<'EOF'
chore: gitignore _setup_encryption_key.py

One-shot helper to generate AES-GCM encryption key for per-user
secrets in Phase 3. Follows the underscore-prefix-deploy-helper
convention.

Phase 2 of multi-user-backend.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: Write `_setup_encryption_key.py`**

```python
#!/usr/bin/env python3
"""One-shot: generate AES-GCM key and add to /etc/dashboard.env.

Idempotent — skips if DASHBOARD_ENCRYPTION_KEY is already present.

Phase 2 of multi-user-backend. The key is used by Phase 3's
server/crypto.py to encrypt per-user Steam/Canvas tokens at rest."""
import base64
import io
import os
import secrets
import sys

import paramiko

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HERE = os.path.dirname(os.path.abspath(__file__))
REMOTE_ENV = '/etc/dashboard.env'


def load_creds():
    creds = {}
    with open(os.path.join(HERE, 'dashboard.txt'), 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if '=' in line:
                k, v = line.split('=', 1)
                creds[k.strip()] = v.strip()
    return creds


def main():
    creds = load_creds()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f'Connecting to {creds["HOST"]}...', flush=True)
    client.connect(creds['HOST'], username=creds['USER'],
                   password=creds['PASS'], timeout=15)

    # Check if key already present
    _, sout, _ = client.exec_command(
        f'grep -q "^DASHBOARD_ENCRYPTION_KEY=" {REMOTE_ENV} && echo present || echo missing'
    )
    out = sout.read().decode().strip()
    if 'present' in out:
        print('DASHBOARD_ENCRYPTION_KEY already in /etc/dashboard.env. Nothing to do.', flush=True)
        client.close()
        return

    # Generate 32 random bytes, base64-encode for storage
    key_bytes = secrets.token_bytes(32)
    key_b64 = base64.urlsafe_b64encode(key_bytes).decode()

    cmd = f"echo 'DASHBOARD_ENCRYPTION_KEY={key_b64}' >> {REMOTE_ENV} && chmod 600 {REMOTE_ENV}"
    _, sout, serr = client.exec_command(cmd)
    rc = sout.channel.recv_exit_status()
    if rc != 0:
        err = serr.read().decode()
        raise RuntimeError(f'failed to append key (rc={rc}): {err}')

    print('✓ DASHBOARD_ENCRYPTION_KEY appended to /etc/dashboard.env.', flush=True)
    print('  Phase 3 will read this key to encrypt per-user integration secrets.', flush=True)
    client.close()


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'\nERROR: {type(e).__name__}: {e}', file=sys.stderr)
        sys.exit(1)
```

- [ ] **Step 3: Run it**

```bash
.venv\Scripts\python _setup_encryption_key.py
```

Expected: `✓ DASHBOARD_ENCRYPTION_KEY appended` on first run, `already in /etc/dashboard.env` on re-run.

- [ ] **Step 4: Verify on VPS**

```bash
.venv\Scripts\python -c "
import paramiko
creds = {}
with open('dashboard.txt') as f:
    for l in f:
        if '=' in l:
            k,v = l.strip().split('=', 1); creds[k.strip()] = v.strip()
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(creds['HOST'], username=creds['USER'], password=creds['PASS'], timeout=15)
_, sout, _ = c.exec_command('grep -c ENCRYPTION_KEY /etc/dashboard.env')
print('ENCRYPTION_KEY lines in /etc/dashboard.env:', sout.read().decode().strip())
c.close()
"
```

Expected: `1`.

(No commit step — the script is gitignored and made no source changes.)

---

## Task 10: Deploy + smoke test against production

**Files:**
- Modify: `server/todo-api.service` (already references EnvironmentFile=/etc/dashboard.env, no change needed)
- Modify: `_deploy_api.py` (probably no change — it just SCPs api.py)

- [ ] **Step 1: Verify all local tests still pass**

```bash
npm run typecheck
npm test
.venv\Scripts\python -m pytest tests/server -v
```

All green required.

- [ ] **Step 2: Deploy api.py**

```bash
.venv\Scripts\python -u _deploy_api.py > _deploy_out.txt 2>&1
cat _deploy_out.txt
```

Expected: existing smoke tests in `_deploy_api.py` still pass (the news endpoint check, report sentinel). New endpoints aren't covered by that script — we'll smoke-test them next.

If the service fails to start because the DB pool can't initialize, check that `DASHBOARD_DB_URL` is in `/etc/dashboard.env` (it should be from Phase 1's `_setup_postgres.py`).

- [ ] **Step 3: Smoke-test the new auth endpoints end-to-end**

Write a quick inline check via paramiko + curl-on-the-VPS (which bypasses nginx basic auth):

```bash
.venv\Scripts\python -c "
import paramiko
creds = {}
with open('dashboard.txt') as f:
    for l in f:
        if '=' in l:
            k,v = l.strip().split('=', 1); creds[k.strip()] = v.strip()
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(creds['HOST'], username=creds['USER'], password=creds['PASS'], timeout=15)

# 1. Hit /api/auth/me with no cookie — expect 401
_, sout, _ = c.exec_command('curl -s -o /dev/null -w %{http_code} http://127.0.0.1:3001/api/auth/me')
print('me anonymous:', sout.read().decode().strip(), '(expect 401)')

# 2. Generate an invite code by direct SQL insert (since we don't have an admin user yet)
_, sout, _ = c.exec_command(
    'sudo -u postgres psql -d dashboard -tAc \"INSERT INTO invite_codes (code) VALUES (\\'smoke-test-1\\') RETURNING code\"'
)
print('seeded invite:', sout.read().decode().strip())

# 3. Signup
_, sout, _ = c.exec_command(
    'curl -s -i -X POST -H \"Content-Type: application/json\" '
    '--data \\'{\\\"code\\\":\\\"smoke-test-1\\\",\\\"email\\\":\\\"smoke@example.com\\\",\\\"password\\\":\\\"smokepass123\\\",\\\"display_name\\\":\\\"Smoke\\\"}\\' '
    'http://127.0.0.1:3001/api/auth/signup'
)
print('signup response:'); print(sout.read().decode()[:600])

c.close()
"
```

Expected:
- `me anonymous: 401`
- `seeded invite: smoke-test-1`
- Signup response: `HTTP/1.0 200 OK` with `Set-Cookie: session=...`

If signup fails, check `journalctl -u todo-api -n 30 --no-pager` on the VPS.

- [ ] **Step 4: Clean up the smoke-test data**

```bash
.venv\Scripts\python -c "
import paramiko
creds = {}
with open('dashboard.txt') as f:
    for l in f:
        if '=' in l:
            k,v = l.strip().split('=', 1); creds[k.strip()] = v.strip()
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(creds['HOST'], username=creds['USER'], password=creds['PASS'], timeout=15)
_, sout, _ = c.exec_command(
    'sudo -u postgres psql -d dashboard -c \"DELETE FROM users WHERE email = \\'smoke@example.com\\'; '
    'DELETE FROM invite_codes WHERE code = \\'smoke-test-1\\';\"'
)
print(sout.read().decode())
c.close()
"
```

(No commit step — deploys don't change tracked code beyond what's already committed.)

---

## Task 11: Update CLAUDE.md + push + PR

**Files:**
- Modify: `CLAUDE.md` (add an Auth section)

- [ ] **Step 1: Add Auth section to CLAUDE.md**

Find the `## Database` section. AFTER it, BEFORE `## Server-side conventions`, add:

```markdown
## Auth (Phase 2 onward of multi-user-backend)

- **Password hashing**: argon2id via `argon2-cffi`. `server.auth.hash_password` / `server.auth.verify_password`. verify never raises — returns False on any failure (wrong password, malformed hash, etc.).
- **Sessions**: server-side. `sessions` table maps cookie token → user_id. 30-day TTL. Cookie is `HttpOnly`, `Secure`, `SameSite=Lax`. Expired rows swept by the daily backup cron is fine for v1; add a dedicated cron if abuse becomes real.
- **Session middleware**: `Handler.current_user` lazily resolves from the Cookie header. `Handler.require_auth()` returns the user or sends 401 and returns None — endpoints needing auth start with `user = self.require_auth(); if user is None: return`.
- **Admin**: gated by `user_id == 1`. No `users.role` column yet. Add when there's a second admin.
- **Rate limiting**: in-memory per-IP-per-route. Login: 5 failures / 15 min, increment only on failure. Signup: 10 / hour. State resets on process restart.
- **AES-GCM at rest**: `server.crypto.encrypt(plaintext, key)` returns `(iv, ciphertext)`. Key is in `/etc/dashboard.env` as `DASHBOARD_ENCRYPTION_KEY` (32 bytes, base64-urlsafe-encoded). Used in Phase 3 for per-user integration tokens.
- **Endpoints** (new in Phase 2):
  - `POST /api/auth/signup` — `{code, email, password, display_name}` → user + cookie
  - `POST /api/auth/login` — `{email, password}` → user + cookie
  - `POST /api/auth/logout` — clears session, 204
  - `GET /api/auth/me` — current user, or 401
  - `POST /api/admin/invites` — admin only, `{count}` → `{codes: [...]}`
```

- [ ] **Step 2: Commit + push + open PR**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: add Auth section to CLAUDE.md

Phase 2 of multi-user-backend ships auth endpoints + session middleware
+ rate limiter + AES-GCM crypto helper. Document the conventions and
endpoints so future sessions know:
- argon2id for passwords, server-side sessions with 30-day cookies
- admin = user_id == 1
- in-memory rate limiter (login 5/15min, signup 10/hour)
- AES-GCM at rest, key from DASHBOARD_ENCRYPTION_KEY
- new /api/auth/* endpoints + /api/admin/invites

Phase 2 of multi-user-backend.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

git push -u origin feat/multi-user-phase-2-auth

gh pr create --title "feat: phase 2 — auth + sessions + admin invites" --body "$(cat <<'EOF'
## Summary

Second phase of the multi-user-backend project. Adds the full auth surface — signup, login, logout, current-user, plus admin invite generation. Sessions are server-side. Passwords use argon2id. Nothing existing changes — every current endpoint still works without auth (those get migrated in Phase 3).

## What this PR ships

- **server/auth.py** — password hashing (argon2id), session create/load/delete, cookie helpers
- **server/crypto.py** — AES-GCM encrypt/decrypt for Phase 3's per-user token storage
- **server/rate_limit.py** — in-memory fixed-window limiter
- **5 new endpoints**:
  - \`POST /api/auth/signup\` — accepts invite code + email + password
  - \`POST /api/auth/login\` — email/password, returns session cookie
  - \`POST /api/auth/logout\` — clears session
  - \`GET /api/auth/me\` — returns current user or 401
  - \`POST /api/admin/invites\` — admin-only invite generation
- **DB pool init** at startup — \`DASHBOARD_DB_URL\` loaded from \`/etc/dashboard.env\`
- **DASHBOARD_ENCRYPTION_KEY** generated on the VPS (Phase 3 will use it)
- **CLAUDE.md** documents the auth conventions

## Not in this PR

- No existing endpoint requires auth yet — Phase 3
- No data migration — Phase 3
- No frontend login/signup pages — Phase 6
- No password reset via email — out of scope

## Test plan

- [x] \`npm run test:server\` — all server tests pass (auth + crypto + rate_limit + api_auth + db)
- [x] Smoke test on production VPS: /api/auth/me anonymous → 401, signup → 200 with Set-Cookie
- [x] Existing site still works (\`/api/news\`, \`/api/todos\`, etc. unchanged)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## What's NOT in this plan (deferred)

- **Phase 3** — Data migration script + first scoped endpoint (\`/api/todos\` becomes per-user)
- **Phase 4** — Remaining endpoints migrate to per-user
- **Phase 5** — Cached endpoints (\`/api/skole\`, \`/api/wishlist\`) use \`user_integrations\` decrypted tokens
- **Phase 6** — Frontend login/signup pages + \`useCurrentUser\` hook
- **Phase 7** — Cleanup (delete JSON files)

## Verification of "done"

After this plan lands:
1. \`curl -X POST -d '...' http://127.0.0.1:3001/api/auth/signup\` works against production
2. Auth-protected endpoints (\`/api/auth/me\`) return 401 without a cookie, 200 with one
3. \`SELECT * FROM users\` on production shows new users
4. \`SELECT * FROM sessions WHERE expires_at > now()\` shows live sessions
5. Existing site still works unchanged at http://37.27.210.14/

## Pitfalls to watch for

- **DB pool not initialized**: if api.py crashes on startup with "connection pool is not initialized", \`DASHBOARD_DB_URL\` is missing from \`/etc/dashboard.env\` — re-run Phase 1's \`_setup_postgres.py\`.
- **Rate limiter resets on deploy**: every \`_deploy_api.py\` run restarts the service which wipes the in-memory limiter. This is fine but means staged attacks during deploys aren't tracked.
- **Cookie not coming back in tests**: \`test_api_auth.py\` uses urllib which doesn't auto-handle cookies — pull the value out of the Set-Cookie header manually (the helper \`_signup_and_get_cookie\` does this).
- **First user is admin**: the spec specifies \`user_id = 1\` is admin. If you accidentally create a user via \`INSERT\` for testing before going through signup, you'll burn user_id 1 and admin checks will fail until you renumber. Use the signup endpoint for the first real user.
