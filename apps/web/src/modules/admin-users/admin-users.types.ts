/** Contract types for the admin user-management slice (spec 094). */

/** Never a password hash — this is the ONLY shape a user row leaves the admin API in. */
export interface AdminUserSummary {
  readonly id: string;
  readonly username: string;
  readonly email: string;
  readonly name: string | null;
  readonly avatarUrl: string | null;
  readonly isAdmin: boolean;
  readonly hasPassword: boolean;
  readonly hasGoogle: boolean;
  readonly createdAt: string;
}

/** Machine-readable field-error codes — the UI translates these into copy. */
export interface AdminUserFieldErrors {
  email?: 'invalid_email' | 'email_taken';
  username?: 'invalid_username' | 'username_taken';
  password?: 'invalid_password';
}

export interface CreateUserInput {
  email: unknown;
  username: unknown;
  /** Optional initial password — omitted/null means a Google-only account. */
  password?: unknown;
  isAdmin?: unknown;
}

export type CreateUserResult =
  | { ok: true; status: 201; user: AdminUserSummary }
  | { ok: false; status: 400; error: 'invalid'; fields: AdminUserFieldErrors }
  | { ok: false; status: 409; error: 'email_taken' | 'username_taken' };

export interface UpdateUserInput {
  username?: unknown;
  email?: unknown;
  isAdmin?: unknown;
}

export type UpdateUserResult =
  | { ok: true; status: 200; user: AdminUserSummary }
  | { ok: false; status: 400; error: 'invalid'; fields: AdminUserFieldErrors }
  | { ok: false; status: 404; error: 'not_found' }
  | { ok: false; status: 409; error: 'email_taken' | 'username_taken' | 'last_admin' };

export type ResetPasswordResult =
  | { ok: true; status: 200 }
  | { ok: false; status: 400; error: 'invalid_password' }
  | { ok: false; status: 404; error: 'not_found' };

export type DeleteUserResult =
  | { ok: true; status: 204 }
  | { ok: false; status: 404; error: 'not_found' }
  | { ok: false; status: 409; error: 'last_admin' };
