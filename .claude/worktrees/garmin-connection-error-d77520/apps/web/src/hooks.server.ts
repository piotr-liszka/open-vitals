/** Per-request wiring: inject the container, resolve the session → user, guard protected routes. */
import { redirect, type Handle } from '@sveltejs/kit';
import { createContainer, type AppContainer } from '$lib/server/container';
import { migrate } from '$lib/server/db';
import { authGuard } from '$modules/auth/guard';
import { securityHeaders } from '$lib/server/security-headers';
import { startSyncScheduler } from '$lib/server/sync/scheduler';
import { AUTO_SYNC_FEATURE } from '$lib/server/features/registry';

let container: AppContainer | null = null;
let schedulerStarted = false;
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
      // Expired sessions are swept on the same tick (spec 055).
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
  // Per-user, request-scoped services so downstream handlers can never touch another user's data.
  if (user) {
    event.locals.garmin = c.garminFor(user.id);
    event.locals.features = c.featuresFor(user.id);
  }

  const decision = authGuard({
    authenticated: event.locals.authenticated,
    path: event.url.pathname,
    routeMatched: event.route.id !== null
  });
  if (decision.action === 'unauthorized') {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' }
    });
  }
  if (decision.action === 'redirect') throw redirect(303, decision.to);

  const response = await resolve(event);
  // Defense-in-depth headers on every response. HSTS only when the edge is HTTPS
  // (behind a TLS proxy in prod, or a direct https dev connection).
  const https = c.config.isProd || event.url.protocol === 'https:';
  for (const [name, value] of Object.entries(securityHeaders({ https }))) {
    response.headers.set(name, value);
  }
  return response;
};
