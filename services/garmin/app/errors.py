"""Typed domain errors raised at the garmy boundary and mapped to HTTP in main.

Keeping these in their own module avoids import cycles between auth/metrics/main.
Error messages never contain credentials or token material.
"""

from __future__ import annotations


class GarminError(Exception):
    """Base class for all sidecar domain errors."""


class MfaRequired(GarminError):
    """Garmin asked for a multi-factor code and none was supplied.

    Mapped to HTTP 202 with ``{"mfa_required": true}``. Carries no secrets.
    """


class InvalidCredentials(GarminError):
    """Garmin rejected the email/password (or MFA code). Mapped to HTTP 401."""


class NotAuthenticated(GarminError):
    """No valid stored tokens for a request that needs them. Mapped to HTTP 409."""


class UnknownMetric(GarminError):
    """Requested metric name is not supported. Mapped to HTTP 404."""


class InvalidDateRange(GarminError):
    """A range request was malformed (start > end, or span too large).

    Mapped to HTTP 400. Carries only a human-readable reason, no secrets.
    """


class InvalidWorkout(GarminError):
    """A structured workout could not be mapped onto Garmin's model (spec 050).

    Mapped to HTTP 422. Carries only a shape/validation reason (which step kind,
    which unit) — never the workout's title, note or targets, which are the
    athlete's own content.
    """


class GarminUpstreamError(GarminError):
    """garmy/Garmin failed unexpectedly. Mapped to HTTP 502 (or 429/409).

    Carries a machine-readable *classification* so the web tier can tell a rate
    limit apart from an expired token apart from a dead sidecar (spec 019).
    NOTHING here is derived from the upstream exception's text: only its class
    name and, when present, the HTTP status it mentions — an upstream message
    could in principle echo request material, and this value is returned to the
    caller and written into the sync log.
    """

    def __init__(
        self,
        code: str = "upstream_error",
        *,
        reason: str = "garmin request failed",
        endpoint: str | None = None,
        status: int | None = None,
        retryable: bool = True,
    ) -> None:
        super().__init__(reason)
        self.code = code
        self.reason = reason
        self.endpoint = endpoint
        self.status = status
        self.retryable = retryable

    def payload(self) -> dict[str, object]:
        """The secret-free JSON body the web tier parses."""
        body: dict[str, object] = {
            "code": self.code,
            "reason": self.reason,
            "retryable": self.retryable,
        }
        if self.endpoint:
            body["endpoint"] = self.endpoint
        if self.status is not None:
            body["upstreamStatus"] = self.status
        return body


# HTTP status the sidecar answers with, per classification code. A rejected
# token is 409 (same as "no tokens at all") because the user's fix is identical:
# reconnect the Garmin account. A rate limit is 429 so the caller can back off.
UPSTREAM_HTTP_STATUS: dict[str, int] = {
    "rate_limited": 429,
    "token_rejected": 409,
    "blocked": 502,
    "timeout": 504,
    "not_found": 404,
    "upstream_error": 502,
}

# Which classifications are worth retrying later (the sync engine records this so
# the /dane log can say "spróbuj ponownie" instead of "reconnect your account").
_RETRYABLE: dict[str, bool] = {
    "rate_limited": True,
    "token_rejected": False,
    "blocked": True,
    "timeout": True,
    "not_found": False,
    "upstream_error": True,
}

_STATUS_RE = None  # lazily compiled in _status_in


def _status_in(text: str) -> int | None:
    """First 3-digit HTTP status mentioned in an exception's text, if any."""
    global _STATUS_RE
    if _STATUS_RE is None:
        import re

        _STATUS_RE = re.compile(r"\b([1-5]\d{2})\b")
    match = _STATUS_RE.search(text)
    return int(match.group(1)) if match else None


def classify_upstream(exc: BaseException, endpoint: str | None = None) -> GarminUpstreamError:
    """Turn any garmy/transport exception into a classified upstream error.

    Only the exception's TYPE NAME and any HTTP status it mentions leave this
    function; the raw message never does.
    """
    if isinstance(exc, GarminUpstreamError):
        return exc
    text = f"{type(exc).__name__}: {exc}".lower()
    status = _status_in(text)

    if status == 429 or "rate limit" in text or "too many requests" in text:
        code = "rate_limited"
    elif status in (401, 403) or "unauthorized" in text or "forbidden" in text:
        # 403 from Garmin is also what a Cloudflare block looks like; treat a
        # bare "cloudflare"/"challenge" mention as a block, everything else as a
        # rejected token (the user must reconnect).
        code = "blocked" if ("cloudflare" in text or "challenge" in text) else "token_rejected"
    elif "timeout" in text or "timed out" in text:
        code = "timeout"
    elif status == 404:
        code = "not_found"
    elif "connection" in text or "ssl" in text or "resolve" in text:
        code = "blocked"
    else:
        code = "upstream_error"

    reason = f"{code} ({type(exc).__name__}" + (f", HTTP {status}" if status else "") + ")"
    return GarminUpstreamError(
        code,
        reason=reason,
        endpoint=endpoint,
        status=status,
        retryable=_RETRYABLE.get(code, True),
    )
