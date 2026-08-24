import { describe, it, expect } from 'vitest';
import { createMemoryStore } from '$lib/server/store/memory';
import { fixedClock } from '$lib/server/clock';
import type { SettingsRepo, UserSettings } from '$lib/server/repo/types';
import type { ActivitySummary, SportCount } from '$lib/server/store/types';
import { resolveRange } from '$lib/range';
import { loadTrainingOverview, loadTrainingTabs, type TrainingDeps } from './training.api';
import type { TrainingTabsDeps } from './training.types';

const USER = 'u1';
// A Monday, so week bucketing is easy to reason about.
const clock = fixedClock(new Date('2026-02-09T08:00:00.000Z'));
/** The clock's local day. */
const TODAY = '2026-02-09';
/*
 * The window half of this payload follows the global range (spec 047). These tests pin `30 dni`: it
 * spans five ISO weeks ending on the "today" Monday, which is enough lattice to see bucketing without
 * making every expectation a 12-element array.
 */
const RANGE = resolveRange('30', TODAY);
/** Buckets in `RANGE`: the window starts 2026-01-11, whose ISO week begins 2026-01-05 — so six. */
const WEEKS = 6;

function act(id: string, over: Partial<ActivitySummary>): ActivitySummary {
  return {
    userId: USER,
    activityId: id,
    sport: 'cycling',
    name: null,
    startTime: '2026-02-01T09:00:00Z',
    startTimeLocal: '2026-02-01 09:00:00',
    distanceM: 30000,
    durationS: 3600,
    movingS: 3600,
    elevationGainM: 100,
    avgHr: 150,
    maxHr: 180,
    avgPower: 200,
    maxPower: 500,
    normPower: 210,
    calories: 600,
    trainingLoad: null,
    hasGps: false,
    garminWorkoutId: null,
    raw: {},
    ...over
  };
}

function fakeSettings(bag: UserSettings): SettingsRepo {
  return {
    async get() {
      return bag;
    },
    async set() {
      /* no-op */
    }
  };
}

function deps(bag: UserSettings = {}): TrainingDeps {
  return { store: createMemoryStore(), settings: fakeSettings(bag), clock };
}

describe('loadTrainingOverview', () => {
  it('returns an empty, safe payload for a user with no activities', async () => {
    const data = await loadTrainingOverview(deps(), { userId: USER, locale: 'pl', range: RANGE });

    expect(data.hasData).toBe(false);
    expect(data.series).toEqual([]);
    expect(data.band).toBe('neutral');
    expect(data.recommendation).toContain('Za mało danych');
    expect(data.sports).toEqual([]);
    expect(data.weekly).toEqual([]);
    expect(data.totals).toEqual({ activities: 0, durationS: 0, distanceM: 0, elevationGainM: 0 });
    // The bucket lattice is always present so the chart renders an empty axis, not nothing.
    expect(data.weeks).toHaveLength(WEEKS);
    expect(data.windowDays).toBe(RANGE.days);
    expect(data.range.key).toBe('30');
  });

  it('builds a PMC series from Garmin training load and extends it to today', async () => {
    const d = deps();
    await d.store.putActivities(USER, [
      act('a', { startTimeLocal: '2026-02-01 09:00:00', trainingLoad: 90 }),
      act('b', { startTimeLocal: '2026-02-05 09:00:00', trainingLoad: 60 })
    ]);

    const data = await loadTrainingOverview(d, { userId: USER, locale: 'pl' });

    expect(data.hasData).toBe(true);
    expect(data.series[0]!.day).toBe('2026-02-01');
    expect(data.series[data.series.length - 1]!.day).toBe('2026-02-09');
    expect(data.ctl).toBeGreaterThan(0);
    expect(data.atl).toBeGreaterThan(0);
  });

  it('uses power streams + the settings FTP when Garmin load is absent', async () => {
    const d = deps({ ftpWatts: 250 });
    await d.store.putActivities(USER, [act('p', { trainingLoad: null })]);
    await d.store.putStreams(USER, 'p', { power: new Array(3600).fill(250) });

    const data = await loadTrainingOverview(d, { userId: USER, locale: 'pl' });

    expect(data.ftpWatts).toBe(250);
    expect(data.hasData).toBe(true);
    // ~1h at FTP ≈ 100 TSS on the activity day.
    expect(data.series.find((p) => p.day === '2026-02-01')!.tss).toBeCloseTo(100, 0);
  });

  it('falls back to HR TRIMP when there is neither load nor power', async () => {
    const d = deps();
    await d.store.putActivities(USER, [act('h', { trainingLoad: null, avgHr: 150, maxHr: 190 })]);

    const data = await loadTrainingOverview(d, { userId: USER, locale: 'pl' });

    expect(data.hasData).toBe(true);
    expect(data.series.find((p) => p.day === '2026-02-01')!.tss).toBeGreaterThan(0);
  });

  it('splits the window by sport family, busiest first, and links the families with a subpage', async () => {
    const d = deps();
    await d.store.putActivities(USER, [
      act('r1', {
        sport: 'gravel_cycling',
        startTimeLocal: '2026-02-02 09:00:00',
        durationS: 7200,
        movingS: 7200,
        distanceM: 60000,
        elevationGainM: 400,
        trainingLoad: 120
      }),
      act('r2', {
        sport: 'virtual_ride',
        startTimeLocal: '2026-02-04 09:00:00',
        durationS: 3600,
        movingS: 3600,
        distanceM: 30000,
        elevationGainM: 100,
        trainingLoad: 60
      }),
      act('run', {
        sport: 'trail_running',
        startTimeLocal: '2026-02-03 07:00:00',
        durationS: 1800,
        movingS: 1800,
        distanceM: 5000,
        elevationGainM: 50,
        trainingLoad: 40
      }),
      act('walk', {
        sport: 'hiking',
        startTimeLocal: '2026-02-05 12:00:00',
        durationS: 3600,
        movingS: 3600,
        distanceM: 6000,
        elevationGainM: 300,
        trainingLoad: 30
      }),
      act('swim', {
        sport: 'lap_swimming',
        startTimeLocal: '2026-02-06 12:00:00',
        durationS: 2400,
        movingS: 2400,
        distanceM: 1500,
        elevationGainM: 0,
        trainingLoad: 35
      })
    ]);

    const data = await loadTrainingOverview(d, { userId: USER, locale: 'pl', range: RANGE });

    expect(data.sports.map((s) => s.group)).toEqual(['ride', 'walk', 'swim', 'run']);

    const ride = data.sports[0]!;
    expect(ride.label).toBe('Rower');
    expect(ride.activities).toBe(2);
    expect(ride.durationS).toBe(10800);
    expect(ride.distanceM).toBe(90000);
    expect(ride.elevationGainM).toBe(500);
    expect(ride.load).toBe(180);
    expect(ride.href).toBe('/training/ride');

    expect(data.sports.find((s) => s.group === 'run')!.href).toBe('/training/run');
    // Walking finally has a home of its own — this is the regression that mattered.
    expect(data.sports.find((s) => s.group === 'walk')!.href).toBe('/training/walk');
    // Swimming is counted but has no analysis page yet, so it must not fake a link.
    expect(data.sports.find((s) => s.group === 'swim')!.href).toBeNull();

    // 7200 + 3600 (ride) + 1800 (run) + 3600 (walk) + 2400 (swim).
    expect(data.totals).toEqual({ activities: 5, durationS: 18600, distanceM: 102500, elevationGainM: 850 });
  });

  it('buckets weekly hours per family onto the shared week lattice', async () => {
    const d = deps();
    await d.store.putActivities(USER, [
      // Week of 2026-02-02 (the last full week before "today" 2026-02-09).
      act('a', {
        sport: 'cycling',
        startTimeLocal: '2026-02-03 09:00:00',
        durationS: 3600,
        movingS: 3600,
        trainingLoad: 50
      }),
      act('b', {
        sport: 'cycling',
        startTimeLocal: '2026-02-05 09:00:00',
        durationS: 1800,
        movingS: 1800,
        trainingLoad: 25
      }),
      act('c', {
        sport: 'running',
        startTimeLocal: '2026-02-09 07:00:00',
        durationS: 3600,
        movingS: 3600,
        trainingLoad: 40
      })
    ]);

    const data = await loadTrainingOverview(d, { userId: USER, locale: 'pl', range: RANGE });

    expect(data.weeks).toHaveLength(WEEKS);
    expect(data.weeks[WEEKS - 1]).toBe('2026-02-09');
    expect(data.weeks[WEEKS - 2]).toBe('2026-02-02');

    const ride = data.weekly.find((s) => s.group === 'ride')!;
    const run = data.weekly.find((s) => s.group === 'run')!;
    expect(ride.hours).toHaveLength(WEEKS);
    expect(ride.hours[WEEKS - 2]).toBe(1.5);
    expect(ride.hours[WEEKS - 1]).toBe(0);
    expect(run.hours[WEEKS - 1]).toBe(1);
  });

  it('resizes the split window to the global range and leaves the PMC alone (spec 047)', async () => {
    const d = deps();
    await d.store.putActivities(USER, [
      // Inside a 30-day window, outside a 7-day one.
      act('older', { sport: 'cycling', startTimeLocal: '2026-01-20 09:00:00', trainingLoad: 40 }),
      // Inside both.
      act('recent', { sport: 'running', startTimeLocal: '2026-02-06 09:00:00', trainingLoad: 50 })
    ]);

    const week = await loadTrainingOverview(d, {
      userId: USER,
      locale: 'pl',
      range: resolveRange('7', TODAY)
    });
    const month = await loadTrainingOverview(d, {
      userId: USER,
      locale: 'pl',
      range: resolveRange('30', TODAY)
    });

    expect(week.windowDays).toBe(7);
    expect(week.totals.activities).toBe(1);
    expect(week.sports.map((s) => s.group)).toEqual(['run']);

    expect(month.windowDays).toBe(30);
    expect(month.totals.activities).toBe(2);
    expect(month.sports.map((s) => s.group).sort()).toEqual(['ride', 'run']);

    // The PMC is a 42-day-constant model, so the switch must NOT narrow it: both windows see the
    // same charted form series.
    expect(week.series.length).toBe(month.series.length);
    expect(week.ctl).toBe(month.ctl);
  });

  it('buckets a long range by month so the volume chart stays readable (spec 047)', async () => {
    const d = deps();
    await d.store.putActivities(USER, [
      act('a', { sport: 'cycling', startTimeLocal: '2025-11-04 09:00:00', trainingLoad: 40 }),
      act('b', { sport: 'cycling', startTimeLocal: '2025-11-20 09:00:00', trainingLoad: 40 })
    ]);

    const data = await loadTrainingOverview(d, {
      userId: USER,
      locale: 'pl',
      range: resolveRange('all', TODAY, '2024-06-01')
    });

    // Clamped to the PMC's own store read (HISTORY_DAYS), then bucketed monthly.
    expect(data.range.bucket).toBe('month');
    expect(data.weeks.every((k) => k.endsWith('-01'))).toBe(true);
    expect(data.weeks.at(-1)).toBe('2026-02-01');
    const ride = data.weekly.find((s) => s.group === 'ride')!;
    expect(ride.hours).toHaveLength(data.weeks.length);
    // Both November rides land in the one monthly bucket: 1h + 1h.
    const nov = data.weeks.indexOf('2025-11-01');
    expect(ride.hours[nov]).toBe(2);
  });

  it('keeps activities older than the volume window out of the split but in the PMC lead-in', async () => {
    const d = deps();
    await d.store.putActivities(USER, [
      act('old', { sport: 'cycling', startTimeLocal: '2025-09-01 09:00:00', trainingLoad: 100 }),
      act('recent', { sport: 'running', startTimeLocal: '2026-02-06 09:00:00', trainingLoad: 50 })
    ]);

    const data = await loadTrainingOverview(d, { userId: USER, locale: 'pl' });

    expect(data.sports.map((s) => s.group)).toEqual(['run']);
    expect(data.totals.activities).toBe(1);
    // The old ride still warms CTL up, so the PMC series starts back in September.
    expect(data.series[0]!.day).toBe('2025-09-01');
  });

  describe('load risk and per-sport fitness (spec 039)', () => {
    /** Daily sessions from `fromDay` up to the clock's today, so CTL has real history. */
    function dailyFrom(sport: string, fromDay: string, load: number): ActivitySummary[] {
      const out: ActivitySummary[] = [];
      const start = new Date(`${fromDay}T00:00:00Z`).getTime();
      const end = new Date('2026-02-09T00:00:00Z').getTime();
      for (let t = start, i = 0; t <= end; t += 86_400_000, i++) {
        const day = new Date(t).toISOString().slice(0, 10);
        out.push(
          act(`${sport}-${i}`, {
            sport,
            startTimeLocal: `${day} 09:00:00`,
            startTime: `${day}T09:00:00Z`,
            trainingLoad: load
          })
        );
      }
      return out;
    }

    it('reports the ratio and ramp once there is enough continuous history', async () => {
      const d = deps();
      await d.store.putActivities(USER, dailyFrom('cycling', '2025-10-01', 60));

      const data = await loadTrainingOverview(d, { userId: USER, locale: 'pl' });
      expect(data.risk.acwr).not.toBeNull();
      expect(data.risk.historyDays).toBeGreaterThan(100);
      // A long stretch of identical daily load converges: acute ≈ chronic. Not exactly 1 — the 42-day
      // EWMA is still catching up to the 7-day one even after four months.
      expect(data.risk.acwr!).toBeGreaterThan(0.95);
      expect(data.risk.acwr!).toBeLessThan(1.1);
    });

    it('withholds both numbers rather than guessing from a short history', async () => {
      const d = deps();
      await d.store.putActivities(USER, [
        act('a', { startTimeLocal: '2026-02-06 09:00:00', trainingLoad: 90 })
      ]);

      const data = await loadTrainingOverview(d, { userId: USER, locale: 'pl' });
      expect(data.risk.acwr).toBeNull();
      expect(data.risk.rampRatePerWeek).toBeNull();
      expect(data.risk.advice).toContain('Za mało historii');
    });

    it('scores each sport family on its own history, fittest first', async () => {
      const d = deps();
      await d.store.putActivities(USER, [
        ...dailyFrom('cycling', '2025-10-01', 80),
        ...dailyFrom('running', '2025-10-01', 30)
      ]);

      const data = await loadTrainingOverview(d, { userId: USER, locale: 'pl' });
      expect(data.perSport.map((s) => s.group)).toEqual(['ride', 'run']);
      const ride = data.perSport[0]!;
      const run = data.perSport[1]!;
      expect(ride.ctl).toBeGreaterThan(run.ctl);
      expect(ride.label).toBe('Rower');
      expect(ride.color).toBe('var(--lane-cyan)');
      // A family's own numbers must not be the whole-athlete ones.
      expect(ride.ctl).toBeLessThan(data.ctl);
    });

    it('leaves a family out entirely when it produced no load', async () => {
      const d = deps();
      await d.store.putActivities(USER, [
        ...dailyFrom('cycling', '2025-12-01', 60),
        // No load, no HR, no power → nothing to score.
        act('gym', {
          sport: 'strength_training',
          startTimeLocal: '2026-02-07 09:00:00',
          trainingLoad: null,
          avgHr: null,
          maxHr: null,
          durationS: 1800,
          movingS: 1800
        })
      ]);

      const data = await loadTrainingOverview(d, { userId: USER, locale: 'pl' });
      expect(data.perSport.some((s) => s.group === 'strength')).toBe(false);
      expect(data.perSport.some((s) => s.group === 'ride')).toBe(true);
    });

    it('gives an athlete with no load at all an empty breakdown, not a crash', async () => {
      const d = deps();
      const data = await loadTrainingOverview(d, { userId: USER, locale: 'pl' });
      expect(data.perSport).toEqual([]);
      expect(data.risk.acwr).toBeNull();
    });
  });

  describe('intensity mix (spec 044)', () => {
    it('splits the window‘s time into easy / moderate / hard against the athlete‘s max HR', async () => {
      const d = deps({ maxHrBpm: 200 });
      await d.store.putActivities(USER, [
        // 80 min easy (140 bpm = 70%), 10 min moderate (168 = 84%), 10 min hard (185 = 92%).
        act('easy', { startTimeLocal: '2026-02-04 09:00:00', durationS: 4800, movingS: 4800, avgHr: 140 }),
        act('mod', { startTimeLocal: '2026-02-05 09:00:00', durationS: 600, movingS: 600, avgHr: 168 }),
        act('hard', { startTimeLocal: '2026-02-06 09:00:00', durationS: 600, movingS: 600, avgHr: 185 })
      ]);

      const { intensityMix } = await loadTrainingOverview(d, { userId: USER, locale: 'pl' });
      expect(intensityMix.maxHr).toBe(200);
      expect(intensityMix.easyPct).toBe(80);
      expect(intensityMix.verdict).toBe('on-model');
      expect(intensityMix.bands.map((b) => b.band)).toEqual(['easy', 'moderate', 'hard']);
    });

    it('falls back to the highest observed heart rate when no setting exists', async () => {
      const d = deps();
      await d.store.putActivities(USER, [
        act('a', { startTimeLocal: '2026-02-06 09:00:00', avgHr: 150, maxHr: 195 })
      ]);

      const { intensityMix } = await loadTrainingOverview(d, { userId: USER, locale: 'pl' });
      expect(intensityMix.maxHr).toBe(195);
    });

    it('reports unknown rather than guessing when no heart rate exists anywhere', async () => {
      const d = deps();
      await d.store.putActivities(USER, [
        act('a', { startTimeLocal: '2026-02-06 09:00:00', avgHr: null, maxHr: null })
      ]);

      const { intensityMix } = await loadTrainingOverview(d, { userId: USER, locale: 'pl' });
      expect(intensityMix.verdict).toBe('unknown');
      expect(intensityMix.easyPct).toBeNull();
    });

    it('counts a strapless session as unclassified rather than as easy', async () => {
      const d = deps({ maxHrBpm: 200 });
      await d.store.putActivities(USER, [
        act('with', { startTimeLocal: '2026-02-05 09:00:00', durationS: 3600, movingS: 3600, avgHr: 140 }),
        act('without', { startTimeLocal: '2026-02-06 09:00:00', durationS: 3600, movingS: 3600, avgHr: null })
      ]);

      const { intensityMix } = await loadTrainingOverview(d, { userId: USER, locale: 'pl' });
      expect(intensityMix.unclassifiedSessions).toBe(1);
      expect(intensityMix.classifiedSessions).toBe(1);
      expect(intensityMix.easyPct).toBe(100);
    });

    it('ignores activities older than the window', async () => {
      const d = deps({ maxHrBpm: 200 });
      await d.store.putActivities(USER, [
        act('old', { startTimeLocal: '2025-09-01 09:00:00', durationS: 36_000, movingS: 36_000, avgHr: 185 }),
        act('recent', { startTimeLocal: '2026-02-06 09:00:00', durationS: 3600, movingS: 3600, avgHr: 140 })
      ]);

      const { intensityMix } = await loadTrainingOverview(d, { userId: USER, locale: 'pl' });
      expect(intensityMix.classifiedSessions).toBe(1);
      expect(intensityMix.easyPct).toBe(100);
    });

    it('takes its window from the global range, like the split beside it (spec 047)', async () => {
      const d = deps({ maxHrBpm: 200 });
      await d.store.putActivities(USER, [
        // Inside a 30-day window, outside a 7-day one — and hard, so its inclusion is unmistakable.
        act('older', { startTimeLocal: '2026-01-20 09:00:00', durationS: 3600, movingS: 3600, avgHr: 185 }),
        // Inside both, and easy.
        act('recent', { startTimeLocal: '2026-02-06 09:00:00', durationS: 3600, movingS: 3600, avgHr: 140 })
      ]);

      const week = await loadTrainingOverview(d, {
        userId: USER,
        locale: 'pl',
        range: resolveRange('7', TODAY)
      });
      expect(week.intensityMix.classifiedSessions).toBe(1);
      expect(week.intensityMix.easyPct).toBe(100);

      const month = await loadTrainingOverview(d, {
        userId: USER,
        locale: 'pl',
        range: resolveRange('30', TODAY)
      });
      expect(month.intensityMix.classifiedSessions).toBe(2);
      expect(month.intensityMix.easyPct).toBe(50);
    });
  });

  describe('intensity minutes and the bucket lattice (specs 045 + 047)', () => {
    it("shares the volume chart's lattice exactly", async () => {
      const d = deps({ maxHrBpm: 200 });
      await d.store.putActivities(USER, [
        act('a', { startTimeLocal: '2026-02-04 09:00:00', durationS: 3600, movingS: 3600, avgHr: 168 })
      ]);

      const data = await loadTrainingOverview(d, { userId: USER, locale: 'pl', range: RANGE });
      // One entry per charted bucket, in the same order — the two charts sit under one another.
      expect(data.intensityWeeks.map((w) => w.week)).toEqual(data.weeks);
    });

    it('buckets by MONTH when the range does, instead of silently scoring every bucket zero', async () => {
      /*
       * The regression this pins: `weeklyIntensityMinutes` is handed the lattice plus a bucketer. While
       * the lattice was always weekly a hardcoded `startOfWeek` was fine; once a long range buckets
       * monthly, that bucketer maps every day to a Monday that is not in the lattice — so every bucket
       * comes back empty while the volume chart beside it shows real hours.
       */
      const d = deps({ maxHrBpm: 200 });
      // 168 bpm of 200 = 84% — MODERATE. Easy sessions score no intensity minutes at all, so an easy
      // pair here would read as zero for the right reason and hide the bug this test exists for.
      await d.store.putActivities(USER, [
        act('nov', { startTimeLocal: '2025-11-04 09:00:00', durationS: 3600, movingS: 3600, avgHr: 168 }),
        act('feb', { startTimeLocal: '2026-02-04 09:00:00', durationS: 3600, movingS: 3600, avgHr: 168 })
      ]);

      const data = await loadTrainingOverview(d, {
        userId: USER,
        locale: 'pl',
        range: resolveRange('all', TODAY, '2024-06-01')
      });

      expect(data.range.bucket).toBe('month');
      expect(data.intensityWeeks.map((w) => w.week)).toEqual(data.weeks);
      // Both sessions land in their own monthly bucket and actually score minutes.
      const scored = data.intensityWeeks.filter((w) => w.weightedMinutes > 0).map((w) => w.week);
      expect(scored).toEqual(['2025-11-01', '2026-02-01']);
      // 60 min moderate → 60 weighted minutes, in the bucket the session belongs to.
      expect(data.intensityWeeks.find((w) => w.week === '2025-11-01')!.moderateMinutes).toBe(60);
    });
  });
});

/**
 * Spec 088. `/training` carries two sections with two tab bars, and the pathname decides which —
 * including whether the athlete's sport counts are worth a query at all.
 */
describe('loadTrainingTabs', () => {
  /** A store that records whether the sport tally was asked for. */
  function countingStore(sports: SportCount[]): { store: TrainingTabsDeps['store']; calls: string[] } {
    const calls: string[] = [];
    return {
      store: {
        async listSports(userId: string): Promise<SportCount[]> {
          calls.push(userId);
          return sports;
        }
      },
      calls
    };
  }

  it('returns the analysis bar on an analysis page, built from the sports the athlete has', async () => {
    const { store } = countingStore([
      { sport: 'running', count: 12 },
      { sport: 'cycling', count: 3 }
    ]);

    const result = await loadTrainingTabs(
      { store },
      { userId: USER, locale: 'pl', pathname: '/training/run' }
    );

    expect(result.tabs).toEqual([
      { href: '/training', label: 'Przegląd' },
      { href: '/training/volume', label: 'Objętość' },
      { href: '/training/ride', label: 'Rower', count: 3 },
      { href: '/training/run', label: 'Bieg', count: 12 }
    ]);
  });

  it('returns the plan bar on the planner and on the goals page', async () => {
    const { store } = countingStore([]);
    const expected = [
      { href: '/training/plan', label: 'Plan' },
      { href: '/training/goals', label: 'Cele' }
    ];

    for (const pathname of ['/training/plan', '/training/goals']) {
      const result = await loadTrainingTabs({ store }, { userId: USER, locale: 'pl', pathname });
      expect(result.tabs, pathname).toEqual(expected);
    }
  });

  it('does not query the store for a section whose tabs do not depend on it', async () => {
    const { store, calls } = countingStore([{ sport: 'running', count: 12 }]);

    await loadTrainingTabs({ store }, { userId: USER, locale: 'pl', pathname: '/training/plan' });
    expect(calls).toEqual([]);

    await loadTrainingTabs({ store }, { userId: USER, locale: 'pl', pathname: '/training' });
    expect(calls).toEqual([USER]);
  });

  it('falls back to the analysis bar on a path that does not exist', async () => {
    const { store } = countingStore([]);

    const result = await loadTrainingTabs(
      { store },
      { userId: USER, locale: 'pl', pathname: '/training/xyz' }
    );

    expect(result.tabs).toEqual([{ href: '/training', label: 'Przegląd' }]);
  });

  it('labels the tabs in the language of the request', async () => {
    const { store } = countingStore([]);

    const result = await loadTrainingTabs(
      { store },
      { userId: USER, locale: 'en', pathname: '/training/plan' }
    );

    expect(result.tabs.map((tab) => tab.label)).toEqual(['Plan', 'Goals']);
  });
});
