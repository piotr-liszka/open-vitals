/**
 * Pure route-guard decision (spec 012, extended spec 094). Kept separate from hooks so it is
 * unit-testable without a container or env. Public: /login, /auth/**, /mcp**, /styleguide,
 * /onboarding (only while no admin exists — see below), and GET /api/health.
 */
export type GuardDecision =
  | { action: 'allow' }
  | { action: 'redirect'; to: string }
  | { action: 'unauthorized' }
  | { action: 'onboarding_required' };

/**
 * `/` is NOT public any more (spec 094): the marketing landing page it existed for is gone, so an
 * unauthenticated visit to `/` falls through to the ordinary "redirect to /login" branch below (or
 * to `/onboarding`, if that gate fires first).
 */
const PUBLIC_PAGES = new Set(['/login']);
const PUBLIC_APIS = new Set(['/api/health']);

const ONBOARDING_PATH = '/onboarding';

export function isPublicPath(path: string): boolean {
  const isApi = path.startsWith('/api/');
  return (
    (isApi ? PUBLIC_APIS.has(path) : PUBLIC_PAGES.has(path)) ||
    path.startsWith('/auth/') ||
    // Exact/segment matches only — a broad prefix would silently expose a future
    // /mcp-admin or /styleguide-internal route (security review finding).
    path === '/mcp' ||
    path === '/styleguide' ||
    path.startsWith('/styleguide/')
  );
}

export function authGuard(input: {
  authenticated: boolean;
  path: string;
  routeMatched: boolean;
  /**
   * True while no admin user exists yet (spec 094) — resolved + cached by `hooks.server.ts`, never
   * computed here so this stays a pure, DB-free decision.
   */
  onboardingNeeded: boolean;
}): GuardDecision {
  const isOnboardingPath = input.path === ONBOARDING_PATH;

  // The onboarding route is gated FIRST, and unconditionally on `authenticated` — reachable only
  // while no admin exists, a clean redirect to /login once one does, for both GET and its form
  // action's POST (same route id).
  if (isOnboardingPath) {
    return input.onboardingNeeded ? { action: 'allow' } : { action: 'redirect', to: '/login' };
  }

  if (input.onboardingNeeded && input.routeMatched && input.path !== '/api/health') {
    return { action: 'onboarding_required' };
  }

  if (input.authenticated || isPublicPath(input.path)) return { action: 'allow' };
  if (input.path.startsWith('/api/')) return { action: 'unauthorized' };
  // Only redirect matched page routes; let assets/unmatched requests pass through.
  return input.routeMatched ? { action: 'redirect', to: '/login' } : { action: 'allow' };
}
