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


import pytest
from server import db as server_db


def test_get_pool_raises_when_not_initialized(monkeypatch):
    """get_pool() before init_pool() should error clearly, not return None."""
    monkeypatch.setattr(server_db, '_pool', None, raising=False)
    with pytest.raises(RuntimeError, match='not initialized'):
        server_db.get_pool()


def test_init_pool_creates_usable_pool(db_url, monkeypatch):
    """After init_pool, get_pool returns a pool we can borrow connections from."""
    monkeypatch.setattr(server_db, '_pool', None, raising=False)
    server_db.init_pool(db_url, min_size=1, max_size=2)
    pool = server_db.get_pool()
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute('SELECT 1 AS one')
        assert cur.fetchone() == {'one': 1}
    server_db.close_pool()


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
    server_db.execute("CREATE TEMP TABLE rollback_test (n INT)")
    with pytest.raises(RuntimeError, match='boom'):
        with server_db.tx() as conn:
            with conn.cursor() as cur:
                cur.execute("INSERT INTO rollback_test (n) VALUES (1)")
            raise RuntimeError('boom')
    # The INSERT should have been rolled back
    rows = server_db.query("SELECT COUNT(*) AS c FROM rollback_test")
    assert rows[0]['c'] == 0
    server_db.close_pool()
