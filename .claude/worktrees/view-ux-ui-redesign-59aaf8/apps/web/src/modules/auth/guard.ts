/**
 * Pure route-guard decision (spec 012). Kept separate from hooks so it is unit-testable without a
 * container or env. Public: /login, /auth/**, /mcp**, /styleguide, and GET /api/health.
 */
export type GuardDecision =
  { action: 'allow' } | { action: 'redirect'; to: string } | { action: 'unauthorized' };

const PUBLIC_PAGES = new Set(['/', '/login']);
const PUBLIC_APIS = new Set(['/api/health']);

export function isPublicPath(path: string): boolean {
  const isApi = path.startsWith('/api/');
  return (
    (isApi ? PUBLIC_APIS.has(path) : PUBLIC_PAGES.has(path)) ||
    path.startsWith('/auth/') ||
    // Exact/segment matches only — a broad prefix would silently expose a future
    // /mcp-admin or /styleguide-internal route (security review finding).
    path === '/mcp' ||
    path === '/styleguide' ||
    path.startsWith('/styleguide/')
  );
}

export function authGuard(input: {
  authenticated: boolean;
  path: string;
  routeMatched: boolean;
}): GuardDecision {
  if (input.authenticated || isPublicPath(input.path)) return { action: 'allow' };
  if (input.path.startsWith('/api/')) return { action: 'unauthorized' };
  // Only redirect matched page routes; let assets/unmatched requests pass through.
  return input.routeMatched ? { action: 'redirect', to: '/login' } : { action: 'allow' };
}
