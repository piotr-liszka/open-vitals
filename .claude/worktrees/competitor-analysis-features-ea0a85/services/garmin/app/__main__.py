"""Entrypoint: ``python -m app`` runs uvicorn bound to the configured host/port.

Using a module entrypoint (rather than a bare ``uvicorn app.main:app`` CMD) lets
HOST/PORT/LOG_LEVEL from the environment drive the bind, keeping the sidecar on
its internal address.
"""

from __future__ import annotations

import uvicorn

from .config import get_settings


def main() -> None:
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()
