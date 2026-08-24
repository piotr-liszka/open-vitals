/**
 * The training section's sub-navigation (spec 025). Pure: it turns the sports a user ACTUALLY has
 * into the tab list, so nobody is shown a "Rower" page they have no rides for. No I/O, no config.
 *
 * Since spec 088 there are TWO sections under `/training`, each with its own tab set and its own
 * sidebar entry:
 *
 *  · **Analiza** (`/training`, `/training/volume`, `/training/ride|run|walk`) — everything that
 *    reports on training that already happened, so every tab in it is gated on having some.
 *  · **Plan treningowy** (`/training/plan`, `/training/goals`) — where the athlete says what happens
 *    next, so neither tab can be gated on anything.
 *
 * They were one bar of seven tabs stating an ordering (the two planning tabs pushed to the end) but
 * not the distinction. No URL moved with the split: the paths are exactly the ones they always were,
 * so bookmarks and the legacy Polish redirects are untouched.
 */
import type { MessageKey, Translator } from '$lib/i18n';
import { sportGroup, sportGroupLabel, type SportGroup } from '$lib/sport-labels';
import type { SportCount } from '$lib/server/store/types';

/** Sport families that have a dedicated analysis subpage. */
export type PagedSportGroup = 'ride' | 'run' | 'walk';

/** Tab order of the sport subpages. */
export const SPORT_PAGES: readonly PagedSportGroup[] = ['ride', 'run', 'walk'];

/**
 * Route segment for each sport subpage. English, and identical to the sport-family key: a URL is an
 * identifier — read by bookmarks, logs, MCP clients and anyone pasting a link — not UI copy, so it
 * does not follow the interface language. The tab LABELS stay Polish; only the path is English.
 *
 * Kept as an explicit map rather than inlining `group` so the one place that decides a URL stays
 * findable, and so a family whose slug ever has to differ from its key has somewhere to say so.
 */
export const SPORT_SLUGS: Readonly<Record<PagedSportGroup, string>> = {
  ride: 'ride',
  run: 'run',
  walk: 'walk'
};

export interface TrainingTab {
  readonly href: string;
  readonly label: string;
  /** Activities the user has in this family; omitted for the overview tab. */
  readonly count?: number;
}

/** Which half of `/training` a page belongs to. */
export type TrainingSection = 'analysis' | 'plan';

/** Landing page of each section — the sidebar entry points here, and the title stays bare on it. */
export const SECTION_ROOT: Readonly<Record<TrainingSection, string>> = {
  analysis: '/training',
  plan: '/training/plan'
};

/**
 * Section names, read from the SAME keys the sidebar entries use (`$lib/nav`): the topbar title and
 * the nav entry naming the same place must not be able to drift into two different words.
 */
const SECTION_NAME: Readonly<Record<TrainingSection, MessageKey>> = {
  analysis: 'nav.analysis',
  plan: 'nav.plan'
};

/** Pages owned by the plan section. Everything else under `/training` is analysis. */
const PLAN_PATHS: readonly string[] = ['/training/plan', '/training/goals'];

const OVERVIEW = (t: Translator): TrainingTab => ({ href: '/training', label: t('training.overview') });

/**
 * Volume is cross-sport (spec 037), so unlike the per-family tabs it is offered as soon as the
 * athlete has ANY activity at all — a walker with no runs still has months and years to compare.
 */
const VOLUME = (t: Translator): TrainingTab => ({ href: '/training/volume', label: t('training.volume') });

/**
 * The planner (spec 066). Labelled `Plan`, not `Plan treningowy`: it is the first tab of the section
 * of that name, and repeating the section's own name as its first tab reads as a broken breadcrumb.
 */
const PLAN = (t: Translator): TrainingTab => ({ href: '/training/plan', label: t('training.tab.plan') });

/**
 * Season goals (spec 060). A new primary-nav entry was the obvious alternative and the wrong one:
 * goals belong to the training section by every other measure, and spec 088 gave that section the
 * second entry this needed anyway.
 */
const GOALS = (t: Translator): TrainingTab => ({ href: '/training/goals', label: t('training.tab.goals') });

/** Trailing slashes are the one shape a pathname arrives in that would miss every comparison. */
function normalize(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

/**
 * Which section owns a pathname. TOTAL by construction: anything that is not a known plan page —
 * including a path under `/training` that does not exist — is analysis, so an unknown URL renders
 * the section's real tab bar rather than an empty one.
 */
export function trainingSection(pathname: string): TrainingSection {
  return PLAN_PATHS.includes(normalize(pathname)) ? 'plan' : 'analysis';
}

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
 * Analiza tabs: overview, cross-sport volume once there is anything at all, then one tab per sport
 * family the user has at least one activity in. A user who only runs sees two tabs, not a row of
 * empty pages.
 */
export function analysisTabs(t: Translator, sports: readonly SportCount[]): TrainingTab[] {
  const counts = groupCounts(sports);
  const tabs: TrainingTab[] = [OVERVIEW(t)];
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  if (total > 0) tabs.push(VOLUME(t));
  for (const group of SPORT_PAGES) {
    const count = counts.get(group) ?? 0;
    if (count === 0) continue;
    tabs.push({ href: `/training/${SPORT_SLUGS[group]}`, label: sportGroupLabel(t, group), count });
  }
  return tabs;
}

/**
 * Plan treningowy tabs. Unconditional, and takes no sport counts: neither tab is a report on
 * activities the athlete already has, and an empty account is exactly the one with a first session
 * and a first race to enter. Plan before Cele — a week is decided far more often than a season.
 */
export function planTabs(t: Translator): TrainingTab[] {
  return [PLAN(t), GOALS(t)];
}

/** Every tab a section can show, counts aside — the lookup the title uses. */
function sectionTabs(t: Translator, section: TrainingSection): TrainingTab[] {
  if (section === 'plan') return planTabs(t);
  return [
    OVERVIEW(t),
    VOLUME(t),
    ...SPORT_PAGES.map((g) => ({ href: `/training/${SPORT_SLUGS[g]}`, label: sportGroupLabel(t, g) }))
  ];
}

/**
 * Section page title for a pathname, used by the shell topbar: `Analiza · Objętość`,
 * `Plan treningowy · Cele`, and the bare section name on each section's own root — where the tab
 * name would only repeat the section name back.
 */
export function trainingTitle(t: Translator, pathname: string): string {
  const section = trainingSection(pathname);
  const path = normalize(pathname);
  const name = t(SECTION_NAME[section]);
  if (path === SECTION_ROOT[section]) return name;
  const tab = sectionTabs(t, section).find((candidate) => candidate.href === path);
  return tab ? t('training.titleWithTab', { section: name, tab: tab.label }) : name;
}
