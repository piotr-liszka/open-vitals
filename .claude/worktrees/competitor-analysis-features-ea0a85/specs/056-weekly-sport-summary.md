# Spec 056 — Per-sport weekly training summary card

- **Status:** Draft <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/weekly-summary/` (+ `lib/server/analytics/weekly-volume.ts`, `lib/ui/TrendChart.svelte`)
- **Owner agent:** module-dev
- **Depends on:** 015 (local store), 018 (day keys + local dates), 020 (sport taxonomy + `FilterChips`), 025 (`/training` overview), 037 (volume analytics), 047 (global range switch)

## Context

`/training` opens with whole-athlete form (PMC) and a range-driven sport split. Neither answers the
question an athlete actually opens the app with on a Wednesday evening: **"how much have I done this
week in *my* sport, and is that normal for me?"** The app has the ingredients — `weeklyMileage()` buckets
12 weeks but is run-only, `SportSlice` totals a window incl. elevation but follows the global range, and
`monthlyVolume()` has the right per-sport shape in the wrong bucket — and none of them are assembled
into that one glanceable card.

This spec adds a compact **per-sport weekly summary**: a row of sport chips, three week-to-date headline
stats (dystans / przewyższenie / czas), and a 12-week weekly-distance area chart with the current week
visually emphasised. It also generalises the weekly bucketing into ONE shared function so the run-only
copy and the new per-sport one cannot diverge.

## Placement, scope and the decisions behind them

**Where: `/training`, as the FIRST card on the overview page.** The card is inherently multi-sport (its
chips are sport families) and `/training` is the only page whose scope is every family the athlete
records. The dashboard was rejected: it is a wellness/readiness page (sleep, Body Battery, HRV) already
dense with tiles, and putting the only training-volume card there would split "training" across two
pages. Wiring is route-level — `routes/training/+page.server.ts` calls this module's handler alongside
`loadTrainingOverview`, and `+page.svelte` renders the card above `<TrainingOverview>` — so the two
modules stay independent slices (AGENTS.md §5).

**Global range (spec 047): this card IGNORES it — fixed trailing 12 weeks.** Its whole meaning is
"this week against my recent normal", and a normal is only a normal at a fixed span; a 7-day range would
collapse the chart to one bar and a 5-year range would turn "ten tydzień" into a lie. Spec 047 already
established the convention that makes this readable: **a card that follows the range carries a
`RangeBadge`, a card that ignores it carries none** (the PMC card is the precedent). So this card renders
no range badge and says its own window in the subtitle ("stałe okno 12 tygodni"), and the reader is never
invited to think the switch above moves it.

**Which chips: only families with an activity in the 12-week window**, ordered by **time in the window**
(busiest first), defaulting to the busiest. Time, not distance, because ordering multi-sport families by
distance would always put a rider above a runner regardless of what they actually trained; this is the
same rule `TrainingOverview` already sorts its sport split by. There is deliberately **no "Wszystkie"
chip**: summing a ride's kilometres with a run's produces a number with no meaning.

**Partial current week.** "Ten tydzień" is explicitly week-**to-date**: the block is captioned with the
week's Monday and how many of the seven days have been lived through, and the chart's last point — which
is the same partial week — is marked as in progress by (a) the decorative emphasis dot + rule, (b) a
visible caption line naming it "bieżący tydzień (w toku)" with its value, and (c) the chart's own
accessible summary. Nothing averages or ranks against the partial week, so it cannot drag a comparison.

## Requirements (acceptance criteria)

- [x] A shared, sport-agnostic weekly roll-up lives in `lib/server/analytics/weekly-volume.ts`:
      `weeklyVolume(activities, { today, weeks, group? })` → one `WeekVolume` per ISO week (Monday start),
      oldest first, carrying activities / distance / duration / elevation, `partial` and `daysElapsed`.
- [x] Weeks are built with `$lib/date` integer civil-date arithmetic (`startOfWeek`, `addDays`) — no
      `new Date()`, no `Date.now()`, no `toISOString()` day maths anywhere in the slice.
- [x] The window always has exactly `weeks` buckets: a week with no training is `0`, never missing, and
      never collapses its slot.
- [x] `weeklyMileage()` (spec 018) is re-expressed on top of the new function rather than left as a
      second implementation, and its published contract (`WeekMileage {week, km, runs}`) is unchanged.
- [x] `loadWeeklySummary(deps, req)` returns, from ONE bounded per-user store read: the 12 Monday keys,
      month-change x labels, and one entry per sport family present in the window with its week-to-date
      totals and its 12-week distance/duration/elevation/activity series.
- [x] Families are ordered by window training time, busiest first; `defaultGroup` is the busiest.
- [x] "Today" and therefore the week boundary resolve in the **configured timezone** (`Config.appTimeZone`),
      injected — the handler reads no env and no ambient clock.
- [x] Every store read is scoped to the authenticated user, asserted by an isolation test.
- [x] `TrendChart` gains an `emphasisIndex` (+ `emphasisLabel`) prop: purely decorative halo + dot + a
      vertical rule at that point. It opens no tooltip, fires no callback and does not touch
      `selectedIndex`/`hoverIndex`, and it extends the chart's `aria-label` summary so the emphasis is
      not conveyed by colour alone.
- [x] The card renders: sport chips (`FilterChips`), "Ten tydzień" with **Dystans / Przewyższenie / Czas**
      week-to-date tiles, "Ostatnie 12 tygodni" as an area chart of weekly distance labelled by month with
      the last week emphasised, a caption naming the last point as the week in progress, and a footer link
      to the existing volume page.
- [x] Picking a chip re-renders the whole card (stats, chart, colour) for that family with no round-trip;
      the family's lane colour from `SPORT_GROUP_LANES` drives the chart.
- [x] The card carries **no** `RangeBadge` and no other affordance implying the global switch moves it.
- [x] Empty state: an athlete with no activities in the window gets an explanatory card, not a blank chart.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens (if UI)
- [x] No secrets logged or committed

## API contract

No new HTTP endpoint and no new MCP tool — the card is server-rendered through the existing
`/training` page load. The contract is the module's types file,
`apps/web/src/modules/weekly-summary/weekly-summary.types.ts`:

```
loadWeeklySummary(deps, req)
  deps: { store: Pick<LocalStore,'listActivities'>, clock: Clock, timeZone: string }
  req : { userId: string }
  res : WeeklySummaryData {
          weeks: number                       // 12
          weekStarts: string[]                // 12 Mondays, YYYY-MM-DD, oldest first
          monthLabels: string[]               // 'sie' at each month change, '' elsewhere
          currentWeekStart: string
          currentWeekDays: number             // 1..7 days of the current week lived through
          defaultGroup: SportGroup | null
          sports: WeeklySummarySport[] {      // busiest (by window time) first
            group, label, color,
            thisWeek: { activities, distanceM, durationS, elevationGainM }
            window : { activities, distanceM, durationS, elevationGainM }
            weekly : WeeklySummaryWeek[]      // 12, index-aligned with weekStarts
                     { week, activities, distanceM, durationS, elevationGainM, partial }
          }
          hasData: boolean
        }
```

## UI

`Card`, `FilterChips`, `StatTile`, `TrendChart` from `lib/ui`; lane colours and Polish family names from
`$lib/sport-labels`; day/month rendering from `$lib/date`.

- **Success:** chips → "Ten tydzień" (3 tiles) → "Ostatnie 12 tygodni" area chart (month ticks, current
  week emphasised) → caption → footer link "Pełny widok objętości →" to `/training/objetosc`.
- **Empty:** one card explaining that nothing has been synced for the last 12 weeks, linking to `/data`.
- **Accessibility:** chips are real `<button>`s with `aria-pressed` and the shared focus ring (already the
  case in `FilterChips`); the emphasised point is conveyed by the chart's aria summary and by a visible
  caption, never by colour alone; every stat tile carries a text label.
- **Light + dark** through tokens only; the chart colour is a lane custom property, not a hex.

## Design / implementation notes

- **Ports:** `LocalStore` (narrowed to `listActivities`), `Clock`, and the app timezone string from
  `Config` — all injected by the route from the container. No `fetch`, `Date.now()`, `process.env` or fs.
- One read: `listActivities(userId, { from: <Monday 11 weeks back>, to: today, limit })`. Families are
  split in memory because the family filter would otherwise need one query per family, and `other` cannot
  be expressed as a sport `IN`-list (see `sportKeysInGroup`'s caveat).
- Elevation comes from the normalized `elevation_gain_m` column; duration uses `movingS ?? durationS`,
  the same "honest training time" rule the volume and training modules already apply.
- `weeklyMileage()` keeps its exact semantics (only runs with a distance count towards `runs`) by
  pre-filtering before delegating, so `runner-profile` and the running page are untouched.
- Edge cases: no activities at all (`sports: []`, `hasData: false`, `defaultGroup: null`); a family whose
  sport has no distance (chart is all zeros — the time tile still tells the truth); Monday itself
  (`currentWeekDays = 1`, the chart's last point is one day old); DST — day keys are civil dates, so a
  clock change cannot move a week boundary.

## Test plan

- **Unit (`weekly-volume.test.ts`):** exactly 12 buckets for a 12-week window; empty weeks are `0` not
  missing; Monday-start boundaries (Sunday belongs to the week that started 6 days earlier, Monday starts
  a new one); the current week is `partial` with the right `daysElapsed` and every earlier week is not;
  per-family split keeps distance, duration and elevation apart; unparseable days are ignored.
- **Unit (`running-profile.test.ts`):** existing `weeklyMileage` expectations still pass after the
  delegation.
- **API integration (`weekly-summary.api.test.ts`, mock store + fixed clock):** the documented JSON
  contract; family ordering and `defaultGroup`; week-to-date totals exclude last week's sessions;
  timezone decides the current week (a Monday 00:30 Europe/Warsaw instant is Sunday in UTC and must NOT
  roll the week back); activities older than the window are excluded; empty payload shape; **per-user
  isolation** — user A never sees user B's kilometres.
- **Component (`WeeklySportSummary.svelte.test.ts`):** chips render one per family with the busiest
  pre-selected; clicking a chip swaps the headline numbers and the chart's colour; the partial-week
  caption is present; the empty state renders instead of a chart.
- **Component (`TrendChart.svelte.test.ts`):** `emphasisIndex` draws the halo/dot/rule and extends the
  aria summary; it does not open a tooltip nor change `selectedIndex`; an out-of-range or undefined index
  draws nothing.

## Closeout

- Commits: <hashes/links>
- Notes / follow-ups:
  - `weeklyMileage()` turned out to be live after all (`runner-profile.ts` and the running page both use
    it), so it was **re-expressed** on the shared bucketing rather than deleted; `mondayOf()` now
    delegates to `$lib/date`'s `startOfWeek` and the last raw-`Date` week maths in `running-profile.ts`
    is gone.
  - The footer link is the sport-agnostic `/training/objetosc`. A per-family deep link would have meant
    importing `modules/training/training-nav`, i.e. one module reaching into another's folder
    (AGENTS.md §5) — worth a shared `lib/` sport-route helper if a second module ever needs one.
  - `TrendChart`'s accessible summary is English everywhere else in the component; `emphasisLabel` is the
    caller's own language, so the emphasis reads Polish on a Polish page. Translating the rest of the
    summary is its own change and would move several existing tests.
  - Not added to `/styleguide`: specs 053–055 have that file open in parallel.
