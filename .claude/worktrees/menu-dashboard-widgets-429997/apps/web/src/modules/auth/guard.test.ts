import { describe, it, expect } from 'vitest';
import { authGuard, isPublicPath } from './guard';

describe('authGuard', () => {
  it('redirects unauthenticated page requests to /login', () => {
    expect(authGuard({ authenticated: false, path: '/settings', routeMatched: true })).toEqual({
      action: 'redirect',
      to: '/login'
    });
  });

  it('401s unauthenticated non-public API requests', () => {
    expect(authGuard({ authenticated: false, path: '/api/consent', routeMatched: true })).toEqual({
      action: 'unauthorized'
    });
  });

  it('allows authenticated requests through', () => {
    expect(authGuard({ authenticated: true, path: '/', routeMatched: true })).toEqual({ action: 'allow' });
  });

  it('allows public paths without a session', () => {
    for (const path of [
      '/',
      '/login',
      '/auth/login',
      '/auth/callback',
      '/mcp',
      '/styleguide',
      '/api/health'
    ]) {
      expect(isPublicPath(path)).toBe(true);
      expect(authGuard({ authenticated: false, path, routeMatched: true })).toEqual({ action: 'allow' });
    }
  });

  it('lets unmatched (asset) requests pass through instead of redirecting', () => {
    expect(authGuard({ authenticated: false, path: '/favicon.ico', routeMatched: false })).toEqual({
      action: 'allow'
    });
  });
});
