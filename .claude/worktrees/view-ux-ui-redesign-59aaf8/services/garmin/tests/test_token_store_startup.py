"""PostgresTokenStore startup resilience (spec 030).

The sidecar used to EXIT when Postgres was not up yet ("Application startup
failed. Exiting."), which left the container Stopped until someone pressed Start.
These tests pin the replacement behaviour: retry, then start anyway, then repair
lazily once the database appears.

`psycopg` is never imported here — `_connect` is patched at the boundary, so the
suite stays offline (AGENTS.md §7).
"""

from __future__ import annotations

import logging
from typing import Any

import pytest
from cryptography.fernet import Fernet

from app.tokens import _READY_BACKOFF_S, PostgresTokenStore

DSN = "postgres://garmin:s3cret-pass@db:5432/garmin_bridge"
USER = "user-a"


class FakeCursor:
    def __init__(self, log: list[str], row: tuple[Any, ...] | None) -> None:
        self._log = log
        self._row = row
        self.rowcount = 1

    def __enter__(self) -> FakeCursor:
        return self

    def __exit__(self, *_exc: object) -> None:
        return None

    def execute(self, sql: str, _params: tuple[Any, ...] | None = None) -> None:
        self._log.append(sql.split()[0] + (" TABLE" if "CREATE TABLE" in sql else ""))

    def fetchone(self) -> tuple[Any, ...] | None:
        return self._row


class FakeConnection:
    def __init__(self, log: list[str], row: tuple[Any, ...] | None) -> None:
        self._log = log
        self._row = row

    def __enter__(self) -> FakeConnection:
        return self

    def __exit__(self, *_exc: object) -> None:
        return None

    def cursor(self) -> FakeCursor:
        return FakeCursor(self._log, self._row)

    def commit(self) -> None:
        return None


class FakePostgres:
    """A Postgres that refuses the first `fail_times` connections, then works."""

    def __init__(self, fail_times: int, row: tuple[Any, ...] | None = None) -> None:
        self.remaining_failures = fail_times
        self.attempts = 0
        self.statements: list[str] = []
        self._row = row

    def connect(self) -> FakeConnection:
        self.attempts += 1
        if self.remaining_failures > 0:
            self.remaining_failures -= 1
            # Mirrors the real message, credentials included, so redaction is testable.
            raise OSError(f"connection failed: connection to {DSN} at 172.26.0.3 refused")
        return FakeConnection(self.statements, self._row)


def _store(pg: FakePostgres) -> tuple[PostgresTokenStore, list[float]]:
    slept: list[float] = []
    store = PostgresTokenStore(DSN, Fernet.generate_key().decode(), sleep=slept.append)
    store._connect = pg.connect  # type: ignore[method-assign]
    return store, slept


def test_ready_on_first_attempt_never_sleeps() -> None:
    pg = FakePostgres(fail_times=0)
    store, slept = _store(pg)

    store.ensure_ready()

    assert pg.attempts == 1
    assert slept == []  # ordinary startup pays nothing for the retry logic
    assert pg.statements == ["CREATE TABLE"]


def test_retries_until_postgres_accepts_connections() -> None:
    pg = FakePostgres(fail_times=2)
    store, slept = _store(pg)

    store.ensure_ready()

    assert pg.attempts == 3
    assert slept == list(_READY_BACKOFF_S[:2])  # backoff schedule, in order
    assert pg.statements == ["CREATE TABLE"]


def test_exhausted_retries_do_not_kill_startup() -> None:
    pg = FakePostgres(fail_times=99)
    store, slept = _store(pg)

    store.ensure_ready()  # must NOT raise — this is what used to exit the process

    assert pg.attempts == len(_READY_BACKOFF_S) + 1
    assert slept == list(_READY_BACKOFF_S)


def test_failure_logs_never_carry_the_dsn_password(caplog: pytest.LogCaptureFixture) -> None:
    pg = FakePostgres(fail_times=99)
    store, _ = _store(pg)

    with caplog.at_level(logging.WARNING, logger="garmin-sidecar.tokens"):
        store.ensure_ready()

    text = caplog.text
    assert "s3cret-pass" not in text
    assert "***:***@" in text  # the connection string is quoted, but redacted
    assert "OSError" in text  # the classification survives, so the log is still useful


def test_heals_on_first_use_once_postgres_appears() -> None:
    pg = FakePostgres(fail_times=99)
    store, _ = _store(pg)
    store.ensure_ready()  # startup gave up
    pg.statements.clear()

    pg.remaining_failures = 0  # Postgres finally came up
    store.save(USER, {"oauth2": {"access_token": "tok"}})

    # The table is created lazily, then the write proceeds — no restart needed.
    assert pg.statements == ["CREATE TABLE", "INSERT"]


def test_prepared_store_adds_no_extra_statement_per_operation() -> None:
    pg = FakePostgres(fail_times=0)
    store, _ = _store(pg)
    store.ensure_ready()
    pg.statements.clear()

    store.exists(USER)
    store.clear(USER)

    assert pg.statements == ["SELECT", "DELETE"]  # no repeated CREATE TABLE


def test_operation_failure_still_surfaces_to_the_caller() -> None:
    pg = FakePostgres(fail_times=99)
    store, _ = _store(pg)
    store.ensure_ready()

    # A store that is still unreachable must fail loudly per request (the web tier
    # classifies it), rather than pretending the user has no tokens.
    with pytest.raises(OSError):
        store.exists(USER)
