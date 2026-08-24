import { describe, it, expect } from 'vitest';
import { addDays, startOfWeek } from '$lib/date';
import {
  MIN_WINDOW_WEEKS,
  RUNNER_AXES,
  archetypeOf,
  paceScore,
  runnerProfile,
  type RunSummary,
  type RunnerAxisKey
} from './runner-profile';

/** `today` is a Sunday, so every generated run sits in the past. */
const TODAY = '2026-08-16';

function run(day: string, km: number, secPerKm: number, id = `${day}-${km}`): RunSummary {
  const durationS = Math.round(km * secPerKm);
  return { activityId: id, day, distanceM: km * 1000, durationS, movingS: durationS };
}

/** `weeks` weeks ending with the week of TODAY, two runs each (Monday + Thursday). */
function steadyBlock(weeks: number, km: number, secPerKm: number): RunSummary[] {
  const thisMonday = startOfWeek(TODAY);
  const out: RunSummary[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const monday = addDays(thisMonday, -i * 7);
    out.push(run(monday, km, secPerKm, `${monday}-a`), run(addDays(monday, 3), km, secPerKm, `${monday}-b`));
  }
  return out;
}

const scoreOf = (profile: ReturnType<typeof runnerProfile>, key: RunnerAxisKey): number | null =>
  profile.axes.find((a) => a.key === key)?.score ?? null;

const axisOf = (profile: ReturnType<typeof runnerProfile>, key: RunnerAxisKey) =>
  profile.axes.find((a) => a.key === key)!;

describe('paceScore', () => {
  it('maps the reference anchors to 0 and 1', () => {
    expect(paceScore('5k', 480)).toBe(0);
    expect(paceScore('5k', 165)).toBe(1);
  });

  it('clamps beyond the anchors instead of leaving 0..1', () => {
    expect(paceScore('5k', 900)).toBe(0);
    expect(paceScore('5k', 100)).toBe(1);
  });

  it('rejects nonsense and unknown distances', () => {
    expect(paceScore('5k', 0)).toBeNull();
    expect(paceScore('5k', Number.NaN)).toBeNull();
    expect(paceScore('3k', 300)).toBeNull();
  });
});

describe('runnerProfile — axes', () => {
  const profile = runnerProfile(steadyBlock(12, 20, 300), { today: TODAY });

  it('returns the five spokes in drawing order', () => {
    expect(profile.axes.map((a) => a.key)).toEqual(RUNNER_AXES.map((a) => a.key));
    expect(profile.definedCount).toBe(5);
    expect(profile.hasProfile).toBe(true);
  });

  it('scores the pace axes against their own reference scale', () => {
    // 20 km at 5:00 /km covers 1 km, 5 km and 10 km at that same projected pace.
    expect(scoreOf(profile, 'speed')).toBeCloseTo((450 - 300) / (450 - 155), 4);
    expect(scoreOf(profile, 'tempo')).toBeCloseTo((480 - 300) / (480 - 165), 4);
    expect(scoreOf(profile, 'endurance')).toBeCloseTo((510 - 300) / (510 - 170), 4);
  });

  it('scores volume and consistency over the trailing window', () => {
    // 2 × 20 km every week for 12 weeks = 40 km/week.
    expect(profile.window).toMatchObject({ weeks: 12, km: 480, runs: 24, activeWeeks: 12 });
    expect(profile.window.avgKmPerWeek).toBe(40);
    expect(profile.window.runsPerWeek).toBe(2);
    expect(scoreOf(profile, 'volume')).toBeCloseTo(40 / 80, 4);
    expect(scoreOf(profile, 'consistency')).toBeCloseTo(0.6 * 1 + 0.4 * (2 / 4), 4);
  });

  it('pre-formats a readout and names the basis of every axis', () => {
    expect(axisOf(profile, 'speed').readout).toBe('5:00 /km');
    expect(axisOf(profile, 'speed').basis).toBe('najlepsze 1 km');
    expect(axisOf(profile, 'endurance').basis).toBe('najlepsze 10 km');
    expect(axisOf(profile, 'volume').readout).toBe('40,0 km/tyg.');
    expect(axisOf(profile, 'consistency').readout).toBe('2,0 biegu/tyg.');
    expect(axisOf(profile, 'consistency').basis).toBe('12 z 12 tyg. z biegiem');
  });

  it('dates the pace axes so a five-year-old PR is visible as one', () => {
    expect(axisOf(profile, 'speed').day).not.toBeNull();
    expect(axisOf(profile, 'volume').day).toBeNull();
  });

  it('takes the LONGEST distance with data for endurance', () => {
    const withHalf = runnerProfile([...steadyBlock(12, 20, 300), run('2026-08-09', 21.5, 330)], {
      today: TODAY
    });
    expect(axisOf(withHalf, 'endurance').basis).toBe('najlepsze półmaraton');
    expect(scoreOf(withHalf, 'endurance')).toBeCloseTo((540 - 330) / (540 - 180), 4);
  });

  it('is deterministic', () => {
    const runs = steadyBlock(12, 20, 300);
    expect(runnerProfile(runs, { today: TODAY })).toEqual(runnerProfile(runs, { today: TODAY }));
  });
});

describe('runnerProfile — honest gaps', () => {
  it('leaves a distance never run as null, not as zero', () => {
    const profile = runnerProfile(steadyBlock(12, 3, 300), { today: TODAY });
    expect(scoreOf(profile, 'speed')).not.toBeNull();
    expect(scoreOf(profile, 'tempo')).toBeNull();
    expect(scoreOf(profile, 'endurance')).toBeNull();
    expect(axisOf(profile, 'tempo').basis).toBe('brak biegu na 5 km');
    expect(axisOf(profile, 'endurance').basis).toBe('brak biegu od 10 km w górę');
  });

  it('refuses to score volume/consistency on less than three weeks of history', () => {
    const profile = runnerProfile(steadyBlock(2, 20, 300), { today: TODAY });
    expect(profile.window.weeks).toBe(2);
    expect(scoreOf(profile, 'volume')).toBeNull();
    expect(scoreOf(profile, 'consistency')).toBeNull();
    expect(axisOf(profile, 'volume').basis).toContain(`min. ${MIN_WINDOW_WEEKS} tyg.`);
  });

  it('scores them from exactly three weeks of history, over that window only', () => {
    const profile = runnerProfile(steadyBlock(3, 20, 300), { today: TODAY });
    expect(profile.window.weeks).toBe(3);
    expect(profile.window.avgKmPerWeek).toBe(40);
    expect(scoreOf(profile, 'volume')).toBeCloseTo(0.5, 4);
  });

  it('says nothing at all about an empty history', () => {
    const profile = runnerProfile([], { today: TODAY });
    expect(profile.hasProfile).toBe(false);
    expect(profile.definedCount).toBe(0);
    expect(profile.axes.every((a) => a.score === null)).toBe(true);
    expect(profile.archetype.key).toBe('unknown');
    expect(profile.strength).toBeNull();
    expect(profile.weakness).toBeNull();
    expect(profile.window).toMatchObject({ weeks: 0, km: 0, runs: 0, activeWeeks: 0 });
  });

  it('names no strength when only one axis is defined', () => {
    const profile = runnerProfile([run('2026-08-10', 2, 300)], { today: TODAY });
    expect(profile.definedCount).toBe(1);
    expect(profile.strength).toBeNull();
    expect(profile.archetype.key).toBe('unknown');
  });

  it('names the strongest and weakest defined axis', () => {
    const runs = [...steadyBlock(12, 20, 300), run('2026-08-09', 1.2, 200)];
    const profile = runnerProfile(runs, { today: TODAY });
    expect(profile.strength).toBe('speed'); // the 1.2 km blast is the standout
    expect(profile.weakness).toBe('volume');
  });
});

describe('archetypeOf', () => {
  const vector = (partial: Partial<Record<RunnerAxisKey, number>>): Map<RunnerAxisKey, number> =>
    new Map(Object.entries(partial) as [RunnerAxisKey, number][]);

  it('refuses to name a type under three defined axes', () => {
    expect(archetypeOf(vector({ speed: 0.9, tempo: 0.8 })).key).toBe('unknown');
  });

  it('calls a low-everything vector a beginner', () => {
    expect(
      archetypeOf(vector({ speed: 0.15, tempo: 0.1, endurance: 0.1, volume: 0.05, consistency: 0.2 })).key
    ).toBe('beginner');
  });

  it('calls a speed-leaning vector a szybkościowiec', () => {
    expect(
      archetypeOf(vector({ speed: 0.8, tempo: 0.75, endurance: 0.4, volume: 0.3, consistency: 0.5 })).key
    ).toBe('speedster');
  });

  it('calls an endurance-leaning vector a dystansowiec', () => {
    expect(
      archetypeOf(vector({ speed: 0.3, tempo: 0.35, endurance: 0.7, volume: 0.75, consistency: 0.6 })).key
    ).toBe('diesel');
  });

  it('calls a high-frequency, high-volume, balanced-pace vector a maszyna do kilometrów', () => {
    expect(
      archetypeOf(vector({ speed: 0.5, tempo: 0.52, endurance: 0.55, volume: 0.6, consistency: 0.85 })).key
    ).toBe('grinder');
  });

  it('falls back to wszechstronny when nothing leans', () => {
    expect(
      archetypeOf(vector({ speed: 0.5, tempo: 0.5, endurance: 0.5, volume: 0.5, consistency: 0.5 })).key
    ).toBe('allrounder');
  });

  it('is unaffected by insertion order', () => {
    const a = archetypeOf(vector({ speed: 0.8, tempo: 0.75, endurance: 0.4, volume: 0.3 }));
    const b = archetypeOf(vector({ volume: 0.3, endurance: 0.4, tempo: 0.75, speed: 0.8 }));
    expect(a.key).toBe(b.key);
  });
});
