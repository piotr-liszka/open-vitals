/**
 * Garmin MCP tools — framework-independent. Each tool is a pure async handler over an injected
 * GarminService, so it is unit-testable with a mock (AGENTS.md §7). Registration onto the MCP
 * server lives in create-server.ts.
 */
import { z } from 'zod';
import { DEFAULT_TIME_ZONE, addDays, todayKey, type NowSource } from '$lib/date';
import { systemClock } from '../server/clock';
import {
  GarminNotAuthenticatedError,
  GarminUnavailableError,
  GARMIN_METRICS,
  type GarminMetricName,
  type GarminService
} from '../server/interfaces';
import { METRICS, extractMetricValue } from '../server/garmin/metric-specs';
import { fetchMetricRangeChunked } from '../server/garmin/range';
import {
  computeInsights,
  DEFAULT_INSIGHTS_CONFIG,
  type MetricSeriesInput
} from '$modules/insights/insights.engine';
import type { DayPoint } from '$modules/insights/insights.types';

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

const dateArg = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  .optional();

const dateReq = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

const metricArg = z.enum(GARMIN_METRICS as unknown as [string, ...string[]]);

const windowArg = z.number().int().optional();

/** Args a tool handler may receive (superset across all tools). */
export type ToolArgs = { date?: string; metric?: string; start?: string; end?: string; window?: number };
/** @deprecated use ToolArgs — kept for existing imports. */
export type DateArgs = ToolArgs;

/**
 * Ambient context a tool may need beyond Garmin data (spec 018). Injected so "today" is deterministic
 * in tests and resolves in the user's zone rather than UTC; defaults keep existing callers working.
 */
export interface ToolContext {
  clock: NowSource;
  /** IANA zone that "today" resolves in. */
  timeZone: string;
}

export const DEFAULT_TOOL_CONTEXT: ToolContext = { clock: systemClock, timeZone: DEFAULT_TIME_ZONE };

export interface GarminTool {
  name: string;
  description: string;
  /** Zod raw shape for the MCP inputSchema. */
  inputShape: z.ZodRawShape;
  handler(garmin: GarminService, args: ToolArgs, ctx?: ToolContext): Promise<ToolResult>;
}

function text(value: unknown): ToolResult {
  const body = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: 'text', text: body }] };
}

function errorText(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

/** Map known Garmin failures to a friendly tool error, or rethrow the unexpected. */
function garminErrorResult(err: unknown): ToolResult {
  if (err instanceof GarminNotAuthenticatedError) {
    return errorText('Garmin account is not connected. Open the web app and complete Garmin setup first.');
  }
  if (err instanceof GarminUnavailableError) {
    return errorText('The Garmin service is temporarily unavailable. Try again shortly.');
  }
  throw err;
}

/** Run a metric fetch, converting known failures into friendly tool errors. */
async function safeMetric(garmin: GarminService, name: GarminMetricName, date?: string): Promise<ToolResult> {
  try {
    return text(await garmin.getMetric(name, date));
  } catch (err) {
    return garminErrorResult(err);
  }
}

function metricTool(name: GarminMetricName, description: string): GarminTool {
  return {
    name: `get_${name}`,
    description,
    inputShape: { date: dateArg },
    handler: (garmin, args) => safeMetric(garmin, name, args.date)
  };
}

/** Metrics combined into the health snapshot. */
const SNAPSHOT_METRICS: GarminMetricName[] = ['sleep', 'steps', 'body_battery', 'hrv', 'resting_heart_rate'];

/* ---------------- insights (spec 013) ---------------- */

const INSIGHT_WINDOWS = [7, 30, 90, 365];

/** Coerce/clamp an arbitrary day count to the nearest supported window (default 30). */
function clampWindow(window?: number): number {
  if (window === undefined || !Number.isFinite(window)) return 30;
  return INSIGHT_WINDOWS.reduce((best, v) => (Math.abs(v - window) < Math.abs(best - window) ? v : best), 30);
}

interface InsightsForWindow extends ReturnType<typeof computeInsights> {
  window: number;
  start: string;
  end: string;
  series: MetricSeriesInput[];
}

/** Fetch every metric across the window (chunked) and run the pure engine. */
async function insightsForWindow(
  garmin: GarminService,
  windowArgValue: number | undefined,
  ctx: ToolContext
): Promise<InsightsForWindow> {
  const window = clampWindow(windowArgValue);
  // Local calendar day, not UTC (spec 018) — a UTC "today" lags the user by up to two hours.
  const end = todayKey(ctx.clock, ctx.timeZone);
  const start = addDays(end, -(window - 1));
  const series: MetricSeriesInput[] = await Promise.all(
    METRICS.map(async (spec) => {
      const days = await fetchMetricRangeChunked(garmin, spec.key, start, end);
      const points: DayPoint[] = days.map((d) => ({ date: d.date, value: extractMetricValue(spec, d.data) }));
      return { spec, days: points };
    })
  );
  return { window, start, end, series, ...computeInsights(series, DEFAULT_INSIGHTS_CONFIG) };
}

/** Compact per-metric summary for the AI-facing insights payload (full day arrays omitted). */
function chartSummaries(series: MetricSeriesInput[]): Array<Record<string, string | number | null>> {
  return series.map(({ spec, days }) => {
    const values = days.map((d) => d.value).filter((v): v is number => v !== null);
    const n = values.length;
    const avg = n ? Math.round((values.reduce((a, b) => a + b, 0) / n) * 100) / 100 : null;
    return {
      key: spec.key,
      label: spec.label,
      unit: spec.unit,
      n,
      latest: n ? values[n - 1]! : null,
      min: n ? Math.min(...values) : null,
      max: n ? Math.max(...values) : null,
      avg
    };
  });
}

/** One message in the `interpret_health` prompt (MCP `GetPromptResult` shape). */
export interface PromptMessage {
  role: 'user';
  content: { type: 'text'; text: string };
}

/**
 * Guidance for the `interpret_health` prompt (spec 013). Pure so it is unit-testable and reused by
 * the SDK prompt registration in create-server.ts. Instructs the assistant to call the insights
 * tools and produce a short, encouraging, non-medical plain-language briefing.
 */
export function interpretHealthMessages(window?: string): PromptMessage[] {
  const parsed = window === undefined ? undefined : Number(window);
  const w = clampWindow(Number.isFinite(parsed) ? parsed : undefined);
  return [
    {
      role: 'user',
      content: {
        type: 'text',
        text:
          `Give me a short wellness briefing for the last ${w} days.\n\n` +
          `Call the \`get_readiness\` and \`get_insights\` tools with window=${w}. Then, in a few ` +
          'friendly sentences of plain language, cover: the readiness score and band, the single ' +
          'most notable trend, any anomaly worth mentioning, and one interesting correlation. Be ' +
          'encouraging and concrete, avoid jargon, and do not invent numbers the tools did not return. ' +
          'These are consumer wellness metrics from a Garmin wearable — not medical data — so do not ' +
          'diagnose or give medical advice; suggest seeing a professional for any health concern.'
      }
    }
  ];
}

const insightsTools: GarminTool[] = [
  {
    name: 'get_readiness',
    description:
      'A compact readiness snapshot (0–100 score, band, and per-driver contributions from body ' +
      'battery, sleep, HRV and resting heart rate) computed over a rolling window (default 30 days). ' +
      'Consumer wellness signal — not medical advice.',
    inputShape: { window: windowArg },
    handler: async (garmin, args, ctx = DEFAULT_TOOL_CONTEXT) => {
      try {
        const { readiness } = await insightsForWindow(garmin, args.window, ctx);
        return text(readiness ?? { status: 'insufficient_data' });
      } catch (err) {
        return garminErrorResult(err);
      }
    }
  },
  {
    name: 'get_insights',
    description:
      'Full deterministic insights for a window (default 30 days): readiness, per-metric trends, ' +
      'anomaly flags, and notable correlations. Per-metric charts are returned as compact summaries ' +
      '(count/latest/min/max/avg) rather than full day arrays. Consumer wellness signal — not medical advice.',
    inputShape: { window: windowArg },
    handler: async (garmin, args, ctx = DEFAULT_TOOL_CONTEXT) => {
      try {
        const { window, start, end, series, readiness, trends, anomalies, correlations } =
          await insightsForWindow(garmin, args.window, ctx);
        return text({
          window,
          start,
          end,
          readiness,
          trends,
          anomalies,
          correlations,
          charts: chartSummaries(series)
        });
      } catch (err) {
        return garminErrorResult(err);
      }
    }
  }
];

export const GARMIN_TOOLS: GarminTool[] = [
  {
    name: 'get_status',
    description: 'Whether the Garmin account is connected, and the display name if known.',
    inputShape: {},
    handler: async (garmin) => text(await garmin.getStatus())
  },
  {
    name: 'get_health_snapshot',
    description:
      'A combined daily overview: sleep, steps, body battery, HRV and resting heart rate for a date.',
    inputShape: { date: dateArg },
    handler: async (garmin, args) => {
      try {
        const entries = await Promise.all(
          SNAPSHOT_METRICS.map(async (m) => [m, await garmin.getMetric(m, args.date)] as const)
        );
        return text({ date: args.date ?? 'today', ...Object.fromEntries(entries) });
      } catch (err) {
        return garminErrorResult(err);
      }
    }
  },
  {
    name: 'get_metric_range',
    description:
      'Fetch one metric across an inclusive date range (YYYY-MM-DD, max 31 days) — use for weekly or ' +
      'monthly trends. Returns { metric, start, end, days:[{date, data}] }; a day is null if unavailable.',
    inputShape: { metric: metricArg, start: dateReq, end: dateReq },
    handler: async (garmin, args) => {
      try {
        return text(await garmin.getMetricRange(args.metric as GarminMetricName, args.start!, args.end!));
      } catch (err) {
        return garminErrorResult(err);
      }
    }
  },
  metricTool('sleep', 'Sleep summary for a date (stages, duration, score).'),
  metricTool('steps', 'Step count and distance for a date.'),
  metricTool('body_battery', 'Body Battery energy levels for a date.'),
  metricTool('hrv', 'Heart-rate variability status for a date.'),
  metricTool('stress', 'Stress levels for a date.'),
  metricTool('resting_heart_rate', 'Resting heart rate for a date.'),
  metricTool('activities', 'Recorded activities for a date.'),
  metricTool('spo2', 'Blood oxygen saturation (SpO2) for a date.'),
  metricTool('respiration', 'Respiration rate for a date.'),
  metricTool('calories', 'Calories burned (total, active, BMR) for a date.'),
  metricTool('body_composition', 'Body composition (weight, body fat, muscle mass) for a date.'),
  metricTool(
    'training_readiness',
    "Garmin's own Training Readiness for a date: score 0–100, level, per-factor percentages, and `recoveryTime` — MINUTES remaining until full recovery, not hours. Distinct from get_readiness, which is this app's own composite."
  ),
  ...insightsTools
];
