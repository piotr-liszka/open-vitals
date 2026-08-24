/**
 * Spec 072 — "/dane" has to separate two things it used to conflate: how long ago WE synced, and how
 * current the data we pulled actually is.
 *
 * On 2026-08-16 the panel said "Ostatnia synchronizacja: 13:57 · ok" and "Historia metryk dziennych
 * jest kompletna" while the newest day Garmin held anything for was the 14th — the watch had not
 * uploaded since Thursday evening. Both statements were true; together they sent the user to run a
 * full sync, the one lever that could not possibly help.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import DataView from './DataView.svelte';
import type { CoverageSnapshot } from '$lib/server/store/types';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));

function coverage(over: Partial<CoverageSnapshot> = {}): CoverageSnapshot {
  return {
    metrics: [{ metric: 'steps', firstDay: '2026-01-01', lastDay: '2026-08-14', presentDays: 200 }],
    activities: {
      count: 12,
      withGps: 8,
      withWorkoutId: 5,
      firstStart: '2026-01-02 08:00:00',
      lastStart: '2026-08-14 18:00:00',
      totalDistanceM: 480_000
    },
    weight: { count: 3, firstDay: '2026-02-01', lastDay: '2026-08-01' },
    earliest: '2026-01-01',
    freshness: { lastDataDay: '2026-08-14', staleDays: 0 },
    storage: {
      totalBytes: 1_000_000,
      rows: { metricDays: 400, activities: 12, streams: 8, weight: 3 }
    },
    ...over
  };
}

afterEach(cleanup);

describe('DataView — is GARMIN behind? (spec 072)', () => {
  it('stays quiet when Garmin has today', () => {
    const { container } = render(DataView, {
      props: { coverage: coverage(), lastRun: null, connected: true }
    });
    expect(container.textContent).not.toContain('Garmin ma dane najwyżej');
  });

  it('names the newest day Garmin holds, and points at the watch rather than at the sync', () => {
    const { container } = render(DataView, {
      props: {
        coverage: coverage({ freshness: { lastDataDay: '2026-08-14', staleDays: 2 } }),
        lastRun: null,
        connected: true
      }
    });

    expect(container.textContent).toContain('Garmin ma dane najwyżej z');
    expect(container.textContent).toContain('14 sie');
    expect(container.textContent).toContain('2 dni temu');
    // The whole point of the copy: re-running OUR sync is not the fix.
    expect(container.textContent).toContain('Garmin Connect');
  });

  it('reads naturally for a single day behind', () => {
    const { container } = render(DataView, {
      props: {
        coverage: coverage({ freshness: { lastDataDay: '2026-08-15', staleDays: 1 } }),
        lastRun: null,
        connected: true
      }
    });
    expect(container.textContent).toContain('wczoraj');
  });

  it('says nothing about freshness when the account is not connected', () => {
    // There is a better banner for that case, and two stacked warnings bury the actionable one.
    const { container } = render(DataView, {
      props: {
        coverage: coverage({ freshness: { lastDataDay: '2026-08-14', staleDays: 2 } }),
        lastRun: null,
        connected: false
      }
    });
    expect(container.textContent).not.toContain('Garmin ma dane najwyżej');
    expect(container.textContent).toContain('Konto Garmin nie jest połączone');
  });

  it('says nothing when the store is empty — unknown age is not a stale one', () => {
    const { container } = render(DataView, {
      props: {
        coverage: coverage({ freshness: { lastDataDay: null, staleDays: null } }),
        lastRun: null,
        connected: true
      }
    });
    expect(container.textContent).not.toContain('Garmin ma dane najwyżej');
  });
});

/**
 * Spec 081. The premise behind the plan/actual link — that Garmin stamps the scheduled workout's id
 * on the activity — can only be confirmed by what arrives in production, and this counter is the
 * only place the athlete can see it without a database shell.
 */
describe('DataView — how many activities carry a workout id (spec 081)', () => {
  it('counts the activities linked to a plan beside the GPS count', () => {
    const { container } = render(DataView, {
      props: { coverage: coverage(), lastRun: null, connected: true }
    });

    expect(container.textContent).toContain('8 z GPS');
    expect(container.textContent).toContain('5 z planu');
  });

  it('says zero rather than hiding the row, because zero is the answer that matters', async () => {
    const { container, getByRole } = render(DataView, {
      props: {
        coverage: coverage({
          activities: {
            count: 12,
            withGps: 8,
            withWorkoutId: 0,
            firstStart: '2026-01-02 08:00:00',
            lastStart: '2026-08-14 18:00:00',
            totalDistanceM: 480_000
          }
        }),
        lastRun: null,
        connected: true
      }
    });

    expect(container.textContent).toContain('0 z planu');
    // And what "z planu" means, so a zero is readable without the spec in hand — behind the (?)
    // InfoPopover next to the line, not as a permanently-visible paragraph.
    const help = getByRole('button', { name: 'Co znaczy „z planu”?' });
    await help.click();
    expect(container.textContent).toContain('rozpoczęte z zaplanowanego treningu');
  });
});
