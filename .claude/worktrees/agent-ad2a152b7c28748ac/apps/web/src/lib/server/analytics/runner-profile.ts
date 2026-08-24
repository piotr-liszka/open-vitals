/**
 * Runner profile (spec 033) — "jakim biegaczem jesteś" as five numbers.
 *
 * The pace-based counterpart to the cycling rider-type radar (`power-profile.ts`), built on what we
 * hold for EVERY run: activity summaries. No power meter, no streams, no FTP.
 *
 * Pure: every input is a parameter (`runs`, `today`), so the same fixtures always produce the same
 * profile. Composes the spec-018 primitives (`personalBests`, `weeklyMileage`) rather than
 * re-deriving them — the app keeps ONE definition of "personal best".
 *
 * HONESTY RULES THE MATHS.
 *  · An axis we cannot compute is `null` — "brak danych" — never `0`. A runner who has never run
 *    10 km is not a runner with 10 km endurance of zero.
 *  · Volume and consistency are measured over a window bounded by the athlete's OWN history, so a
 *    freshly synced account is not scored as lazy. Under `MIN_WINDOW_WEEKS` weeks: `null`.
 *  · Fewer than three defined axes ⇒ archetype `unknown`. We say we cannot name the type yet
 *    instead of inventing one.
 *  · The reference scale is a heuristic for SHAPE, not a fitness test, and it says so on the card.
 *
 * Two time bases are deliberately mixed and must stay labelled in the UI: the pace axes are
 * all-time bests (that is what a profile is), volume/consistency are a trailing window (that is what
 * current training is).
 */
import { daysBetween, startOfWeek, type DayKey } from '$lib/date';
import { fmtPace, personalBests, weeklyMileage, type RunSummary } from './running-profile';

export type { RunSummary };

export type RunnerAxisKey = 'speed' | 'tempo' | 'endurance' | 'volume' | 'consistency';

export interface RunnerAxisDef {
  readonly key: RunnerAxisKey;
  readonly label: string;
  /** One line of plain Polish: what this spoke actually measures. */
  readonly hint: string;
}

/** Keyed so a lookup is total — every axis key has exactly one definition, no `undefined` case. */
const AXIS_DEFS: Record<RunnerAxisKey, RunnerAxisDef> = {
  speed: { key: 'speed', label: 'Szybkość', hint: 'Najlepsze 1 km — co masz na krótkim odcinku.' },
  tempo: { key: 'tempo', label: 'Tempo', hint: 'Najlepsze 5 km — tempo w okolicach progu.' },
  endurance: {
    key: 'endurance',
    label: 'Wytrzymałość',
    hint: 'Najlepszy długi dystans: 10 km, półmaraton, maraton.'
  },
  volume: { key: 'volume', label: 'Objętość', hint: 'Średni kilometraż tygodniowy.' },
  consistency: { key: 'consistency', label: 'Regularność', hint: 'Jak często i jak równo biegasz.' }
};

/** The five spokes, in drawing order (spoke 0 points up). */
export const RUNNER_AXES: readonly RunnerAxisDef[] = [
  AXIS_DEFS.speed,
  AXIS_DEFS.tempo,
  AXIS_DEFS.endurance,
  AXIS_DEFS.volume,
  AXIS_DEFS.consistency
];

/**
 * Reference scale in **seconds per kilometre**: `slow` scores 0, `fast` scores 1. Anchors are a
 * recreational-runner floor and a competitive ceiling for that distance — one table, so re-tuning
 * the scale is a one-line change and never hides in the maths.
 */
export const PACE_SCALE: Record<string, { readonly slow: number; readonly fast: number }> = {
  '1k': { slow: 450, fast: 155 }, // 7:30 → 2:35 /km
  '5k': { slow: 480, fast: 165 }, // 8:00 → 2:45 /km
  '10k': { slow: 510, fast: 170 }, // 8:30 → 2:50 /km
  half: { slow: 540, fast: 180 }, // 9:00 → 3:00 /km
  marathon: { slow: 570, fast: 190 } // 9:30 → 3:10 /km
};

/** Weekly kilometres that score a full Objętość spoke. */
export const VOLUME_TARGET_KM = 80;
/** Runs per week that saturate the frequency half of Regularność. */
export const RUNS_PER_WEEK_TARGET = 4;
/** Below this much running history, volume/consistency are `null` rather than misleading. */
export const MIN_WINDOW_WEEKS = 3;
/** Default trailing window for the training-shape axes. */
export const DEFAULT_WINDOW_WEEKS = 12;

/** Distances the Wytrzymałość spoke will take, longest first — the longest one with data wins. */
const ENDURANCE_ORDER = ['marathon', 'half', '10k'] as const;

export interface RunnerAxis {
  readonly key: RunnerAxisKey;
  readonly label: string;
  readonly hint: string;
  /** 0..1, or `null` when the underlying data does not exist. */
  readonly score: number | null;
  /** Pre-formatted headline for the axis ("4:12 /km", "42,3 km/tyg."), or null. */
  readonly readout: string | null;
  /** What the score was computed from, in Polish ("najlepsze 5 km"). */
  readonly basis: string;
  /** When the underlying best was set (pace axes only). */
  readonly day: DayKey | null;
}

export type ArchetypeKey = 'speedster' | 'diesel' | 'grinder' | 'allrounder' | 'beginner' | 'unknown';

export interface RunnerArchetype {
  readonly key: ArchetypeKey;
  readonly label: string;
  readonly summary: string;
}

export interface RunnerWindow {
  /** Weeks actually measured: the trailing window clipped to the athlete's own history. */
  readonly weeks: number;
  readonly km: number;
  readonly runs: number;
  readonly activeWeeks: number;
  readonly avgKmPerWeek: number | null;
  readonly runsPerWeek: number | null;
}

export interface RunnerProfile {
  /** Always five, in `RUNNER_AXES` order; individual scores may be `null`. */
  readonly axes: readonly RunnerAxis[];
  readonly archetype: RunnerArchetype;
  /** Highest / lowest defined axis, or null when nothing is defined. */
  readonly strength: RunnerAxisKey | null;
  readonly weakness: RunnerAxisKey | null;
  readonly window: RunnerWindow;
  readonly definedCount: number;
  /** At least one axis carries a score. */
  readonly hasProfile: boolean;
}

const ARCHETYPES: Record<ArchetypeKey, RunnerArchetype> = {
  speedster: {
    key: 'speedster',
    label: 'Szybkościowiec',
    summary:
      'Krótkie odcinki wychodzą Ci lepiej niż długie. Najwięcej zyskasz, dorzucając spokojne kilometry — baza podniesie też tempo na 5 i 10 km.'
  },
  diesel: {
    key: 'diesel',
    label: 'Dystansowiec',
    summary:
      'Trzymasz tempo na długim, krótkie odcinki są słabszą stroną. Jedna sesja szybkich wstawek w tygodniu doda Ci prędkości bez ruszania objętości.'
  },
  grinder: {
    key: 'grinder',
    label: 'Maszyna do kilometrów',
    summary:
      'Regularność i objętość to Twój fundament — biegasz stale i dużo. To najlepszy możliwy punkt startu do pracy nad tempem.'
  },
  allrounder: {
    key: 'allrounder',
    label: 'Wszechstronny',
    summary:
      'Żadna oś nie odstaje: masz i szybkość, i dystans, i regularność. Rozwój przyjdzie z wyboru celu, nie z łatania dziur.'
  },
  beginner: {
    key: 'beginner',
    label: 'Na starcie',
    summary:
      'Baza dopiero rośnie, więc za wcześnie na wyroki. Regularność zrobi teraz więcej niż jakikolwiek trening szybkościowy.'
  },
  unknown: {
    key: 'unknown',
    label: 'Za mało danych',
    summary:
      'Mamy za mało zsynchronizowanych biegów, żeby nazwać Twój typ. Radar wypełni się sam, kiedy dojdą kolejne treningy i dłuższe dystanse.'
  }
};

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Score a pace against its distance's reference anchors. */
export function paceScore(distanceKey: string, secPerKm: number): number | null {
  const scale = PACE_SCALE[distanceKey];
  if (!scale || !Number.isFinite(secPerKm) || secPerKm <= 0) return null;
  return clamp01((scale.slow - secPerKm) / (scale.slow - scale.fast));
}

const oneDecimal = (n: number): string => n.toFixed(1).replace('.', ',');

function axis(
  def: RunnerAxisDef,
  score: number | null,
  readout: string | null,
  basis: string,
  day: DayKey | null = null
): RunnerAxis {
  return { key: def.key, label: def.label, hint: def.hint, score, readout, basis, day };
}

const defOf = (key: RunnerAxisKey): RunnerAxisDef => AXIS_DEFS[key];

/** Mean of the defined members of `keys`, or null when none is defined. */
function meanOf(scores: Map<RunnerAxisKey, number>, keys: readonly RunnerAxisKey[]): number | null {
  const values = keys.map((k) => scores.get(k)).filter((v): v is number => v != null);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Name the shape. Deterministic and ordered — the first matching rule wins — so the same vector
 * always yields the same archetype.
 */
export function archetypeOf(scores: Map<RunnerAxisKey, number>): RunnerArchetype {
  if (scores.size < 3) return ARCHETYPES.unknown;

  const values = [...scores.values()];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean < 0.2) return ARCHETYPES.beginner;

  const speedLean = meanOf(scores, ['speed', 'tempo']);
  const enduranceLean = meanOf(scores, ['endurance', 'volume']);
  if (speedLean != null && enduranceLean != null) {
    if (speedLean - enduranceLean >= 0.12) return ARCHETYPES.speedster;
    if (enduranceLean - speedLean >= 0.12) return ARCHETYPES.diesel;
  }

  const consistency = scores.get('consistency');
  const volume = scores.get('volume');
  if (consistency != null && consistency >= 0.7 && volume != null && volume >= 0.45) {
    return ARCHETYPES.grinder;
  }

  return ARCHETYPES.allrounder;
}

export interface RunnerProfileOptions {
  /** Local "today" — the trailing window ends here. */
  readonly today: DayKey;
  /** Trailing window for volume/consistency (default 12). */
  readonly weeks?: number;
}

/** The five spokes, the archetype they add up to, and the window the training axes were read over. */
export function runnerProfile(runs: readonly RunSummary[], opts: RunnerProfileOptions): RunnerProfile {
  const weeks = Math.max(1, opts.weeks ?? DEFAULT_WINDOW_WEEKS);
  const bests = personalBests(runs);
  const bestOf = (key: string) => bests.find((b) => b.key === key) ?? null;

  // ---- pace axes (all-time) ----
  const paceAxis = (axisKey: RunnerAxisKey, distanceKey: string, label: string): RunnerAxis => {
    const best = bestOf(distanceKey);
    const def = defOf(axisKey);
    if (!best) return axis(def, null, null, `brak biegu na ${label}`, null);
    return axis(
      def,
      paceScore(distanceKey, best.paceSecPerKm),
      `${fmtPace(best.paceSecPerKm)} /km`,
      `najlepsze ${label}`,
      best.day
    );
  };

  const speed = paceAxis('speed', '1k', '1 km');
  const tempo = paceAxis('tempo', '5k', '5 km');

  const enduranceKey = ENDURANCE_ORDER.find((k) => bestOf(k) !== null) ?? null;
  const endurance =
    enduranceKey === null
      ? axis(defOf('endurance'), null, null, 'brak biegu od 10 km w górę', null)
      : paceAxis(
          'endurance',
          enduranceKey,
          enduranceKey === 'marathon' ? 'maraton' : enduranceKey === 'half' ? 'półmaraton' : '10 km'
        );

  // ---- training axes (trailing window, clipped to the athlete's own history) ----
  const firstDay = runs.reduce<DayKey | null>((min, r) => (min === null || r.day < min ? r.day : min), null);
  const historyWeeks =
    firstDay === null ? 0 : Math.floor(daysBetween(startOfWeek(firstDay), startOfWeek(opts.today)) / 7) + 1;
  const measuredWeeks = Math.min(weeks, historyWeeks);

  const buckets = measuredWeeks > 0 ? weeklyMileage(runs, opts.today, weeks).slice(-measuredWeeks) : [];
  const windowKm = Math.round(buckets.reduce((a, b) => a + b.km, 0) * 10) / 10;
  const windowRuns = buckets.reduce((a, b) => a + b.runs, 0);
  const activeWeeks = buckets.filter((b) => b.runs > 0).length;
  const enoughHistory = measuredWeeks >= MIN_WINDOW_WEEKS;
  const avgKmPerWeek = enoughHistory ? Math.round((windowKm / measuredWeeks) * 10) / 10 : null;
  const runsPerWeek = enoughHistory ? Math.round((windowRuns / measuredWeeks) * 10) / 10 : null;

  const volume =
    avgKmPerWeek === null
      ? axis(defOf('volume'), null, null, `za krótka historia biegania (min. ${MIN_WINDOW_WEEKS} tyg.)`, null)
      : axis(
          defOf('volume'),
          clamp01(avgKmPerWeek / VOLUME_TARGET_KM),
          `${oneDecimal(avgKmPerWeek)} km/tyg.`,
          `ostatnie ${measuredWeeks} tyg.`,
          null
        );

  const consistency =
    runsPerWeek === null
      ? axis(
          defOf('consistency'),
          null,
          null,
          `za krótka historia biegania (min. ${MIN_WINDOW_WEEKS} tyg.)`,
          null
        )
      : axis(
          defOf('consistency'),
          clamp01(0.6 * (activeWeeks / measuredWeeks) + 0.4 * clamp01(runsPerWeek / RUNS_PER_WEEK_TARGET)),
          `${oneDecimal(runsPerWeek)} biegu/tyg.`,
          `${activeWeeks} z ${measuredWeeks} tyg. z biegiem`,
          null
        );

  const axes: RunnerAxis[] = [speed, tempo, endurance, volume, consistency];

  const scores = new Map<RunnerAxisKey, number>();
  for (const a of axes) if (a.score != null) scores.set(a.key, a.score);

  let strength: RunnerAxisKey | null = null;
  let weakness: RunnerAxisKey | null = null;
  for (const [key, score] of scores) {
    if (strength === null || score > (scores.get(strength) ?? -1)) strength = key;
    if (weakness === null || score < (scores.get(weakness) ?? 2)) weakness = key;
  }
  // One defined axis is a strength and a weakness at once, which says nothing.
  if (scores.size < 2) {
    strength = null;
    weakness = null;
  }

  return {
    axes,
    archetype: archetypeOf(scores),
    strength,
    weakness,
    window: {
      weeks: measuredWeeks,
      km: windowKm,
      runs: windowRuns,
      activeWeeks,
      avgKmPerWeek,
      runsPerWeek
    },
    definedCount: scores.size,
    hasProfile: scores.size > 0
  };
}
