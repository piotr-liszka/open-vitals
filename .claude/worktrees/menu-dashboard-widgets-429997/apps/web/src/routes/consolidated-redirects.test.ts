/**
 * Spec 048 folded two top-level pages away: `Analityka` into `Wnioski`, and `Mapa ciepła` into the
 * activities section. Both keep a permanent redirect so bookmarks, shared links and anything an MCP
 * client stored do not 404 — and both must carry their query across, or a shared link silently lands
 * on a different view than the one that was shared.
 */
import { describe, it, expect } from 'vitest';
import { GET as analyticsGet } from './analytics/+server';
import { GET as heatmapGet } from './heatmap/+server';

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

describe('/heatmap → /activities/mapa', () => {
  it('redirects permanently', () => {
    const r = redirectOf(heatmapGet as never, 'http://x/heatmap');
    expect(r.status).toBe(308);
    expect(r.location).toBe('/activities/mapa');
  });

  it('keeps the sport and year filters', () => {
    const r = redirectOf(heatmapGet as never, 'http://x/heatmap?sport=cycling&year=2025');
    expect(r.location).toBe('/activities/mapa?sport=cycling&year=2025');
  });
});
