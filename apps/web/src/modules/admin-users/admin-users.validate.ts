/**
 * Field-shape validation for admin create/edit (spec 094). Delegates every rule to the ONE shared
 * policy module (`lib/server/auth/password-policy.ts`) — this file only assembles the field-error
 * object this module's contract needs.
 */
import { validateEmail, validatePassword, validateUsername } from '$lib/server/auth/password-policy';
import type { AdminUserFieldErrors, CreateUserInput, UpdateUserInput } from './admin-users.types';

export type ValidatedCreateInput =
  | { ok: true; email: string; username: string; password: string | null; isAdmin: boolean }
  | { ok: false; fields: AdminUserFieldErrors };

/** `password`/`isAdmin` are optional on create — an admin can provision a Google-only account. */
export function validateCreateInput(input: CreateUserInput): ValidatedCreateInput {
  const fields: AdminUserFieldErrors = {};

  const email = validateEmail(input.email);
  if (!email.ok) fields.email = email.error;

  const username = validateUsername(input.username);
  if (!username.ok) fields.username = username.error;

  let password: string | null = null;
  if (input.password !== undefined && input.password !== null && input.password !== '') {
    const parsed = validatePassword(input.password);
    if (!parsed.ok) fields.password = parsed.error;
    else password = parsed.value;
  }

  if (Object.keys(fields).length > 0 || !email.ok || !username.ok) {
    return { ok: false, fields };
  }
  return {
    ok: true,
    email: email.value,
    username: username.value,
    password,
    isAdmin: input.isAdmin === true
  };
}

export type ValidatedUpdateInput =
  | { ok: true; username?: string; email?: string; isAdmin?: boolean }
  | { ok: false; fields: AdminUserFieldErrors };

/** Every field on an update is optional — only the ones present are validated and applied. */
export function validateUpdateInput(input: UpdateUserInput): ValidatedUpdateInput {
  const fields: AdminUserFieldErrors = {};
  const out: { username?: string; email?: string; isAdmin?: boolean } = {};

  if (input.username !== undefined) {
    const username = validateUsername(input.username);
    if (!username.ok) fields.username = username.error;
    else out.username = username.value;
  }
  if (input.email !== undefined) {
    const email = validateEmail(input.email);
    if (!email.ok) fields.email = email.error;
    else out.email = email.value;
  }
  // A non-boolean isAdmin has no dedicated field-error code (the API contract only defines
  // email/username/password codes) — silently ignored, same as an absent isAdmin.
  if (typeof input.isAdmin === 'boolean') out.isAdmin = input.isAdmin;

  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return { ok: true, ...out };
}
