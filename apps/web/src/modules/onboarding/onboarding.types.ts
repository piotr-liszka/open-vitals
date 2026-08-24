/** Contract types for the first-run admin onboarding slice (spec 094). */
import type { IssuedSession } from '$modules/auth/auth.types';

/**
 * Machine-readable field-error codes — the UI (`+page.svelte`) owns translating these into copy, the
 * same convention as `modules/settings/profile.types.ts`'s `ProfileFieldError`.
 */
export interface OnboardingFieldErrors {
  email?: 'invalid_email' | 'email_taken';
  username?: 'invalid_username' | 'username_taken';
  password?: 'invalid_password';
  confirmPassword?: 'password_mismatch';
}

export type CreateInitialAdminResult =
  | { ok: true; session: IssuedSession }
  | { ok: false; kind: 'already_onboarded' }
  | { ok: false; kind: 'validation'; fields: OnboardingFieldErrors };
