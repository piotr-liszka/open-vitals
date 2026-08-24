import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import GoalCard from './GoalCard.svelte';
import type { GoalStatus, SeasonGoal } from './season.types';

afterEach(cleanup);

function goal(over: Partial<SeasonGoal> = {}): SeasonGoal {
  return {
    id: 'g-1',
    userId: 'u1',
    day: '2026-10-11',
    sport: 'run',
    title: 'Półmaraton Warszawski',
    kind: 'race',
    priority: 'a',
    distanceM: 21097.5,
    targetTimeS: 5400,
    targetCtl: 70,
    note: null,
    source: 'manual',
    garminEventId: null,
    createdAt: '2026-08-15T09:00:00.000Z',
    updatedAt: '2026-08-15T09:00:00.000Z',
    ...over
  };
}

function status(over: Partial<GoalStatus> = {}): GoalStatus {
  return {
    goal: goal(),
    daysOut: 57,
    weeksOut: 8,
    phase: 'build',
    phaseLabel: 'Budowanie',
    sportLabel: 'Bieg',
    color: 'var(--lane-orange)',
    ctl: 55.2,
    projectedCtl: 70.1,
    rampPerWeek: 2.4,
    requiredRampPerWeek: 2.4,
    taper: null,
    prediction: null,
    status: 'on-track',
    note: 'Obecne tempo dowozi cel na start taperingu.',
    ...over
  };
}

describe('GoalCard', () => {
  it('leads with the countdown and the phase', () => {
    const { getByText } = render(GoalCard, { props: { status: status() } });

    expect(getByText('za 57 dni')).toBeTruthy();
    expect(getByText('Budowanie')).toBeTruthy();
    expect(getByText('Zgodnie z planem')).toBeTruthy();
  });

  it('says "dziś" on race day rather than "za 0 dni"', () => {
    const { getByText } = render(GoalCard, { props: { status: status({ daysOut: 0 }) } });
    expect(getByText('dziś')).toBeTruthy();
  });

  it('shows no trajectory at all for a goal already run', () => {
    const { queryByText, getByText } = render(GoalCard, {
      props: {
        status: status({
          daysOut: -14,
          phase: 'done',
          phaseLabel: 'Po starcie',
          projectedCtl: null,
          rampPerWeek: null,
          requiredRampPerWeek: null,
          status: 'unknown',
          note: 'Cel jest już za Tobą.'
        })
      }
    });

    expect(getByText('14 dni temu')).toBeTruthy();
    expect(queryByText('Dojdziesz do')).toBeNull();
    expect(queryByText('Forma dziś')).toBeNull();
    // No verdict badge either: there is nothing left to be on or off track for.
    expect(queryByText('Brak oceny')).toBeNull();
  });

  it('renders an honest absence, not a zero, under the history floor', () => {
    const { queryByText, getByText } = render(GoalCard, {
      props: {
        status: status({
          ctl: null,
          projectedCtl: null,
          rampPerWeek: null,
          requiredRampPerWeek: null,
          status: 'unknown',
          note: 'Za mało ciągłej historii treningowej.'
        })
      }
    });

    expect(queryByText('Forma dziś')).toBeNull();
    expect(getByText('Brak oceny')).toBeTruthy();
    expect(getByText('Za mało ciągłej historii treningowej.')).toBeTruthy();
  });

  it('names the overload risk in its own colour rather than burying it', () => {
    const { getByText } = render(GoalCard, {
      props: { status: status({ status: 'at-risk', note: 'Forma rośnie za szybko.' }) }
    });

    expect(getByText('Ryzyko przeciążenia')).toBeTruthy();
  });

  it('reports a prediction that misses the target as a shortfall', () => {
    const { getByText } = render(GoalCard, {
      props: {
        status: status({
          prediction: {
            riegelS: 5700,
            criticalSpeedS: null,
            fromLabel: '10 km',
            fromDay: '2026-07-04',
            confident: true,
            gapS: -300
          }
        })
      }
    });

    // 5700 s = 1:35:00 predicted against a 1:30:00 target ⇒ five minutes short.
    expect(getByText('1:35:00')).toBeTruthy();
    expect(getByText(/brakuje 5:00/)).toBeTruthy();
  });

  it('reports a prediction that beats the target as being ahead of it', () => {
    const { getByText } = render(GoalCard, {
      props: {
        status: status({
          prediction: {
            riegelS: 5100,
            criticalSpeedS: null,
            fromLabel: '10 km',
            fromDay: '2026-07-04',
            confident: true,
            gapS: 300
          }
        })
      }
    });

    expect(getByText(/prognoza jest o 5:00 szybsza/)).toBeTruthy();
  });

  it('warns when the extrapolation behind a prediction is too far to trust', () => {
    const { getByText } = render(GoalCard, {
      props: {
        status: status({
          prediction: {
            riegelS: 12000,
            criticalSpeedS: null,
            fromLabel: '1 km',
            fromDay: '2026-07-04',
            confident: false,
            gapS: null
          }
        })
      }
    });

    expect(getByText(/traktuj tę liczbę jako kierunek/)).toBeTruthy();
  });

  it('spells out a flat taper instead of implying the athlete is ready', () => {
    const { getByText } = render(GoalCard, {
      props: {
        status: status({
          daysOut: 5,
          phase: 'race-week',
          phaseLabel: 'Tydzień startowy',
          taper: { recentDailyLoad: 95, baselineDailyLoad: 100, ratio: 0.95, tapering: false },
          note: 'To zwykły tydzień pod nazwą taperingu.'
        })
      }
    });

    expect(getByText('Tapering')).toBeTruthy();
    expect(getByText('To zwykły tydzień pod nazwą taperingu.')).toBeTruthy();
  });

  it('marks a goal adopted from the Garmin calendar as such', () => {
    const { getByText } = render(GoalCard, {
      props: {
        status: status({ goal: goal({ source: 'garmin', garminEventId: 'ev-9' }) }),
        onDelete: () => undefined
      }
    });

    expect(getByText('Zaimportowany z kalendarza Garmin.')).toBeTruthy();
  });

  it('offers no delete control when the page did not pass one', () => {
    const { queryByText } = render(GoalCard, { props: { status: status() } });
    expect(queryByText('Usuń cel')).toBeNull();
  });
});
