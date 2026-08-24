"""Local-data-sync endpoints: full backfill page, activity streams, weigh-ins.

Covers the three reads the web tier uses to sync ALL Garmin data locally:
- ``GET /activities?limit=&start=`` — raw newest-first page for full history;
- ``GET /activities/{id}/details`` — per-activity time-series streams;
- ``GET /weight/range?start=&end=`` — weigh-in history.

Each asserts the response SHAPE plus the shared multi-tenant contract (400 with
no ``X-User-Id``, 409 when not authenticated). garmy stays mocked at the
``garmy_client`` boundary via conftest's fake ``APIClient`` (metrics accessor +
``connectapi``) — deterministic and offline (AGENTS.md §7).
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app import garmy_client
from conftest import ACTIVITIES_FIXTURE_DAYS


def _login(client: TestClient) -> None:
    resp = client.post("/login", json={"email": "user@example.com", "password": "pw"})
    assert resp.status_code == 200


# The fixture holds one activity per day plus a same-day double inserted at index
# 1, so the total list length is days + 1.
_TOTAL_ACTIVITIES = ACTIVITIES_FIXTURE_DAYS + 1


# --- GET /activities (full-history backfill page) -----------------------------

def test_activities_page_returns_raw_newest_first_page(client: TestClient) -> None:
    _login(client)
    resp = client.get("/activities", params={"limit": 5, "start": 0})

    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) == 5
    # Raw garmy activity-summary dicts, untouched.
    assert all("activityId" in a and "startTimeLocal" in a for a in body)


def test_activities_page_default_limit(client: TestClient) -> None:
    _login(client)
    resp = client.get("/activities")

    assert resp.status_code == 200
    assert len(resp.json()) == garmy_client._ACTIVITY_PAGE_SIZE  # 20 default


def test_activities_page_offset_paginates(client: TestClient) -> None:
    """A non-zero start returns a later, non-overlapping slice."""
    _login(client)
    first = client.get("/activities", params={"limit": 10, "start": 0}).json()
    second = client.get("/activities", params={"limit": 10, "start": 10}).json()

    first_ids = {a["activityId"] for a in first}
    second_ids = {a["activityId"] for a in second}
    assert first_ids.isdisjoint(second_ids)


def test_activities_page_empty_past_the_end(client: TestClient) -> None:
    """Past the end of the list → [] (the exhaustion signal for backfill)."""
    _login(client)
    resp = client.get("/activities", params={"start": _TOTAL_ACTIVITIES + 50})

    assert resp.status_code == 200
    assert resp.json() == []


def test_activities_page_limit_bounds_enforced(client: TestClient) -> None:
    _login(client)
    assert client.get("/activities", params={"limit": 0}).status_code == 422
    assert client.get("/activities", params={"limit": 1000}).status_code == 422
    assert client.get("/activities", params={"start": -1}).status_code == 422


def test_activities_page_missing_header_400(unscoped_client: TestClient) -> None:
    assert unscoped_client.get("/activities").status_code == 400


def test_activities_page_409_when_not_authenticated(client: TestClient) -> None:
    resp = client.get("/activities")
    assert resp.status_code == 409
    assert resp.json()["detail"] == "not authenticated"


# --- GET /activities/{id}/details (per-activity streams) ----------------------

def test_activity_details_returns_streams_and_summary(client: TestClient) -> None:
    _login(client)
    resp = client.get("/activities/1000/details")

    assert resp.status_code == 200
    body = resp.json()
    assert body["activityId"] == 1000
    assert body["summary"]["averageHR"] == 150

    # GPS carries [lat, lng, elevation] (elevation column present in fixture).
    assert body["gps"][0] == [52.10, 21.00, 100.0]
    assert len(body["gps"]) == 3

    expected = {
        "heartRate": [140, 145, 150],
        "power": [210, 215, 220],
        "cadence": [85, 86, 87],
        "speed": [3.5, 3.6, 3.7],
        "elevation": [100.0, 102.0, 104.0],
        # Epoch-ms timestamps rebased + rescaled to seconds from start.
        "time": [0.0, 1.0, 2.0],
    }
    for stream, values in expected.items():
        assert body[stream] == values


def test_activity_details_stream_keys_are_camel_case(client: TestClient) -> None:
    """Regression guard for the HR data-loss bug (spec 023).

    The sidecar used to emit snake_case ``heart_rate`` while the web tier read
    ``heartRate``, so every synced activity lost its HR stream silently. The
    wire contract is camelCase on BOTH sides; no snake_case key may reappear.
    """
    _login(client)
    body = client.get("/activities/1000/details").json()

    assert "heartRate" in body
    assert "heart_rate" not in body
    assert "activity_id" not in body
    assert not any("_" in key for key in body), body.keys()


def test_activity_details_returns_extended_streams(client: TestClient) -> None:
    """Running dynamics / physiology columns are captured, not discarded."""
    _login(client)
    body = client.get("/activities/1000/details").json()

    expected = {
        "respirationRate": [16.0, 17.0, 18.0],
        "verticalRatio": [7.5, 7.6, 7.7],
        "verticalOscillation": [9.1, 9.2, 9.3],
        "groundContactTime": [250.0, 252.0, 254.0],
        "groundContactBalance": [49.5, 49.8, 50.1],
        "strideLength": [118.0, 119.0, 120.0],
        "temperature": [21.0, 21.5, 22.0],
        "grade": [1.5, 2.0, 2.5],
        "stamina": [82.0, 80.0, 78.0],
        "staminaPotential": [95.0, 95.0, 95.0],
        "performanceCondition": [3.0, 2.0, 1.0],
        "fractionalCadence": [0.5, 0.5, 0.5],
        "movingDuration": [0.0, 1.0, 1.0],
    }
    for stream, values in expected.items():
        assert body[stream] == values, stream
    # Derived: sumMovingDuration only advances while moving, so the last sample
    # (no advance) is standing. The first sample has no delta and counts as moving.
    assert body["moving"] == [1, 1, 0]


def test_activity_details_returns_laps_and_typed_splits(client: TestClient) -> None:
    _login(client)
    body = client.get("/activities/1000/details").json()

    laps = body["laps"]
    assert [lap["index"] for lap in laps] == [1, 2]
    assert laps[0]["distanceM"] == 1000.0
    assert laps[0]["durationS"] == 300.0
    assert laps[0]["movingDurationS"] == 295.0
    assert laps[0]["avgHr"] == 148.0
    assert laps[0]["avgRunCadenceSpm"] == 172.0
    assert laps[0]["avgGroundContactTimeMs"] == 250.0
    assert laps[0]["intensityType"] == "ACTIVE"
    # A lap the device recorded less for simply carries fewer keys.
    assert "avgRunCadenceSpm" not in laps[1]

    typed = {s["type"]: s for s in body["typedSplits"]}
    assert typed["RWD_RUN"]["durationS"] == 480.0
    assert typed["RWD_WALK"]["durationS"] == 90.0
    assert typed["RWD_STAND"]["durationS"] == 30.0
    assert typed["RWD_RUN"]["count"] == 4


def test_activity_details_survives_missing_splits(
    client: TestClient, monkeypatch
) -> None:
    """No laps/typedsplits (or a failing endpoint) must not break the response."""
    _login(client)

    def blank(api, activity_id):
        return {}

    monkeypatch.setattr(garmy_client, "fetch_activity_splits", blank)
    body = client.get("/activities/1000/details").json()

    assert body["heartRate"] == [140, 145, 150]
    assert "laps" not in body
    assert "typedSplits" not in body


def test_activity_details_omits_unavailable_streams(
    client: TestClient, monkeypatch
) -> None:
    """A stream Garmin never recorded is omitted, not returned empty/null."""
    _login(client)

    def only_hr(api, activity_id):
        return {
            "activityId": activity_id,
            "summary": {},
            "heartRate": [100, 101, 102],
        }

    monkeypatch.setattr(garmy_client, "fetch_activity_details", only_hr)
    body = client.get("/activities/1000/details").json()

    assert body["heartRate"] == [100, 101, 102]
    for absent in ("gps", "power", "cadence", "speed", "elevation", "time"):
        assert absent not in body


def test_activity_details_non_int_id_422(client: TestClient) -> None:
    _login(client)
    assert client.get("/activities/not-an-int/details").status_code == 422


def test_activity_details_missing_header_400(unscoped_client: TestClient) -> None:
    assert unscoped_client.get("/activities/1000/details").status_code == 400


def test_activity_details_409_when_not_authenticated(client: TestClient) -> None:
    resp = client.get("/activities/1000/details")
    assert resp.status_code == 409
    assert resp.json()["detail"] == "not authenticated"


# --- GET /weight/range (weigh-in history) -------------------------------------

def test_weight_range_returns_window_and_data(client: TestClient) -> None:
    _login(client)
    resp = client.get(
        "/weight/range", params={"start": "2026-08-01", "end": "2026-08-31"}
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["start"] == "2026-08-01"
    assert body["end"] == "2026-08-31"
    summaries = body["data"]["dailyWeightSummaries"]
    assert summaries[0]["allWeightMetrics"][0]["weight"] == 81200.0


def test_weight_range_start_after_end_400(client: TestClient) -> None:
    _login(client)
    resp = client.get(
        "/weight/range", params={"start": "2026-08-31", "end": "2026-08-01"}
    )
    assert resp.status_code == 400


def test_weight_range_span_over_cap_400(client: TestClient) -> None:
    _login(client)
    resp = client.get(
        "/weight/range", params={"start": "2024-01-01", "end": "2026-08-01"}
    )
    assert resp.status_code == 400


def test_weight_range_bad_date_422(client: TestClient) -> None:
    _login(client)
    resp = client.get(
        "/weight/range", params={"start": "08-01-2026", "end": "2026-08-02"}
    )
    assert resp.status_code == 422


def test_weight_range_missing_header_400(unscoped_client: TestClient) -> None:
    resp = unscoped_client.get(
        "/weight/range", params={"start": "2026-08-01", "end": "2026-08-02"}
    )
    assert resp.status_code == 400


def test_weight_range_409_when_not_authenticated(client: TestClient) -> None:
    resp = client.get(
        "/weight/range", params={"start": "2026-08-01", "end": "2026-08-02"}
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == "not authenticated"


# --- stream parser unit cover (pure, no HTTP) ---------------------------------

def test_extract_streams_decodes_columns_and_omits_missing() -> None:
    """Only descriptors we recognise become streams; unknown keys are dropped."""
    details = {
        "metricDescriptors": [
            {"key": "directLatitude", "metricsIndex": 0},
            {"key": "directLongitude", "metricsIndex": 1},
            {"key": "directHeartRate", "metricsIndex": 2},
            {"key": "someFutureMetric", "metricsIndex": 3},
        ],
        "activityDetailMetrics": [
            {"metrics": [10.0, 20.0, 130, 999]},
            {"metrics": [10.1, 20.1, 132, 999]},
        ],
    }
    streams = garmy_client._extract_streams(details)

    assert streams["gps"] == [[10.0, 20.0], [10.1, 20.1]]  # no elevation column
    assert streams["heartRate"] == [130, 132]
    for absent in ("power", "cadence", "speed", "elevation", "time", "moving"):
        assert absent not in streams


def test_extract_streams_falls_back_to_polyline_for_gps() -> None:
    """With no lat/lng metric columns, GPS comes from geoPolylineDTO."""
    details = {
        "metricDescriptors": [{"key": "directHeartRate", "metricsIndex": 0}],
        "activityDetailMetrics": [{"metrics": [130]}],
        "geoPolylineDTO": {
            "polyline": [
                {"lat": 1.0, "lon": 2.0, "altitude": 50.0},
                {"lat": 1.1, "lon": 2.1},
            ]
        },
    }
    streams = garmy_client._extract_streams(details)

    assert streams["gps"] == [[1.0, 2.0, 50.0], [1.1, 2.1]]
    assert streams["heartRate"] == [130]


def test_extract_streams_empty_when_no_descriptors() -> None:
    assert garmy_client._extract_streams({}) == {}
    assert garmy_client._extract_streams({"metricDescriptors": "nope"}) == {}


def test_extract_streams_survives_ragged_and_junk_rows() -> None:
    """Short rows, junk rows and out-of-range indices must never raise."""
    details = {
        "metricDescriptors": [
            {"key": "directHeartRate", "metricsIndex": 0},
            {"key": "directPower", "metricsIndex": 9},  # beyond every row
            {"key": "directSpeed", "metricsIndex": "nope"},  # malformed
            "not-a-descriptor",
        ],
        "activityDetailMetrics": [
            {"metrics": [130]},
            "not-a-record",
            {"metrics": [132]},
            {"nope": True},
        ],
    }
    streams = garmy_client._extract_streams(details)

    assert streams["heartRate"] == [130, 132]
    assert "power" not in streams  # column existed but held no value
    assert "speed" not in streams


def test_time_stream_prefers_duration_over_epoch_timestamp() -> None:
    """`time` is seconds from start: a duration column beats directTimestamp."""
    details = {
        "metricDescriptors": [
            {"key": "directTimestamp", "metricsIndex": 0},
            {"key": "sumElapsedDuration", "metricsIndex": 1},
        ],
        "activityDetailMetrics": [
            {"metrics": [1_754_640_978_000, 0.0]},
            {"metrics": [1_754_640_979_000, 1.0]},
            {"metrics": [1_754_640_981_000, 3.0]},
        ],
    }
    assert garmy_client._extract_streams(details)["time"] == [0.0, 1.0, 3.0]


def test_time_stream_converts_epoch_milliseconds() -> None:
    """With only directTimestamp, epoch ms are rebased and rescaled to seconds."""
    details = {
        "metricDescriptors": [{"key": "directTimestamp", "metricsIndex": 0}],
        "activityDetailMetrics": [
            {"metrics": [1_754_640_978_000]},
            {"metrics": [1_754_640_979_000]},
            {"metrics": [1_754_640_988_000]},
        ],
    }
    assert garmy_client._extract_streams(details)["time"] == [0.0, 1.0, 10.0]


# --- lap / split parser unit cover ---------------------------------------------

def test_normalize_laps_reads_lap_dtos_and_tolerates_junk() -> None:
    laps = garmy_client._normalize_laps(
        {
            "lapDTOs": [
                {"messageIndex": 0, "distance": 1000.0, "duration": 300.0},
                "not-a-lap",
                {},  # nothing usable -> dropped
                {"distance": 500.0},
            ]
        },
        ("lapDTOs",),
    )

    assert [lap["index"] for lap in laps] == [1, 4]
    assert laps[0]["distanceM"] == 1000.0
    assert laps[1]["distanceM"] == 500.0


def test_normalize_laps_reads_nested_split_type() -> None:
    laps = garmy_client._normalize_laps(
        {"splits": [{"splitType": {"typeKey": "rwd_run"}, "duration": 60.0}]},
        ("splits",),
    )
    assert laps[0]["type"] == "rwd_run"
    assert laps[0]["durationS"] == 60.0


def test_normalize_laps_empty_for_unusable_payloads() -> None:
    assert garmy_client._normalize_laps(None, ("lapDTOs",)) == []
    assert garmy_client._normalize_laps({"lapDTOs": "nope"}, ("lapDTOs",)) == []
    assert garmy_client._normalize_laps({}, ("lapDTOs",)) == []


def test_fetch_activity_splits_never_raises() -> None:
    """An endpoint that errors yields no laps rather than failing the detail fetch."""

    class _Boom:
        def connectapi(self, path: str):
            raise RuntimeError("upstream 500")

    assert garmy_client.fetch_activity_splits(_Boom(), 1000) == {}
