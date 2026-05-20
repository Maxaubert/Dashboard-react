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


# (route, ip) -> (window_start_unix, count)
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
