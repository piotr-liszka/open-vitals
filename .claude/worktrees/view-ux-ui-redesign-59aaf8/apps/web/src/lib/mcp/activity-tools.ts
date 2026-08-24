/**
 * Activity-detail tools (spec 077) — what was INSIDE the session.
 *
 * Coaching feedback, August 2026: a workout called "VO2 Max" reported as 7.27 km at 5:41/km with an
 * average heart rate of 144 is indistinguishable from a jog of the same length. Whether it was
 * 5×800 with the third repeat falling apart, or a steady run, is the entire question — and none of
 * it was reachable, even though the per-lap rows have been in the store since spec 023.
 *
 * This adds no maths. It reuses `loadActivityDetail`, the same handler the web page uses, and
 * projects it into a shape a model reads rather than a shape a chart draws.
 */
import { z } from 'zod';
import type { SettingsRepo } from '../server/repo/types';
import type { ActivityLap, JournalEntry, LocalStore } from '../server/store/types';
import { loadActivityDetail, type ActivityDetailDeps } from '$modules/activity-detail/activity-detail.api';
import type { ActivityDetailData } from '$modules/activity-detail/activity-detail.types';
import { sportLabel } from '$lib/sport-labels';
import { createTranslator } from '$lib/i18n';
import type { ToolResult } from './tools';

/** Everything the activity tools need. All injected (AGENTS.md §2 rule 4). */
export interface ActivityToolDeps {
  store: LocalStore;
  settings: SettingsRepo;
  /** The ONE user these tools may touch — resolved from the MCP token, never from an argument. */
  userId: string;
}

export interface ActivityTool {
  name: string;
  description: string;
  inputShape: z.ZodRawShape;
  handler(deps: ActivityToolDeps, args: Record<string, unknown>): Promise<ToolResult>;
}

/**
 * Laps returned per call. A 200-lap pool swim would otherwise fill the context window with rows
 * nobody asked for. When it bites, the payload says how many were dropped — a silent truncation
 * reads as "that was the whole session".
 */
export const LAP_CAP = 60;

/** Activities one `list_activities` call returns. */
export const LIST_CAP = 50;

/**
 * MCP tool output is an ENGLISH machine surface, so its sport names are English too (spec 076) — not
 * the reader's UI language, which an MCP request does not carry. Same translator the workout and
 * season tools use, for the same reason.
 */
const MCP_TRANSLATOR = createTranslator('en');

function text(value: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }]
  };
}

function errorText(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

const api = (deps: ActivityToolDeps): ActivityDetailDeps => ({
  store: deps.store,
  settings: deps.settings
});

const round = (v: number | null | undefined, places = 1): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10 ** places) / 10 ** places : null;

/**
 * Seconds per kilometre from distance and duration.
 *
 * Deliberately NOT read off `avgSpeedMps`: a lap that carries a speed field but no distance would
 * otherwise produce a confident-looking pace for a lap we cannot actually measure.
 */
function paceSecPerKm(distanceM: number | undefined, durationS: number | undefined): number | null {
  if (!distanceM || !durationS || distanceM <= 0 || durationS <= 0) return null;
  return Math.round((durationS / distanceM) * 1000);
}

/** `m:ss/km`, so the model never has to divide to read a pace aloud. */
function paceLabel(secPerKm: number | null): string | null {
  if (secPerKm === null) return null;
  return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, '0')}/km`;
}

function lapView(lap: ActivityLap): Record<string, unknown> {
  const pace = paceSecPerKm(lap.distanceM, lap.durationS);
  return {
    index: lap.index,
    distanceM: round(lap.distanceM, 0),
    durationS: round(lap.durationS, 0),
    ...(pace !== null ? { paceSecPerKm: pace, pace: paceLabel(pace) } : {}),
    ...(lap.avgHr ? { avgHr: Math.round(lap.avgHr) } : {}),
    ...(lap.maxHr ? { maxHr: Math.round(lap.maxHr) } : {}),
    ...(lap.avgRunCadenceSpm ? { avgCadenceSpm: Math.round(lap.avgRunCadenceSpm) } : {}),
    ...(lap.avgStrideLengthCm ? { avgStrideLengthCm: round(lap.avgStrideLengthCm) } : {}),
    ...(lap.intensityType ? { intensityType: lap.intensityType } : {})
  };
}

/**
 * The three session-level numbers that each change how a run is read, plus the rest of the running
 * dynamics. Absent fields are omitted rather than sent as null — a model reading `avgCadenceSpm:
 * null` treats it as a measured zero often enough to matter.
 */
function dynamicsView(detail: ActivityDetailData): Record<string, unknown> {
  const rd = detail.stats.runningDynamics;
  const temp = detail.stats.temperature;
  return {
    ...(rd.avgCadenceSpm ? { avgCadenceSpm: Math.round(rd.avgCadenceSpm) } : {}),
    ...(rd.maxCadenceSpm ? { maxCadenceSpm: Math.round(rd.maxCadenceSpm) } : {}),
    ...(rd.avgStrideLengthCm ? { avgStrideLengthCm: round(rd.avgStrideLengthCm) } : {}),
    ...(rd.avgGroundContactTimeMs ? { avgGroundContactTimeMs: Math.round(rd.avgGroundContactTimeMs) } : {}),
    ...(rd.avgVerticalOscillationCm ? { avgVerticalOscillationCm: round(rd.avgVerticalOscillationCm) } : {}),
    ...(temp.avgC !== undefined ? { temperatureC: round(temp.avgC) } : {}),
    ...(temp.maxC !== undefined ? { maxTemperatureC: round(temp.maxC) } : {})
  };
}

function subjectiveView(entry: JournalEntry | null): Record<string, unknown> | null {
  if (!entry) return null;
  return {
    ...(entry.rpe !== null ? { rpe: entry.rpe } : {}),
    ...(entry.note !== null ? { note: entry.note } : {})
  };
}

const detailTool: ActivityTool = {
  name: 'get_activity_detail',
  description:
    'WHAT HAPPENED INSIDE one session — the lap splits, not just the averages. Returns every lap with ' +
    'its distance, duration, pace, heart rate, cadence and stride length, so 5×800 is ' +
    'distinguishable from a steady run of the same total. Also returns the session-level running ' +
    'dynamics and the AMBIENT TEMPERATURE, which are the numbers that most often change the reading: ' +
    'cadence against a prescribed range, stride length as an overstriding warning, and 5:26/km at ' +
    '30 °C being a different run from the same pace at 8 °C. Any RPE the athlete logged for this ' +
    'session (log_note) comes back with it. Use list_activities to find the id.',
  inputShape: {
    activityId: z.string().min(1).describe('Activity id, from list_activities or get_activities')
  },
  async handler(deps, args) {
    const activityId = String(args.activityId ?? '');
    const detail = await loadActivityDetail(api(deps), deps.userId, activityId);
    if (!detail) return errorText(`no activity with id ${activityId}`);

    const a = detail.activity;
    const day = a.startTimeLocal.slice(0, 10);
    const pace = paceSecPerKm(a.distanceM ?? undefined, a.movingS ?? a.durationS ?? undefined);

    // The RPE for this session, if the athlete logged one (spec 062). Read here rather than left to
    // a second call, because the whole value of an RPE is being read against the splits beside it.
    const entries = await deps.store.listJournalEntries(deps.userId, { from: day, to: day });
    const subjective = subjectiveView(entries.find((e) => e.activityId === activityId) ?? null);

    const laps = detail.laps.slice(0, LAP_CAP);
    const dropped = detail.laps.length - laps.length;

    return text({
      activity: {
        id: a.id,
        day,
        sport: sportLabel(MCP_TRANSLATOR, a.sport),
        name: a.name,
        distanceM: round(a.distanceM, 0),
        durationS: round(a.durationS, 0),
        ...(pace !== null ? { paceSecPerKm: pace, pace: paceLabel(pace) } : {}),
        ...(a.avgHr ? { avgHr: a.avgHr } : {}),
        ...(a.maxHr ? { maxHr: a.maxHr } : {}),
        ...(a.elevationGainM ? { elevationGainM: round(a.elevationGainM, 0) } : {})
      },
      dynamics: dynamicsView(detail),
      // An empty array reads as "no data at all". Saying which of the two it is costs one field.
      ...(laps.length > 0
        ? { laps: laps.map(lapView) }
        : { laps: [], lapsNote: 'This activity has no recorded laps — the device stored it as one block.' }),
      ...(dropped > 0
        ? {
            lapsTruncated: dropped,
            lapsNote: `Showing the first ${LAP_CAP} laps; ${dropped} more not shown.`
          }
        : {}),
      // Garmin's own work/rest classification: it answers "was this an interval session" without the
      // model having to infer it from how the lap lengths alternate.
      ...(detail.typedSplits.length > 0
        ? { typedSplits: detail.typedSplits.slice(0, LAP_CAP).map(lapView) }
        : {}),
      ...(subjective ? { subjective } : {}),
      ...(detail.trainingComparison ? { verdict: detail.trainingComparison.summary } : {})
    });
  }
};

const listTool: ActivityTool = {
  name: 'list_activities',
  description:
    'Find sessions to ask about: id, day, sport, name, distance, duration, pace and heart rate, ' +
    'newest first. Filter by day range and sport. This is how you get an id for ' +
    'get_activity_detail, which is where the lap splits live.',
  inputShape: {
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullish(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullish(),
    sport: z.string().max(60).nullish().describe('Garmin sport key, e.g. running, cycling'),
    limit: z.number().int().min(1).max(LIST_CAP).nullish()
  },
  async handler(deps, args) {
    const activities = await deps.store.listActivities(deps.userId, {
      ...(args.from != null ? { from: String(args.from) } : {}),
      ...(args.to != null ? { to: String(args.to) } : {}),
      ...(args.sport != null ? { sport: String(args.sport) } : {}),
      limit: Math.min(Number(args.limit ?? 20), LIST_CAP)
    });

    return text({
      count: activities.length,
      activities: activities.map((a) => {
        const pace = paceSecPerKm(a.distanceM ?? undefined, a.movingS ?? a.durationS ?? undefined);
        return {
          id: a.activityId,
          day: a.startTimeLocal.slice(0, 10),
          sport: sportLabel(MCP_TRANSLATOR, a.sport),
          name: a.name,
          distanceM: round(a.distanceM, 0),
          durationS: round(a.durationS, 0),
          ...(pace !== null ? { pace: paceLabel(pace) } : {}),
          ...(a.avgHr ? { avgHr: a.avgHr } : {})
        };
      })
    });
  }
};

export const ACTIVITY_TOOLS: readonly ActivityTool[] = [detailTool, listTool];
