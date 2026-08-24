/**
 * Boundary validation for training blocks (spec 073).
 *
 * Two boundaries — the HTTP handler and the MCP tools — and one set of rules, the arrangement spec
 * 060 settled on. A block created by an assistant is held to exactly what a block typed into the
 * form is; anything else would make the model the weak point in the contract.
 */
import { isDayKey } from '$lib/date';
import { PACE_KEYS, type BlockPaces, type PaceKey, type PaceRange } from '$lib/server/store/types';
import { MAX_BLOCK_WEEKS, snapToMonday } from '$lib/blocks';
import type { BlockPatchInput, NewBlockInput } from './block.types';

export const MAX_NAME = 120;
export const MAX_NOTE = 500;
export const MAX_FOCUS = 200;
/** Standing rules, not a document: enough for "brak roweru XII–II", short enough to stay a rule. */
export const MAX_CONSTRAINTS = 20;
export const MAX_CONSTRAINT_LEN = 200;
/** 2:00/km is faster than the world record; 20:00/km is slower than walking. Outside is a unit error. */
export const MIN_PACE_S = 120;
export const MAX_PACE_S = 1200;
/** 500 km in one week is not a target, it is a decimal point in the wrong place. */
export const MAX_VOLUME_KM = 500;

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

function asRecord(body: unknown): Record<string, unknown> | null {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}

function optionalText(value: unknown, max: number, label: string): Validated<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== 'string') return fail(`${label} musi być tekstem`);
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > max) return fail(`${label} jest za długie`);
  return { ok: true, value: trimmed };
}

function optionalNumber(value: unknown, max: number, label: string): Validated<number | null> {
  if (value === undefined || value === null || value === '') return { ok: true, value: null };
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return fail(`${label} musi być liczbą`);
  if (n <= 0) return fail(`${label} musi być większe od zera`);
  if (n > max) return fail(`${label} jest poza dopuszczalnym zakresem`);
  return { ok: true, value: n };
}

/**
 * A pace band. `lowS` is the FAST end because a range is written "6:10–6:30" and read that way; a
 * band given the other way round is silently swapped rather than rejected, since the athlete's
 * intent is never in doubt and refusing it would only teach them to type it twice.
 */
function parsePaceRange(value: unknown, key: PaceKey): Validated<PaceRange> {
  const r = asRecord(value);
  if (!r) return fail(`tempo "${key}" musi być obiektem { lowS, highS }`);
  const low = optionalNumber(r.lowS, MAX_PACE_S, `tempo "${key}" (od)`);
  if (!low.ok) return low;
  const high = optionalNumber(r.highS, MAX_PACE_S, `tempo "${key}" (do)`);
  if (!high.ok) return high;
  if (low.value === null || high.value === null) {
    return fail(`tempo "${key}" wymaga obu granic (lowS i highS) w sekundach na kilometr`);
  }
  if (low.value < MIN_PACE_S || high.value < MIN_PACE_S) {
    return fail(`tempo "${key}" jest poza dopuszczalnym zakresem — podaj sekundy na kilometr`);
  }
  const [lowS, highS] = low.value <= high.value ? [low.value, high.value] : [high.value, low.value];
  return { ok: true, value: { lowS, highS } };
}

export function parsePaces(value: unknown): Validated<BlockPaces> {
  if (value === undefined || value === null) return { ok: true, value: {} };
  const r = asRecord(value);
  if (!r) return fail('tempa muszą być obiektem');
  const out: Record<string, PaceRange> = {};
  for (const [key, raw] of Object.entries(r)) {
    if (raw === undefined || raw === null) continue;
    if (!PACE_KEYS.includes(key as PaceKey)) {
      return fail(`nieznane tempo "${key}" — użyj: ${PACE_KEYS.join(', ')}`);
    }
    const parsed = parsePaceRange(raw, key as PaceKey);
    if (!parsed.ok) return parsed;
    out[key] = parsed.value;
  }
  return { ok: true, value: out as BlockPaces };
}

export function parseConstraints(value: unknown): Validated<string[]> {
  if (value === undefined || value === null) return { ok: true, value: [] };
  if (!Array.isArray(value)) return fail('ograniczenia muszą być listą tekstów');
  if (value.length > MAX_CONSTRAINTS) return fail(`maksymalnie ${MAX_CONSTRAINTS} ograniczeń`);
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') return fail('każde ograniczenie musi być tekstem');
    const trimmed = entry.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.length > MAX_CONSTRAINT_LEN) return fail('ograniczenie jest za długie');
    out.push(trimmed);
  }
  return { ok: true, value: out };
}

function parseWeeksCount(value: unknown): Validated<number> {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return fail('liczba tygodni musi być liczbą');
  if (!Number.isInteger(n)) return fail('liczba tygodni musi być liczbą całkowitą');
  if (n < 1) return fail('blok musi mieć co najmniej jeden tydzień');
  if (n > MAX_BLOCK_WEEKS) return fail(`blok nie może być dłuższy niż ${MAX_BLOCK_WEEKS} tygodni`);
  return { ok: true, value: n };
}

export function parseNewBlock(body: unknown): Validated<NewBlockInput> {
  const b = asRecord(body);
  if (!b) return fail('oczekiwano obiektu JSON');

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (name.length === 0) return fail('nazwa bloku jest wymagana');
  if (name.length > MAX_NAME) return fail('nazwa bloku jest za długa');

  // `startDate` is what the MCP tool and the coach's own notes call it; accept both spellings.
  const rawStart = b.startDay ?? b.startDate;
  if (!isDayKey(rawStart)) return fail('data startu musi być w formacie RRRR-MM-DD');

  const weeks = parseWeeksCount(b.weeks);
  if (!weeks.ok) return weeks;

  const paces = parsePaces(b.paces);
  if (!paces.ok) return paces;
  const constraints = parseConstraints(b.constraints);
  if (!constraints.ok) return constraints;
  const note = optionalText(b.note, MAX_NOTE, 'notatka');
  if (!note.ok) return note;
  const goalId = optionalText(b.goalId, MAX_NAME, 'identyfikator celu');
  if (!goalId.ok) return goalId;

  return {
    ok: true,
    value: {
      name,
      // Snapped, not rejected: "start next Wednesday" means the week that Wednesday is in.
      startDay: snapToMonday(rawStart),
      weeks: weeks.value,
      goalId: goalId.value,
      paces: paces.value,
      constraints: constraints.value,
      note: note.value
    }
  };
}

/** One week's targets. `weekNumber` is required; every other key is optional and may be null. */
function parseWeekTarget(
  value: unknown,
  maxWeeks: number | null
): Validated<NonNullable<BlockPatchInput['weekTargets']>[number]> {
  const r = asRecord(value);
  if (!r) return fail('cel tygodnia musi być obiektem');
  const n = typeof r.weekNumber === 'string' ? Number(r.weekNumber) : r.weekNumber;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) {
    return fail('numer tygodnia musi być dodatnią liczbą całkowitą');
  }
  if (maxWeeks !== null && n > maxWeeks) {
    return fail(`blok ma ${maxWeeks} tygodni — nie ma tygodnia ${n}`);
  }
  const out: Record<string, unknown> = { weekNumber: n };
  if (r.phase !== undefined) {
    const phase = optionalText(r.phase, 40, 'faza');
    if (!phase.ok) return phase;
    out.phase = phase.value;
  }
  if (r.volumeTargetKm !== undefined) {
    const volume = optionalNumber(r.volumeTargetKm, MAX_VOLUME_KM, 'objętość docelowa');
    if (!volume.ok) return volume;
    out.volumeTargetKm = volume.value;
  }
  if (r.focus !== undefined) {
    const focus = optionalText(r.focus, MAX_FOCUS, 'cel tygodnia');
    if (!focus.ok) return focus;
    out.focus = focus.value;
  }
  if (r.note !== undefined) {
    const note = optionalText(r.note, MAX_NOTE, 'notatka');
    if (!note.ok) return note;
    out.note = note.value;
  }
  return { ok: true, value: out as NonNullable<BlockPatchInput['weekTargets']>[number] };
}

/**
 * Validate a patch. Only keys PRESENT are returned, so an absent key leaves the column alone while
 * an explicit `null` clears it — the distinction the store's patch semantics rest on.
 *
 * `maxWeeks` is the block's length as it will be AFTER the patch, so shrinking a block and setting a
 * target on a week the shrink removes is caught here rather than stored and never read.
 */
export function parseBlockPatch(
  body: unknown,
  currentWeeks: number | null = null
): Validated<BlockPatchInput> {
  const b = asRecord(body);
  if (!b) return fail('oczekiwano obiektu JSON');

  const out: Record<string, unknown> = {};

  if (b.name !== undefined) {
    const name = typeof b.name === 'string' ? b.name.trim() : '';
    if (name.length === 0) return fail('nazwa bloku jest wymagana');
    if (name.length > MAX_NAME) return fail('nazwa bloku jest za długa');
    out.name = name;
  }
  const rawStart = b.startDay ?? b.startDate;
  if (rawStart !== undefined) {
    if (!isDayKey(rawStart)) return fail('data startu musi być w formacie RRRR-MM-DD');
    out.startDay = snapToMonday(rawStart);
  }
  let weeks = currentWeeks;
  if (b.weeks !== undefined) {
    const parsed = parseWeeksCount(b.weeks);
    if (!parsed.ok) return parsed;
    out.weeks = parsed.value;
    weeks = parsed.value;
  }
  if (b.goalId !== undefined) {
    const goalId = optionalText(b.goalId, MAX_NAME, 'identyfikator celu');
    if (!goalId.ok) return goalId;
    out.goalId = goalId.value;
  }
  if (b.paces !== undefined) {
    const paces = parsePaces(b.paces);
    if (!paces.ok) return paces;
    out.paces = paces.value;
  }
  if (b.constraints !== undefined) {
    const constraints = parseConstraints(b.constraints);
    if (!constraints.ok) return constraints;
    out.constraints = constraints.value;
  }
  if (b.note !== undefined) {
    const note = optionalText(b.note, MAX_NOTE, 'notatka');
    if (!note.ok) return note;
    out.note = note.value;
  }
  if (b.weekTargets !== undefined) {
    if (!Array.isArray(b.weekTargets)) return fail('cele tygodni muszą być listą');
    const targets: NonNullable<BlockPatchInput['weekTargets']>[number][] = [];
    for (const entry of b.weekTargets) {
      const parsed = parseWeekTarget(entry, weeks);
      if (!parsed.ok) return parsed;
      targets.push(parsed.value);
    }
    out.weekTargets = targets;
  }

  if (Object.keys(out).length === 0) return fail('brak zmian do zapisania');
  return { ok: true, value: out as BlockPatchInput };
}
