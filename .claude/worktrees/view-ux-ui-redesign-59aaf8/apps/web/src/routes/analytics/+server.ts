/**
 * `Analityka` was folded into `Wnioski` (spec 048). Both pages built their charts from the same
 * `METRICS` list, and once spec 047 put them behind one global range switch they rendered the same
 * charts over the same window — so Analityka's summary statistics moved onto the Wnioski chart cards
 * and this route became a redirect, like `/power` and `/running` before it (spec 025).
 *
 * The range travels with the redirect: a shared `/analytics?range=365` link must land on a year of
 * Wnioski, not snap back to the default.
 */
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
  const range = url.searchParams.get('range');
  throw redirect(308, range ? `/insights?range=${encodeURIComponent(range)}` : '/insights');
};
