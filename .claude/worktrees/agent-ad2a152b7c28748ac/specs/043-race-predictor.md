# Spec 043 — Race predictor

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/analytics/race-predictor.ts` + `modules/running/`
- **Owner agent:** module-dev
- **Depends on:** 018 (personal bests), 042 (critical speed)

## Context

Garmin's race predictor is among the numbers its users check most, and it is not in anything we sync. Two
independent ways to estimate it are already within reach:

1. **Riegel** — `T₂ = T₁ · (D₂/D₁)^1.06`, an empirical law over the athlete's own bests, which spec 018
   already computes.
2. **Critical speed** — `t = (D − D′)/CS`, physiological rather than empirical, free from spec 042's curve.

Shipping **both** is the design decision. They rest on different data and different assumptions: where
they agree the number means something, and where they diverge the divergence is itself the finding —
typically a runner whose speed is well ahead of their endurance, or the reverse.

## Requirements (acceptance criteria)

- [x] A pure `lib/analytics/race-predictor.ts` exports `riegelTime`, `criticalSpeedTime` and
      `predictRaces`. No store, no clock, no Garmin.
- [x] Each target is predicted from the best **closest in ratio** to it, not closest in metres, so a 10 km
      best predicts the half rather than a 1 km best doing it.
- [x] No prediction at all beyond `MAX_EXTRAPOLATION` (4×). Predicting a marathon from a 1 km best is
      fiction, not extrapolation, and an athlete who has only ever raced a kilometre gets an **empty**
      table rather than four flattering numbers.
- [x] Every prediction names the best it came from, the day that best was set, and the factor extrapolated;
      `confident` is true only within `CONFIDENT_EXTRAPOLATION` (2.5×).
- [x] A distance neither method can speak to is omitted entirely.
- [x] Critical speed alone can carry the table when there are no usable bests, and Riegel alone when there
      is no curve.
- [x] `criticalSpeedTime` returns `null` where the anaerobic reserve alone would cover the distance — the
      model does not apply at sprint distances.
- [x] The running page shows both columns side by side, dims a far extrapolation rather than hiding it, and
      states that neither method knows anything about fuelling, heat, or whether the athlete has ever run
      the distance.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No new endpoint. `RunningData` gains:

```ts
predictions: RacePrediction[];
// { key, label, metres, riegelS, criticalSpeedS, paceSecPerKm, fromLabel, fromDay, extrapolation, confident }
```

## UI

A `Przewidywane czasy` card on the running page: `Card` + a five-column table (scrolling inside its own
box) with both estimates, the pace, and the source best. Rows past the confidence limit are dimmed.

## Design / implementation notes

- `closestBest` ranks by **ratio**, and the comment says why: a 5 km best and a 20 km best are each 4× from
  the other's distance, so ranking by absolute metres would sometimes pick the worse extrapolation.
- The two extrapolation limits do different jobs: `MAX` decides whether to speak at all, `CONFIDENT`
  decides how loudly. Collapsing them into one would mean either withholding useful estimates or
  presenting bad ones as good.

## Test plan

- **Unit (`race-predictor.test.ts`):** Riegel's identity, super-linear and sub-linear behaviour, and a
  custom exponent; the critical-speed formula with and without a reserve and its sprint-distance refusal;
  source selection by ratio; exactness at the source distance; the marathon-from-1 km refusal; the empty
  table for a single short best; the point where predictions begin; both limits; provenance; both methods
  together; each method alone; and target ordering.
- **API integration (`running.api.test.ts`):** prediction from a real 10 km run with provenance, omission
  of a too-distant target, the critical-speed column appearing once the curve supports it, and nothing at
  all for a user with no runs.

## Closeout

- Commits: `314548d` — feat(running): race predictor from two independent methods (spec 043)
- Notes / follow-ups:
  - Bests come from spec 018's `personalBests`, which are **even-pace projections** from covering runs
    rather than measured splits. Spec 040's within-activity best efforts are the better input and would
    make these predictions sharper — they just are not stored per activity yet.
  - Riegel's exponent is a parameter. A per-athlete fit (regressing their own bests across distances) is
    the natural refinement and needs no new data.
  - Not done: a prediction TREND over time, which is what makes Garmin's version motivating. It needs the
    bests recomputed as of each past date — cheap over stored summaries, but a spec of its own.
  - Neither method models heat, fuelling or course profile. The card says so; that is the honest ceiling
    for a predictor built from training data alone.
