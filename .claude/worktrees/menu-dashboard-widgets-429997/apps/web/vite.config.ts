import { execFileSync } from 'node:child_process';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

/**
 * Short commit the bundle is built from, for the sidebar version stamp. Best-effort: a missing git,
 * a detached worktree or a source tarball must never fail a build, so any failure yields ''.
 */
function buildSha(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return '';
  }
}

// Dev-only HTTPS via a TLS-terminating reverse proxy (Tailscale Serve) in front of `vite dev`.
// The proxy owns the cert and forwards https/wss on the tailnet `.ts.net` host to http://…:3000,
// so Vite itself stays plain HTTP — matching the prod model where the app trusts x-forwarded-proto.
// Enabled only when DEV_HTTPS is set; plain `localhost` http dev is left completely untouched.
const devHttps = !!process.env.DEV_HTTPS;

export default defineConfig({
  plugins: [sveltekit()],
  // Stamp the moment this bundle was built (+ the commit) into the app. Rendered at the bottom of the
  // sidebar so it is obvious at a glance whether a deploy/rebuild actually picked up new code.
  // Vite replaces these literally at build time; under `vite dev` it is the dev-server start time.
  // The instant stays UTC here — the UI formats it into local time (spec 018).
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __BUILD_SHA__: JSON.stringify(buildSha())
  },
  ...(devHttps
    ? {
        server: {
          // Accept the Host header the proxy forwards (any tailnet MagicDNS name), which Vite's
          // host check would otherwise reject with "Blocked request. This host is not allowed."
          allowedHosts: ['.ts.net'],
          // The page is served over TLS on 443 by the proxy; tell the HMR client to reconnect
          // over wss on that public port instead of ws on the internal 3000.
          hmr: { protocol: 'wss', clientPort: 443 }
        }
      }
    : {}),
  // Under Vitest, resolve Svelte's browser build so component tests can `mount(...)`
  // in jsdom (Svelte 5 + @testing-library/svelte). No effect on `vite dev`/build.
  ...(process.env.VITEST ? { resolve: { conditions: ['browser'] } } : {}),
  test: {
    // Node-side unit + API-integration tests run in node; component tests opt into jsdom.
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    environmentMatchGlobs: [['src/**/*.svelte.{test,spec}.ts', 'jsdom']],
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/modules/**', 'src/lib/server/**', 'src/lib/mcp/**']
    }
  }
});
