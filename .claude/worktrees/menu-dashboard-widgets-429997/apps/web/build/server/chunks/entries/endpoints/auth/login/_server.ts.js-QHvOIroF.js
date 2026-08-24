import { M as redirect } from '../../../../chunks/utils.js-D6eaf5bT.js';
import { b as beginLogin, O as OAUTH_COOKIES, a as OAUTH_TX_MAX_AGE } from '../../../../chunks/auth.api.js-Dc9FwDsy.js';
import '../../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../../chunks/uneval.js-BnYgIxRU.js';
import '../../../../chunks/crypto.js-CdmV8EtA.js';
import 'node:crypto';
import '../../../../chunks/pkce.js-C0gQeWNp.js';
import '../../../../chunks/types2.js-D2i6RnIR.js';

const GET = async ({ locals, cookies, url }) => {
  const redirectUri = `${locals.container.config.publicBaseUrl}/auth/callback`;
  const result = await beginLogin(locals.container, redirectUri);
  const secure = locals.container.config.isProd || url.protocol === "https:";
  if (result.kind === "session") {
    cookies.set(result.session.cookieName, result.session.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure,
      maxAge: result.session.maxAge
    });
    throw redirect(303, result.location);
  }
  const opts = { path: "/", httpOnly: true, sameSite: "lax", secure, maxAge: OAUTH_TX_MAX_AGE };
  cookies.set(OAUTH_COOKIES.state, result.transaction.state, opts);
  cookies.set(OAUTH_COOKIES.nonce, result.transaction.nonce, opts);
  cookies.set(OAUTH_COOKIES.verifier, result.transaction.codeVerifier, opts);
  throw redirect(302, result.location);
};

export { GET };
//# sourceMappingURL=_server.ts.js-QHvOIroF.js.map
