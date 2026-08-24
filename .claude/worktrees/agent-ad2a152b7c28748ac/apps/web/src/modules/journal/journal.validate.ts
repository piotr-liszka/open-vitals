/**
 * Boundary validation for the subjective journal (spec 062).
 *
 * Two boundaries — the HTTP handler and the MCP tools — and one set of rules, the arrangement specs
 * 060 and 073 settled on.
 *
 * The one rule worth stating out loud: scores outside 1–10 are REJECTED, never clamped. A clamp
 * turns a typed 11 into a silent 10, and this is a number a coach cuts training volume on.
 */
import { isDayKey } from '$lib/date';
import { SCORE_MAX, SCORE_MIN, type JournalInput } from './journal.types';

export const MAX_NOTE = 1000;
export const MAX_LOCATION = 120;

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

function asRecord(body: unknown): Record<string, unknown> | null {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}

/** A 1–10 integer, or null to clear it. Absent is handled by the caller, not here. */
function score(value: unknown, label: string): Validated<number | null> {
  if (value === null || value === '') return { ok: true, value: null };
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return fail(`${label} musi być liczbą`);
  if (!Number.isInteger(n)) return fail(`${label} musi być liczbą całkowitą`);
  if (n < SCORE_MIN || n > SCORE_MAX) {
    return fail(`${label} musi być w skali ${SCORE_MIN}–${SCORE_MAX}`);
  }
  return { ok: true, value: n };
}

function text(value: unknown, max: number, label: string): Validated<string | null> {
  if (value === null) return { ok: true, value: null };
  if (typeof value !== 'string') return fail(`${label} musi być tekstem`);
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > max) return fail(`${label} jest za długie`);
  return { ok: true, value: trimmed };
}

function bool(value: unknown, label: string): Validated<boolean> {
  if (typeof value === 'boolean') return { ok: true, value };
  return fail(`${label} musi być prawdą albo fałszem`);
}

/**
 * Validate an entry.
 *
 * `today` is passed in rather than read from a clock so this stays pure: a future day is rejected
 * because a journal records what happened, and a scored tomorrow is either a typo or a plan.
 */
export function parseJournalEntry(body: unknown, today: string): Validated<JournalInput> {
  const b = asRecord(body);
  if (!b) return fail('oczekiwano obiektu JSON');

  // `date` is what the MCP tool calls it, `day` what the HTTP form sends. Accept both.
  const rawDay = b.day ?? b.date;
  if (!isDayKey(rawDay)) return fail('data musi być w formacie RRRR-MM-DD');
  if (rawDay > today) return fail('nie można zapisać wpisu z przyszłości');

  const activityId = b.activityId === undefined || b.activityId === null ? null : b.activityId;
  if (activityId !== null && (typeof activityId !== 'string' || activityId.trim().length === 0)) {
    return fail('identyfikator aktywności musi być tekstem');
  }

  const out: Record<string, unknown> = {
    day: rawDay,
    activityId: activityId === null ? null : (activityId as string).trim()
  };

  // Only keys PRESENT are carried through: absent leaves the column alone, explicit null clears it.
  for (const [field, label] of [
    ['rpe', 'RPE'],
    ['soreness', 'ból/zakwasy'],
    ['mood', 'nastrój']
  ] as const) {
    if (b[field] === undefined) continue;
    const parsed = score(b[field], label);
    if (!parsed.ok) return parsed;
    out[field] = parsed.value;
  }

  if (b.location !== undefined) {
    const parsed = text(b.location, MAX_LOCATION, 'lokalizacja');
    if (!parsed.ok) return parsed;
    out.location = parsed.value;
  }
  if (b.note !== undefined) {
    const parsed = text(b.note, MAX_NOTE, 'notatka');
    if (!parsed.ok) return parsed;
    out.note = parsed.value;
  }
  for (const [field, label] of [
    ['illness', 'choroba'],
    ['injury', 'kontuzja']
  ] as const) {
    if (b[field] === undefined) continue;
    const parsed = bool(b[field], label);
    if (!parsed.ok) return parsed;
    out[field] = parsed.value;
  }

  // An entry with a day and nothing else is not an entry — it would create an empty row that reads
  // as "logged" on every screen that counts logged days.
  const scored = ['rpe', 'soreness', 'mood', 'location', 'note', 'illness', 'injury'].some(
    (k) => out[k] !== undefined
  );
  if (!scored) return fail('wpis musi zawierać co najmniej jedno pole');

  return { ok: true, value: out as unknown as JournalInput };
}
