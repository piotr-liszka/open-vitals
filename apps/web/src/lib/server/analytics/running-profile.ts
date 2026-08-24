/**
 * Running analytics (spec 018) — the pace-based counterpart to `power-profile.ts` for cyclists.
 * Pure functions over run summaries: personal bests per standard distance, weekly mileage, and
 * totals. HR-zone aggregation reuses `activity-power.hrZones` and is composed in the API handler
 * (it needs streams). No power/FTP concepts here — running is distance/pace/HR.
 */
import { startOfWeek } from '$lib/date';
import { createTranslator, DEFAULT_LOCALE, type Translator } from '$lib/i18n';
import { weeklyVolume } from './weekly-volume';

/** Fallback translator (Polish) for the ~90 non-web callers that predate spec 076's locale threading. */
const DEFAULT_TRANSLATOR = createTranslator(DEFAULT_LOCALE);

/** Minimal run summary the maths need (no streams). */
export interface RunSummary {
  activityId: string;
  /** local YYYY-MM-DD */
  day: string;
  distanceM: number | null;
  durationS: number | null;
  movingS: number | null;
}

export interface RunDistance {
  key: string;
  label: string;
  meters: number;
}

/**
 * Standard race distances we surface personal bests for. Built per-call from a `Translator`
 * (spec 076) because 'half'/'marathon' are real words, not units — '1 km'/'5 km'/'10 km' happen to
 * read the same in every locale this app ships, but are still resolved through `t()` for consistency.
 */
function runDistancesFor(t: Translator): readonly RunDistance[] {
  return [
    { key: '1k', label: t('runnerProfile.distanceName.1k'), meters: 1000 },
    { key: '5k', label: t('runnerProfile.distanceName.5k'), meters: 5000 },
    { key: '10k', label: t('runnerProfile.distanceName.10k'), meters: 10000 },
    { key: 'half', label: t('runningProfile.distance.half'), meters: 21097.5 },
    { key: 'marathon', label: t('runningProfile.distance.marathon'), meters: 42195 }
  ];
}

/** Standard race distances in the default (Polish) catalog, for callers that only need the shape. */
export const RUN_DISTANCES: readonly RunDistance[] = runDistancesFor(DEFAULT_TRANSLATOR);

export interface RunningBest {
  key: string;
  label: string;
  meters: number;
  /** Projected time for the exact distance (seconds), assuming even pace. */
  timeS: number;
  paceSecPerKm: number;
  activityId: string;
  day: string;
}

export interface WeekMileage {
  /** Monday (UTC) of the week, YYYY-MM-DD. */
  week: string;
  km: number;
  runs: number;
}

export interface RunningTotals {
  runs: number;
  totalKm: number;
  longestKm: number;
  totalTimeS: number;
  avgPaceSecPerKm: number | null;
}

/** Seconds per km for a run, or null when distance/duration is missing. */
export function paceSecPerKm(durationS: number | null, distanceM: number | null): number | null {
  if (!durationS || !distanceM || distanceM <= 0) return null;
  return durationS / (distanceM / 1000);
}

/**
 * Monday of the ISO week a day belongs to. Delegates to the shared civil-date helper (spec 018)
 * rather than round-tripping through `Date`/`toISOString()`, which is timezone-fragile.
 */
export function mondayOf(day: string): string {
  return startOfWeek(day);
}

/**
 * Fastest projected time for each standard distance. A run "covers" distance D when it is at least
 * D long; its even-pace projection for D is `duration * (D / distance)`. We take the fastest
 * projection across all covering runs — a solid PR proxy without in-run split streams.
 */
export function personalBests(
  runs: readonly RunSummary[],
  t: Translator = DEFAULT_TRANSLATOR
): RunningBest[] {
  const out: RunningBest[] = [];
  for (const d of runDistancesFor(t)) {
    let best: RunningBest | null = null;
    for (const r of runs) {
      if (!r.distanceM || !r.durationS || r.distanceM < d.meters * 0.995) continue;
      const projected = r.durationS * (d.meters / r.distanceM);
      if (best === null || projected < best.timeS) {
        best = {
          key: d.key,
          label: d.label,
          meters: d.meters,
          timeS: projected,
          paceSecPerKm: projected / (d.meters / 1000),
          activityId: r.activityId,
          day: r.day
        };
      }
    }
    if (best) out.push(best);
  }
  return out;
}

/**
 * Kilometres run per week over the trailing window — the run-shaped view of the shared weekly
 * roll-up (spec 056). The bucketing itself lives in `weekly-volume.ts` so the running page and the
 * multi-sport weekly card cannot end up with two different ideas of where a week starts.
 *
 * Runs without a distance are dropped BEFORE bucketing, which is what keeps `runs` meaning "runs
 * that contributed kilometres" exactly as it did before the delegation.
 */
export function weeklyMileage(runs: readonly RunSummary[], today: string, weeks = 12): WeekMileage[] {
  const measured = runs.filter((r) => !!r.distanceM);
  return weeklyVolume(
    measured.map((r) => ({
      day: r.day,
      group: 'run' as const,
      distanceM: r.distanceM,
      durationS: r.durationS,
      elevationGainM: null
    })),
    { today, weeks }
  ).map((w) => ({ week: w.week, km: Math.round((w.distanceM / 1000) * 10) / 10, runs: w.activities }));
}

export function runningTotals(runs: readonly RunSummary[]): RunningTotals {
  let totalM = 0;
  let longestM = 0;
  let totalTimeS = 0;
  for (const r of runs) {
    if (r.distanceM) {
      totalM += r.distanceM;
      longestM = Math.max(longestM, r.distanceM);
    }
    if (r.durationS) totalTimeS += r.durationS;
  }
  return {
    runs: runs.length,
    totalKm: Math.round((totalM / 1000) * 10) / 10,
    longestKm: Math.round((longestM / 1000) * 10) / 10,
    totalTimeS,
    avgPaceSecPerKm: totalM > 0 ? totalTimeS / (totalM / 1000) : null
  };
}

/** `mm:ss` from seconds (for pace-per-km or short times). */
export function fmtPace(secPerKm: number | null): string {
  if (secPerKm == null || !Number.isFinite(secPerKm)) return '—';
  // Round to whole seconds FIRST so 59.6s rolls to the next minute (avoids "1:60").
  const t = Math.round(secPerKm);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/** `h:mm:ss` or `mm:ss` from a duration in seconds. */
export function fmtDuration(totalS: number | null): string {
  if (totalS == null || !Number.isFinite(totalS)) return '—';
  const s = Math.round(totalS);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}
