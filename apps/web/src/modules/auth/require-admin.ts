/**
 * A role check, not a session check (spec 094) — deliberately separate from the generic `authGuard`
 * in `hooks.server.ts`, consistent with how other route-specific authorization already lives at the
 * route/handler level in this codebase rather than centrally.
 */
import { error } from '@sveltejs/kit';
import type { User } from '$lib/server/repo/types';

/** For PAGE routes: throws SvelteKit's HTML-oriented 403. */
export function requireAdmin(user: User | null): void {
  if (!user?.isAdmin) throw error(403, 'Forbidden');
}

/** For `/api/admin/**` routes: a plain 403 JSON Response, not `error()`'s HTML-oriented throw. */
export function requireAdminApi(user: User | null): Response | null {
  if (user?.isAdmin) return null;
  return new Response(JSON.stringify({ error: 'forbidden' }), {
    status: 403,
    headers: { 'content-type': 'application/json' }
  });
}
