/**
 * Cosmetic-only User-Agent → human label (spec 094). A handful of substring checks for common
 * browser/OS names, falling back to the raw string. Deliberately not a dependency — this repo has
 * none for UA parsing, and the display is for "which of my own devices is this", not a security
 * decision or analytics.
 */
export function describeUserAgent(ua: string | null | undefined): string {
  if (!ua || ua.trim() === '') return 'Unknown device';

  const browser = browserOf(ua);
  const os = osOf(ua);

  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser;
  if (os) return os;
  return ua;
}

function browserOf(ua: string): string | null {
  // Order matters: Edge/Chromium-based browsers include "Safari" and "Chrome" tokens too.
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua) || /Opera/.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
  return null;
}

function osOf(ua: string): string | null {
  // Checked BEFORE "Mac OS X": an iPhone UA embeds the literal string "like Mac OS X".
  if (/iPhone|iPad|iOS/.test(ua)) return 'iOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Linux/.test(ua)) return 'Linux';
  return null;
}
