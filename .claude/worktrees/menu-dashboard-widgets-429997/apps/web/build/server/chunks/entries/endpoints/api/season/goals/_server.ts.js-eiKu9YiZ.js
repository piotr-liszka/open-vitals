import { j as json } from '../../../../../chunks/utils.js-D6eaf5bT.js';
import { l as loadSeason, c as createGoal } from '../../../../../chunks/season.api.js-D9PxySh0.js';
import '../../../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../../../chunks/uneval.js-BnYgIxRU.js';
import '../../../../../chunks/types3.js-EQmY9zkz.js';
import '../../../../../chunks/training-load.js-DHd0MMKR.js';
import '../../../../../chunks/power-profile.js-CfSj4S4i.js';
import '../../../../../chunks/load-risk.js-Dfmk1QQ7.js';
import '../../../../../chunks/running-profile.js-BI1N4bvT.js';
import '../../../../../chunks/weekly-volume.js-8BKa7ZsC.js';
import '../../../../../chunks/date.js-Cf0GyZI8.js';
import '../../../../../chunks/pace-model.js-DDe_pC8X.js';
import '../../../../../chunks/race-predictor.js-DIEgT15V.js';
import '../../../../../chunks/sport-labels.js-BKqMzU19.js';
import '../../../../../chunks/tier.js-D9LGF7b1.js';

function deps({ locals }) {
  const c = locals.container;
  return {
    store: c.store,
    settings: c.repo.settings,
    consent: locals.consent,
    clock: c.clock,
    random: c.random
  };
}
const GET = async (event) => {
  return json(await loadSeason(deps(event), { userId: event.locals.user.id }));
};
const POST = async (event) => {
  const body = await event.request.json().catch(() => null);
  const result = await createGoal(deps(event), event.locals.user.id, body);
  if (!result.ok) return json({ error: result.error }, { status: result.status });
  return json({ goal: result.goal });
};

export { GET, POST };
//# sourceMappingURL=_server.ts.js-eiKu9YiZ.js.map
