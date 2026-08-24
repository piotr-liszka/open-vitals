import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import BestEffortsCard from './BestEffortsCard.svelte';
import type { BestEffortDistance, BestEffortsData } from './best-efforts.types';

afterEach(cleanup);

function distance(over: Partial<BestEffortDistance> = {}): BestEffortDistance {
  return {
    key: '5k',
    label: '5 km',
    metres: 5000,
    entries: [
      {
        rank: 1,
        key: '5k',
        durationS: 1234,
        paceSecPerKm: 246.8,
        actualM: 5004,
        activityId: 'best',
        activityName: 'Tempo',
        sport: 'running',
        day: '2026-03-11'
      },
      {
        rank: 2,
        key: '5k',
        durationS: 1300,
        paceSecPerKm: 260,
        actualM: 5002,
        activityId: 'second',
        activityName: 'Wybieganie',
        sport: 'running',
        day: '2025-11-02'
      }
    ],
    ...over
  };
}

const data = (over: Partial<BestEffortsData> = {}): BestEffortsData => ({
  distances: [distance()],
  topN: 3,
  hasData: true,
  ...over
});

describe('BestEffortsCard', () => {
  it('explains the empty state instead of showing an empty podium', () => {
    const { container, getByText } = render(BestEffortsCard, {
      props: { data: data({ distances: [], hasData: false }) }
    });
    expect(container.querySelectorAll('.row')).toHaveLength(0);
    expect(getByText(/Brak rekordów/)).toBeTruthy();
  });

  it('renders one section per distance, labelled', () => {
    const { container } = render(BestEffortsCard, {
      props: {
        data: data({
          distances: [distance({ key: '1k', label: '1 km', metres: 1000 }), distance()]
        })
      }
    });
    const names = [...container.querySelectorAll('.dist-name')].map((n) => n.textContent?.trim());
    expect(names).toEqual(['1 km', '5 km']);
  });

  it('marks the record as PR and leaves the rest plainly numbered', () => {
    const { container } = render(BestEffortsCard, { props: { data: data() } });
    const medals = [...container.querySelectorAll('.medal')].map((m) => m.textContent?.trim());
    expect(medals).toEqual(['PR', '2']);
    // Rank 1 is the visually loud row; rank 2 is not.
    const rows = container.querySelectorAll('.row');
    expect(rows[0]?.classList.contains('top')).toBe(true);
    expect(rows[1]?.classList.contains('top')).toBe(false);
  });

  it('formats the time, the pace and the local date', () => {
    const { container } = render(BestEffortsCard, { props: { data: data() } });
    const first = container.querySelector('.row');
    expect(first?.querySelector('.time')?.textContent?.trim()).toBe('20:34');
    expect(first?.querySelector('.pace')?.textContent?.replace(/\s+/g, '')).toBe('4:07/km');
    expect(first?.querySelector('.day')?.textContent?.trim()).toBe('11 mar 2026');
  });

  it('shows the hour for an effort over an hour long', () => {
    const { container } = render(BestEffortsCard, {
      props: {
        data: data({
          distances: [
            distance({
              entries: [
                {
                  rank: 1,
                  key: 'half',
                  durationS: 5461,
                  paceSecPerKm: 258.8,
                  actualM: 21_100,
                  activityId: 'hm',
                  activityName: 'Półmaraton',
                  sport: 'running',
                  day: '2026-04-19'
                }
              ]
            })
          ]
        })
      }
    });
    expect(container.querySelector('.time')?.textContent?.trim()).toBe('1:31:01');
  });

  it('links every row to the activity behind it — a record you cannot open is a claim you cannot check', () => {
    const { container } = render(BestEffortsCard, { props: { data: data() } });
    const hrefs = [...container.querySelectorAll('a.row')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/activities/best', '/activities/second']);
  });

  it('states how many results a distance can show, from the data rather than a hardcoded 3', async () => {
    const { getByRole } = render(BestEffortsCard, { props: { data: data({ topN: 5 }) } });
    const trigger = getByRole('button', { name: 'Jak liczymy te rekordy?' });
    await trigger.click();
    const panel = getByRole('group', { name: 'Jak liczymy te rekordy?' });
    expect(panel.textContent).toMatch(/do\s*5\s*najlepszych/);
  });
});
