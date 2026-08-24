/**
 * Timeline event engine (spec 022) — pure. Given a user's activity history, the insights engine's
 * health signals and a window, it builds ONE ranked stream of events.
 *
 * No I/O, no `Date.now()`, no random: every function here is deterministic over its arguments, so
 * the ranking rules are unit-testable and the same input always produces the same feed.
 *
 * Two orderings live side by side and must not be confused:
 *  - **importance** decides WHICH events survive the collapsed cap (an HRV crash outranks a walk);
 *  - **chronology** decides the ORDER on screen (newest first) — because a timeline that reorders
 *    itself by score is a leaderboard, not a timeline.
 */
import { addDays, compareDays, isDayKey, type DayKey } from '$lib/date';
import { sportGroup, sportLabel, type SportGroup } from '$lib/sport-labels';
import { fmtPace, paceSecPerKm } from '$lib/server/analytics/running-profile';
import type { Lane } from '$modules/metrics-dashboard/dashboard.types';
import type { IconName } from '$lib/ui/icons';
import type {
  HealthSignalInput,
  HealthSignalKind,
  TimelineActivityEvent,
  TimelineEvent,
  TimelineHealthEvent,
  TimelineMilestoneEvent,
  TimelineStat
} from './timeline.types';

/**
 * The activity fields the engine reads. `ActivitySummary` from the local store satisfies this by
 * shape, so the engine never imports `$lib/server/store`.
 */
export interface TimelineActivityInput {
  readonly activityId: string;
  readonly sport: string;
  readonly name: string | null;
  /** `YYYY-MM-DD HH:MM:SS` local wall clock, as Garmin reports it. */
  readonly startTimeLocal: string;
  readonly distanceM: number | null;
  readonly durationS: number | null;
  readonly movingS: number | null;
  readonly elevationGainM: number | null;
  readonly avgHr: number | null;
  readonly avgPower: number | null;
  readonly calories: number | null;
  readonly trainingLoad: number | null;
}

/* ------------------------------------------------------------------ *
 * Tuning constants — every magic number in one documented place
 * ------------------------------------------------------------------ */

export const IMPORTANCE = {
  /** Floor for "you did a workout". */
  activityBase: 38,
  /** Points per hour of moving time, capped. */
  activityPerHour: 12,
  activityDurationCap: 24,
  /** Garmin training load ÷ this, capped. */
  activityLoadDivisor: 12,
  activityLoadCap: 12,
  /** A |z| ≥ 2 outlier. */
  healthModerate: 66,
  /** A |z| ≥ 3 outlier. */
  healthStrong: 88,
  /** Extra points for each z past the 2.0 threshold, capped. */
  healthZBonusPerZ: 7,
  healthZBonusCap: 7,
  milestoneRecord: 84,
  milestoneStreak: 76,
  milestoneNewSport: 72,
  min: 5,
  max: 95
} as const;

/**
 * Sport-family weighting. An easy walk is background texture; a ride/run/swim is the training.
 * Negative for `walk` on purpose — the brief's "a normal easy walk should not crowd out an HRV
 * anomaly" is exactly this line.
 */
const GROUP_IMPORTANCE: Readonly<Record<SportGroup, number>> = {
  run: 4,
  ride: 4,
  swim: 4,
  strength: 2,
  other: 0,
  walk: -8
};

const GROUP_ICON: Readonly<Record<SportGroup, IconName>> = {
  run: 'run',
  ride: 'ride',
  swim: 'swim',
  walk: 'walk',
  strength: 'strength',
  other: 'activity'
};

const GROUP_LANE: Readonly<Record<SportGroup, Lane>> = {
  run: 'orange',
  ride: 'cyan',
  swim: 'sky',
  walk: 'teal',
  strength: 'violet',
  other: 'lime'
};

/** Milestones only fire once a user has enough history for "a record" to mean anything. */
export const MILESTONE_MIN_PRIOR_IN_GROUP = 3;
export const MILESTONE_MIN_HISTORY = 5;
/** A streak is worth surfacing at a full week, and at every 7th/10th day after that. */
export const STREAK_MIN_DAYS = 7;

/* ------------------------------------------------------------------ *
 * Formatting (pre-formatted values keep the UI dumb)
 * ------------------------------------------------------------------ */

const NUM = new Intl.NumberFormat('pl-PL');
const NUM1 = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** `18,4 km` above a kilometre, `640 m` below it. */
export function fmtDistance(meters: number | null): string | null {
  if (meters == null || !Number.isFinite(meters) || meters <= 0) return null;
  return meters >= 1000 ? `${NUM1.format(meters / 1000)} km` : `${NUM.format(Math.round(meters))} m`;
}

/** `2 h 05 min` / `48 min` / `40 s` — reads as a duration, not a stopwatch. */
export function fmtHm(seconds: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  // Round to whole minutes FIRST, so 59:40 becomes "1 h 00 min" rather than "0 h 60 min".
  const minutes = Math.round(total / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

/** Local `YYYY-MM-DD HH:MM:SS` → `HH:MM`, or null when the string is not one. */
export function localTimeOf(startTimeLocal: string): string | null {
  const hhmm = startTimeLocal.slice(11, 16);
  return /^\d{2}:\d{2}$/.test(hhmm) ? hhmm : null;
}

/** Local `YYYY-MM-DD HH:MM:SS` → its day key, or null when the leading 10 chars are not a day. */
export function localDayOf(startTimeLocal: string): DayKey | null {
  const head = startTimeLocal.slice(0, 10);
  return isDayKey(head) ? head : null;
}

/**
 * The headline readouts for a sport family — the number you actually look for after that workout.
 * Capped at three so a row never wraps into a paragraph.
 */
export function activityStats(a: TimelineActivityInput): TimelineStat[] {
  const group = sportGroup(a.sport);
  const seconds = a.movingS ?? a.durationS;
  const stats: TimelineStat[] = [];
  const distance = fmtDistance(a.distanceM);
  const duration = fmtHm(seconds);

  if (group === 'run') {
    if (distance) stats.push({ label: 'Dystans', value: distance });
    const pace = paceSecPerKm(seconds, a.distanceM);
    if (pace !== null) stats.push({ label: 'Tempo', value: fmtPace(pace), unit: '/km' });
    if (duration) stats.push({ label: 'Czas', value: duration });
  } else if (group === 'ride') {
    if (distance) stats.push({ label: 'Dystans', value: distance });
    if (a.avgPower != null && a.avgPower > 0) {
      stats.push({ label: 'Śr. moc', value: NUM.format(Math.round(a.avgPower)), unit: 'W' });
    } else if (a.distanceM != null && seconds != null && seconds > 0) {
      stats.push({
        label: 'Śr. prędkość',
        value: NUM1.format(a.distanceM / 1000 / (seconds / 3600)),
        unit: 'km/h'
      });
    }
    if (duration) stats.push({ label: 'Czas', value: duration });
  } else if (group === 'swim') {
    if (distance) stats.push({ label: 'Dystans', value: distance });
    const pace = paceSecPerKm(seconds, a.distanceM);
    if (pace !== null) stats.push({ label: 'Tempo', value: fmtPace(pace / 10), unit: '/100 m' });
    if (duration) stats.push({ label: 'Czas', value: duration });
  } else {
    if (duration) stats.push({ label: 'Czas', value: duration });
    if (distance) stats.push({ label: 'Dystans', value: distance });
    if (a.avgHr != null && a.avgHr > 0)
      stats.push({ label: 'Śr. tętno', value: NUM.format(Math.round(a.avgHr)), unit: 'bpm' });
  }

  if (stats.length < 3 && a.elevationGainM != null && a.elevationGainM >= 100) {
    stats.push({ label: 'Przewyższenie', value: NUM.format(Math.round(a.elevationGainM)), unit: 'm' });
  }
  return stats.slice(0, 3);
}

/* ------------------------------------------------------------------ *
 * Importance
 * ------------------------------------------------------------------ */

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

export function activityImportance(a: TimelineActivityInput): number {
  const seconds = a.movingS ?? a.durationS ?? 0;
  const hours = seconds > 0 ? seconds / 3600 : 0;
  const duration = Math.min(IMPORTANCE.activityDurationCap, hours * IMPORTANCE.activityPerHour);
  const load = Math.min(
    IMPORTANCE.activityLoadCap,
    Math.max(0, a.trainingLoad ?? 0) / IMPORTANCE.activityLoadDivisor
  );
  const group = GROUP_IMPORTANCE[sportGroup(a.sport)];
  return clamp(Math.round(IMPORTANCE.activityBase + duration + load + group), IMPORTANCE.min, IMPORTANCE.max);
}

export function healthImportance(signal: Pick<HealthSignalInput, 'z' | 'severity'>): number {
  const base = signal.severity === 'strong' ? IMPORTANCE.healthStrong : IMPORTANCE.healthModerate;
  const past = Math.max(0, Math.abs(signal.z) - 2);
  const bonus = Math.min(IMPORTANCE.healthZBonusCap, past * IMPORTANCE.healthZBonusPerZ);
  return clamp(Math.round(base + bonus), IMPORTANCE.min, IMPORTANCE.max);
}

/* ------------------------------------------------------------------ *
 * Activity events
 * ------------------------------------------------------------------ */

export function buildActivityEvents(
  history: readonly TimelineActivityInput[],
  from: DayKey,
  to: DayKey
): TimelineActivityEvent[] {
  const out: TimelineActivityEvent[] = [];
  for (const a of history) {
    const day = localDayOf(a.startTimeLocal);
    if (day === null || compareDays(day, from) < 0 || compareDays(day, to) > 0) continue;
    const group = sportGroup(a.sport);
    const label = sportLabel(a.sport);
    const name = a.name?.trim();
    out.push({
      kind: 'activity',
      id: `activity:${a.activityId}`,
      day,
      time: localTimeOf(a.startTimeLocal),
      title: name && name.length > 0 ? name : label,
      detail: name && name.length > 0 && name !== label ? label : null,
      stats: activityStats(a),
      icon: GROUP_ICON[group],
      accent: GROUP_LANE[group],
      importance: activityImportance(a),
      primary: false,
      href: `/activities/${a.activityId}`,
      activityId: a.activityId,
      sport: a.sport,
      group,
      distanceM: a.distanceM,
      durationS: a.movingS ?? a.durationS
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Health events
 * ------------------------------------------------------------------ */

/** Which direction is healthy per metric — mirrors `metric-specs.goodWhen`, kept local + explicit. */
const GOOD_WHEN: Readonly<Record<string, 'up' | 'down'>> = {
  sleep: 'up',
  hrv: 'up',
  body_battery: 'up',
  steps: 'up',
  calories: 'up',
  spo2: 'up',
  resting_heart_rate: 'down',
  stress: 'down',
  respiration: 'down'
};

interface SignalCopy {
  readonly signal: HealthSignalKind;
  readonly title: string;
  readonly icon: IconName;
}

/** Metric + direction → a named signal with human copy. Unknown metrics degrade, never throw. */
export function classifySignal(metric: string, direction: 'up' | 'down'): SignalCopy {
  const up = direction === 'up';
  switch (metric) {
    case 'sleep':
      return up
        ? { signal: 'long_sleep', title: 'Wyjątkowo długi sen', icon: 'moon' }
        : { signal: 'poor_sleep', title: 'Krótki sen', icon: 'moon' };
    case 'resting_heart_rate':
      return up
        ? { signal: 'elevated_rhr', title: 'Podwyższone tętno spoczynkowe', icon: 'heart' }
        : { signal: 'low_rhr', title: 'Wyjątkowo niskie tętno spoczynkowe', icon: 'heart' };
    case 'hrv':
      return up
        ? { signal: 'hrv_rise', title: 'Skok HRV', icon: 'pulse' }
        : { signal: 'hrv_drop', title: 'Spadek HRV', icon: 'pulse' };
    case 'stress':
      return up
        ? { signal: 'high_stress', title: 'Dzień z wysokim stresem', icon: 'alert' }
        : { signal: 'low_stress', title: 'Dzień z niskim stresem', icon: 'alert' };
    case 'body_battery':
      return up
        ? { signal: 'body_battery_peak', title: 'Body Battery na maksimum', icon: 'battery' }
        : { signal: 'body_battery_crash', title: 'Załamanie Body Battery', icon: 'battery' };
    default:
      return { signal: 'metric_outlier', title: 'Nietypowy odczyt', icon: 'activity' };
  }
}

/** Only keep signals that are structurally sound — this data crosses a module boundary. */
export function isUsableSignal(s: HealthSignalInput): boolean {
  return (
    isDayKey(s.date) &&
    Number.isFinite(s.value) &&
    Number.isFinite(s.z) &&
    (s.direction === 'up' || s.direction === 'down') &&
    (s.severity === 'moderate' || s.severity === 'strong')
  );
}

export function buildHealthEvents(
  signals: readonly HealthSignalInput[],
  from: DayKey,
  to: DayKey
): TimelineHealthEvent[] {
  const out: TimelineHealthEvent[] = [];
  for (const s of signals) {
    if (!isUsableSignal(s)) continue;
    if (compareDays(s.date, from) < 0 || compareDays(s.date, to) > 0) continue;
    const copy = classifySignal(s.key, s.direction);
    const goodWhen = GOOD_WHEN[s.key];
    const favourable = goodWhen === undefined ? false : s.direction === goodWhen;
    out.push({
      kind: 'health',
      id: `health:${s.key}:${s.date}`,
      day: s.date,
      time: null,
      title: copy.title,
      detail: `${s.label} ${s.direction === 'up' ? 'powyżej' : 'poniżej'} Twojej zwykłej bazy`,
      stats: [
        { label: s.label, value: NUM1.format(Math.round(s.value * 10) / 10) },
        { label: 'Odchylenie', value: `${s.z > 0 ? '+' : '−'}${NUM1.format(Math.abs(s.z))}`, unit: 'σ' }
      ],
      icon: copy.icon,
      accent: s.accent,
      importance: healthImportance(s),
      primary: false,
      href: '/insights',
      metric: s.key,
      signal: copy.signal,
      severity: s.severity,
      direction: s.direction,
      value: s.value,
      z: s.z,
      favourable
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Milestones
 * ------------------------------------------------------------------ */

/** Consecutive-day activity streak length ending on each day that has an activity. */
export function streakLengths(days: readonly DayKey[]): Map<DayKey, number> {
  const unique = [...new Set(days)].sort((a, b) => compareDays(a, b));
  const lengths = new Map<DayKey, number>();
  let run = 0;
  let previous: DayKey | null = null;
  for (const day of unique) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1;
    lengths.set(day, run);
    previous = day;
  }
  return lengths;
}

/** A streak worth announcing: a full week, then every 7th or 10th day. */
export function isStreakMilestone(length: number): boolean {
  return length >= STREAK_MIN_DAYS && (length % 7 === 0 || length % 10 === 0);
}

/**
 * Walks the whole history oldest→newest, carrying the records seen so far, and emits a milestone
 * the moment one is beaten inside the window. Records are per sport family, so a long ride does not
 * shadow a long run.
 */
export function buildMilestoneEvents(
  history: readonly TimelineActivityInput[],
  from: DayKey,
  to: DayKey
): TimelineMilestoneEvent[] {
  const dated = history
    .map((a) => ({ a, day: localDayOf(a.startTimeLocal) }))
    .filter((e): e is { a: TimelineActivityInput; day: DayKey } => e.day !== null)
    .sort((x, y) => compareDays(x.day, y.day) || x.a.startTimeLocal.localeCompare(y.a.startTimeLocal));

  const out: TimelineMilestoneEvent[] = [];
  const maxDistance = new Map<SportGroup, number>();
  const maxDuration = new Map<SportGroup, number>();
  const countInGroup = new Map<SportGroup, number>();
  const seenSports = new Set<string>();
  const streaks = streakLengths(dated.map((e) => e.day));
  const streakAnnounced = new Set<DayKey>();
  let seen = 0;

  for (const { a, day } of dated) {
    const group = sportGroup(a.sport);
    const priorInGroup = countInGroup.get(group) ?? 0;
    const bestDistance = maxDistance.get(group) ?? 0;
    const bestDuration = maxDuration.get(group) ?? 0;
    const duration = a.movingS ?? a.durationS ?? 0;
    const inWindow = compareDays(day, from) >= 0 && compareDays(day, to) <= 0;
    const label = sportLabel(a.sport);
    const time = localTimeOf(a.startTimeLocal);

    const beatsDistance = (a.distanceM ?? 0) > bestDistance && priorInGroup >= MILESTONE_MIN_PRIOR_IN_GROUP;
    const beatsDuration = duration > bestDuration && priorInGroup >= MILESTONE_MIN_PRIOR_IN_GROUP;
    const isNewSport = !seenSports.has(a.sport) && seen >= MILESTONE_MIN_HISTORY;

    if (inWindow && beatsDistance) {
      out.push({
        kind: 'milestone',
        id: `milestone:distance:${a.activityId}`,
        day,
        time,
        title: `Najdłuższy dystans — ${label.toLocaleLowerCase('pl-PL')}`,
        detail: `Twój rekord w tej dyscyplinie: ${fmtDistance(a.distanceM) ?? '—'}`,
        stats: [{ label: 'Poprzedni rekord', value: fmtDistance(bestDistance) ?? '—' }],
        icon: 'trophy',
        accent: 'orange',
        importance: IMPORTANCE.milestoneRecord,
        primary: false,
        href: `/activities/${a.activityId}`,
        milestone: 'longest_distance',
        activityId: a.activityId
      });
    } else if (inWindow && beatsDuration) {
      // Only when distance did not already fire — one activity should not stack two trophies.
      out.push({
        kind: 'milestone',
        id: `milestone:duration:${a.activityId}`,
        day,
        time,
        title: `Najdłuższy czas — ${label.toLocaleLowerCase('pl-PL')}`,
        detail: `Twój najdłuższy trening w tej dyscyplinie: ${fmtHm(duration) ?? '—'}`,
        stats: [{ label: 'Poprzedni rekord', value: fmtHm(bestDuration) ?? '—' }],
        icon: 'trophy',
        accent: 'orange',
        importance: IMPORTANCE.milestoneRecord,
        primary: false,
        href: `/activities/${a.activityId}`,
        milestone: 'longest_duration',
        activityId: a.activityId
      });
    }

    if (inWindow && isNewSport) {
      out.push({
        kind: 'milestone',
        id: `milestone:sport:${a.activityId}`,
        day,
        time,
        title: `Nowa dyscyplina: ${label.toLocaleLowerCase('pl-PL')}`,
        detail: 'Pierwszy taki trening w Twojej historii',
        stats: [],
        icon: 'sparkle',
        accent: 'violet',
        importance: IMPORTANCE.milestoneNewSport,
        primary: false,
        href: `/activities/${a.activityId}`,
        milestone: 'new_sport',
        activityId: a.activityId
      });
    }

    const streak = streaks.get(day) ?? 0;
    if (inWindow && isStreakMilestone(streak) && !streakAnnounced.has(day)) {
      streakAnnounced.add(day);
      out.push({
        kind: 'milestone',
        id: `milestone:streak:${day}`,
        day,
        time: null,
        title: `${streak} dni z rzędu z treningiem`,
        detail: 'Seria trwa — każdy z tych dni ma co najmniej jedną aktywność',
        stats: [{ label: 'Seria', value: NUM.format(streak), unit: 'dni' }],
        icon: 'flame',
        accent: 'amber',
        importance: IMPORTANCE.milestoneStreak,
        primary: false,
        href: null,
        milestone: 'streak',
        activityId: null
      });
    }

    seenSports.add(a.sport);
    countInGroup.set(group, priorInGroup + 1);
    if ((a.distanceM ?? 0) > bestDistance) maxDistance.set(group, a.distanceM ?? 0);
    if (duration > bestDuration) maxDuration.set(group, duration);
    seen += 1;
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Ranking + assembly
 * ------------------------------------------------------------------ */

/** Health first on the same instant — the body's news outranks the workout that caused it. */
const KIND_ORDER: Readonly<Record<TimelineEvent['kind'], number>> = { health: 0, milestone: 1, activity: 2 };

/** Newest first; ties broken by kind then id so the order is total and stable. */
export function compareChronological(a: TimelineEvent, b: TimelineEvent): number {
  const byDay = compareDays(b.day, a.day);
  if (byDay !== 0) return byDay;
  const byTime = (b.time ?? '').localeCompare(a.time ?? '');
  if (byTime !== 0) return byTime;
  const byKind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  if (byKind !== 0) return byKind;
  return a.id.localeCompare(b.id);
}

/** Most important first, newest first on ties — the collapsed-view selection order. */
export function compareImportance(a: TimelineEvent, b: TimelineEvent): number {
  const byScore = b.importance - a.importance;
  if (byScore !== 0) return byScore;
  return compareChronological(a, b);
}

export interface RankedTimeline {
  /** Chronological, newest first. */
  readonly events: TimelineEvent[];
  readonly primaryCount: number;
  readonly totalCount: number;
}

/**
 * Marks the top `limit` events by importance as `primary`, then returns everything in chronological
 * order. The UI shows `primary` collapsed and the whole list when expanded — one payload, two views.
 */
export function rank(events: readonly TimelineEvent[], limit: number): RankedTimeline {
  const byImportance = [...events].sort(compareImportance);
  const keep = new Set(byImportance.slice(0, Math.max(0, limit)).map((e) => e.id));
  const marked = events.map((e) => ({ ...e, primary: keep.has(e.id) }) as TimelineEvent);
  marked.sort(compareChronological);
  return { events: marked, primaryCount: keep.size, totalCount: marked.length };
}

export interface BuildTimelineInput {
  readonly history: readonly TimelineActivityInput[];
  readonly signals: readonly HealthSignalInput[];
  readonly from: DayKey;
  readonly to: DayKey;
  readonly limit: number;
}

/** The whole backwards half: merge every kind, rank it, order it. */
export function buildTimeline(input: BuildTimelineInput): RankedTimeline {
  const events: TimelineEvent[] = [
    ...buildActivityEvents(input.history, input.from, input.to),
    ...buildHealthEvents(input.signals, input.from, input.to),
    ...buildMilestoneEvents(input.history, input.from, input.to)
  ];
  return rank(events, input.limit);
}
