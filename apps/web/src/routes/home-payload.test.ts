/**
 * Spec 021: connection + MCP configuration moved off the start page into /settings. The MCP URL
 * embeds a secret token, so `/` must not even load it into the serialised page payload any more —
 * while /settings still does. Loader-level test with stub locals.
 */
import { describe, it, expect } from 'vitest';
import { createGarminMock } from '$lib/server/garmin/mock-adapter';
import { createMemoryStore } from '$lib/server/store/memory';
import { DEFAULT_TIME_ZONE } from '$lib/date';
import { load as loadHome } from './+page.server';

/**
 * The start page may read `clock`, `config` (app timezone, spec 018) and `store` (the local synced
 * data the timeline reads, spec 022). Anything else — `repo`, `mcpTokens`, … — means we reached for
 * a service that could mint or leak the MCP token, and the proxy fails the test on the spot.
 */
function containerStub() {
  const allowed = new Set(['clock', 'config', 'store']);
  return new Proxy(
    {
      clock: { now: () => new Date('2026-08-07T00:00:00Z') },
      config: { appTimeZone: DEFAULT_TIME_ZONE },
      store: createMemoryStore()
    },
    {
      get(target, prop) {
        if (allowed.has(String(prop))) return Reflect.get(target, prop);
        throw new Error(`container.${String(prop)} must not be used by the start page`);
      }
    }
  );
}

function homeLocals() {
  return {
    user: { id: 'user-1' },
    garmin: createGarminMock({ status: { authenticated: true, displayName: 'Ada' } }),
    container: containerStub()
  } as never;
}

function homeEvent(url = 'http://localhost/') {
  return { locals: homeLocals(), url: new URL(url) } as never;
}

describe('start page payload', () => {
  it('no mcpUrl in the payload and no token service touched', async () => {
    const data = (await loadHome(homeEvent())) as Record<string, unknown>;

    expect('mcpUrl' in data).toBe(false);
    expect(data.health).toMatchObject({ connected: true, reachable: true });
    expect(data.dashboard).toBeDefined();
    // Spec 022: the start page also carries the timeline, honestly empty on the forward half.
    expect(data.timeline).toMatchObject({
      today: '2026-08-07',
      planned: { status: 'not_synced', events: [] }
    });
  });

  it('carries the global range into the dashboard, falling back on junk (spec 028/035)', async () => {
    const dashboardOf = async (url: string) => {
      const data = (await loadHome(homeEvent(url))) as {
        dashboard: { range: { key: string; bucket: string }; days: string[] };
      };
      return data.dashboard;
    };

    const wide = await dashboardOf('http://localhost/?range=30');
    expect(wide.range.key).toBe('30');
    expect(wide.days).toHaveLength(30);

    // A year buckets weekly rather than shipping 365 points per tile.
    const year = await dashboardOf('http://localhost/?range=365');
    expect(year.range.bucket).toBe('week');
    expect(year.days).toHaveLength(53);

    // A hand-typed value never widens the window — it degrades to the default.
    expect((await dashboardOf('http://localhost/?range=999')).range.key).toBe('7');
  });

  it('carries the global range into the timeline too (spec 047)', async () => {
    const timelineOf = async (url: string) => {
      const data = (await loadHome(homeEvent(url))) as { timeline: { past: { from: string } } };
      return data.timeline;
    };
    expect((await timelineOf('http://localhost/?range=7')).past.from).toBe('2026-08-01');
    expect((await timelineOf('http://localhost/?range=30')).past.from).toBe('2026-07-09');
  });
});
