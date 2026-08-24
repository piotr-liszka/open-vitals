"""Application configuration, loaded from environment variables.

All secrets arrive via env vars (AGENTS.md §2, §11) — nothing is hardcoded and
nothing sensitive is logged. `TOKEN_ENCRYPTION_KEY` is required; the rest have
sensible defaults for the container.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Sidecar settings sourced from the process environment.

    Field names map to upper-case env keys (pydantic-settings is
    case-insensitive), e.g. ``token_encryption_key`` <- ``TOKEN_ENCRYPTION_KEY``.
    """

    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    # Fernet key (urlsafe base64, 32 bytes) used to encrypt token bundles before
    # they are written to Postgres. Required — the service must not start without
    # it. Shared across all users; per-user isolation is one row per user id.
    token_encryption_key: str

    # Postgres DSN (``postgres://…``) for the per-user encrypted token table
    # (spec 012, multi-tenant). Postgres replaces the old disk token volume; the
    # legacy ``TOKEN_STORE_PATH``/``TOKEN_STORE_DIR`` env vars, if still set, are
    # ignored (``extra="ignore"``). Optional at construction so the module and
    # tests (which inject an in-memory store) load without a DSN; required when
    # the default Postgres store is built (see app.main).
    database_url: str | None = None

    # Shared secret the web tier must present as ``X-Internal-Key`` on every
    # Garmin-touching call (spec 055 — the ``X-User-Id`` guardrail AGENTS.md §10
    # listed as an open follow-up). ``X-User-Id`` alone is an ASSERTION of
    # identity: anything that can reach this service on the Docker network can
    # name any user and read their data. With this set, reaching the port is no
    # longer enough.
    #
    # Optional so an existing deployment keeps working across the upgrade — but
    # when unset the service logs a startup warning, because unset means the
    # guardrail is off. Set it in .env for both `web` and `garmin`.
    internal_api_key: str | None = None

    @field_validator("internal_api_key", mode="after")
    @classmethod
    def _blank_internal_key_means_unset(cls, value: str | None) -> str | None:
        """Normalise a blank key to ``None`` — i.e. "guardrail off".

        Compose has no way to pass "absent": ``INTERNAL_API_KEY: ${INTERNAL_API_KEY:-}``
        hands us an EMPTY STRING whenever ``.env`` does not set it, and pydantic
        parses that as ``""`` — which is not ``None``. Without this, the empty
        case armed the guardrail with an empty expected key while the web tier
        (which omits ``X-Internal-Key`` when its own value is empty) presented
        none, so every call 401'd and the "unset" startup warning — guarded on
        ``is None`` — stayed silent about why.
        """
        if value is None:
            return None
        return value.strip() or None

    # Bind address / port. Internal Docker network only — never LAN-published.
    host: str = "0.0.0.0"
    port: int = 8081

    # Logging verbosity (DEBUG/INFO/WARNING/ERROR).
    log_level: str = "INFO"

    # How many recent log records the per-user diagnostics buffer keeps in memory
    # (spec 019). Bounded on purpose: this runs on a small machine, and the
    # buffer exists to explain the last failure, not to be a log store.
    diagnostics_buffer_size: int = 400


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance built from the environment."""
    return Settings()  # type: ignore[call-arg]  # values come from env
