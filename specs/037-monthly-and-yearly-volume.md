# Spec 037 — Volume by month, and year against year

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/volume/` + `lib/server/analytics/volume.ts` + `lib/date.ts`
- **Owner agent:** module-dev
- **Depends on:** 018 (local dates), 020 (sport taxonomy), 025 (training section + sub-nav)

## Context

Every volume number in the app is measured in ISO weeks: `weeklyMileage` (12 weeks) on the running
page, the stacked weekly hours on the training overview, `WALK_WEEKS` on the walking page. Weeks are
the right unit for a training block and the wrong one for the two questions athletes actually ask:

- "How far did I run **in July**?" A calendar month is not a whole number of ISO weeks, so no
  re-slicing of a weekly series answers this.
- "Am I **ahead of last year**?" Nothing in the app compares one year to another at all.

Strava ships both (its monthly totals and its year-to-date lines). Neither needs new Garmin data —
only `ActivitySummary` rows we already sync, and `lib/date.ts` did not have a single month or
day-of-year helper to build them on.

The trap in both is comparing unequal spans, and it is the whole design problem here: on the 2nd of
the month a raw monthly chart says training has collapsed, and a finished year always beats a year
four months in.

## Requirements (acceptance criteria)

- [x] `lib/date.ts` gains a `MonthKey` (`YYYY-MM`) with the same nominal-type discipline as `DayKey`:
      `isMonthKey`, `monthKeyOf`, `startOfMonth`, `endOfMonth`, `firstDayOf`, `addMonths`,
      `monthsBetween`, `monthRange`, `lastMonths`, `formatMonth`, plus `yearOf`, `dayOfYear` and
      `daysInYear`. A bad key throws `InvalidMonthKeyError` rather than being guessed at.
- [x] `endOfMonth` / `daysInYear` / `dayOfYear` are correct across leap years and the 100/400 rules.
- [x] `formatMonth` is UTC-pinned like `formatDay`, so a month renders identically on server and client.
- [x] A pure `lib/server/analytics/volume.ts` exports `monthlyVolume` and `yearOverYear` — no store, no
      clock, no Garmin.
- [x] `monthlyVolume` returns distance, moving time, climb and a session count per calendar month over
      a window, keeps **empty months in the lattice** rather than closing the gap, and splits the same
      window per sport family (busiest first, only families actually present).
- [x] The month in progress is flagged `partial` and is excluded from both the window average and the
      "best month", so neither collapses on the 1st.
- [x] `yearOverYear` returns a cumulative-distance curve per calendar year plus, for every year, a
      `toDateKm` measured at **the same day of the season** as today. `vsLastYearKm` is computed from
      `toDateKm`, never from a full-year total.
- [x] The running year's curve is `null` after today, so a chart's line stops instead of flat-lining to
      31 December.
- [x] A leap year gets 366 slots and a common year 365; the handler pads both to one lattice.
- [x] One lane colour per sport family moves into the shared taxonomy (`SPORT_GROUP_LANES` /
      `sportGroupLane`), and `TrainingOverview` uses it instead of its own copy.
- [x] `/training/objetosc` renders the page behind the existing `detailed_analytics` gate, with a
      cross-sport nav tab offered to anyone who has any activity at all.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No REST endpoint — a SvelteKit page load, like the other training subpages.

```
GET /training/objetosc  →  { volume: VolumeData }   (303 → / without detailed_analytics consent)
```

`VolumeData` (`volume.types.ts`) carries `months` + `monthly` + `bySport` on one month lattice,
`years` padded to 366 slots each, `throughDayOfYear`, `vsLastYearKm`, `avgDistanceM`, `bestMonth` and
`dayOfYearLabels`.

## UI

`VolumeView.svelte` from `Card`, `StatTile`, `Badge`, `BarChart` (grouped by sport, with the
complete-month average as its `baseline`), `TrendChart` (one line per year) and `SegmentedControl`
(distance / time / climb). States: no activities → one explanatory card, no empty charts; no previous
year → the comparison verdict is omitted rather than shown as zero. The month table scrolls inside its
own box so the page never scrolls sideways.

## Design / implementation notes

- ONE store read bounded by the **year** window, since the month window is a subset of it. Bulk
  `listActivities` omits the heavy `raw` blob in both adapters, which is what makes a multi-year read
  affordable on a page load.
- Training time is **moving** time (`movingS ?? durationS`) — elapsed time counts standing at lights.
- Aligning years by day-of-year shifts a common year one day against a leap year after February. That
  is the same simplification Strava's year-to-date chart makes and is documented at the padding site.
- Month axis labels use `shortYear` on each January so a 24-month axis shows where the year turns.

## Test plan

- **Unit (`date.test.ts`):** month-key validation, arithmetic across year boundaries, leap-year
  `endOfMonth` / `dayOfYear` / `daysInYear` (including 1900 and 2000), Polish month rendering.
- **Unit (`volume.test.ts`):** empty months kept; partial month excluded from average and best; per-sport
  alignment; year comparison measured at the cut and NOT against a full year; running year nulled after
  today; leap-year slot counts; unusable days ignored.
- **API integration (`volume.api.test.ts`, memory store):** window shape, moving-vs-elapsed choice,
  shared labels/lanes, padding to 366, axis labels, per-user isolation.
- **Unit (`VolumeView.svelte.test.ts`, `training-nav.test.ts`):** the empty state, the ahead/behind
  verdict and its absence, the partial-month marking, tile presence/absence, and the new nav tab.

## Closeout

- Commits: `99a779c` — feat(training): volume by month, and year against year (spec 037)
- Notes / follow-ups:
  - `monthlyVolume` and `yearOverYear` both accept a `group`, so a per-sport volume section on the
    Bieg / Rower / Marsz subpages is now a view change with no new engine work.
  - The average excludes months that had NO activity at all, not just the partial one — otherwise a
    winter break silently halves the reference line.
  - The 24-month / 4-year windows are constants in the handler. Making them user-selectable is a UI
    change only; the engine is already parameterised.
  - Not done here: a monthly view of load (TSS) rather than raw volume. That belongs with spec 039's
    per-sport CTL work, which already owns the load maths.
