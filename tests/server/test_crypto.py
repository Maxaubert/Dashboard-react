"""Tests for server/crypto.py -- AES-GCM encrypt/decrypt round-trip."""
import os

import pytest

from server import crypto as server_crypto


def _key() -> bytes:
    """Return a deterministic 32-byte key for tests."""
    return b'\x00' * 32


def test_encrypt_decrypt_round_trip():
    """Plaintext -> encrypt -> decrypt yields the same plaintext."""
    plaintext = b'{"steam_id":"12345","api_key":"deadbeef"}'
    iv, ciphertext = server_crypto.encrypt(plaintext, _key())
    assert iv != b''
    assert ciphertext != plaintext
    assert server_crypto.decrypt(iv, ciphertext, _key()) == plaintext


def test_different_iv_for_each_encryption():
    """Each encrypt() call generates a fresh IV (no nonce reuse)."""
    p = b'hello'
    iv1, _ = server_crypto.encrypt(p, _key())
    iv2, _ = server_crypto.encrypt(p, _key())
    assert iv1 != iv2


def test_decrypt_with_wrong_key_fails():
    """Wrong key -> InvalidTag from cryptography."""
    iv, ct = server_crypto.encrypt(b'secret', _key())
    with pytest.raises(Exception):  # cryptography.exceptions.InvalidTag
        server_crypto.decrypt(iv, ct, b'\xff' * 32)


def test_decrypt_with_tampered_ciphertext_fails():
    """Tamper with one byte of ciphertext -> InvalidTag."""
    iv, ct = server_crypto.encrypt(b'secret', _key())
    tampered = bytes([ct[0] ^ 0xff]) + ct[1:]
    with pytest.raises(Exception):
        server_crypto.decrypt(iv, tampered, _key())
