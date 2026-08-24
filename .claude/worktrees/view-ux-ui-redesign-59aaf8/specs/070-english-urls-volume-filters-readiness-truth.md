# Spec 070 — English URLs, volume filters, and two readiness numbers that tell the truth

- **Status:** Closed
- **Module:** `apps/web/src/modules/{volume,insights,activity-detail,training,activities}/`, `apps/web/src/lib/ui/YearGrid.svelte`, `apps/web/src/routes/**`
- **Owner agent:** module-dev
- **Depends on:** 022, 025, 037, 046, 048, 059, 067

## Context

Six unrelated defects reported from real use of the app, grouped because five of them are small and
the sixth needs the fix from the fifth to make sense.

1. **Route segments were written in Polish** (`/training/objetosc`, `/activities/mapa`). A URL is an
   identifier — read by bookmarks, logs, MCP clients and anyone pasting a link — not interface copy.
2. **"Rok do roku" could only be read for every sport at once.** For a multi-sport athlete (see the
   project's own premise) the combined curve hides the thing worth knowing: whether the running is up
   because the riding is down.
3. **Three blocks answered the same question over three different spans.** The monthly bars covered a
   rolling 24 months, the consistency grid covered the calendar year, the table covered the bars' 24 —
   so "Regularność 2026" sat between two blocks that were not about 2026.
4. **The "Warto zauważyć" cards did not line up.** The badge shared a `space-between` row with the
   label, so it wrapped for long labels and did not for short ones, putting four cards' numbers,
   sentences and ranks on four different baselines.
5. **The card announced "153 dni do pełnej regeneracji".** Garmin's `recoveryTime` field is in
   MINUTES; spec 059 read it as hours on the strength of a wrapper library's docstring. A 3672-minute
   (61-hour) timer therefore rendered as 153 days — longer than any Garmin device can produce, since
   the timer caps out around four days.
6. **The two readiness scores disagreed wildly** — Garmin 1, ours 40, on the same morning. Spec 059
   noted this and called both correct. They *are* answering different questions, but ours was also
   structurally blind to the input that drove Garmin's: the recovery timer from (5).

## Requirements (acceptance criteria)

**URLs**

- [x] `/training/objetosc|bieg|marsz|rower|cele` and `/activities/mapa` are now `/training/volume|run|walk|ride|goals` and `/activities/map`.
- [x] Every old path returns **HTTP 308** to its new one, carrying the query string across, so a shared filtered link stays filtered.
- [x] `/power`, `/running` and `/heatmap` (the pre-existing shims) point at the new paths.
- [x] Tab **labels** stay Polish. Only the path is English.

**Year over year**

- [x] The card carries a sport filter: `Wszystko` plus every family the athlete actually has.
- [x] The curves, the ahead/behind verdict and the card subtitle all follow the choice.
- [x] A single-sport athlete gets **no** switch — its options would be the same curve twice.

**Period filter**

- [x] ONE control governs "Miesiąc po miesiącu", "Regularność" and "Miesiące", in its own header above all three.
- [x] Options: `Ostatnie 12 miesięcy` (default), then every calendar year with data, newest first.
- [x] The average- and best-month tiles move into that section and are computed over the selected period.
- [x] The consistency grid draws the selected span — including a rolling twelve months, which is not a calendar year.

**Highlight cards**

- [x] Label above badge on every card, so all four share one baseline.
- [x] The rank line is pinned to the card's bottom edge.
- [x] A personal record shows the green lane it was always meant to (a specificity bug had every record painted "notable" cyan).

**Recovery time**

- [x] `recoveryTime` is read as MINUTES throughout: parser, contract field (`RecoveryTime.minutes`), formatter, card, dev mock, MCP tool description.
- [x] `fmtRecovery` writes under an hour in minutes, then whole hours, then days.
- [x] A regression test pins the exact payload that produced "153 dni" to `2 dni 13 h`.

**Readiness**

- [x] A channel's baseline **excludes the day it is judging**. `buildConditionMetric` always did; `computeReadiness` did not, so the same card's deltas and its score disagreed about what "your baseline" meant.
- [x] Garmin's recovery timer imposes a **ceiling** on our own score: 24 h caps it at 67, 48 h at 33, 61 h at 15.
- [x] The ceiling only ever lowers a score, and is absent for accounts with no Training Readiness — those see exactly the previous behaviour.
- [x] When the ceiling bites, the gauge says so in one line, because the driver chips no longer sum to the number above them.
- [x] The "Skąd ta liczba" popover explains the ceiling and still says the two scores can differ.

**Always**

- [x] Unit + API-integration tests pass (no e2e) — 2045 passing.
- [x] Built only from `lib/ui` components + design tokens.
- [x] No secrets logged or committed.

## API contract

No new HTTP endpoint. Three contracts change:

```
modules/insights/insights.types.ts
  RecoveryTime.hours: number        →  RecoveryTime.minutes: number
  Readiness                         +  limitedBy: ReadinessLimit | null
  ReadinessLimit  { key: 'recovery', label, minutes, uncapped }

modules/volume/volume.types.ts
  VolumeData.avgDistanceM / .bestMonth   removed — period-scoped now, see volume.period.ts
  VolumeData.gridYear                    → .today  (the grid's right-hand edge)
  VolumeData                             + yearsBySport: Record<VolumeSportFilter, VolumeYearsFor>
                                         + sportOptions: VolumeSportOption[]
  WINDOW_MONTHS 24 → 48 (= WINDOW_YEARS × 12), so any offered year has bars
```

`get_readiness` (MCP) gains `limitedBy` by flowing through the same `Readiness` shape.
`get_training_readiness`'s description now states that `recoveryTime` is minutes.

## UI

`Card`, `StatTile`, `Badge`, `SegmentedControl`, `BarChart`, `TrendChart`, `YearGrid`, `InfoPopover`.
`YearGrid` gains optional `from`/`to`/`spanLabel` — it draws any range, not only a calendar year, and
its quantile shading and active-day count are taken over the **drawn** span rather than over the whole
payload (the loader now hands it four years so the period switch costs no round trip).

States: an empty sport filter selection renders "Brak aktywności w tej dyscyplinie w ostatnich latach"
rather than an empty chart; a period with no complete month drops the average/best tiles instead of
showing a zero; a stale remembered year falls back to the rolling window.

## Design / implementation notes

**Why the recovery ceiling is a ceiling and not a fifth weighted channel.** The four channels are a
deviation index — each z-scored against its own last 30 days. That has a blind spot by construction:
an athlete a month deep in training has a *tired* baseline, so being tired reads as z ≈ 0, i.e.
"normal", i.e. 50. A weighted recovery term would have moved 40 to ~34 and left the blind spot intact.

Garmin's own score is not a mean either. Its factors that morning were 68 / 71 / 73 / 19 / 36 / 60 —
a weighted mean of those is ~55, and Garmin answered **1**, tagged `RECOVERY_TIME_LIMITED`. One
crushing input pins the score rather than being averaged away. That is also the physiologically honest
model: sleeping well does not discharge a 61-hour recovery debt. So the channels keep answering their
own question and the timer sets a lid over the top, landing at 15 — close to Garmin's own 19% recovery
factor for that timer, and firmly in the same "do not train hard today" band.

The two numbers still will not match, and the popover says why: ours measures deviation from a personal
norm and cannot see ACWR or stress history at all.

**Unit evidence for minutes.** Third-party clients disagree in their field *naming*, but
`Taxuspt/garmin_mcp` converts explicitly — `round(r.get('recoveryTime', 0) / 60, 1)` into
`recovery_time_hours`. Combined with the reported data (3672 → 61 h, matching a watch reading 43 h
some hours later as the timer counted down) that is decisive. Deliberately NOT auto-detected from
magnitude: a field that means minutes above some threshold and hours below it would render the same
payload in two different units on two different days.

**Client-side filtering.** Both new filters slice data the loader already holds, like the existing
measure switch on the same page. The store read was already bounded by the four-year year-over-year
window, so neither filter adds a query.

## Test plan

- **Unit:** `volume.period.test.ts` (options, slicing, rolling vs calendar year, stale-year fallback,
  period-scoped average/best); `insights.engine.test.ts` (baseline excludes the judged day; ceiling
  absent / too short to bite / biting at 61 h / never raising a score); `insights.garmin-readiness.test.ts`
  (`fmtRecovery` in minutes, plus the exact "153 dni" payload); `YearGrid.svelte.test.ts` (arbitrary
  span, year boundary, span-scoped quantiles and count, inverted-range fallback).
- **Integration:** `volume.api.test.ts` (per-sport curves, `all` mirrors the flat fields, no split for
  a single-sport athlete, grid days across the whole window); `consolidated-redirects.test.ts` (all six
  moved paths, status and query); `insights.api.test.ts` (recovery minutes end to end).
- **Component:** `VolumeView.svelte.test.ts` (both filters re-scope what they own);
  `ConditionCard.svelte.test.ts`; `ActivityFlags.svelte.test.ts`.

## Closeout

Landed together because the readiness work (6) depends on the unit fix (5), and the two volume filters
(2, 3) rewrite the same view. `WINDOW_MONTHS` doubling to 48 is the one payload-size change worth
noting: months are cheap, and the four years of grid days are shipped as active days only.

Known follow-up: the period choice is not remembered across visits — the other switches on this page
are not either, so remembering one and not the others would be the inconsistent option. If it is worth
remembering, `readEnumPref`/`writePref` is the established mechanism and the values are stable strings.
