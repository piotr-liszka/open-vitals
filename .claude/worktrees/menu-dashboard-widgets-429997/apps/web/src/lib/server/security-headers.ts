/**
 * Security response headers (defense-in-depth). Pure function so it is unit-testable and free of
 * env/framework coupling (AGENTS.md §2 rule 4). Applied to every SvelteKit response in
 * hooks.server.ts and to the custom /mcp responses in server.js.
 *
 * CSP itself is configured via SvelteKit's `kit.csp` (svelte.config.js) so it can hash/nonce the
 * framework's inline bootstrap; the headers here cover the rest of the hardening surface.
 */
export interface SecurityHeaderInput {
  /** Emit HSTS only when the connection is (or will be terminated as) HTTPS. */
  https: boolean;
}

export function securityHeaders(input: SecurityHeaderInput): Record<string, string> {
  const headers: Record<string, string> = {
    // Stop MIME-sniffing responses into an executable type.
    'X-Content-Type-Options': 'nosniff',
    // No framing — clickjacking guard (belt-and-suspenders with CSP frame-ancestors).
    'X-Frame-Options': 'DENY',
    // Don't leak full URLs (which may carry an MCP token) to other origins.
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Turn off powerful features the app never uses.
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    // Isolate our browsing context.
    'Cross-Origin-Opener-Policy': 'same-origin',
    'X-DNS-Prefetch-Control': 'off'
  };
  if (input.https) {
    // One year, include subdomains. Only meaningful (and only sent) over HTTPS.
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }
  return headers;
}
