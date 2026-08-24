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
import { createTranslator, DEFAULT_LOCALE, type MessageKey, type Translator } from '$lib/i18n';
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
function score(t: Translator, value: unknown, fieldKey: MessageKey): Validated<number | null> {
  if (value === null || value === '') return { ok: true, value: null };
  const n = typeof value === 'string' ? Number(value) : value;
  const label = t(fieldKey);
  if (typeof n !== 'number' || !Number.isFinite(n)) return fail(t('journal.error.numberField', { label }));
  if (!Number.isInteger(n)) return fail(t('journal.error.integerField', { label }));
  if (n < SCORE_MIN || n > SCORE_MAX) {
    return fail(t('journal.error.scoreRange', { label, min: SCORE_MIN, max: SCORE_MAX }));
  }
  return { ok: true, value: n };
}

function text(t: Translator, value: unknown, max: number, fieldKey: MessageKey): Validated<string | null> {
  if (value === null) return { ok: true, value: null };
  const label = t(fieldKey);
  if (typeof value !== 'string') return fail(t('journal.error.textField', { label }));
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > max) return fail(t('journal.error.tooLong', { label }));
  return { ok: true, value: trimmed };
}

function bool(t: Translator, value: unknown, fieldKey: MessageKey): Validated<boolean> {
  if (typeof value === 'boolean') return { ok: true, value };
  return fail(t('journal.error.boolField', { label: t(fieldKey) }));
}

/**
 * Validate an entry.
 *
 * `today` is passed in rather than read from a clock so this stays pure: a future day is rejected
 * because a journal records what happened, and a scored tomorrow is either a typo or a plan.
 *
 * `t` is optional so the MCP tools and every existing test keep their Polish-only behaviour; the
 * HTTP route passes the request's own translator (spec: this i18n audit).
 */
export function parseJournalEntry(
  body: unknown,
  today: string,
  t: Translator = createTranslator(DEFAULT_LOCALE)
): Validated<JournalInput> {
  const b = asRecord(body);
  if (!b) return fail(t('journal.error.expectedJson'));

  // `date` is what the MCP tool calls it, `day` what the HTTP form sends. Accept both.
  const rawDay = b.day ?? b.date;
  if (!isDayKey(rawDay)) return fail(t('journal.error.dayFormat'));
  if (rawDay > today) return fail(t('journal.error.futureDay'));

  const activityId = b.activityId === undefined || b.activityId === null ? null : b.activityId;
  if (activityId !== null && (typeof activityId !== 'string' || activityId.trim().length === 0)) {
    return fail(t('journal.error.activityIdText'));
  }

  const out: Record<string, unknown> = {
    day: rawDay,
    activityId: activityId === null ? null : (activityId as string).trim()
  };

  // Only keys PRESENT are carried through: absent leaves the column alone, explicit null clears it.
  for (const [field, fieldKey] of [
    ['rpe', 'journal.field.rpe'],
    ['soreness', 'journal.field.soreness'],
    ['mood', 'journal.field.mood']
  ] as const) {
    if (b[field] === undefined) continue;
    const parsed = score(t, b[field], fieldKey);
    if (!parsed.ok) return parsed;
    out[field] = parsed.value;
  }

  if (b.location !== undefined) {
    const parsed = text(t, b.location, MAX_LOCATION, 'journal.field.location');
    if (!parsed.ok) return parsed;
    out.location = parsed.value;
  }
  if (b.note !== undefined) {
    const parsed = text(t, b.note, MAX_NOTE, 'journal.field.note');
    if (!parsed.ok) return parsed;
    out.note = parsed.value;
  }
  for (const [field, fieldKey] of [
    ['illness', 'journal.field.illness'],
    ['injury', 'journal.field.injury']
  ] as const) {
    if (b[field] === undefined) continue;
    const parsed = bool(t, b[field], fieldKey);
    if (!parsed.ok) return parsed;
    out[field] = parsed.value;
  }

  // An entry with a day and nothing else is not an entry — it would create an empty row that reads
  // as "logged" on every screen that counts logged days.
  const scored = ['rpe', 'soreness', 'mood', 'location', 'note', 'illness', 'injury'].some(
    (k) => out[k] !== undefined
  );
  if (!scored) return fail(t('journal.error.emptyEntry'));

  return { ok: true, value: out as unknown as JournalInput };
}
