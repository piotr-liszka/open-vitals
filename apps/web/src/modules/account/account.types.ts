/** Contract types for the self-service "My Account" slice (spec 094). */

export interface AccountInfo {
  readonly username: string;
  readonly email: string;
  readonly isAdmin: boolean;
  readonly hasPassword: boolean;
  readonly hasGoogle: boolean;
  readonly googleEmail: string | null;
  readonly googleAvatarUrl: string | null;
}

export interface OwnSessionView {
  readonly id: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly userAgent: string | null;
  readonly ipAddress: string | null;
  /** True for the session that matches the request's own cookie. */
  readonly isCurrent: boolean;
}

export interface SetOwnPasswordInput {
  /** Required only when the account already has a password (verified before the change). */
  currentPassword?: unknown;
  newPassword: unknown;
  confirmPassword: unknown;
}

export type SetOwnPasswordResult =
  | { ok: true; status: 200 }
  | { ok: false; status: 401; error: 'invalid_current_password' }
  | { ok: false; status: 400; error: 'invalid_password' | 'mismatch' };

export type RevokeOwnSessionResult =
  { ok: true; status: 200; wasCurrent: boolean } | { ok: false; status: 404; error: 'not_found' };

export interface RevokeOtherSessionsResult {
  readonly ok: true;
  readonly status: 200;
  readonly revoked: number;
}
