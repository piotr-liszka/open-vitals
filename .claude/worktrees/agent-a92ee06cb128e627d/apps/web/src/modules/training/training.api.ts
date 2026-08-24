/**
 * Training section overview (spec 025) — the ONE multi-sport landing page that replaced the
 * separate Trening / Moc / Bieg top-level entries. Reads only the local store and answers, in one
 * request: what is my whole-athlete form (PMC), and where did my training time actually go?
 *
 * Every sport family the athlete records is represented here — walking and hiking included, which
 * previously appeared in no analysis view at all.
 *
 * Pure over injected deps (store + settings + clock): no live Garmin, no `Date.now()`, no env.
 */
import type { Clock } from '$lib/server/clock';
import type { SettingsRepo } from '$lib/server/repo/types';
import type { ActivitySummary, LocalStore } from '$lib/server/store/types';
import { activityLoad, buildTrainingLoad, type LoadActivity } from '$lib/server/analytics/training-load';
import { buildPowerProfile, type PowerActivity } from '$lib/server/analytics/power-profile';
import { loadRisk } from '$lib/server/analytics/load-risk';
import { activeWeekStreak } from '$lib/server/analytics/streak';
import {
  intensityMix,
  weeklyIntensityMinutes,
  type IntensitySession
} from '$lib/server/analytics/intensity-mix';
import { addDays, daysBetween, maxDay, toDayKey, todayKey, type DayKey } from '$lib/date';
import { DEFAULT_RANGE, resolveRange } from '$lib/range';
import { bucketLattice, bucketStart, volumeBucket } from '$lib/series';
import { sportGroup, sportGroupLabel, sportGroupLane, type SportGroup } from '$lib/sport-labels';
import { createTranslator } from '$lib/i18n';
import { analysisTabs, planTabs, SPORT_SLUGS, trainingSection } from './training-nav';
import type {
  SportFitness,
  SportSlice,
  TrainingOverviewData,
  TrainingOverviewRequest,
  TrainingTabsDeps,
  TrainingTabsRequest,
  TrainingTabsResult,
  WeeklyVolumeSeries
} from './training.types';

export interface TrainingDeps {
  store: LocalStore;
  settings: SettingsRepo;
  clock: Clock;
}

/**
 * How far back the store query reaches. Bounded (rather than the old `limit: 100000` full-history
 * read) because CTL's 42-day time constant means older activities cannot move today's number.
 */
export const HISTORY_DAYS = 540;
/**
 * Trailing slice of the PMC actually charted — the earlier months are only there to warm CTL up.
 *
 * Deliberately NOT range-driven (spec 047): CTL/ATL/TSB is an exponentially-weighted model with a
 * 42-day time constant, so a 7-day slice of it is not "the last week's form", it is a fragment of a
 * curve whose whole meaning is its history. The form card therefore carries no range indicator, and
 * the switch moves only the window half of this payload — the sport split and the volume chart.
 */
export const PMC_VIEW_DAYS = 365;
/** Fallback window for the sport split and the volume chart when no range is supplied. */
export const VOLUME_WEEKS = 12;

function numberSetting(settings: Record<string, unknown>, key: string): number | null {
  const v = settings[key];
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

interface Accumulator {
  activities: number;
  durationS: number;
  distanceM: number;
  elevationGainM: number;
  load: number;
}

function emptyAccumulator(): Accumulator {
  return { activities: 0, durationS: 0, distanceM: 0, elevationGainM: 0, load: 0 };
}

/** Subpage link for a family, or null when that family has no dedicated analysis page. */
function sportHref(group: SportGroup): string | null {
  const slug: string | undefined = (SPORT_SLUGS as Partial<Record<SportGroup, string>>)[group];
  return slug === undefined ? null : `/training/${slug}`;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

export async function loadTrainingOverview(
  deps: TrainingDeps,
  req: TrainingOverviewRequest
): Promise<TrainingOverviewData> {
  const t = createTranslator(req.locale);
  const today = todayKey(deps.clock);
  const historyStart = addDays(today, -(HISTORY_DAYS - 1));
  const range = req.range ?? resolveRange(DEFAULT_RANGE, today);

  const [activities, userSettings] = await Promise.all([
    // Store-side window instead of reading every activity ever synced and slicing in memory.
    deps.store.listActivities(req.userId, { from: historyStart, limit: 20000 }),
    deps.settings.get(req.userId)
  ]);

  // Streams are only needed where Garmin gave us no load of its own. One batched, power-only query.
  const needsStream = activities.filter((a) => a.trainingLoad == null || a.trainingLoad <= 0);
  const streamById = await deps.store.getStreamField(
    req.userId,
    needsStream.map((a) => a.activityId),
    'power'
  );

  // FTP: the setting wins; otherwise derive one from the mean-max curve so power TSS still works.
  let ftpWatts = numberSetting(userSettings, 'ftpWatts');
  if (ftpWatts == null) {
    const powerActs: PowerActivity[] = needsStream.flatMap((a) => {
      const power = streamById.get(a.activityId);
      return power ? [{ activityId: a.activityId, day: toDayKey(a.startTimeLocal), power }] : [];
    });
    if (powerActs.length > 0) ftpWatts = buildPowerProfile(powerActs, { weightKg: null }).ftpWatts;
  }

  const loadOpts = { ftpWatts, endDay: today };
  const toLoadActivity = (a: ActivitySummary): LoadActivity => ({
    day: toDayKey(a.startTimeLocal),
    durationS: a.movingS ?? a.durationS,
    trainingLoad: a.trainingLoad,
    avgHr: a.avgHr,
    maxHr: a.maxHr,
    power: a.trainingLoad != null && a.trainingLoad > 0 ? null : (streamById.get(a.activityId) ?? null)
  });

  const pmc = buildTrainingLoad(activities.map(toLoadActivity), loadOpts);
  const pmcFrom = addDays(today, -(PMC_VIEW_DAYS - 1));
  const series = pmc.series.filter((p) => p.day >= pmcFrom);

  // How fast the athlete is loading up, and whether that rate is safe (spec 039). Derived from the
  // series above, so it can never disagree with the chart the reader is looking at.
  const risk = loadRisk(pmc.series);

  /**
   * Per-family fitness (spec 039). A multisport athlete's whole-athlete CTL hides the case that
   * matters: run fitness sliding while bike fitness climbs. Each family runs the SAME engine over its
   * own activities, so the numbers are directly comparable to the whole-athlete pair above.
   *
   * Families are only reported once they have enough continuous history for CTL to mean something —
   * `loadRisk` already encodes that floor, so a family below it gets a null risk rather than a scary
   * ratio built from three sessions.
   */
  const perSportFitness: SportFitness[] = [];
  const familiesWithLoad = new Set(activities.map((a) => sportGroup(a.sport)));
  for (const group of familiesWithLoad) {
    const own = activities.filter((a) => sportGroup(a.sport) === group);
    const familyPmc = buildTrainingLoad(own.map(toLoadActivity), loadOpts);
    if (!familyPmc.hasData) continue;
    perSportFitness.push({
      group,
      label: sportGroupLabel(t, group),
      color: sportGroupLane(group),
      ctl: familyPmc.ctl,
      atl: familyPmc.atl,
      tsb: familyPmc.tsb,
      band: familyPmc.band,
      risk: loadRisk(familyPmc.series)
    });
  }
  perSportFitness.sort((a, b) => b.ctl - a.ctl);

  /* ---- multi-sport window: the sport split + volume chart (follows the global range) ---- */
  /*
   * Buckets are weekly until the range is long enough to bucket monthly, so "cały czas" over five
   * years charts ~60 columns rather than ~280. The window is clamped to the store read: the PMC needs
   * `HISTORY_DAYS` of history, and asking the split for more days than we loaded would silently
   * under-count the earliest ones.
   */
  const bucket = volumeBucket(range);
  const windowStart = maxDay(range.start, historyStart);
  const windowDays = daysBetween(windowStart, today) + 1;
  const weeks: DayKey[] = bucketLattice(windowStart, today, bucket);

  /*
   * Intensity mix over the volume window (spec 044): is the easy training actually easy? Classified from
   * average HR against the athlete's max, so every synced session of every sport counts and no stream read
   * is needed. Max HR is the explicit setting, else the highest max/avg ever observed — the same fallback
   * the running page uses, so the two pages cannot disagree about the athlete's ceiling.
   *
   * The window is the global range (spec 047), like the split and the volume chart below it: the mix
   * answers "was my easy training easy" about the period on screen, so it has to move with the switch.
   * Computed after the lattice for that reason — it reuses the same `windowStart`.
   */
  const maxHrSetting = numberSetting(userSettings, 'maxHrBpm');
  const observedMaxHr = activities.reduce<number | null>(
    (m, a) => Math.max(m ?? 0, a.maxHr ?? a.avgHr ?? 0) || null,
    null
  );
  const mixSessions: IntensitySession[] = activities
    .filter((a) => toDayKey(a.startTimeLocal) >= windowStart)
    .map((a) => ({
      day: toDayKey(a.startTimeLocal),
      durationS: a.movingS ?? a.durationS,
      avgHr: a.avgHr,
      trainingLoad: a.trainingLoad
    }));
  const effectiveMaxHr = maxHrSetting ?? observedMaxHr;
  const mix = intensityMix(mixSessions, effectiveMaxHr);

  const weekIndex = new Map<DayKey, number>(weeks.map((w, i) => [w, i]));

  /*
   * Weighted intensity minutes per week (spec 045) against the WHO's 150 — the one volume target that
   * exists for everybody rather than for athletes. Same classification as the mix above, on the same
   * lattice the volume chart uses, so all three read as one page rather than three opinions.
   *
   * The bucketer MUST be the lattice's own (spec 047): `weeks` is monthly once the range is long
   * enough, and a hardcoded `startOfWeek` would then map every day to a Monday that is not in the
   * lattice at all — every bucket would silently come back empty.
   */
  const intensityWeeks = weeklyIntensityMinutes(mixSessions, weeks, effectiveMaxHr, (day) =>
    bucketStart(day as DayKey, bucket)
  );
  const perGroup = new Map<SportGroup, Accumulator>();
  const hoursByGroup = new Map<SportGroup, number[]>();
  const totals = emptyAccumulator();

  for (const a of activities) {
    const day = toDayKey(a.startTimeLocal);
    if (day < windowStart) continue;
    const group = sportGroup(a.sport);
    const durationS = a.movingS ?? a.durationS ?? 0;
    const acc = perGroup.get(group) ?? emptyAccumulator();

    acc.activities += 1;
    acc.durationS += durationS;
    acc.distanceM += a.distanceM ?? 0;
    acc.elevationGainM += a.elevationGainM ?? 0;
    acc.load += activityLoad(toLoadActivity(a), loadOpts).tss;
    perGroup.set(group, acc);

    totals.activities += 1;
    totals.durationS += durationS;
    totals.distanceM += a.distanceM ?? 0;
    totals.elevationGainM += a.elevationGainM ?? 0;

    const wi = weekIndex.get(bucketStart(day, bucket));
    if (wi !== undefined) {
      const hours = hoursByGroup.get(group) ?? new Array<number>(weeks.length).fill(0);
      hours[wi] = (hours[wi] ?? 0) + durationS / 3600;
      hoursByGroup.set(group, hours);
    }
  }

  const sports: SportSlice[] = [...perGroup.entries()]
    .map(([group, acc]) => ({
      group,
      label: sportGroupLabel(t, group),
      activities: acc.activities,
      durationS: Math.round(acc.durationS),
      distanceM: Math.round(acc.distanceM),
      elevationGainM: Math.round(acc.elevationGainM),
      load: Math.round(acc.load),
      href: sportHref(group)
    }))
    // Busiest by time first — that is the order an athlete recognises their own week in.
    .sort(
      (x, y) => y.durationS - x.durationS || y.activities - x.activities || x.group.localeCompare(y.group)
    );

  const weekly: WeeklyVolumeSeries[] = sports.flatMap((s) => {
    const hours = hoursByGroup.get(s.group);
    return hours ? [{ group: s.group, label: s.label, hours: hours.map(round1) }] : [];
  });

  return {
    series,
    ctl: pmc.ctl,
    atl: pmc.atl,
    tsb: pmc.tsb,
    band: pmc.band,
    recommendation: pmc.recommendation,
    risk,
    perSport: perSportFitness,
    intensityMix: mix,
    intensityWeeks,
    hasData: pmc.hasData,
    ftpWatts,
    // Deliberately over the loaded history, not the range: a streak is "how long have I kept this
    // up", which a 7-day window would silently truncate to 1 (spec 048).
    streakWeeks: activeWeekStreak(activities, today),
    range,
    windowDays,
    totals: {
      activities: totals.activities,
      durationS: Math.round(totals.durationS),
      distanceM: Math.round(totals.distanceM),
      elevationGainM: Math.round(totals.elevationGainM)
    },
    sports,
    weeks,
    weekly
  };
}

/**
 * The training section's tab bar (spec 088). Two sections live under `/training` and only one of
 * them is derived from data: `Analiza` needs the athlete's per-sport counts, `Plan treningowy` is
 * the same two tabs for everyone. The pathname therefore decides whether the store is touched at
 * all, so opening the planner does not pay for a sport tally nothing on the page will show.
 *
 * Lives here rather than in the layout loader so the branch — including "does NOT query the store"
 * — is testable with a mock store instead of a fabricated `RequestEvent`.
 */
export async function loadTrainingTabs(
  deps: TrainingTabsDeps,
  request: TrainingTabsRequest
): Promise<TrainingTabsResult> {
  const t = createTranslator(request.locale);
  if (trainingSection(request.pathname) === 'plan') return { tabs: planTabs(t) };
  const sports = await deps.store.listSports(request.userId);
  return { tabs: analysisTabs(t, sports) };
}
