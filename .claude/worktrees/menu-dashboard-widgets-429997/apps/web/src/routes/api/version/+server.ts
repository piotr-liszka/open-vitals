/**
 * GET /api/version — is this deployment running the newest commit? (spec 068)
 *
 * On demand only: the Settings card calls this when the user presses the button, so a page view
 * never spends a GitHub API call. The build stamps are Vite `define` literals, read here at the edge
 * and passed in, so `checkForUpdate` stays a pure function of its dependencies.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { checkForUpdate } from '$modules/version/version.api';

export const GET: RequestHandler = async ({ locals, fetch }) => {
  if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
  const c = locals.container;
  return json(
    await checkForUpdate({
      fetch,
      clock: c.clock,
      logger: c.logger,
      repo: c.config.updateCheckRepo,
      branch: c.config.updateCheckBranch,
      token: c.config.githubToken,
      buildTime: __BUILD_TIME__,
      buildSha: __BUILD_SHA__
    })
  );
};
