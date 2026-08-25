# Spec 095 — Condition card: range-aware baseline + compact Garmin summary

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/insights/`
- **Owner agent:** module-dev
- **Depends on:** 047 (global range), 059 (Garmin-mode sentence), 072 (staleness), 075 (recovery countdown), 084 (readiness)

## Context

Two pieces of direct feedback on the start page's condition card:

1. The channel deltas ("+19.8% vs 83") always compare today against a **fixed 30-day** baseline
   (`CONDITION_WINDOW_DAYS`), regardless of the page's own 7/14/30/365/all range switch sitting right
   above it. Spec 047 deliberately excluded the condition block from the switch, reasoning that a
   year-long baseline answers a different question than "how am I right now" — but the switch is
   still visibly on the page, so picking "7 days" and seeing the "vs" numbers not move reads as
   broken rather than deliberate.
2. The card stacks the recovery pill ("ready" / "fully recovered, per Garmin") directly above the
   Garmin-mode sentence ("Garmin: peak readiness — recovery complete, …"), which says the same fact
   — recovery is done — twice in two different phrasings before ever reaching the channel numbers.

## Requirements (acceptance criteria)

- [x] The condition card's channel baselines follow the page's range switch for 7/14/30, and are
      capped at 30 days for 365/"all" — never widen past spec 047's original ceiling.
- [x] The "Recovery channels" subtitle states the actual window ("vs your last {n} days") instead of
      the unstated "against your baseline from recent days".
- [x] The Garmin-mode sentence no longer repeats the recovery clause the ticking pill already shows;
      it still carries that clause when read on its own (`garminSummary`, unchanged, for any other
      consumer) — only the card's compact rendering drops it.
- [x] Unit tests pass (no e2e).
- [x] Built only from `lib/ui` components + design tokens.
- [x] No secrets logged or committed.

## API contract

N/A — no endpoint or MCP tool shape changes. `ConditionSnapshot` gains `windowDays: number`;
`GarminReadiness` gains `headline: string` and `detailClause: string | null` (both additive).

## UI

`ConditionCard.svelte` only: the channels-block subtitle text, and the sentence shown beside the
recovery pill. No new `lib/ui` components; reuses existing typography tokens. Light/dark unaffected
(text-only change).

## Design / implementation notes

- `lib/range.ts` gains `capRange(range, maxDays)` — narrows a `ResolvedRange` to at most `maxDays`,
  keeping `end`. Generic, not baked to 30, so nothing outside the condition card is forced to know
  its ceiling.
- `+page.server.ts` now calls `loadInsights` with `range: capRange(range, CONDITION_WINDOW_DAYS)`
  instead of the old fixed `window: CONDITION_WINDOW_DAYS`. The MCP `insightsFor` caller
  (`lib/mcp/tools.ts`) is untouched — it has no range concept and keeps the fixed 30-day baseline.
- `insights.api.ts` threads its already-resolved `window` (the day count actually fetched) into
  `computeCondition` as `opts.windowDays`.
- `insights.condition.ts`: `ConditionSnapshot.windowDays` is `opts.windowDays`, falling back to the
  longest per-metric series length when omitted (every existing test that never passes it).
- `insights.garmin-readiness.ts`: two new pure helpers, `garminHeadline` and `garminDetailClause`,
  factor the same staleness/clause logic `garminSummary` already had, so the card can compose
  "headline — detail." without the recovery clause in the middle. `garminSummary` itself is
  untouched — same signature, same output, same tests — since it is the one full sentence contract
  another consumer could still want whole.
- `condition.channelsSubtitle` message gains a `{days}` placeholder in both `en.ts` and `pl.ts`
  (catalog-parity test enforces both change together).

## Test plan

- **Unit:** `insights.condition.test.ts` — `computeCondition` reports `windowDays` from `opts` and
  from series-length fallback. `insights.garmin-readiness.test.ts` — `garminHeadline` /
  `garminDetailClause` cover: no staleness, staleness, empty clauses. `range.test.ts` — `capRange`
  no-ops under the cap, narrows above it, keeps `end`.
- **API integration:** none needed — `+page.server.ts` has no dedicated test file; covered by the
  unit tests above plus existing `insights.api.test.ts` continuing to pass unchanged.

## Closeout

- Commits: <uncommitted — see `git log` after the next commit>
- Notes / follow-ups: `svelte-check` and the full `vitest run` suite (213 files, 2910 tests) pass.
  `lib/mcp/tools.ts`'s `insightsFor` caller was deliberately left on the fixed 30-day window — it has
  no range concept to follow.
