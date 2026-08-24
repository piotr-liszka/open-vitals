import { j as json } from '../../../../../chunks/utils.js-D6eaf5bT.js';
import { G as GarminUnavailableError } from '../../../../../chunks/interfaces.js-CRv0EuSy.js';
import '../../../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../../../chunks/uneval.js-BnYgIxRU.js';

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

export { POST };
//# sourceMappingURL=_server.ts.js-gDSmPiMp.js.map
