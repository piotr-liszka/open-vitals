import { j as json } from '../../../../../chunks/utils.js-D6eaf5bT.js';
import { g as getHealth } from '../../../../../chunks/health.api.js-BgYjM4BU.js';
import '../../../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../../../chunks/uneval.js-BnYgIxRU.js';
import '../../../../../chunks/interfaces.js-CRv0EuSy.js';

const GET = async ({ locals }) => {
  return json(await getHealth(locals.garmin));
};

export { GET };
//# sourceMappingURL=_server.ts.js-KBgQfspn.js.map
