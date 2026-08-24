/**
 * Validation for the athlete profile (spec 090) — pure, client-safe, and the ONE place the bounds
 * are enforced.
 *
 * The card runs it before it sends so the reader sees the problem under the field instead of after a
 * round trip; the handler runs it again on arrival, because the card is not the only thing that can
 * post to the endpoint and a stored FTP of `"600000"` would quietly poison every IF, TSS and zone
 * split the app draws. Same function, so the two answers cannot drift.
 *
 * The stored bag is `Record<string, unknown>`: values are NARROWED on read, never cast.
 */
import {
  PROFILE_BOUNDS,
  PROFILE_FIELDS,
  type AthleteProfile,
  type ProfileField,
  type ProfileFieldError,
  type ProfileFieldErrors
} from './profile.types';

/** One field's verdict: an accepted value (possibly `null` = "estimate it"), or why it was refused. */
export type FieldParse =
  | { readonly ok: true; readonly value: number | null }
  | { readonly ok: false; readonly error: ProfileFieldError };

export type ProfileParse =
  | { readonly ok: true; readonly profile: AthleteProfile }
  | { readonly ok: false; readonly fields: ProfileFieldErrors };

/** Round to the field's stored precision without leaving float dust (`72.30000000000001`). */
function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Narrow one JSON value.
 *
 * `null` and a missing key both mean "cleared" — PUT carries the whole profile, so an absent field
 * is an erased field, not an untouched one. Anything else must be a finite number inside the band;
 * a numeric STRING is refused on purpose, so the contract stays `number | null` and a client cannot
 * discover that `"250"` happens to work.
 */
export function parseProfileField(field: ProfileField, raw: unknown): FieldParse {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return { ok: false, error: 'not_a_number' };

  const bound = PROFILE_BOUNDS[field];
  if (raw < bound.min || raw > bound.max) return { ok: false, error: 'out_of_range' };
  return { ok: true, value: round(raw, bound.decimals) };
}

/**
 * Narrow what someone typed.
 *
 * Blank is legal and means "estimate it". A decimal COMMA is accepted because this app's first
 * language writes `72,5` — refusing it would make the field look broken to the person it is for.
 */
export function parseProfileInput(field: ProfileField, text: string): FieldParse {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: null };

  const numeric = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(numeric)) return { ok: false, error: 'not_a_number' };
  return parseProfileField(field, numeric);
}

/**
 * Validate a whole request body. Every field is checked even after one fails, so the reader fixes
 * all three at once rather than being told about them one refusal at a time.
 */
export function parseProfile(body: unknown): ProfileParse {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    // Not a shape we can attribute errors to — refuse the request without blaming a field.
    return { ok: false, fields: {} };
  }

  const bag = body as Readonly<Record<string, unknown>>;
  const errors: Partial<Record<ProfileField, ProfileFieldError>> = {};
  const values: Record<ProfileField, number | null> = { ftpWatts: null, maxHrBpm: null, weightKg: null };

  for (const field of PROFILE_FIELDS) {
    const parsed = parseProfileField(field, bag[field]);
    if (parsed.ok) values[field] = parsed.value;
    else errors[field] = parsed.error;
  }

  if (Object.keys(errors).length > 0) return { ok: false, fields: errors };
  return { ok: true, profile: values };
}

/**
 * Read the profile back out of the settings bag.
 *
 * Deliberately looser than the write path: anything finite and positive is returned, exactly as the
 * consumers in `activity-detail.api.ts` read it. A value that somehow sits outside the bounds is
 * still what the analysis is using, so the form must show it — a screen that renders "empty" while
 * the zones quietly use 700 W would be the worst of both.
 */
export function readStoredProfile(bag: Readonly<Record<string, unknown>>): AthleteProfile {
  const positive = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;

  return {
    ftpWatts: positive(bag.ftpWatts),
    maxHrBpm: positive(bag.maxHrBpm),
    weightKg: positive(bag.weightKg)
  };
}

/** A stored value as the input should show it; `null` renders blank, which is what "estimate" looks like. */
export function toProfileInput(value: number | null): string {
  return value === null ? '' : String(value);
}
