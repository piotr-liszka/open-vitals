/**
 * Timeline data handler (spec 022). Reads the local synced store, merges the insights engine's
 * health signals in, and returns the two halves of the start-page timeline: what happened over the
 * last 14 days, and what is scheduled for the next 7.
 *
 * Pure over injected deps (`LocalStore`, `Clock`, an optional `PlannedWorkoutSource`) — no live
 * Garmin call, no `Date.now()`, no `process.env`. All ranking lives in `timeline.events.ts`.
 *
 * THE FORWARD HALF HAS TWO SOURCES, and they are not symmetric:
 *  - Sessions the athlete AUTHORED here (spec 050) come from the local store and are always readable,
 *    so they render with a badge saying whether they have reached Garmin yet.
 *  - GARMIN's own calendar needs the optional `plannedWorkouts` port. With nothing injected the feed
 *    reports `status: 'not_synced'` and the UI says so in plain Polish. We never infer, predict or
 *    mock a plan — a fabricated training plan is worse than an honest blank.
 * A session we pushed to Garmin comes back through the calendar read, so the two are de-duplicated by
 * Garmin workout id, with the local row winning (it is the only one that knows its push state).
 */
import type { Clock } from '$lib/server/clock';
import type { LocalStore } from '$lib/server/store/types';
import { DEFAULT_TIME_ZONE, addDays, isDayKey, todayKey, type DayKey } from '$lib/date';
import { estimateWorkoutDistanceM, estimateWorkoutDurationS } from '$lib/workouts';
import { buildTimeline, type TimelineActivityInput } from './timeline.events';
import type { HealthSignalInput, PlannedEvent, PlannedFeed, TimelineData } from './timeline.types';

/**
 * What a planned-workout source answers. `available` distinguishes "the calendar could not be read"
 * from "the calendar is empty" — collapsing those two into one blank screen is exactly the lie this
 * slice refuses to tell. Mirrors the sidecar's `GarminPlannedFeed`.
 */
export interface PlannedFeedInput {
  readonly available: boolean;
  readonly events: readonly PlannedEvent[];
}

/**
 * Port for scheduled workouts. Deliberately narrow: one read, bounded by an inclusive day range.
 * See spec 022 for the sidecar + store contract that must satisfy it.
 */
export interface PlannedWorkoutSource {
  listPlanned(userId: string, from: DayKey, to: DayKey): Promise<PlannedFeedInput>;
}

export interface TimelineDeps {
  store: LocalStore;
  clock: Clock;
  /** IANA zone "today" resolves in (spec 018). Defaults to the app timezone. */
  timeZone?: string;
  /** Absent today — see the module note. */
  plannedWorkouts?: PlannedWorkoutSource;
}

export interface TimelineRequest {
  userId: string;
  /** Notable readings from the insights engine (`InsightsData.anomalies` satisfies this by shape). */
  signals?: readonly HealthSignalInput[];
  /** How far back the stream reaches. Clamped to 1…`MAX_PAST_DAYS`. */
  pastDays?: number;
  /** How far forward the planned half reaches. Clamped to 1…30. */
  futureDays?: number;
  /** How many events survive the collapsed view. Clamped to 1…`MAX_LIMIT`. */
  limit?: number;
  /** Pin "today" (tests). Ignored unless it is a real day key. */
  today?: string;
}

export const DEFAULT_PAST_DAYS = 14;
export const DEFAULT_FUTURE_DAYS = 7;
export const DEFAULT_LIMIT = 8;

/**
 * Ceilings on the past window and the collapsed event count. Both were 60 and 50 while the timeline
 * had a window of its own; the global range now reaches a year and beyond (spec 047), and silently
 * clamping a 1-year range to 60 days would show the wrong thing while claiming to show the right one.
 * They stay bounded — a five-year timeline of every event is neither readable nor cheap.
 */
export const MAX_PAST_DAYS = 400;
export const MAX_LIMIT = 60;

/**
 * How many events a window of `pastDays` is allowed to surface: roughly one per fortnight, floored at
 * the default and capped at `MAX_LIMIT`. A 7-day window keeps its tight 8-event view; a year gets
 * enough rows to be a year without becoming a list of everything.
 */
export function limitForWindow(pastDays: number): number {
  return Math.min(MAX_LIMIT, Math.max(DEFAULT_LIMIT, Math.ceil(pastDays / 14)));
}

/**
 * Upper bound on the history we scan for records/streaks. Milestones are "first time ever", so they
 * genuinely need the full history; the cap stops a pathological account from loading unboundedly.
 */
export const MAX_HISTORY = 20_000;

const clampInt = (value: number | undefined, fallback: number, lo: number, hi: number): number => {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(hi, Math.max(lo, Math.trunc(value)));
};

async function loadPlanned(
  deps: TimelineDeps,
  userId: string,
  from: DayKey,
  to: DayKey
): Promise<PlannedFeed> {
  // Sessions the athlete authored HERE (spec 050) always read, with no port and no Garmin call: they
  // live in the local store, so they are the one part of the forward half that is never "not synced".
  const authored = await loadAuthored(deps, userId, from, to);

  if (!deps.plannedWorkouts) {
    // No calendar source wired. Authored sessions are still real and still shown; only the absence of
    // GARMIN's plans is unknown, which is what `not_synced` says.
    return {
      from,
      to,
      status: authored.length > 0 ? 'ok' : 'not_synced',
      events: authored
    };
  }

  const feed = await deps.plannedWorkouts.listPlanned(userId, from, to);
  // An unreadable calendar is NOT an empty calendar — say the true thing.
  if (!feed.available) {
    return { from, to, status: authored.length > 0 ? 'ok' : 'not_synced', events: authored };
  }

  // Only keep items that actually land in the window and carry a real day key — this data comes
  // from Garmin and is untrusted like every other upstream payload.
  const inWindow = feed.events.filter((e) => isDayKey(e.day) && e.day >= from && e.day <= to);
  // A session we pushed comes BACK from Garmin's calendar on the next sync. Listing both copies would
  // show the athlete two identical sessions, so the local row (which knows its push state) wins.
  const pushedIds = new Set(authored.map((e) => e.pushedGarminId).filter((id): id is string => id !== null));
  const fromGarmin = inWindow.filter((e) => !pushedIds.has(e.id));
  const sorted = [...fromGarmin, ...authored.map(({ pushedGarminId: _ignored, ...e }) => e)].sort(
    (a, b) => a.day.localeCompare(b.day) || (a.time ?? '').localeCompare(b.time ?? '')
  );
  return { from, to, status: sorted.length > 0 ? 'ok' : 'empty', events: sorted };
}

/** An authored session as a timeline event, plus the Garmin id used to dedupe it (stripped after). */
type AuthoredPlannedEvent = PlannedEvent & { pushedGarminId: string | null };

async function loadAuthored(
  deps: TimelineDeps,
  userId: string,
  from: DayKey,
  to: DayKey
): Promise<AuthoredPlannedEvent[]> {
  const rows = await deps.store.listWorkouts(userId, { from, to });
  return rows.map((w) => ({
    id: `authored:${w.id}`,
    day: w.day as DayKey,
    time: w.time,
    kind: 'workout' as const,
    title: w.title,
    sport: w.sport,
    description: w.note,
    estimatedDurationS: estimateWorkoutDurationS(w.steps),
    estimatedDistanceM: estimateWorkoutDistanceM(w.steps),
    targetLoad: null,
    source: 'garmin' as const,
    authored: true,
    push: w.pushState,
    pushedGarminId: w.garminWorkoutId
  }));
}

export async function loadTimeline(deps: TimelineDeps, req: TimelineRequest): Promise<TimelineData> {
  const pastDays = clampInt(req.pastDays, DEFAULT_PAST_DAYS, 1, MAX_PAST_DAYS);
  const futureDays = clampInt(req.futureDays, DEFAULT_FUTURE_DAYS, 1, 30);
  // Default scales with the window rather than pinning every range to 8 rows (spec 047).
  const limit = clampInt(req.limit, limitForWindow(pastDays), 1, MAX_LIMIT);

  const today =
    req.today !== undefined && isDayKey(req.today)
      ? req.today
      : todayKey(deps.clock, deps.timeZone ?? DEFAULT_TIME_ZONE);

  const from = addDays(today, -(pastDays - 1));
  const plannedFrom = addDays(today, 1);
  const plannedTo = addDays(today, futureDays);

  // One history read serves both halves: the window's activities AND the all-time records the
  // milestone detector compares against.
  const [history, planned] = await Promise.all([
    deps.store.listActivities(req.userId, { sort: 'date', dir: 'desc', limit: MAX_HISTORY }),
    loadPlanned(deps, req.userId, plannedFrom, plannedTo)
  ]);

  const ranked = buildTimeline({
    history: history as readonly TimelineActivityInput[],
    signals: req.signals ?? [],
    from,
    to: today,
    limit
  });

  return {
    today,
    past: {
      from,
      to: today,
      events: ranked.events,
      primaryCount: ranked.primaryCount,
      totalCount: ranked.totalCount
    },
    planned
  };
}
