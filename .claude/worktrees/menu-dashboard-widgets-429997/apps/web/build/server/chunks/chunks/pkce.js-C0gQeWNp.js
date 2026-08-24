import { createHash } from 'node:crypto';
import { b as base64url } from './crypto.js-CdmV8EtA.js';

function codeChallengeS256(codeVerifier) {
  return base64url(createHash("sha256").update(codeVerifier).digest());
}

export { codeChallengeS256 as c };
//# sourceMappingURL=pkce.js-C0gQeWNp.js.map
