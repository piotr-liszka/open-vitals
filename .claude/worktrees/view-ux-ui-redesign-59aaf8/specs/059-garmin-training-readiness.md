# Spec 059 — Garmin's own Training Readiness (+ recovery time), switchable against ours

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `services/garmin/`, `apps/web/src/modules/insights/`, `apps/web/src/lib/{ui,server}`
- **Owner agent:** module-dev (with garmin-integrator for the sidecar half)
- **Depends on:** 013 (insights engine), 015 (local store), 022 (condition card), 052 (battery 24 h)

## Context

The start page's **Regeneracja** card leads with a 0–100 number that users read as *the* readiness
score. It is not Garmin's. It is our own composite (`insights.engine.ts`): a weighted blend of four
z-scores — Body Battery 0.30, sleep 0.30, HRV 0.25, resting HR 0.15 — each measured against that
metric's own mean over the last 30 days. The arithmetic is correct and was verified against live
data (12 + 15 + 8 + 5 = 40, from z = −0.67 / +0.07 / −1.32 / +1.13), but it answers a *different
question* than Garmin's Training Readiness, which on the same morning read **1/100**.

The gap is structural, not a bug. Garmin's score also carries recovery time, acute load and ACWR,
sleep history and stress history; a big overdue recovery timer can floor it while every one of our
four channels sits merely a little below its own average. Two numbers, both defensible, wildly
apart — and the card showed only ours, unlabelled, with no way to see how it was made.

garmy ships a `training_readiness` accessor
(`/metrics-service/metrics/trainingreadiness/{date}`) carrying `score`, `level`, per-factor
percentages **and `recoveryTime` in hours** — the "recovery" readout this card never had. The
sidecar simply never asked for it.

This spec pulls Garmin's own numbers through the full slice (sidecar → adapter → sync → store →
card), lets the reader **switch** which score leads, and makes both explain themselves.

## Requirements (acceptance criteria)

**Data**

- [x] The sidecar serves `training_readiness` from `GET /metrics/{name}` and the range endpoint,
      like any other daily metric
- [x] Garmin returns this metric as a **single-item list**; the sidecar unwraps it to one object per
      day, so the web tier sees the same shape as every other metric
- [x] An account or device with no Training Readiness yields an empty day (a gap), never an
      exception and never an invented score
- [x] `training_readiness` is a first-class `GarminMetricName`: synced daily, stored per day, and
      readable through `getMetricRange` / MCP like the rest

**Card**

- [x] The card can show **either** source, switched in one click: Garmin's Training Readiness or our
      own baseline composite
- [x] The choice is remembered per device (`lib/ui/pref.ts`), defaults to Garmin when its data
      exists and silently falls back to our composite when it does not
- [x] Whichever source leads, the card names it — no unlabelled 0–100 number
- [x] Garmin's readout shows score, level (Polish), and its own contributing factors as percentages;
      it never renders Garmin's raw feedback codes as if they were prose
- [x] A **recovery time** readout shows the hours Garmin says remain until full recovery, its change
      phrase when present, and reads "gotowy" at zero — it is Garmin's figure and is shown in both
      modes
- [x] An info popover (`?`) states, for the mode on screen: what is being measured, which inputs
      feed it with their weights, the 0–100 range, and that this is a wellness signal, not medical
      advice
- [x] The summary sentence sits **under** the score block, not in a column beside it
- [x] With Garmin data absent the card degrades to our composite plus a one-line note, and the
      toggle explains why the Garmin side is unavailable

**Always**

- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

```
# sidecar (internal only) — no new route; the metric joins the existing ones
GET /metrics/training_readiness?date=YYYY-MM-DD          X-User-Id: <uid>
  res 200: { metric, date, data: { score, level, recoveryTime, … } | null }
GET /metrics/training_readiness/range?start=&end=        X-User-Id: <uid>
  res 200: { metric, start, end, days: [{ date, data }] }
```

Payload keys used downstream (Garmin camelCase, all optional except `score`):
`score`, `level`, `feedbackShort`, `calendarDate`, `sleepScore`, `sleepScoreFactorPercent`,
`sleepHistoryFactorPercent`, `hrvFactorPercent`, `hrvWeeklyAverage`, `recoveryTime`,
`recoveryTimeFactorPercent`, `recoveryTimeChangePhrase`, `acwrFactorPercent`, `acuteLoad`,
`stressHistoryFactorPercent`.

Web contract (`insights.types.ts`) — `ConditionSnapshot` gains:

```ts
garmin: GarminReadiness | null;   // Garmin's own score for the newest day that has one
recovery: RecoveryTime | null;    // hours remaining, change phrase, source day
```

## UI

`Card`, `Badge`, `SegmentedControl` (source switch), `Icon`, `IconButton`, `StatTile`-style
readouts, `TrendChart` (unchanged battery block), plus a **new `lib/ui/InfoPopover.svelte`** — the
first reusable "explain this number" affordance in the design system, so the next card that needs
one does not invent it.

States: loading (skeleton, unchanged) · not connected · consent off · no data at all · Garmin
missing (composite + note, switch disabled with reason) · both present (switch live). Light + dark
via tokens only.

## Design / implementation notes

- The sidecar unwraps the list in `_get_training_readiness`, mirroring the existing per-metric
  seams (`_get_steps` → daily summary). One place to fix if Garmin's shape changes.
- The web parser is defensive in the house style: camelCase first, snake_case second, every field
  optional, a non-finite value is a gap. Garmin payloads are untrusted data (AGENTS.md §10).
- `training_readiness` gets a `MetricSpec` (score as its daily scalar) so the metrics dashboard,
  charts and MCP get it for free; it is deliberately **not** added to `readinessWeights` — feeding
  Garmin's composite into ours would double-count and make our number un-explainable.
- Recovery time is Garmin's alone; when Garmin has no day, the readout is absent rather than
  estimated by us.
- The score the card shows is chosen client-side from data always carrying both, so switching costs
  no round-trip.

## Test plan

- **Unit:** payload parsing (list-wrapped, camel/snake, missing fields, junk); recovery formatting
  (0 h → "gotowy", 34 h, null); source resolution (Garmin present/absent × stored preference);
  `computeCondition` filling `garmin`/`recovery`.
- **Component:** the card renders both modes, switches between them, labels the active source, and
  falls back with a note when Garmin is missing.
- **API integration (mock adapters):** `loadInsights` returns `condition.garmin` and
  `condition.recovery` from mock range data; absent metric → both null, everything else unchanged.
- **Sidecar (pytest):** `training_readiness` is in `SUPPORTED_METRICS`; a single-item list unwraps
  to a dict; an empty list yields no data; the range path shapes days as usual.

## Closeout

- Commits: `259a64e` — feat(insights): Garmin's own Training Readiness + recovery time, switchable
- Verified: `pnpm run verify` green (1795 tests, svelte-check 0 errors, build OK); `pytest` green
  (179), both re-run after rebasing onto `main` at 955bb95 (spec 058). Checked by hand in the dev stack (`GARMIN_ADAPTER=mock`): both sources render, the switch
  persists, the recovery timer shows, light + dark and mobile hold up.
- Notes / follow-ups:
  - The *shape* of Garmin's payload is verified against garmy 2.0.0's `training_readiness` module
    and its documented endpoint; it has **not** yet been seen against the real account, because the
    sidecar only runs on the NAS. First sync after deploy is the real test — if Garmin serves
    nothing, the card silently keeps leading with our composite, which is the designed fallback.
  - `training_readiness` now has a `MetricSpec`, so it also appears as a tile/chart on the metrics
    dashboard. That is intentional (a readiness trend is worth having) but was not asked for; drop
    the spec entry if it clutters that page.
  - Our composite remains as it was. If it should converge on Garmin's answer rather than sit beside
    it, that is a separate change — it would mean adding recovery time and training load as
    contributors, which needs its own spec.
