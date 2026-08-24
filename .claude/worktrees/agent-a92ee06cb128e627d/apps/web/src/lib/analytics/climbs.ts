/**
 * Climbs inside an activity, with VAM (spec 046). PURE: elevation and distance axes in, climbs out. No
 * store, no clock, no Garmin.
 *
 * The activity page reports total elevation gain, which answers "how hilly was it" and not "what did I
 * climb". Those are different questions: 600 m spread over rolling terrain and 600 m in one 8 km ascent are
 * the same number and nothing alike. Strava's segments answer it indirectly; nothing in this app answers it
 * at all.
 *
 * **VAM** (velocità ascensionale media — metres of ascent per hour) is the number that makes climbs
 * comparable: it is to climbing what pace is to the flat, and it does not care how long the climb was.
 *
 * ## Detecting a climb
 *
 * One pass with a "currently climbing" state and a **drop tolerance**: a climb continues through a short
 * descent, because real roads have false flats and dips, and splitting on every metre lost would turn one
 * mountain pass into thirty climbs. A run of descent longer than `MAX_DROP_M` ends it.
 *
 * A candidate is kept only if it clears BOTH a minimum gain and a minimum average gradient. The gain gate
 * alone would accept a 20 km drag at 0.5%; the gradient gate alone would accept a 30 m hump.
 *
 * ## Honesty
 *
 * · Elevation from a barometer drifts and from GPS is worse. Categories here are a rough guide, and the
 *   category boundaries are one table so they can be re-tuned in one line.
 * · VAM is computed over the climb's own elapsed time, including any pause inside it. A long stop mid-climb
 *   genuinely lowered the average rate of ascent.
 */

/** Descent tolerated inside a climb before it counts as ended. */
export const MAX_DROP_M = 10;
/** Minimum total gain for a climb to be worth reporting. */
export const MIN_GAIN_M = 30;
/** Minimum average gradient, in percent. */
export const MIN_GRADE_PCT = 2;

/**
 * Cycling-style categories by "climb score" (gain × average gradient), loosely following the convention
 * used for road racing. Deliberately one table.
 */
export const CATEGORIES: readonly {
  readonly key: string;
  readonly label: string;
  readonly minScore: number;
}[] = [
  { key: 'hc', label: 'HC', minScore: 80_000 },
  { key: 'c1', label: '1. kat.', minScore: 64_000 },
  { key: 'c2', label: '2. kat.', minScore: 32_000 },
  { key: 'c3', label: '3. kat.', minScore: 16_000 },
  { key: 'c4', label: '4. kat.', minScore: 8000 },
  { key: 'uncat', label: 'Bez kat.', minScore: 0 }
];

export interface Climb {
  /** 1-based, in the order they were climbed. */
  readonly index: number;
  readonly gainM: number;
  readonly distanceM: number;
  readonly durationS: number;
  /** Average gradient over the climb, percent. */
  readonly gradePct: number;
  /** Metres of ascent per hour — the pace of a climb. */
  readonly vam: number;
  /** Elapsed seconds at which the climb started, so a view can point at it on a chart. */
  readonly startS: number;
  /** Gain × gradient, the score the category comes from. */
  readonly score: number;
  readonly categoryKey: string;
  readonly categoryLabel: string;
}

/** Category for a climb score. */
export function categoryFor(score: number): { key: string; label: string } {
  for (const c of CATEGORIES) {
    if (score >= c.minScore) return { key: c.key, label: c.label };
  }
  // The table ends at 0, so this is unreachable for a finite score; kept so the return type is honest.
  return { key: 'uncat', label: 'Bez kat.' };
}

/**
 * Climbs found along an activity. All three axes must be index-aligned (`elevationSeconds` /
 * `cumulativeDistance` / `elapsedSeconds` from `activity-charts.ts` produce exactly that).
 */
export function findClimbs(
  elevation: readonly number[] | null | undefined,
  cumulativeM: readonly number[] | null | undefined,
  elapsedS: readonly number[] | null | undefined
): Climb[] {
  if (!elevation || !cumulativeM || !elapsedS) return [];
  const n = Math.min(elevation.length, cumulativeM.length, elapsedS.length);
  if (n < 3) return [];

  interface Open {
    startIndex: number;
    /** Highest point reached so far, and where — a climb's gain is measured to its PEAK, not to its end. */
    peakIndex: number;
    peakElevation: number;
    startElevation: number;
  }

  const climbs: Climb[] = [];
  let open: Open | null = null;

  const finish = (o: Open): void => {
    const gainM = o.peakElevation - o.startElevation;
    const distanceM = (cumulativeM[o.peakIndex] ?? 0) - (cumulativeM[o.startIndex] ?? 0);
    const durationS = (elapsedS[o.peakIndex] ?? 0) - (elapsedS[o.startIndex] ?? 0);
    if (!(gainM >= MIN_GAIN_M) || !(distanceM > 0) || !(durationS > 0)) return;

    const gradePct = (gainM / distanceM) * 100;
    if (!(gradePct >= MIN_GRADE_PCT)) return;

    const score = Math.round(gainM * gradePct);
    const category = categoryFor(score);
    climbs.push({
      index: climbs.length + 1,
      gainM: Math.round(gainM),
      distanceM: Math.round(distanceM),
      durationS: Math.round(durationS),
      gradePct: round1(gradePct),
      // Metres per hour: the climb's rate of ascent, pauses included.
      vam: Math.round((gainM / durationS) * 3600),
      startS: Math.round(elapsedS[o.startIndex] ?? 0),
      score,
      categoryKey: category.key,
      categoryLabel: category.label
    });
  };

  for (let i = 1; i < n; i++) {
    const here = elevation[i];
    const previous = elevation[i - 1];
    if (here === undefined || previous === undefined) continue;
    if (!Number.isFinite(here) || !Number.isFinite(previous)) continue;

    if (here > previous) {
      // Rising: open a climb if none is open, and track the peak.
      if (!open) {
        open = {
          startIndex: i - 1,
          peakIndex: i,
          peakElevation: here,
          startElevation: previous
        };
      } else if (here > open.peakElevation) {
        open.peakElevation = here;
        open.peakIndex = i;
      }
      continue;
    }

    if (!open) continue;
    // Falling: a climb survives a dip, and ends once the drop from its peak exceeds the tolerance.
    if (open.peakElevation - here > MAX_DROP_M) {
      finish(open);
      open = null;
    }
  }

  if (open) finish(open);
  return climbs;
}

/** Total ascent across the detected climbs — how much of the day's gain was actual climbing. */
export function climbedMetres(climbs: readonly Climb[]): number {
  return climbs.reduce((sum, c) => sum + c.gainM, 0);
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
