/**
 * `/login` load (spec 094): exposes whether Google sign-in is even configured, so the page can hide
 * the button entirely rather than show one that always fails. Reuses `container.auth.kind` — the
 * SAME flag `container.ts` already computed to select the `oidc` vs. `mock` adapter — rather than
 * re-deriving "is Google configured" from env vars a second time.
 */
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
  return { googleEnabled: locals.container.auth.kind === 'oidc' };
};
