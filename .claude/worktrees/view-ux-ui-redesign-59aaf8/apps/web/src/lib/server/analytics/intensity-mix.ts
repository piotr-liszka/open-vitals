/**
 * Where the training time actually went, by intensity (spec 044). PURE compute over activity summaries —
 * no store, no clock, no Garmin.
 *
 * The training page says how MUCH the athlete trained. It cannot say how much of it was easy, which is the
 * question behind the most repeated piece of endurance advice there is: roughly 80% of training time
 * should be comfortably aerobic, and most self-coached athletes do far less than that — their easy runs
 * creep up and their hard sessions are not hard enough. Garmin hints at this with Training Load Focus;
 * Strava does not address it at all.
 *
 * ## Why average heart rate, and not zone streams
 *
 * A per-session average HR against the athlete's max classifies every synced session, from the summary
 * alone, for every sport. Reading zone streams would be more precise per session and would cost a stream
 * read per activity — and it would still be wrong for the same reason: an interval session averages into
 * the moderate band whatever its zone split says.
 *
 * That trade-off is the honest limitation of this metric and it is stated in the view: a session's BAND is
 * a summary of its average, not of its shape. It answers "is my easy training actually easy?" — the
 * question that matters at the weekly scale — and not "what did this interval session consist of?".
 *
 * ## Honesty
 *
 * · Without a max heart rate nothing can be classified, and the result says so rather than guessing one
 *   from age (we do not hold a birth date, and 220−age is a poor estimate anyway).
 * · Sessions with no average HR are counted as `unclassified`, never silently folded into `easy`. A watch
 *   worn without a strap must not make the mix look better than it was.
 */

/** Fraction of max HR below which a session counts as comfortably aerobic. */
export const EASY_CEILING = 0.8;
/** Fraction of max HR above which a session counts as hard. */
export const HARD_FLOOR = 0.87;
/** The share of easy time the polarised model asks for. */
export const EASY_TARGET_PCT = 80;
/** How far from the target still counts as "on model" — a few points either way is not a problem. */
export const EASY_TOLERANCE_PCT = 5;

export type IntensityBand = 'easy' | 'moderate' | 'hard';

/** One session reduced to what the mix needs. */
export interface IntensitySession {
  readonly day: string;
  readonly durationS: number | null;
  readonly avgHr: number | null;
  readonly trainingLoad: number | null;
}

export interface BandShare {
  readonly band: IntensityBand;
  readonly sessions: number;
  readonly seconds: number;
  /** Share of CLASSIFIED time, 0–100. */
  readonly pct: number;
  /** Summed training load attributed to the band; 0 when no session carried load. */
  readonly load: number;
}

export type MixVerdict = 'on-model' | 'too-hard' | 'too-easy' | 'unknown';

export interface IntensityMix {
  readonly bands: readonly BandShare[];
  /** Share of classified time that was easy, 0–100; `null` when nothing could be classified. */
  readonly easyPct: number | null;
  /** Sessions with no average heart rate — excluded from the shares, never folded into `easy`. */
  readonly unclassifiedSessions: number;
  readonly classifiedSessions: number;
  readonly verdict: MixVerdict;
  /** Polish sentence naming what the mix implies. */
  readonly advice: string;
  /** The max HR the classification used; `null` when none was available. */
  readonly maxHr: number | null;
}

const ADVICE: Record<MixVerdict, string> = {
  'on-model':
    'Rozkład intensywności jest zgodny z modelem spolaryzowanym — większość czasu spokojnie, reszta naprawdę mocno. To najlepiej udokumentowany sposób budowania wytrzymałości.',
  'too-hard':
    'Zbyt mała część treningu jest spokojna. Najczęstszy błąd samodzielnie trenujących: łatwe biegi robią się średnio szybkie, a mocne przestają być mocne. Zwolnij na spokojnych jednostkach, a nie skracaj ich.',
  'too-easy':
    'Prawie cały trening jest spokojny. Baza tlenowa rośnie, ale bez regularnych mocnych bodźców tempo na zawodach zwykle stoi w miejscu. Wystarczy jedna–dwie intensywne jednostki w tygodniu.',
  unknown:
    'Bez maksymalnego tętna nie da się zaklasyfikować intensywności. Ustaw je w ustawieniach lub zsynchronizuj trening z pomiarem tętna.'
};

const BAND_ORDER: readonly IntensityBand[] = ['easy', 'moderate', 'hard'];

/** Which band an average heart rate falls in, as a fraction of max. */
export function bandFor(avgHr: number, maxHr: number): IntensityBand {
  const fraction = avgHr / maxHr;
  if (fraction < EASY_CEILING) return 'easy';
  if (fraction < HARD_FLOOR) return 'moderate';
  return 'hard';
}

/**
 * Time and load split across the three bands.
 *
 * `maxHr` is required: without it nothing can be classified, and the result says so rather than inventing
 * an age-based estimate we have no birth date for.
 */
export function intensityMix(sessions: readonly IntensitySession[], maxHr: number | null): IntensityMix {
  const empty = (band: IntensityBand): BandShare => ({
    band,
    sessions: 0,
    seconds: 0,
    pct: 0,
    load: 0
  });

  if (!maxHr || !(maxHr > 0)) {
    return {
      bands: BAND_ORDER.map(empty),
      easyPct: null,
      unclassifiedSessions: sessions.length,
      classifiedSessions: 0,
      verdict: 'unknown',
      advice: ADVICE.unknown,
      maxHr: null
    };
  }

  const buckets = new Map<IntensityBand, { sessions: number; seconds: number; load: number }>(
    BAND_ORDER.map((b) => [b, { sessions: 0, seconds: 0, load: 0 }])
  );
  let unclassified = 0;
  let classified = 0;
  let totalSeconds = 0;

  for (const s of sessions) {
    const seconds = isNum(s.durationS) && s.durationS > 0 ? s.durationS : 0;
    if (!isNum(s.avgHr) || s.avgHr <= 0 || seconds === 0) {
      unclassified++;
      continue;
    }
    const bucket = buckets.get(bandFor(s.avgHr, maxHr));
    if (!bucket) continue;
    bucket.sessions++;
    bucket.seconds += seconds;
    bucket.load += isNum(s.trainingLoad) && s.trainingLoad > 0 ? s.trainingLoad : 0;
    classified++;
    totalSeconds += seconds;
  }

  const bands: BandShare[] = BAND_ORDER.map((band) => {
    const b = buckets.get(band) ?? { sessions: 0, seconds: 0, load: 0 };
    return {
      band,
      sessions: b.sessions,
      seconds: Math.round(b.seconds),
      // Share of CLASSIFIED time: including unclassified sessions in the denominator would make every
      // strapless session look like a shortfall in easy training.
      pct: totalSeconds > 0 ? round1((b.seconds / totalSeconds) * 100) : 0,
      load: Math.round(b.load)
    };
  });

  const easyPct = totalSeconds > 0 ? (bands.find((b) => b.band === 'easy')?.pct ?? 0) : null;
  const verdict = verdictFor(easyPct);

  return {
    bands,
    easyPct,
    unclassifiedSessions: unclassified,
    classifiedSessions: classified,
    verdict,
    advice: ADVICE[verdict],
    maxHr
  };
}

function verdictFor(easyPct: number | null): MixVerdict {
  if (easyPct === null) return 'unknown';
  if (easyPct < EASY_TARGET_PCT - EASY_TOLERANCE_PCT) return 'too-hard';
  // "Too easy" needs a wide margin: 85% easy is a perfectly good week, 97% is a base block with no stimulus.
  if (easyPct > 95) return 'too-easy';
  return 'on-model';
}

/* --------------------------------------------------------------------- *
 * Intensity minutes (spec 045)
 *
 * The WHO's 150-minutes-a-week guideline — the one volume target that exists for
 * everybody rather than for athletes, and the natural companion to the mix
 * above because it uses the same classification.
 * --------------------------------------------------------------------- */

/** Weekly target, in weighted minutes. */
export const WEEKLY_TARGET_MINUTES = 150;

export interface IntensityWeek {
  /** Monday of the week, `YYYY-MM-DD`. */
  readonly week: string;
  readonly moderateMinutes: number;
  readonly vigorousMinutes: number;
  /** Moderate + 2× vigorous, the way the guideline counts them. */
  readonly weightedMinutes: number;
  readonly metTarget: boolean;
}

/**
 * Weighted intensity minutes per week, on a caller-supplied week lattice.
 *
 * Weeks with no qualifying activity are ZEROS rather than gaps — unlike the efficiency trend, a week with
 * no training genuinely scored no minutes, and that is the whole point of a guideline.
 *
 * Easy-band time counts for nothing here, deliberately, and that is the difference between this and the
 * volume chart: a gentle stroll is good for you but is not moderate-intensity activity.
 */
export function weeklyIntensityMinutes(
  sessions: readonly IntensitySession[],
  weeks: readonly string[],
  maxHr: number | null,
  mondayOf: (day: string) => string
): IntensityWeek[] {
  const buckets = new Map<string, { moderate: number; vigorous: number }>(
    weeks.map((w) => [w, { moderate: 0, vigorous: 0 }])
  );

  if (maxHr && maxHr > 0) {
    for (const s of sessions) {
      if (!isNum(s.avgHr) || s.avgHr <= 0 || !isNum(s.durationS) || s.durationS <= 0) continue;
      const band = bandFor(s.avgHr, maxHr);
      if (band === 'easy') continue;
      const bucket = buckets.get(mondayOf(s.day));
      if (!bucket) continue;
      const minutes = s.durationS / 60;
      if (band === 'moderate') bucket.moderate += minutes;
      else bucket.vigorous += minutes;
    }
  }

  return weeks.map((week) => {
    const b = buckets.get(week) ?? { moderate: 0, vigorous: 0 };
    const moderateMinutes = Math.round(b.moderate);
    const vigorousMinutes = Math.round(b.vigorous);
    const weightedMinutes = moderateMinutes + vigorousMinutes * 2;
    return {
      week,
      moderateMinutes,
      vigorousMinutes,
      weightedMinutes,
      metTarget: weightedMinutes >= WEEKLY_TARGET_MINUTES
    };
  });
}

const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
