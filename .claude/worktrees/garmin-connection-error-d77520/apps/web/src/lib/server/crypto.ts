/** Small crypto helpers. */
import { timingSafeEqual } from 'node:crypto';

/** Constant-time string comparison (avoids leaking the shared password via timing). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
