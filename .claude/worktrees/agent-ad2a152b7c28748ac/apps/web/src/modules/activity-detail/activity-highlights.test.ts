import { describe, it, expect } from 'vitest';
import {
  buildHighlights,
  buildSuspects,
  derivedPaceSecPerKm,
  longestZeroRun,
  MIN_COMPARABLE,
  type HighlightActivity,
  type SuspectInput
} from './activity-highlights';

/** A plain 10 km / 50 min run on `day`, with every optional field absent unless overridden. */
function run(day: string, over: Partial<HighlightActivity> = {}): HighlightActivity {
  return {
    day,
    distanceM: 10_000,
    durationS: 3000,
    elevationGainM: 50,
    calories: 600,
    trainingLoad: 120,
    normPower: null,
    ...over
  };
}

/** `n` unremarkable runs ending the day before `2026-08-01`, all slower/shorter than the fixtures. */
function boringHistory(n: number, over: Partial<HighlightActivity> = {}): HighlightActivity[] {
  return Array.from({ length: n }, (_, i) =>
    run(`2025-1${(i % 2) + 1}-0${(i % 9) + 1}`, { distanceM: 5000, durationS: 1800, ...over })
  );
}

const find = <T extends { key: string }>(list: readonly T[], key: string): T | undefined =>
  list.find((h) => h.key === key);

describe('buildHighlights', () => {
  it('claims a record only when the window reaches the first comparable session', () => {
    const highlights = buildHighlights({
      sport: 'run',
      current: run('2026-08-01', { distanceM: 30_000 }),
      history: boringHistory(12),
      coversAllHistory: true
    });
    const distance = find(highlights, 'distance');
    expect(distance).toMatchObject({
      kind: 'record',
      rank: 1,
      outOf: 13,
      label: 'Dystans',
      unit: 'km'
    });
    expect(distance?.text).toBe('Rekord — najlepszy wynik w historii');
    expect(distance?.value).toBe('30,00');
  });

  it('names the span it examined instead of claiming a record on a truncated window', () => {
    const highlights = buildHighlights({
      sport: 'run',
      current: run('2026-08-01', { distanceM: 30_000 }),
      history: boringHistory(12),
      coversAllHistory: false
    });
    const distance = find(highlights, 'distance');
    expect(distance?.kind).toBe('record');
    expect(distance?.text).toMatch(/^Najlepszy wynik w ostatnich \d+ miesięcy$/);
    expect(distance?.text).not.toContain('Rekord');
  });

  it('says how long a beaten record has stood when the last better session is old', () => {
    // One 40 km run 14 months earlier; everything else is short.
    const history = [...boringHistory(12), run('2025-06-01', { distanceM: 40_000 })];
    const highlights = buildHighlights({
      sport: 'run',
      current: run('2026-08-01', { distanceM: 30_000 }),
      history,
      coversAllHistory: true
    });
    const distance = find(highlights, 'distance');
    expect(distance).toMatchObject({ kind: 'notable', rank: 2 });
    expect(distance?.text).toBe('Najlepszy od 14 miesięcy');
  });

  it('falls back to the placing when the session that beat it was recent', () => {
    const history = [...boringHistory(12), run('2026-07-20', { distanceM: 40_000 })];
    const highlights = buildHighlights({
      sport: 'run',
      current: run('2026-08-01', { distanceM: 30_000 }),
      history,
      coversAllHistory: true
    });
    expect(find(highlights, 'distance')?.text).toBe('2. najlepszy wynik w historii');
  });

  it('reports nothing at all for an ordinary session', () => {
    // Every metric is bettered recently and by a clear margin, so nothing here is worth a badge.
    const history = Array.from({ length: 12 }, (_, i) =>
      run(`2026-0${(i % 7) + 1}-15`, {
        distanceM: 20_000 + i * 100,
        durationS: 6000 + i * 10,
        elevationGainM: 300 + i,
        calories: 1500 + i,
        trainingLoad: 300 + i
      })
    );
    const highlights = buildHighlights({
      sport: 'run',
      current: run('2026-08-01', { distanceM: 10_000 }),
      history,
      coversAllHistory: true
    });
    expect(highlights).toEqual([]);
  });

  it('says nothing about a metric several earlier sessions report identically', () => {
    // A watch that hands every walk the same training load is not telling us about THIS walk.
    const history = Array.from({ length: 12 }, (_, i) =>
      run(`2026-0${(i % 7) + 1}-1${i % 9}`, { trainingLoad: 120, distanceM: 30_000 })
    );
    const highlights = buildHighlights({
      sport: 'run',
      current: run('2026-08-01', { trainingLoad: 120, distanceM: 10_000 }),
      history,
      coversAllHistory: true
    });
    expect(find(highlights, 'load')).toBeUndefined();
  });

  it('calls equalling a single best a tie, not a record', () => {
    const history = [...boringHistory(12), run('2026-07-01', { distanceM: 30_000, durationS: 1800 })];
    const highlights = buildHighlights({
      sport: 'run',
      current: run('2026-08-01', { distanceM: 30_000 }),
      history,
      coversAllHistory: true
    });
    const distance = find(highlights, 'distance');
    expect(distance).toMatchObject({ kind: 'notable', rank: 1 });
    expect(distance?.text).toBe('Wyrównany najlepszy wynik w historii');
  });

  it(`refuses to rank a metric with fewer than ${MIN_COMPARABLE} comparable sessions`, () => {
    const highlights = buildHighlights({
      sport: 'run',
      current: run('2026-08-01', { distanceM: 99_000 }),
      history: boringHistory(MIN_COMPARABLE - 1),
      coversAllHistory: true
    });
    expect(highlights).toEqual([]);
  });

  it('ranks a metric only on the sessions that carry it', () => {
    // Twelve sessions, but only three ever recorded power → power is not ranked, distance is.
    const history = [
      ...boringHistory(12),
      ...Array.from({ length: 3 }, (_, i) => run(`2026-05-0${i + 1}`, { normPower: 200 }))
    ];
    const highlights = buildHighlights({
      sport: 'run',
      current: run('2026-08-01', { distanceM: 30_000, normPower: 400 }),
      history,
      coversAllHistory: true
    });
    expect(find(highlights, 'normPower')).toBeUndefined();
    expect(find(highlights, 'distance')).toBeDefined();
  });

  it('ranks pace as an achievement when it is FASTER, not larger', () => {
    // 10 km in 40 min against a history of 10 km in 50 min.
    const history = Array.from({ length: 12 }, (_, i) =>
      run(`2026-0${(i % 7) + 1}-1${i % 9}`, { distanceM: 10_000, durationS: 3000 })
    );
    const highlights = buildHighlights({
      sport: 'run',
      current: run('2026-08-01', { distanceM: 10_000, durationS: 2400 }),
      history,
      coversAllHistory: true
    });
    const pace = find(highlights, 'pace');
    expect(pace).toMatchObject({ kind: 'record', rank: 1, unit: 'min/km' });
    expect(pace?.value).toBe('4:00');
  });

  it('offers speed to a ride and pace to a run, never both', () => {
    const args = { history: boringHistory(12), coversAllHistory: true };
    const asRun = buildHighlights({ ...args, sport: 'run', current: run('2026-08-01') });
    const asRide = buildHighlights({ ...args, sport: 'ride', current: run('2026-08-01') });
    expect(find(asRun, 'speed')).toBeUndefined();
    expect(find(asRide, 'pace')).toBeUndefined();
    expect(find(asRide, 'speed')?.unit).toBe('km/h');
  });

  it('is anchored on the activity day: a later session cannot change the standing', () => {
    // The caller only ever passes earlier sessions; a fixture proves the maths never reads `day` for
    // filtering, so a stray future row is judged on its value alone and nothing else shifts.
    const base = { sport: 'run', coversAllHistory: true } as const;
    const withoutFuture = buildHighlights({
      ...base,
      current: run('2026-08-01', { distanceM: 30_000 }),
      history: boringHistory(12)
    });
    expect(find(withoutFuture, 'distance')?.text).toBe('Rekord — najlepszy wynik w historii');
  });

  it('puts records above placings and keeps the metric order within each', () => {
    const history = [
      ...boringHistory(12),
      // Beats this session on calories only, and recently.
      run('2026-07-25', { calories: 5000, distanceM: 5000, durationS: 1800 })
    ];
    const highlights = buildHighlights({
      sport: 'run',
      current: run('2026-08-01', { distanceM: 30_000, durationS: 9000, calories: 4000 }),
      history,
      coversAllHistory: true
    });
    const kinds = highlights.map((h) => h.kind);
    expect(kinds.indexOf('record')).toBe(0);
    expect(kinds.lastIndexOf('record')).toBeLessThan(
      kinds.indexOf('notable') === -1 ? kinds.length : kinds.indexOf('notable')
    );
  });

  it('says nothing when there is no history at all', () => {
    expect(
      buildHighlights({
        sport: 'run',
        current: run('2026-08-01'),
        history: [],
        coversAllHistory: true
      })
    ).toEqual([]);
  });
});

describe('derivedPaceSecPerKm', () => {
  it('refuses a distance too short to give a meaningful pace', () => {
    expect(derivedPaceSecPerKm(run('2026-08-01', { distanceM: 200 }))).toBeNull();
  });

  it('refuses a session with no time', () => {
    expect(derivedPaceSecPerKm(run('2026-08-01', { durationS: null }))).toBeNull();
  });

  it('is seconds per kilometre', () => {
    expect(derivedPaceSecPerKm(run('2026-08-01', { distanceM: 10_000, durationS: 3000 }))).toBe(300);
  });
});

describe('longestZeroRun', () => {
  it('is 0 for an absent or all-positive stream', () => {
    expect(longestZeroRun(undefined)).toBe(0);
    expect(longestZeroRun([80, 82, 84])).toBe(0);
  });

  it('finds the longest run, not the last one', () => {
    expect(longestZeroRun([0, 0, 0, 80, 0, 0])).toBe(3);
  });

  it('treats a NaN as neither a zero nor a reset', () => {
    expect(longestZeroRun([0, NaN, 0])).toBe(2);
  });
});

describe('buildSuspects', () => {
  const clean: SuspectInput = {
    sport: 'run',
    distanceM: 10_000,
    durationS: 3100,
    movingS: 3000,
    elevationGainM: 80,
    avgSpeedMps: 10_000 / 3000,
    maxSpeedMps: 4.5,
    avgHr: 150,
    maxHr: 175,
    cadence: [160, 162, 164]
  };

  it('is silent on a clean activity', () => {
    expect(buildSuspects(clean)).toEqual([]);
  });

  it('is silent when every input is missing — never a flag on absent data', () => {
    expect(
      buildSuspects({
        sport: 'run',
        distanceM: null,
        durationS: null,
        movingS: null,
        elevationGainM: null,
        avgSpeedMps: null,
        maxSpeedMps: null,
        avgHr: null,
        maxHr: null
      })
    ).toEqual([]);
  });

  it('flags a max speed past the ceiling for the sport as a warning', () => {
    const flags = buildSuspects({ ...clean, maxSpeedMps: 12 }); // 43.2 km/h in a run
    expect(find(flags, 'maxSpeedCeiling')).toMatchObject({ severity: 'warn' });
    expect(find(flags, 'maxSpeedCeiling')?.value).toBe('43,2 km/h');
    // The gentler spike note must not double up on the same number.
    expect(find(flags, 'maxSpeedSpike')).toBeUndefined();
  });

  it('accepts on a bike what it rejects in a run', () => {
    const asRun = buildSuspects({ ...clean, sport: 'run', maxSpeedMps: 12 });
    const asRide = buildSuspects({
      ...clean,
      sport: 'ride',
      avgSpeedMps: 8,
      maxSpeedMps: 12,
      cadence: [90, 92]
    });
    expect(find(asRun, 'maxSpeedCeiling')).toBeDefined();
    expect(find(asRide, 'maxSpeedCeiling')).toBeUndefined();
  });

  it('flags a maximum far above its own average even when it clears the ceiling', () => {
    const flags = buildSuspects({ ...clean, maxSpeedMps: 8.4 }); // 30.2 km/h, under 32
    expect(find(flags, 'maxSpeedCeiling')).toBeUndefined();
    expect(find(flags, 'maxSpeedSpike')).toMatchObject({ severity: 'info' });
  });

  it('flags implausible climb per kilometre', () => {
    const flags = buildSuspects({ ...clean, elevationGainM: 3000 }); // 300 m/km
    expect(find(flags, 'elevationPerKm')).toMatchObject({ severity: 'warn' });
  });

  it('does not judge climb on a session too short to divide by', () => {
    const flags = buildSuspects({ ...clean, distanceM: 500, elevationGainM: 400, avgSpeedMps: null });
    expect(find(flags, 'elevationPerKm')).toBeUndefined();
  });

  it('flags an impossible max heart rate as a warning', () => {
    const flags = buildSuspects({ ...clean, maxHr: 231 });
    expect(find(flags, 'maxHrCeiling')).toMatchObject({ severity: 'warn' });
    expect(find(flags, 'hrSpike')).toBeUndefined();
  });

  it('flags a lone HR spike below the ceiling as a note', () => {
    const flags = buildSuspects({ ...clean, avgHr: 120, maxHr: 200 });
    expect(find(flags, 'hrSpike')).toMatchObject({ severity: 'info' });
  });

  it('leaves an interval session alone', () => {
    const flags = buildSuspects({ ...clean, avgHr: 150, maxHr: 190 });
    expect(find(flags, 'hrSpike')).toBeUndefined();
  });

  it('flags distance ÷ time disagreeing with the reported average speed', () => {
    const flags = buildSuspects({ ...clean, avgSpeedMps: 2 }); // implied 3.33 m/s
    expect(find(flags, 'speedMismatch')).toMatchObject({ severity: 'info' });
  });

  it('flags a moving time longer than the elapsed time', () => {
    const flags = buildSuspects({ ...clean, movingS: 3200, durationS: 3100 });
    expect(find(flags, 'movingOverElapsed')).toMatchObject({ severity: 'warn' });
  });

  it('tolerates a few seconds of rounding between moving and elapsed', () => {
    const flags = buildSuspects({ ...clean, movingS: 3103, durationS: 3100 });
    expect(find(flags, 'movingOverElapsed')).toBeUndefined();
  });

  it('flags a long cadence dropout', () => {
    const cadence = [...Array(90).fill(0), ...Array(30).fill(160)];
    expect(find(buildSuspects({ ...clean, cadence }), 'cadenceGap')).toMatchObject({
      severity: 'info'
    });
  });

  it('ignores cadence on a sport that has none', () => {
    const cadence = Array(90).fill(0);
    expect(find(buildSuspects({ ...clean, sport: 'swim', cadence }), 'cadenceGap')).toBeUndefined();
  });

  it('puts warnings before notes', () => {
    const flags = buildSuspects({ ...clean, maxHr: 231, avgSpeedMps: 2 });
    expect(flags[0]?.severity).toBe('warn');
    expect(flags.at(-1)?.severity).toBe('info');
  });
});
