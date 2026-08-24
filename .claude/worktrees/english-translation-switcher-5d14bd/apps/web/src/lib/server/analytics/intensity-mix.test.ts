import { describe, it, expect } from 'vitest';
import {
  EASY_TARGET_PCT,
  WEEKLY_TARGET_MINUTES,
  bandFor,
  intensityMix,
  weeklyIntensityMinutes,
  type IntensitySession
} from './intensity-mix';

const MAX_HR = 190;

/** A session of `minutes` at `avgHr`. */
const s = (minutes: number, avgHr: number | null, load = 50): IntensitySession => ({
  day: '2026-05-01',
  durationS: minutes * 60,
  avgHr,
  trainingLoad: load
});

const share = (mix: ReturnType<typeof intensityMix>, band: 'easy' | 'moderate' | 'hard') =>
  mix.bands.find((b) => b.band === band)!;

describe('bandFor', () => {
  it('splits at 80% and 87% of max', () => {
    expect(bandFor(140, MAX_HR)).toBe('easy'); // 74%
    expect(bandFor(158, MAX_HR)).toBe('moderate'); // 83%
    expect(bandFor(172, MAX_HR)).toBe('hard'); // 91%
  });

  it('treats the boundaries as belonging to the harder band', () => {
    expect(bandFor(MAX_HR * 0.8, MAX_HR)).toBe('moderate');
    expect(bandFor(MAX_HR * 0.87, MAX_HR)).toBe('hard');
  });
});

describe('intensityMix', () => {
  it('splits time across the three bands and shares them out of classified time', () => {
    const mix = intensityMix([s(80, 140), s(10, 160), s(10, 175)], MAX_HR);
    expect(share(mix, 'easy').pct).toBe(80);
    expect(share(mix, 'moderate').pct).toBe(10);
    expect(share(mix, 'hard').pct).toBe(10);
    expect(mix.easyPct).toBe(80);
    expect(mix.classifiedSessions).toBe(3);
  });

  it('always returns all three bands, so a chart never changes shape', () => {
    const mix = intensityMix([s(60, 140)], MAX_HR);
    expect(mix.bands.map((b) => b.band)).toEqual(['easy', 'moderate', 'hard']);
    expect(share(mix, 'hard')).toMatchObject({ sessions: 0, seconds: 0, pct: 0, load: 0 });
  });

  it('sums training load per band as well as time', () => {
    const mix = intensityMix([s(60, 140, 40), s(30, 175, 90)], MAX_HR);
    expect(share(mix, 'easy').load).toBe(40);
    expect(share(mix, 'hard').load).toBe(90);
  });

  it('calls a properly polarised week on-model', () => {
    const mix = intensityMix([s(160, 140), s(20, 175), s(20, 178)], MAX_HR);
    expect(mix.easyPct).toBe(80);
    expect(mix.verdict).toBe('on-model');
  });

  it('names the commonest self-coaching mistake when too little is easy', () => {
    const mix = intensityMix([s(60, 140), s(60, 160), s(60, 175)], MAX_HR);
    expect(mix.easyPct).toBeLessThan(EASY_TARGET_PCT);
    expect(mix.verdict).toBe('too-hard');
    expect(mix.advice).toContain('Zwolnij na spokojnych');
  });

  it('flags a block with no stimulus at all — but only at a wide margin', () => {
    // 100% easy: a base block with nothing hard in it.
    expect(intensityMix([s(300, 140)], MAX_HR).verdict).toBe('too-easy');
    // 85% easy is a perfectly good week and must NOT be scolded.
    expect(intensityMix([s(85, 140), s(15, 175)], MAX_HR).verdict).toBe('on-model');
  });

  it('refuses to classify anything without a max heart rate', () => {
    const mix = intensityMix([s(60, 140)], null);
    expect(mix.verdict).toBe('unknown');
    expect(mix.easyPct).toBeNull();
    expect(mix.maxHr).toBeNull();
    expect(mix.unclassifiedSessions).toBe(1);
    expect(mix.advice).toContain('Bez maksymalnego tętna');
  });

  it('refuses a nonsensical max heart rate rather than dividing by it', () => {
    expect(intensityMix([s(60, 140)], 0).verdict).toBe('unknown');
  });

  it('counts a strapless session as unclassified, never as easy', () => {
    const mix = intensityMix([s(60, 140), s(60, null)], MAX_HR);
    expect(mix.unclassifiedSessions).toBe(1);
    expect(mix.classifiedSessions).toBe(1);
    // The easy share is 100% OF CLASSIFIED TIME, not 50% of everything — otherwise every strapless
    // session would read as a shortfall in easy training.
    expect(mix.easyPct).toBe(100);
  });

  it('ignores a session with no duration', () => {
    const mix = intensityMix(
      [s(60, 140), { day: '2026-05-02', durationS: null, avgHr: 175, trainingLoad: 10 }],
      MAX_HR
    );
    expect(mix.classifiedSessions).toBe(1);
    expect(mix.unclassifiedSessions).toBe(1);
    expect(share(mix, 'hard').seconds).toBe(0);
  });

  it('handles an athlete with no sessions at all', () => {
    const mix = intensityMix([], MAX_HR);
    expect(mix.easyPct).toBeNull();
    expect(mix.verdict).toBe('unknown');
    expect(mix.bands.every((b) => b.pct === 0)).toBe(true);
  });

  it('treats a zero or negative heart rate as unusable', () => {
    const mix = intensityMix([s(60, 0), s(60, -5)], MAX_HR);
    expect(mix.classifiedSessions).toBe(0);
    expect(mix.unclassifiedSessions).toBe(2);
  });
});

describe('weeklyIntensityMinutes', () => {
  const WEEKS = ['2026-04-27', '2026-05-04'];
  /** All fixture days fall in the first week except those in May. */
  const mondayOf = (day: string): string => (day.startsWith('2026-05') ? WEEKS[1]! : WEEKS[0]!);

  const on = (day: string, minutes: number, avgHr: number): IntensitySession => ({
    day,
    durationS: minutes * 60,
    avgHr,
    trainingLoad: 50
  });

  it('counts vigorous minutes double, the way the guideline does', () => {
    const weeks = weeklyIntensityMinutes(
      [on('2026-04-28', 30, 160), on('2026-04-29', 30, 180)],
      WEEKS,
      MAX_HR,
      mondayOf
    );
    expect(weeks[0]).toMatchObject({
      moderateMinutes: 30,
      vigorousMinutes: 30,
      weightedMinutes: 90
    });
  });

  it('gives easy-band time no credit at all', () => {
    // Three hours of strolling is healthy and is not moderate-intensity activity.
    const weeks = weeklyIntensityMinutes([on('2026-04-28', 180, 120)], WEEKS, MAX_HR, mondayOf);
    expect(weeks[0]?.weightedMinutes).toBe(0);
  });

  it('marks a week that reaches the target', () => {
    const below = weeklyIntensityMinutes([on('2026-04-28', 140, 160)], WEEKS, MAX_HR, mondayOf);
    expect(below[0]?.metTarget).toBe(false);

    const at = weeklyIntensityMinutes(
      [on('2026-04-28', WEEKLY_TARGET_MINUTES, 160)],
      WEEKS,
      MAX_HR,
      mondayOf
    );
    expect(at[0]?.metTarget).toBe(true);
  });

  it('reports a week with no training as zero, not as a gap', () => {
    const weeks = weeklyIntensityMinutes([on('2026-04-28', 60, 160)], WEEKS, MAX_HR, mondayOf);
    expect(weeks).toHaveLength(2);
    expect(weeks[1]).toMatchObject({ week: WEEKS[1], weightedMinutes: 0, metTarget: false });
  });

  it('reports zeros for every week without a max heart rate', () => {
    const weeks = weeklyIntensityMinutes([on('2026-04-28', 60, 160)], WEEKS, null, mondayOf);
    expect(weeks.every((w) => w.weightedMinutes === 0)).toBe(true);
  });

  it('ignores sessions outside the lattice', () => {
    const weeks = weeklyIntensityMinutes(
      [on('2026-04-28', 60, 160)],
      ['2026-03-02'],
      MAX_HR,
      () => '2026-04-27'
    );
    expect(weeks[0]?.weightedMinutes).toBe(0);
  });

  it('ignores sessions it cannot classify', () => {
    const weeks = weeklyIntensityMinutes(
      [
        { day: '2026-04-28', durationS: 3600, avgHr: null, trainingLoad: 10 },
        { day: '2026-04-29', durationS: null, avgHr: 180, trainingLoad: 10 }
      ],
      WEEKS,
      MAX_HR,
      mondayOf
    );
    expect(weeks[0]?.weightedMinutes).toBe(0);
  });
});
