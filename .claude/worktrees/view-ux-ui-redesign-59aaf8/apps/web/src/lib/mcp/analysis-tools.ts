/**
 * Load, bests and time-trial tools (spec 079) — the last three items on the coaching feedback.
 *
 * Two of them expose numbers the app already computes and draws: the PMC (CTL/ATL/TSB) with its
 * ACWR, and spec 054's stored best-efforts leaderboard. Neither adds any maths.
 *
 * The third does carry a judgement. Turning a time trial into training paces is a coaching MODEL,
 * not a measurement, so it lives in `lib/analytics/training-paces.ts` where it can be read and
 * argued with, its name travels with every number it produces, and it does not write anything
 * unless asked: `apply` defaults to false, because silently overwriting a coach's pace bands with a
 * formula is the wrong kind of automation.
 */
import { z } from 'zod';
import type { Clock } from '../server/clock';
import type { ActivitySummary, LocalStore } from '../server/store/types';
import type { SettingsRepo } from '../server/repo/types';
import { addDays, toDayKey, todayKey, type DayKey } from '$lib/date';
import { sportGroup, sportKeysInGroup, type SportGroup } from '$lib/sport-labels';
import { buildTrainingLoad, type LoadActivity } from '$lib/server/analytics/training-load';
import { loadRisk, MIN_HISTORY_DAYS } from '$lib/server/analytics/load-risk';
import { EFFORT_DISTANCES } from '$lib/analytics/best-efforts';
import { loadActivityDetail } from '$modules/activity-detail/activity-detail.api';
import { pacesFromTimeTrial, TimeTrialInputError } from '$lib/analytics/training-paces';
import type { ToolResult } from './tools';

export interface AnalysisToolDeps {
  store: LocalStore;
  settings: SettingsRepo;
  /** The ONE user these tools may touch — resolved from the MCP token, never from an argument. */
  userId: string;
  clock: Clock;
  timeZone?: string;
}

export interface AnalysisTool {
  name: string;
  description: string;
  inputShape: z.ZodRawShape;
  handler(deps: AnalysisToolDeps, args: Record<string, unknown>): Promise<ToolResult>;
}

/** Days of history the PMC is warmed over. CTL's 42-day constant means older days cannot move today. */
const HISTORY_DAYS = 540;
/** Longest window a caller may ask to see. */
const MAX_WINDOW_DAYS = 365;
/** Points returned however long the window is — a 365-row daily series is a context window nobody gets back. */
export const MAX_SERIES_POINTS = 60;

function text(value: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }]
  };
}

function errorText(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

function today(deps: AnalysisToolDeps): DayKey {
  return todayKey(deps.clock, deps.timeZone);
}

/** `h:mm:ss`, or `mm:ss` under an hour — the way a result is read aloud. */
function hms(totalS: number): string {
  const s = Math.round(totalS);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Seconds per km as `m:ss`, without a unit — for building a range label. */
function mmss(secPerKm: number): string {
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function paceLabel(secPerKm: number): string {
  return `${mmss(secPerKm)}/km`;
}

const toLoadActivity = (a: ActivitySummary): LoadActivity => ({
  day: toDayKey(a.startTimeLocal),
  durationS: a.movingS ?? a.durationS,
  trainingLoad: a.trainingLoad,
  avgHr: a.avgHr,
  maxHr: a.maxHr,
  // Power streams are deliberately not loaded here: Garmin's own training load is present on
  // essentially every activity, and pulling hundreds of stream blobs to refine a number the athlete
  // already has would be the expensive half of the training page for none of the benefit.
  power: null
});

const loadSeriesTool: AnalysisTool = {
  name: 'get_load_series',
  description:
    'Training load over time, stated directly rather than buried in a readiness payload: fitness ' +
    '(CTL), fatigue (ATL), form (TSB) as a series, plus the acute-to-chronic ratio with its band ' +
    'and what it implies. `biggestJump` names the sharpest day-over-day rise in fatigue in the ' +
    'window and the day it happened — the number that says "this is where the load spiked". The ' +
    'series is downsampled to a fixed number of points and reports the interval it used.',
  inputShape: {
    days: z.number().int().min(7).max(MAX_WINDOW_DAYS).nullish().describe('Window length, default 90'),
    sport: z.string().max(30).nullish().describe('Sport family: run, ride, walk, swim')
  },
  async handler(deps, args) {
    const end = today(deps);
    const window = Math.min(Number(args.days ?? 90), MAX_WINDOW_DAYS);
    const family = args.sport == null ? null : sportGroup(String(args.sport));

    const activities = await deps.store.listActivities(deps.userId, {
      from: addDays(end, -HISTORY_DAYS),
      to: end,
      ...(family ? { sports: sportKeysInGroup(family as SportGroup) } : {}),
      limit: 5000
    });

    const settings = await deps.settings.get(deps.userId);
    const ftp = typeof settings.ftpWatts === 'number' ? settings.ftpWatts : null;
    const pmc = buildTrainingLoad(activities.map(toLoadActivity), { ftpWatts: ftp, endDay: end });

    if (!pmc.hasData || pmc.series.length < MIN_HISTORY_DAYS) {
      return text({
        message:
          `Not enough history to report load honestly — the model needs at least ${MIN_HISTORY_DAYS} ` +
          'days of continuous data before CTL and ACWR mean anything. Say so rather than reporting a zero.',
        daysAvailable: pmc.series.length
      });
    }

    const from = addDays(end, -(window - 1));
    const inWindow = pmc.series.filter((p) => p.day >= from);
    const risk = loadRisk(pmc.series);

    // The spike: the sharpest day-over-day rise in FATIGUE inside the window. Fatigue rather than
    // fitness because that is the one that moves in a day — CTL cannot jump by construction.
    let jump: { day: string; from: number; to: number; delta: number } | null = null;
    for (let i = 1; i < inWindow.length; i++) {
      const prev = inWindow[i - 1]!;
      const cur = inWindow[i]!;
      const delta = cur.atl - prev.atl;
      if (!jump || delta > jump.delta) {
        jump = { day: cur.day, from: round1(prev.atl), to: round1(cur.atl), delta: round1(delta) };
      }
    }

    // Downsample rather than dump. Always keep the last point: the reader's "where am I now".
    const step = Math.max(1, Math.ceil(inWindow.length / MAX_SERIES_POINTS));
    const sampled = inWindow.filter((_, i) => i % step === 0 || i === inWindow.length - 1);

    return text({
      from,
      to: end,
      ...(family ? { sport: family } : {}),
      fitnessCtl: round1(pmc.ctl),
      fatigueAtl: round1(pmc.atl),
      formTsb: round1(pmc.tsb),
      band: pmc.band,
      recommendation: pmc.recommendation,
      acwr: risk.acwr,
      acwrBand: risk.band,
      rampPerWeek: risk.rampRatePerWeek,
      advice: risk.advice,
      ...(jump ? { biggestJump: jump } : {}),
      sampledEvery: step === 1 ? 'every day' : `every ${step} days`,
      series: sampled.map((p) => ({
        day: p.day,
        ctl: round1(p.ctl),
        atl: round1(p.atl),
        tsb: round1(p.tsb)
      }))
    });
  }
};

const personalBestsTool: AnalysisTool = {
  name: 'get_personal_bests',
  description:
    "The athlete's fastest ever effort at each standard distance, from the stored leaderboard — " +
    'including bests set INSIDE a longer session, not just races. Each carries the day and the ' +
    'activity id, so get_activity_detail can open the session that set it. Defaults to running.',
  inputShape: {
    sport: z.string().max(30).nullish().describe('Sport family, default run'),
    limit: z.number().int().min(1).max(5).nullish().describe('Rows per distance, default 1')
  },
  async handler(deps, args) {
    const family = sportGroup(String(args.sport ?? 'running'));
    const limit = Math.min(Number(args.limit ?? 1), 5);

    const rows = await deps.store.listTopBestEfforts(deps.userId, {
      limit,
      sports: sportKeysInGroup(family as SportGroup)
    });

    if (rows.length === 0) {
      return text({
        sport: family,
        count: 0,
        message:
          'No stored best efforts for this sport yet. They are derived from activity streams as they ' +
          'sync, so a fresh account has none — say so rather than reporting the athlete has no bests.'
      });
    }

    // Group by distance, keeping the leaderboard order the store already applied.
    const byKey = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byKey.get(row.key) ?? [];
      list.push(row);
      byKey.set(row.key, list);
    }

    const distances = EFFORT_DISTANCES.filter((d) => byKey.has(d.key)).map((d) => {
      const list = byKey.get(d.key)!;
      const best = list[0]!;
      return {
        key: d.key,
        label: d.label,
        distanceM: d.metres,
        best: {
          durationS: Math.round(best.durationS),
          time: hms(best.durationS),
          pace: paceLabel(best.paceSecPerKm),
          day: best.day,
          activityId: best.activityId,
          activityName: best.activityName
        },
        ...(list.length > 1
          ? {
              runnersUp: list.slice(1).map((r) => ({
                time: hms(r.durationS),
                pace: paceLabel(r.paceSecPerKm),
                day: r.day,
                activityId: r.activityId
              }))
            }
          : {})
      };
    });

    return text({ sport: family, count: distances.length, distances });
  }
};

const timeTrialTool: AnalysisTool = {
  name: 'mark_as_time_trial',
  description:
    'Treat one session as a time trial and derive training pace bands from it. Reads the ACTUAL ' +
    'time for the given distance out of that session (a 5 km inside a longer run is not the same ' +
    'as the run average), converts it to an equivalent 5 km through Riegel, and applies documented ' +
    'offsets to produce easy / long / threshold / interval / goal bands. These come from a NAMED ' +
    'MODEL, not from measurement, and the model is reported with them — two athletes with the same ' +
    '5 km differ in where their threshold really sits. It PROPOSES by default; pass apply: true to ' +
    'write the bands onto the block covering that day, and the previous values come back so the ' +
    'change is reversible.',
  inputShape: {
    activityId: z.string().min(1),
    distanceM: z.number().positive().describe('The time-trialled distance in metres, e.g. 5000'),
    apply: z.boolean().nullish().describe('Write the bands onto the block. Default false: propose only.')
  },
  async handler(deps, args) {
    const activityId = String(args.activityId ?? '');
    const distanceM = Number(args.distanceM);

    /*
     * Through `loadActivityDetail` rather than a new store method: it already computes this
     * session's own best efforts (spec 040) from the stored streams, so the number here is the same
     * one the activity page shows. Adding a per-activity getter to the port would have been a second
     * source for one fact.
     */
    const detail = await loadActivityDetail(
      { store: deps.store, settings: deps.settings },
      deps.userId,
      activityId
    );
    if (!detail) return errorText(`no activity with id ${activityId}`);

    const efforts = detail.bestEfforts;
    // Match on the nominal target, so "5000" finds the `5k` effort whatever it actually covered.
    const effort = efforts.find((e) => e.metres === distanceM);
    if (!effort) {
      const available = efforts.map((e) => e.metres).sort((a, b) => a - b);
      return errorText(
        available.length === 0
          ? `That session has no measurable efforts — it has no distance stream, so there is no ${distanceM} m time in it to use.`
          : `That session holds no ${distanceM} m effort. It does have: ${available.join(', ')} m.`
      );
    }

    let derived;
    try {
      derived = pacesFromTimeTrial(distanceM, effort.durationS);
    } catch (err) {
      if (err instanceof TimeTrialInputError) return errorText(err.message);
      throw err;
    }

    const day = toDayKey(detail.activity.startTimeLocal.slice(0, 10));
    const source = {
      day,
      activityId,
      distanceM,
      durationS: Math.round(effort.durationS),
      time: hms(effort.durationS),
      pace: paceLabel(effort.paceSecPerKm)
    };
    const paces = Object.fromEntries(
      Object.entries(derived.paces).map(([key, range]) => [
        key,
        { ...range, label: `${mmss(range.lowS)}–${mmss(range.highS)}/km` }
      ])
    );

    const block = await deps.store.findBlockForDay(deps.userId, day);

    if (args.apply !== true) {
      return text({
        source,
        model: derived.model,
        equivalent5kPace: paceLabel(derived.equivalent5kPaceS),
        paces,
        applied: false,
        ...(block ? { wouldUpdate: { id: block.id, name: block.name } } : {}),
        next: block
          ? 'These are a proposal from a formula, not a measurement. Call again with apply: true to write them, or adjust them first with update_training_block.'
          : 'No training block covers that day, so there is nothing to write these onto. create_training_block first if you want them stored.'
      });
    }

    if (!block) {
      return errorText(
        `No training block covers ${day}, so there are no pace bands to update. Create one first.`
      );
    }

    const previous = block.paces;
    const updated = await deps.store.updateBlock(deps.userId, block.id, {
      paces: derived.paces,
      updatedAt: deps.clock.now().toISOString()
    });

    return text({
      source,
      model: derived.model,
      equivalent5kPace: paceLabel(derived.equivalent5kPaceS),
      paces,
      applied: true,
      block: { id: block.id, name: updated?.name ?? block.name },
      previous
    });
  }
};

export const ANALYSIS_TOOLS: readonly AnalysisTool[] = [loadSeriesTool, personalBestsTool, timeTrialTool];
