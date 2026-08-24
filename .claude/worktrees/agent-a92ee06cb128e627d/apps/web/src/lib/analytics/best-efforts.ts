/**
 * Best efforts INSIDE one activity (spec 040) — Strava's "Best Efforts", built on the same idea as the
 * power curve we already ship.
 *
 * `meanMaxCurve` answers "the best average power I held for 5 minutes". This answers its distance-based
 * twin: "the fastest I covered 1 km at any point in this session". A 5 km personal best hidden inside a
 * 15 km long run is invisible on a whole-activity page, and it is exactly what the athlete wants told.
 *
 * PURE: cumulative distance and elapsed time in, efforts out. No store, no clock, no Garmin. Lives in
 * `lib/analytics/` (not `lib/server/`) for the same reason `efficiency.ts` does — the inputs come from
 * client-safe stream helpers, and keeping the pair together means neither can drift into a server-only
 * import that breaks the production build.
 *
 * ## The algorithm, and why it is a two-pointer
 *
 * For each target distance D we want the SHORTEST time window covering at least D metres. Because
 * cumulative distance is non-decreasing, a window that already covers D cannot get shorter by moving
 * its start backwards — so one forward pass with two indices finds the minimum in O(n) per distance
 * rather than O(n²). With eight target distances over a 30 000-sample ride that is the difference
 * between instant and unusable.
 *
 * ## Honesty
 *
 * · A target longer than the activity is simply absent, never a partial extrapolation.
 * · The window covers *at least* D, so its measured distance is reported alongside the time — the pace
 *   is computed over the distance actually covered, not over the nominal target. Otherwise a coarse
 *   sample interval would flatter every effort.
 * · Efforts come from the recorded stream, so they inherit its resolution. A watch sampling every 4 s
 *   cannot resolve a 400 m effort finely; `samples` is reported so a view can say so.
 */

/** A distance worth reporting a best effort for. */
export interface EffortDistance {
  readonly key: string;
  /** Polish label, e.g. "1 mila". */
  readonly label: string;
  readonly metres: number;
}

/**
 * The standard set, shortest first. Deliberately includes the mile and the two race distances: these
 * are the numbers athletes quote at each other, and a 10 km split inside a long run is a real result.
 */
export const EFFORT_DISTANCES: readonly EffortDistance[] = [
  { key: '400m', label: '400 m', metres: 400 },
  { key: '1k', label: '1 km', metres: 1000 },
  { key: 'mile', label: '1 mila', metres: 1609 },
  { key: '5k', label: '5 km', metres: 5000 },
  { key: '10k', label: '10 km', metres: 10_000 },
  { key: '15k', label: '15 km', metres: 15_000 },
  { key: 'half', label: 'Półmaraton', metres: 21_097 },
  { key: 'marathon', label: 'Maraton', metres: 42_195 }
];

export interface BestEffort {
  readonly key: string;
  readonly label: string;
  /** The nominal target. */
  readonly metres: number;
  /** Seconds of the fastest window covering at least `metres`. */
  readonly durationS: number;
  /** Metres the window ACTUALLY covered — always ≥ `metres`, and what the pace is computed over. */
  readonly actualM: number;
  /** Seconds per kilometre over `actualM`. */
  readonly paceSecPerKm: number;
  /** Elapsed seconds at which the window started, so a view can point at it on a chart. */
  readonly startS: number;
  /** Stream samples inside the window — the resolution behind the number. */
  readonly samples: number;
}

/**
 * Fastest window for every target distance the activity is long enough to contain, shortest distance
 * first. Both inputs must be index-aligned and non-decreasing — `elapsedSeconds` and
 * `cumulativeDistance` from `activity-charts.ts` produce exactly that.
 */
export function bestEfforts(
  cumulativeM: readonly number[] | null | undefined,
  elapsedS: readonly number[] | null | undefined,
  distances: readonly EffortDistance[] = EFFORT_DISTANCES
): BestEffort[] {
  if (!cumulativeM || !elapsedS) return [];
  const n = Math.min(cumulativeM.length, elapsedS.length);
  if (n < 2) return [];

  const total = (cumulativeM[n - 1] ?? 0) - (cumulativeM[0] ?? 0);
  const out: BestEffort[] = [];

  for (const d of distances) {
    // Never extrapolate: a target the session did not cover is absent, not estimated.
    if (!(total >= d.metres)) continue;

    let best: BestEffort | null = null;
    let j = 0;
    for (let i = 0; i < n; i++) {
      const startM = cumulativeM[i];
      const startT = elapsedS[i];
      if (startM === undefined || startT === undefined) continue;
      // `j` never moves backwards across iterations: that is what makes this linear.
      if (j < i) j = i;
      while (j < n && (cumulativeM[j] ?? 0) - startM < d.metres) j++;
      if (j >= n) break; // no window from here on can reach the distance

      const endM = cumulativeM[j];
      const endT = elapsedS[j];
      if (endM === undefined || endT === undefined) continue;
      const durationS = endT - startT;
      if (!(durationS > 0)) continue;

      const actualM = endM - startM;
      if (best === null || durationS < best.durationS) {
        best = {
          key: d.key,
          label: d.label,
          metres: d.metres,
          durationS: round1(durationS),
          actualM: Math.round(actualM),
          // Paced over what was actually covered, so a coarse sample interval cannot flatter it.
          paceSecPerKm: round1(durationS / (actualM / 1000)),
          startS: round1(startT),
          samples: j - i + 1
        };
      }
    }
    if (best) out.push(best);
  }

  return out;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
