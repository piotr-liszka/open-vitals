import { a as safeEqual } from "./crypto.js";
import { c as codeChallengeS256 } from "./pkce.js";
import { A as AuthExchangeError } from "./types2.js";
const OAUTH_COOKIES = {
  state: "gb_oauth_state",
  nonce: "gb_oauth_nonce",
  verifier: "gb_oauth_verifier"
};
const OAUTH_TX_MAX_AGE = 600;
function safeLocation() {
  return "/";
}
async function beginLogin(container, redirectUri) {
  const { auth, random, session, repo } = container;
  if (auth.kind === "mock") {
    const identity = await auth.exchange({ code: "", codeVerifier: "", redirectUri, expectedNonce: "" });
    const user = await repo.users.upsertFromIdentity(identity);
    const id = await session.issue(user.id);
    return {
      kind: "session",
      location: safeLocation(),
      session: { id, cookieName: session.cookieName, maxAge: session.maxAgeSeconds }
    };
  }
  const state = random.token(24);
  const nonce = random.token(24);
  const codeVerifier = random.token(32);
  const location = await auth.authorizeUrl({
    state,
    nonce,
    codeChallenge: codeChallengeS256(codeVerifier),
    redirectUri
  });
  return { kind: "redirect", location, transaction: { state, nonce, codeVerifier } };
}
async function completeCallback(container, input) {
  const { auth, session, repo } = container;
  const { transaction } = input;
  if (!transaction || !transaction.state || !transaction.codeVerifier) {
    return { ok: false, status: 400, error: "Sesja logowania wygasła. Spróbuj ponownie." };
  }
  if (!input.code) {
    return { ok: false, status: 400, error: "Brak kodu autoryzacji." };
  }
  if (!input.state || !safeEqual(input.state, transaction.state)) {
    return { ok: false, status: 400, error: "Nieprawidłowy stan logowania. Spróbuj ponownie." };
  }
  let user;
  try {
    const identity = await auth.exchange({
      code: input.code,
      codeVerifier: transaction.codeVerifier,
      redirectUri: input.redirectUri,
      expectedNonce: transaction.nonce
    });
    user = await repo.users.upsertFromIdentity(identity);
  } catch (err) {
    if (err instanceof AuthExchangeError) {
      return { ok: false, status: 401, error: "Nie udało się zweryfikować logowania Google." };
    }
    throw err;
  }
  const id = await session.issue(user.id);
  return {
    ok: true,
    location: safeLocation(),
    session: { id, cookieName: session.cookieName, maxAge: session.maxAgeSeconds }
  };
}
async function logout(container, sessionId) {
  if (sessionId) await container.session.destroy(sessionId);
}
export {
  OAUTH_COOKIES as O,
  OAUTH_TX_MAX_AGE as a,
  beginLogin as b,
  completeCallback as c,
  logout as l
};
