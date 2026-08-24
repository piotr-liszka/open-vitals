/**
 * Pure self-service "My Account" handlers (spec 094). Routes stay thin: build deps from the
 * container, call these, map the result to a `Response`. Every handler is scoped STRICTLY to the
 * calling user id — a session/row belonging to someone else is never returned or mutated via these.
 */
import type { AppContainer } from '$lib/server/container';
import { validateNewPassword } from './account.validate';
import type {
  AccountInfo,
  OwnSessionView,
  RevokeOtherSessionsResult,
  RevokeOwnSessionResult,
  SetOwnPasswordInput,
  SetOwnPasswordResult
} from './account.types';

export async function getAccountInfo(container: AppContainer, userId: string): Promise<AccountInfo | null> {
  const user = await container.repo.users.findById(userId);
  if (!user) return null;
  return {
    username: user.username,
    email: user.email,
    isAdmin: user.isAdmin,
    hasPassword: user.hasPassword,
    hasGoogle: user.googleSub !== null,
    // The account only HAS one email/avatar today — the Google one, once linked, is the same field
    // Google keeps refreshed. A future spec that stores a separate "linked Google profile" snapshot
    // would fill these from that instead; for now, "linked" implies "this is the Google profile".
    googleEmail: user.googleSub !== null ? user.email : null,
    googleAvatarUrl: user.googleSub !== null ? user.avatarUrl : null
  };
}

/**
 * Set (no current account password) or change (current account has one) the caller's own password.
 * A Google-only account sets its first password with no current-password field; an account that
 * already has one must supply it correctly, or the change is rejected with 401.
 */
export async function setOwnPassword(
  container: AppContainer,
  userId: string,
  input: SetOwnPasswordInput
): Promise<SetOwnPasswordResult> {
  const user = await container.repo.users.findById(userId);
  if (!user) return { ok: false, status: 400, error: 'invalid_password' };

  if (user.hasPassword) {
    const credential = await container.repo.users.findCredentialByIdentifier(user.username);
    const currentPassword = typeof input.currentPassword === 'string' ? input.currentPassword : '';
    const verified =
      credential?.passwordHash !== null &&
      credential?.passwordHash !== undefined &&
      (await container.passwordHasher.verify(currentPassword, credential.passwordHash));
    if (!verified) return { ok: false, status: 401, error: 'invalid_current_password' };
  }

  const validated = validateNewPassword(input.newPassword, input.confirmPassword);
  if (!validated.ok) return { ok: false, status: 400, error: validated.error };

  const passwordHash = await container.passwordHasher.hash(validated.value);
  await container.repo.users.setPassword(userId, passwordHash);
  return { ok: true, status: 200 };
}

/** The caller's own sessions, newest first, with `isCurrent` marked against their own cookie value. */
export async function listOwnSessions(
  container: AppContainer,
  userId: string,
  currentSessionId: string | null
): Promise<OwnSessionView[]> {
  const sessions = await container.repo.sessions.listByUser(userId);
  return sessions.map((s) => ({ ...s, isCurrent: s.id === currentSessionId }));
}

/** Delete exactly one of the caller's OWN sessions — a row belonging to someone else 404s. */
export async function revokeOwnSession(
  container: AppContainer,
  userId: string,
  sessionId: string,
  currentSessionId: string | null
): Promise<RevokeOwnSessionResult> {
  const own = await container.repo.sessions.listByUser(userId);
  if (!own.some((s) => s.id === sessionId)) return { ok: false, status: 404, error: 'not_found' };

  await container.repo.sessions.delete(sessionId);
  return { ok: true, status: 200, wasCurrent: sessionId === currentSessionId };
}

/** Delete every one of the caller's sessions except the current one. */
export async function revokeOtherSessions(
  container: AppContainer,
  userId: string,
  currentSessionId: string
): Promise<RevokeOtherSessionsResult> {
  const revoked = await container.repo.sessions.deleteOtherSessions(userId, currentSessionId);
  return { ok: true, status: 200, revoked };
}
