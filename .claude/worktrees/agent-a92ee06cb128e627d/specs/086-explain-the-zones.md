# Spec 086 — Skąd się biorą strefy: wyjaśnienie przy "Strefach intensywności"

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/activity-detail/`
- **Owner agent:** module-dev
- **Depends on:** 016, 026, 059 (InfoPopover)

## Context

"Strefy intensywności" shows two zone breakdowns side by side and explains neither. The athlete
asked directly: *do we set these zones somewhere?* The honest answer is "it depends, and the card
never says which case you are looking at" — which is exactly the failure `InfoPopover` was built for
in spec 059.

The truth, traced:

- **Heart rate, preferred source.** Garmin's own `hrTimeInZone_1..5`, i.e. the zones the athlete
  configured **on Garmin**, not here. Garmin sends only the seconds per zone — never the bpm
  boundaries — which is why the bars can say `Strefa 1..5` and nothing more.
- **Heart rate, fallback.** When Garmin sent no per-zone seconds we bucket the HR stream ourselves at
  **<60 / <70 / <80 / <90 / ≥90 % of max HR** (`hrZoneIndex`). The max used is **this activity's own
  observed maximum**, not a profile figure — so the top zone is nearly guaranteed to be reached and
  the split is only as good as that assumption. The card must say this, not imply a configured zone.
- **Power, always ours.** Coggan Z1–Z7 as a percentage of FTP:
  **<55 / 55–75 / 76–90 / 91–105 / 106–120 / 121–150 / >150 %** (`powerZoneIndex`), with the usual
  names (recovery, endurance, tempo, threshold, VO2max, anaerobic, neuromuscular).
- **FTP.** `settings.ftpWatts` if set, otherwise **95% of the best 20-minute mean-max power** of this
  session. The card already prints "(szacowane z krzywej mocy)" for the estimate; the popover says
  what that estimate is and that everything downstream — zones, IF, TSS — moves with it.

There is no UI anywhere in the app that writes `ftpWatts`, `maxHrBpm` or `weightKg`, so in practice
the estimate is always what is on screen. Saying so is part of the explanation, not a footnote.

## Requirements (acceptance criteria)

- [x] An `InfoPopover` sits next to the "Strefy intensywności" card title, labelled so a screen
      reader hears a question ("Skąd się biorą te strefy?").
- [x] The panel explains the **heart-rate** side and names which of the two sources is on screen for
      THIS activity — Garmin's configured zones, or our %-of-max estimate — rather than describing
      both and leaving the reader to guess.
- [x] When the %-of-max fallback is in use, the panel states the five bands and that the maximum used
      is this session's own observed max, not a configured one.
- [x] The panel explains the **power** side: Coggan Z1–Z7 with their percentage bands and what each
      zone is for, plus the FTP the percentages are taken from and whether it was configured or
      estimated at 95% of the best 20-minute power.
- [x] The power half of the panel is absent when the activity has no power zones — an explanation of
      a donut that is not on screen is noise.
- [x] Zone bands and names are NOT re-typed in the component. They come from one exported table so
      the copy cannot drift from `powerZoneIndex`/`hrZoneIndex`, which is the only failure mode that
      matters here.
- [x] Copy lives in `pl.ts` + `en.ts`; no hardcoded strings in the component.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No new endpoint. `ActivityDetailData` already carries `ftp` and `ftpEstimated`; the HR block gains
nothing at the type level because the source is already derivable from `buildHrZones(...).source`.

## UI

`InfoPopover` (spec 059) in the `Card` header of `ActivityZones.svelte`, `align="end"`. States:
Garmin-sourced HR / estimated HR / with power / without power. Light + dark via tokens only.

## Design / implementation notes

- The single source of truth for the bands is a small exported table beside `powerZoneIndex` and
  `hrZoneIndex` in `lib/server/analytics/activity-power.ts` — but the component cannot import
  `$lib/server`, so the table lives in a client-safe module and `activity-power.ts` derives its
  thresholds from it, not the other way round. A duplicated table that drifts is the whole risk.
- Zone NAMES (recovery/endurance/tempo/…) are i18n keys, not part of the table.

## Test plan

- **Unit:** the band table matches `powerZoneIndex`/`hrZoneIndex` for every boundary value
  (54/55/75/76/90/91/105/106/120/121/150/151 % FTP; 59/60/69/70/79/80/89/90 % max HR) — this is the
  test that makes the shared table worth having.
- **Component:** the popover names Garmin as the source when `stats.hr.timeInZoneS` is populated and
  the estimate when it is not; the power half is absent when `power` is null; the FTP sentence says
  "estimated" when `ftpEstimated` is true and "configured" when it is false.

## Closeout

- Commits: this change.
- The shared table landed at `lib/analytics/zones.ts` (client-safe, beside `race-predictor.ts`), and
  `lib/server/analytics/activity-power.ts` now derives `powerZoneIndex`/`hrZoneIndex` from it rather
  than keeping its own if-chain. Behaviour is unchanged at every boundary, including the NaN case,
  and `activity-power.test.ts` gained a parity test that goes through the PUBLIC `powerZones`/
  `hrZones` so the two can never drift silently.
- `Card` gained an opt-in `overflowVisible` prop. `.card { overflow: hidden }` is what keeps a
  full-bleed map inside the radius, but it also cuts a header popover in half — and this panel is
  seven zones plus four paragraphs, taller than the card it hangs from. Default off; this card is
  the only caller.
- `formatZoneBand` renders open-ended bands as `≥151%` / `≥90%` where this spec's prose says
  `>150 %`. Identical for any integer reading, and it keeps one formatter for both tables.
- The card's own title and subtitle are still inline Polish, as they were before this spec. Only the
  new copy went into the catalogs; moving the rest is its own change.
- Follow-ups:
  - Nothing in the app writes `settings.ftpWatts`, `maxHrBpm` or `weightKg`, so the popover always
    reports the estimated FTP and the HR fallback always uses the session's own observed maximum. A
    settings screen for the athlete's own profile figures would make three cards more honest at
    once — this one, "Ocena treningu" (IF/TSS) and the W/kg column, which never appears.
