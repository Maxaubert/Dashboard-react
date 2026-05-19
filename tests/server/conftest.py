"""Shared pytest fixtures for server-side tests.

Uses pytest-postgresql to connect to an ephemeral Postgres for each test session.
The fixture `db_url` returns a connection string; `db_conn` returns a live
psycopg connection that's rolled back after each test.

--- Windows note ---
pytest-postgresql's proc fixture (which spawns its own pg_ctl) strips the
system PATH when calling initdb on Windows, so pg_ctl.exe cannot load its
DLLs (exit 0xC0000005).  Instead we use the `noproc` fixture that connects
to a pre-running Postgres.  Start one with:

    "C:\\Program Files\\PostgreSQL\\16\\bin\\pg_ctl.exe" \
        -D C:\\Users\\Admin\\AppData\\Local\\Temp\\pg_test_data \
        -l C:\\Users\\Admin\\AppData\\Local\\Temp\\pg_test_data\\logfile.log \
        -o "-p 5433" start

On Linux/CI the proc fixture works fine; switch back by reverting these two
factory lines to postgresql_proc(port=None) + postgresql('postgresql_proc').
"""
import pytest
import psycopg
from pytest_postgresql import factories

# noproc: connect to a pre-running Postgres instead of spawning one.
# On Windows Postgres 16 must already be running on 5433 (see note above).
# On Linux/CI override PGPORT/PGHOST env vars or swap to the proc fixture.
postgresql_noproc = factories.postgresql_noproc(
    host="localhost",
    port=5433,
    user="postgres",
    dbname="tests",
)
postgresql = factories.postgresql('postgresql_noproc')


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
