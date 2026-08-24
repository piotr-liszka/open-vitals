import { randomBytes, timingSafeEqual } from 'node:crypto';

function base64url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}
const systemRandom = {
  token: (byteLength = 32) => base64url(randomBytes(byteLength))
};
function safeEqual(a, b) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export { safeEqual as a, base64url as b, systemRandom as s };
//# sourceMappingURL=crypto.js-CdmV8EtA.js.map
