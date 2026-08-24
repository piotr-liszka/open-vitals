import { redirect } from "@sveltejs/kit";
import { l as loadInsights } from "../../../chunks/insights.api.js";
import { l as listConsent } from "../../../chunks/consent.api.js";
import { l as loadRange } from "../../../chunks/range-context.js";
import { i as isAdvanced } from "../../../chunks/tier.js";
const load = async ({ locals, url }) => {
  const { garmin, consent, container } = locals;
  if (!await isAdvanced(consent)) throw redirect(303, "/");
  const legacy = url.searchParams.get("window");
  if (legacy !== null) {
    const target = new URL(url);
    target.searchParams.delete("window");
    target.searchParams.set("range", legacy === "90" ? "30" : legacy);
    throw redirect(308, `${target.pathname}${target.search}`);
  }
  const range = await loadRange(
    { store: container.store, clock: container.clock, timeZone: container.config.appTimeZone },
    locals.user.id,
    url
  );
  const [insights, consentList] = await Promise.all([
    loadInsights(
      { garmin, consent, clock: container.clock, timeZone: container.config.appTimeZone },
      { range }
    ),
    listConsent(consent)
  ]);
  const analyticsFeature = consentList.features.find((f) => f.id === "detailed_analytics") ?? null;
  return { insights, range, analyticsFeature };
};
export {
  load
};
