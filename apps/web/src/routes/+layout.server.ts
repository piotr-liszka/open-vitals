/**
 * Root layout load. Carries the request's LANGUAGE (spec 076) and admin flag, which is the one thing
 * every page needs whether or not anyone is signed in — so unlike per-page data it is returned on the
 * signed-out path too.
 */
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  return { locale: locals.locale, isAdmin: locals.user?.isAdmin ?? false };
};
