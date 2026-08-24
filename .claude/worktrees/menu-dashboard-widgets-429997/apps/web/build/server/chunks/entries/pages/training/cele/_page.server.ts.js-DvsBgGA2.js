import { l as loadSeason } from '../../../../chunks/season.api.js-D9PxySh0.js';

const load = async ({ locals }) => {
  const user = locals.user;
  const c = locals.container;
  const season = await loadSeason(
    { store: c.store, settings: c.repo.settings, consent: locals.consent, clock: c.clock, random: c.random },
    { userId: user.id }
  );
  return { season };
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

export { _page_server_ts as _ };
//# sourceMappingURL=_page.server.ts.js-DvsBgGA2.js.map
