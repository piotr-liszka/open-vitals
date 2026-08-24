# Spec 041 — Matched routes

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/analytics/route-match.ts` + `modules/activity-detail/`
- **Owner agent:** module-dev
- **Depends on:** 015 (GPS storage + `listGpsTracks`), 026 (activity detail), 038 (`lib/analytics/` boundary)

## Context

The app stores a full GPS track per activity and draws it on a map, but never compares one track to
another. Athletes run the same handful of loops over and over, and the question they ask about every one
of them — *"was that quick for this route?"* — has no answer anywhere in the product.

Strava calls it Matched Runs. This spec ships the **route**-level version and deliberately not the
segment-level one:

- A route match asks "is this the same outing as that one?" One comparison per candidate, no catalogue,
  no spatial index, and it answers the question about regular loops directly.
- A segment match asks "does this activity pass through that stretch?", which needs a segment catalogue
  and an index to be affordable. That is a later spec, and it can be built on the same cell primitives.

## Requirements (acceptance criteria)

- [x] A pure `lib/analytics/route-match.ts` exports `cellOf`, `distanceM`, `routeFingerprint`,
      `similarity`, `lengthsMatch`, `matchRoutes` and `decimate`. No store, no clock, no Garmin.
- [x] A track is fingerprinted as the SET of ~50 m grid cells it visits, plus start cell, end cell and
      great-circle length.
- [x] The longitude step is derived from the **quantised** latitude band, so the grid is stationary: with
      the raw latitude, two points at the same longitude a few metres apart get different longitude
      cells, which inflates the cell count and makes a fingerprint depend on sample spacing.
- [x] Two tracks match when cell-set overlap (Jaccard) ≥ `MIN_SIMILARITY` **and** their lengths are
      within `LENGTH_TOLERANCE`. The length gate is not optional: overlap alone matches a loop against
      the double-loop containing it.
- [x] Matching is direction-agnostic (the same loop run backwards is the same loop), and `sameStart` /
      `sameEnd` are reported separately so a caller can be stricter without the engine baking in a policy.
- [x] Tracks under `MIN_TRACK_M` are not fingerprinted: a 200 m walk to the shop matches every other one.
- [x] Unusable samples (NaN, out-of-range coordinates) are skipped, not fatal.
- [x] The activity page lists earlier outings on the route ranked by pace, marks the current one, shows
      the per-row overlap, and states that a match is **probable, not proven**.
- [x] An outing with no comparable pace is listed but never ranked fastest by default.
- [x] Matching never crosses sport families and never reads another user's tracks.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No new endpoint. `ActivityDetailData` gains:

```ts
readonly matchedRoute: MatchedRoute | null;
// { entries, currentRank, previousCount, bestPaceSecPerKm, comparedCount }
// entries: { activityId, day, distanceM, durationS, avgHr, paceSecPerKm, similarity, rank, isCurrent }
```

## UI

`ActivityMatchedRoute.svelte` under the route map, from `Card` + `Badge` + tokens: the placing as a
badge, the gap to the route's best, then a ranked table (scrolling inside its own box) linking every
other outing. Nothing renders without a match.

## Design / implementation notes

- Jaccard rather than Fréchet/DTW: O(cells) instead of O(n·m), no alignment step, and symmetric and
  direction-agnostic for free.
- **The cost is stated in the handler.** Matching reads every stored GPS track of the same family and
  fingerprints it — the same read the heat map already does. Candidates are decimated 4× before any
  haversine runs, but it is linear in the athlete's history and is the first thing to move if this page
  slows down. Summaries are fetched only for tracks that actually matched, not for every candidate.

## Test plan

- **Unit (`route-match.test.ts`):** cell stationarity and the pole guard; haversine against a known
  separation; fingerprint contents, sorting, the length floor, dirty samples, altitude tuples;
  similarity identity/symmetry/direction-independence; the length gate rejecting the containing
  double-loop and the contained half; caller-supplied thresholds; decimation losslessness and its limit;
  and an explicit test recording where worst-case sideways noise sits relative to the threshold.
- **API integration (`activity-detail.api.test.ts`):** ranking among earlier outings, a route best, no
  match, never across families, no GPS, the containing double-loop rejected, per-row overlap, and
  per-user isolation.
- **Unit (`ActivityMatchedRoute.svelte.test.ts`):** both empty paths, the inflected count, the placing
  and gap, the route-best case, the missing-pace case, current-row marking and linking, the
  probable-not-proven note, and the dash for a missing value.

## Closeout

- Commits: `845666f` — feat(activity): matched routes — "was that quick for this loop?" (spec 041)
- Notes / follow-ups:
  - **The real fix for the read cost** is a `route_key` (or the cell set) computed once at sync time and
    stored, turning the page query into an index lookup. That needs a schema change, so it is a spec of
    its own — and the engine here is already the piece it would call.
  - A test records that per-sample sideways noise of ±17 m across a cell boundary lands at ~0.69, just
    under the 0.7 gate. That is the worst case (real GPS error is correlated between samples), but if
    matches ever seem to be missed, `MIN_SIMILARITY` is the knob — and it should be turned knowingly
    rather than by loosening a fixture.
  - Segment matching, "your PR on this route", and a route-level pace trend over months are all natural
    next steps on these primitives.
  - The route comparison ranks by whole-activity pace. Once spec 040's best efforts are stored per
    activity, ranking by a common distance inside the route would be fairer on outings that were cut short.
