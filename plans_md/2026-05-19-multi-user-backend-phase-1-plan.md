# Multi-User Backend — Phase 1: Postgres Infrastructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install PostgreSQL 16 on the same VPS as the app, apply the full multi-user schema via yoyo-migrations, and ship a tested `server/db.py` connection-pool wrapper. After this plan lands, the site behavior is unchanged but the foundation is in place for Phase 2 (auth) and Phase 3 (data migration).

**Architecture:** Postgres 16 runs as a systemd service on the same Hetzner VPS as the dashboard, bound to `localhost:5432` only (not exposed). A new `server/db.py` wraps psycopg3's `ConnectionPool`. Schema lives in versioned SQL files under `server/migrations/`, applied via the `yoyo-migrations` CLI. The DB user password lives in `/etc/dashboard.env` alongside the existing Steam / ITAD / Canvas keys.

**Tech Stack:** PostgreSQL 16 + `pg_cron` extension (used in Phase 2 for session cleanup); Python `psycopg[pool]` 3.x; `yoyo-migrations` 8.x; `argon2-cffi` 23.x (installed now, used in Phase 2); `cryptography` 42.x (installed now, used in Phase 2 for AES-GCM).

**Reference spec:** [`plans_md/2026-05-19-multi-user-backend-design.md`](2026-05-19-multi-user-backend-design.md) — full schema definitions are in the "Database schema" section there.

**Non-goals in this plan:**
- Auth endpoints, session middleware, password hashing — Phase 2
- Data migration from JSON — Phase 3
- Any change to existing `api.py` endpoint behavior — they keep reading/writing JSON files

---

## File structure (what gets created/modified)

```
server/
├── api.py              [unchanged in this phase]
├── db.py               [NEW: psycopg connection pool wrapper]
├── migrations/
│   ├── yoyo.ini        [NEW: yoyo-migrations config]
│   └── 001_initial.sql [NEW: full schema from the spec]
├── requirements.txt    [NEW: pinned Python deps]
└── todo-api.service    [unchanged: env vars already loaded from /etc/dashboard.env]

tests/
└── server/
    ├── conftest.py     [NEW: shared pytest fixtures for DB tests]
    └── test_db.py      [NEW: tests for server/db.py]

_setup_postgres.py      [NEW: one-shot script to install + configure Postgres on the VPS]
_apply_migrations.py    [NEW: helper to apply migrations against the production DB via SSH]
```

**On `/etc/dashboard.env` (the existing env file on the VPS):** one new key gets added by `_setup_postgres.py`: `DASHBOARD_DB_URL=postgresql://dashboard:<password>@localhost:5432/dashboard`. The script generates a strong random password and stores it there.

---

## Task 0: Branch off main

- [ ] **Step 1: Verify clean working tree on main**

```bash
git checkout main
git pull --ff-only origin main
git status
```

Expected: `nothing to commit, working tree clean` and `up to date with 'origin/main'`. If there are uncommitted changes from a previous session, stash or commit them before continuing.

- [ ] **Step 2: Create the phase branch**

```bash
git checkout -b feat/multi-user-phase-1-postgres
```

Branch naming follows the convention from `CLAUDE.md` (`feat/<name>`). The plan refers to this branch as `<current-branch-name>` in Task 8.

---

## Task 1: Add Python deps and a pytest harness for server tests

**Files:**
- Create: `server/requirements.txt`
- Create: `tests/server/__init__.py` (empty marker)
- Create: `tests/server/conftest.py`
- Modify: `package.json` (add `npm run test:server` script that delegates to pytest)

- [ ] **Step 1: Write `server/requirements.txt`**

Pin specific versions so reinstalls are reproducible. These are the deps used across Phase 1–3:

```
psycopg[pool]==3.2.3
yoyo-migrations==8.2.0
argon2-cffi==23.1.0
cryptography==42.0.8
sshtunnel==0.4.0
pytest==8.3.4
pytest-postgresql==6.1.1
```

`psycopg[pool]` includes `psycopg_pool`. `pytest-postgresql` spawns a temporary Postgres for tests so the suite doesn't touch the real DB. `sshtunnel` is a pure-Python wrapper around paramiko used by `_apply_migrations.py` to forward a local port to remote Postgres (avoids fighting Windows OpenSSH's stdin-password handling).

- [ ] **Step 2: Verify your local machine has Python 3.12+ and pip**

```bash
python --version          # expect 3.12+
pip --version
```

If missing, install Python 3.12 first.

- [ ] **Step 3: Install the deps in a venv**

```bash
python -m venv .venv
.venv\Scripts\activate         # Windows. (POSIX: source .venv/bin/activate)
pip install -r server/requirements.txt
```

Expected: clean install, no compile errors. `cryptography` needs OpenSSL headers — pre-built wheels should cover this on Windows.

- [ ] **Step 4: Write `tests/server/conftest.py`**

```python
"""Shared pytest fixtures for server-side tests.

Uses pytest-postgresql to spawn an ephemeral Postgres for each test session.
The fixture `db_url` returns a connection string; `db_conn` returns a live
psycopg connection that's rolled back after each test."""
import pytest
import psycopg
from pytest_postgresql import factories

# Spawns a postmaster for the test session. Reuses the OS's installed
# Postgres binary; if running on Windows without a system Postgres,
# pytest-postgresql will fail and you can switch to the noproc fixture
# pointed at a Postgres in Docker.
postgresql_proc = factories.postgresql_proc(port=None, unixsocketdir='/tmp')
postgresql = factories.postgresql('postgresql_proc')


@pytest.fixture
def db_url(postgresql):
    """Connection URL for the ephemeral test database."""
    p = postgresql.info
    return f"postgresql://{p.user}@{p.host}:{p.port}/{p.dbname}"


@pytest.fixture
def db_conn(db_url):
    """A live connection that's closed after the test."""
    with psycopg.connect(db_url) as conn:
        yield conn
```

- [ ] **Step 5: Add `tests/server/__init__.py`** (just an empty file so pytest can discover the package)

```python
```

- [ ] **Step 6: Add `npm run test:server` script to `package.json`**

In the `"scripts"` block, add:

```json
"test:server": "pytest tests/server -v"
```

- [ ] **Step 7: Run the empty test directory to verify the harness imports**

```bash
.venv\Scripts\activate
pytest tests/server -v
```

Expected: `no tests ran in 0.XXs` (success — pytest found nothing but the fixtures imported cleanly).

- [ ] **Step 8: Commit**

```bash
git add server/requirements.txt tests/server/ package.json
git commit -m "$(cat <<'EOF'
feat(db): add pytest harness for server tests + pin Python deps

requirements.txt pins psycopg[pool], yoyo-migrations, argon2-cffi,
cryptography, pytest, pytest-postgresql at known-good versions for
the multi-user backend work.

tests/server/conftest.py provides shared fixtures: db_url and db_conn
backed by pytest-postgresql's ephemeral postmaster, so server-side
tests can hit a real Postgres without leaking into production data.

npm run test:server delegates to pytest tests/server -v.

No behavior change. Phase 1 of multi-user-backend.
EOF
)"
```

---

## Task 2: Write the initial schema migration

**Files:**
- Create: `server/migrations/yoyo.ini`
- Create: `server/migrations/001_initial.sql`

- [ ] **Step 1: Create the migrations directory**

```bash
mkdir -p server/migrations
```

- [ ] **Step 2: Write `server/migrations/yoyo.ini`**

yoyo-migrations reads its config from this file. We tell it where the migrations live and how to find the DB URL.

```ini
[DEFAULT]
sources = %(here)s
# Pull the DB URL from the DASHBOARD_DB_URL env var rather than committing
# credentials. _apply_migrations.py loads this via /etc/dashboard.env.
database = postgresql://
batch_mode = on
verbosity = 1
```

- [ ] **Step 3: Write `server/migrations/001_initial.sql`**

This is verbatim the schema from the design spec, with each table preceded by a yoyo migration step delimiter (`-- ::`).

```sql
-- 001_initial.sql
-- Full multi-user schema. See plans_md/2026-05-19-multi-user-backend-design.md.

-- ::
CREATE EXTENSION IF NOT EXISTS citext;

-- ::
CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  email         CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ::
CREATE TABLE invite_codes (
  code            TEXT PRIMARY KEY,
  created_by_id   BIGINT REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_by_id      BIGINT REFERENCES users(id),
  used_at         TIMESTAMPTZ
);

-- ::
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent  TEXT
);
CREATE INDEX ON sessions (user_id);
CREATE INDEX ON sessions (expires_at);

-- ::
CREATE TABLE user_integrations (
  user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  payload_enc      BYTEA NOT NULL,
  iv               BYTEA NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, integration_type)
);

-- ::
CREATE TABLE todos (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text         TEXT NOT NULL,
  priority     TEXT NOT NULL CHECK (priority IN ('high','medium','low')),
  deadline     DATE,
  done         BOOLEAN NOT NULL DEFAULT FALSE,
  pinned       BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  position     INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON todos (user_id, done, position);

-- ::
CREATE TABLE plan_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  date        DATE NOT NULL,
  start_time  TIME,
  end_time    TIME,
  tag         TEXT,
  location    TEXT,
  color       TEXT,
  recurring   BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX ON plan_events (user_id, date);

-- ::
CREATE TABLE notes (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON notes (user_id, updated_at DESC);

-- ::
CREATE TABLE categories (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  position    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON categories (user_id, position);

-- ::
CREATE TABLE links (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  url         TEXT NOT NULL,
  name        TEXT NOT NULL,
  sub         TEXT,
  color       TEXT,
  icon_type   TEXT,
  icon_value  TEXT,
  favorite    BOOLEAN NOT NULL DEFAULT FALSE,
  position    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON links (user_id, category_id, position);

-- ::
CREATE TABLE home_layout (
  user_id    BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ::
CREATE TABLE cache_skole (
  user_id     BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  payload     JSONB NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ::
CREATE TABLE cache_wishlist (
  user_id     BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  payload     JSONB NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ::
CREATE TABLE reports (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  type        TEXT NOT NULL CHECK (type IN ('bug','feature')),
  title       TEXT NOT NULL,
  body        TEXT,
  page        TEXT,
  status      TEXT NOT NULL DEFAULT 'open',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 4: Sanity-test the SQL on the local ephemeral Postgres**

Write a quick test that asserts the migration applies cleanly. Add to `tests/server/test_db.py` (file will get more tests later — start it now):

```python
"""Tests for server/db.py and the migration files."""
from pathlib import Path

import psycopg

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / 'server' / 'migrations'


def test_initial_migration_applies_cleanly(db_conn):
    """001_initial.sql should apply without errors on a fresh Postgres."""
    sql = (MIGRATIONS_DIR / '001_initial.sql').read_text(encoding='utf-8')
    # yoyo uses `-- ::` as its statement separator; in raw psycopg we can
    # execute the whole file because the `-- ::` markers are comments.
    with db_conn.cursor() as cur:
        cur.execute(sql)
    db_conn.commit()

    # Verify every expected table exists
    expected = {
        'users', 'invite_codes', 'sessions', 'user_integrations',
        'todos', 'plan_events', 'notes', 'categories', 'links',
        'home_layout', 'cache_skole', 'cache_wishlist', 'reports',
    }
    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public'"
        )
        actual = {row[0] for row in cur.fetchall()}
    assert expected.issubset(actual), f'missing tables: {expected - actual}'
```

- [ ] **Step 5: Run the test**

```bash
pytest tests/server/test_db.py::test_initial_migration_applies_cleanly -v
```

Expected: PASS. If pytest-postgresql can't find a system Postgres, install one (`winget install PostgreSQL.PostgreSQL.16` on Windows) and retry.

- [ ] **Step 6: Commit**

```bash
git add server/migrations/ tests/server/test_db.py
git commit -m "$(cat <<'EOF'
feat(db): add initial schema migration

server/migrations/001_initial.sql defines the full multi-user schema
from plans_md/2026-05-19-multi-user-backend-design.md: users +
invite_codes + sessions + user_integrations + todos + plan_events +
notes + categories + links + home_layout + cache_skole +
cache_wishlist + reports.

Each table is preceded by yoyo's `-- ::` statement separator so the
migration can be applied via either yoyo CLI or raw psycopg.

server/migrations/yoyo.ini reads DASHBOARD_DB_URL from the environment
so creds never land in source.

tests/server/test_db.py asserts the migration applies cleanly against
an ephemeral Postgres (pytest-postgresql) and that every expected
table appears in information_schema.

Phase 1 of multi-user-backend.
EOF
)"
```

---

## Task 3: Write `server/db.py` — connection-pool wrapper

**Files:**
- Create: `server/db.py`
- Modify: `tests/server/test_db.py` (add tests for db.py helpers)

The wrapper exposes:
- `init_pool(url, min_size=2, max_size=10)` — call once at startup
- `get_pool()` — return the singleton pool
- A `query(sql, params=())` helper that takes a connection from the pool and yields rows as dicts
- A `tx()` context manager for multi-statement transactions

- [ ] **Step 1: Write the failing test for `init_pool` + `get_pool`**

Append to `tests/server/test_db.py`:

```python
import pytest
from server import db as server_db


def test_get_pool_raises_when_not_initialized(monkeypatch):
    """get_pool() before init_pool() should error clearly, not return None."""
    # Reset the module-level pool so each test starts fresh
    monkeypatch.setattr(server_db, '_pool', None, raising=False)
    with pytest.raises(RuntimeError, match='not initialized'):
        server_db.get_pool()


def test_init_pool_creates_usable_pool(db_url, monkeypatch):
    """After init_pool, get_pool returns a pool we can borrow connections from."""
    monkeypatch.setattr(server_db, '_pool', None, raising=False)
    server_db.init_pool(db_url, min_size=1, max_size=2)
    pool = server_db.get_pool()
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute('SELECT 1')
        assert cur.fetchone() == (1,)
    server_db.close_pool()
```

- [ ] **Step 2: Run the failing tests**

```bash
pytest tests/server/test_db.py -v
```

Expected: both new tests FAIL because `server.db` doesn't exist yet.

- [ ] **Step 3: Write `server/db.py`**

```python
"""Connection-pool wrapper for the multi-user dashboard backend.

Single source of truth for talking to Postgres. Initialize the pool
once at process startup (from api.py) with `init_pool(url)`, then call
`get_pool()` anywhere you need to run queries. Use the `query()` helper
for one-shot reads and the `tx()` context manager for multi-statement
transactions.

Why a pool: the Python service is a ThreadingHTTPServer with many
short-lived request threads. Without a pool every request would open
and tear down its own Postgres connection (slow); the pool keeps a
small number of long-lived connections warm and hands them out per
request.
"""
from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator

import psycopg
from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row

_pool: ConnectionPool | None = None


def init_pool(url: str, *, min_size: int = 2, max_size: int = 10) -> None:
    """Create the singleton connection pool. Idempotent: subsequent calls
    after the first are a no-op so test harnesses can call this freely."""
    global _pool
    if _pool is not None:
        return
    _pool = ConnectionPool(
        conninfo=url,
        min_size=min_size,
        max_size=max_size,
        kwargs={'row_factory': dict_row},
        open=True,
    )
    _pool.wait()  # block until min_size connections are ready


def get_pool() -> ConnectionPool:
    """Return the initialized pool. Raises if init_pool() hasn't run."""
    if _pool is None:
        raise RuntimeError(
            'connection pool is not initialized — call init_pool(url) first'
        )
    return _pool


def close_pool() -> None:
    """Tear down the pool. Used in tests; in production the pool lives
    for the lifetime of the process."""
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def query(sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    """One-shot read. Returns rows as dicts keyed by column name."""
    with get_pool().connection() as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall() if cur.description else []


def execute(sql: str, params: tuple[Any, ...] = ()) -> int:
    """One-shot write. Returns rowcount. Commits on success."""
    with get_pool().connection() as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        conn.commit()
        return cur.rowcount


@contextmanager
def tx() -> Iterator[psycopg.Connection]:
    """Context manager for multi-statement transactions. Yields a
    connection; rolls back on exception, commits on clean exit."""
    with get_pool().connection() as conn:
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
```

- [ ] **Step 4: Run the tests, expect them to pass**

```bash
pytest tests/server/test_db.py -v
```

Expected: all tests PASS.

- [ ] **Step 5: Add a test for the `query()` helper**

Append to `tests/server/test_db.py`:

```python
def test_query_returns_dict_rows(db_url, monkeypatch):
    """query() returns rows as dicts keyed by column name."""
    monkeypatch.setattr(server_db, '_pool', None, raising=False)
    server_db.init_pool(db_url, min_size=1, max_size=2)
    rows = server_db.query("SELECT 1 AS a, 'hello' AS b")
    assert rows == [{'a': 1, 'b': 'hello'}]
    server_db.close_pool()


def test_tx_rolls_back_on_exception(db_url, monkeypatch):
    """tx() rolls back when the block raises."""
    monkeypatch.setattr(server_db, '_pool', None, raising=False)
    server_db.init_pool(db_url, min_size=1, max_size=2)
    # Create a temp table that we'll try to write to
    server_db.execute(
        "CREATE TEMP TABLE rollback_test (n INT)"
    )
    with pytest.raises(RuntimeError, match='boom'):
        with server_db.tx() as conn:
            with conn.cursor() as cur:
                cur.execute("INSERT INTO rollback_test (n) VALUES (1)")
            raise RuntimeError('boom')
    # The INSERT should have been rolled back
    rows = server_db.query("SELECT COUNT(*) AS c FROM rollback_test")
    assert rows[0]['c'] == 0
    server_db.close_pool()
```

- [ ] **Step 6: Run all server tests**

```bash
pytest tests/server -v
```

Expected: all PASS (the initial-migration test from Task 2 + the four db.py tests).

- [ ] **Step 7: Commit**

```bash
git add server/db.py tests/server/test_db.py
git commit -m "$(cat <<'EOF'
feat(db): server/db.py connection-pool wrapper + tests

Single source of truth for Postgres access from the multi-user backend:
- init_pool(url) creates the singleton at startup
- get_pool() returns it; errors clearly if not initialized
- query() and execute() are one-shot helpers returning dict rows
- tx() is a context manager for multi-statement transactions that
  commits on clean exit and rolls back on exception

Why a pool: ThreadingHTTPServer has many short-lived request threads;
without a pool each request would open/tear down a Postgres connection.
The pool keeps min_size=2 connections warm and grows to max_size=10
under load.

Tests cover: unset-pool error, pool init + connection borrow, dict-row
factory, transaction rollback on exception.

Phase 1 of multi-user-backend.
EOF
)"
```

---

## Task 4: Write `_setup_postgres.py` — one-shot VPS installer

**Files:**
- Create: `_setup_postgres.py` (gitignored, like `_setup_env_secrets.py`)
- Modify: `.gitignore` (add `_setup_postgres.py` to the local-helpers list)

This script SSHs into the VPS, installs Postgres 16, creates the dashboard role + database, generates a strong DB password, appends `DASHBOARD_DB_URL` to `/etc/dashboard.env`, and binds Postgres to localhost only. Idempotent on a re-run (skips already-done steps).

- [ ] **Step 1: Add `_setup_postgres.py` to `.gitignore`**

Edit `.gitignore` — under the "Local discovery / deploy helpers" section, add the line:

```
_setup_postgres.py
```

So the section reads:
```
# Local discovery / deploy helpers (not part of the app)
_discover.py
_deploy.py
_inspect_server.py
_setup_env_secrets.py
_setup_postgres.py
_i*.txt
_deploy_out.txt
```

- [ ] **Step 2: Write `_setup_postgres.py`**

```python
#!/usr/bin/env python3
"""One-shot: install Postgres 16 on the VPS, create the dashboard
database and role, append DASHBOARD_DB_URL to /etc/dashboard.env.

Idempotent: re-runnable. Steps already done are detected and skipped.

Phase 1 of multi-user-backend. Run once, then delete (or keep around
for re-provisioning a fresh VPS)."""
import io
import os
import secrets
import sys

import paramiko

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HERE = os.path.dirname(os.path.abspath(__file__))
REMOTE_ENV = '/etc/dashboard.env'
DB_NAME = 'dashboard'
DB_USER = 'dashboard'


def load_creds():
    creds = {}
    with open(os.path.join(HERE, 'dashboard.txt'), 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if '=' in line:
                k, v = line.split('=', 1)
                creds[k.strip()] = v.strip()
    return creds


def run(client, cmd, ok_to_fail=False):
    print(f'$ {cmd}', flush=True)
    _, sout, serr = client.exec_command(cmd)
    out = sout.read().decode('utf-8', errors='replace').rstrip()
    err = serr.read().decode('utf-8', errors='replace').rstrip()
    rc = sout.channel.recv_exit_status()
    if out:
        print(out, flush=True)
    if err and rc != 0:
        print('stderr:', err, flush=True)
    if rc != 0 and not ok_to_fail:
        raise RuntimeError(f'command failed (rc={rc}): {cmd}')
    return rc, out


def main():
    creds = load_creds()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f'Connecting to {creds["HOST"]}...', flush=True)
    client.connect(creds['HOST'], username=creds['USER'],
                   password=creds['PASS'], timeout=15)

    # 1. Install postgresql-16 if not already installed
    rc, out = run(client, 'dpkg -s postgresql-16 2>/dev/null | grep -q "Status: install ok installed" && echo installed || echo missing', ok_to_fail=True)
    if 'missing' in out:
        print('\n[1/5] Installing postgresql-16...', flush=True)
        run(client, 'apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql-16')
    else:
        print('\n[1/5] postgresql-16 already installed, skipping.', flush=True)

    # 2. Bind to localhost only (it usually already is on Ubuntu, but make sure)
    print('\n[2/5] Verifying localhost-only bind...', flush=True)
    run(client,
        "sed -i \"s/^#\\?listen_addresses.*/listen_addresses = 'localhost'/\" "
        "/etc/postgresql/16/main/postgresql.conf")
    run(client, 'systemctl restart postgresql')

    # 3. Create role + db if not present
    print('\n[3/5] Ensuring dashboard role and database exist...', flush=True)
    rc, out = run(client,
        f'sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = \'{DB_USER}\'"',
        ok_to_fail=True)
    role_exists = out.strip() == '1'

    if role_exists:
        print('  role already exists; will not regenerate password.', flush=True)
        new_password = None
    else:
        new_password = secrets.token_urlsafe(32)
        run(client,
            f"sudo -u postgres psql -c \"CREATE ROLE {DB_USER} LOGIN PASSWORD '{new_password}'\"")

    rc, out = run(client,
        f'sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = \'{DB_NAME}\'"',
        ok_to_fail=True)
    if out.strip() != '1':
        run(client,
            f"sudo -u postgres psql -c \"CREATE DATABASE {DB_NAME} OWNER {DB_USER}\"")
    else:
        print('  database already exists, skipping.', flush=True)

    # 4. Append DASHBOARD_DB_URL to /etc/dashboard.env (only if not present)
    print('\n[4/5] Checking /etc/dashboard.env for DASHBOARD_DB_URL...', flush=True)
    rc, out = run(client,
        f'grep -q "^DASHBOARD_DB_URL=" {REMOTE_ENV} && echo present || echo missing',
        ok_to_fail=True)

    if 'missing' in out:
        if new_password is None:
            print(
                'ERROR: role already existed but DASHBOARD_DB_URL is not in '
                '/etc/dashboard.env. Reset the role password manually with\n'
                f'  sudo -u postgres psql -c "ALTER ROLE {DB_USER} PASSWORD \'<new>\'"\n'
                'then add the URL to /etc/dashboard.env yourself.',
                file=sys.stderr)
            sys.exit(1)
        url = f'postgresql://{DB_USER}:{new_password}@localhost:5432/{DB_NAME}'
        run(client, f"echo 'DASHBOARD_DB_URL={url}' >> {REMOTE_ENV}")
        run(client, f'chmod 600 {REMOTE_ENV}')
    else:
        print('  DASHBOARD_DB_URL already present, skipping.', flush=True)

    # 5. Verify by trying to connect
    print('\n[5/5] Verifying connection...', flush=True)
    rc, out = run(client,
        f"sudo -u postgres psql -d {DB_NAME} -c 'SELECT version();'")

    print('\n✓ Postgres ready. DASHBOARD_DB_URL is in /etc/dashboard.env.', flush=True)
    print('  Next: run python _apply_migrations.py to apply schema.', flush=True)
    client.close()


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'\nERROR: {type(e).__name__}: {e}', file=sys.stderr)
        sys.exit(1)
```

- [ ] **Step 3: Dry-run the script in your head**

Walk through the script line by line. Verify:
- Paramiko connects using `dashboard.txt`
- `apt-get install postgresql-16` is the right package on Ubuntu 24 LTS
- The `sed` for `listen_addresses` targets `/etc/postgresql/16/main/postgresql.conf` (correct path on Ubuntu)
- The `pg_roles` lookup correctly detects an existing role
- `chmod 600 /etc/dashboard.env` keeps the file readable only by root

If anything looks wrong, fix it before running.

- [ ] **Step 4: Run the setup script**

```bash
python -u _setup_postgres.py > _setup_postgres_out.txt 2>&1
cat _setup_postgres_out.txt
```

Expected output: each step prints, ends with `✓ Postgres ready`. If anything fails, the script raises and prints the failing command — fix on the VPS manually, then re-run.

- [ ] **Step 5: Verify the database exists by SSHing in manually**

```bash
ssh root@37.27.210.14
sudo -u postgres psql -d dashboard -c "\dt"
exit
```

Expected: empty table list (no tables yet — that's Task 5).

- [ ] **Step 6: Commit just the .gitignore change**

The setup script itself is gitignored. Only the .gitignore update goes to git.

```bash
git add .gitignore
git commit -m "$(cat <<'EOF'
chore: gitignore _setup_postgres.py

One-shot VPS provisioning script for Postgres 16. Follows the same
pattern as _setup_env_secrets.py — kept local, never committed.

Phase 1 of multi-user-backend.
EOF
)"
```

---

## Task 5: Write `_apply_migrations.py` — production migration runner

**Files:**
- Create: `_apply_migrations.py` (gitignored)
- Modify: `.gitignore`

yoyo-migrations runs locally and connects to the remote Postgres over SSH tunnel. This script sets up the tunnel, applies pending migrations, then tears it down.

- [ ] **Step 1: Add `_apply_migrations.py` to `.gitignore`**

In the local-helpers block:
```
_apply_migrations.py
```

- [ ] **Step 2: Write `_apply_migrations.py`**

```python
#!/usr/bin/env python3
"""Apply pending yoyo migrations against the production Postgres.

Opens an SSH local-forward (127.0.0.1:5435 → remote:5432) via sshtunnel
(pure-Python; no fight with Windows OpenSSH), reads DASHBOARD_DB_URL
from /etc/dashboard.env on the remote host, rewrites it to point at
the local tunnel, then runs `yoyo apply`.

Re-runnable. Already-applied migrations are no-ops; yoyo tracks state
in a _yoyo_log table in the target database.

Phase 1 of multi-user-backend. Keep around — used for every future
migration."""
import io
import os
import subprocess
import sys

import paramiko
from sshtunnel import SSHTunnelForwarder

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HERE = os.path.dirname(os.path.abspath(__file__))
LOCAL_PORT = 5435  # forwarded to remote 5432; arbitrary unused port
MIGRATIONS_DIR = os.path.join(HERE, 'server', 'migrations')


def load_creds():
    creds = {}
    with open(os.path.join(HERE, 'dashboard.txt'), 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if '=' in line:
                k, v = line.split('=', 1)
                creds[k.strip()] = v.strip()
    return creds


def fetch_remote_db_url(creds):
    """Read DASHBOARD_DB_URL from /etc/dashboard.env on the VPS via paramiko."""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(creds['HOST'], username=creds['USER'],
                   password=creds['PASS'], timeout=15)
    try:
        _, sout, _ = client.exec_command(
            "grep '^DASHBOARD_DB_URL=' /etc/dashboard.env | cut -d= -f2-"
        )
        url = sout.read().decode('utf-8').strip()
        if not url:
            raise RuntimeError('DASHBOARD_DB_URL missing from /etc/dashboard.env')
        return url
    finally:
        client.close()


def rewrite_for_tunnel(url, local_port):
    """Replace `@host:port` with `@127.0.0.1:<local_port>` for the SSH tunnel.
    Input shape: postgresql://user:pass@localhost:5432/db"""
    prefix, _, tail = url.partition('@')
    _, _, rest = tail.partition('/')
    return f'{prefix}@127.0.0.1:{local_port}/{rest}'


def main():
    creds = load_creds()
    print(f'Connecting to {creds["HOST"]} (initial read)...', flush=True)
    remote_url = fetch_remote_db_url(creds)
    tunnel_url = rewrite_for_tunnel(remote_url, LOCAL_PORT)

    print(f'Opening SSH tunnel localhost:{LOCAL_PORT} → remote:5432...', flush=True)
    with SSHTunnelForwarder(
        (creds['HOST'], 22),
        ssh_username=creds['USER'],
        ssh_password=creds['PASS'],
        remote_bind_address=('127.0.0.1', 5432),
        local_bind_address=('127.0.0.1', LOCAL_PORT),
    ) as tunnel:
        print(f'  tunnel active on localhost:{tunnel.local_bind_port}', flush=True)
        print(f'Running yoyo apply against {MIGRATIONS_DIR}...', flush=True)
        env = os.environ.copy()
        env['DASHBOARD_DB_URL'] = tunnel_url
        rc = subprocess.call(
            ['yoyo', 'apply', '--database', tunnel_url,
             '--batch', '--no-config-file', MIGRATIONS_DIR],
            env=env,
        )
        if rc != 0:
            raise RuntimeError(f'yoyo apply exited with code {rc}')
        print('\n✓ Migrations applied successfully.', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'\nERROR: {type(e).__name__}: {e}', file=sys.stderr)
        sys.exit(1)
```

- [ ] **Step 3: Run the migration application**

```bash
python -u _apply_migrations.py > _apply_out.txt 2>&1
cat _apply_out.txt
```

Expected: `Running yoyo apply...` followed by yoyo's output for `001_initial.sql`, ending with `✓ Migrations applied successfully.`

If the tunnel fails to open (rare — sshtunnel is reliable on Windows), `paramiko` will print a clear error like `Authentication failed` or `Connection refused`. Re-check `dashboard.txt` credentials and that port 22 on the VPS is reachable from your machine.

- [ ] **Step 4: Verify on the VPS**

```bash
ssh root@37.27.210.14
sudo -u postgres psql -d dashboard -c "\dt"
```

Expected output: list of 13 tables (`users`, `invite_codes`, `sessions`, `user_integrations`, `todos`, `plan_events`, `notes`, `categories`, `links`, `home_layout`, `cache_skole`, `cache_wishlist`, `reports`) plus `_yoyo_log` and `_yoyo_version` (yoyo's own state tables).

```bash
sudo -u postgres psql -d dashboard -c "SELECT version, applied_at_utc FROM _yoyo_log;"
exit
```

Expected: one row showing `001_initial` was applied.

- [ ] **Step 5: Commit just the .gitignore change**

```bash
git add .gitignore
git commit -m "$(cat <<'EOF'
chore: gitignore _apply_migrations.py

Local helper that opens an SSH tunnel to the remote Postgres and runs
`yoyo apply` against it. Kept local like the other underscore-prefixed
deploy/setup helpers.

Phase 1 of multi-user-backend.
EOF
)"
```

---

## Task 6: Set up the daily pg_dump backup

**Files:**
- Modify: `_setup_postgres.py` is gitignored, so the steps below are recorded here for reference only. Apply them once manually on the VPS via SSH.

A daily logical backup keeps the dashboard data recoverable even if the disk dies.

- [ ] **Step 1: SSH into the VPS**

```bash
ssh root@37.27.210.14
```

- [ ] **Step 2: Create the backup directory**

```bash
mkdir -p /opt/dashboard/backups
chmod 750 /opt/dashboard/backups
```

- [ ] **Step 3: Write the backup script**

```bash
cat > /usr/local/bin/dashboard-pg-backup.sh <<'EOF'
#!/usr/bin/env bash
# Daily logical backup of the dashboard Postgres database.
# Keeps the last 14 dumps; older ones auto-purge.
set -euo pipefail
DIR=/opt/dashboard/backups
DATE=$(date -u +%Y%m%dT%H%M%SZ)
OUT="$DIR/dashboard-$DATE.sql.gz"
sudo -u postgres pg_dump -Fp dashboard | gzip > "$OUT"
chmod 600 "$OUT"
# Retain 14 most recent
ls -1t "$DIR"/dashboard-*.sql.gz | tail -n +15 | xargs -r rm --
EOF
chmod 750 /usr/local/bin/dashboard-pg-backup.sh
```

- [ ] **Step 4: Add the cron entry**

```bash
( crontab -l 2>/dev/null; echo "5 4 * * * /usr/local/bin/dashboard-pg-backup.sh" ) | crontab -
crontab -l   # verify the line is there
```

This runs at 04:05 UTC daily (after the existing Tuesday knowledge-base refresh task).

- [ ] **Step 5: Run a backup manually to verify**

```bash
/usr/local/bin/dashboard-pg-backup.sh
ls -la /opt/dashboard/backups/
```

Expected: one file like `dashboard-20260520T040500Z.sql.gz`, ~2 KB (empty schema with no data yet).

- [ ] **Step 6: Spot-check the dump**

```bash
zcat /opt/dashboard/backups/dashboard-*.sql.gz | head -50
exit
```

Expected: SQL dump preamble with `CREATE TABLE users (...)` etc.

(No commit step — this is one-time server config, not source.)

---

## Task 7: Update `CLAUDE.md` with DB conventions

**Files:**
- Modify: `CLAUDE.md`

The session-loaded conventions file should now know about Postgres so future sessions don't re-discover it.

- [ ] **Step 1: Read the current CLAUDE.md**

```bash
cat CLAUDE.md
```

- [ ] **Step 2: Add a "Database" section before "Server-side conventions"**

Use the Edit tool to insert before the existing `## Server-side conventions` section:

```markdown
## Database (Phase 1 onward)

- **Engine**: PostgreSQL 16 on the same VPS, bound to `localhost:5432` only.
- **Connection string**: `DASHBOARD_DB_URL` in `/etc/dashboard.env` (mode 600). Format: `postgresql://dashboard:<pw>@localhost:5432/dashboard`.
- **Python client**: `psycopg[pool]` 3.x. Initialize once at startup via `server.db.init_pool(url)`. Borrow connections from the pool with `with get_pool().connection() as conn:`. Helpers in `server/db.py`: `query()` for one-shot reads (dict rows), `execute()` for one-shot writes, `tx()` for multi-statement transactions.
- **Schema migrations**: yoyo-migrations 8.x. Files live in `server/migrations/`. Apply via `python _apply_migrations.py` (gitignored, opens SSH tunnel). yoyo tracks state in `_yoyo_log` table.
- **Backups**: daily logical dump via `/usr/local/bin/dashboard-pg-backup.sh` at 04:05 UTC. Stored under `/opt/dashboard/backups/`, retains last 14 days.
- **Tests**: `tests/server/` uses `pytest-postgresql` to spawn ephemeral databases. Run with `npm run test:server` or `pytest tests/server -v`.
- **YOU MUST** add new migrations as `server/migrations/NNN_<descriptive>.sql` (zero-padded) — never edit an existing migration after it's been applied. yoyo will refuse to re-apply or skip a changed file.
```

- [ ] **Step 3: Add `Bash(npm run test:server)` to `.claude/settings.json`**

Edit the allow list in `.claude/settings.json`:

```json
"Bash(npm run test:server)",
```

Add it near the other `Bash(npm ...)` entries.

- [ ] **Step 4: Verify with `npm run typecheck` that nothing broke**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md .claude/settings.json
git commit -m "$(cat <<'EOF'
docs: add Database section to CLAUDE.md

Phase 1 of multi-user-backend laid down the Postgres foundation
(server/db.py, server/migrations/, _apply_migrations.py). Document
the conventions in CLAUDE.md so future sessions inherit them:
- engine + connection string location
- psycopg pool pattern + query/execute/tx helpers
- yoyo-migrations workflow (never edit applied migrations)
- backup schedule
- how to run server tests

Also adds `npm run test:server` to .claude/settings.json's allowlist.
EOF
)"
```

---

## Task 8: Push the branch and open the PR

**Files:** none

- [ ] **Step 1: Verify everything is committed**

```bash
git status
```

Expected: clean working tree.

- [ ] **Step 2: Verify tests still pass**

```bash
npm run typecheck
npm test            # frontend vitest suite
npm run test:server # new server-side suite
```

All three: clean.

- [ ] **Step 3: Push**

```bash
git push -u origin feat/multi-user-phase-1-postgres
```

- [ ] **Step 4: Open the PR**

```bash
gh pr create --title "feat: phase 1 — Postgres infrastructure for multi-user backend" --body "$(cat <<'EOF'
## Summary

First phase of the multi-user-backend project (spec: \`plans_md/2026-05-19-multi-user-backend-design.md\`, plan: \`plans_md/2026-05-19-multi-user-backend-phase-1-plan.md\`).

Lays the database foundation **without** changing any existing endpoint behavior — the site keeps working off JSON files.

## What this PR ships

- **PostgreSQL 16** on the VPS, bound to \`localhost:5432\`, role + database created
- **server/migrations/001_initial.sql** — full schema (13 tables) applied via yoyo-migrations
- **server/db.py** — psycopg3 connection-pool wrapper with \`init_pool\`, \`query\`, \`execute\`, \`tx\` helpers
- **server/requirements.txt** — pinned Python deps for this phase + Phase 2 (psycopg, yoyo, argon2-cffi, cryptography, pytest, pytest-postgresql)
- **tests/server/** — pytest harness using pytest-postgresql for ephemeral DBs
- **Daily pg_dump backup** at 04:05 UTC, retains 14 days
- **CLAUDE.md** documents the DB conventions for future sessions

## What this PR does NOT ship (deferred)

- Auth endpoints / session middleware → Phase 2
- Data migration from JSON files → Phase 3
- Any change to existing \`api.py\` request handling

## Test plan

- [x] \`npm run typecheck\` — clean
- [x] \`npm run test\` — frontend vitest suite still passes
- [x] \`npm run test:server\` — new server-side pytest suite passes
- [x] On the VPS: \`sudo -u postgres psql -d dashboard -c \"\\dt\"\` lists all 13 tables
- [x] \`/opt/dashboard/backups/\` contains a daily backup file (run \`/usr/local/bin/dashboard-pg-backup.sh\` once to verify)
- [x] Site still works at http://37.27.210.14/ — Postgres is online but unused

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Don't merge until manual review.

---

## What's NOT in this plan (deferred to Phase 2)

- Auth endpoints (`/api/auth/*`)
- Session middleware in `api.py`
- Password hashing helpers (deps installed, not used)
- AES-GCM encryption helpers (deps installed, not used)
- Rate limiting

## What's NOT in this plan (deferred to Phase 3)

- The `_migrate_to_postgres.py` data migration script
- Rewriting any existing endpoint to use Postgres
- Folding `notes_api.py` into `api.py`

## Verification of "done"

After this plan lands:
1. `psql` into the VPS as the `dashboard` user (`sudo -u postgres psql -d dashboard`) and `\dt` lists 13 tables.
2. `_yoyo_log` shows one row for `001_initial`.
3. `npm run test:server` passes locally.
4. `/opt/dashboard/backups/` contains a daily backup file.
5. The site (`http://37.27.210.14/`) still works exactly as before — Postgres is online but unused by `api.py`.

## Pitfalls to watch for

- **pytest-postgresql on Windows**: needs a system Postgres install. If install fails, swap to Docker: run `docker run -d -p 5433:5432 -e POSTGRES_PASSWORD=test postgres:16` and point `conftest.py` at it via `noproc_factory(port=5433, password='test')`.
- **Migration idempotency**: never edit `001_initial.sql` after it's applied. Add `002_<change>.sql` instead. yoyo will refuse to re-apply or skip a changed file.
- **Pool exhaustion in tests**: tests that call `init_pool` must also call `close_pool()` (or use the monkeypatch reset pattern in the existing tests) — otherwise the next test inherits a stale pool pointing at a torn-down database.
- **sshtunnel context-manager exit**: `with SSHTunnelForwarder(...) as tunnel` blocks until the inner block returns — the tunnel only stays alive for the lifetime of `with`. If you need to debug the tunnel separately, open it manually with `tunnel.start()` / `tunnel.stop()`.
