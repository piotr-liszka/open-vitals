# Spec 072 — Data freshness: say which day the numbers are from, and when the watch never reached Garmin

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/insights/`, `apps/web/src/modules/sync/`, `apps/web/src/lib/server/sync/`, `apps/web/src/lib/server/store/`
- **Owner agent:** module-dev
- **Depends on:** 015 (local store), 019 (sync hardening), 022 (condition card), 059 (Garmin Training Readiness), 070 (readiness truth)

## Context

On 2026-08-16 the start page showed Training Readiness **1 / "2 dni 13 h" do pełnej regeneracji**, minutes after a
sync that reported `ok`. The watch said **34 / ~19 h**. Nothing was miscalculated: the newest
`training_readiness` row we hold is **2026-08-14 20:30** (`score: 1`, `recoveryTime: 3672` min), and
`recoveryTime` counted down from that moment lands on 2026-08-17 09:42 — exactly the ~19 h the watch was
showing. The watch had simply not uploaded to Garmin Connect since Thursday evening: Garmin's own daily
summary for 08-15 and 08-16 comes back with every field `null`, `includesWellnessData: false`,
`lastSyncTimestampGMT: null`.

So three separate things are dishonest, and each one alone would have been enough to mislead:

1. **The card presents the newest scored day as "now".** `latestTrainingReadiness()` walks backwards until it
   finds any score, and neither `GarminReadinessGauge` nor `ConditionCard` renders the `day` that is already
   in the contract. A two-day-old snapshot is indistinguishable from this morning's.
2. **Nothing says the watch never reached Garmin.** The sidebar's "Ostatnia synchronizacja 13:57" is true and
   irrelevant — it times *our* pull, not the freshness of what we pulled. The user did a full sync in
   response, which could not have helped.
3. **`/dane` counts empty days as data.** Coverage filters on `data IS NOT NULL`, but Garmin answers a
   dataless day with a *present* object full of nulls. So 08-15 and 08-16 counted toward "106 dni z danymi"
   and the panel still claimed "Historia metryk dziennych jest kompletna".

Scope note: this spec labels stale data, it does not extrapolate it. Counting Garmin's recovery timer down to
the current instant the way the watch does would produce a number no Garmin surface published — that is a
different decision and is deliberately out of scope.

## Requirements (acceptance criteria)

**Freshness as a first-class fact**

- [x] `hasMetricValue(metric, data)` treats a payload from which no value can be extracted as **absent**; a
      Garmin daily summary with every field `null` is not "a day with data".
- [x] `synced_metric_days` carries a nullable `has_value boolean`, written on every upsert, added by an
      idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS` in `MIGRATIONS`.
- [x] `coverage()` derives `presentDays` / `firstDay` / `lastDay` from `has_value`, in **both** the pg adapter
      and the in-memory fake, and the coverage contract test covers a hollow day in both.
- [x] `CoverageSnapshot` gains `freshness: { lastDataDay: string | null; staleDays: number | null }` —
      the newest day carrying a real value across the wellness metrics, and its distance from today.

**The card says which day it is showing**

- [x] `computeCondition()` takes `today: DayKey` as an explicit argument (pure, no `Date.now()`), and
      `ConditionSnapshot` gains `staleDays: number | null`.
- [x] `GarminReadiness` gains `staleDays: number` and `RecoveryTime` reporting stays tied to its own `day`.
- [x] When `staleDays === 0` the card looks exactly as it does today — no new chrome on the normal path.
- [x] When `staleDays >= 1` the readiness gauge carries a visible "stan na 14 sie" marker in warning tone.
- [x] When `staleDays >= 1` the recovery timer is labelled as of its own day rather than presented as a live
      countdown.
- [x] The Polish summary sentence for a stale snapshot names the day it describes.

**"Your watch has not reached Garmin"**

- [x] The sync engine records the newest day in the freshness window for which **any** watch-borne metric
      yielded a value, and logs a warning line naming the gap when it is behind today.
- [x] That warning is `level: 'warn'`, so it surfaces under "Problemy" in "Dziennik synchronizacji" without
      switching to the error-only filter — and does not mark the run failed, because our side did work.
- [x] `/dane` shows a `Banner tone="warning"` when `staleDays >= 1`, distinguishing *our* sync from *Garmin's*
      data and telling the user the actionable thing: sync the watch with the Garmin Connect app first.
- [x] The start-page condition card shows the same warning when its snapshot is stale, so the user meets it
      where the wrong number was.
- [x] Unit + API-integration tests pass (no e2e) — 162 files, 2108 tests
- [x] Built only from `lib/ui` components + design tokens (`Banner`, `Badge`)
- [x] No secrets logged or committed

## API contract

```
GET /api/data/coverage
  res: { coverage: { …, freshness: { lastDataDay: string | null, staleDays: number | null } }, lastRun }

GET /api/insights?window=…
  res: { …, condition: { …, staleDays: number | null,
                         garmin: { …, day, staleDays } } }
```

No new endpoints. `staleDays` is `null` (not `0`) when the store holds nothing at all — "we don't know" and
"it's current" must not collapse into the same value.

`/api/sync/status` is deliberately **unchanged**. It reports what OUR sync did; freshness is a property of the
DATA and already has one owner in `coverage.freshness`. Putting it in both would create two answers to the
same question that can disagree — which is the shape of the bug this spec exists to fix.

`getCoverage(deps, userId, today)` gained the `today` argument: the store has no clock (AGENTS.md §2.4), so it
reports `lastDataDay` and leaves `staleDays` null for the handler to complete in the app timezone.

## UI

`Banner` (warning), `Badge` (warning), `Card`, `StatTile` — all existing `lib/ui`. No new components.

- **Fresh (the common case):** unchanged. No badge, no banner, no extra row.
- **Stale, card:** a warning `Badge` beside the score — `stan na 14 sie` — plus a `Banner` above the card:
  *"Garmin nie ma danych nowszych niż 14 sie. Zsynchronizuj zegarek z aplikacją Garmin Connect — nasza
  synchronizacja pobrała już wszystko, co Garmin ma."*
- **Stale, `/dane`:** the same `Banner`, above the phase table, so it is the first thing read after a run.
- **Unknown (`staleDays === null`, nothing synced yet):** no banner — the existing "connect / sync first"
  prompts already own that state.
- Light + dark: tone tokens only, no hardcoded colour.

## Design / implementation notes

- `computeCondition` and `insights.garmin-readiness.ts` stay **pure**: `today` is passed down from
  `loadInsights`, which already resolves it via the injected `Clock` in the app timezone (`todayKey`).
- Presence is decided by `hasMetricValue`, which reuses `extractMetricValue` — one definition of "this day
  holds something", shared by the engine's counter, the coverage aggregate and the freshness signal. The raw
  payload is still stored untouched; `has_value` is a derived index column, never a reason to drop data.
- The engine already counts `present` per chunk with `d.data != null` — that expression becomes
  `hasMetricValue(...)`, which is also what fixes the inflated "dni z danymi" count in the run log.
- `staleDays` is computed against the app-timezone today, never UTC.
- **Edge cases:** a legitimately dataless day (watch left on the charger) produces exactly the same signal as
  a watch that failed to upload — we cannot tell them apart and the copy must not claim to. The banner says
  what is true ("Garmin has nothing newer") and suggests the most likely fix, rather than asserting a cause.
  A single stale day is normal early in the morning before the first upload, so the banner threshold is
  `staleDays >= 1` measured on **completed** data days, and the copy stays non-alarming.
- Deliberately unchanged: the sidecar. garmy swallows HTTP errors and returns `[]`
  (`garmy/core/metrics.py:79-82`), so an upstream failure and an empty day are already indistinguishable by
  the time we see them. Making that distinction is a separate spec; this one makes the *outcome* visible.

## Test plan

- **Unit:**
  - `hasMetricValue` — an all-null daily summary is absent; a summary with `totalSteps: 0` is present.
  - `latestTrainingReadiness` + `toGarminReadiness` — `staleDays` for same-day, 2-day-old and unknown cases.
  - `computeCondition` — `staleDays` from the newest dated channel; `null` when nothing is dated.
  - Summary sentence names the day when stale and does not when fresh.
  - Engine: a chunk of hollow days counts as 0 days with data and sets `lastDataDay` to the last real one.
- **API integration (mock adapters):**
  - `/api/insights` with a fixture whose newest readiness is 2 days old → `condition.staleDays === 2`,
    `condition.garmin.staleDays === 2`; status 200 and the contract shape.
  - `/api/sync/status` → `garminDataThrough` / `staleDays` present; `null` on an empty store.
  - `/api/sync/coverage` → hollow days excluded from `presentDays`; `freshness.lastDataDay` correct.
- **Component:** `ConditionCard` renders no staleness chrome at `staleDays: 0` and both badge and banner at
  `staleDays: 2`; `DataView` renders the banner only when stale.
- **Store contract:** the shared coverage contract test runs against pg **and** the in-memory fake so the two
  adapters cannot drift again (the failure mode spec 019 already hit once).

## Closeout

- Commits: see the spec-072 commit on this branch.
- Verified: 162 test files / 2108 tests pass, `svelte-check` 0 errors 0 warnings, prettier clean, build OK.
- Notes / follow-ups:
  - **`has_value` converges, it does not backfill.** Existing rows are `NULL` and keep the old
    `data IS NOT NULL` rule until the sync rewrites them, which the freshness window does within days for
    recent data and the backfill does eventually for history. Chosen over `NOT NULL DEFAULT false`, which
    would have read every existing row as empty and blanked everyone's coverage until a full re-sync.
  - **"Nie da się odróżnić od nieużywania zegarka."** A day the athlete left the watch on the charger looks
    identical to a day it failed to upload — the copy therefore states what is true ("Garmin has nothing
    newer") and suggests the likely fix, rather than asserting a cause.
  - **Not done, deliberately: counting the recovery timer down.** The watch does it locally, which is why it
    showed ~19 h against our 2 dni 13 h. Publishing an extrapolated figure Garmin never served is a bigger
    lie than a dated one; if it is wanted later it should be a labelled estimate, not a silent replacement.
  - **Still open upstream:** garmy swallows HTTP errors and returns `[]`
    (`garmy/core/metrics.py:79-82`), so a rate-limited or failed day is indistinguishable from an empty one
    by the time the sidecar sees it. This spec makes the *outcome* visible; telling the two apart needs a
    change in `services/garmin` and is its own spec.
