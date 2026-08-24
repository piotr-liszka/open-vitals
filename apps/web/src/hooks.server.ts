/** Per-request wiring: inject the container, resolve the session → user, guard protected routes. */
import { redirect, type Handle } from '@sveltejs/kit';
import { createContainer, type AppContainer } from '$lib/server/container';
import { migrate } from '$lib/server/db';
import { authGuard } from '$modules/auth/guard';
import { LOCALE_COOKIE, LOCALE_SETTING_KEY, resolveLocale } from '$lib/i18n';
import { securityHeaders } from '$lib/server/security-headers';
import { startSyncScheduler } from '$lib/server/sync/scheduler';
import { AUTO_SYNC_FEATURE } from '$lib/server/features/registry';

let container: AppContainer | null = null;
let schedulerStarted = false;

/**
 * Onboarding-gate cache (spec 094), same shape as `migrated`/`schedulerStarted` above: memoize once
 * `existsAdmin()` answers true, and never re-check. Safe because "an admin exists" can only become
 * true, never false again in normal operation — deleting the last admin by hand in the DB is
 * explicitly unsupported (it just drops the app back into onboarding-needed state, a blunt but
 * reasonable recovery path). Costs one extra indexed `SELECT EXISTS` per request only during the
 * (typically very short) window before the first admin is created, and zero afterwards.
 */
let adminExists = false;
async function onboardingNeeded(c: AppContainer): Promise<boolean> {
  if (adminExists) return false;
  adminExists = await c.repo.users.existsAdmin();
  return !adminExists;
}
function getContainer(): AppContainer {
  if (!container) container = createContainer();
  // Start the background sync scheduler once, in real deployments only (db present).
  // Dev/mock (no db) syncs on demand from the UI, so nothing spins up automatically there.
  // The handle goes on the container so the status API can tell the UI when the next tick lands
  // (spec 027); each tick fast-returns when the upstream probe shows nothing changed.
  if (!schedulerStarted && container.db) {
    schedulerStarted = true;
    container.schedulerRef.current = startSyncScheduler({
      users: container.repo.users,
      syncEngine: container.syncEngine,
      logger: container.logger,
      clock: container.clock,
      intervalMs: container.config.syncIntervalMinutes * 60_000,
      // Expired sessions are swept on the same tick (spec 076).
      sessions: container.session,
      // Users who switched background fetching off are skipped (spec 071).
      autoSyncEnabledFor: (userId) => container!.featuresFor(userId).isEnabled(AUTO_SYNC_FEATURE)
    });
  }
  return container;
}

/**
 * Schema migration runs once, lazily, on the first request that reaches the app. This is the
 * least-magic spot: `createContainer` stays synchronous (it just opens the pool) and there is no
 * top-level await; tests use the in-memory repo and never hit this path (db is null).
 */
let migrated: Promise<void> | null = null;
function ensureMigrated(c: AppContainer): Promise<void> {
  if (!migrated) {
    migrated = c.db
      ? migrate(c.db)
          .then(async () => {
            // Heal runs orphaned by a restart. A sync only ever runs inside this process, so any row
            // still `running` at startup is dead — left as-is it shows a phantom progress bar forever
            // and blocks new syncs.
            const healed = await c.store.failRunningRuns('interrupted', c.clock.now().toISOString());
            if (healed > 0) c.logger.warn('healed interrupted sync runs at startup', { healed });
          })
          .catch((err) => {
            migrated = null; // allow a retry on the next request if migration failed
            throw err;
          })
      : Promise.resolve();
  }
  return migrated;
}

export const handle: Handle = async ({ event, resolve }) => {
  const c = getContainer();
  await ensureMigrated(c);
  event.locals.container = c;

  const sessionId = event.cookies.get(c.session.cookieName);
  const user = await c.session.resolve(sessionId);
  event.locals.user = user;
  event.locals.authenticated = user !== null;
  // Raw cookie value, regardless of whether it resolved (spec 094) — never logged.
  event.locals.sessionId = sessionId ?? null;
  // Per-user, request-scoped services so downstream handlers can never touch another user's data.
  if (user) {
    event.locals.garmin = c.garminFor(user.id);
    event.locals.features = c.featuresFor(user.id);
  }

  /**
   * Language for this request (spec 076). Resolved HERE, before anything renders, so the very first
   * paint is already in the right language — a client-side swap would flash Polish at an English
   * reader on every navigation and desync `<html lang>`.
   *
   * The stored setting is read per request for signed-in users. That is one small keyed lookup
   * beside the session lookup that already happens, and it is what makes the account setting beat a
   * stale cookie left on a shared device. Static assets never reach `handle`, so this rides along
   * with page and API requests only.
   */
  const storedSettings = user ? await c.repo.settings.get(user.id) : undefined;
  event.locals.locale = resolveLocale({
    stored: storedSettings?.[LOCALE_SETTING_KEY],
    cookie: event.cookies.get(LOCALE_COOKIE) ?? null,
    acceptLanguage: event.request.headers.get('accept-language')
  });

  const decision = authGuard({
    authenticated: event.locals.authenticated,
    path: event.url.pathname,
    routeMatched: event.route.id !== null,
    onboardingNeeded: await onboardingNeeded(c)
  });
  if (decision.action === 'unauthorized') {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' }
    });
  }
  if (decision.action === 'onboarding_required') {
    if (event.url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'onboarding_required' }), {
        status: 503,
        headers: { 'content-type': 'application/json' }
      });
    }
    throw redirect(303, '/onboarding');
  }
  if (decision.action === 'redirect') throw redirect(303, decision.to);

  // `%lang%` in app.html becomes the resolved locale, so assistive tech and translation tooling are
  // told the truth about what language the document is in (spec 076).
  const response = await resolve(event, {
    transformPageChunk: ({ html }) => html.replace('%lang%', event.locals.locale)
  });
  // Defense-in-depth headers on every response. HSTS only when the edge is HTTPS
  // (behind a TLS proxy in prod, or a direct https dev connection).
  const https = c.config.isProd || event.url.protocol === 'https:';
  for (const [name, value] of Object.entries(securityHeaders({ https }))) {
    response.headers.set(name, value);
  }
  return response;
};
