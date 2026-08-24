"""InMemoryTokenStore tests: Fernet round-trip, no-plaintext, per-user isolation.

The Postgres adapter shares all crypto/shaping with the in-memory adapter (both
extend ``_EncryptedTokenStore``); it is not exercised here because the suite is
offline (no real Postgres). These tests cover the shared behaviour and the
per-user keying that isolation depends on.
"""

from __future__ import annotations

from cryptography.fernet import Fernet

from app.tokens import InMemoryTokenStore

USER_A = "user-a"
USER_B = "user-b"


def _store() -> InMemoryTokenStore:
    return InMemoryTokenStore(Fernet.generate_key().decode())


def test_round_trip() -> None:
    store = _store()
    assert store.exists(USER_A) is False
    assert store.load(USER_A) is None

    bundle = {
        "oauth1": {"oauth_token": "abc", "oauth_token_secret": "secret-xyz"},
        "oauth2": {"access_token": "tok-123", "expires_at": 4102444800.0},
        "display_name": "Test Athlete",
    }
    store.save(USER_A, bundle)

    assert store.exists(USER_A) is True
    assert store.load(USER_A) == bundle


def test_ciphertext_is_not_plaintext() -> None:
    store = _store()
    bundle = {
        "oauth2": {"access_token": "SUPERSECRETACCESS", "refresh_token": "REFRESHZZZ"}
    }
    store.save(USER_A, bundle)

    # The value actually held for the user is Fernet ciphertext, not plaintext.
    stored = store._rows[USER_A]  # noqa: SLF001 - white-box check of the record
    assert isinstance(stored, str)
    for secret in ("SUPERSECRETACCESS", "REFRESHZZZ", "access_token"):
        assert secret not in stored


def test_clear_only_removes_that_user() -> None:
    store = _store()
    store.save(USER_A, {"oauth2": {"access_token": "a"}})
    store.save(USER_B, {"oauth2": {"access_token": "b"}})

    assert store.clear(USER_A) is True
    assert store.exists(USER_A) is False
    # USER_B is untouched by USER_A's disconnect.
    assert store.exists(USER_B) is True
    assert store.load(USER_B) == {"oauth2": {"access_token": "b"}}
    # Clearing an already-absent user is a no-op returning False.
    assert store.clear(USER_A) is False


def test_users_are_isolated() -> None:
    store = _store()
    store.save(USER_A, {"oauth2": {"access_token": "a-token"}})
    store.save(USER_B, {"oauth2": {"access_token": "b-token"}})

    assert store.load(USER_A) == {"oauth2": {"access_token": "a-token"}}
    assert store.load(USER_B) == {"oauth2": {"access_token": "b-token"}}
    # A never sees B's bundle and vice-versa.
    assert store.load(USER_A) != store.load(USER_B)


def test_corrupt_record_loads_as_none() -> None:
    store = _store()
    store._rows[USER_A] = "not-a-valid-fernet-token"  # noqa: SLF001
    assert store.load(USER_A) is None
