import { redirect } from "@sveltejs/kit";
import { t as trainingTabs } from "../../../chunks/training-nav.js";
const DATA_PROCESSING = "detailed_analytics";
const load = async ({ locals }) => {
  if (!await locals.consent.isEnabled(DATA_PROCESSING)) throw redirect(303, "/");
  const user = locals.user;
  const sports = await locals.container.store.listSports(user.id);
  return { tabs: trainingTabs(sports) };
};
export {
  load
};
