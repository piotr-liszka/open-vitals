/**
 * Shared validation rules (spec 094) for onboarding, admin create/edit/reset, and self-service
 * account changes. The ONE place these are enforced — validated at the API boundary in every case;
 * the repo layer never re-validates.
 */
import { z } from 'zod';

/** bcrypt's own input cap: a password over 72 UTF-8 BYTES (not characters) must be rejected, never
 *  silently truncated by the hasher. */
export const PASSWORD_MAX_BYTES = 72;
export const PASSWORD_MIN_BYTES = 10;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;

/** UTF-8 byte length of a string (a password with multi-byte characters can exceed the character count). */
function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export const emailSchema = z
  .string()
  .trim()
  .email()
  .transform((v) => v.toLowerCase());

export const usernameSchema = z
  .string()
  .trim()
  .transform((v) => v.toLowerCase())
  .refine((v) => v.length >= USERNAME_MIN_LENGTH && v.length <= USERNAME_MAX_LENGTH)
  .refine((v) => /^[a-z0-9_-]+$/.test(v));

export const passwordSchema = z
  .string()
  .refine((v) => utf8ByteLength(v) >= PASSWORD_MIN_BYTES)
  .refine((v) => utf8ByteLength(v) <= PASSWORD_MAX_BYTES);

/**
 * Machine-readable field-error codes (never a hand-written sentence): the UI owns translating these
 * into copy, the same convention as `modules/settings/profile.types.ts`'s `ProfileFieldError`.
 */
export type EmailErrorCode = 'invalid_email';
export type UsernameErrorCode = 'invalid_username';
export type PasswordErrorCode = 'invalid_password';

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

/** Validate an email; returns the normalized (lower-cased) value or an error code. */
export function validateEmail(
  raw: unknown
): { ok: true; value: string } | { ok: false; error: EmailErrorCode } {
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid_email' };
  return { ok: true, value: parsed.data };
}

/** Validate a username; returns the normalized (lower-cased) value or an error code. */
export function validateUsername(
  raw: unknown
): { ok: true; value: string } | { ok: false; error: UsernameErrorCode } {
  const parsed = usernameSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid_username' };
  return { ok: true, value: parsed.data };
}

/** Validate a password's length constraints (composition rules are deliberately not enforced). */
export function validatePassword(
  raw: unknown
): { ok: true; value: string } | { ok: false; error: PasswordErrorCode } {
  if (typeof raw !== 'string') return { ok: false, error: 'invalid_password' };
  const parsed = passwordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid_password' };
  return { ok: true, value: parsed.data };
}

/** Byte-for-byte equality check between password and confirm — never stored either way. */
export function passwordsMatch(password: string, confirmPassword: string): boolean {
  return password === confirmPassword;
}
