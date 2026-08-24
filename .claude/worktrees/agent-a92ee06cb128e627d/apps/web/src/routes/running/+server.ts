/**
 * `Bieg` became the running tab of the training section (spec 025). Kept as a permanent redirect so
 * existing bookmarks and links do not 404.
 */
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
  throw redirect(308, '/training/run');
};
