/**
 * Field-shape validation for the self-service password form (spec 094). Reuses the shared password
 * rules (`lib/server/auth/password-policy.ts`) — this file only assembles the account contract's
 * error codes.
 */
import { passwordsMatch, validatePassword } from '$lib/server/auth/password-policy';

export type ValidatedNewPassword =
  { ok: true; value: string } | { ok: false; error: 'invalid_password' | 'mismatch' };

/** Validate the new password's length and that it matches the confirm field. */
export function validateNewPassword(newPassword: unknown, confirmPassword: unknown): ValidatedNewPassword {
  const parsed = validatePassword(newPassword);
  if (!parsed.ok) return { ok: false, error: 'invalid_password' };

  const confirm = typeof confirmPassword === 'string' ? confirmPassword : '';
  if (!passwordsMatch(parsed.value, confirm)) return { ok: false, error: 'mismatch' };

  return { ok: true, value: parsed.value };
}
