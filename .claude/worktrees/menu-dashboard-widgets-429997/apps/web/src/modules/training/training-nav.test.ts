import { describe, it, expect } from 'vitest';
import type { SportCount } from '$lib/server/store/types';
import { groupCounts, trainingTabs, trainingTitle } from './training-nav';

describe('training section navigation', () => {
  it('shows the overview and goals when the user has no activities', () => {
    // Goals is the one tab that does not depend on synced activities (spec 060): an empty account is
    // exactly the one with a first race to put on the calendar.
    expect(trainingTabs([])).toEqual([
      { href: '/training', label: 'Przegląd' },
      { href: '/training/plan', label: 'Plan treningowy' },
      { href: '/training/cele', label: 'Cele' }
    ]);
  });

  it('renders a tab only for sport families the user actually has', () => {
    const sports: SportCount[] = [
      { sport: 'running', count: 40 },
      { sport: 'trail_running', count: 4 },
      { sport: 'lap_swimming', count: 12 }
    ];

    // Swimming has no analysis subpage yet, and there is no cycling at all → one sport tab.
    expect(trainingTabs(sports)).toEqual([
      { href: '/training', label: 'Przegląd' },
      { href: '/training/objetosc', label: 'Objętość' },
      { href: '/training/bieg', label: 'Bieg', count: 44 },
      { href: '/training/plan', label: 'Plan treningowy' },
      { href: '/training/cele', label: 'Cele' }
    ]);
  });

  it('orders sport tabs ride → run → walk and sums keys within a family', () => {
    const sports: SportCount[] = [
      { sport: 'hiking', count: 3 },
      { sport: 'running', count: 10 },
      { sport: 'gravel_cycling', count: 5 },
      { sport: 'virtual_ride', count: 7 },
      { sport: 'walking', count: 2 }
    ];

    expect(trainingTabs(sports)).toEqual([
      { href: '/training', label: 'Przegląd' },
      { href: '/training/objetosc', label: 'Objętość' },
      { href: '/training/rower', label: 'Rower', count: 12 },
      { href: '/training/bieg', label: 'Bieg', count: 10 },
      { href: '/training/marsz', label: 'Marsz', count: 5 },
      { href: '/training/plan', label: 'Plan treningowy' },
      { href: '/training/cele', label: 'Cele' }
    ]);
  });

  it('offers the cross-sport volume tab to anyone with an activity, whatever the sport', () => {
    // Swimming has no subpage of its own, but a swimmer still has months and years to compare.
    expect(trainingTabs([{ sport: 'lap_swimming', count: 3 }])).toEqual([
      { href: '/training', label: 'Przegląd' },
      { href: '/training/objetosc', label: 'Objętość' },
      { href: '/training/plan', label: 'Plan treningowy' },
      { href: '/training/cele', label: 'Cele' }
    ]);
    // …and nobody with nothing synced sees it.
    expect(trainingTabs([])).not.toContainEqual({
      href: '/training/objetosc',
      label: 'Objętość'
    });
  });

  it('folds unknown sport keys into the "other" family rather than dropping them', () => {
    const counts = groupCounts([{ sport: 'brand_new_garmin_sport', count: 3 }]);
    expect(counts.get('other')).toBe(3);
  });

  it('titles the shell per subpage', () => {
    expect(trainingTitle('/training')).toBe('Trening');
    expect(trainingTitle('/training/objetosc')).toBe('Trening · Objętość');
    expect(trainingTitle('/training/rower')).toBe('Trening · Rower');
    expect(trainingTitle('/training/marsz')).toBe('Trening · Marsz');
    expect(trainingTitle('/training/cele')).toBe('Trening · Cele');
    expect(trainingTitle('/training/nieznane')).toBe('Trening');
  });
});

/**
 * Spec 066. The planner is offered on the same terms as `Cele`, and for the same reason: neither is a
 * report on training that already happened, so neither can be gated on having any.
 */
describe('the planner tab (spec 066)', () => {
  it('is offered even to an athlete with no activities at all', () => {
    expect(trainingTabs([]).map((t) => t.href)).toContain('/training/plan');
  });

  it('sits before Cele — a week is decided far more often than a season', () => {
    const hrefs = trainingTabs([{ sport: 'running', count: 4 }]).map((t) => t.href);
    expect(hrefs.indexOf('/training/plan')).toBeLessThan(hrefs.indexOf('/training/cele'));
  });

  it('carries no count — it is a plan, not a tally of what you did', () => {
    const plan = trainingTabs([{ sport: 'running', count: 4 }]).find((t) => t.href === '/training/plan');
    expect(plan?.count).toBeUndefined();
  });

  it('titles the section page', () => {
    expect(trainingTitle('/training/plan')).toBe('Trening · Plan treningowy');
  });
});
