# Spec 084 — Readiness as an absolute question, and a date for "100%"

- **Status:** Closed
- **Module:** `apps/web/src/modules/insights/`
- **Owner agent:** module-dev
- **Depends on:** 013, 022, 059, 070, 072, 075, 079

## Context

The start page carries two readiness numbers that disagreed by 13 points on 2026-08-17 — ours 52
(`moderate`), Garmin's 39 (`LOW`, `LOW_HRV_UNBALANCED`) — and the athlete asked why, given that Garmin's
own six factors are already in our store.

Investigating it surfaced something larger than a calibration gap: **our score answers a different
question than the one being asked of it.** `computeReadiness` (spec 013) is a *deviation index* — each
channel z-scored against its own last 30 days, so the number means "how do I compare with my own recent
normal". The question the athlete actually has, in their words, is *"jak bardzo jestem dzisiaj gotowy do
treningu, i kiedy będę gotowy na 100%"*. That is an **absolute** question, and a 30-day norm is not
merely unhelpful for it — it is actively misleading, because a month of training moves the norm instead
of the score. Spec 070 already documented this blind spot and patched the worst instance of it with a
recovery-time ceiling; this spec removes the cause rather than the symptom.

Nothing here needs new data. Every input is already synced and mostly already parsed.

## The evidence

The store's own last seven days (`get_metric_range training_readiness`, 11–17.08.2026):

| day | Garmin | recovery timer | acute load | HRV 7-day | ACWR% | Garmin's own limiter |
|---|---|---|---|---|---|---|
| 11.08 | 71 | 828 min | 261 | 107 | 83 | — |
| 12.08 | 74 | **1** (`REACHED_ZERO`) | 233 | 103 | 88 | HRV unbalanced |
| 13.08 | 50 | 968 | 310 | 102 | 73 | HRV |
| 14.08 | **1** | 3672 (61 h) | 467 | 103 | **36** | timer + load |
| 15.08 | 1 | 3055 | 398 | 98 | 50 | timer |
| 16.08 | 25 | 1788 | 430 | 100 | 43 | HRV |
| 17.08 | 39 | 1297 | 360 | **99** | 61 | **HRV** |

Three facts this settles.

**1. The HRV disagreement is a variable-and-window disagreement, and the window is in the payload.**
`hrvSummary` on 17.08 carries `lastNightAvg: 113`, `weeklyAvg: 99`, `status: "UNBALANCED"` and
`baseline: { lowUpper: 96, balancedLow: 102, balancedUpper: 133 }`. We read `lastNightAvg` (a good
night) and z-score it against our own 30-day mean → z = +0.20 → the channel scores ~53 and reads as
*fine*. Garmin reads the 7-day average (99) against a ~3-month balanced band starting at 102 → below
band → 57% and `LOW_HRV_UNBALANCED` on the whole score. **We do not have to guess Garmin's window: the
band is a field we already sync and currently read nowhere** (the only uses of `weeklyAvg` in the repo
are as a fallback key in `metric-specs.ts:64` and `dashboard.api.ts:95`; `balancedLow` is read nowhere
at all).

**2. A weighted mean cannot express this, and no smooth combination can.** Garmin's six factors on
14.08 were 68 / 71 / 73 / 19 / 36 / 60. Their arithmetic mean is 54.5 and their weighted geometric mean
49.3; Garmin answered **1**. Averaging is the wrong operator — one crushing input pins the score. Spec
070 reached this conclusion for recovery time and built a ceiling; 17.08 shows HRV needs the same
treatment, and 14.08 shows load does.

**3. "The timer hit zero" is not "I am at 100%".** On 12.08 the recovery clock reached zero
(`recoveryTimeFactorPercent: 99`, `recoveryTimeChangePhrase: "REACHED_ZERO"`) and Garmin still said 74,
because HRV was already out of band. Any honest answer to *"kiedy będę na 100%"* is therefore
two-layered: the hard instant the recovery debt clears, plus whatever else is still holding the score
down and what it needs.

## Requirements (acceptance criteria)

**The score becomes absolute**

- [x] `computeReadiness` no longer z-scores anything. Its channels are absolute 0–100 subscores.
- [x] Six channels, in reading order: sleep, sleep history, HRV, recovery, load, stress history — the
      same six Garmin reports, so the card's two numbers are finally built from the same inputs.
- [x] Five of them read Garmin's factor percentages straight from the stored payload. **Recovery is
      computed live** from the spec 075 countdown, not read from `recoveryTimeFactorPercent`: the factor
      is frozen at Garmin's capture instant while the real timer drains all day, and spec 075 exists
      precisely because a frozen countdown is a wrong countdown.
- [x] Every channel has a documented fallback computed from raw payloads, so the score survives a day
      or an account with no Training Readiness (see **Fallbacks** below). It degrades to fewer channels
      rather than to null.
- [x] The composite is a weighted mean **capped by every active limit**:
      `score = min(composite, ...ceilings)`. A ceiling only ever lowers the score (spec 070's rule,
      now general).
- [x] Ceilings: recovery (the spec 070 linear map on **live** remaining minutes), HRV (Garmin's HRV
      factor whenever `hrvSummary.status` is not balanced, or our own band position in fallback), load
      (Garmin's ACWR factor whenever its feedback is `POOR`).
- [x] `limitedBy` becomes a **list** — on 14.08 both the timer and the load were crushing, and naming
      one of them would have been half the truth.
- [x] `basisDays` is gone from the contract. It described the z-score baseline, which no longer exists.

**A date for "100%"**

- [x] The card answers *when* as well as *how much*: a `forecast` object beside the score.
- [x] `recoveredAt` is the exact instant the recovery timer reaches zero, from `RecoveryTime.endsAt`
      (spec 075). Null when the reading carries no capture instant or an activity has superseded it —
      never a guess.
- [x] Each active limit reports what it needs and when we expect it: `exact` for the timer,
      `projected` for HRV, `unknown` where we will not pretend.
- [x] The HRV projection is deterministic: `weeklyAvg` is a 7-night rolling mean and we hold every
      night's `lastNightAvg`, so the window is rolled forward assuming future nights equal the **median
      of the last three**, and the first day the mean reaches `balancedLow` is reported. The assumption
      is stated in the UI, not hidden. Capped at 14 days, `unknown` beyond it.
- [x] `fullyReadyAt` is the latest of the per-limit clearances, or null when any active limit is
      `unknown` — "we don't know" must never render as "today".
- [x] Load carries **no** projection in this spec (see follow-ups); its limit reports `unknown`.

**One number on the card**

- [x] The card leads with our score and shows Garmin's as a reference chip beside it, replacing the
      two-source toggle and its persisted `openvitals.condition.source` preference. Chasing which of
      two headline numbers is "the real one" is the confusion this spec exists to end.
- [x] Each channel is inspectable: its percent, and for a limiting channel the one fact behind it
      (e.g. `HRV 7 dni: 99 ms · pas 102–133`).
- [x] The "Skąd ta liczba" popover is rewritten: absolute inputs, the limiting rule, and the explicit
      statement that we are **not** trying to reproduce Garmin's number.
- [x] Labels are message keys in both `pl` and `en` (spec 076) — every string the readiness path renders,
      including the rewritten popover. `ConditionCard`'s pre-existing literals (sleep-stage names, the
      state badge) are untouched and remain a spec 076 debt of their own.
- [x] Readiness stays independent of the global `?range=` switch (spec 047) — the start page loader
      keeps its fixed `CONDITION_WINDOW_DAYS` read, which now serves only trends/anomalies.

**Always**

- [x] Unit + API-integration tests pass (no e2e).
- [x] Built only from `lib/ui` components + design tokens.
- [x] No secrets logged or committed.

## Explicit non-goal

**This spec does not try to make our number equal Garmin's.** The seven days above show Garmin's score
is neither a mean nor a clean function of its own published factors: min-factor 64 produced 74 on 12.08
while min-factor 63 produced 50 on 13.08. Fitting a black box would give a number nobody can explain and
that breaks whenever Garmin retunes. The goal is that our score is built from **the same inputs**, moves
for **the same reasons**, and can be read line by line — never that it lands on 39.

Projected series under the model above (composite = equal-weighted mean of available factors, recovery
channel from the live timer), against Garmin's:

| day | ours | Garmin | binding ceiling |
|---|---|---|---|
| 11.08 | 81 | 71 | recovery (828 min → 81) |
| 12.08 | 64 | 74 | HRV (unbalanced → 64) |
| 13.08 | 63 | 50 | HRV (63) |
| 14.08 | **15** | 1 | load POOR (36) and recovery (61 h → 15) |
| 15.08 | 29 | 1 | recovery (3055 min → 29) |
| 16.08 | 59 | 25 | HRV (60) |
| 17.08 | **57** | 39 | HRV (57) |

Same shape, same drivers, consistently less spiky. The acceptance criterion is that no input can be
diluted away — not the residual.

## API contract

No new HTTP endpoint. `modules/insights/insights.types.ts`:

```
ReadinessDriver
  - z: number                      removed (no z-scores left)
  - direction: 'up' | 'down'       removed
  + percent: number                the channel's absolute 0–100 subscore
  + source: 'garmin' | 'derived'   whether it came from Garmin's factor or our fallback
  + detail: string | null          the one fact behind it, e.g. "99 ms · pas 102–133"

ReadinessLimit
  - key: 'recovery'                → key: 'recovery' | 'hrv' | 'load'
  - minutes: number                → minutes?: number   (recovery only)
  + ceiling: number                the cap this limit imposed
  + clearsAt: number | null        epoch ms, exact instant (recovery only)
  + clearsOn: DayKey | null        projected day
  + confidence: 'exact' | 'projected' | 'unknown'

Readiness
  - basisDays: number              removed
  - limitedBy: ReadinessLimit | null   → limitedBy: ReadinessLimit[]   (empty when nothing caps)
  + composite: number              the uncapped weighted mean
  + forecast: ReadinessForecast

ReadinessForecast { recoveredAt: number | null; fullyReadyAt: DayKey | null; limits: ReadinessLimit[] }
```

MCP `get_readiness` returns the new shape; its description changes from "computed over a rolling window
(default 30 days)" to an absolute-inputs wording, and its `window` argument is dropped — the score no
longer has a window. `get_insights` keeps `window` (trends, anomalies and correlations still use it).
`get_training_readiness` is untouched: it is Garmin's raw payload and stays that way.

## UI

`Card`, `StatTile`, `Badge`, `InfoPopover`, `ReadinessGauge` (rewritten channel chips),
`GarminReadinessGauge` (demoted to the reference chip). `SegmentedControl` leaves the card with the
source toggle.

States:
- **Full** — score, band badge, six channel chips, `fullyReadyAt` line, Garmin reference chip.
- **No Training Readiness** — fallback channels only; the `source: 'derived'` chips say so; no reference
  chip; the forecast degrades to whatever the fallbacks can project.
- **Stale reading** (spec 072) — the day is named first, as now; the live countdown still runs where
  spec 075 allows it.
- **Superseded timer** (spec 075) — no `recoveredAt`, no `fullyReadyAt`; the card says a session has
  happened since Garmin last scored.
- **Too little data** — fewer than two channels → null readiness, and the card falls back to the
  channel-direction sentence it already has.

Light + dark from tokens only.

## Design / implementation notes

**Fallbacks per channel** (used when Garmin's factor is absent):

| channel | Garmin factor | fallback |
|---|---|---|
| sleep | `sleepScoreFactorPercent` | `dailySleepDTO.sleepScores.overall.value`, else duration vs a documented target |
| sleep history | `sleepHistoryFactorPercent` | 7-night mean sleep score |
| HRV | `hrvFactorPercent` | position of `hrvSummary.weeklyAvg` in `baseline.balancedLow…balancedUpper` |
| recovery | *never used* | the live spec 075 countdown through spec 070's linear map — this IS the primary |
| load | `acwrFactorPercent` | 7-day ÷ 28-day load ratio from spec 079's load series |
| stress history | `stressHistoryFactorPercent` | 7-day mean of the stress metric, inverted |

**Ports & adapters.** No new dependency. The engine stays pure — no `Date`, no I/O; `nowMs` is passed
in from the injected clock exactly as spec 075 established, and the HRV projection takes the nightly
series as an argument rather than fetching it.

**Payload trust (AGENTS.md §10).** Every factor optional, camelCase first with snake_case fallback,
non-finite treated as a gap, out-of-range (`<0`, `>100`) rejected rather than clamped. An `hrvSummary`
with a `balancedLow` above its `balancedUpper` is discarded, not sorted.

**What keeps the 30-day window.** Trends, anomalies and correlations are unchanged — deviation from a
recent norm is the right question *there*. The per-metric "vs Twoja norma" deltas on the condition
channels already come from `buildConditionMetric`, which is independent of `computeReadiness`, so they
survive untouched. After this change nothing in the app z-scores a metric to produce a *headline score*.

**Edge cases.** A recovery timer of 0 must not cap anything (spec 070's `minutes <= 0 → 100` holds). A
future-dated payload (clock skew) is treated as current, per `stalenessOf`. An HRV projection whose
median-of-three is itself below `balancedLow` returns `unknown` rather than a date years out.

## Test plan

- **Unit** (`insights.engine.test.ts`): each channel from a Garmin factor and from its fallback; a
  missing factor dropping a channel without nulling the score; the composite; each ceiling in isolation;
  two ceilings at once (the 14.08 payload → 15, `limitedBy` naming both); a ceiling never raising a
  score; a zero timer imposing none; fewer than two channels → null.
- **Unit** (`insights.forecast.test.ts`): `recoveredAt` from `endsAt`; null when superseded or with no
  capture instant; the HRV roll-forward clearing on the expected day; `unknown` past 14 days;
  `fullyReadyAt` = latest clearance; `fullyReadyAt` null when any limit is `unknown`.
- **Unit** (`insights.garmin-readiness.test.ts`): the `hrvSummary.baseline` parser, including the
  inverted-band and out-of-range rejections.
- **Regression**: the exact 17.08 payloads (`training_readiness` + `hrv`) pinned — score 57, HRV the
  binding ceiling, `recoveredAt` = 18.08 02:42 UTC — so the number this spec was written to fix can
  never silently return to 52.
- **API integration** (`insights.api.test.ts`, mock adapters): the new `Readiness` shape end to end;
  an account with no Training Readiness getting derived channels; status + JSON contract.
- **MCP** (`tools.test.ts`): `get_readiness` without a `window` argument, new shape.
- **Component** (`ConditionCard.svelte.test.ts`): one headline plus reference chip, no source toggle,
  the `fullyReadyAt` line, the derived-channel and superseded states.

## Closeout

Verified: web `2443 passed | 6 skipped` (188/188 files), `svelte-check` `0 errors`, `vite build` +
`build:mcp` clean, `prettier --check` clean. No Python changed, so the sidecar suite is out of scope.

- Numbered **084**, not 080. It was drafted as 080 against a working tree that did not yet show
  `specs/080-check-in-redesign.md`; the collision surfaced at commit time and every in-code `spec 080`
  reference was renumbered with it. The journal spec keeps 080.
- Commits:

### What the implementation changed about the plan

- **Readiness moved to its own module.** The plan kept `computeReadiness` in `insights.engine.ts`; it
  now lives in `insights.readiness.ts` with `insights.forecast.ts` beside it, and the engine keeps only
  the three window-based statistics. The two no longer share an input, a window or a helper, and
  `computeInsights` takes the finished `Readiness` rather than deriving one. Tests followed the code
  into `insights.readiness.test.ts` / `insights.forecast.test.ts`.
- **`forecast.limits` became a superset of `limitedBy`.** Not in the plan, and needed: on 17.08 the
  21-hour timer capped nothing under a composite of 67 yet still postponed "100%" until the next
  morning. `limitedBy` explains the NUMBER, `forecast.limits` explains the DATE.
- **`MAX_PROJECTION_DAYS` is a terminating guard, not a reachable limit.** Since the projection only
  runs when the assumed nightly value is at or above the floor, the window mean reaches it within
  `hrvWindowNights` days by construction. Documented as such rather than tested as if it bit.
- **The MCP surface now reuses `loadInsights` instead of a trimmed copy.** Its old private
  `insightsForWindow` fetched series and called the engine — fine while readiness was four z-scores,
  and guaranteed to drift the moment the score needed Garmin’s factors and a live timer. This also
  narrowed `InsightsDeps.clock` from `Clock` to `NowSource`, which is all the loader ever used and what
  `ToolContext` carries.

### Known consequences worth watching

- **The HRV projection refuses more often than it answers, by design.** It needs the median of the last
  three nights at or above `balancedLow`; one good night inside a depressed week (exactly the 17.08
  shape) yields `unknown`, and `fullyReadyAt` goes null with it. That is the honest answer, but it means
  the "kiedy na 100%" line will often read "nie umiemy jeszcze powiedzieć" precisely when the athlete
  most wants a date. If that proves too conservative in use, the assumption — not the machinery — is the
  dial to turn, and it is one constant (`ASSUMPTION_NIGHTS`) plus its refusal test.
- **Load has no projection**, so any day Garmin calls the load `POOR` produces a null `fullyReadyAt`
  regardless of everything else. Spec 079’s load series makes this computable; it is the first
  follow-up.

### Follow-ups

- **Load projection** from spec 079’s load series: 7-day load decays predictably if nothing is added,
  which turns the load limit from `unknown` into `projected` and makes `fullyReadyAt` answerable on days
  like 14.08.
- **`fmtRecovery` still writes Polish literals** (`gotowy`, `dni`) despite spec 076. Out of scope here,
  but it is now the only Polish left in the readiness path.
- **`ReadinessCard` on `/insights`** renders the same gauge and was not re-examined for the new
  channel/limit blocks at `md` size.
- The `openvitals.condition.source` preference is removed, not migrated — a stale value simply stops
  being read.
