import { g as getCoverage } from '../../../chunks/sync.api.js-WZxo88-X.js';
import { G as GarminUnavailableError } from '../../../chunks/interfaces.js-CRv0EuSy.js';

const load = async ({ locals }) => {
  const user = locals.user;
  const c = locals.container;
  const { coverage, lastRun } = await getCoverage({ store: c.store, syncEngine: c.syncEngine }, user.id);
  let connected = false;
  try {
    connected = (await locals.garmin.getStatus()).authenticated;
  } catch (err) {
    if (!(err instanceof GarminUnavailableError)) throw err;
  }
  const advanced = await locals.consent.isEnabled("detailed_analytics");
  const twelveHoursMs = 12 * 60 * 60 * 1e3;
  const lastOk = lastRun?.status === "succeeded" ? lastRun.finishedAt : null;
  const stale = !lastOk || c.clock.now().getTime() - new Date(lastOk).getTime() > twelveHoursMs;
  const prompt = connected && stale;
  return { coverage, lastRun, connected, advanced, prompt };
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

export { _page_server_ts as _ };
//# sourceMappingURL=_page.server.ts.js-DwjVy14h.js.map
