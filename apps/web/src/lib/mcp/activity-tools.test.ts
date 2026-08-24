/**
 * Activity-detail MCP tools (spec 077) — invoked with a mock store, asserting the shape a model
 * reads. The fixture is the coach's own example: a session named "VO2 Max" that is 5×800 inside.
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStore } from '$lib/server/store/memory';
import type { SettingsRepo, UserSettings } from '$lib/server/repo/types';
import type { ActivityLap, ActivitySummary, LocalStore } from '$lib/server/store/types';
import { ACTIVITY_TOOLS, LAP_CAP, type ActivityTool, type ActivityToolDeps } from './activity-tools';

const USER = 'u1';
const DAY = '2026-08-13';

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

function deps(store: LocalStore): ActivityToolDeps {
  return { store, settings: stubSettings(), userId: USER };
}

const tool = (name: string): ActivityTool => {
  const found = ACTIVITY_TOOLS.find((t) => t.name === name);
  if (!found) throw new Error(`no tool ${name}`);
  return found;
};

function payload(result: { content: Array<{ text: string }> }): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text);
}

function act(over: Partial<ActivitySummary> = {}): ActivitySummary {
  return {
    userId: USER,
    activityId: 'a1',
    sport: 'running',
    name: 'VO2 Max',
    startTime: `${DAY}T07:00:00Z`,
    startTimeLocal: `${DAY} 09:00:00`,
    distanceM: 7270,
    durationS: 2480, // 7.27 km in 41:20 → 5:41/km, the coach's example
    movingS: 2480,
    elevationGainM: 40,
    avgHr: 144,
    maxHr: 178,
    avgPower: null,
    maxPower: null,
    normPower: null,
    calories: 520,
    trainingLoad: 90,
    hasGps: true,
    garminWorkoutId: null,
    raw: {
      averageRunningCadenceInStepsPerMinute: 172,
      avgStrideLength: 118.5,
      avgGroundContactTime: 254,
      avgVerticalOscillation: 9.4,
      avgTemperature: 29.6
    },
    ...over
  };
}

/** One work rep + its recovery, the shape an interval session actually stores. */
function lap(index: number, over: Partial<ActivityLap> = {}): ActivityLap {
  return {
    index,
    distanceM: 800,
    durationS: 188, // 3:55/km
    avgHr: 168,
    maxHr: 178,
    avgRunCadenceSpm: 184,
    avgStrideLengthCm: 132,
    ...over
  };
}

/** The coach's session: five 800s with recoveries between them. */
async function seedIntervals(store: LocalStore): Promise<void> {
  await store.putActivities(USER, [act()]);
  const laps: ActivityLap[] = [];
  for (let rep = 0; rep < 5; rep++) {
    laps.push(lap(laps.length + 1, { intensityType: 'ACTIVE' }));
    laps.push(
      lap(laps.length + 2, {
        distanceM: 400,
        durationS: 180,
        avgHr: 140,
        avgRunCadenceSpm: 160,
        intensityType: 'REST'
      })
    );
  }
  await store.putStreams(USER, 'a1', { laps });
}

describe('the tool surface', () => {
  it('exposes the detail tool and the way to find an id for it', () => {
    expect(ACTIVITY_TOOLS.map((t) => t.name)).toEqual(['get_activity_detail', 'list_activities']);
  });
});

describe('get_activity_detail', () => {
  it("errors on an id that is not this athlete's", async () => {
    const result = await tool('get_activity_detail').handler(deps(createMemoryStore()), {
      activityId: 'nope'
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('nope');
  });

  it('returns every lap with its own pace, so 5×800 is visible at all', async () => {
    const store = createMemoryStore();
    await seedIntervals(store);

    const body = payload(await tool('get_activity_detail').handler(deps(store), { activityId: 'a1' }));
    const laps = body.laps as Array<Record<string, unknown>>;

    expect(laps).toHaveLength(10);
    // The work reps: 800 m at 3:55/km, which the session average of 5:41/km completely hides.
    expect(laps[0]).toMatchObject({
      index: 1,
      distanceM: 800,
      durationS: 188,
      paceSecPerKm: 235,
      pace: '3:55/km',
      avgHr: 168,
      avgCadenceSpm: 184,
      intensityType: 'ACTIVE'
    });
    // …and the recoveries are distinguishable without inferring anything from lap length.
    expect(laps[1]).toMatchObject({ intensityType: 'REST', avgHr: 140 });
  });

  it('carries the three numbers that change how the run is read', async () => {
    const store = createMemoryStore();
    await seedIntervals(store);

    const body = payload(await tool('get_activity_detail').handler(deps(store), { activityId: 'a1' }));
    expect(body.dynamics).toMatchObject({
      avgCadenceSpm: 172, // against a prescribed 175–180
      avgStrideLengthCm: 118.5, // overstriding warning with a knee history
      avgGroundContactTimeMs: 254,
      avgVerticalOscillationCm: 9.4,
      temperatureC: 29.6 // 5:26/km at 30 °C is a different run from the same pace at 8 °C
    });
  });

  it('reports the session summary with its pace already converted', async () => {
    const store = createMemoryStore();
    await seedIntervals(store);

    const body = payload(await tool('get_activity_detail').handler(deps(store), { activityId: 'a1' }));
    expect(body.activity).toMatchObject({
      id: 'a1',
      day: DAY,
      name: 'VO2 Max',
      sport: 'Run',
      distanceM: 7270,
      pace: '5:41/km',
      avgHr: 144
    });
  });

  it('says an activity has no laps rather than returning a bare empty array', async () => {
    const store = createMemoryStore();
    await store.putActivities(USER, [act()]);

    const body = payload(await tool('get_activity_detail').handler(deps(store), { activityId: 'a1' }));
    expect(body.laps).toEqual([]);
    expect(String(body.lapsNote)).toContain('no recorded laps');
  });

  it('caps the laps and SAYS how many it dropped', async () => {
    const store = createMemoryStore();
    await store.putActivities(USER, [act({ sport: 'lap_swimming' })]);
    const laps = Array.from({ length: LAP_CAP + 15 }, (_, i) => lap(i + 1));
    await store.putStreams(USER, 'a1', { laps });

    const body = payload(await tool('get_activity_detail').handler(deps(store), { activityId: 'a1' }));
    expect((body.laps as unknown[]).length).toBe(LAP_CAP);
    // A silent truncation would read as "that was the whole session".
    expect(body.lapsTruncated).toBe(15);
    expect(String(body.lapsNote)).toContain('15 more not shown');
  });

  it('omits a lap pace it cannot honestly compute', async () => {
    const store = createMemoryStore();
    await store.putActivities(USER, [act()]);
    // A lap with a duration but no distance: a speed field alone must not become a confident pace.
    await store.putStreams(USER, 'a1', {
      laps: [{ index: 1, durationS: 300, avgSpeedMps: 3.2, avgHr: 150 }]
    });

    const body = payload(await tool('get_activity_detail').handler(deps(store), { activityId: 'a1' }));
    const first = (body.laps as Array<Record<string, unknown>>)[0]!;
    expect('pace' in first).toBe(false);
    expect(first.avgHr).toBe(150);
  });

  it('brings the logged RPE back with the splits it should be read against', async () => {
    const store = createMemoryStore();
    await seedIntervals(store);
    await store.putJournalEntry(USER, {
      id: 'j1',
      day: DAY,
      activityId: 'a1',
      rpe: 9,
      note: 'trzecie powtórzenie rozpadło się',
      at: `${DAY}T18:00:00.000Z`
    });

    const body = payload(await tool('get_activity_detail').handler(deps(store), { activityId: 'a1' }));
    expect(body.subjective).toEqual({ rpe: 9, note: 'trzecie powtórzenie rozpadło się' });
  });

  it('leaves the subjective block out when nothing was logged', async () => {
    const store = createMemoryStore();
    await seedIntervals(store);

    const body = payload(await tool('get_activity_detail').handler(deps(store), { activityId: 'a1' }));
    expect('subjective' in body).toBe(false);
  });
});

describe('list_activities', () => {
  it('lists newest first with paces converted', async () => {
    const store = createMemoryStore();
    await store.putActivities(USER, [
      act({ activityId: 'a1', startTimeLocal: '2026-08-13 09:00:00' }),
      act({ activityId: 'a2', startTimeLocal: '2026-08-15 09:00:00', name: 'Spokojny' })
    ]);

    const body = payload(await tool('list_activities').handler(deps(store), {}));
    expect(body.count).toBe(2);
    const list = body.activities as Array<Record<string, unknown>>;
    expect(list[0]).toMatchObject({ id: 'a2', day: '2026-08-15', pace: '5:41/km' });
    expect(list[1]).toMatchObject({ id: 'a1', day: '2026-08-13' });
  });

  it('honours the day range and the sport filter', async () => {
    const store = createMemoryStore();
    await store.putActivities(USER, [
      act({ activityId: 'a1', startTimeLocal: '2026-08-13 09:00:00' }),
      act({ activityId: 'a2', startTimeLocal: '2026-08-15 09:00:00', sport: 'cycling' })
    ]);

    const ranged = payload(
      await tool('list_activities').handler(deps(store), { from: '2026-08-14', to: '2026-08-16' })
    );
    expect(ranged.count).toBe(1);

    const bySport = payload(await tool('list_activities').handler(deps(store), { sport: 'running' }));
    expect((bySport.activities as Array<Record<string, unknown>>)[0]).toMatchObject({ id: 'a1' });
  });

  it("never leaks another athlete's sessions", async () => {
    const store = createMemoryStore();
    await store.putActivities('someone-else', [act({ activityId: 'theirs' })]);

    const body = payload(await tool('list_activities').handler(deps(store), {}));
    expect(body.count).toBe(0);
  });
});
