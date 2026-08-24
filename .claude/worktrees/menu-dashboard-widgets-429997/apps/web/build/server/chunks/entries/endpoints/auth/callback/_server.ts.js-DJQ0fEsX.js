import { M as redirect } from '../../../../chunks/utils.js-D6eaf5bT.js';
import { O as OAUTH_COOKIES, c as completeCallback } from '../../../../chunks/auth.api.js-Dc9FwDsy.js';
import '../../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../../chunks/uneval.js-BnYgIxRU.js';
import '../../../../chunks/crypto.js-CdmV8EtA.js';
import 'node:crypto';
import '../../../../chunks/pkce.js-C0gQeWNp.js';
import '../../../../chunks/types2.js-D2i6RnIR.js';

const GET = async ({ locals, cookies, url }) => {
  const redirectUri = `${locals.container.config.publicBaseUrl}/auth/callback`;
  const tx = {
    state: cookies.get(OAUTH_COOKIES.state) ?? "",
    nonce: cookies.get(OAUTH_COOKIES.nonce) ?? "",
    codeVerifier: cookies.get(OAUTH_COOKIES.verifier) ?? ""
  };
  for (const name of Object.values(OAUTH_COOKIES)) cookies.delete(name, { path: "/" });
  const result = await completeCallback(locals.container, {
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
    redirectUri,
    transaction: tx.state ? tx : null
  });
  if (!result.ok) {
    throw redirect(303, `/login?error=${encodeURIComponent(result.error)}`);
  }
  cookies.set(result.session.cookieName, result.session.id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    // Always Secure in prod: internet-facing behind a TLS proxy, where Node may see http.
    secure: locals.container.config.isProd || url.protocol === "https:",
    maxAge: result.session.maxAge
  });
  throw redirect(303, result.location);
};

export { GET };
//# sourceMappingURL=_server.ts.js-DJQ0fEsX.js.map
