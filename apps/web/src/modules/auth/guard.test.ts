import { describe, it, expect } from 'vitest';
import { authGuard, isPublicPath } from './guard';

/** Most tests care about the ordinary post-onboarding world. */
function guard(input: { authenticated: boolean; path: string; routeMatched: boolean }) {
  return authGuard({ ...input, onboardingNeeded: false });
}

describe('authGuard', () => {
  it('redirects unauthenticated page requests to /login', () => {
    expect(guard({ authenticated: false, path: '/settings', routeMatched: true })).toEqual({
      action: 'redirect',
      to: '/login'
    });
  });

  it('401s unauthenticated non-public API requests', () => {
    expect(guard({ authenticated: false, path: '/api/consent', routeMatched: true })).toEqual({
      action: 'unauthorized'
    });
  });

  it('allows authenticated requests through', () => {
    expect(guard({ authenticated: true, path: '/', routeMatched: true })).toEqual({ action: 'allow' });
  });

  it('/ is no longer public (spec 094: the landing page is gone) — an unauthed visit redirects', () => {
    expect(guard({ authenticated: false, path: '/', routeMatched: true })).toEqual({
      action: 'redirect',
      to: '/login'
    });
    expect(isPublicPath('/')).toBe(false);
  });

  it('allows public paths without a session', () => {
    for (const path of ['/login', '/auth/login', '/auth/callback', '/mcp', '/styleguide', '/api/health']) {
      expect(isPublicPath(path)).toBe(true);
      expect(guard({ authenticated: false, path, routeMatched: true })).toEqual({ action: 'allow' });
    }
  });

  it('lets unmatched (asset) requests pass through instead of redirecting', () => {
    expect(guard({ authenticated: false, path: '/favicon.ico', routeMatched: false })).toEqual({
      action: 'allow'
    });
  });
});

describe('authGuard — onboarding gate (spec 094)', () => {
  it('allows GET /onboarding while no admin exists, for both an authed and unauthed visitor', () => {
    expect(
      authGuard({ authenticated: false, path: '/onboarding', routeMatched: true, onboardingNeeded: true })
    ).toEqual({ action: 'allow' });
    expect(
      authGuard({ authenticated: true, path: '/onboarding', routeMatched: true, onboardingNeeded: true })
    ).toEqual({ action: 'allow' });
  });

  it('redirects /onboarding to /login once an admin exists, regardless of auth state', () => {
    expect(
      authGuard({ authenticated: false, path: '/onboarding', routeMatched: true, onboardingNeeded: false })
    ).toEqual({ action: 'redirect', to: '/login' });
    expect(
      authGuard({ authenticated: true, path: '/onboarding', routeMatched: true, onboardingNeeded: false })
    ).toEqual({ action: 'redirect', to: '/login' });
  });

  it('blocks every other MATCHED route with onboarding_required while no admin exists', () => {
    for (const path of ['/', '/login', '/settings', '/api/consent', '/api/admin/users']) {
      expect(authGuard({ authenticated: false, path, routeMatched: true, onboardingNeeded: true })).toEqual({
        action: 'onboarding_required'
      });
      // Even an (impossible in practice, but the decision must not special-case it) authenticated
      // request is still blocked — nobody can be authenticated before onboarding ever completes.
      expect(authGuard({ authenticated: true, path, routeMatched: true, onboardingNeeded: true })).toEqual({
        action: 'onboarding_required'
      });
    }
  });

  it('exempts GET /api/health from the onboarding gate', () => {
    expect(
      authGuard({ authenticated: false, path: '/api/health', routeMatched: true, onboardingNeeded: true })
    ).toEqual({ action: 'allow' });
  });

  it('lets unmatched static assets pass through even while onboarding is needed', () => {
    expect(
      authGuard({ authenticated: false, path: '/favicon.ico', routeMatched: false, onboardingNeeded: true })
    ).toEqual({ action: 'allow' });
  });

  it('falls through to the ordinary authenticated/public logic once onboarding is not needed', () => {
    expect(
      authGuard({ authenticated: true, path: '/settings', routeMatched: true, onboardingNeeded: false })
    ).toEqual({ action: 'allow' });
    expect(
      authGuard({ authenticated: false, path: '/login', routeMatched: true, onboardingNeeded: false })
    ).toEqual({ action: 'allow' });
  });
});
