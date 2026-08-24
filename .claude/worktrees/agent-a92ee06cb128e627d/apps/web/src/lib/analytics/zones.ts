/**
 * Intensity-zone bands — ONE table, used by the maths and by the copy that explains it (spec 086).
 *
 * The card that draws HR bars and a power donut never said where the boundaries come from, so
 * spec 086 added an `InfoPopover` that spells them out. The moment those numbers are written twice —
 * once in `powerZoneIndex`/`hrZoneIndex` and once in a Polish sentence — they start to drift, and a
 * confidently wrong explanation is worse than none. So the bands live here, once:
 *
 *  - `lib/server/analytics/activity-power.ts` derives its zone indices from this table;
 *  - `ActivityZones.svelte` renders the same table as prose.
 *
 * This module is CLIENT-SAFE on purpose. It cannot live beside the maths in `lib/server`, because a
 * component importing `$lib/server` fails the production build (SvelteKit's server-import guard).
 *
 * Zone NAMES are not stored here — they are i18n message keys (below), resolved against the active
 * catalog at render time. The table itself is numbers only, so it can be compared to the bucketing
 * functions in a test without a translator in the way.
 */
import type { MessageKey } from '$lib/i18n';

/**
 * One zone band, as a percentage of a reference value (FTP for power, max HR for heart rate).
 *
 * Bounds are `[fromPct, toPct)` — lower inclusive, upper EXCLUSIVE — which is exactly how the
 * bucketing functions compare (`pct < 76` puts 75.9 in Z2 and 76 in Z3). The top band has
 * `toPct: null` and is open-ended.
 */
export interface ZoneBand {
  /** 1-based zone number. */
  readonly zone: number;
  /** Inclusive lower bound, percent of the reference. */
  readonly fromPct: number;
  /** Exclusive upper bound, percent of the reference; `null` for the open-ended top band. */
  readonly toPct: number | null;
}

/**
 * Coggan power zones Z1–Z7 as a percentage of FTP. The canonical bands are quoted as
 * `<55 / 55–75 / 76–90 / 91–105 / 106–120 / 121–150 / >150`; expressed as half-open intervals over
 * real numbers that is `<55 / <76 / <91 / <106 / <121 / <151 / rest`.
 */
export const POWER_ZONE_BANDS: readonly ZoneBand[] = [
  { zone: 1, fromPct: 0, toPct: 55 },
  { zone: 2, fromPct: 55, toPct: 76 },
  { zone: 3, fromPct: 76, toPct: 91 },
  { zone: 4, fromPct: 91, toPct: 106 },
  { zone: 5, fromPct: 106, toPct: 121 },
  { zone: 6, fromPct: 121, toPct: 151 },
  { zone: 7, fromPct: 151, toPct: null }
];

/**
 * Our own five heart-rate bands as a percentage of max HR — the FALLBACK used only when Garmin sent
 * no per-zone seconds of its own. The max is this activity's observed maximum, not a configured
 * profile figure; the popover says so, because it materially changes what the top band means.
 */
export const HR_ZONE_BANDS: readonly ZoneBand[] = [
  { zone: 1, fromPct: 0, toPct: 60 },
  { zone: 2, fromPct: 60, toPct: 70 },
  { zone: 3, fromPct: 70, toPct: 80 },
  { zone: 4, fromPct: 80, toPct: 90 },
  { zone: 5, fromPct: 90, toPct: null }
];

/**
 * The zone a sample falls in, given its percentage of the reference.
 *
 * Ordered scan of half-open bands, so it reproduces a chain of `if (pct < x) return n` exactly —
 * including for `NaN` (every comparison is false, so the open-ended top band takes it) and for
 * negatives (the first band's lower bound is never checked, matching the original).
 */
export function zoneForPct(bands: readonly ZoneBand[], pct: number): number {
  for (const band of bands) {
    if (band.toPct === null || pct < band.toPct) return band.zone;
  }
  return bands[bands.length - 1]?.zone ?? 1;
}

/**
 * A band as the reader should see it: `<55%`, `55–75%`, `≥151%`.
 *
 * The displayed upper edge is `toPct - 1` because the bands are quoted over whole percents while the
 * comparison is exclusive — "55–75%" and `[55, 76)` are the same band for any integer reading.
 */
export function formatZoneBand(band: ZoneBand): string {
  if (band.toPct === null) return `≥${band.fromPct}%`;
  if (band.fromPct <= 0) return `<${band.toPct}%`;
  return `${band.fromPct}–${band.toPct - 1}%`;
}

/**
 * Message keys for the Coggan zone names, indexed by `zone - 1`. Keys rather than words: the names
 * are copy, and copy lives in the catalogs.
 */
export const POWER_ZONE_NAME_KEYS: readonly MessageKey[] = [
  'zones.power.z1.name',
  'zones.power.z2.name',
  'zones.power.z3.name',
  'zones.power.z4.name',
  'zones.power.z5.name',
  'zones.power.z6.name',
  'zones.power.z7.name'
];

/** Message keys for what each power zone is FOR, indexed by `zone - 1`. */
export const POWER_ZONE_USE_KEYS: readonly MessageKey[] = [
  'zones.power.z1.use',
  'zones.power.z2.use',
  'zones.power.z3.use',
  'zones.power.z4.use',
  'zones.power.z5.use',
  'zones.power.z6.use',
  'zones.power.z7.use'
];

/** One power zone as the explanation needs it: its range, plus the keys naming it. */
export interface PowerZoneCopy {
  readonly zone: number;
  /** Pre-formatted band, e.g. `91–105%`. Locale-independent: digits and a percent sign. */
  readonly range: string;
  readonly nameKey: MessageKey;
  readonly useKey: MessageKey;
}

/**
 * The bands zipped with their message keys, so the component iterates one list instead of indexing
 * three in markup. Composed here, from the table, rather than re-listed anywhere else.
 */
export const POWER_ZONE_COPY: readonly PowerZoneCopy[] = POWER_ZONE_BANDS.map((band, i) => ({
  zone: band.zone,
  range: formatZoneBand(band),
  // Same length by construction; the invariant is asserted in `zones.test.ts`.
  nameKey: POWER_ZONE_NAME_KEYS[i]!,
  useKey: POWER_ZONE_USE_KEYS[i]!
}));
