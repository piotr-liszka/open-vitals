/** Spec 086 — the one band table the maths and the explanation both read. */
import { describe, it, expect } from 'vitest';
import { CATALOGS } from '$lib/i18n';
import {
  formatZoneBand,
  HR_ZONE_BANDS,
  POWER_ZONE_BANDS,
  POWER_ZONE_COPY,
  POWER_ZONE_NAME_KEYS,
  POWER_ZONE_USE_KEYS,
  zoneForPct,
  type ZoneBand
} from './zones';

/** Every band starts where the previous one ended — no gaps, no overlaps, nothing unbucketable. */
function assertContiguous(bands: readonly ZoneBand[]): void {
  expect(bands[0]?.fromPct).toBe(0);
  for (let i = 1; i < bands.length; i++) {
    expect(bands[i]?.fromPct).toBe(bands[i - 1]?.toPct);
    expect(bands[i]?.zone).toBe(i + 1);
  }
  expect(bands[bands.length - 1]?.toPct).toBeNull();
}

describe('zone bands', () => {
  it('covers the whole percentage axis, in order, for power and heart rate', () => {
    assertContiguous(POWER_ZONE_BANDS);
    assertContiguous(HR_ZONE_BANDS);
    expect(POWER_ZONE_BANDS).toHaveLength(7);
    expect(HR_ZONE_BANDS).toHaveLength(5);
  });
});

describe('zoneForPct', () => {
  // The Coggan boundaries, from each side.
  const powerCases: ReadonlyArray<readonly [number, number]> = [
    [0, 1],
    [54, 1],
    [55, 2],
    [75, 2],
    [76, 3],
    [90, 3],
    [91, 4],
    [105, 4],
    [106, 5],
    [120, 5],
    [121, 6],
    [150, 6],
    [151, 7],
    [400, 7]
  ];

  it.each(powerCases)('puts %i%% of FTP in Z%i', (pct, zone) => {
    expect(zoneForPct(POWER_ZONE_BANDS, pct)).toBe(zone);
  });

  const hrCases: ReadonlyArray<readonly [number, number]> = [
    [0, 1],
    [59, 1],
    [60, 2],
    [69, 2],
    [70, 3],
    [79, 3],
    [80, 4],
    [89, 4],
    [90, 5],
    [100, 5]
  ];

  it.each(hrCases)('puts %i%% of max HR in Z%i', (pct, zone) => {
    expect(zoneForPct(HR_ZONE_BANDS, pct)).toBe(zone);
  });

  it('behaves like the original if-chain on values that are not numbers to compare', () => {
    // Every `<` against NaN is false, so the open-ended top band takes it — as before.
    expect(zoneForPct(POWER_ZONE_BANDS, Number.NaN)).toBe(7);
    expect(zoneForPct(HR_ZONE_BANDS, Number.NaN)).toBe(5);
    // Negative power (a sensor glitch) is bottom zone, not an exception.
    expect(zoneForPct(POWER_ZONE_BANDS, -10)).toBe(1);
  });
});

describe('formatZoneBand', () => {
  it('reads the bands the way the sport quotes them', () => {
    expect(POWER_ZONE_BANDS.map(formatZoneBand)).toEqual([
      '<55%',
      '55–75%',
      '76–90%',
      '91–105%',
      '106–120%',
      '121–150%',
      '≥151%'
    ]);
    expect(HR_ZONE_BANDS.map(formatZoneBand)).toEqual(['<60%', '60–69%', '70–79%', '80–89%', '≥90%']);
  });
});

describe('power zone copy', () => {
  it('pairs every band with a name and a purpose key', () => {
    expect(POWER_ZONE_NAME_KEYS).toHaveLength(POWER_ZONE_BANDS.length);
    expect(POWER_ZONE_USE_KEYS).toHaveLength(POWER_ZONE_BANDS.length);
    expect(POWER_ZONE_COPY.map((z) => z.zone)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(POWER_ZONE_COPY[3]?.range).toBe('91–105%');
  });

  it('names keys that exist in both catalogs, so no zone renders as a raw key', () => {
    for (const zone of POWER_ZONE_COPY) {
      expect(CATALOGS.pl[zone.nameKey]).toBeTruthy();
      expect(CATALOGS.en[zone.nameKey]).toBeTruthy();
      expect(CATALOGS.pl[zone.useKey]).toBeTruthy();
      expect(CATALOGS.en[zone.useKey]).toBeTruthy();
    }
  });
});
