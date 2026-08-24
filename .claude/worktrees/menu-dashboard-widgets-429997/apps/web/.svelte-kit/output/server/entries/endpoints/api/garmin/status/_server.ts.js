import { json } from "@sveltejs/kit";
import { g as getHealth } from "../../../../../chunks/health.api.js";
const GET = async ({ locals }) => {
  return json(await getHealth(locals.garmin));
};
export {
  GET
};
