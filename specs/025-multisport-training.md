# Spec 025 — Multisport training section

- **Status:** Approved <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/training/`, `apps/web/src/modules/power/`, `apps/web/src/modules/running/`, `apps/web/src/modules/walking/`
- **Owner agent:** module-dev
- **Depends on:** 015 (local store), 018 (running page + `lib/date`), 020 (`lib/sport-labels`), 022 (`StackedBar`), 017/016 (chart primitives)

## Context

The primary nav carried three separate training entries — **Trening**, **Moc** and **Bieg** — so an athlete
who walks, rides and runs in the same week had to visit three pages and mentally stitch them together. Two
concrete defects fell out of that split: `/power` applied **no sport filter at all**, so a running-power
activity was folded into the *cycling* rider-type radar; and walking/hiking appeared in **no analysis view
anywhere in the app**. All three pages also read the entire activity history (`limit: 100000`) on every
request and filtered in memory.

The user asked to "see everything at a glance… or maybe split view into few sections/subpages" and chose the
merge: one `/training` section with a multi-sport overview plus per-sport subpages, showing only the sports
they actually record.

## Requirements (acceptance criteria)

- [x] Primary nav has ONE training entry; `Moc` and `Bieg` are gone from `lib/nav.ts`
- [x] `/training` is a multi-sport overview: window totals, load/time split per sport family, weekly volume
      by sport, whole-athlete PMC (CTL/ATL/TSB) and a recommendation
- [x] Per-sport subpages exist at `/training/rower`, `/training/bieg`, `/training/marsz` (Polish route
      segments, English module folders)
- [x] `/training/rower` is scoped to `sportGroup === 'ride'`, so a running-power effort can no longer enter
      the cycling rider-type radar, FTP estimate or power records
- [x] `/training/marsz` is a real page (volume, elevation, pace, longest routes, daily steps), not a stub
- [x] Sport tabs are rendered ONLY for families the user has activities in, derived from `store.listSports()`
- [x] Sub-navigation is real `<a href>` links (bookmarkable + SSR), via a shared `lib/ui/SubNav` component
- [x] `/power` → `/training/rower` and `/running` → `/training/bieg` return HTTP 308; `/training?sport=…`
      redirects to the matching subpage
- [x] Sport filtering happens IN the store query (`ListActivitiesQuery.sports`), added to the port, the pg
      adapter and the in-memory fake together
- [x] `TrainingView`'s hand-rolled PMC SVG, `PowerView`'s per-year curve SVG + year chips, and
      `RunningView`'s div-based bar tracks are deleted in favour of `TrendChart` / `BarChart` / `StackedBar`
- [x] One consent gate (`+layout.server.ts`) covers the whole section, including future subpages
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No new HTTP endpoints — these are SvelteKit page loaders over module handlers.

```
GET /training                 → { overview: TrainingOverviewData }   (modules/training/training.types.ts)
GET /training/rower           → { power:    PowerData }              (modules/power/power.types.ts)
GET /training/bieg            → { running:  RunningData }            (modules/running/running.types.ts)
GET /training/marsz           → { walking:  WalkingData }            (modules/walking/walking.types.ts)
layout /training              → { tabs:     TrainingTab[] }          (modules/training/training-nav.ts)

GET /power                    → 308 → /training/rower
GET /running                  → 308 → /training/bieg
GET /training?sport=cycling   → 308 → /training/rower
GET /training?sport=running   → 308 → /training/bieg

Base-tier user on any /training route → 303 → /
```

Handlers:

```
loadTrainingOverview({ store, settings, clock }, { userId })  -> TrainingOverviewData
loadPower({ store, settings }, { userId, group?: SportGroup }) -> PowerData
loadRunning({ store, settings, clock }, { userId })           -> RunningData
loadWalking({ store, clock }, { userId })                     -> WalkingData
```

Store port addition (`lib/server/store/types.ts`):

```ts
interface ListActivitiesQuery {
  /** Match ANY of these Garmin sport keys. ANDs with `sport`; an empty array matches nothing. */
  readonly sports?: readonly string[];
}
```

Taxonomy additions (`lib/sport-labels.ts`): `SPORT_GROUP_LABELS`, `sportGroupLabel(group)`,
`sportKeysInGroup(group)` — the last one expands a family into the key list the store filters on.

## UI

- **New shared component:** `lib/ui/SubNav.svelte` — in-section tab links (`items`, `current`, `ariaLabel`,
  optional per-tab `count`). Same track/thumb vocabulary as `SegmentedControl` so the app has one selection
  idiom, but built from real anchors: `SegmentedControl` is for client-side filters, `SubNav` for routes.
  Marks the current route with `aria-current="page"`; the row scrolls rather than wraps on narrow screens.
- **Composed from:** `AppShell`, `NavLinks`, `SubNav`, `Card`, `Badge`, `StatTile`, `BarChart`, `TrendChart`,
  `StackedBar`, `Table`, `Button`. No bespoke SVG survives outside PowerView's rider radar (a genuine
  one-off shape with no `lib/ui` equivalent).
- **States:** no activities at all → one Card pointing at `/data`; activities but no load → sport split and
  volume render, PMC card is hidden and the recommendation explains why; a family with no synced HR/power
  degrades to the tiles it can fill. Loading is SSR, so no spinner state.
- **Light + dark:** tokens only (`--lane-*`, `--color-*`, `--space-*`); one lane colour per sport family,
  consistent across the stacked bar, the sport list and the weekly chart.

## Design / implementation notes

- **Ports & adapters:** `LocalStore`, `SettingsRepo` and `Clock` are injected into every handler. The new
  `sports` filter landed in the port type, `pg.ts` (`AND sport = ANY(...)`, parameterised) and `memory.ts`
  in one change, so the in-memory fake cannot lie to the tests.
- **Bounded reads.** The overview reads a 540-day window instead of all history: CTL's 42-day time constant
  means older work cannot move today's number, and the extra ~6 months ahead of the charted 365 days exist
  purely to warm CTL up so the displayed window is converged. Running and cycling filter by sport family in
  SQL. Stream reads stay batched and field-scoped (`getStreamField`).
- **The rider-radar bug.** `loadPower` now takes an optional `group`; `/training/rower` passes `'ride'`.
  Omitting it preserves the old all-sports behaviour, which is what the pre-existing tests assert.
- **Family enumeration caveat.** `sportKeysInGroup` returns only KNOWN keys. An unmapped Garmin key groups
  as `other` (per `sportGroup`) but cannot be enumerated, so the store filter must never be used for
  `other`; `ride`/`run`/`walk` are exhaustive. A test asserts the enumeration and `sportGroup` agree.
- **Dates** go through `lib/date` (`todayKey`, `addDays`, `startOfWeek`, `toDayKey`, `formatDay`) — this
  also fixes "today" being computed in UTC in the training and running handlers.
- **Chart consequence, deliberate:** the yearly power curves moved from a bespoke log-x SVG to `TrendChart`,
  whose x axis is one evenly spaced slot per sampled duration. The short end of the curve is no longer
  visually compressed, and the chart's own legend replaced the year chip row.

## Test plan

- **Unit:** `training-nav.test.ts` (tabs only for owned families, family key sums, tab order, page titles);
  `sport-labels.test.ts` (group labels + enumeration ↔ `sportGroup` agreement); `SubNav.svelte.test.ts`
  (real hrefs, `aria-current`, counts); `memory.test.ts` (`sports` filter, empty array matches nothing).
- **API integration (mock adapters):** `training.api.test.ts` (empty payload shape, PMC from Garmin load /
  power TSS / HR TRIMP, sport split ordering + subpage links + null link for swimming, weekly bucketing,
  old activities excluded from the window but kept as PMC lead-in); `walking.api.test.ts` (walk-family
  scoping, totals, weekly buckets, highlights, daily steps with gaps); `power.api.test.ts` (new: `group:
  'ride'` excludes running power from bests and the radar, and omitting `group` keeps the old behaviour);
  `tier-gating.test.ts` (Base user redirected from the whole `/training` section via the layout load).
- **Sidecar (pytest):** N/A.

## Closeout

- Commits: _pending (handed off to qa-closer)_
- Notes / follow-ups:
  - Swimming, gym/strength and "other" appear in the overview split but have no analysis subpage yet;
    `SportSlice.href` is `null` for them, and `training-nav.SPORT_PAGES` is the one place to extend.
  - The walk page's daily-step trend reads the synced `steps` metric, i.e. whole-day steps, not
    per-activity steps (activity summaries do not carry a step count).
  - `pnpm run lint` is red at HEAD for unrelated reasons (`.prettierrc` `printWidth: 110` vs. a ~100-column
    codebase); files added here are prettier-clean.
