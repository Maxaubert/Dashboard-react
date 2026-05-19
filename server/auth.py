"""Auth helpers for the multi-user dashboard backend.

Two responsibilities in this module:
  1. Password hashing (argon2id) -- see hash_password / verify_password
  2. Cryptographically random ID generation -- session IDs + invite codes

Session lookup, cookie parsing, and the do_GET/do_POST middleware
that ties them together live in this file too -- see the next section
(added by Phase 2 / Task 3).
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
    parameters, salt, and hash -- verifiable with verify_password alone."""
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
    """32 random bytes -> URL-safe base64 (43 chars, no padding)."""
    return secrets.token_urlsafe(32)


def generate_invite_code() -> str:
    """16 chars of URL-safe random. Used as the primary key in invite_codes."""
    return secrets.token_urlsafe(12)  # 12 random bytes -> 16 chars b64
