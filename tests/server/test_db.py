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
