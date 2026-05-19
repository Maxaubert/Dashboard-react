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
