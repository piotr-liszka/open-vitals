# Spec 075 — The recovery timer as a moment in time, not a frozen number of hours

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/insights/`
- **Owner agent:** module-dev
- **Depends on:** 059 (Garmin Training Readiness), 070 (readiness truth — `recoveryTime` is minutes), 072 (data freshness)

## Context

The condition card shows **"16 h — do pełnej regeneracji wg Garmina"** and that number does not move until the
next sync. It cannot: we store what Garmin said (`recoveryTime`, minutes remaining) without storing *when*
Garmin said it, so the only honest thing the card can do between syncs is repeat the stale figure. Spec 072
made that honesty visible ("stan na …") but explicitly left the underlying value frozen:

> this spec labels stale data, it does not extrapolate it.

That scope note rested on an assumption that has now been checked and is false. The stored payload **does**
carry the capture instant. The live row for 2026-08-16:

```
day        2026-08-16     synced_at  2026-08-16 16:55:41+00
timestamp        "2026-08-16T15:54:57.0"     (UTC)
timestampLocal   "2026-08-16T17:54:57.0"     (Europe/Warsaw, +02:00)
recoveryTime     949                          (minutes = 15 h 49 min → "16 h")
```

Because the sidecar stores Garmin's document whole and opaque in `synced_metric_days.data`, `timestamp` has
been in the database all along — no code reads it. With it, `recoveryTime` stops being a number that needs
extrapolating and becomes an **instant**: full recovery at `2026-08-17T07:43:57Z` (09:43 local). That is not a
figure "no Garmin surface published" — it is the same fact the watch itself holds, written absolutely instead
of relatively. The countdown then ticks without a sync, and reaches "zregenerowany" on its own.

Two things this must not paper over:

1. **`synced_at` is not a substitute anchor.** In the row above it sits **60 min 44 s** after Garmin's
   `timestamp`. Anchoring on our fetch time would silently overstate the remaining time by about an hour.
   Only `timestamp` may anchor the countdown; without it we fall back to spec 072 behaviour.
2. **Garmin recalculates the timer.** `recoveryTime` is re-derived after each activity and after sleep
   (`recoveryTimeChangePhrase: "NO_CHANGE_SLEEP"`, `inputContext: "AFTER_POST_EXERCISE_RESET"`). A countdown
   is only true while nothing new has happened. If the store holds an activity that started after the anchor,
   the countdown is provably superseded and must stop counting rather than tick on confidently.

## Requirements (acceptance criteria)

**Parse the anchor**

- [x] `parseTrainingReadinessDay()` reads `timestamp` and exposes the capture instant as an epoch-ms
      number on `RecoveryTime`. (`timestampLocal` is deliberately NOT a fallback — see below.)
- [x] Garmin serves the instant **without a zone suffix and with a trailing `.0`** (`"2026-08-16T15:54:57.0"`).
      It is parsed explicitly as UTC. A bare `new Date(s)` is wrong here — JS reads a zoneless date-time as
      *local*, which happens to be harmless in the UTC container and off by two hours on a dev laptop.
- [x] `timestampLocal` is **not** used for arithmetic (it carries no offset either, so it is indistinguishable
      from UTC to a parser); it may be used only for display if ever needed.
- [x] A payload with no parseable `timestamp` yields `capturedAt: null` and everything below degrades to the
      spec 072 behaviour — label, do not count.

**Derive the instant**

- [x] `RecoveryTime` gains `endsAt: number | null` = `capturedAt + minutes × 60_000`, alongside the existing
      `minutes`, which stays. `minutes` is what Garmin actually said and is the documented MCP contract
      (`tools.ts` — "MINUTES remaining until full recovery"); it is not replaced by the derived value.
- [x] A pure `remainingMinutes(recovery, now)` helper returns the live countdown, `0` once `endsAt` has
      passed, and falls back to the stored `minutes` when `endsAt` is null.
- [x] The countdown is **suppressed** when the local store holds an activity whose start is later than
      `capturedAt`: the reading is superseded, so the card shows the stored figure with the spec 072 "stan na
      …" label instead of a ticking number.

**Show it**

- [x] `ConditionCard` renders the live remaining time as the headline value and the absolute end moment as the
      supporting line — "pełna regeneracja: dziś 09:43" / "jutro 09:43" / a dated form beyond tomorrow,
      resolved in `APP_TIMEZONE`.
- [x] Once `endsAt` is in the past the card reads "wg Garmina jesteś zregenerowany" **without** a sync.
- [x] `ReadinessGauge` ceiling explanation and `garminSummary()` use the same live figure, so no two surfaces
      disagree about the same timer. Done by feeding `computeInsights` the live minutes rather than the
      captured ones, so the gauge needed no change of its own — and our own score now stops being
      suppressed at the moment Garmin stops suppressing its.
- [x] Spec 072's staleness banner survives, with its meaning narrowed: it no longer implies the timer is wrong
      by the age of the snapshot (it no longer is), it reports that no newer reading has arrived.
- [x] The countdown does not re-render on a timer more than once a minute.

**Incidental fixes surfaced by the live payload**

- [x] `CHANGE_PHRASE` handles `NO_CHANGE_SLEEP` (the real account emits it; today it falls through to `null`).
- [x] The stale sidecar comment at `services/garmin/app/metrics.py:69` ("Carries recovery_time in hours") is
      corrected to minutes, per spec 070.

- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No new endpoint. `GET /api/insights?window=…` gains fields on the existing `RecoveryTime`
(`apps/web/src/modules/insights/insights.types.ts`):

```ts
interface RecoveryTime {
  day: string;
  minutes: number;          // unchanged — what Garmin reported at capture
  change: string | null;
  capturedAt: number | null; // NEW — epoch ms, Garmin's `timestamp`, parsed as UTC
  endsAt: number | null;     // NEW — capturedAt + minutes; null when capturedAt is null
  superseded: boolean;       // NEW — a later activity has invalidated the countdown
}
```

Additive only: existing consumers reading `minutes` keep working, so the MCP surface needs no change.

## UI

`ConditionCard.svelte`, `ReadinessGauge.svelte`, `GarminReadinessGauge.svelte` — existing `lib/ui` primitives
and tokens, no new components. States: counting (headline + absolute end moment), finished ("zregenerowany"),
superseded or anchorless (frozen value + "stan na …" per spec 072), absent (unchanged). Light + dark inherit
from tokens.

## Design / implementation notes

- Nothing changes in the sidecar or the store schema. The anchor is already inside `synced_metric_days.data`;
  this spec only starts reading it.
- Clock source is injected, not `Date.now()` read inside the parser, so the countdown is testable and matches
  how the rest of the insights module takes "today".
- Clock skew: a `capturedAt` in the future is clamped to "now" rather than producing a countdown longer than
  Garmin's own figure — same defensive stance as `stalenessOf()`.
- **Correction to the drafted plan:** "superseded" does NOT come free. The draft claimed the insights loader
  already fetches activities — it does not. `fetchSeries` maps over `METRICS`, and `activities` is not a
  `MetricSpec`, so the loader had never read it. It now makes **one** additional local-store range call,
  fixed at the last `SUPERSEDE_LOOKBACK_DAYS` = 4 days regardless of the window (Garmin's timer caps out
  around four days, so a longer tail cannot change the answer). The API test asserts the exact call count,
  so this tail cannot start scaling with the window unnoticed.
- Activity instants come from `startTimeGMT` only. `startTimeLocal` carries no offset, so reading it would
  place every summer activity two hours early — which in this comparison means failing to supersede.

## Test plan

- **Unit:** `"2026-08-16T15:54:57.0"` parses to the correct UTC epoch (asserted under a non-UTC `TZ` so a
  local-time misparse fails); `endsAt` for the real row lands on `2026-08-17T07:43:57Z`; `remainingMinutes`
  across before / after / exactly-at `endsAt`; fallback to `minutes` when `capturedAt` is null; future
  `capturedAt` clamped; `NO_CHANGE_SLEEP` maps to a Polish phrase.
- **Component:** card counts down on a fixed injected clock; shows "zregenerowany" past `endsAt` with no sync;
  shows the frozen value plus "stan na …" when superseded by a later activity.
- **API integration (mock adapters):** `/api/insights` returns `capturedAt` / `endsAt` / `superseded` for a
  fixture carrying `timestamp`, and nulls plus `superseded: false` for one without — status + JSON contract.
- **Sidecar (pytest):** none — no sidecar change. The `conftest.py` readiness fixture gains `timestamp` /
  `timestampLocal` so it mirrors the real payload; likewise `dev-mock.ts`, whose readiness document currently
  has no capture instant at all.

## Closeout

Verified: web `2138 passed | 4 skipped`, sidecar `184 passed`, `svelte-check` `0 errors`.

- Commits:
- Notes / follow-ups:
  - **The countdown's own limit.** It is honest only against the timer Garmin last published. Between an
    activity and Garmin re-scoring, the card falls back to the frozen figure — correct, but it is the one
    window where the watch and the card can still disagree. Closing it would mean modelling Garmin's own
    recalculation, which is guesswork and deliberately not attempted.
  - **`markSuperseded` runs twice per request** — once for the engine ceiling in `insights.api.ts`, once
    inside `computeCondition`. Both derive it from the same two inputs so they cannot disagree, but if a
    third consumer appears the fact should be computed once and passed down.
  - **Pre-existing failure fixed in passing:** the spec 072 test *"says which day it is showing"* was
    already red on this branch before any 075 work — `textContent` carries the template's line break, so a
    literal `'Garmin Connect'` never matched. The assertion now collapses whitespace. Unrelated to this
    spec; fixed because it sat in the file being edited.
  - **`CHANGE_PHRASE` was dead code in production.** Every key in it (`RECOVERY_TIME_*`) was invented from
    the field name; the live account emits `NO_CHANGE_SLEEP`-style codes, so the phrase silently rendered
    as nothing since spec 059. The observed code plus four plausible siblings are now mapped — the
    siblings are inferred from Garmin's naming and should be confirmed against real payloads over time.
  - **`inputContext` / `feedbackLong` / `*FactorFeedback`** are in the live payload and unread. They carry
    Garmin's own prose reasons ("LOW_HRV_UNBALANCED", "AFTER_POST_EXERCISE_RESET") and could replace some
    of our derived clauses with Garmin's own wording. Not in scope here.
