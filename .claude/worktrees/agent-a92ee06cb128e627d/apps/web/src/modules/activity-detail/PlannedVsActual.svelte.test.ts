import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import PlannedVsActual from './PlannedVsActual.svelte';
import type {
  PlannedStepComparison,
  PlannedWorkoutComparison,
  TrainingComparison
} from './activity-detail.types';

afterEach(cleanup);

const step = (over: Partial<PlannedStepComparison>): PlannedStepComparison => ({
  key: 'duration',
  target: 3600,
  targetLow: null,
  targetHigh: null,
  actual: 3600,
  met: true,
  ...over
});

const plan = (over: Partial<PlannedWorkoutComparison>): PlannedWorkoutComparison => ({
  workoutId: 'p1',
  name: 'Próg 4×8',
  scheduledDay: '2026-05-01',
  kind: 'workout',
  origin: 'authored',
  description: null,
  targetDurationS: 3600,
  targetDistanceM: null,
  targetLoad: null,
  steps: [step({})],
  compliancePct: 100,
  ...over
});

const comparison = (over: Partial<TrainingComparison>): TrainingComparison => ({
  load: 90,
  loadMethod: 'garmin',
  recentMedianLoad: 80,
  recentCount: 5,
  vsRecentPct: 12,
  ctlBefore: 40,
  atlBefore: 45,
  tsbBefore: -5,
  bandBefore: 'neutral',
  loadRatio: 2.25,
  verdict: 'hard',
  summary: 'Podsumowanie.',
  windowDays: 42,
  plannedWorkout: plan({}),
  plannedWorkoutStatus: 'linked',
  plannedTakeaways: [],
  ...over
});

const rows = (container: HTMLElement): HTMLTableRowElement[] => [
  ...container.querySelectorAll<HTMLTableRowElement>('tbody tr')
];

describe('PlannedVsActual', () => {
  it('renders nothing at all when no plan matched', () => {
    const { container } = render(PlannedVsActual, {
      props: { comparison: comparison({ plannedWorkout: null, plannedWorkoutStatus: 'none-scheduled' }) }
    });
    expect(container.textContent?.trim()).toBe('');
  });

  it('renders nothing when there is no comparison at all', () => {
    const { container } = render(PlannedVsActual, { props: { comparison: null } });
    expect(container.textContent?.trim()).toBe('');
  });

  it('leads with the adherence percentage and names the plan', () => {
    const { container } = render(PlannedVsActual, {
      props: { comparison: comparison({ plannedWorkout: plan({ compliancePct: 83 }) }) }
    });
    expect(container.querySelector('.score-value')?.textContent).toBe('83%');
    expect(container.querySelector('.name')?.textContent).toBe('Próg 4×8');
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('83');
  });

  it('says which half of the plan this came from', () => {
    const authored = render(PlannedVsActual, { props: { comparison: comparison({}) } });
    expect(authored.container.textContent).toContain('Twój plan');

    cleanup();
    const garmin = render(PlannedVsActual, {
      props: { comparison: comparison({ plannedWorkout: plan({ origin: 'garmin' }) }) }
    });
    expect(garmin.container.textContent).toContain('Plan z Garmina');
  });

  it('draws one row per target, with the plan beside what was held', () => {
    const { container } = render(PlannedVsActual, {
      props: {
        comparison: comparison({
          plannedWorkout: plan({
            steps: [
              step({ key: 'duration', target: 3600, actual: 1800, met: false }),
              step({ key: 'power', target: 260, targetLow: 250, targetHigh: 270, actual: 262, met: true }),
              step({ key: 'hr', target: 155, targetLow: 150, targetHigh: 160, actual: null, met: null })
            ]
          })
        })
      }
    });

    const cells = rows(container).map((row) =>
      [...row.querySelectorAll('th, td')].map((c) => c.textContent?.trim() ?? '')
    );
    expect(cells).toHaveLength(3);
    expect(cells[0]).toEqual(['Czas', '1:00:00', '30:00', 'Poza planem']);
    // A band renders as a band, never as its own midpoint.
    expect(cells[1]).toEqual(['Moc', '250 W – 270 W', '262 W', 'Zgodnie z planem']);
    // Nothing recorded is a dash, not a zero.
    expect(cells[2]).toEqual(['Tętno', '150 bpm – 160 bpm', '—', 'Brak pomiaru']);
  });

  it('reads an open-ended band as an open-ended band', () => {
    const { container } = render(PlannedVsActual, {
      props: {
        comparison: comparison({
          plannedWorkout: plan({
            steps: [
              step({ key: 'power', target: 250, targetLow: 250, targetHigh: null, actual: 260, met: true })
            ]
          })
        })
      }
    });
    expect(rows(container)[0]?.querySelectorAll('td')[0]?.textContent?.trim()).toBe('od 250 W');
  });

  it('shows the plan and says so when nothing about it is measurable', () => {
    const { container } = render(PlannedVsActual, {
      props: {
        comparison: comparison({
          plannedWorkout: plan({ name: 'Rower', steps: [], compliancePct: null })
        })
      }
    });
    expect(container.querySelector('.name')?.textContent).toBe('Rower');
    // No invented percentage.
    expect(container.querySelector('.score-value')).toBeNull();
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    expect(container.textContent).toContain('nie ma mierzalnych celów');
  });

  it('renders the takeaways as finished sentences with their numbers filled in', () => {
    const { container } = render(PlannedVsActual, {
      props: {
        comparison: comparison({
          plannedTakeaways: [
            { key: 'plan.takeaway.under', metric: 'duration', pct: 50 },
            { key: 'plan.takeaway.harder', metric: 'power', pct: 36 }
          ]
        })
      }
    });
    const sentences = [...container.querySelectorAll('.takeaways li')].map((el) =>
      el.textContent?.trim().replace(/\s+/g, ' ')
    );
    expect(sentences).toEqual([
      'Czas o 50% poniżej planu — następnym razem dokończ sesję zgodnie z planem.',
      'Sesja wyszła o 36% mocniej, niż zakładał plan (Moc) — następnym razem trzymaj przedział z planu.'
    ]);
  });

  it('leaves the takeaway block out entirely when the plan was met', () => {
    const { container } = render(PlannedVsActual, {
      props: { comparison: comparison({ plannedTakeaways: [] }) }
    });
    expect(container.querySelector('.takeaways')).toBeNull();
  });
});
