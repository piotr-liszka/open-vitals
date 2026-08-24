/**
 * Field-shape validation for the onboarding form (spec 094). Delegates every rule to the ONE shared
 * policy module (`lib/server/auth/password-policy.ts`) — this file only assembles the field-error
 * object onboarding's contract needs, so a future edit to the shared rules is picked up here for
 * free and a regression in THIS assembly is still caught by this module's own test.
 */
import {
  passwordsMatch,
  validateEmail,
  validatePassword,
  validateUsername
} from '$lib/server/auth/password-policy';
import type { OnboardingFieldErrors } from './onboarding.types';

export interface OnboardingInput {
  email: unknown;
  username: unknown;
  password: unknown;
  confirmPassword: unknown;
}

export type ValidatedOnboardingInput =
  | { ok: true; email: string; username: string; password: string }
  | { ok: false; fields: OnboardingFieldErrors };

/** Validate shape only (email format, username charset/length, password length, confirm match). */
export function validateOnboardingInput(input: OnboardingInput): ValidatedOnboardingInput {
  const fields: OnboardingFieldErrors = {};

  const email = validateEmail(input.email);
  if (!email.ok) fields.email = email.error;

  const username = validateUsername(input.username);
  if (!username.ok) fields.username = username.error;

  const password = validatePassword(input.password);
  if (!password.ok) fields.password = password.error;

  const confirmPassword = typeof input.confirmPassword === 'string' ? input.confirmPassword : '';
  if (password.ok && !passwordsMatch(password.value, confirmPassword)) {
    fields.confirmPassword = 'password_mismatch';
  }

  if (Object.keys(fields).length > 0 || !email.ok || !username.ok || !password.ok) {
    return { ok: false, fields };
  }
  return { ok: true, email: email.value, username: username.value, password: password.value };
}
