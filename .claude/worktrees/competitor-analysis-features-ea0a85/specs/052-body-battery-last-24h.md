# Spec 052 — Body Battery over the last 24 hours, not the last 30 days

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/insights/`
- **Owner agent:** module-dev
- **Depends on:** 022, 051

## Context

Spec 051 put a Body Battery chart on the condition card and drew it from the daily series the
insights engine already had: one point per day, each the day's *peak* charge, over 30 days. That
answers "how have the last weeks gone" — but the card's question is "how am I right now", and the
number beside the chart is already the day-vs-baseline comparison. The daily line said the same
thing twice, more slowly.

The payload has what the card actually wants. Garmin's Body Battery day carries
`bodyBatteryValuesArray` — `[epochMs, status, level, version]` rows at ~3-minute cadence, with a
null level wherever the watch recorded nothing. That is the overnight charge, the peak at waking and
the drain since: the curve behind today's number, at no extra fetch.

One trap worth naming: those timestamps are **true UTC epoch ms**, unlike sleep's
`*TimestampLocal` fields, which fold the wearer's offset in and are therefore read in UTC
(`insights.condition.ts`, `wallClock`). A Body Battery row read the same way would be labelled two
hours off.

## Requirements (acceptance criteria)

- [x] The card's chart shows Body Battery over the last 24 hours, on a wall-clock x axis in the
      app's timezone
- [x] The window ends at the newest reading, not at a wall-clock "now" — a watch that last synced at
      lunchtime shows its own last 24 h rather than a chart padded with empty hours
- [x] The window starts at the first reading inside it, so an account with only a few hours of data
      draws a few hours rather than mostly blank space
- [x] A gap in the readings keeps its slot as a hole in the line; the line is not drawn straight
      across hours the watch was off
- [x] Readings are bucketed rather than shipped raw: ~96 points instead of ~480, freshest value per
      bucket
- [x] Readings spanning the local-midnight boundary are found (Garmin's "day" payload starts at
      local midnight, so the last 24 h always straddles two payloads)
- [x] A malformed or absent intraday array yields an empty series and the card omits the block,
      rather than throwing or drawing a frame around nothing
- [x] `ConditionMetric.history` — added in 051, now unused — is removed rather than left as dead
      payload on every channel
- [x] The dev fixture serves a believable intraday curve, so the chart is visible under
      `GARMIN_ADAPTER=mock`
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No endpoint or MCP tool changes. Two shape changes inside the existing `GET /` loader payload
(`InsightsData.condition`):

```diff
 interface ConditionMetric {
   …
-  /** Recent in-window points, oldest→newest, gaps kept as null (chart material). */
-  history: DayPoint[];
 }

+/** One intraday reading: an instant (epoch ms, UTC) and the level measured at it. */
+interface IntradayPoint { at: number; value: number | null }
+
 interface ConditionSnapshot {
   …
+  /** Body Battery's last 24 h on a regular lattice; empty when there are no intraday readings. */
+  batteryDay: IntradayPoint[];
 }
```

## UI

`ConditionCard` only — same third hero column, same `TrendChart`, same cyan lane and 132px height as
spec 051. The x labels become `HH:MM` via `formatInstant(new Date(at), 'time')`, which resolves in
the app timezone (`Europe/Warsaw`) rather than UTC. The block meta reads "ostatnia doba" instead of a
day count.

## Design / implementation notes

- `extractBatteryIntraday` is pure and clock-free, like the rest of `insights.condition.ts`. That is
  why the window is anchored to the newest reading rather than to `now` — the module takes no
  `Clock`, and anchoring to the data is also the more honest answer for a watch that synced hours
  ago.
- It scans the last **three** day payloads. Garmin's day starts at local midnight, so one payload
  already reaches into the previous UTC day; three is slack for a timezone and a late sync at the
  cost of three array walks.
- Buckets are 15 minutes, aligned to the epoch grid. Whole-hour timezones therefore land on
  :00/:15/:30/:45 local. The last reading in a bucket wins — the freshest number the bucket saw.
- The lattice is built from bucket indices, not from the readings, which is what makes a gap a
  null slot instead of a missing point.

## Test plan

- **Unit:** `insights.condition.test.ts` — bucketing and freshest-wins; a gap surviving as null; the
  24 h ceiling; the short-history floor; readings joined across two day payloads; malformed rows,
  a non-array payload and an empty window all yielding `[]`.
- **Component:** `ConditionCard.svelte.test.ts` — the chart renders with its aria summary and the
  "ostatnia doba" meta, and its axis shows 06:00 for a 04:00 UTC reading (proving the timezone
  conversion); the block is omitted below two readings.
- **API integration:** unchanged; the full suite runs green.

## Closeout

- Implementing commit: `14bf280`
