import { describe, it, expect } from 'vitest';
import { loadRunning } from './running.api';
import { resolveRange } from '$lib/range';
import { createMemoryStore } from '$lib/server/store/memory';
import { createMemorySettingsRepo } from '$lib/server/repo/memory';
import { fixedClock } from '$lib/server/clock';
import { BEST_EFFORTS_VERSION, type ActivitySummary } from '$lib/server/store/types';

const clock = fixedClock(new Date('2026-08-09T12:00:00Z'));

function act(id: string, over: Partial<ActivitySummary>): ActivitySummary {
  return {
    userId: 'u',
    activityId: id,
    sport: 'running',
    name: null,
    startTime: '2026-08-01T07:00:00Z',
    startTimeLocal: '2026-08-01 07:00:00',
    distanceM: 5000,
    durationS: 1500,
    movingS: 1500,
    elevationGainM: 30,
    avgHr: 150,
    maxHr: 175,
    avgPower: null,
    maxPower: null,
    normPower: null,
    calories: 350,
    trainingLoad: 40,
    hasGps: false,
    garminWorkoutId: null,
    raw: {},
    ...over
  };
}

function deps() {
  const store = createMemoryStore();
  const settings = createMemorySettingsRepo();
  return { store, settings, clock };
}

describe('loadRunning', () => {
  it('filters to running activities and builds totals, bests, weekly, HR zones', async () => {
    const d = deps();
    await d.store.putActivities('u', [
      act('r1', {
        sport: 'running',
        startTimeLocal: '2026-08-04 07:00:00',
        distanceM: 10000,
        durationS: 3000,
        maxHr: 180
      }),
      act('r2', {
        sport: 'trail_running',
        startTimeLocal: '2026-08-05 07:00:00',
        distanceM: 5000,
        durationS: 1500
      }),
      act('c1', {
        sport: 'cycling',
        startTimeLocal: '2026-08-06 07:00:00',
        distanceM: 40000,
        durationS: 3600
      })
    ]);
    await d.store.putStreams('u', 'r1', { heartRate: [90, 120, 150, 170, 178], time: [0, 1, 2, 3, 4] });

    const data = await loadRunning(d, { userId: 'u' });
    expect(data.hasData).toBe(true);
    expect(data.totals.runs).toBe(2); // cycling excluded
    expect(data.totals.totalKm).toBe(15);
    expect(data.totals.longestKm).toBe(10);
    expect(data.weekly.length).toBeGreaterThan(0);
    expect(data.maxHr).toBe(180); // highest observed
    expect(data.hrZones.length).toBe(5); // aggregated from r1's stream
    expect(data.hrZones.reduce((s, z) => s + z.pct, 0)).toBeGreaterThan(0);
  });

  it('is empty for a user with no runs', async () => {
    const d = deps();
    await d.store.putActivities('u', [act('c1', { sport: 'cycling' })]);
    const data = await loadRunning(d, { userId: 'u' });
    expect(data.hasData).toBe(false);
    expect(data.totals.runs).toBe(0);
    expect(data.hrZones).toEqual([]);
  });

  it('derives the runner profile from the same runs (spec 033)', async () => {
    const d = deps();
    await d.store.putActivities('u', [
      act('r1', {
        sport: 'running',
        startTimeLocal: '2026-08-04 07:00:00',
        distanceM: 10000,
        durationS: 3000 // 5:00 /km
      }),
      act('c1', { sport: 'cycling', startTimeLocal: '2026-08-05 07:00:00' })
    ]);

    const { profile } = await loadRunning(d, { userId: 'u' });

    expect(profile.axes.map((a) => a.key)).toEqual(['speed', 'tempo', 'endurance', 'volume', 'consistency']);
    expect(profile.hasProfile).toBe(true);
    expect(profile.axes.find((a) => a.key === 'tempo')?.readout).toBe('5:00 /km');
    // One week of history: the training axes stay null rather than scoring a fresh account as lazy.
    expect(profile.axes.find((a) => a.key === 'volume')?.score).toBeNull();
    expect(profile.axes.find((a) => a.key === 'consistency')?.score).toBeNull();
    // Three defined axes are not enough to lean either way — but they are enough to be honest about.
    expect(profile.archetype.key).not.toBe('unknown');
  });

  it('returns an empty, honest profile for a user with no runs', async () => {
    const d = deps();
    const { profile } = await loadRunning(d, { userId: 'u' });
    expect(profile.hasProfile).toBe(false);
    expect(profile.definedCount).toBe(0);
    expect(profile.archetype.key).toBe('unknown');
    expect(profile.axes.every((a) => a.score === null)).toBe(true);
  });

  it('honours an explicit max-HR setting for zones', async () => {
    const d = deps();
    await d.settings.set('u', { maxHrBpm: 195 });
    await d.store.putActivities('u', [act('r1', { maxHr: 170 })]);
    await d.store.putStreams('u', 'r1', { heartRate: [140, 150, 160], time: [0, 1, 2] });
    const data = await loadRunning(d, { userId: 'u' });
    expect(data.maxHr).toBe(195);
  });

  describe('speed curve and critical speed (spec 042)', () => {
    it('builds the curve as an ENVELOPE across runs, not from one session', async () => {
      const d = deps();
      // One fast short run and one slow long run: the curve must take the best of each.
      await d.store.putActivities('u', [act('fast', {}), act('long', {})]);
      await d.store.putStreams('u', 'fast', { speed: new Array(400).fill(5) });
      await d.store.putStreams('u', 'long', { speed: new Array(2000).fill(3) });

      const { speedCurve } = await loadRunning(d, { userId: 'u' });
      expect(speedCurve.find((p) => p.durationS === 60)?.speedMps).toBeCloseTo(5, 2);
      expect(speedCurve.find((p) => p.durationS === 1800)?.speedMps).toBeCloseTo(3, 2);
      // Durations ascending, so a chart can plot it straight.
      const durations = speedCurve.map((p) => p.durationS);
      expect([...durations].sort((a, b) => a - b)).toEqual(durations);
    });

    it('estimates critical speed once the curve spans enough durations', async () => {
      const d = deps();
      await d.store.putActivities('u', [act('r1', {})]);
      // A fading effort: fast for the first 3 min, slower after — a real fatigue curve.
      await d.store.putStreams('u', 'r1', {
        speed: [...new Array(180).fill(5), ...new Array(1200).fill(3.5)]
      });

      const { criticalSpeed } = await loadRunning(d, { userId: 'u' });
      expect(criticalSpeed).not.toBeNull();
      expect(criticalSpeed!.speedMps).toBeGreaterThan(0);
      expect(criticalSpeed!.paceSecPerKm).toBeGreaterThan(0);
      expect(criticalSpeed!.fromDurationsS[1]).toBeGreaterThan(criticalSpeed!.fromDurationsS[0]);
    });

    it('has an empty curve and no critical speed with no speed streams', async () => {
      const d = deps();
      await d.store.putActivities('u', [act('r1', {})]);
      await d.store.putStreams('u', 'r1', { heartRate: [150, 150] });

      const data = await loadRunning(d, { userId: 'u' });
      expect(data.speedCurve).toEqual([]);
      expect(data.criticalSpeed).toBeNull();
    });

    it('has an empty curve for a user with no runs at all', async () => {
      const data = await loadRunning(deps(), { userId: 'u' });
      expect(data.speedCurve).toEqual([]);
      expect(data.criticalSpeed).toBeNull();
    });
  });

  describe('race predictions (spec 043)', () => {
    it('predicts from the athlete‘s own bests and says which one it used', async () => {
      const d = deps();
      // A 10 km run in 40 min gives a 10 km best to extrapolate the half from.
      await d.store.putActivities('u', [act('r1', { distanceM: 10_000, durationS: 2400, movingS: 2400 })]);

      const { predictions } = await loadRunning(d, { userId: 'u' });
      const half = predictions.find((p) => p.key === 'half')!;
      expect(half.riegelS).toBeGreaterThan(2400);
      expect(half.fromLabel).toBe('10 km');
      expect(half.confident).toBe(true);
    });

    it('omits a distance no best is close enough to', async () => {
      const d = deps();
      await d.store.putActivities('u', [act('r1', { distanceM: 5000, durationS: 1200, movingS: 1200 })]);

      const { predictions } = await loadRunning(d, { userId: 'u' });
      // From a 5 km best, the marathon is 8.4× away — beyond the limit and therefore absent.
      expect(predictions.some((p) => p.key === 'marathon')).toBe(false);
      expect(predictions.some((p) => p.key === '10k')).toBe(true);
    });

    it('adds the critical-speed estimate when the curve supports one', async () => {
      const d = deps();
      await d.store.putActivities('u', [act('r1', { distanceM: 10_000, durationS: 2400, movingS: 2400 })]);
      await d.store.putStreams('u', 'r1', {
        speed: [...new Array(180).fill(5), ...new Array(1200).fill(3.5)]
      });

      const { predictions, criticalSpeed } = await loadRunning(d, { userId: 'u' });
      expect(criticalSpeed).not.toBeNull();
      expect(predictions.some((p) => p.criticalSpeedS !== null)).toBe(true);
    });

    it('predicts nothing for a user with no runs', async () => {
      const { predictions } = await loadRunning(deps(), { userId: 'u' });
      expect(predictions).toEqual([]);
    });
  });
});

describe('loadRunning and the global range (spec 047)', () => {
  const TODAY = '2026-08-09';

  async function seeded() {
    const d = deps();
    await d.store.putActivities('u', [
      // Inside a 7-day window, and slower.
      act('recent', { startTimeLocal: '2026-08-08 07:00:00', distanceM: 5000, durationS: 1800 }),
      // Outside it, and the fastest run this account has ever done.
      act('old-pb', { startTimeLocal: '2026-01-10 07:00:00', distanceM: 5000, durationS: 1200 })
    ]);
    return d;
  }

  it('windows the totals and the mileage chart', async () => {
    const d = await seeded();

    const week = await loadRunning(d, { userId: 'u', range: resolveRange('7', TODAY) });
    expect(week.totals.runs).toBe(1);
    expect(week.hasWindowData).toBe(true);

    const year = await loadRunning(d, { userId: 'u', range: resolveRange('365', TODAY) });
    expect(year.totals.runs).toBe(2);
  });

  it('never windows the bests behind the race predictions — a PB is over a career', async () => {
    const d = await seeded();
    const week = await loadRunning(d, { userId: 'u', range: resolveRange('7', TODAY) });
    const year = await loadRunning(d, { userId: 'u', range: resolveRange('365', TODAY) });

    // The January run is the 5 km best in BOTH views, even though the 7-day window excludes it from
    // the totals above. The bests are internal since spec 054, so the prediction they feed is what
    // proves they are not windowed: a windowed "PB" would make the 7-day forecast slower.
    const tenK = (data: typeof week) => data.predictions.find((p) => p.key === '10k');
    expect(tenK(week)?.riegelS).toBe(tenK(year)?.riegelS);
    expect(tenK(week)?.fromLabel).toBe(tenK(year)?.fromLabel);
  });

  it('distinguishes an empty window from an empty account', async () => {
    const d = await seeded();
    // A window with no runs in it: the account still has runs, so the view can say which is true.
    const data = await loadRunning(d, { userId: 'u', range: resolveRange('7', '2026-06-01') });
    expect(data.hasData).toBe(true);
    expect(data.hasWindowData).toBe(false);
    expect(data.totals.runs).toBe(0);
    expect(data.predictions.length).toBeGreaterThan(0); // career-wide bests survive an empty window
  });

  it('buckets the mileage chart monthly for a long range', async () => {
    const d = await seeded();
    const all = await loadRunning(d, {
      userId: 'u',
      // Past 400 days the range buckets monthly; a five-year window would otherwise be ~280 bars.
      range: resolveRange('all', TODAY, '2024-01-01')
    });
    expect(all.range.bucket).toBe('month');
    expect(all.weekly.every((w) => w.week.endsWith('-01'))).toBe(true);
    expect(all.weekly.find((w) => w.week === '2026-01-01')!.km).toBe(5);
    expect(all.weekly.find((w) => w.week === '2026-08-01')!.km).toBe(5);
  });
});

/**
 * Predictions from MEASURED efforts, and the 90-day trend (spec 055). The clock is fixed at
 * 2026-08-09, so the as-of cutoff is deterministically 2026-05-11.
 */
describe('loadRunning race predictions from stored efforts (spec 055)', () => {
  const CUTOFF = '2026-05-11';

  async function seedEffort(
    store: ReturnType<typeof createMemoryStore>,
    userId: string,
    input: { id: string; day: string; durationS: number; runDurationS: number }
  ): Promise<void> {
    await store.putActivities(userId, [
      act(input.id, {
        userId,
        startTimeLocal: `${input.day} 07:00:00`,
        distanceM: 10_000,
        durationS: input.runDurationS,
        movingS: input.runDurationS
      })
    ]);
    await store.putStreams(userId, input.id, { speed: [3, 3], time: [0, 1] });
    await store.putActivityBestEfforts(userId, {
      activityId: input.id,
      sport: 'running',
      day: input.day,
      version: BEST_EFFORTS_VERSION,
      efforts: [
        {
          key: '10k',
          metres: 10_000,
          actualM: 10_000,
          durationS: input.durationS,
          paceSecPerKm: input.durationS / 10,
          startS: 0,
          samples: 600
        }
      ]
    });
  }

  it('prefers a measured effort over the even-pace projection of the same run', async () => {
    const d = deps();
    // The run took 45 min, but 40 min of it was a genuine 10 km effort: the projection would report
    // the slower number and call it a record.
    await seedEffort(d.store, 'u', { id: 'r1', day: '2026-07-01', durationS: 2400, runDurationS: 2700 });

    const { predictions } = await loadRunning(d, { userId: 'u' });
    const tenK = predictions.find((p) => p.key === '10k')!;
    expect(tenK.riegelS).toBe(2400);
    expect(tenK.fromBasis).toBe('measured');
  });

  it('falls back to the projection while the efforts backfill has not landed', async () => {
    const d = deps();
    await d.store.putActivities('u', [act('r1', { distanceM: 10_000, durationS: 2400, movingS: 2400 })]);

    const { predictions } = await loadRunning(d, { userId: 'u' });
    const tenK = predictions.find((p) => p.key === '10k')!;
    // The card is NOT blank: the projection still answers, and says that is what it is.
    expect(tenK.riegelS).toBe(2400);
    expect(tenK.fromBasis).toBe('projected');
  });

  it('reports how much faster the prediction has got since the cutoff', async () => {
    const d = deps();
    await seedEffort(d.store, 'u', { id: 'old', day: '2026-02-01', durationS: 2600, runDurationS: 2600 });
    await seedEffort(d.store, 'u', { id: 'new', day: '2026-07-01', durationS: 2400, runDurationS: 2400 });

    const { predictions } = await loadRunning(d, { userId: 'u' });
    const tenK = predictions.find((p) => p.key === '10k')!;
    expect(tenK.riegelS).toBe(2400);
    expect(tenK.trend).toEqual({ deltaS: 200, previousS: 2600, sinceDay: CUTOFF });
  });

  it('omits the trend rather than inventing a zero when there is no history before the cutoff', async () => {
    const d = deps();
    await seedEffort(d.store, 'u', { id: 'new', day: '2026-07-01', durationS: 2400, runDurationS: 2400 });

    const { predictions } = await loadRunning(d, { userId: 'u' });
    for (const p of predictions) expect(p.trend).toBeUndefined();
  });

  it('reports an honest zero when the athlete has not moved the number', async () => {
    const d = deps();
    await seedEffort(d.store, 'u', { id: 'old', day: '2026-02-01', durationS: 2400, runDurationS: 2400 });

    const { predictions } = await loadRunning(d, { userId: 'u' });
    expect(predictions.find((p) => p.key === '10k')!.trend?.deltaS).toBe(0);
  });

  it('excludes efforts set after the cutoff from the as-of half', async () => {
    const d = deps();
    // Exactly ON the cutoff counts as "before"; the day after does not.
    await seedEffort(d.store, 'u', { id: 'on', day: CUTOFF, durationS: 2600, runDurationS: 2600 });
    await seedEffort(d.store, 'u', { id: 'after', day: '2026-05-12', durationS: 2500, runDurationS: 2500 });

    const { predictions } = await loadRunning(d, { userId: 'u' });
    expect(predictions.find((p) => p.key === '10k')!.trend?.previousS).toBe(2600);
  });

  it('never lets another user’s efforts reach these predictions (AGENTS.md §2 rule 2)', async () => {
    const d = deps();
    await seedEffort(d.store, 'u', { id: 'mine', day: '2026-07-01', durationS: 2400, runDurationS: 2400 });
    // A far faster account, seeded at both ends of the cutoff so it would move BOTH the prediction
    // and its trend if isolation leaked.
    await seedEffort(d.store, 'other', {
      id: 'theirs-old',
      day: '2026-02-01',
      durationS: 1900,
      runDurationS: 1900
    });
    await seedEffort(d.store, 'other', {
      id: 'theirs-new',
      day: '2026-07-02',
      durationS: 1800,
      runDurationS: 1800
    });

    const mine = await loadRunning(d, { userId: 'u' });
    const tenK = mine.predictions.find((p) => p.key === '10k')!;
    expect(tenK.riegelS).toBe(2400);
    expect(tenK.trend).toBeUndefined();
    expect(mine.hasData).toBe(true);

    // …and the other account still sees its own numbers, trend included — proof the isolation is a
    // scoped query and not simply an empty read.
    const theirs = await loadRunning(d, { userId: 'other' });
    const theirTenK = theirs.predictions.find((p) => p.key === '10k')!;
    expect(theirTenK.riegelS).toBe(1800);
    expect(theirTenK.trend).toEqual({ deltaS: 100, previousS: 1900, sinceDay: CUTOFF });
  });
});

/**
 * The day-by-day history (spec 087). Same fixed clock (2026-08-09), so a resolved range has known
 * bounds and the assertions can count days rather than eyeball them.
 */
describe('loadRunning prediction history (spec 087)', () => {
  async function seedEffort(
    store: ReturnType<typeof createMemoryStore>,
    userId: string,
    input: { id: string; day: string; durationS: number }
  ): Promise<void> {
    await store.putActivities(userId, [
      act(input.id, {
        userId,
        startTimeLocal: `${input.day} 07:00:00`,
        distanceM: 10_000,
        durationS: input.durationS,
        movingS: input.durationS
      })
    ]);
    await store.putStreams(userId, input.id, { speed: [3, 3], time: [0, 1] });
    await store.putActivityBestEfforts(userId, {
      activityId: input.id,
      sport: 'running',
      day: input.day,
      version: BEST_EFFORTS_VERSION,
      efforts: [
        {
          key: '10k',
          metres: 10_000,
          actualM: 10_000,
          durationS: input.durationS,
          paceSecPerKm: input.durationS / 10,
          startS: 0,
          samples: 600
        }
      ]
    });
  }

  it('carries one value per day in the range, for every distance it can reach', async () => {
    const d = deps();
    await seedEffort(d.store, 'u', { id: 'r1', day: '2026-08-04', durationS: 2400 });

    const range = resolveRange('30', '2026-08-09');
    const { predictionHistory: history } = await loadRunning(d, { userId: 'u', range });

    expect(history).not.toBeNull();
    expect(history!.days).toHaveLength(range.days);
    expect(history!.days[0]).toBe(range.start);
    expect(history!.days.at(-1)).toBe(range.end);
    expect(history!.distances.length).toBeGreaterThan(0);
    for (const distance of history!.distances) {
      expect(distance.values).toHaveLength(range.days);
    }
  });

  it('follows the global range, like the rest of the page', async () => {
    const d = deps();
    await seedEffort(d.store, 'u', { id: 'r1', day: '2026-06-01', durationS: 2400 });

    const week = await loadRunning(d, { userId: 'u', range: resolveRange('7', '2026-08-09') });
    const month = await loadRunning(d, { userId: 'u', range: resolveRange('30', '2026-08-09') });
    expect(week.predictionHistory!.days).toHaveLength(7);
    expect(month.predictionHistory!.days).toHaveLength(30);
  });

  it('is null when the athlete has no measured efforts at all', async () => {
    const d = deps();
    // Runs, and therefore predictions from even-pace projections — but nothing measured to draw.
    await d.store.putActivities('u', [act('r1', { distanceM: 10_000, durationS: 2400, movingS: 2400 })]);

    const data = await loadRunning(d, { userId: 'u', range: resolveRange('30', '2026-08-09') });
    expect(data.predictions.length).toBeGreaterThan(0);
    expect(data.predictionHistory).toBeNull();
  });

  it('is null for a user with nothing synced', async () => {
    const data = await loadRunning(deps(), { userId: 'u' });
    expect(data.predictionHistory).toBeNull();
  });

  it('steps the line on the day a record lands, and agrees with the card on the last day', async () => {
    const d = deps();
    await seedEffort(d.store, 'u', { id: 'old', day: '2026-07-20', durationS: 2600 });
    await seedEffort(d.store, 'u', { id: 'new', day: '2026-08-05', durationS: 2400 });

    const range = resolveRange('30', '2026-08-09');
    const data = await loadRunning(d, { userId: 'u', range });
    const tenK = data.predictionHistory!.distances.find((x) => x.key === '10k')!;
    const at = (day: string): number | null => tenK.values[data.predictionHistory!.days.indexOf(day)] ?? null;

    expect(at('2026-08-04')).toBe(2600);
    expect(at('2026-08-05')).toBe(2400);
    // The last day of the history is today, and matches what the card prints for the same distance.
    expect(tenK.values.at(-1)).toBe(data.predictions.find((p) => p.key === '10k')!.riegelS);
    expect(tenK.netChangeS).toBe(200);
  });

  it('never lets another user’s efforts reach the history (AGENTS.md §2 rule 2)', async () => {
    const d = deps();
    await seedEffort(d.store, 'u', { id: 'mine', day: '2026-08-01', durationS: 2600 });
    await seedEffort(d.store, 'other', { id: 'theirs', day: '2026-08-02', durationS: 1700 });

    const range = resolveRange('30', '2026-08-09');
    const mine = await loadRunning(d, { userId: 'u', range });
    expect(mine.predictionHistory!.distances.find((x) => x.key === '10k')!.values.at(-1)).toBe(2600);
    // …and the other account still sees its own, so isolation is a scoped read, not an empty one.
    const theirs = await loadRunning(d, { userId: 'other', range });
    expect(theirs.predictionHistory!.distances.find((x) => x.key === '10k')!.values.at(-1)).toBe(1700);
  });

  it('excludes other sports from the history, like the predictions above it', async () => {
    const d = deps();
    await seedEffort(d.store, 'u', { id: 'run', day: '2026-08-01', durationS: 2600 });
    // A ride whose "10 km effort" is far faster: a running prediction must never be built from it.
    await d.store.putActivities('u', [
      act('ride', { sport: 'cycling', startTimeLocal: '2026-08-02 07:00:00', distanceM: 10_000 })
    ]);
    await d.store.putStreams('u', 'ride', { speed: [9, 9], time: [0, 1] });
    await d.store.putActivityBestEfforts('u', {
      activityId: 'ride',
      sport: 'cycling',
      day: '2026-08-02',
      version: BEST_EFFORTS_VERSION,
      efforts: [
        {
          key: '10k',
          metres: 10_000,
          actualM: 10_000,
          durationS: 1100,
          paceSecPerKm: 110,
          startS: 0,
          samples: 600
        }
      ]
    });

    const data = await loadRunning(d, { userId: 'u', range: resolveRange('30', '2026-08-09') });
    expect(data.predictionHistory!.distances.find((x) => x.key === '10k')!.values.at(-1)).toBe(2600);
  });
});
