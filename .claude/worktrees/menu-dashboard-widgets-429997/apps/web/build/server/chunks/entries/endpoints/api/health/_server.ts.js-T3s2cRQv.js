import { j as json } from '../../../../chunks/utils.js-D6eaf5bT.js';
import '../../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../../chunks/uneval.js-BnYgIxRU.js';

const GET = ({ locals }) => {
  return json({
    status: "ok",
    service: "vagus-web",
    time: locals.container.clock.now().toISOString()
  });
};

export { GET };
//# sourceMappingURL=_server.ts.js-T3s2cRQv.js.map
