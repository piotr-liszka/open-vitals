"""Fernet-encrypted, per-user storage for the garmy OAuth token bundles.

Multi-tenant (spec 012): every user id supplied by the web tier gets its own
row/slot. The token store is a PORT (:class:`TokenStore`) with two adapters:

- :class:`InMemoryTokenStore` — for tests; keeps the whole suite offline with no
  real Postgres. Still encrypts, so the "never store plaintext" property holds.
- :class:`PostgresTokenStore` — production; one row per user in a table the
  sidecar owns and creates idempotently.

Token-store layout (Postgres)
-----------------------------
Table ``garmin_tokens (user_id TEXT PRIMARY KEY, ciphertext TEXT NOT NULL,
updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`` — one row per user id. Each
bundle (OAuth1 + OAuth2 material) is serialised to JSON and **Fernet-encrypted
with the sidecar's key before it is written** to ``ciphertext``; it is decrypted
on read. The Fernet key lives only in the sidecar. Plaintext tokens are never
written anywhere, the user id is never logged, and token/ciphertext contents are
never logged (AGENTS.md §2, §10).
"""

from __future__ import annotations

import abc
import json
import logging
import re
import time
from collections.abc import Callable
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger("garmin-sidecar.tokens")

# Type alias for the decrypted token bundle.
TokenBundle = dict[str, Any]


class TokenStore(abc.ABC):
    """Port: per-user encrypted token storage.

    Adapters persist opaque ciphertext keyed by the opaque ``user_id``; the
    encryption/decryption and JSON shaping live in :class:`_EncryptedTokenStore`
    so every adapter shares identical crypto and never sees plaintext on disk.
    """

    @abc.abstractmethod
    def load(self, user_id: str) -> TokenBundle | None:
        """Return the user's decrypted bundle, or ``None`` if absent/unreadable."""

    @abc.abstractmethod
    def save(self, user_id: str, bundle: TokenBundle) -> None:
        """Encrypt and persist the user's bundle (upsert)."""

    @abc.abstractmethod
    def clear(self, user_id: str) -> bool:
        """Delete only this user's bundle. True if something was removed."""

    @abc.abstractmethod
    def exists(self, user_id: str) -> bool:
        """True if a bundle is stored for this user."""

    def ensure_ready(self) -> None:
        """Prepare backing storage (e.g. create the table). Default: no-op.

        **Best effort, and must not raise** (spec 030): it runs in the app's
        startup lifespan, where an exception kills the process. An adapter whose
        backing store is not up yet retries, then logs and lets the service
        start — a sidecar that is running and reporting a classified failure is
        far more useful than one that exited.
        """


class _EncryptedTokenStore(TokenStore):
    """Shared Fernet codec + JSON shaping over adapter-specific ciphertext I/O.

    Subclasses implement the four ciphertext primitives; this base owns the key
    and the encrypt/decrypt so no adapter can accidentally persist plaintext.
    """

    def __init__(self, encryption_key: str) -> None:
        # Fernet validates the key shape here; a bad key fails fast at startup.
        self._fernet = Fernet(encryption_key.encode("utf-8"))

    # -- crypto ---------------------------------------------------------------

    def _encrypt(self, bundle: TokenBundle) -> str:
        plaintext = json.dumps(bundle, separators=(",", ":")).encode("utf-8")
        return self._fernet.encrypt(plaintext).decode("ascii")

    def _decrypt(self, ciphertext: str) -> TokenBundle | None:
        try:
            plaintext = self._fernet.decrypt(ciphertext.encode("ascii"))
            data = json.loads(plaintext.decode("utf-8"))
        except (InvalidToken, ValueError, TypeError):
            # Never log ciphertext/plaintext — only the fact of failure.
            logger.warning("Token record unreadable or corrupt; treating as empty.")
            return None
        if not isinstance(data, dict):
            logger.warning("Token payload was not an object; ignoring.")
            return None
        return data

    # -- public API implemented via ciphertext primitives --------------------

    def load(self, user_id: str) -> TokenBundle | None:
        ciphertext = self._read(user_id)
        if ciphertext is None:
            return None
        return self._decrypt(ciphertext)

    def save(self, user_id: str, bundle: TokenBundle) -> None:
        self._write(user_id, self._encrypt(bundle))
        logger.info("Token store updated.")

    def clear(self, user_id: str) -> bool:
        removed = self._delete(user_id)
        if removed:
            logger.info("Token store cleared.")
        return removed

    def exists(self, user_id: str) -> bool:
        return self._has(user_id)

    # -- ciphertext primitives (adapter-specific) ----------------------------

    @abc.abstractmethod
    def _read(self, user_id: str) -> str | None: ...

    @abc.abstractmethod
    def _write(self, user_id: str, ciphertext: str) -> None: ...

    @abc.abstractmethod
    def _delete(self, user_id: str) -> bool: ...

    @abc.abstractmethod
    def _has(self, user_id: str) -> bool: ...


class InMemoryTokenStore(_EncryptedTokenStore):
    """In-process adapter for tests: ciphertext held in a dict, never on disk."""

    def __init__(self, encryption_key: str) -> None:
        super().__init__(encryption_key)
        self._rows: dict[str, str] = {}

    def _read(self, user_id: str) -> str | None:
        return self._rows.get(user_id)

    def _write(self, user_id: str, ciphertext: str) -> None:
        self._rows[user_id] = ciphertext

    def _delete(self, user_id: str) -> bool:
        return self._rows.pop(user_id, None) is not None

    def _has(self, user_id: str) -> bool:
        return user_id in self._rows


# SQL kept as module constants (parameterised; user_id/ciphertext are never
# interpolated into the statement text).
_CREATE_TABLE = (
    "CREATE TABLE IF NOT EXISTS garmin_tokens ("
    "user_id TEXT PRIMARY KEY, "
    "ciphertext TEXT NOT NULL, "
    "updated_at TIMESTAMPTZ NOT NULL DEFAULT now())"
)
_SELECT = "SELECT ciphertext FROM garmin_tokens WHERE user_id = %s"
_UPSERT = (
    "INSERT INTO garmin_tokens (user_id, ciphertext) VALUES (%s, %s) "
    "ON CONFLICT (user_id) DO UPDATE SET "
    "ciphertext = EXCLUDED.ciphertext, updated_at = now()"
)
_DELETE = "DELETE FROM garmin_tokens WHERE user_id = %s"
_EXISTS = "SELECT 1 FROM garmin_tokens WHERE user_id = %s"

# Backoff between startup attempts to prepare the table, in seconds (~60s total).
# Sized to the compose healthcheck window for Postgres (20 retries x 5s).
_READY_BACKOFF_S: tuple[float, ...] = (1.0, 2.0, 4.0, 8.0, 15.0, 15.0, 15.0)

# `scheme://user:password@host` inside any text we are about to log.
_DSN_CREDENTIALS = re.compile(r"(?P<scheme>[a-zA-Z0-9+.-]+://)[^\s/@]*:[^\s/@]*@")


def _redact_dsn(text: str) -> str:
    """Strip DSN credentials from text headed for a log line (AGENTS.md 10).

    Driver errors normally quote only host/port, but they are free to echo the
    connection string, and the DSN carries the Postgres password.
    """
    return _DSN_CREDENTIALS.sub(lambda m: f"{m.group('scheme')}***:***@", text)


class PostgresTokenStore(_EncryptedTokenStore):
    """Production adapter: one encrypted row per user in Postgres.

    Uses a sync ``psycopg`` (v3) connection opened per operation — the sidecar is
    low-traffic and endpoints are synchronous. ``psycopg`` is imported lazily so
    this module stays importable where it is not installed (local dev). The
    sidecar owns and idempotently creates ``garmin_tokens`` via
    :meth:`ensure_ready` at startup.
    """

    def __init__(
        self,
        dsn: str,
        encryption_key: str,
        *,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        super().__init__(encryption_key)
        self._dsn = dsn
        # Injected so the retry schedule is asserted in tests without waiting for it.
        self._sleep = sleep
        # Latches once the table exists, so the steady-state path costs nothing extra.
        self._ready = False

    def _connect(self) -> Any:
        import psycopg  # lazy: only needed at runtime in the container

        return psycopg.connect(self._dsn)

    def _prepare(self) -> None:
        """Connect and create the table. One attempt — raises on failure."""
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(_CREATE_TABLE)
            conn.commit()
        self._ready = True

    def ensure_ready(self) -> None:
        """Prepare the table, retrying while Postgres comes up (spec 030).

        Never raises. Container start order is not something this process can
        rely on: the compose health gate gates ``up``, not a single-container
        restart, a Postgres bounce, or a Docker-daemon restart — and each of
        those used to leave the sidecar **Stopped** until a human pressed Start.
        So a missing database at startup is retried for about a minute and then
        merely logged; :meth:`_ensure_table` picks it up later if it appears.
        """
        for attempt, delay in enumerate((0.0, *_READY_BACKOFF_S), start=1):
            if delay:
                self._sleep(delay)
            try:
                self._prepare()
                logger.info("garmin_tokens table ready.")
                return
            except Exception as exc:  # noqa: BLE001 — any driver/transport failure is retryable here
                logger.warning(
                    "Token store not ready (attempt %d/%d): %s: %s",
                    attempt,
                    len(_READY_BACKOFF_S) + 1,
                    type(exc).__name__,
                    _redact_dsn(str(exc)),
                )
        logger.error(
            "Token store could not be prepared; starting anyway and will retry on first use."
        )

    def _ensure_table(self) -> None:
        """Lazy repair: prepare the table if startup never managed to.

        This is what makes the sidecar heal without a restart once Postgres
        shows up. Raises on failure, so the caller's error surfaces to the web
        tier with its usual classification instead of being swallowed.
        """
        if self._ready:
            return
        self._prepare()

    def _read(self, user_id: str) -> str | None:
        self._ensure_table()
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(_SELECT, (user_id,))
                row = cur.fetchone()
        if row is None:
            return None
        value = row[0]
        return value if isinstance(value, str) else None

    def _write(self, user_id: str, ciphertext: str) -> None:
        self._ensure_table()
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(_UPSERT, (user_id, ciphertext))
            conn.commit()

    def _delete(self, user_id: str) -> bool:
        self._ensure_table()
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(_DELETE, (user_id,))
                removed = cur.rowcount > 0
            conn.commit()
        return removed

    def _has(self, user_id: str) -> bool:
        self._ensure_table()
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(_EXISTS, (user_id,))
                return cur.fetchone() is not None
