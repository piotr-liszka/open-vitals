import { describe, expect, it } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import { requireAdmin, requireAdminApi } from './require-admin';
import type { User } from '$lib/server/repo/types';

function user(isAdmin: boolean): User {
  return {
    id: 'u1',
    googleSub: null,
    email: 'u1@example.com',
    username: 'u1',
    isAdmin,
    hasPassword: true,
    name: null,
    avatarUrl: null,
    createdAt: '2026-01-01T00:00:00.000Z'
  };
}

describe('requireAdmin (page routes)', () => {
  it('does nothing for an admin', () => {
    expect(() => requireAdmin(user(true))).not.toThrow();
  });

  it('throws a 403 for a non-admin or signed-out visitor', () => {
    try {
      requireAdmin(user(false));
      throw new Error('expected throw');
    } catch (err) {
      expect(isHttpError(err)).toBe(true);
      if (isHttpError(err)) expect(err.status).toBe(403);
    }

    try {
      requireAdmin(null);
      throw new Error('expected throw');
    } catch (err) {
      expect(isHttpError(err)).toBe(true);
      if (isHttpError(err)) expect(err.status).toBe(403);
    }
  });
});

describe('requireAdminApi (/api/admin/** routes)', () => {
  it('returns null for an admin, a plain 403 JSON Response otherwise', async () => {
    expect(requireAdminApi(user(true))).toBeNull();

    const rejected = requireAdminApi(user(false));
    expect(rejected).not.toBeNull();
    expect(rejected?.status).toBe(403);
    expect(await rejected?.json()).toEqual({ error: 'forbidden' });

    expect(requireAdminApi(null)?.status).toBe(403);
  });
});
