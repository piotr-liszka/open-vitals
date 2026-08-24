import { json } from "@sveltejs/kit";
import { r as rotateMcpUrl } from "../../../../../../chunks/mcpUrl.api.js";
const POST = async ({ locals }) => {
  const url = await rotateMcpUrl(locals.container, locals.user.id);
  return json({ url });
};
export {
  POST
};
