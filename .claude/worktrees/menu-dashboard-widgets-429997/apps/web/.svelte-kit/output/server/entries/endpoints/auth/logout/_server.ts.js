import { json } from "@sveltejs/kit";
import { l as logout } from "../../../../chunks/auth.api.js";
const POST = async ({ locals, cookies }) => {
  const cookieName = locals.container.session.cookieName;
  await logout(locals.container, cookies.get(cookieName));
  cookies.delete(cookieName, { path: "/" });
  return json({ ok: true });
};
export {
  POST
};
