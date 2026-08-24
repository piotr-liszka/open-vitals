/**
 * Subjective journal handler (spec 062) — the only data here a device did not produce.
 *
 * Pure over injected deps (store + clock, plus a Random on the write path): no live Garmin, no
 * `Date.now()`, no env.
 */
import type { Clock } from '$lib/server/clock';
import type { Random } from '$lib/server/random';
import type { JournalEntry, LocalStore, SorenessSignal } from '$lib/server/store/types';
import { addDays, todayKey, type DayKey } from '$lib/date';
import { parseJournalEntry } from './journal.validate';
import { SORENESS_ALERT, type HandlerResult, type JournalData } from './journal.types';

/**
 * What a READ needs. Deliberately no `Random`: the start page loads the journal, and spec 021's
 * loader test fails on the spot if that page reaches for any container service beyond clock/config/
 * store — the guard that keeps the MCP token out of the serialised page payload. A read path that
 * demanded an id generator would have had to weaken it.
 */
export interface JournalReadDeps {
  store: LocalStore;
  clock: Clock;
  /** IANA zone "today" resolves in — a UTC today lags the athlete by up to two hours (spec 018). */
  timeZone?: string;
}

/** What a WRITE needs: the above plus the injected id source. */
export interface JournalDeps extends JournalReadDeps {
  random: Random;
}

/** How far back the soreness signal looks. A week: long enough to catch it, short enough to still be true. */
export const SORENESS_WINDOW_DAYS = 7;

/** Default span of the journal read — the last four weeks, which is what a check-in history shows. */
const DEFAULT_RANGE_DAYS = 28;

function today(deps: JournalReadDeps): DayKey {
  return todayKey(deps.clock, deps.timeZone);
}

/**
 * The soreness worth acting on right now: the worst score at or above the threshold in the last
 * week. Exposed on its own because spec 073's week payload asks for it on every call.
 */
export async function recentSoreness(
  deps: JournalReadDeps,
  userId: string,
  asOf?: DayKey
): Promise<SorenessSignal | null> {
  const end = asOf ?? today(deps);
  const start = addDays(end, -(SORENESS_WINDOW_DAYS - 1));
  return deps.store.worstSoreness(userId, start, end, SORENESS_ALERT);
}

export async function loadJournal(
  deps: JournalReadDeps,
  userId: string,
  range: { from?: string; to?: string } = {}
): Promise<JournalData> {
  const day = today(deps);
  const to = range.to ?? day;
  const from = range.from ?? addDays(to, -(DEFAULT_RANGE_DAYS - 1));
  const [entries, soreness] = await Promise.all([
    deps.store.listJournalEntries(userId, { from, to, limit: 500 }),
    recentSoreness(deps, userId, day)
  ]);
  return { today: day, from, to, entries, soreness };
}

/**
 * Record how it felt.
 *
 * An `activityId` is checked against the athlete's own activities AND against the day, because the
 * two ways to get it wrong need different corrections: an id that is not theirs is a mistake about
 * whose data this is, and an id on another day is a mistake about which session.
 */
export async function logEntry(
  deps: JournalDeps,
  userId: string,
  body: unknown
): Promise<HandlerResult<{ entry: JournalEntry; fields: string[] }>> {
  const parsed = parseJournalEntry(body, today(deps));
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  const input = parsed.value;

  if (input.activityId !== null) {
    const activity = await deps.store.getActivity(userId, input.activityId);
    if (!activity) return { ok: false, status: 400, error: 'nie ma takiej aktywności' };
    const activityDay = activity.startTimeLocal.slice(0, 10);
    if (activityDay !== input.day) {
      return {
        ok: false,
        status: 400,
        error: `ta aktywność jest z ${activityDay}, a wpis dotyczy ${input.day}`
      };
    }
  }

  const entry = await deps.store.putJournalEntry(userId, {
    // 12 bytes of CSPRNG from the injected Random — never Math.random, never a timestamp.
    id: `j_${deps.random.token(12)}`,
    day: input.day,
    activityId: input.activityId,
    ...(input.rpe !== undefined ? { rpe: input.rpe } : {}),
    ...(input.soreness !== undefined ? { soreness: input.soreness } : {}),
    ...(input.location !== undefined ? { location: input.location } : {}),
    ...(input.mood !== undefined ? { mood: input.mood } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
    ...(input.illness !== undefined ? { illness: input.illness } : {}),
    ...(input.injury !== undefined ? { injury: input.injury } : {}),
    at: deps.clock.now().toISOString()
  });

  /*
   * Report which fields this write actually touched. A partial upsert leaves the rest alone, and an
   * assistant that cannot tell "I left mood alone" from "mood is empty" will re-ask for it forever.
   */
  const fields = (['rpe', 'soreness', 'location', 'mood', 'note', 'illness', 'injury'] as const).filter(
    (k) => input[k] !== undefined
  );

  return { ok: true, entry, fields: [...fields] };
}

export async function removeEntry(
  deps: JournalDeps,
  userId: string,
  id: string
): Promise<HandlerResult<{ deleted: JournalEntry }>> {
  const deleted = await deps.store.deleteJournalEntry(userId, id);
  if (!deleted) return { ok: false, status: 404, error: 'nie ma wpisu o tym identyfikatorze' };
  return { ok: true, deleted };
}
