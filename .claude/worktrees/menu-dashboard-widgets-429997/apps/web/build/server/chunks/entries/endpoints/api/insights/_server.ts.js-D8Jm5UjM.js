import { j as json } from '../../../../chunks/utils.js-D6eaf5bT.js';
import { l as loadInsights, I as InvalidWindowError } from '../../../../chunks/insights.api.js--LO94Vlc.js';
import '../../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../../chunks/uneval.js-BnYgIxRU.js';
import '../../../../chunks/date.js-Cf0GyZI8.js';
import '../../../../chunks/series.js-BlIzPiOH.js';
import '../../../../chunks/interfaces.js-CRv0EuSy.js';
import '../../../../chunks/metric-specs.js-C1h9oD5N.js';
import '../../../../chunks/condition.format.js-D1Rk637l.js';

const GET = async ({ locals, url }) => {
  const { garmin, consent, container } = locals;
  const raw = url.searchParams.get("window");
  const window = raw === null ? 30 : Number(raw);
  try {
    const data = await loadInsights(
      { garmin, consent, clock: container.clock, timeZone: container.config.appTimeZone },
      { window }
    );
    return json(data);
  } catch (err) {
    if (err instanceof InvalidWindowError) {
      return json({ error: "window must be one of 7, 30, 90, 365" }, { status: 400 });
    }
    throw err;
  }
};

export { GET };
//# sourceMappingURL=_server.ts.js-D8Jm5UjM.js.map
