import { j as json } from '../../../../chunks/utils.js-D6eaf5bT.js';
import { l as logout } from '../../../../chunks/auth.api.js-Dc9FwDsy.js';
import '../../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../../chunks/uneval.js-BnYgIxRU.js';
import '../../../../chunks/crypto.js-CdmV8EtA.js';
import 'node:crypto';
import '../../../../chunks/pkce.js-C0gQeWNp.js';
import '../../../../chunks/types2.js-D2i6RnIR.js';

const POST = async ({ locals, cookies }) => {
  const cookieName = locals.container.session.cookieName;
  await logout(locals.container, cookies.get(cookieName));
  cookies.delete(cookieName, { path: "/" });
  return json({ ok: true });
};

export { POST };
//# sourceMappingURL=_server.ts.js-n_igEaV-.js.map
