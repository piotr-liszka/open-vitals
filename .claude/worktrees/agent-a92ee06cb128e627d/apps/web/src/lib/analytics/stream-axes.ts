/**
 * The two axes every stream-derived analysis is indexed against: elapsed seconds and cumulative
 * metres (spec 054). Lifted out of `modules/activity-detail/activity-charts.ts`, which still
 * re-exports them, because the sync engine now derives best efforts from stored streams and
 * `lib/server` may not reach into a module folder (AGENTS.md §5).
 *
 * PURE and client-safe: arrays in, arrays out. Living in `lib/analytics/` (not `lib/server/`) for the
 * same reason `best-efforts.ts` does — the browser builds the same axes for its charts, so a
 * server-only import here would break the production build.
 */
import type { ActivityStreams } from '$lib/server/store/types';

const NUMERIC_STREAM_KEYS = [
  'time',
  'heartRate',
  'power',
  'cadence',
  'speed',
  'elevation',
  'grade',
  'temperature',
  'respirationRate',
  'verticalRatio',
  'verticalOscillation',
  'groundContactTime',
  'groundContactBalance',
  'strideLength',
  'stamina',
  'staminaPotential',
  'performanceCondition',
  'moving'
] as const satisfies readonly (keyof ActivityStreams)[];

/** Longest numeric stream — the sample count everything else is indexed against. */
export function streamLength(streams: ActivityStreams): number {
  let n = 0;
  for (const key of NUMERIC_STREAM_KEYS) {
    const arr = streams[key];
    if (Array.isArray(arr) && arr.length > n) n = arr.length;
  }
  return n;
}

/** Elapsed seconds per sample. Falls back to the sample ordinal when no `time` stream exists. */
export function elapsedSeconds(streams: ActivityStreams, n: number): number[] {
  const time = streams.time;
  const out: number[] = [];
  let last = 0;
  for (let i = 0; i < n; i++) {
    const t = time?.[i];
    // Garmin occasionally leaves a hole; carry the previous value so the axis stays monotonic.
    last = typeof t === 'number' && Number.isFinite(t) && t >= last ? t : time ? last : i;
    out.push(last);
  }
  return out;
}

/**
 * Cumulative metres per sample, integrated from the speed stream (`Σ v·Δt`). Returns `null` when
 * there is no speed stream — we never guess a distance axis out of nothing. GPS-only activities
 * therefore keep the time axis, which is the honest default anyway.
 */
export function cumulativeDistance(streams: ActivityStreams, elapsed: number[]): number[] | null {
  const speed = streams.speed;
  if (!speed || speed.length < 2) return null;
  const out: number[] = [];
  let total = 0;
  for (let i = 0; i < elapsed.length; i++) {
    if (i > 0) {
      const dt = (elapsed[i] ?? 0) - (elapsed[i - 1] ?? 0);
      const v = speed[i];
      if (dt > 0 && typeof v === 'number' && Number.isFinite(v) && v > 0) total += v * dt;
    }
    out.push(total);
  }
  return total > 0 ? out : null;
}
