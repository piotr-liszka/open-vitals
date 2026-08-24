"""Garmin authentication: login (with MFA) and auth status.

Wraps the garmy boundary (``app.garmy_client``). Garmin email/password are used
exactly once to obtain tokens and are then dropped — they are never stored,
returned, or logged (AGENTS.md §10). Only the encrypted token bundle persists.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from . import garmy_client
from .errors import InvalidCredentials, MfaRequired, classify_upstream
from .tokens import TokenStore

logger = logging.getLogger("garmin-sidecar.auth")


@dataclass
class _PendingLogin:
    """In-memory continuation for a login paused on MFA.

    Holds the live garmy auth client plus garmy's opaque resume state. Never
    persisted; lost on restart (the user simply logs in again). Contains no
    plaintext password.
    """

    client: Any
    state: Any


class GarminAuth:
    """Login + status over an injected :class:`TokenStore`."""

    def __init__(self, store: TokenStore) -> None:
        self._store = store
        # Keyed by (user_id, normalised email) so an MFA follow-up call finds its
        # context and one user's pending login can never satisfy another's.
        self._pending: dict[tuple[str, str], _PendingLogin] = {}

    # -- login ---------------------------------------------------------------

    def login(
        self,
        user_id: str,
        email: str,
        password: str,
        mfa_code: str | None = None,
    ) -> dict[str, Any]:
        """Log in to Garmin and persist the resulting token bundle for a user.

        Scoped to ``user_id``: tokens are stored under that user's slot only.
        Raises :class:`MfaRequired` when Garmin wants a code and none was given,
        :class:`InvalidCredentials` on rejected credentials/code.
        """
        key = (user_id, email.strip().lower())
        try:
            if mfa_code:
                client = self._complete_mfa(key, email, password, mfa_code)
            else:
                client = self._start_login(key, email, password)
        except MfaRequired:
            raise
        except InvalidCredentials:
            raise
        except Exception as exc:  # noqa: BLE001 - normalise garmy failures
            # Message intentionally omits any credential/token material.
            raise classify_upstream(exc, "login") from exc

        bundle = garmy_client.extract_token_bundle(client)
        self._store.save(user_id, bundle)
        logger.info("Login succeeded; token bundle stored.")
        return self._status_from_bundle(bundle)

    def _start_login(
        self, key: tuple[str, str], email: str, password: str
    ) -> Any:
        """Fresh login with no MFA code yet supplied."""
        client = garmy_client.make_auth_client()
        try:
            needs_mfa, state = garmy_client.login_start(client, email, password)
        except InvalidCredentials:
            raise
        except Exception as exc:  # noqa: BLE001
            raise self._as_credential_or_upstream(exc)
        if needs_mfa:
            self._pending[key] = _PendingLogin(client=client, state=state)
            logger.info("Login requires MFA; awaiting code.")
            raise MfaRequired("mfa code required")
        return client

    def _complete_mfa(
        self, key: tuple[str, str], email: str, password: str, mfa_code: str
    ) -> Any:
        """Finish a login using the supplied MFA code."""
        pending = self._pending.pop(key, None)
        try:
            if pending is not None:
                garmy_client.login_resume(pending.client, pending.state, mfa_code)
                return pending.client
            # No pending context (e.g. after restart): do a one-shot login that
            # feeds the code straight through.
            client = garmy_client.make_auth_client()
            garmy_client.login_with_code(client, email, password, mfa_code)
            return client
        except InvalidCredentials:
            raise
        except Exception as exc:  # noqa: BLE001
            raise self._as_credential_or_upstream(exc)

    @staticmethod
    def _as_credential_or_upstream(exc: Exception) -> Exception:
        """Map a garmy exception to 401 vs 502 by a coarse name/text sniff.

        We never inspect or echo the offending values — only the error's class
        name and message text, which garmy controls and which contain no secret.
        """
        text = f"{type(exc).__name__} {exc}".lower()
        if any(
            token in text
            for token in ("401", "unauthor", "invalid", "credential", "password", "mfa")
        ):
            return InvalidCredentials("invalid garmin credentials")
        return classify_upstream(exc, "login")

    # -- status --------------------------------------------------------------

    def status(self, user_id: str) -> dict[str, Any]:
        """Report a user's auth status from their bundle, refreshing if needed."""
        bundle = self._store.load(user_id)
        if not bundle:
            return {"authenticated": False}

        # Best-effort validation/refresh; failure downgrades to unauthenticated
        # rather than erroring the liveness-adjacent status endpoint.
        try:
            client = garmy_client.make_auth_client()
            garmy_client.restore_token_bundle(client, bundle)
            garmy_client.ensure_valid(client)
            refreshed = garmy_client.extract_token_bundle(client)
        except Exception:  # noqa: BLE001
            logger.warning("Stored tokens could not be validated.")
            return self._status_from_bundle(bundle)

        merged = {**bundle, **{k: v for k, v in refreshed.items() if v is not None}}
        if merged != bundle:
            self._store.save(user_id, merged)
        return self._status_from_bundle(merged)

    @staticmethod
    def _status_from_bundle(bundle: dict[str, Any]) -> dict[str, Any]:
        """Shape a bundle into the public /status response (no secrets)."""
        resp: dict[str, Any] = {"authenticated": True}
        if bundle.get("display_name"):
            resp["display_name"] = bundle["display_name"]
        if bundle.get("expires_at") is not None:
            resp["expires_at"] = bundle["expires_at"]
        return resp
