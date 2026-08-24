/**
 * Server-side resolution of the global range (spec 047).
 *
 * `resolveRange` is pure and needs the two facts only the server knows: what "today" is in the
 * user's zone, and how far back their synced data actually reaches. This wraps it so every page
 * loader resolves the range identically — and so `cały czas` costs a coverage read ONLY when it is
 * actually selected. The 7/14/30/365 path adds zero queries.
 */
import { todayKey, DEFAULT_TIME_ZONE, type DayKey } from '$lib/date';
import { RANGE_PARAM, parseRange, resolveRange, type RangeKey, type ResolvedRange } from '$lib/range';
import type { Clock } from './clock';
import type { LocalStore } from './store/types';

export interface RangeContextDeps {
  store: LocalStore;
  clock: Clock;
  /** IANA zone "today" resolves in (spec 018). Defaults to the app timezone. */
  timeZone?: string;
}

/** Resolve a validated key into concrete bounds for this user. */
export async function resolveRangeForUser(
  deps: RangeContextDeps,
  userId: string,
  key: RangeKey
): Promise<ResolvedRange> {
  const today = todayKey(deps.clock, deps.timeZone ?? DEFAULT_TIME_ZONE);
  // Only `all` needs to know where the history begins; everything else is pure day maths.
  const earliest: DayKey | null = key === 'all' ? (await deps.store.coverage(userId)).earliest : null;
  return resolveRange(key, today, earliest);
}

/**
 * The one-liner every `+page.server.ts` uses: read `?range=` off the URL, sanitize it, resolve it.
 * A hand-typed value outside the set becomes the default here, so it can never reach a store query.
 */
export function loadRange(deps: RangeContextDeps, userId: string, url: URL): Promise<ResolvedRange> {
  return resolveRangeForUser(deps, userId, parseRange(url.searchParams.get(RANGE_PARAM)));
}
