/**
 * The training section's sub-navigation (spec 025). Pure: it turns the sports a user ACTUALLY has
 * into the tab list, so nobody is shown a "Rower" page they have no rides for. No I/O, no config.
 *
 * `/training` is one section with one nav entry; `Moc` and `Bieg` used to be siblings in the primary
 * nav, which scattered a multi-sport athlete's analysis across three top-level pages.
 */
import { sportGroup, sportGroupLabel, type SportGroup } from '$lib/sport-labels';
import type { SportCount } from '$lib/server/store/types';

/** Sport families that have a dedicated analysis subpage. */
export type PagedSportGroup = 'ride' | 'run' | 'walk';

/** Tab order of the sport subpages. */
export const SPORT_PAGES: readonly PagedSportGroup[] = ['ride', 'run', 'walk'];

/** Polish route segment for each sport subpage — the URL is in the UI language, like the nav. */
export const SPORT_SLUGS: Readonly<Record<PagedSportGroup, string>> = {
  ride: 'rower',
  run: 'bieg',
  walk: 'marsz'
};

export interface TrainingTab {
  readonly href: string;
  readonly label: string;
  /** Activities the user has in this family; omitted for the overview tab. */
  readonly count?: number;
}

const OVERVIEW: TrainingTab = { href: '/training', label: 'Przegląd' };

/**
 * Volume is cross-sport (spec 037), so unlike the per-family tabs it is offered as soon as the
 * athlete has ANY activity at all — a walker with no runs still has months and years to compare.
 */
const VOLUME: TrainingTab = { href: '/training/objetosc', label: 'Objętość' };

/**
 * Season goals (spec 060). Offered UNCONDITIONALLY — unlike every other tab it is not a report on
 * activities the athlete already has, it is where they say what the training is for, and an athlete
 * with an empty account is exactly the one who has a first race to put on the calendar.
 *
 * A new primary-nav entry was the obvious alternative and the wrong one: spec 048 spent a whole spec
 * getting that list down to seven, and goals belong to the training section by every other measure.
 */
const GOALS: TrainingTab = { href: '/training/cele', label: 'Cele' };

/**
 * The planner (spec 066). Unconditional for the same reason as `Cele`: it is not a report on what has
 * already happened, it is where the athlete says what is going to. An empty account is exactly the one
 * with a first session to put on the calendar.
 */
const PLAN: TrainingTab = { href: '/training/plan', label: 'Plan treningowy' };

/** Sum the per-key counts of `listSports()` into per-family counts. */
export function groupCounts(sports: readonly SportCount[]): Map<SportGroup, number> {
  const out = new Map<SportGroup, number>();
  for (const s of sports) {
    const g = sportGroup(s.sport);
    out.set(g, (out.get(g) ?? 0) + s.count);
  }
  return out;
}

/**
 * Overview tab plus one tab per sport family the user has at least one activity in. A user who only
 * runs sees two tabs, not a row of empty pages.
 */
export function trainingTabs(sports: readonly SportCount[]): TrainingTab[] {
  const counts = groupCounts(sports);
  const tabs: TrainingTab[] = [OVERVIEW];
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  if (total > 0) tabs.push(VOLUME);
  for (const group of SPORT_PAGES) {
    const count = counts.get(group) ?? 0;
    if (count === 0) continue;
    tabs.push({ href: `/training/${SPORT_SLUGS[group]}`, label: sportGroupLabel(group), count });
  }
  // Last, because these two are the only tabs that are not an analysis of what has already happened.
  // Plan before Cele: a week is decided far more often than a season is.
  tabs.push(PLAN, GOALS);
  return tabs;
}

/** Section page title for a pathname, used by the shell topbar. */
export function trainingTitle(pathname: string): string {
  const tab = [
    OVERVIEW,
    VOLUME,
    PLAN,
    GOALS,
    ...SPORT_PAGES.map((g) => ({ href: `/training/${SPORT_SLUGS[g]}`, label: sportGroupLabel(g) }))
  ].find((t) => t.href === pathname);
  return tab && tab.href !== '/training' ? `Trening · ${tab.label}` : 'Trening';
}
