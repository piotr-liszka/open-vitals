import { describe, it, expect } from 'vitest';
import { buildHrZones, buildStatSections, type StatSection } from './activity-stat-groups';
import { createTranslator } from '$lib/i18n';
import type { ActivityStats } from './activity-detail.types';

const t = createTranslator('pl');

/** An all-empty stats bag — groups always exist, leaves never do (spec 023 contract). */
function emptyStats(over: Partial<ActivityStats> = {}): ActivityStats {
  return {
    calories: {},
    hydration: {},
    respiration: {},
    trainingEffect: {},
    stamina: {},
    hr: {},
    timing: {},
    power: {},
    elevation: {},
    pace: {},
    runningDynamics: {},
    temperature: {},
    intensityMinutes: {},
    bodyBattery: {},
    stress: {},
    selfEvaluation: {},
    runWalk: {},
    ...over
  };
}

const find = (sections: StatSection[], key: string): StatSection | undefined =>
  sections.find((s) => s.key === key);

const item = (section: StatSection | undefined, key: string) => section?.items.find((i) => i.key === key);

describe('buildStatSections', () => {
  it('renders nothing at all for an activity with no stats', () => {
    expect(buildStatSections(t, { stats: emptyStats(), sport: 'run', hasTypedSplits: false })).toEqual([]);
  });

  it('keeps only the groups that actually measured something', () => {
    const sections = buildStatSections(t, {
      stats: emptyStats({ timing: { durationS: 3600, movingS: 3500, idleS: 100 } }),
      sport: 'run',
      hasTypedSplits: true
    });
    expect(sections.map((s) => s.key)).toEqual(['timing']);
    expect(item(find(sections, 'timing'), 'duration')?.value).toBe('1:00:00');
  });

  it('explains a genuinely unavailable value instead of hiding or inventing it', () => {
    const sections = buildStatSections(t, {
      stats: emptyStats({ pace: { avgSecPerKm: 300 } }),
      sport: 'run',
      hasTypedSplits: false
    });
    const gap = item(find(sections, 'pace'), 'gap');
    expect(gap?.value).toBeNull();
    expect(gap?.hint).toMatch(/Garmin nie udostępnia/);
  });

  it('says why there is no run/walk split when Garmin sent no typed splits', () => {
    const withoutSplits = buildStatSections(t, {
      stats: emptyStats({ timing: { durationS: 1800 } }),
      sport: 'run',
      hasTypedSplits: false
    });
    expect(item(find(withoutSplits, 'timing'), 'run')?.hint).toMatch(/typed splits/);

    const withSplits = buildStatSections(t, {
      stats: emptyStats({ timing: { durationS: 1800 }, runWalk: { runS: 1700, walkS: 100 } }),
      sport: 'run',
      hasTypedSplits: true
    });
    const run = item(find(withSplits, 'timing'), 'run');
    expect(run?.value).toBe('28:20');
    expect(run?.hint).toBeUndefined();
    // Nothing reported standing time, and there is no reason to explain — the row is dropped.
    expect(item(find(withSplits, 'timing'), 'stand')).toBeUndefined();
  });

  it('drops a row that has neither a value nor a reason', () => {
    const sections = buildStatSections(t, {
      stats: emptyStats({ elevation: { gainM: 120 } }),
      sport: 'run',
      hasTypedSplits: true
    });
    const elevation = find(sections, 'elevation');
    expect(elevation?.items.map((i) => i.key)).toEqual(['gain']);
  });

  it('is sport-aware: full running dynamics on a run, cadence only on a ride', () => {
    const dynamics = {
      runningDynamics: { avgCadenceSpm: 176, avgGroundContactTimeMs: 240, avgVerticalRatio: 7.5 }
    };
    const run = buildStatSections(t, { stats: emptyStats(dynamics), sport: 'run', hasTypedSplits: true });
    expect(find(run, 'runningDynamics')?.items.map((i) => i.key)).toContain('gct');

    const ride = buildStatSections(t, { stats: emptyStats(dynamics), sport: 'ride', hasTypedSplits: true });
    expect(find(ride, 'runningDynamics')).toBeUndefined();
    const cadence = find(ride, 'cadence');
    expect(cadence?.items.map((i) => i.key)).toEqual(['avgCadence']);
    expect(cadence?.items[0]?.unit).toBe('obr./min');
  });

  it('offers minutes per kilometre only where they mean something', () => {
    const stats = emptyStats({ pace: { avgSpeedMps: 8, avgSecPerKm: 125 } });
    const run = buildStatSections(t, { stats, sport: 'run', hasTypedSplits: true });
    expect(item(find(run, 'pace'), 'avgPace')?.value).toBe('2:05');

    const ride = buildStatSections(t, { stats, sport: 'ride', hasTypedSplits: true });
    expect(item(find(ride, 'pace'), 'avgPace')).toBeUndefined();
    expect(item(find(ride, 'pace'), 'avgSpeed')?.value).toBe('28,8');
  });

  it('surfaces calories and training load, which the page never used to render', () => {
    const sections = buildStatSections(t, {
      stats: emptyStats({
        calories: { total: 700, resting: 60, active: 640 },
        hydration: { sweatLossMl: 850 },
        trainingEffect: { aerobic: 3.6, label: 'TEMPO', load: 143 }
      }),
      sport: 'run',
      hasTypedSplits: true
    });
    const calories = find(sections, 'calories');
    expect(item(calories, 'total')?.value).toBe('700');
    expect(item(calories, 'sweat')?.value).toBe('850');
    const te = find(sections, 'trainingEffect');
    expect(item(te, 'load')?.value).toBe('143');
    expect(item(te, 'benefit')?.value).toBe('Tempo');
    // Execution score is never in the payload — it stays a dash with a reason.
    expect(item(te, 'execution')?.value).toBeNull();
    expect(item(te, 'execution')?.hint).toBeTruthy();
  });

  it('explains an absent average temperature (Garmin reports only min/max)', () => {
    const sections = buildStatSections(t, {
      stats: emptyStats({ temperature: { minC: 12, maxC: 21 } }),
      sport: 'run',
      hasTypedSplits: true
    });
    const avg = item(find(sections, 'temperature'), 'avg');
    expect(avg?.value).toBeNull();
    expect(avg?.hint).toMatch(/tylko minimum i maksimum/);
  });
});

describe('buildHrZones', () => {
  const estimated = [
    { zone: 1, label: 'Z1', seconds: 60, pct: 50 },
    { zone: 2, label: 'Z2', seconds: 60, pct: 50 }
  ];

  it('prefers Garmin’s own zone times over our estimate', () => {
    const zones = buildHrZones(t, [300, 600, 100, 0, 0], estimated);
    expect(zones?.source).toBe('garmin');
    expect(zones?.bars).toHaveLength(5);
    expect(zones?.bars[1]?.pct).toBe(60);
  });

  it('falls back to the estimate and says so', () => {
    const zones = buildHrZones(t, undefined, estimated);
    expect(zones?.source).toBe('estimated');
    expect(zones?.bars.map((b) => b.zone)).toEqual([1, 2]);
  });

  it('is null when neither source has any time in it', () => {
    expect(buildHrZones(t, [0, 0, 0, 0, 0], [])).toBeNull();
    expect(buildHrZones(t, undefined, [])).toBeNull();
  });
});
