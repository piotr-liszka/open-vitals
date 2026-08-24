# Spec 065 — Similar activities on the activity page

- **Status:** Closed
- **Module:** `apps/web/src/modules/activity-detail/`
- **Owner agent:** module-dev
- **Depends on:** 041 (matched routes), 036 (highlights), 023 (activity detail)

## Context

The activity page can already answer "have I done this **route** before?" (spec 041, matched routes).
It cannot answer the question an athlete asks far more often: **"have I done this *effort* before, and
was I better today?"** Those are different questions, and route matching cannot stand in for the
second one. A 40 km ride on a new road has no matched route at all, yet the athlete has ridden forty
kilometres eighty times and wants to know where this one lands. Route matching is also blind without
GPS — a treadmill run or a trainer session matches nothing, ever.

So: one card, two tabs. **Podobny wysiłek** finds sessions of the same sport family at a comparable
distance *and* duration and shows how today's pace, heart rate and power compare. **Ta sama trasa** is
the existing matched-route table, moved into the same card because "what should I compare this to" is
one question with two answers, and two separate cards asking it twice is how a page stops being read.

The tolerance is **fixed at ±15% on both axes**, and the list is allowed to come back empty. A widening
search that always finds five would mean "similar" quietly changes meaning per activity — the athlete
would have no way to know that today's five matches are 30% off when yesterday's were 4% off. An empty
list is information: this session was unusual.

## Requirements (acceptance criteria)

- [x] The activity page shows one card with two tabs: `Podobny wysiłek` and `Ta sama trasa`
- [x] Effort matching requires the same sport family, distance within ±15%, and duration within ±15%
- [x] Matches are ranked by closeness and capped, closest first
- [x] Each row shows the day, distance, duration, and the deltas vs the current session (pace, HR, power)
- [x] Deltas are signed and state which direction is better for pace (lower is faster)
- [x] The card says how many candidates were compared, so the reader knows how wide the search was
- [x] No match produces an explicit empty state naming the tolerance, never a padded list
- [x] An activity with no distance or no duration says so rather than showing a broken comparison
- [x] The current activity never appears among its own matches
- [x] The route tab keeps the existing spec-041 behaviour and its "no GPS" empty state
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No new endpoint. The block is assembled in the existing activity-detail loader and travels in
`ActivityDetailData`, alongside `matchedRoute`.

```ts
similarActivities: SimilarActivities | null   // null when the activity has no distance/duration axis

interface SimilarActivities {
  entries: SimilarEntry[];      // closest first, capped at SIMILAR_LIMIT
  comparedCount: number;        // candidates actually examined
  tolerancePct: number;         // 15 — stated so the empty state can name it
  coversAllHistory: boolean;    // false when the scan hit its bound
}
```

## UI

- `SimilarActivities.svelte` (new) — the card, using `SegmentedControl` for the two tabs (client
  state, no URL change — `SubNav` is the sibling for tabs that are real links), `Table` for the rows
  and `DeltaBadge` for the comparisons.
- `ActivityMatchedRoute.svelte` — unchanged internally; it becomes the content of the second tab.
- States: matches / no matches (naming the tolerance) / not comparable (no distance or duration) /
  no GPS on the route tab.

## Design / implementation notes

- **`similar-activities.ts` is pure** — target + candidates in, ranked matches out. No store, no
  clock. The whole matching policy is therefore a unit test rather than an integration test.
- **Closeness is the sum of the two relative deviations** (distance and duration). Deliberately not a
  weighted or per-sport formula: an equal-weight metric is one the reader can predict, and a
  hand-tuned one would need evidence this spec does not have.
- **Pace is the headline delta** because it is the one number that answers "was I better", and it is
  compared as a percentage so 4:31/km vs 4:44/km reads the same on a 5 k and a marathon.
- **One bounded store read**, mirroring `loadMatchedRoute`: the same sport family, newest first,
  capped. `coversAllHistory` is reported the way spec 036 does it — a read that came back under its
  own bound is the proof it saw everything, with no second COUNT query.
- **Later sessions count too.** Unlike the ranking in spec 036 (which is "best up to this point" and
  must not see the future), "what is this comparable to" has no reason to be one-directional — opening
  a ride from March should show the same rides from June that June shows from March.

## Test plan

- **Unit:** a candidate inside both tolerances matches; one outside either does not; ranking is by
  combined deviation; the current activity is excluded; a candidate missing distance or duration is
  skipped; the cap is respected; deltas are signed correctly for pace/HR/power.
- **API integration (mock adapters):** an activity with comparable history returns populated
  `similarActivities`; one with none returns an empty `entries` with `comparedCount > 0`; an activity
  with no distance returns `null`.

## Closeout

- Commits: see `feat(activity): similar activities — comparable effort beside the same route (spec 065)`
- Verified in a running app (mock adapters) on a 57 km ride: the effort tab found 1 match out of 55
  compared sessions and rendered the three deltas with full sentences for assistive tech — "dziś tempo
  niżej o 0:13", "tętno niżej o 20 bpm", "moc wyżej o 62 W". The route tab, on the same activity,
  correctly shows the no-GPS empty state instead of nothing.

### One thing this changed that it did not set out to change

`ActivityMatchedRoute` used to render its own `<Card>`, and **nothing at all** when there was no match.
Both were fine while it was a whole card that could simply be absent from the page. As the content of a
tab, both were bugs: a card nested inside a card, and a tab you can select and be shown an empty panel.
It now draws no chrome of its own and has two distinct empty states — *no GPS track was recorded* and
*a track was recorded but matched nothing* are different facts, and only the first one is worth
pointing at the other tab for.

- Follow-ups: none.
