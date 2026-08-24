import { json } from "@sveltejs/kit";
import { G as GarminUnavailableError } from "../../../../../chunks/interfaces.js";
const POST = async ({ locals }) => {
  try {
    await locals.garmin.disconnect();
    return json({ ok: true });
  } catch (err) {
    if (err instanceof GarminUnavailableError) {
      return json({ ok: false, error: "Garmin service unavailable." }, { status: 503 });
    }
    throw err;
  }
};
export {
  POST
};
