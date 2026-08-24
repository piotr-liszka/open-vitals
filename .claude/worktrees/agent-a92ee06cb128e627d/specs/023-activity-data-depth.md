# Spec 023 — Activity data depth (streams, laps, and the stats Garmin already gives us)

- **Status:** Approved <!-- Draft → Approved → Closed -->
- **Module:** `services/garmin` + `apps/web/src/lib/server/{garmin,sync,store,analytics}` + `apps/web/src/modules/activity-detail/`
- **Owner agent:** garmin-integrator
- **Depends on:** 015 (local data store), 019 (sync hardening)

## Context

The activity page shows a fraction of what Garmin actually returns. Three separate causes:

1. **A live data-loss bug.** The sidecar emitted snake_case `heart_rate` while the web tier read `heartRate`, and
   nothing converted between them. Against the real sidecar **every HR stream was silently dropped and never
   persisted**; the other streams survived only because their names happen to be single words. Tests missed it
   because the dev mock speaks camelCase. So no synced activity has HR zones, and any HR-based analysis is blank.
2. **Streams thrown away.** The details decoder mapped only 10 descriptor keys; respiration, running dynamics,
   stamina, performance condition, grade, temperature and the moving/standing classification were decoded away.
   There was no laps/splits call at all, so a run page had no per-lap or run/walk breakdown.
3. **Stats already in the database, unread.** `synced_activities.raw` holds Garmin's full activity-list payload —
   training effect, sweat loss, HR time-in-zone, intensity minutes, stamina, body-battery delta, running dynamics
   and more. None of it was projected into the UI contract, and none of it needs a re-sync to recover.

This spec is the **data half** only: make the data exist, be correct and be typed. The UI is a follow-up.

## Requirements (acceptance criteria)

- [x] The sidecar `/activities/{id}/details` response is **camelCase end to end**, matching `GarminActivityDetails`.
- [x] Regression tests on **both** sides pin the wire contract: pytest asserts the sidecar emits `heartRate` and no
      snake_case key at all; vitest asserts the adapter parses `heartRate` (and still tolerates a legacy sidecar).
- [x] Already-synced activities are **repaired**: stream blobs carry a schema version and the sync engine re-fetches
      any row below `STREAMS_SCHEMA_VERSION`, so HR-less history heals over subsequent runs without a manual wipe.
- [x] Streams captured when the device recorded them: respiration rate, vertical ratio, vertical oscillation, ground
      contact time, ground contact balance, stride length, temperature, grade, stamina (current + potential),
      performance condition, fractional cadence, cumulative moving duration and a derived `moving` flag.
- [x] `time` is normalised to **seconds from start** (epoch-millisecond timestamps are rebased and rescaled).
- [x] Laps (`/splits`) and Garmin's classified splits (`/typedsplits`) are fetched and exposed; a failure there never
      fails the details request.
- [x] Every new stream/field is **optional** and defensively parsed — a missing or malformed descriptor never throws.
- [x] Stream fetching is widened beyond `hasGps || avgPower` to include HR-only (indoor) activities.
- [x] A pure, unit-tested normalizer projects the rich `raw` fields into the activity-detail contract; derived values
      (pace, active calories, idle time, intensity-minute total, run/walk seconds) live in named pure functions.
- [x] Unit + API-integration tests pass (no e2e).
- [x] No `.svelte` file touched (the UI agent owns those).
- [x] No secrets logged or committed; Garmin payloads treated as untrusted data.

## API contract

### Sidecar — `GET /activities/{activity_id}/details` (`X-User-Id` required)

```jsonc
{
  "activityId": 1000,
  "summary": { /* Garmin summaryDTO, verbatim */ },
  "gps":  [[lat, lng, elevation?], ...],   // omitted when there are no coordinates
  "time": [0, 1, 2, ...],                  // SECONDS FROM START (never epoch)
  // every scalar stream is omitted unless the device recorded it:
  "heartRate": [], "power": [], "cadence": [], "fractionalCadence": [], "speed": [], "elevation": [],
  "grade": [], "temperature": [], "respirationRate": [], "verticalRatio": [], "verticalOscillation": [],
  "groundContactTime": [], "groundContactBalance": [], "strideLength": [], "stamina": [],
  "staminaPotential": [], "performanceCondition": [], "movingDuration": [],
  "moving": [1, 1, 0, ...],                // derived from the movingDuration delta
  "laps":        [{ "index": 1, "distanceM": 1000, "durationS": 300, "avgHr": 148, "intensityType": "ACTIVE" }],
  "typedSplits": [{ "index": 1, "type": "RWD_RUN", "durationS": 480, "count": 4 }]
}
```

Errors unchanged: `400` no `X-User-Id`, `409` not authenticated, `422` non-int id, `502` upstream failure.

### Web contracts

- `GarminActivityDetails` / `ActivityLap` — `apps/web/src/lib/server/interfaces.ts`
- `ActivityStreams` (+ `STREAMS_SCHEMA_VERSION`, `listStreamVersions`) — `apps/web/src/lib/server/store/types.ts`
- `ActivityStats` (grouped, every leaf optional) — `apps/web/src/lib/server/analytics/activity-stats.ts`
- `ActivityDetailData` gains `stats`, `laps`, `typedSplits`, `streams` — `apps/web/src/modules/activity-detail/activity-detail.types.ts`

`ActivityStats` groups: `calories`, `hydration`, `respiration`, `trainingEffect`, `stamina`, `hr`, `timing`,
`power`, `elevation`, `pace`, `runningDynamics`, `temperature`, `intensityMinutes`, `bodyBattery`, `stress`,
`selfEvaluation`, `runWalk`. Groups are always present (possibly `{}`); leaves are absent when Garmin has no value.

## UI

N/A — data layer only. The follow-up UI work consumes `ActivityDetailData.stats` / `.laps` / `.typedSplits` /
`.streams` and renders `--` for any absent leaf.

## Design / implementation notes

- **Ports & adapters:** the sidecar stays the only thing that reaches Garmin. `GarminSyncSource.getActivityDetails`
  is the port; `http-adapter.ts` parses the payload explicitly (no spreading) so a rename is a failing test, not a
  silent gap. The dev mock mirrors the same shape so tests cannot lie.
- **Repair path:** stream blobs are stamped `v: STREAMS_SCHEMA_VERSION` (v2). The engine reads every row's version
  in ONE query (`listStreamVersions`) — it must never load thousands of jsonb blobs just to decide — then fetches
  missing rows first and stale rows with the leftover budget (400 full / 80 incremental, unchanged). `SyncDetail.streams`
  reports `{fetched, repaired, pending}` so the backlog is visible. **No DB migration:** the version and laps ride
  inside the existing `synced_activity_streams.streams` jsonb.
- **Widened selection:** streams are now fetched when `hasGps || avgPower != null || avgHr != null || maxHr != null`.
- **Derivations** are pure and individually tested: `paceSecPerKm`, `paceFromSpeed`, `calorieSplit`, `idleSeconds`,
  `totalIntensityMinutes`, `runWalkFromSplits`, `streamAverage`.
- **Edge cases:** descriptors vary by device/sport (every stream optional); Garmin leaves nulls inside a column
  (the adapter carries the previous value forward so streams stay index-aligned and NaN-free); `/typedsplits` may
  not exist for a sport (best-effort, key simply absent).

## Test plan

- **Unit:** `activity-stats.test.ts` (derivations + full projection + hostile payloads); `sync/normalize.test.ts`
  (`streamsFromDetails` persists every stream, stamps the version); `http-adapter.test.ts` (`parseActivityDetails`
  camelCase contract, legacy snake_case tolerance, gap carry-forward, lap parsing, hostile payloads).
- **API integration (mock adapters):** `activity-detail.api.test.ts` — the rich stats reach `ActivityDetailData`,
  run/walk comes from typed splits, average temperature falls back to the stream, thin payloads degrade to `{}`.
- **Sync integration:** `engine.test.ts` — HR persisted for a non-GPS activity, a `v1` row is re-fetched and counted
  as `repaired`, a current row is not re-fetched, and an exhausted budget leaves `pending` for the next run.
- **Sidecar (pytest):** `test_backfill.py` — camelCase keys with no snake_case survivor, extended streams, derived
  `moving`, laps + typed splits, missing-splits tolerance, ragged/junk rows, epoch-ms → seconds normalisation.

## Closeout

- Commits: _(pending)_
- **Genuinely unavailable from Garmin's payloads** (leaf stays absent, UI renders `--`):
  - **Grade-adjusted pace** — not in the activity-list payload or `summaryDTO`; `avgGradeAdjustedSpeed` is probed
    but has never been observed. (Strava computes GAP; Garmin does not expose one.)
  - **Average temperature** — only `minTemperature`/`maxTemperature` are reported; we derive the average from the
    `temperature` stream when the device recorded one, otherwise it is absent.
  - **Run / walk / standing time** — absent from the summary payload entirely. Recovered only from `/typedsplits`
    (`RWD_RUN`/`RWD_WALK`/`RWD_STAND`), so activities without typed splits have no breakdown. `idleS` in `timing` is
    the cheap fallback (duration − moving duration).
  - **Self-evaluation (perceived effort / feel)** — only present when the athlete actually filled it in on the watch
    or in Garmin Connect (`directWorkoutRpe`, stored ×10, and `directWorkoutFeel`); absent for most activities.
  - **Stamina** — `beginPotentialStamina`/`endPotentialStamina`/`minAvailableStamina` only appear for sports and
    devices that support stamina; older watches report nothing.
  - **Normalized power** — Garmin only reports it for power-meter activities; there is no NP for runs. The
    activity-detail handler still computes its own NP from the power stream.
- Follow-ups: the UI slice (render the stats/laps); consider a `pending`-aware nudge on the /data page once the
  repair backlog is large; `avgDoubleCadence` is mapped to cadence for bikes but not unit-verified.
