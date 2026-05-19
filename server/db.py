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
    _pool.wait()


def get_pool() -> ConnectionPool:
    """Return the initialized pool. Raises if init_pool() hasn't run."""
    if _pool is None:
        raise RuntimeError(
            'connection pool is not initialized -- call init_pool(url) first'
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
