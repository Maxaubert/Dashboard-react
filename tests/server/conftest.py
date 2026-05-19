"""Shared pytest fixtures for server-side tests.

Uses pytest-postgresql to back tests with an ephemeral Postgres. The
fixture `db_url` returns a connection string; `db_conn` returns a live
psycopg connection scoped to the test.

Platform-dependent fixture selection:
- **Linux/macOS**: the `proc` fixture works fine — pytest-postgresql
  spawns its own postmaster inheriting the system PATH, so initdb +
  pg_ctl find their binaries naturally.
- **Windows**: the `proc` fixture strips PATH when spawning initdb, so
  pg_ctl.exe fails to load its DLLs (exit 0xC0000005). We fall back to
  the `noproc` fixture which connects to a pre-running Postgres.

For Windows, install Postgres 16 (`winget install PostgreSQL.PostgreSQL.16`)
and start a test instance on the configured port:

    "C:\\Program Files\\PostgreSQL\\16\\bin\\pg_ctl.exe" \
        -D C:\\path\\to\\test\\data\\dir \
        -l logfile.log \
        -o "-p 5433" start

Override the test-instance host/port via env vars: TEST_PG_HOST (default
localhost), TEST_PG_PORT (default 5433), TEST_PG_USER (default postgres),
TEST_PG_DBNAME (default tests).
"""
import os
import sys

import pytest
import psycopg
from pytest_postgresql import factories

if sys.platform == 'win32':
    # noproc: connect to a pre-running Postgres. Required on Windows
    # because the proc fixture's PATH stripping breaks initdb.exe.
    postgresql_noproc = factories.postgresql_noproc(
        host=os.environ.get('TEST_PG_HOST', 'localhost'),
        port=int(os.environ.get('TEST_PG_PORT', '5433')),
        user=os.environ.get('TEST_PG_USER', 'postgres'),
        dbname=os.environ.get('TEST_PG_DBNAME', 'tests'),
    )
    postgresql = factories.postgresql('postgresql_noproc')
else:
    # proc: spawn an ephemeral Postgres per session. Works on Linux/CI.
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
