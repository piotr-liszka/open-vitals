/**
 * Boundary validation for season goals (spec 060).
 *
 * Lives in its own file because there are TWO boundaries — the HTTP handler and the MCP tools — and
 * a goal arriving over MCP must be held to exactly the same rules as one typed into the form. Pure:
 * it takes untrusted `unknown` and returns either a typed input or a message.
 */
import { isDayKey } from '$lib/date';
import { isSportGroup } from '$lib/sport-labels';
import type { GoalKind, GoalPriority } from '$lib/server/store/types';
import type { GoalPatchInput, NewGoalInput } from './season.types';

/** Longest title/note we store. Long enough for any race name, short enough not to be a document. */
export const MAX_TITLE = 120;
export const MAX_NOTE = 500;
/** A race longer than this is not a race we can reason about; it is a typo in metres. */
export const MAX_DISTANCE_M = 1_000_000;
/** 100 h. Beyond this a "target time" is a unit mistake (minutes entered as seconds, say). */
export const MAX_TARGET_TIME_S = 360_000;
/** CTL is a 0–200 scale in practice; a target outside it means the athlete mis-read the field. */
export const MAX_TARGET_CTL = 200;

const KINDS: readonly GoalKind[] = ['race', 'fitness'];
const PRIORITIES: readonly GoalPriority[] = ['a', 'b', 'c'];

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

function asRecord(body: unknown): Record<string, unknown> | null {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}

/**
 * A finite, positive number within `max`, or null. Absent and explicit-null both mean "no target" —
 * they are the same thing to the athlete, so they are the same thing here.
 */
function optionalNumber(value: unknown, max: number, label: string): Validated<number | null> {
  if (value === undefined || value === null || value === '') return { ok: true, value: null };
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return fail(`${label} musi być liczbą`);
  if (n <= 0) return fail(`${label} musi być większe od zera`);
  if (n > max) return fail(`${label} jest poza dopuszczalnym zakresem`);
  return { ok: true, value: n };
}

function optionalText(value: unknown, max: number, label: string): Validated<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== 'string') return fail(`${label} musi być tekstem`);
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > max) return fail(`${label} jest za długie`);
  return { ok: true, value: trimmed };
}

/** Validate a create body. Every field is checked before anything reaches the store. */
export function parseNewGoal(body: unknown): Validated<NewGoalInput> {
  const b = asRecord(body);
  if (!b) return fail('oczekiwano obiektu JSON');

  if (!isDayKey(b.day)) return fail('data celu musi być w formacie RRRR-MM-DD');
  if (!isSportGroup(b.sport)) return fail('nieznana dyscyplina');

  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (title.length === 0) return fail('nazwa celu jest wymagana');
  if (title.length > MAX_TITLE) return fail('nazwa celu jest za długa');

  // Both enums default rather than reject: the form always sends them, and an MCP client that omits
  // them means the common case (a race, the season's A-priority).
  const kind = b.kind === undefined ? 'race' : b.kind;
  if (!KINDS.includes(kind as GoalKind)) return fail('nieznany rodzaj celu');
  const priority = b.priority === undefined ? 'a' : b.priority;
  if (!PRIORITIES.includes(priority as GoalPriority)) return fail('nieznany priorytet');

  const distance = optionalNumber(b.distanceM, MAX_DISTANCE_M, 'dystans');
  if (!distance.ok) return distance;
  const targetTime = optionalNumber(b.targetTimeS, MAX_TARGET_TIME_S, 'czas docelowy');
  if (!targetTime.ok) return targetTime;
  const targetCtl = optionalNumber(b.targetCtl, MAX_TARGET_CTL, 'docelowa forma (CTL)');
  if (!targetCtl.ok) return targetCtl;
  const note = optionalText(b.note, MAX_NOTE, 'notatka');
  if (!note.ok) return note;
  const eventId = optionalText(b.garminEventId, MAX_TITLE, 'identyfikator wydarzenia');
  if (!eventId.ok) return eventId;

  // A target time without a distance cannot be checked against anything — spec 043 predicts a time
  // FOR a distance — so it is a mistake worth naming rather than storing.
  if (targetTime.value !== null && distance.value === null) {
    return fail('czas docelowy wymaga podania dystansu');
  }

  return {
    ok: true,
    value: {
      day: b.day,
      sport: b.sport,
      title,
      kind: kind as GoalKind,
      priority: priority as GoalPriority,
      distanceM: distance.value,
      targetTimeS: targetTime.value,
      targetCtl: targetCtl.value,
      note: note.value,
      garminEventId: eventId.value
    }
  };
}

/**
 * Validate a patch. Only keys PRESENT are returned, so an absent key leaves the column alone while
 * an explicit `null` clears it — the distinction the store's patch semantics rest on.
 */
export function parseGoalPatch(body: unknown): Validated<GoalPatchInput> {
  const b = asRecord(body);
  if (!b) return fail('oczekiwano obiektu JSON');

  const out: Record<string, unknown> = {};

  if (b.day !== undefined) {
    if (!isDayKey(b.day)) return fail('data celu musi być w formacie RRRR-MM-DD');
    out.day = b.day;
  }
  if (b.sport !== undefined) {
    if (!isSportGroup(b.sport)) return fail('nieznana dyscyplina');
    out.sport = b.sport;
  }
  if (b.title !== undefined) {
    const title = typeof b.title === 'string' ? b.title.trim() : '';
    if (title.length === 0) return fail('nazwa celu jest wymagana');
    if (title.length > MAX_TITLE) return fail('nazwa celu jest za długa');
    out.title = title;
  }
  if (b.kind !== undefined) {
    if (!KINDS.includes(b.kind as GoalKind)) return fail('nieznany rodzaj celu');
    out.kind = b.kind;
  }
  if (b.priority !== undefined) {
    if (!PRIORITIES.includes(b.priority as GoalPriority)) return fail('nieznany priorytet');
    out.priority = b.priority;
  }
  if (b.distanceM !== undefined) {
    const d = optionalNumber(b.distanceM, MAX_DISTANCE_M, 'dystans');
    if (!d.ok) return d;
    out.distanceM = d.value;
  }
  if (b.targetTimeS !== undefined) {
    const t = optionalNumber(b.targetTimeS, MAX_TARGET_TIME_S, 'czas docelowy');
    if (!t.ok) return t;
    out.targetTimeS = t.value;
  }
  if (b.targetCtl !== undefined) {
    const c = optionalNumber(b.targetCtl, MAX_TARGET_CTL, 'docelowa forma (CTL)');
    if (!c.ok) return c;
    out.targetCtl = c.value;
  }
  if (b.note !== undefined) {
    const n = optionalText(b.note, MAX_NOTE, 'notatka');
    if (!n.ok) return n;
    out.note = n.value;
  }

  if (Object.keys(out).length === 0) return fail('brak pól do zmiany');
  return { ok: true, value: out as GoalPatchInput };
}
