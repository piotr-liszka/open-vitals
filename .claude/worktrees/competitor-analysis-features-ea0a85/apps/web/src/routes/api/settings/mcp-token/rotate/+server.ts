import { json, type RequestHandler } from '@sveltejs/kit';
import { rotateMcpUrl } from '$modules/mcp-url/mcpUrl.api';

/** Issue a fresh per-user MCP token (invalidating the old one) and return the new URL. */
export const POST: RequestHandler = async ({ locals }) => {
  const url = await rotateMcpUrl(locals.container, locals.user!.id);
  return json({ url });
};
