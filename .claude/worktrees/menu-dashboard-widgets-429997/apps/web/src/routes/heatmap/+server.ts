/**
 * `Mapa ciepła` became the map tab of the activities section (spec 048) — it always was a lens on the
 * same activity set, not a peer of it. Kept as a permanent redirect so existing bookmarks and links do
 * not 404, following the `/power` and `/running` precedent (spec 025).
 *
 * The sport and year filters travel with the redirect: a shared `/heatmap?sport=cycling&year=2025`
 * link must land on that same filtered map.
 */
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
  const query = url.searchParams.toString();
  throw redirect(308, query ? `/activities/mapa?${query}` : '/activities/mapa');
};
