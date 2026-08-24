import { json, type RequestHandler } from '@sveltejs/kit';
import { getMcpUrl } from '$modules/mcp-url/mcpUrl.api';

export const GET: RequestHandler = async ({ locals }) => {
  return json({ url: await getMcpUrl(locals.container, locals.user!.id) });
};
