import { json } from "@sveltejs/kit";
import { g as getMcpUrl } from "../../../../chunks/mcpUrl.api.js";
const GET = async ({ locals }) => {
  return json({ url: await getMcpUrl(locals.container, locals.user.id) });
};
export {
  GET
};
