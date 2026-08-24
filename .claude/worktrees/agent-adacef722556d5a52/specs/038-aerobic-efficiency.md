# Spec 038 — Aerobic efficiency: decoupling, EF, cardiac cost

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/analytics/efficiency.ts` + `modules/activity-detail/` + `modules/running/`
- **Owner agent:** module-dev
- **Depends on:** 023 (activity stats), 026 (activity detail + stream charts), 018 (running page), 037 (month keys)

## Context

The activity page reports what the athlete did. It cannot yet answer the two questions that decide
whether a training block is working:

1. **Did this session hold together?** A well-paced aerobic effort costs the same pace per heartbeat
   in its second half as in its first. When it does not — because the athlete started too hard, was
   underfuelled, overheated, or is not yet aerobically ready for the distance — that is *aerobic
   decoupling* (Friel's Pa:HR / Pw:HR). It needs only the two streams every watch records, and
   **neither Strava nor Garmin surfaces it.**
2. **Is the engine actually improving?** Comparing paces cannot tell you, because pace depends on how
   hard you tried. Speed per heartbeat (*efficiency factor*) and beats per kilometre (*cardiac cost*)
   can: rising EF or falling cost at similar intensity is aerobic fitness, not effort.

Both fall out of data already stored. EF and cardiac cost need only the **summary**, so they can be
trended over every session ever synced without reading a single stream.

## Requirements (acceptance criteria)

- [x] A pure `lib/analytics/efficiency.ts` exports `aerobicDecoupling`, `efficiencyFactor`,
      `powerEfficiencyFactor`, `cardiacCost`, `cardiacCostStream` and `monthlyEfficiency`.
- [x] It lives in `lib/analytics/`, **not** `lib/server/analytics/`, because `activity-charts.ts` is
      bundled into the browser and needs it at runtime — a `$lib/server` import there passes test,
      check and lint and then fails the production build.
- [x] `aerobicDecoupling` splits the session on its **usable** samples (moving, strap reading), so a
      long mid-session stop cannot push the boundary into the second half of the effort.
- [x] It returns `null` rather than a number from noise when either half has fewer than
      `MIN_HALF_SAMPLES` usable samples, and counts dropped samples against that floor.
- [x] It reports the sign honestly: positive = drifted, negative = a conservative start that sped up.
      Both halves' ratios are kept so a view can show the drift rather than only score it.
- [x] Power is preferred over pace where a meter was fitted (Pw:HR is less noisy — power does not care
      about wind or gradient), and the basis is reported so the UI can label it.
- [x] `efficiencyFactor` / `cardiacCost` refuse inputs they cannot use (no HR, no distance, a distance
      under 400 m, a strap below a live floor) instead of returning a misleading number.
- [x] Average speed falls back to distance ÷ moving time when Garmin's raw `averageSpeed` is absent, so
      EF is not silently dropped on sessions that carry everything needed to compute it.
- [x] `cardiacCostStream` adds a **derived** "koszt sercowy" chart to the activity stream stack, with
      `NaN` gaps where the athlete was stopped rather than a line joined across the stop.
- [x] The activity page renders a `Wydolność tlenowa` card that explains each number, states that
      decoupling is meaningless for intervals, and renders nothing at all when the session carried no
      heart rate.
- [x] `monthlyEfficiency` gives the running page a 24-month trend of mean EF and cardiac cost, with a
      month that had no runs as `null` rather than `0`, averaged **unweighted** so one long run cannot
      define the month. It costs no extra store read.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No new endpoint. `ActivityDetailData` gains:

```ts
readonly efficiency: EfficiencyBlock;   // { decoupling, ef, powerEf, cardiacCost } — leaves nullable
```

`RunningData` gains `efficiency: EfficiencyMonth[]` (`{ month, ef, cardiacCost, sessions }`, oldest
first).

## UI

`ActivityEfficiency.svelte` from `Card` + `Badge` + tokens: the decoupling verdict
(Spięty / Rozjechany / Przyspieszony) in a wide slot with its explanation, then EF, power-EF and
cardiac cost. On the running page, one `TrendChart` with EF and cardiac cost as two lines. Both
absent-data paths render nothing rather than an empty frame.

## Design / implementation notes

- The two simplifications in decoupling are documented at the top of the engine because they change how
  the number reads: the split is over the whole recording (Friel's protocol excludes the warm-up, so a
  warm-up-heavy session scores slightly worse here), and intervals are not steady state at all.
- Ratios use Σoutput / Σhr — the ratio of the means, not the mean of the ratios — so one slow sample at
  a low HR cannot swing a half.
- Cardiac cost is in the hundreds while EF is around 1, so the running chart scales the cost onto EF's
  range and says so in the series name. Plotting the raw numbers together would flatten EF to a line.

## Test plan

- **Unit (`efficiency.test.ts`):** steady effort → 0; HR drift and pace fade both → positive; a
  conservative start → negative; the coupled boundary; short sessions and missing streams → `null`;
  standing samples and dead-strap samples excluded; NaN tolerated but counted against the floor; the
  monthly trend's null months, unweighted mean and lattice filtering.
- **API integration (`activity-detail.api.test.ts`):** the block is computed from streams + summary,
  power is preferred for the basis, the derived average-speed fallback works, and a session with no HR
  gets an all-null block.
- **Unit (`ActivityEfficiency.svelte.test.ts`):** each verdict and its explanation, the signed
  percentage, the interval caveat, the power label, and the nothing-to-say path.

## Closeout

- Commits: `5b68b85` — feat(activity): aerobic decoupling, efficiency factor, cardiac cost (spec 038)
- Notes / follow-ups:
  - The derived cardiac-cost chart joining the stream stack changed the fixtures in
    `ActivityStreamsPanel.svelte.test.ts` (a fourth chart and a third group). That is the intended
    behaviour, not a regression.
  - Decoupling would be sharper if it ran over a **detected** steady block instead of the whole
    recording, and if it skipped sessions Garmin classifies as intervals. Both need a session
    classifier, which is a spec of its own.
  - The running page's trend compares months of possibly different intensity. The honest fix is to
    filter to easy/aerobic sessions only, which needs zone data per run — cheap once spec 044's
    time-in-zone work lands.
  - `monthlyEfficiency` is sport-agnostic; the Rower and Marsz pages can take it with a view change.
