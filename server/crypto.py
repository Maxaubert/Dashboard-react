"""AES-GCM encrypt/decrypt for per-user secrets at rest.

Per-user integration tokens (Steam, Canvas, etc.) are stored encrypted
in user_integrations.payload_enc. The key lives in /etc/dashboard.env
as DASHBOARD_ENCRYPTION_KEY (32 bytes, base64-encoded). A compromised
DB dump without the env file leaks nothing usable.

Why AES-GCM (not pgcrypto): pgcrypto needs the DB process to hold the
key, breaking the "DB dump alone is useless" property. App-layer
encryption keeps the key off the DB host.
"""
from __future__ import annotations

import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


IV_SIZE = 12  # 96-bit nonce per AES-GCM spec recommendation


def encrypt(plaintext: bytes, key: bytes) -> tuple[bytes, bytes]:
    """Encrypt plaintext with a 32-byte key. Returns (iv, ciphertext).

    Generates a fresh random IV per call -- never reuse an (iv, key) pair."""
    if len(key) != 32:
        raise ValueError('key must be 32 bytes')
    iv = os.urandom(IV_SIZE)
    ciphertext = AESGCM(key).encrypt(iv, plaintext, associated_data=None)
    return iv, ciphertext


def decrypt(iv: bytes, ciphertext: bytes, key: bytes) -> bytes:
    """Decrypt with the same key + iv used by encrypt(). Raises
    cryptography.exceptions.InvalidTag if the ciphertext or iv has been
    tampered with or the key is wrong."""
    if len(key) != 32:
        raise ValueError('key must be 32 bytes')
    if len(iv) != IV_SIZE:
        raise ValueError(f'iv must be {IV_SIZE} bytes')
    return AESGCM(key).decrypt(iv, ciphertext, associated_data=None)
