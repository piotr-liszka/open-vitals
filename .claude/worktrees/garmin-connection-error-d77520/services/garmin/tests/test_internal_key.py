"""The web<->sidecar shared-secret guardrail (spec 055).

``X-User-Id`` names a user but does not PROVE the caller is the web tier, so
before spec 055 anything that could reach this service on the Docker network
could read any user's Garmin data. ``INTERNAL_API_KEY`` closes that: when it is
configured, every route except the liveness probe requires a matching
``X-Internal-Key``.

The guard is deliberately optional (unset = open, as before) so an in-place
upgrade does not take a running deployment down before its ``.env`` is updated —
these tests pin both halves of that behaviour.
"""

from __future__ import annotations

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import _internal_key_ok, create_app
from app.tokens import InMemoryTokenStore

from tests.conftest import USER_A

KEY = "s3cret-internal-key"


@pytest.fixture
def guarded_client(fake_garmy) -> TestClient:
    """An app whose internal-key guardrail is switched ON."""
    settings = Settings(
        token_encryption_key=Fernet.generate_key().decode(), internal_api_key=KEY
    )
    app = create_app(settings, InMemoryTokenStore(settings.token_encryption_key))
    return TestClient(app, headers={"X-User-Id": USER_A})


class TestGuardEnabled:
    def test_health_stays_reachable_without_the_key(self, guarded_client: TestClient) -> None:
        # Compose/Docker probe this; it touches neither Garmin nor the token store.
        res = guarded_client.get("/health")
        assert res.status_code == 200
        assert res.json() == {"status": "ok"}

    def test_request_without_the_key_is_rejected(self, guarded_client: TestClient) -> None:
        res = guarded_client.get("/status")
        assert res.status_code == 403
        assert res.json() == {"detail": "unauthorized"}

    def test_request_with_a_wrong_key_is_rejected(self, guarded_client: TestClient) -> None:
        res = guarded_client.get("/status", headers={"X-Internal-Key": "not-the-key"})
        assert res.status_code == 403

    def test_request_with_the_right_key_is_served(self, guarded_client: TestClient) -> None:
        res = guarded_client.get("/status", headers={"X-Internal-Key": KEY})
        assert res.status_code == 200
        assert "authenticated" in res.json()

    @pytest.mark.parametrize(
        ("method", "path"),
        [
            ("get", "/status"),
            ("post", "/login"),
            ("get", "/metrics/steps"),
            ("get", "/metrics/steps/range"),
            ("get", "/activities"),
            ("get", "/activities/1/details"),
            ("get", "/weight/range"),
            ("get", "/calendar/planned"),
            ("post", "/workouts"),
            ("get", "/diagnostics"),
            ("delete", "/session"),
        ],
    )
    def test_every_garmin_touching_route_is_gated(
        self, guarded_client: TestClient, method: str, path: str
    ) -> None:
        """The guard is middleware, so a new route is covered without opting in.

        Asserting 403 (not 4xx-of-any-kind) matters: it must reject BEFORE the
        route's own validation, or a malformed request would leak the fact that
        an endpoint exists and is reachable.
        """
        res = getattr(guarded_client, method)(path)
        assert res.status_code == 403, f"{method.upper()} {path} was not gated"

    def test_rejection_does_not_reveal_whether_a_key_is_configured(
        self, guarded_client: TestClient, client: TestClient
    ) -> None:
        # A guarded app with no key and an unguarded app both answer plainly; the
        # 403 body carries no hint about the deployment's configuration.
        assert guarded_client.get("/status").json() == {"detail": "unauthorized"}


class TestGuardDisabled:
    def test_unset_key_keeps_the_service_open(self, client: TestClient) -> None:
        """Backwards compatibility: the default fixture has no internal key."""
        assert client.get("/status").status_code == 200

    def test_a_stray_key_header_is_ignored_when_unconfigured(self, client: TestClient) -> None:
        assert client.get("/status", headers={"X-Internal-Key": "whatever"}).status_code == 200


class TestBlankKeyIsUnset:
    """A blank ``INTERNAL_API_KEY`` must mean "off", not "armed with an empty key".

    Compose cannot express "absent": ``INTERNAL_API_KEY: ${INTERNAL_API_KEY:-}``
    delivers an empty string whenever ``.env`` omits it. Pydantic parsed that as
    ``""`` — truthy enough to arm the guardrail, while the web tier omits the
    header when its own copy is empty — so a deployment that had simply never
    set the key locked itself out of its own sidecar, and every route answered
    "unauthorized" while the "key is unset" startup warning stayed silent.
    """

    @pytest.mark.parametrize("blank", ["", "   ", "\n"])
    def test_a_blank_env_value_parses_as_none(
        self, monkeypatch: pytest.MonkeyPatch, blank: str
    ) -> None:
        monkeypatch.setenv("TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode())
        monkeypatch.setenv("INTERNAL_API_KEY", blank)
        assert Settings().internal_api_key is None  # type: ignore[call-arg]

    def test_a_blank_key_leaves_the_service_open(
        self, monkeypatch: pytest.MonkeyPatch, fake_garmy
    ) -> None:
        """The end-to-end shape of the bug: blank key, no header, still served."""
        monkeypatch.setenv("TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode())
        monkeypatch.setenv("INTERNAL_API_KEY", "")
        settings = Settings()  # type: ignore[call-arg]
        app = create_app(settings, InMemoryTokenStore(settings.token_encryption_key))
        client = TestClient(app, headers={"X-User-Id": USER_A})
        assert client.get("/status").status_code == 200

    def test_a_real_env_value_still_arms_the_guard(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode())
        monkeypatch.setenv("INTERNAL_API_KEY", f"  {KEY}  ")
        # Surrounding whitespace is trimmed, so a stray space in .env cannot
        # silently produce a key the web tier will never match.
        assert Settings().internal_api_key == KEY  # type: ignore[call-arg]


class TestKeyComparison:
    def test_unconfigured_accepts_anything(self) -> None:
        assert _internal_key_ok(None, None) is True
        assert _internal_key_ok(None, "anything") is True

    def test_configured_requires_an_exact_match(self) -> None:
        assert _internal_key_ok(KEY, KEY) is True
        assert _internal_key_ok(KEY, None) is False
        assert _internal_key_ok(KEY, "") is False
        assert _internal_key_ok(KEY, KEY + "x") is False
        assert _internal_key_ok(KEY, KEY[:-1]) is False
