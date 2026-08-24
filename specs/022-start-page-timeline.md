# Spec 022 — Start page: timeline + condition/regeneration panel

- **Status:** Approved <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/timeline/` (+ `apps/web/src/modules/insights/`)
- **Owner agent:** module-dev
- **Depends on:** 013 (insights), 014 (tiers), 015 (local data store), 018 (date/timezone), 020 (sport labels), 021 (settings consolidation)

## Context

After spec 021 stripped the connection/MCP cards off `/`, the start page answered "what are today's
numbers?" and nothing else. The user asked for two things it could not answer:

1. **"What happened to me lately, and what's next?"** — a _timeline_ (explicitly **not** a calendar):
   the most consequential events of the last 14 days — activities, health anomalies, milestones —
   merged into one stream, plus what is scheduled for the next 7 days.
2. **"How am I right now?"** — last night's sleep, current condition, and where regeneration stands,
   in one prominent block instead of a bare readiness score.

The start page now reads top-to-bottom as: **alerts → how am I right now → what just happened /
what's coming → today's numbers.**

## Requirements (acceptance criteria)

- [x] New vertical slice `modules/timeline/` owns `timeline.types.ts`, `timeline.events.ts` (pure
      engine), `timeline.api.ts` (pure handler over injected deps), `TimelineView.svelte`,
      `TimelineEventRow.svelte` and its tests; `routes/+page.server.ts` stays thin wiring.
- [x] The backwards half covers the **last 14 days** as ONE event stream, newest-first, grouped by
      day on a single rail — not a calendar grid.
- [x] Events merge **activities** (name, sport, distance/duration, the headline metric for that
      sport), **health signals** from the insights engine (poor sleep, elevated RHR, HRV drop, high
      stress, body-battery crash) and **milestones** (distance/duration record per sport family,
      first activity of a new sport, a streak hitting a round number).
- [x] The event model is a **discriminated union** on `kind` — adding a kind is one interface + one
      union member; every `switch` on `kind` fails to compile until it handles the new case.
- [x] Events are **ranked by importance, not recency**: a routine easy walk cannot displace an HRV
      anomaly. The collapsed view shows the top `limit` (default 8) by importance, rendered in
      chronological order; a real `<button aria-expanded>` reveals the full window from the same
      payload (no second request).
- [x] The forward half exposes a `PlannedEvent[]` contract and returns **empty** today, with a
      truthful Polish empty state that says planned workouts are not synced yet. **No fabricated,
      inferred or mocked plans.**
- [x] `PlannedStatus` distinguishes `not_synced` (no source / calendar unreadable) from `empty`
      (calendar read, nothing scheduled) from `ok` — three different, true messages.
- [x] A condition/regeneration block covers last night's sleep (duration, efficiency, stages,
      score, bed/wake times), readiness, body battery, HRV, resting HR and stress against their own
      baselines, plus a one-line plain-Polish interpretation.
- [x] `ReadinessCard` is **absorbed**, not duplicated: `/` renders one `ConditionCard` containing the
      shared `ReadinessGauge`; no two overlapping condition cards on the same page.
- [x] Insights are reused, not recomputed — the condition snapshot rides on the series
      `loadInsights` already fetched (zero extra store reads).
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens (if UI)
- [x] No secrets logged or committed

## API contract

Types live in `modules/timeline/timeline.types.ts` and `modules/insights/insights.types.ts`.

```
loadTimeline(deps, req) -> TimelineData          (modules/timeline/timeline.api.ts)

  deps: { store: LocalStore, clock: Clock, timeZone?: string, plannedWorkouts?: PlannedWorkoutSource }
  req : { userId, signals?: HealthSignalInput[], pastDays?=14, futureDays?=7, limit?=8, today? }

  TimelineData {
    today: DayKey
    past: { from, to, events: TimelineEvent[], primaryCount, totalCount }   // newest first
    planned: { from, to, status: 'not_synced'|'empty'|'ok', events: PlannedEvent[] }
  }

  TimelineEvent = TimelineActivityEvent | TimelineHealthEvent | TimelineMilestoneEvent
    common: id, kind, day, time, title, detail, stats[], icon, accent, importance, primary, href
    activity : + activityId, sport, group, distanceM, durationS
    health   : + metric, signal, severity, direction, value, z, favourable
    milestone: + milestone, activityId
```

`req.signals` is structurally satisfied by `InsightsData.anomalies`; the timeline declares its own
`HealthSignalInput` so it never reaches into another module's folder (AGENTS.md §5).

Extension to the insights payload:

```
GET /api/insights?window=…   res: InsightsData { …, condition: ConditionSnapshot | null }

  ConditionSnapshot {
    day, readiness, sleep: SleepNight|null, sleepTrend: ConditionMetric|null,
    channels: ConditionMetric[],           // body_battery, hrv, resting_heart_rate, stress
    state: 'rested'|'steady'|'strained'|'unknown',
    summary: string                        // one plain-Polish sentence, never medical advice
  }
```

`condition` is `null` when not connected / not consented / no data. No route contract changed.

### Planned workouts — the data gap (handoff)

**Nothing in this repo fetches Garmin's planned workouts today.** `services/garmin/app/main.py`
exposes `/status`, `/login`, `/metrics/{name}`, `/metrics/{name}/range`, `/activities`,
`/activities/{id}/details`, `/weight/range`, `/session` — there is no `/workout-service/` or
`/calendar-service/` call. So the forward half ships **empty and honest**: `status: 'not_synced'`
plus copy that says planned workouts are not synced yet. We deliberately do **not** predict a plan
from training history — a fabricated plan is worse than a blank.

To fill it, the sidecar work must satisfy exactly this seam — **no UI change required**:

1. **Sidecar** — `GET /workouts/planned?start=YYYY-MM-DD&end=YYYY-MM-DD` returning
   ```jsonc
   { "start": "…", "end": "…", "available": true,
     "events": [{ "id": "…", "day": "YYYY-MM-DD", "time": "HH:MM"|null,
                  "kind": "workout"|"race"|"note", "title": "…",
                  "sport": "running"|null, "description": "…"|null,
                  "estimatedDurationS": 3600|null, "estimatedDistanceM": 12000|null,
                  "targetLoad": 95|null }] }
   ```
   `available: false` means Garmin's calendar service served nothing usable — **not** "no plans".
   Local day keys, already in the wearer's calendar; `sport` is a Garmin `typeKey` so `sportLabel()`
   renders it like every other sport.
2. **Store** — a `synced_planned_events` table plus a _replace-window_ write (a plan the user
   deleted in Garmin must disappear here, which an upsert-only write never does) and a read
   `listPlannedEvents(userId, from, to)`.
3. **Web** — an adapter implementing `PlannedWorkoutSource`:
   ```ts
   listPlanned(userId, from, to): Promise<{ available: boolean; events: readonly PlannedEvent[] }>
   ```
   injected into `loadTimeline`'s deps from `routes/+page.server.ts`. `PlannedEvent.source` reuses
   the store's `DataSource` union (`'garmin'`), so a synced row maps across 1:1.

`loadTimeline` then reports `ok`/`empty` on its own and `TimelineView` renders the plans — the
"renders real plans the moment the contract is filled" test already proves this path today with a
mock source. Spec 024 (in flight) is landing steps 1–2; only step 3 remains after it.

## UI

`lib/ui` only: `Card`, `Badge`, `Button`, `Skeleton`, plus two new shared components.

- **New `lib/ui/icons.ts` + `Icon.svelte`** — the app's one icon vocabulary: 19 authored glyphs on a
  24×24 grid, `fill:none / stroke:currentColor / 1.6 / round`, matching the inline SVGs already in
  the app. Data-only glyph table (no `{@html}`), decorative by default, `role="img"` + label when an
  icon carries meaning alone. Replaces the emoji-as-icon temptation: emoji ignore `currentColor`,
  render per-platform and cannot sit on the type scale.
- **New `lib/ui/StackedBar.svelte`** — one track split into proportional token-coloured slices with
  a legend; used for sleep stages, reusable for HR zones / sport mix. Zero-value segments dropped;
  the whole composition is one accessible name.
- **`modules/insights/ReadinessGauge.svelte`** — the readiness readout extracted out of
  `ReadinessCard` so `/insights` and `/` render the same gauge instead of two drifting copies.
- **`modules/insights/ConditionCard.svelte`** — one card, hairline rules, **no nested cards**: hero
  (score + one-line interpretation) → last night (big duration, `icon + big value + micro-caps
label` clusters for score/efficiency/bedtime/wake, stage bar) → recovery channels (dense
  auto-fit grid, each vs its own baseline, coloured by whether the move was _healthy_ rather than by
  sign).
- **`modules/timeline/TimelineView.svelte`** — a single hairline rail; day markers ("dziś",
  "wczoraj", "wt., 4 sie" via `$lib/date`); one `TimelineEventRow` per event with a lane-coloured
  node, glyph tile, title, detail and micro readouts. Forward half below a rule.

States: loading (skeletons) · not connected (CTA to `/settings`) · consent off (`ConsentPanel`
snippet) · no data · empty window (teaching copy) · planned not-synced / empty / ok · collapsed vs
expanded. Light + dark come from tokens only; no raw hex, no magic px. Icons and rails are
`currentColor`/token driven, so both themes work without per-component theming.

## Design / implementation notes

- **Ports & adapters.** `loadTimeline` takes `LocalStore`, `Clock`, an optional `timeZone` and an
  optional `PlannedWorkoutSource`. No `fetch`, no `Date.now()`, no `process.env`, no sidecar call —
  the timeline reads the local synced store only (spec 015).
- **Dates** go through `$lib/date` (spec 018): `todayKey(clock, timeZone)`, `addDays`, `compareDays`,
  `daysBetween`, `formatDay`. Nothing hand-rolls a Polish month table or resolves "today" in UTC.
- **Sports** go through `$lib/sport-labels` (spec 020): `sportLabel`/`sportGroup` only.
- **Two orderings, never confused.** `importance` decides _which_ events survive the cap;
  chronology decides the _order on screen_. A feed sorted by score is a leaderboard, not a timeline.
  Tuning constants live in one documented `IMPORTANCE` table; `walk` carries a negative family
  weight, which is literally the "an easy walk must not crowd out an HRV anomaly" rule.
- **Milestones need full history** ("first ever", "longest ever"), so one `listActivities` read
  serves both the window and the records, capped at `MAX_HISTORY = 20_000`. Records require ≥3 prior
  activities in that sport family and a new sport requires ≥5 activities overall, so a new user is
  not congratulated for existing. One activity never stacks two trophies.
- **Condition reuses the insights fetch.** `fetchSeries` now carries the RAW day payloads beside the
  extracted scalars (`ConditionSeries` is a superset of the engine's `MetricSeriesInput`), because
  sleep stages and bed/wake timestamps are thrown away by the per-metric scalar. Zero extra reads.
- **Garmin `*TimestampLocal` fields** are epoch ms with the wearer's offset already folded in, so
  they are read **in UTC** to recover the wall clock. Formatting them in a real zone would shift the
  number — documented at the call site.
- **Sleep efficiency** is only computed when both timestamps support it, and a >100% result is
  rejected as an inconsistent payload rather than reported.
- **Untrusted input:** health signals are structurally validated (`isUsableSignal`), planned events
  are filtered to real day keys inside the window, and `pastDays`/`futureDays`/`limit`/`today` are
  clamped or ignored rather than trusted.
- **Per-user isolation:** every store read is scoped by `userId`; a test asserts one user never sees
  another's activities.
- **Edge cases:** brand-new user (shaped-but-empty payload), sidecar down (insights degrade to no
  anomalies, timeline still renders activities), partial sleep payload (fields degrade one by one,
  no dashes printed for absent readouts), no readiness (condition falls back to counting channel
  moves), late-evening local/UTC day boundary (covered by a test).

## Test plan

- **Unit — `timeline.events.test.ts` (28):** distance/duration/time formatting; per-sport headline
  stats (run pace, ride power with speed fallback, swim /100 m, ≤3 readouts); importance ordering
  (anomaly > easy walk, strong > moderate, duration/load scaling and caps); window filtering; title
  fallbacks; signal classification per metric+direction; favourability by `goodWhen`; rejection of
  malformed signals; milestone detection (record with/without enough history, no double trophy, new
  sport, streak lengths and round-number rule); ranking (chronological render, importance-based
  cap, full payload retained, health-before-activity tiebreak).
- **Unit — `insights.condition.test.ts` (20):** sleep extraction off the real nested payload
  (stages, score, local bed/wake), newest-day-with-data selection, field-by-field degradation;
  efficiency maths and its refusals; channel baselines excluding the latest reading, unfavourable
  rises in lower-is-better metrics, flat band, single reading, bounded sparkline series; recovery
  state from band and from channel fallback; Polish summary composition; shared formatters.
- **API integration (mock adapters) — `timeline.api.test.ts` (14):** in-memory `LocalStore`, fixed
  clock, stub `PlannedWorkoutSource`. Asserts the JSON contract: empty-but-shaped payload, 14/7 day
  spans, merged newest-first stream, out-of-window activities still feeding records, importance cap
  vs full stream, **per-user isolation**, `not_synced` / `empty` / `ok` / unreadable-calendar
  planned states, out-of-window plan filtering, clamped window+limit, pinned/malformed `today`, and
  local-vs-UTC day resolution.
- **API integration — `insights.api.test.ts` (extended):** `condition` is null when not connected,
  and fully populated once consented (sleep day/stages/score/bed/wake, efficiency > 0, the four
  channels in order, a valid state and a terminated sentence).
- **Component — `TimelineView.svelte.test.ts` (9):** day grouping and labels, collapse/expand with
  `aria-expanded`, no expander when nothing is hidden, event links + readouts, the three planned
  states (including "renders real plans the moment the contract is filled"), empty window, and the
  not-connected / consent-off states.
- **Component — `ConditionCard.svelte.test.ts` (7):** the whole block in one render, sleep stat
  cluster labels/values, accessible stage summary, health-aware delta colouring, omission of
  unsupported readouts, readiness-less rendering, and loading/not-connected/consent-off states.
- **Component — `Icon.svelte.test.ts` (5) / `StackedBar.svelte.test.ts` (6):** every glyph draws on
  the same grid with the same stroke construction; decorative vs named a11y; proportional slice
  widths; accessible composition summary; zero-segment and no-data behaviour.
- **Route — `home-payload.test.ts` (extended):** the start page payload carries the timeline with an
  honestly-empty forward half, and the container proxy still fails the test if the page reaches for
  anything beyond `clock`/`config`/`store`.
- **Sidecar (pytest):** N/A here — the planned-workout endpoint is spec 024's.

## Closeout

- Commits: _pending (handed to qa-closer)_
- Notes / follow-ups:
  - **Planned workouts are the one open gap** and are deliberately empty; see "Planned workouts —
    the data gap" above for the exact three-step contract. Spec 024 is landing the sidecar +
    store halves; the remaining web-side work is one adapter injected into `loadTimeline`'s deps.
  - `ReadinessCard.svelte` is retained for `/insights` (readiness alone is the point there) and now
    delegates to the shared `ReadinessGauge`. `/` renders `ConditionCard` instead — one condition
    block per page, no overlap.
  - `MAX_HISTORY = 20_000` bounds the milestone history scan. If an account ever approaches it, the
    right fix is a dedicated per-sport records query in the store, not a bigger constant.
  - Milestone thresholds (≥3 prior in family, ≥5 activities overall, streaks at multiples of 7/10)
    and the `IMPORTANCE` table are deliberately tunable in one place; they encode taste, not truth.
