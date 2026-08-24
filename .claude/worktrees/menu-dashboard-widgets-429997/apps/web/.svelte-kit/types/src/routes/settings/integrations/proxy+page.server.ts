// @ts-nocheck
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Integrations now live inside the main Settings page (spec 019); keep this path working for
// bookmarks by redirecting.
export const load = async () => {
  throw redirect(308, '/settings');
};
;null as any as PageServerLoad;