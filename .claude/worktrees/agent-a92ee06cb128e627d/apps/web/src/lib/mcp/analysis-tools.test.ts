/**
 * Load / bests / time-trial MCP tools (spec 079) — invoked with a mock store.
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStore } from '$lib/server/store/memory';
import { fixedClock } from '$lib/server/clock';
import type { SettingsRepo, UserSettings } from '$lib/server/repo/types';
import type { ActivitySummary, LocalStore } from '$lib/server/store/types';
import { addDays } from '$lib/date';
import { MIN_HISTORY_DAYS } from '$lib/server/analytics/load-risk';
import {
  ANALYSIS_TOOLS,
  MAX_SERIES_POINTS,
  type AnalysisTool,
  type AnalysisToolDeps
} from './analysis-tools';

const USER = 'u1';
const TODAY = '2026-08-19';
const clock = fixedClock(new Date(`${TODAY}T18:00:00.000Z`));

function stubSettings(bag: UserSettings = {}): SettingsRepo {
  return {
    async get() {
      return bag;
    },
    async set() {
      /* no-op */
    }
  };
}

function deps(store: LocalStore = createMemoryStore()): AnalysisToolDeps {
  return { store, settings: stubSettings(), userId: USER, clock, timeZone: 'Europe/Warsaw' };
}

const tool = (name: string): AnalysisTool => {
  const found = ANALYSIS_TOOLS.find((t) => t.name === name);
  if (!found) throw new Error(`no tool ${name}`);
  return found;
};

function payload(result: { content: Array<{ text: string }> }): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text);
}

function act(id: string, day: string, over: Partial<ActivitySummary> = {}): ActivitySummary {
  return {
    userId: USER,
    activityId: id,
    sport: 'running',
    name: 'Bieg',
    startTime: `${day}T09:00:00Z`,
    startTimeLocal: `${day} 09:00:00`,
    distanceM: 10_000,
    durationS: 3000,
    movingS: 3000,
    elevationGainM: null,
    avgHr: 150,
    maxHr: 170,
    avgPower: null,
    maxPower: null,
    normPower: null,
    calories: null,
    trainingLoad: 60,
    hasGps: false,
    raw: {},
    ...over
  };
}

/** `days` days of daily running ending yesterday — enough continuous history for CTL to converge. */
async function history(store: LocalStore, days: number, load = 60): Promise<void> {
  const list: ActivitySummary[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(TODAY, -(days - i));
    list.push(act(`a-${i}`, day, { trainingLoad: load }));
  }
  await store.putActivities(USER, list);
}

describe('the tool surface', () => {
  it('exposes the last three tools from the coaching list', () => {
    expect(ANALYSIS_TOOLS.map((t) => t.name)).toEqual([
      'get_load_series',
      'get_personal_bests',
      'mark_as_time_trial'
    ]);
  });
});

describe('get_load_series', () => {
  it('says there is not enough history rather than reporting a confident zero', async () => {
    const store = createMemoryStore();
    await history(store, 5);

    const body = payload(await tool('get_load_series').handler(deps(store), {}));
    expect(String(body.message)).toContain('Not enough history');
    expect(body.acwr).toBeUndefined();
  });

  it('reports fitness, fatigue, form and the ratio directly', async () => {
    const store = createMemoryStore();
    await history(store, MIN_HISTORY_DAYS + 40);

    const body = payload(await tool('get_load_series').handler(deps(store), {}));
    expect(typeof body.fitnessCtl).toBe('number');
    expect(typeof body.fatigueAtl).toBe('number');
    expect(typeof body.formTsb).toBe('number');
    expect(body.acwr).not.toBeNull();
    expect(typeof body.advice).toBe('string');
    expect(body.to).toBe(TODAY);
  });

  it('downsamples a long window and says what interval it used', async () => {
    const store = createMemoryStore();
    await history(store, 400);

    const body = payload(await tool('get_load_series').handler(deps(store), { days: 365 }));
    const series = body.series as unknown[];
    expect(series.length).toBeLessThanOrEqual(MAX_SERIES_POINTS + 1);
    // A silent downsample would read as "that is every day I trained".
    expect(String(body.sampledEvery)).toMatch(/every \d+ days/);
  });

  it('keeps every day when the window is short enough to fit', async () => {
    const store = createMemoryStore();
    await history(store, MIN_HISTORY_DAYS + 40);

    const body = payload(await tool('get_load_series').handler(deps(store), { days: 30 }));
    expect(body.sampledEvery).toBe('every day');
  });

  it('names the sharpest rise in fatigue and the day it happened', async () => {
    const store = createMemoryStore();
    await history(store, MIN_HISTORY_DAYS + 40, 40);
    // One enormous session three days ago: the spike the coaching feedback asked to see directly.
    await store.putActivities(USER, [act('spike', addDays(TODAY, -3), { trainingLoad: 600 })]);

    const body = payload(await tool('get_load_series').handler(deps(store), { days: 60 }));
    const jump = body.biggestJump as { day: string; delta: number };
    expect(jump.day).toBe(addDays(TODAY, -3));
    expect(jump.delta).toBeGreaterThan(0);
  });
});

describe('get_personal_bests', () => {
  it('says there is nothing stored yet rather than implying the athlete has no bests', async () => {
    const body = payload(await tool('get_personal_bests').handler(deps(), {}));
    expect(body.count).toBe(0);
    expect(String(body.message)).toContain('No stored best efforts');
  });

  it('returns each distance with its time, pace and the session that set it', async () => {
    const store = createMemoryStore();
    await store.putActivities(USER, [act('a1', '2026-06-01', { name: 'Test 5 km' })]);
    await store.putActivityBestEfforts(USER, {
      activityId: 'a1',
      sport: 'running',
      day: '2026-06-01',
      version: 1,
      efforts: [
        {
          key: '5k',
          metres: 5000,
          durationS: 1200,
          actualM: 5000,
          paceSecPerKm: 240,
          startS: 0,
          samples: 300
        }
      ]
    });

    const body = payload(await tool('get_personal_bests').handler(deps(store), {}));
    expect(body.count).toBe(1);
    const first = (body.distances as Array<Record<string, unknown>>)[0]!;
    expect(first.key).toBe('5k');
    expect(first.best).toMatchObject({
      time: '20:00',
      pace: '4:00/km',
      day: '2026-06-01',
      activityId: 'a1'
    });
  });
});

describe('mark_as_time_trial', () => {
  /** A 5 km covered at an even 4:00/km, as a distance/time stream the effort finder can read. */
  async function seedFiveK(store: LocalStore, day = '2026-08-18'): Promise<void> {
    await store.putActivities(USER, [
      act('tt', day, { distanceM: 5000, durationS: 1200, movingS: 1200, name: 'Test 5 km' })
    ]);
    const time: number[] = [];
    const distance: number[] = [];
    for (let i = 0; i <= 1200; i += 10) {
      time.push(i);
      distance.push(i * (5000 / 1200));
    }
    await store.putStreams(USER, 'tt', { time, speed: distance.map(() => 5000 / 1200) });
  }

  it('errors on an unknown activity', async () => {
    const result = await tool('mark_as_time_trial').handler(deps(), {
      activityId: 'nope',
      distanceM: 5000
    });
    expect(result.isError).toBe(true);
  });

  it('says which distances a session DOES hold when the asked-for one is missing', async () => {
    const store = createMemoryStore();
    // A short run: no 5 km inside it at all.
    await store.putActivities(USER, [act('short', '2026-08-18', { distanceM: 2000, durationS: 600 })]);

    const result = await tool('mark_as_time_trial').handler(deps(store), {
      activityId: 'short',
      distanceM: 5000
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toMatch(/no 5000 m|no measurable efforts/);
  });

  it('proposes without writing by default', async () => {
    const store = createMemoryStore();
    await seedFiveK(store);
    const d = deps(store);
    await store.createBlock(USER, {
      id: 'tb1',
      goalId: null,
      name: 'Baza',
      startDay: '2026-08-17',
      weeks: 8,
      paces: { easy: { lowS: 400, highS: 420 } },
      constraints: [],
      note: null,
      createdAt: '2026-08-15T09:00:00.000Z'
    });

    const body = payload(await tool('mark_as_time_trial').handler(d, { activityId: 'tt', distanceM: 5000 }));

    expect(body.applied).toBe(false);
    // The model is named with the numbers, so nobody reads them as measurements.
    expect(body.model).toBe('riegel-5k-offsets');
    expect(body.wouldUpdate).toMatchObject({ id: 'tb1' });
    // …and nothing was actually written.
    expect((await store.getBlock(USER, 'tb1'))?.paces).toEqual({ easy: { lowS: 400, highS: 420 } });
  });

  it('writes the bands with apply: true and hands back what they replaced', async () => {
    const store = createMemoryStore();
    await seedFiveK(store);
    const d = deps(store);
    await store.createBlock(USER, {
      id: 'tb1',
      goalId: null,
      name: 'Baza',
      startDay: '2026-08-17',
      weeks: 8,
      paces: { easy: { lowS: 400, highS: 420 } },
      constraints: [],
      note: null,
      createdAt: '2026-08-15T09:00:00.000Z'
    });

    const body = payload(
      await tool('mark_as_time_trial').handler(d, {
        activityId: 'tt',
        distanceM: 5000,
        apply: true
      })
    );

    expect(body.applied).toBe(true);
    // The change is reversible because the caller can see exactly what it replaced.
    expect(body.previous).toEqual({ easy: { lowS: 400, highS: 420 } });

    const stored = (await store.getBlock(USER, 'tb1'))?.paces;
    expect(stored?.threshold).toBeDefined();
    expect(stored?.easy?.lowS).not.toBe(400);
  });

  it('refuses to apply when no block covers that day', async () => {
    const store = createMemoryStore();
    await seedFiveK(store);

    const result = await tool('mark_as_time_trial').handler(deps(store), {
      activityId: 'tt',
      distanceM: 5000,
      apply: true
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('no pace bands to update');
  });

  it('still proposes when there is no block, and says why it cannot store them', async () => {
    const store = createMemoryStore();
    await seedFiveK(store);

    const body = payload(
      await tool('mark_as_time_trial').handler(deps(store), { activityId: 'tt', distanceM: 5000 })
    );
    expect(body.applied).toBe(false);
    expect(body.paces).toBeDefined();
    expect(String(body.next)).toContain('No training block covers that day');
  });
});
