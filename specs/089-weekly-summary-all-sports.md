# Spec 089 — "Wszystko" w podsumowaniu tygodnia

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/weekly-summary/`
- **Owner agent:** module-dev
- **Depends on:** 020 (FilterChips), 037 (volume), 056 (weekly sport summary)

## Context

"Podsumowanie tygodnia" opens on one sport and can only ever show one. The athlete asked for a
**Wszystko** section before the per-sport ones — a multi-sport athlete's week is the sum of walking,
running and riding, and right now nothing on the page adds it up.

The card refuses an "all" chip today for a good reason, written into its own header: *"Adding a
ride's kilometres to a run's produces a number with no meaning."* That reasoning is correct and
survives this spec. **Distance is the only total it applies to.** Hours trained, sessions done and
metres climbed all add up perfectly well across sports, and they are what "how big was my week"
actually asks. So the section is added and distance is the one figure it omits — with a line saying
why, rather than silently showing three tiles where the others show four.

## Requirements (acceptance criteria)

- [x] A **Wszystko** chip leads the sport chips (`FilterChips` already supports this via `allLabel`
      and a `null` value — only the card's `allLabel={null}` is suppressing it) and is the
      **default selection**, so the card opens on the whole week.
- [x] Selecting it shows this week's combined **Czas**, **Przewyższenie** and **Liczba sesji** across
      every sport family the athlete has — and NOT distance.
- [x] A short line states that kilometres are not summed across sports and why. It appears only in
      the Wszystko section; the per-sport sections are unchanged and keep showing distance.
- [x] The 12-week chart for Wszystko plots **weekly hours across all sports**, on the same fixed
      window and the same partial-week handling as the per-sport series.
- [x] Combined totals are derived from the same per-family weeks the card already holds, index-aligned
      on `weekStarts` — no second read, and no possibility of the two disagreeing.
- [x] The per-sport sections behave exactly as before, including chip order by window duration.
- [x] Absent — chip and all — when the athlete has fewer than two sport families: "Wszystko" that can
      only ever mean "Bieg" is a second name for the same tab.
- [x] Copy in `pl.ts` + `en.ts`; no hardcoded strings added.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No new endpoint. `WeeklySummaryData` (see `weekly-summary.types.ts`) grows one optional field, and
`defaultGroup` gains the ability to say "all":

```
combined: {
  thisWeek: WeeklySummaryTotals;     // distanceM present in the type, NOT rendered
  window:   WeeklySummaryTotals;
  weekly:   WeeklySummaryWeek[];     // index-aligned with weekStarts
} | null                             // null when fewer than two families
```

## UI

`Card`, `FilterChips`, `StatTile`, `TrendChart` — all already used by this card. States: combined
(three tiles + hours chart + the distance note), single sport (unchanged), single-family athlete (no
Wszystko chip at all). Light + dark via tokens.

## Design / implementation notes

- The combined weeks are a fold over the existing `sports[].weekly` arrays, which are already index-
  aligned on `weekStarts`. `partial` is the OR across families for that index — a week in progress is
  in progress for all of them.
- `distanceM` stays in the combined totals type because `WeeklySummaryTotals` is one shape and
  special-casing it would be worse than not rendering the field. The rule is enforced in the card,
  not by mutilating the contract, and a test pins that the tile is absent.
- The Wszystko chart is a single series (total hours), not a stack: this section answers "how big was
  the week", and the composition is one chip away.

## Test plan

- **Unit:** the fold sums duration/elevation/activities per week index and ORs `partial`; a
  single-family athlete yields `combined: null`; combined window totals equal the sum of the
  per-family window totals.
- **API integration (mock adapters):** a two-sport athlete's payload carries `combined` with one
  entry per `weekStarts` index and `defaultGroup` selecting all; a one-sport athlete carries
  `combined: null`.
- **Component:** the Wszystko section renders Czas / Przewyższenie / Sesje and NO distance tile; the
  chip is absent when `combined` is null; picking a sport chip restores the per-sport view unchanged.

## Closeout

- Commits: this change.
- `defaultGroup` widened to `WeeklySummarySelection = SportGroup | 'all'` via an exported
  `ALL_SPORTS` constant. `SportGroup` itself is untouched — a magic string smuggled into the sport
  taxonomy would have leaked "all" into every other consumer of it.
- The combined series is a fold over the per-family `weekly` arrays the handler already built, so the
  card still costs exactly one `listActivities` read and one `weeklyVolume` pass per family. A test
  counts the store reads so a future edit cannot quietly add one.
- The combined chart line is `--color-accent`, not a lane token: every lane colour already means a
  specific sport on every other chart in the app, and reusing one for "all of them" would say the
  wrong thing.
- The chip reads "Wszystko" while the chart caption reads "wszystkie sporty" — the sentence has to
  stay grammatical, and the chip has to stay short.
- Follow-ups:
  - This card is pre-i18n (spec 056) and still hardcodes its own Polish ("Ten tydzień", "Dystans",
    the partial-week caption). All copy ADDED here went into the catalogs, so the card is now mixed.
    Migrating its legacy strings is a small change of its own and would otherwise have churned the
    existing tests inside this one.
