/**
 * `/activities/mapa` is now `/activities/map` — route segments are English.
 * Permanent redirect so existing bookmarks, shared links and anything an MCP client
 * stored do not 404. The query travels along, so a filtered link stays filtered.
 */
import { redirect } from '@sveltejs/kit';
import { movedTo } from '$lib/legacy-redirect';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
  throw redirect(308, movedTo('/activities/map', url));
};
