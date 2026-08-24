# Spec 044 — Intensity mix: is the easy training actually easy?

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/server/analytics/intensity-mix.ts` + `modules/training/`
- **Owner agent:** module-dev
- **Depends on:** 025 (training overview), 039 (load risk card alongside it)

## Context

The training page says how much the athlete trained and, since spec 039, how fast that is rising. It
cannot say how much of it was **easy** — which is the question behind the most repeated piece of
endurance advice there is: roughly 80% of training time should be comfortably aerobic, and most
self-coached athletes do far less than that, in a very predictable direction. Their easy sessions creep
up in pace and their hard sessions stop being hard.

Garmin gestures at this with Training Load Focus. Strava does not address it at all. And the whole
answer is available from summary data we already sync.

## Requirements (acceptance criteria)

- [x] A pure `lib/server/analytics/intensity-mix.ts` exports `bandFor` and `intensityMix`. No store, no
      clock, no Garmin.
- [x] A session is classified by its **average heart rate** as a fraction of the athlete's max: easy below
      80%, hard at or above 87%, moderate between. Boundaries belong to the harder band.
- [x] The result always carries all three bands, so a chart never changes shape, with time, session count
      and summed training load per band.
- [x] Without a max heart rate the result is `unknown` with an explanation, **not** an age-based guess — we
      hold no birth date, and 220−age is a poor estimate regardless.
- [x] A session with no average heart rate is `unclassified`, never folded into `easy`, and shares are of
      **classified** time — otherwise every strapless session would read as a shortfall in easy training.
- [x] Each verdict carries a Polish sentence naming what it implies, including the specific and common
      failure mode ("your easy runs are not easy") rather than a generic warning.
- [x] `too-easy` fires only at a wide margin (>95%), because 85% easy is a perfectly good week and being
      scolded for it would make the whole card untrustworthy.
- [x] The training page renders the mix with a `StackedBar`, the headline easy share, per-band detail, the
      advice, and the two caveats that change interpretation: shares are of classified time, and a band
      comes from an average so an interval session lands in the middle.
- [x] Max HR resolution matches the running page's (setting, else the highest observed), so the two pages
      cannot disagree about the athlete's ceiling.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No new endpoint. `TrainingOverviewData` gains:

```ts
readonly intensityMix: IntensityMix;
// { bands: BandShare[], easyPct, unclassifiedSessions, classifiedSessions, verdict, advice, maxHr }
```

## UI

`IntensityMixCard.svelte` from `Card` + `Badge` + `StackedBar` + tokens, under the load-risk card. With no
max HR: the explanation alone, no bar and no band list.

## Design / implementation notes

- **Average HR, not zone streams**, deliberately. Zone streams would be more precise per session and would
  cost a stream read per activity — and would still land an interval session in the middle, because the
  metric answers "is my easy training easy?" at the weekly scale rather than "what was this session made
  of?". The trade-off is stated in the engine header AND on the card.
- The window matches the volume window already on the page, so the mix describes the same period the
  charts above it do.

## Test plan

- **Unit (`intensity-mix.test.ts`):** band thresholds and boundary ownership; the three-band split and its
  shares; per-band load; each verdict including the wide `too-easy` margin and the 85%-is-fine case; the
  no-max-HR and nonsensical-max-HR refusals; a strapless session counted as unclassified with shares still
  out of classified time; a session with no duration; an empty athlete; unusable heart rates.
- **API integration (`training.api.test.ts`):** the split against an explicit max HR, the observed-max
  fallback, `unknown` with no heart rate anywhere, strapless sessions excluded, and the window boundary.
- **Unit (`IntensityMixCard.svelte.test.ts`):** the explained-absence path, the headline, each verdict and
  its advice, the band list with inflection, the skipped-session count, and both caveats.

## Closeout

- Commits: `6911cd9` — feat(training): intensity mix — is the easy training actually easy? (spec 044)
- Notes / follow-ups:
  - The natural refinement is zone-stream classification for sessions that have one, falling back to the
    average otherwise — better per session, and it would let an interval session be described honestly.
    It needs the batched stream read the running page already does, so it is cheap to add per sport page
    but not across every sport at once.
  - The thresholds (80% / 87%) are a common convention, not this athlete's measured thresholds. Once a
    lactate threshold or the spec 042 critical speed is trusted, classifying against THAT would be more
    personal than a fraction of max HR.
  - Not done: the mix as a weekly trend rather than one window total. The engine takes any session list, so
    it is a view-level change.
