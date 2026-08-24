import { l as loadSeason } from "../../../../chunks/season.api.js";
const load = async ({ locals }) => {
  const user = locals.user;
  const c = locals.container;
  const season = await loadSeason(
    { store: c.store, settings: c.repo.settings, consent: locals.consent, clock: c.clock, random: c.random },
    { userId: user.id }
  );
  return { season };
};
export {
  load
};
