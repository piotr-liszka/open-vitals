import { j as json } from '../../../../chunks/utils.js-D6eaf5bT.js';
import { l as listConsent, p as postConsent } from '../../../../chunks/consent.api.js-X7al9k4a.js';
import '../../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../../chunks/uneval.js-BnYgIxRU.js';
import 'zod';
import '../../../../chunks/types.js-CLJf8dL7.js';

const GET = async ({ locals }) => {
  return json(await listConsent(locals.consent));
};
const POST = async ({ locals, request }) => {
  const body = await request.json().catch(() => null);
  const result = await postConsent(locals.consent, body);
  if (!result.ok) return json({ error: result.error }, { status: result.status });
  return json(result.body);
};

export { GET, POST };
//# sourceMappingURL=_server.ts.js-CJrHXd8o.js.map
