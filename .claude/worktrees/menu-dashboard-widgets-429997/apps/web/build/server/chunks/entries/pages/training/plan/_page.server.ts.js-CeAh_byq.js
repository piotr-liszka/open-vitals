import { l as loadPlanner } from '../../../../chunks/workouts.api.js-CJgF3eKY.js';
import { g as gridRange } from '../../../../chunks/planner.js-CsrGpx4j.js';
import { t as todayKey, q as isMonthKey, h as monthKeyOf, j as isDayKey } from '../../../../chunks/date.js-Cf0GyZI8.js';

const load = async ({ locals, url }) => {
  const user = locals.user;
  const c = locals.container;
  const today = todayKey(c.clock, c.config.appTimeZone);
  const monthParam = url.searchParams.get("month");
  const month = isMonthKey(monthParam) ? monthParam : monthKeyOf(today);
  const dayParam = url.searchParams.get("day");
  const { from, to } = gridRange(month);
  const selected = isDayKey(dayParam) && dayParam >= from && dayParam <= to ? dayParam : null;
  const planner = await loadPlanner(
    { store: c.store, clock: c.clock, random: c.random, consent: locals.consent },
    user.id,
    from,
    to
  );
  return { planner, month, today, selected };
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

export { _page_server_ts as _ };
//# sourceMappingURL=_page.server.ts.js-CeAh_byq.js.map
