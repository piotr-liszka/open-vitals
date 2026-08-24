import { createTranslator } from '$lib/i18n';
import { describe, it, expect } from 'vitest';
import type { SportCount } from '$lib/server/store/types';
import { analysisTabs, groupCounts, planTabs, trainingSection, trainingTitle } from './training-nav';

const t = createTranslator('pl');

describe('training section navigation', () => {
  it('shows only the overview when the user has no activities', () => {
    // Every Analiza tab reports on training that already happened, so an empty account gets the
    // landing page and nothing else. What such an account DOES get is the plan section, which is a
    // sidebar entry away and unconditional.
    expect(analysisTabs(t, [])).toEqual([{ href: '/training', label: 'Przegląd' }]);
  });

  it('renders a tab only for sport families the user actually has', () => {
    const sports: SportCount[] = [
      { sport: 'running', count: 40 },
      { sport: 'trail_running', count: 4 },
      { sport: 'lap_swimming', count: 12 }
    ];

    // Swimming has no analysis subpage yet, and there is no cycling at all → one sport tab.
    expect(analysisTabs(t, sports)).toEqual([
      { href: '/training', label: 'Przegląd' },
      { href: '/training/volume', label: 'Objętość' },
      { href: '/training/run', label: 'Bieg', count: 44 }
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

    expect(analysisTabs(t, sports)).toEqual([
      { href: '/training', label: 'Przegląd' },
      { href: '/training/volume', label: 'Objętość' },
      { href: '/training/ride', label: 'Rower', count: 12 },
      { href: '/training/run', label: 'Bieg', count: 10 },
      { href: '/training/walk', label: 'Marsz', count: 5 }
    ]);
  });

  it('offers the cross-sport volume tab to anyone with an activity, whatever the sport', () => {
    // Swimming has no subpage of its own, but a swimmer still has months and years to compare.
    expect(analysisTabs(t, [{ sport: 'lap_swimming', count: 3 }])).toEqual([
      { href: '/training', label: 'Przegląd' },
      { href: '/training/volume', label: 'Objętość' }
    ]);
    // …and nobody with nothing synced sees it.
    expect(analysisTabs(t, [])).not.toContainEqual({
      href: '/training/volume',
      label: 'Objętość'
    });
  });

  it('keeps the planning pages out of the analysis bar (spec 088)', () => {
    const hrefs = analysisTabs(t, [{ sport: 'running', count: 4 }]).map((tab) => tab.href);
    expect(hrefs).not.toContain('/training/plan');
    expect(hrefs).not.toContain('/training/goals');
  });

  it('folds unknown sport keys into the "other" family rather than dropping them', () => {
    const counts = groupCounts([{ sport: 'brand_new_garmin_sport', count: 3 }]);
    expect(counts.get('other')).toBe(3);
  });
});

/**
 * Spec 088. The bar used to be seven peers — five reports on what already happened plus two places
 * to decide what happens next. The pathname now says which of the two sections a page belongs to,
 * and every `/training/*` path must answer, including ones that do not exist.
 */
describe('the section a page belongs to (spec 088)', () => {
  it('puts every analysis page in Analiza', () => {
    for (const path of [
      '/training',
      '/training/volume',
      '/training/ride',
      '/training/run',
      '/training/walk'
    ]) {
      expect(trainingSection(path), path).toBe('analysis');
    }
  });

  it('puts the planner and the goals in Plan treningowy', () => {
    expect(trainingSection('/training/plan')).toBe('plan');
    expect(trainingSection('/training/goals')).toBe('plan');
  });

  it('is total — an unknown path falls back to Analiza rather than an empty bar', () => {
    expect(trainingSection('/training/nieznane')).toBe('analysis');
    expect(trainingSection('/training/plan/2026-01')).toBe('analysis');
    expect(trainingSection('')).toBe('analysis');
  });

  it('ignores a trailing slash, which is the one shape that would miss every comparison', () => {
    expect(trainingSection('/training/plan/')).toBe('plan');
    expect(trainingSection('/training/')).toBe('analysis');
  });
});

/**
 * Spec 066 + 088. The planner is offered on the same terms as `Cele`, and for the same reason:
 * neither is a report on training that already happened, so neither can be gated on having any.
 */
describe('the plan tabs (specs 066, 088)', () => {
  it('is the same two tabs for everyone, needing no activity data at all', () => {
    expect(planTabs(t)).toEqual([
      { href: '/training/plan', label: 'Plan' },
      { href: '/training/goals', label: 'Cele' }
    ]);
  });

  it('labels its first tab `Plan`, not the section name over again', () => {
    // `Plan treningowy › Plan treningowy` reads as a breadcrumb that lost a level.
    expect(planTabs(t)[0]!.label).toBe('Plan');
  });

  it('sits before Cele — a week is decided far more often than a season', () => {
    const hrefs = planTabs(t).map((tab) => tab.href);
    expect(hrefs.indexOf('/training/plan')).toBeLessThan(hrefs.indexOf('/training/goals'));
  });

  it('carries no count — a plan is not a tally of what you did', () => {
    for (const tab of planTabs(t)) expect(tab.count).toBeUndefined();
  });

  it('translates, like every other label (spec 088)', () => {
    expect(planTabs(createTranslator('en')).map((tab) => tab.label)).toEqual(['Plan', 'Goals']);
  });
});

describe('the shell title', () => {
  it('names the owning section, then the tab', () => {
    expect(trainingTitle(t, '/training/volume')).toBe('Analiza · Objętość');
    expect(trainingTitle(t, '/training/ride')).toBe('Analiza · Rower');
    expect(trainingTitle(t, '/training/walk')).toBe('Analiza · Marsz');
    expect(trainingTitle(t, '/training/goals')).toBe('Plan treningowy · Cele');
  });

  it('stays bare on each section root, where the tab name would only repeat it', () => {
    expect(trainingTitle(t, '/training')).toBe('Analiza');
    expect(trainingTitle(t, '/training/plan')).toBe('Plan treningowy');
  });

  it('falls back to the section name on a path it does not know', () => {
    expect(trainingTitle(t, '/training/nieznane')).toBe('Analiza');
  });

  it('follows the interface language', () => {
    const en = createTranslator('en');
    expect(trainingTitle(en, '/training/volume')).toBe('Analysis · Volume');
    expect(trainingTitle(en, '/training/goals')).toBe('Training plan · Goals');
  });
});
