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
