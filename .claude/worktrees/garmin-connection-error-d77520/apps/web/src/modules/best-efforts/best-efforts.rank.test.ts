import { describe, it, expect } from 'vitest';
import { rankBestEfforts } from './best-efforts.rank';
import type { BestEffortRow } from './best-efforts.types';

function row(over: Partial<BestEffortRow> & { key: string; durationS: number }): BestEffortRow {
  return {
    paceSecPerKm: over.durationS,
    actualM: 1000,
    activityId: `a-${over.key}-${over.durationS}`,
    activityName: 'Bieg',
    sport: 'running',
    day: '2026-05-01',
    ...over
  };
}

describe('rankBestEfforts', () => {
  it('groups by distance, shortest distance first', () => {
    const out = rankBestEfforts([row({ key: '5k', durationS: 1200 }), row({ key: '1k', durationS: 210 })], 3);
    expect(out.map((d) => d.key)).toEqual(['1k', '5k']);
    expect(out[0]?.label).toBe('1 km');
    expect(out[0]?.metres).toBe(1000);
  });

  it('ranks fastest first and numbers from 1', () => {
    const out = rankBestEfforts(
      [
        row({ key: '1k', durationS: 240, activityId: 'slow' }),
        row({ key: '1k', durationS: 200, activityId: 'fast' }),
        row({ key: '1k', durationS: 220, activityId: 'mid' })
      ],
      3
    );
    expect(out[0]?.entries.map((e) => [e.rank, e.activityId])).toEqual([
      [1, 'fast'],
      [2, 'mid'],
      [3, 'slow']
    ]);
  });

  it('caps each distance at topN', () => {
    const rows = [300, 280, 260, 240, 220].map((d, i) =>
      row({ key: '1k', durationS: d, activityId: `a${i}` })
    );
    const out = rankBestEfforts(rows, 3);
    expect(out[0]?.entries).toHaveLength(3);
    // The three fastest, not the first three seen.
    expect(out[0]?.entries.map((e) => e.durationS)).toEqual([220, 240, 260]);
  });

  it('breaks a tie in favour of the EARLIER day — the record belongs to whoever set it first', () => {
    const out = rankBestEfforts(
      [
        row({ key: '1k', durationS: 200, day: '2026-05-01', activityId: 'later' }),
        row({ key: '1k', durationS: 200, day: '2024-03-09', activityId: 'first' })
      ],
      2
    );
    expect(out[0]?.entries[0]?.activityId).toBe('first');
    expect(out[0]?.entries[1]?.activityId).toBe('later');
  });

  it('omits distances with no efforts rather than rendering an empty section', () => {
    const out = rankBestEfforts([row({ key: '1k', durationS: 210 })], 3);
    expect(out).toHaveLength(1);
    expect(out.some((d) => d.key === 'marathon')).toBe(false);
  });

  it('drops rows whose distance key is not a known standard distance', () => {
    // A leftover row from an older EFFORT_DISTANCES set has no label — better absent than unlabelled.
    const out = rankBestEfforts([row({ key: '3k', durationS: 600 })], 3);
    expect(out).toEqual([]);
  });

  it('returns nothing when asked for zero rows per distance', () => {
    expect(rankBestEfforts([row({ key: '1k', durationS: 210 })], 0)).toEqual([]);
  });
});
