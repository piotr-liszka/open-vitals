import { redirect } from "@sveltejs/kit";
import { g as getConfig } from "../../../../chunks/dashboards.api.js";
const load = async ({ locals }) => {
  const user = locals.user;
  if (!await locals.consent.isEnabled("detailed_analytics")) redirect(303, "/");
  return { config: await getConfig(locals.container.repo.settings, user.id) };
};
export {
  load
};
