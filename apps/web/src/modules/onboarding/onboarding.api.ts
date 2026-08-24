/**
 * Pure onboarding handler (spec 094): first-run admin creation. Routes stay thin — the form action
 * calls `createInitialAdmin` and translates the result into a redirect/`fail`. No `fetch`/`env`/
 * `Date.now()` here — everything comes from the injected container.
 */
import type { AppContainer } from '$lib/server/container';
import { UniqueViolationError } from '$lib/server/repo/memory';
import { isUniqueViolation } from '$lib/server/repo/pg';
import { validateOnboardingInput, type OnboardingInput } from './onboarding.validate';
import type { CreateInitialAdminResult } from './onboarding.types';

interface CreateInitialAdminInput extends OnboardingInput {
  /** Session provenance captured at the route layer (spec 094) — never logged. */
  userAgent?: string | null;
  ipAddress?: string | null;
}

/** True when `err` is either adapter's unique-violation shape (spec 094 race safety). */
function isRaceViolation(err: unknown): boolean {
  return err instanceof UniqueViolationError || isUniqueViolation(err);
}

/**
 * Create the first admin account, or refuse if one already exists. Re-checks `existsAdmin()` itself
 * (defense in depth — never trust the guard alone for a security-relevant write): a race between two
 * people loading a fresh install's `/onboarding` at once, or the in-process cache lagging a moment
 * behind a concurrent request that just created one, both land here as `already_onboarded`.
 */
export async function createInitialAdmin(
  container: AppContainer,
  input: CreateInitialAdminInput
): Promise<CreateInitialAdminResult> {
  const { repo, passwordHasher, session } = container;

  if (await repo.users.existsAdmin()) {
    return { ok: false, kind: 'already_onboarded' };
  }

  const validated = validateOnboardingInput(input);
  if (!validated.ok) return { ok: false, kind: 'validation', fields: validated.fields };

  const { email, username, password } = validated;
  const fields: { email?: 'email_taken'; username?: 'username_taken' } = {};
  if (await repo.users.findByEmail(email)) fields.email = 'email_taken';
  if (await repo.users.findByUsername(username)) fields.username = 'username_taken';
  if (Object.keys(fields).length > 0) {
    return { ok: false, kind: 'validation', fields };
  }

  const passwordHash = await passwordHasher.hash(password);

  let user;
  try {
    user = await repo.users.createLocal({ email, username, passwordHash, isAdmin: true });
  } catch (err) {
    if (isRaceViolation(err)) {
      // A concurrent create won the exact same email/username between our pre-check and this insert.
      return {
        ok: false,
        kind: 'validation',
        fields: { email: 'email_taken', username: 'username_taken' }
      };
    }
    throw err;
  }

  const sessionId = await session.issue(user.id, {
    userAgent: input.userAgent ?? null,
    ipAddress: input.ipAddress ?? null
  });
  return {
    ok: true,
    session: { id: sessionId, cookieName: session.cookieName, maxAge: session.maxAgeSeconds }
  };
}
