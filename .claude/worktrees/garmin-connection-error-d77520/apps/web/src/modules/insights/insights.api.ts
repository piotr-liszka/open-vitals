/**
 * Insights data handler (spec 013). Fetches each metric across the selected window (chunked into
 * ≤31-day sidecar range calls), extracts per-day values with the shared metric-spec helpers, runs
 * the pure engine, and assembles `InsightsData`.
 *
 * Pure over injected deps (`GarminService`, `Clock`). Never throws on connected/sidecar
 * issues — it degrades to flags with empty results. The only thrown
 * error is `InvalidWindowError`, which the route maps to HTTP 400.
 */
import type { Clock } from '$lib/server/clock';
import { DEFAULT_TIME_ZONE, addDays, todayKey } from '$lib/date';
import type { RangeBucket, ResolvedRange } from '$lib/range';
import { bucketSeries } from '$lib/series';
import {
  GarminNotAuthenticatedError,
  GarminUnavailableError,
  type GarminService
} from '$lib/server/interfaces';
import { METRICS, extractMetricValue } from '$lib/server/garmin/metric-specs';
import { fetchMetricRangeChunked } from '$lib/server/garmin/range';
import { computeInsights, DEFAULT_INSIGHTS_CONFIG } from './insights.engine';
import { computeCondition, type ConditionSeries } from './insights.condition';
import { latestTrainingReadiness, markSuperseded, parseGarminInstant } from './insights.garmin-readiness';
import { remainingMinutes } from './condition.format';
import { summarizeMetric } from './insights.stats';
import type { DayPoint, InsightsData, MetricChart } from './insights.types';

/**
 * Explicit windows `loadInsights` accepts as a day count, in days.
 *
 * These are no longer a *selector* — spec 047 moved window choice to the app-wide range switch, which
 * hands this loader a `ResolvedRange` instead (and can reach "cały czas", an arbitrary span no fixed
 * list could hold). The list survives for the two callers that name a fixed baseline: the start page's
 * condition block, and the long-standing `GET /api/insights?window=` contract — including `90`, which
 * the UI no longer offers but existing callers may still ask for.
 */
export const INSIGHT_WINDOWS = [7, 14, 30, 90, 365] as const;
export type InsightWindow = (typeof INSIGHT_WINDOWS)[number];
const DEFAULT_WINDOW: InsightWindow = 30;

/**
 * The baseline the condition/readiness block is computed over, regardless of the global range: it
 * answers "how am I right now" by comparing today against a recent norm, and a five-year norm would
 * answer something else entirely (spec 047).
 */
export const CONDITION_WINDOW_DAYS: InsightWindow = 30;

/**
 * Ceiling on a range-driven window. "Cały czas" is already bounded by the earliest synced day, but the
 * engine's correlation maths is O(days) per metric pair — this keeps a decade-long account bounded.
 */
export const MAX_INSIGHT_DAYS = 2200;

export interface InsightsDeps {
  garmin: GarminService;
  clock: Clock;
  /** IANA zone "today" resolves in (spec 018). Defaults to the app timezone. */
  timeZone?: string;
}

export interface LoadInsightsOptions {
  /**
   * The global range (spec 047), already resolved against the user's today and earliest synced day.
   * Takes precedence over `window` — this is how the Wnioski page asks for anything from 7 days to
   * the whole history.
   */
  range?: ResolvedRange;
  /**
   * A fixed baseline in days, from `INSIGHT_WINDOWS`. For callers that mean a specific span rather
   * than "whatever the user is looking at": the condition block and `GET /api/insights?window=`.
   */
  window?: number;
}

/** Thrown for an explicit `window` outside `INSIGHT_WINDOWS`; the route maps this to 400. */
export class InvalidWindowError extends Error {
  constructor(readonly window: number) {
    super(`invalid window: ${window} (must be one of ${INSIGHT_WINDOWS.join(', ')})`);
    this.name = 'InvalidWindowError';
  }
}

export function isInsightWindow(value: number): value is InsightWindow {
  return (INSIGHT_WINDOWS as readonly number[]).includes(value);
}

/**
 * Fetch every metric across the window. The RAW day payloads ride along beside the extracted
 * scalars: the condition snapshot (spec 022) needs sleep stages and bed/wake timestamps, which the
 * per-metric scalar throws away, and re-fetching them would double the store reads for nothing.
 * `ConditionSeries` is a superset of the engine's `MetricSeriesInput`, so the engine is unaffected.
 */
async function fetchSeries(garmin: GarminService, start: string, end: string): Promise<ConditionSeries[]> {
  return Promise.all(
    METRICS.map(async (spec) => {
      try {
        const days = await fetchMetricRangeChunked(garmin, spec.key, start, end);
        const points: DayPoint[] = days.map((d) => ({
          date: d.date,
          value: extractMetricValue(spec, d.data)
        }));
        return { spec, days: points, raw: days };
      } catch (err) {
        // A single flaky metric must not blank the whole page.
        if (err instanceof GarminUnavailableError || err instanceof GarminNotAuthenticatedError) {
          return { spec, days: [] as DayPoint[], raw: [] };
        }
        throw err;
      }
    })
  );
}

/**
 * How far back to look for an activity that could have superseded the recovery timer (spec 075).
 *
 * Garmin's own timer caps out around four days, and a readiness reading older than that is not
 * driving anything on the card anyway — so a short tail is enough, and keeps this from re-reading a
 * multi-year window for one timestamp.
 */
const SUPERSEDE_LOOKBACK_DAYS = 4;

/**
 * The newest activity start we hold, as epoch ms (spec 075) — the fact that decides whether Garmin's
 * recovery countdown may keep running or has been overtaken by a session Garmin has not scored yet.
 *
 * `startTimeGMT` only. `startTimeLocal` carries no offset and would be read as UTC, quietly placing
 * every activity two hours early in summer — which in this comparison means falsely NOT superseding.
 * A missing GMT stamp is simply skipped: it is one activity's worth of caution, not a wrong instant.
 */
async function latestActivityStart(
  garmin: GarminService,
  start: string,
  end: string
): Promise<number | null> {
  try {
    const days = await fetchMetricRangeChunked(garmin, 'activities', start, end);
    let newest: number | null = null;
    for (const day of days) {
      const list = Array.isArray(day.data) ? day.data : [];
      for (const raw of list) {
        if (typeof raw !== 'object' || raw === null) continue;
        const rec = raw as Record<string, unknown>;
        const stamp = rec['startTimeGMT'] ?? rec['startTime'];
        const ms = parseGarminInstant(typeof stamp === 'string' ? stamp : null);
        if (ms !== null && (newest === null || ms > newest)) newest = ms;
      }
    }
    return newest;
  } catch (err) {
    // The countdown is a nicety; a flaky activities read must not blank the condition card.
    if (err instanceof GarminUnavailableError || err instanceof GarminNotAuthenticatedError) return null;
    throw err;
  }
}

/** Re-shape a daily `DayPoint[]` into one point per bucket (identity for a daily range). */
function bucketPoints(days: readonly DayPoint[], bucket: RangeBucket): DayPoint[] {
  if (bucket === 'day') return [...days];
  const { days: keys, values } = bucketSeries(
    days.map((d) => d.date),
    days.map((d) => d.value),
    bucket,
    'mean'
  );
  return keys.map((date, i) => ({ date, value: values[i] ?? null }));
}

export async function loadInsights(
  deps: InsightsDeps,
  opts: LoadInsightsOptions = {}
): Promise<InsightsData> {
  // Window ends on the user's local today (spec 018), never a UTC day key.
  const today = todayKey(deps.clock, deps.timeZone ?? DEFAULT_TIME_ZONE);

  // A resolved global range wins; otherwise a named window, validated so a hand-typed `?window=`
  // cannot widen a store read.
  let window: number;
  let start: string;
  let end: string;
  if (opts.range) {
    window = Math.min(opts.range.days, MAX_INSIGHT_DAYS);
    end = opts.range.end;
    start = addDays(end, -(window - 1));
  } else {
    window = opts.window ?? DEFAULT_WINDOW;
    if (!isInsightWindow(window)) throw new InvalidWindowError(window);
    end = today;
    start = addDays(end, -(window - 1));
  }

  let connected = false;
  try {
    connected = (await deps.garmin.getStatus()).authenticated;
  } catch (err) {
    if (!(err instanceof GarminUnavailableError)) throw err;
  }

  if (!connected) {
    return {
      connected,
      window,
      start,
      end,
      readiness: null,
      trends: [],
      anomalies: [],
      correlations: [],
      charts: [],
      condition: null
    };
  }

  const seriesList = await fetchSeries(deps.garmin, start, end);

  /*
   * The ENGINE always sees the full daily series — correlations, anomalies and baselines are day-level
   * statistics and bucketing them first would smooth away exactly what they look for. Only the CHARTS
   * are bucketed (spec 047): a year of daily points is unreadable, and five years of them is ~1 800
   * points per metric on the wire. Always by mean, so a point is "an average day in that week/month"
   * and stays comparable with the daily view.
   */
  const bucket = opts.range?.bucket ?? 'day';
  const charts: MetricChart[] = seriesList.map(({ spec, days }) => {
    // Statistics first, from the DAILY series; the chart is bucketed afterwards (spec 048).
    const stats = summarizeMetric(spec, days);
    const drawn = bucketPoints(days, bucket);
    return {
      ...stats,
      days: drawn,
      series: drawn.filter((d) => d.value !== null).map((d) => d.value as number)
    };
  });

  /*
   * Garmin's recovery timer feeds our OWN score as a ceiling (spec 070). It is the one input that
   * explained most of the gap between the two numbers on the card — the four z-scored channels
   * cannot see training load at all, so a month of hard work moves the baseline instead of the
   * score. Parsed here rather than inside `computeCondition` because readiness is computed first and
   * `computeCondition` receives it already finished.
   *
   * Since spec 075 the ceiling is fed the LIVE remaining minutes, not the figure frozen at capture:
   * the timer runs down whether or not we sync, so a ceiling stuck at the morning's value would keep
   * suppressing the score for hours after Garmin had stopped suppressing its own.
   */
  const nowMs = deps.clock.now().getTime();
  const latestActivityStartMs = await latestActivityStart(
    deps.garmin,
    addDays(today, -SUPERSEDE_LOOKBACK_DAYS),
    today
  );

  const trSeries = seriesList.find((s) => s.spec.key === 'training_readiness');
  const recovery = markSuperseded(
    trSeries ? (latestTrainingReadiness(trSeries.raw)?.recovery ?? null) : null,
    latestActivityStartMs
  );
  const recoveryMinutes = recovery ? remainingMinutes(recovery, nowMs) : null;

  const computed = computeInsights(seriesList, DEFAULT_INSIGHTS_CONFIG, { recoveryMinutes });
  const condition = computeCondition(seriesList, computed.readiness, today, {
    nowMs,
    latestActivityStartMs
  });

  return { connected: true, window, start, end, ...computed, charts, condition };
}
