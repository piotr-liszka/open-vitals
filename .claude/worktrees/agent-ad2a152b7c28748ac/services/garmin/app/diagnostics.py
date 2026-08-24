"""Bounded, per-user in-memory diagnostic buffer for the sidecar (spec 019).

WHY: sidecar logs only ever reached stdout (`docker logs`), so when a sync failed
the web tier could say no more than "GarminUnavailableError". This buffer gives
the web tier a *read-only, internal* window onto what actually happened inside
the sidecar — which Garmin endpoint was called, what it answered, whether the
failure is worth retrying.

Safety rules (AGENTS.md §2, §10) — this buffer is a log surface, so it is built
to make a leak structurally hard:

* Only records emitted by THIS service's loggers are captured.
* Every message is sanitised: e-mail-shaped and long token-shaped substrings are
  replaced with ``***`` and the text is truncated. Metric payloads never reach a
  log line in the first place (the loggers only emit names/counts/dates).
* Records are tagged with the request's user scope (a contextvar set by an HTTP
  middleware) and :meth:`DiagnosticBuffer.snapshot` returns ONLY the records of
  the asking user. Untagged (startup) records are never returned to anybody.
* The buffer is bounded (``maxlen``) so it cannot grow on a small machine.

Nothing here is persisted: a restart empties it, which is exactly right for a
diagnostic tail.
"""

from __future__ import annotations

import logging
import re
import time
from collections import deque
from contextvars import ContextVar
from typing import Any, Iterable

# Scope of the request currently being served ("" = no user / startup work).
_user_scope: ContextVar[str] = ContextVar("garmin_sidecar_user_scope", default="")

# Max characters kept per message; a long line is truncated, never split.
_MAX_MESSAGE = 300

# Default number of records kept in memory (per process, ALL users).
DEFAULT_CAPACITY = 400

# Anything that looks like an address or a long opaque credential is masked even
# though our own log lines never contain one — defence in depth for third-party
# records that might one day be routed here.
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_TOKEN_RE = re.compile(r"\b[A-Za-z0-9_\-]{24,}\b")


def set_user_scope(user_id: str) -> Any:
    """Bind the current request's user scope. Returns a reset token."""
    return _user_scope.set(user_id or "")


def reset_user_scope(token: Any) -> None:
    """Undo a :func:`set_user_scope` binding."""
    try:
        _user_scope.reset(token)
    except (ValueError, LookupError):  # pragma: no cover - different context
        _user_scope.set("")


def current_user_scope() -> str:
    return _user_scope.get()


def sanitize(message: str) -> str:
    """Mask credential-shaped substrings and bound the length of a log line."""
    masked = _TOKEN_RE.sub("***", _EMAIL_RE.sub("***", message))
    if len(masked) > _MAX_MESSAGE:
        masked = masked[: _MAX_MESSAGE - 1] + "…"
    return masked


class DiagnosticBuffer:
    """A fixed-size ring of recent, sanitised log records tagged by user scope."""

    def __init__(self, capacity: int = DEFAULT_CAPACITY) -> None:
        self._entries: deque[dict[str, Any]] = deque(maxlen=capacity)
        self._capacity = capacity

    @property
    def capacity(self) -> int:
        return self._capacity

    def add(
        self,
        level: str,
        message: str,
        *,
        user_id: str | None = None,
        logger_name: str = "garmin-sidecar",
        code: str | None = None,
        endpoint: str | None = None,
        at: float | None = None,
    ) -> None:
        """Append one record. ``user_id`` defaults to the current request scope."""
        entry: dict[str, Any] = {
            "t": at if at is not None else time.time(),
            "level": level.lower(),
            "logger": logger_name,
            "msg": sanitize(message),
            "user": user_id if user_id is not None else current_user_scope(),
        }
        if code:
            entry["code"] = code
        if endpoint:
            entry["endpoint"] = sanitize(endpoint)
        self._entries.append(entry)

    def snapshot(self, user_id: str, limit: int = 100) -> list[dict[str, Any]]:
        """The newest ``limit`` records belonging to ``user_id`` (oldest first).

        Records from another user's request — or from unattributed startup work —
        are never returned: one tenant must not read another's diagnostics.
        """
        if not user_id:
            return []
        mine: Iterable[dict[str, Any]] = (e for e in self._entries if e.get("user") == user_id)
        selected = list(mine)[-max(0, limit):]
        # Drop the internal scope tag before the record leaves the process.
        return [{k: v for k, v in e.items() if k != "user"} for e in selected]

    def clear(self) -> None:
        self._entries.clear()


class BufferHandler(logging.Handler):
    """Logging handler that mirrors this service's records into the buffer."""

    def __init__(self, buffer: DiagnosticBuffer) -> None:
        super().__init__()
        self._buffer = buffer

    def emit(self, record: logging.LogRecord) -> None:
        try:
            message = record.getMessage()
        except Exception:  # pragma: no cover - defensive: broken %-args
            return
        self._buffer.add(
            record.levelname,
            message,
            logger_name=record.name,
            code=getattr(record, "code", None),
            endpoint=getattr(record, "endpoint", None),
            at=record.created,
        )


def attach(buffer: DiagnosticBuffer, logger_name: str = "garmin-sidecar") -> BufferHandler:
    """Route ``logger_name`` (and its children) into ``buffer``. Idempotent."""
    target = logging.getLogger(logger_name)
    for existing in target.handlers:
        if isinstance(existing, BufferHandler):
            target.removeHandler(existing)
    handler = BufferHandler(buffer)
    handler.setLevel(logging.INFO)
    target.addHandler(handler)
    return handler
