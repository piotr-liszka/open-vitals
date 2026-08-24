/**
 * Choosing what the race predictor is allowed to extrapolate from, and when "before" is (spec 057).
 * PURE: rows in, `KnownBest[]` out. No store, no clock, no Garmin.
 *
 * Spec 043 fed the predictor `personalBests()` — even-pace projections over whole runs, where a 15 km
 * run's "5 km best" is `duration × (5/15)`. Spec 054 made real measured efforts cheap to read, so the
 * predictor should prefer them. It cannot prefer them *exclusively*, though: the backfill drains over
 * many sync ticks and a brand-new account has nothing derived yet, so an exclusive switch would empty
 * the card for exactly the people who just connected. Hence a per-distance fallback — measured where
 * it exists, projected where it does not, and every source labelled with which it was.
 */
import { EFFORT_DISTANCES, type EffortDistance } from '$lib/analytics/best-efforts';
import type { KnownBest } from '$lib/analytics/race-predictor';
import { addDays, type DayKey } from '$lib/date';

/**
 * How far back the "have I improved?" comparison reaches.
 *
 * A training block is 8–12 weeks, so 90 days is the shortest window that reliably sits OUTSIDE the
 * current block: the badge then reads "versus the form I brought into this block" rather than
 * "versus last week", which would mostly measure taper, weather and one bad session. Long enough that
 * a single rest week cannot flip the sign; short enough that the card still answers "am I improving
 * now" instead of staging a career retrospective.
 */
export const TREND_WINDOW_DAYS = 90;

/** The as-of day the trend compares against. Derived from the caller's `today` (injected clock). */
export function trendCutoff(today: DayKey): DayKey {
  return addDays(today, -TREND_WINDOW_DAYS);
}

/** A measured effort as the merge consumes it — structurally the store's `RankedBestEffort`. */
export interface MeasuredEffort {
  /** `EFFORT_DISTANCES` key, e.g. `5k`. */
  readonly key: string;
  readonly durationS: number;
  /** Metres the fastest window ACTUALLY covered (≥ the nominal target). */
  readonly actualM: number;
  /** Local `YYYY-MM-DD` of the activity the effort came from. */
  readonly day: string;
}

/** An even-pace projection as the merge consumes it — structurally `RunningBest`. */
export interface ProjectedBest {
  readonly key: string;
  readonly label: string;
  readonly meters: number;
  readonly timeS: number;
  readonly day: string;
}

const EFFORT_BY_KEY: ReadonlyMap<string, EffortDistance> = new Map(EFFORT_DISTANCES.map((d) => [d.key, d]));

/**
 * One source best per distance, measured first.
 *
 * · A distance with a measured effort uses `(actualM, durationS)` — the pair actually run, not the
 *   nominal target, so a coarse sample interval cannot flatter the extrapolation.
 * · A distance with no measured effort keeps its projection, tagged `projected`.
 * · Distances only the efforts know about (`400m`, `mile`, `15k`) are kept: more sources means
 *   `closestBest` has a nearer one to extrapolate from, which is the whole honesty argument of spec 043.
 * · An effort key that is not in `EFFORT_DISTANCES` (a row left over from an older distance set) is
 *   dropped rather than labelled with its raw key.
 * · Several rows may share a key (the leaderboard returns a podium); the fastest wins.
 */
export function knownBestsFrom(
  efforts: readonly MeasuredEffort[],
  projections: readonly ProjectedBest[]
): KnownBest[] {
  const byKey = new Map<string, KnownBest>();

  for (const p of projections) {
    if (!(p.meters > 0) || !(p.timeS > 0)) continue;
    byKey.set(p.key, { metres: p.meters, timeS: p.timeS, label: p.label, day: p.day, basis: 'projected' });
  }

  for (const e of efforts) {
    const distance = EFFORT_BY_KEY.get(e.key);
    if (!distance) continue;
    if (!(e.actualM > 0) || !(e.durationS > 0)) continue;
    const existing = byKey.get(e.key);
    // A measured effort always beats a projection; between two measured rows, the faster one wins.
    if (existing?.basis === 'measured' && existing.timeS <= e.durationS) continue;
    byKey.set(e.key, {
      metres: e.actualM,
      timeS: e.durationS,
      label: distance.label,
      day: e.day,
      basis: 'measured'
    });
  }

  // Shortest first, so the array reads the way the distances do.
  return [...byKey.values()].sort((a, b) => a.metres - b.metres);
}
