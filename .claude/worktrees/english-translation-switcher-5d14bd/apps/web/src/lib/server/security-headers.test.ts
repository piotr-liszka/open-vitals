import { describe, it, expect } from 'vitest';
import { securityHeaders } from './security-headers';

describe('securityHeaders', () => {
  it('always sets the core hardening headers', () => {
    const h = securityHeaders({ https: false });
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['X-Frame-Options']).toBe('DENY');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['Permissions-Policy']).toContain('geolocation=()');
    expect(h['Cross-Origin-Opener-Policy']).toBe('same-origin');
  });

  it('omits HSTS on plain HTTP', () => {
    const h = securityHeaders({ https: false });
    expect(h['Strict-Transport-Security']).toBeUndefined();
  });

  it('sends HSTS over HTTPS', () => {
    const h = securityHeaders({ https: true });
    expect(h['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
  });
});
