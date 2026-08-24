/**
 * Long-range metric fetch (spec 013). The sidecar caps a single range read at `_MAX_RANGE_DAYS`
 * (31) days, so a 90- or 365-day insights window must be split into several range calls. This
 * splits an inclusive [start, end] span into ≤31-day chunks, fetches them with bounded concurrency
 * (so a 365-day window does not fire ~12 requests at once), and merges the days oldest→newest,
 * preserving null gaps and deduping by date.
 *
 * Pure over the injected `GarminService`: no `Date`, no direct I/O — date maths is integer-only on
 * the YYYY-MM-DD strings so the function is deterministic and unit-testable.
 */
import type { GarminMetricDay, GarminMetricName, GarminService } from '$lib/server/interfaces';

/** Matches the sidecar's `_MAX_RANGE_DAYS`. */
export const MAX_RANGE_DAYS = 31;
/** Cap on range calls in flight at once against the sidecar. */
export const MAX_CONCURRENCY = 4;

/** Days since 1970-01-01 for a YYYY-MM-DD string (pure integer maths, proleptic Gregorian). */
function toDayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor((yy >= 0 ? yy : yy - 399) / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m > 2 ? m - 3 : m + 9) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Inverse of `toDayNumber` → YYYY-MM-DD. */
function fromDayNumber(days: number): string {
  const z = days + 719468;
  const era = Math.floor((z >= 0 ? z : z - 146096) / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const year = m <= 2 ? y + 1 : y;
  return `${String(year).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export interface RangeChunk {
  start: string;
  end: string;
}

/** Split inclusive [start, end] into consecutive ≤`maxDays`-day chunks (oldest→newest). */
export function chunkRange(start: string, end: string, maxDays = MAX_RANGE_DAYS): RangeChunk[] {
  const endNum = toDayNumber(end);
  const chunks: RangeChunk[] = [];
  let cursor = toDayNumber(start);
  while (cursor <= endNum) {
    const chunkEnd = Math.min(cursor + maxDays - 1, endNum);
    chunks.push({ start: fromDayNumber(cursor), end: fromDayNumber(chunkEnd) });
    cursor = chunkEnd + 1;
  }
  return chunks;
}

/** Run `fn` over `items` with at most `limit` promises in flight; preserves input order. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Fetch one metric across an inclusive [start, end] span, chunked into ≤31-day sidecar range calls
 * with bounded concurrency, merged oldest→newest with null gaps preserved and dates deduped.
 */
export async function fetchMetricRangeChunked(
  garmin: GarminService,
  name: GarminMetricName,
  start: string,
  end: string
): Promise<GarminMetricDay[]> {
  const chunks = chunkRange(start, end);
  if (chunks.length === 0) return [];
  const perChunk = await mapPool(chunks, MAX_CONCURRENCY, async (chunk) => {
    const range = await garmin.getMetricRange(name, chunk.start, chunk.end);
    return range.days;
  });

  // Insertion order across chunks is already oldest→newest; the Map dedupes any boundary overlap
  // while keeping the first occurrence's position.
  const byDate = new Map<string, GarminMetricDay>();
  for (const days of perChunk) {
    for (const day of days) {
      if (!byDate.has(day.date)) byDate.set(day.date, day);
    }
  }
  return [...byDate.values()];
}
