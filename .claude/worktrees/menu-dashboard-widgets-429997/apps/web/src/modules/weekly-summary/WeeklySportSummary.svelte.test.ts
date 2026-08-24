import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import WeeklySportSummary from './WeeklySportSummary.svelte';
import {
  WEEKLY_SUMMARY_WEEKS,
  type WeeklySummaryData,
  type WeeklySummarySport,
  type WeeklySummaryWeek
} from './weekly-summary.types';

afterEach(cleanup);

const WEEK_STARTS = [
  '2026-05-25',
  '2026-06-01',
  '2026-06-08',
  '2026-06-15',
  '2026-06-22',
  '2026-06-29',
  '2026-07-06',
  '2026-07-13',
  '2026-07-20',
  '2026-07-27',
  '2026-08-03',
  '2026-08-10'
];

function weeks(distances: number[]): WeeklySummaryWeek[] {
  return WEEK_STARTS.map((week, i) => ({
    week,
    activities: distances[i] ? 1 : 0,
    distanceM: distances[i] ?? 0,
    durationS: (distances[i] ?? 0) / 3,
    elevationGainM: 0,
    partial: i === WEEK_STARTS.length - 1
  }));
}

function sport(over: Partial<WeeklySummarySport> = {}): WeeklySummarySport {
  const weekly = over.weekly ?? weeks([0, 0, 0, 0, 0, 0, 0, 0, 0, 40_000, 52_000, 21_500]);
  return {
    group: 'run',
    label: 'Bieg',
    color: 'var(--lane-orange)',
    thisWeek: { activities: 2, distanceM: 21_500, durationS: 7_200, elevationGainM: 145 },
    window: { activities: 9, distanceM: 113_500, durationS: 40_000, elevationGainM: 900 },
    ...over,
    weekly
  };
}

const data = (over: Partial<WeeklySummaryData> = {}): WeeklySummaryData => ({
  weeks: WEEKLY_SUMMARY_WEEKS,
  weekStarts: WEEK_STARTS,
  monthLabels: ['maj', 'cze', '', '', '', '', 'lip', '', '', '', 'sie', ''],
  currentWeekStart: '2026-08-10',
  currentWeekDays: 3,
  sports: [sport()],
  defaultGroup: 'run',
  hasData: true,
  ...over
});

const rideWeekly = weeks([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 90_000, 62_000]);
const ride = sport({
  group: 'ride',
  label: 'Rower',
  color: 'var(--lane-cyan)',
  thisWeek: { activities: 1, distanceM: 62_000, durationS: 9_000, elevationGainM: 640 },
  window: { activities: 2, distanceM: 152_000, durationS: 20_000, elevationGainM: 1_400 },
  weekly: rideWeekly
});

describe('WeeklySportSummary', () => {
  it('renders a chip per family with the busiest (first) one pre-selected', () => {
    const { getByRole } = render(WeeklySportSummary, {
      props: { data: data({ sports: [ride, sport()], defaultGroup: 'ride' }) }
    });

    const group = getByRole('group', { name: 'Sport' });
    const chips = [...group.querySelectorAll('button')];
    expect(chips.map((c) => c.textContent?.trim())).toEqual(['Rower', 'Bieg']);
    // No "Wszystkie" chip: a combined ride+run distance would be a meaningless number.
    expect(chips.map((c) => c.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
  });

  it('re-renders the whole card for the family a chip selects', async () => {
    const { getByRole, getByText, container } = render(WeeklySportSummary, {
      props: { data: data({ sports: [ride, sport()], defaultGroup: 'ride' }) }
    });

    // Opens on the ride: 62 km this week, in the ride lane colour.
    expect(getByText('62')).toBeTruthy();
    expect(container.querySelector('.chart')?.getAttribute('style')).toContain('var(--lane-cyan)');

    await fireEvent.click(getByRole('button', { name: 'Bieg' }));

    expect(getByText('21,5')).toBeTruthy();
    expect(container.querySelector('.chart')?.getAttribute('style')).toContain('var(--lane-orange)');
    expect(getByRole('button', { name: 'Bieg' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('headlines distance, elevation and time for the week to date', () => {
    const { getByText } = render(WeeklySportSummary, { props: { data: data() } });
    expect(getByText('Dystans')).toBeTruthy();
    expect(getByText('21,5')).toBeTruthy();
    expect(getByText('Przewyższenie')).toBeTruthy();
    expect(getByText('145')).toBeTruthy();
    expect(getByText('Czas')).toBeTruthy();
    expect(getByText('2 h 0 min')).toBeTruthy();
  });

  it('says in words that the last point is a partial week', () => {
    const { getByText } = render(WeeklySportSummary, { props: { data: data() } });
    expect(getByText(/od poniedziałku/)).toBeTruthy();
    expect(getByText(/3 z 7 dni/)).toBeTruthy();
    expect(getByText(/bieżący, niepełny tydzień/)).toBeTruthy();
  });

  it('emphasises the week in progress on the chart, and says so in the accessible summary', () => {
    const { container } = render(WeeklySportSummary, { props: { data: data() } });
    expect(container.querySelectorAll('circle.emphasis-dot')).toHaveLength(1);
    expect(container.querySelector('line.emphasis-rule')).not.toBeNull();
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toContain('bieżący tydzień (w toku)');
  });

  it('carries no range badge — its window is fixed and the global switch must not seem to move it', () => {
    const { container, getByText } = render(WeeklySportSummary, { props: { data: data() } });
    expect(container.querySelector('.range-badge')).toBeNull();
    expect(getByText(/niezależne od zakresu/)).toBeTruthy();
  });

  it('explains an empty window instead of drawing an empty chart', () => {
    const { container, getByText } = render(WeeklySportSummary, {
      props: { data: data({ sports: [], defaultGroup: null, hasData: false }) }
    });
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('[role="group"]')).toBeNull();
    expect(getByText(/Brak treningów z ostatnich 12 tygodni/)).toBeTruthy();
  });

  it('links on to the fuller volume view', () => {
    const { getByRole } = render(WeeklySportSummary, { props: { data: data() } });
    expect(getByRole('link', { name: /Pełny widok objętości/ }).getAttribute('href')).toBe(
      '/training/objetosc'
    );
  });
});
