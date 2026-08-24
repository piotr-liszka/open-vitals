/**
 * Spec 048 folded two top-level pages away: `Analityka` into `Wnioski`, and `Mapa ciepła` into the
 * activities section. Both keep a permanent redirect so bookmarks, shared links and anything an MCP
 * client stored do not 404 — and both must carry their query across, or a shared link silently lands
 * on a different view than the one that was shared.
 */
import { describe, it, expect } from 'vitest';
import { GET as analyticsGet } from './analytics/+server';
import { GET as heatmapGet } from './heatmap/+server';
import { GET as objetoscGet } from './training/objetosc/+server';
import { GET as biegGet } from './training/bieg/+server';
import { GET as marszGet } from './training/marsz/+server';
import { GET as rowerGet } from './training/rower/+server';
import { GET as celeGet } from './training/cele/+server';
import { GET as mapaGet } from './activities/mapa/+server';

/** Invoke a redirect handler and return the thrown SvelteKit redirect. */
function redirectOf(handler: (event: never) => unknown, url: string): { status?: number; location?: string } {
  let thrown: { status?: number; location?: string } | undefined;
  try {
    handler({ url: new URL(url) } as never);
  } catch (e) {
    thrown = e as { status?: number; location?: string };
  }
  expect(thrown).toBeDefined();
  return thrown!;
}

describe('/analytics → /insights', () => {
  it('redirects permanently', () => {
    const r = redirectOf(analyticsGet as never, 'http://x/analytics');
    expect(r.status).toBe(308);
    expect(r.location).toBe('/insights');
  });

  it('keeps the range, so a shared year-long link stays a year long', () => {
    const r = redirectOf(analyticsGet as never, 'http://x/analytics?range=365');
    expect(r.location).toBe('/insights?range=365');
  });

  it('encodes a hand-typed range rather than splicing it in raw', () => {
    const r = redirectOf(analyticsGet as never, 'http://x/analytics?range=a%20b');
    expect(r.location).toBe('/insights?range=a%20b');
  });
});

describe('/heatmap → /activities/map', () => {
  it('redirects permanently', () => {
    const r = redirectOf(heatmapGet as never, 'http://x/heatmap');
    expect(r.status).toBe(308);
    expect(r.location).toBe('/activities/map');
  });

  it('keeps the sport and year filters', () => {
    const r = redirectOf(heatmapGet as never, 'http://x/heatmap?sport=cycling&year=2025');
    expect(r.location).toBe('/activities/map?sport=cycling&year=2025');
  });
});

/**
 * Spec 070 rewrote every route segment into English. Six paths moved at once, and each keeps a 308 —
 * these were live URLs in the nav for dozens of specs, so bookmarks and MCP-stored links exist.
 */
describe('Polish route segments → English', () => {
  const MOVED: ReadonlyArray<[string, (e: never) => unknown, string, string]> = [
    ['volume', objetoscGet, '/training/objetosc', '/training/volume'],
    ['run', biegGet, '/training/bieg', '/training/run'],
    ['walk', marszGet, '/training/marsz', '/training/walk'],
    ['ride', rowerGet, '/training/rower', '/training/ride'],
    ['goals', celeGet, '/training/cele', '/training/goals'],
    ['map', mapaGet, '/activities/mapa', '/activities/map']
  ];

  for (const [name, handler, from, to] of MOVED) {
    it(`${from} redirects permanently to ${to}`, () => {
      const r = redirectOf(handler, `http://x${from}`);
      expect(r.status).toBe(308);
      expect(r.location).toBe(to);
    });

    it(`${name} carries the query across, so a shared filtered link stays filtered`, () => {
      const r = redirectOf(handler, `http://x${from}?range=365&sport=running`);
      expect(r.location).toBe(`${to}?range=365&sport=running`);
    });
  }
});
