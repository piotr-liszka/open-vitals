import { describe, it, expect } from 'vitest';
import { activeNavHref, navGroups, navItems, type NavItem } from './nav';
import { isIconName } from './ui/icons';
import { createTranslator } from './i18n';

const t = createTranslator('pl');
const items = (): NavItem[] => navItems(t);

describe('primary navigation', () => {
  it('groups adjacent items under one heading, leaving Start ungrouped', () => {
    expect(navGroups(t).map((g) => [g.group, g.items.map((i) => i.label)])).toEqual([
      [undefined, ['Start']],
      ['Trening', ['Analiza', 'Plan treningowy', 'Aktywności']],
      ['Zdrowie', ['Wnioski']],
      ['System', ['Dane', 'Ustawienia']]
    ]);
  });

  it('is seven FIXED items', () => {
    // Spec 048 consolidated the nav to seven; spec 064 took the seventh — the single `Panel` entry —
    // out of this list, because dashboards are now user-generated entries injected by the caller.
    // Spec 088 split the training entry in two, so seven is again the whole static nav, and the
    // variable part is asserted in the dashboards module where it is built.
    expect(navGroups(t).flatMap((g) => g.items)).toHaveLength(7);
  });

  it('drops the pages that were folded away', () => {
    const hrefs = items().map((i) => i.href);
    // Analityka merged into Wnioski, the heat map became an activities tab.
    expect(hrefs).not.toContain('/analytics');
    expect(hrefs).not.toContain('/heatmap');
  });

  it('holds no dashboard entry of its own any more (spec 064)', () => {
    // A single `/dashboard` item would now be a seventh way in beside the user's own panels, and it
    // would sit in the wrong group. `navGroups` splices the real ones in below Start instead.
    expect(items().map((i) => i.href)).not.toContain('/dashboard');
  });

  it('splices caller-supplied items in directly after Start, before Trening', () => {
    const injected = [{ href: '/dashboard/x', label: 'X', icon: 'grid' as const, group: 'Panele' }];
    const groups = navGroups(t, injected);
    expect(groups.map((g) => g.group)).toEqual([undefined, 'Panele', 'Trening', 'Zdrowie', 'System']);
  });

  it('is unchanged when the caller supplies none', () => {
    expect(navGroups(t, [])).toEqual(navGroups(t));
  });

  it('lists every destination — nothing is hidden behind a tier any more (spec 071)', () => {
    const hrefs = navGroups(t).flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toEqual([
      '/',
      '/training',
      '/training/plan',
      '/activities',
      '/insights',
      '/data',
      '/settings'
    ]);
  });

  it('never emits a heading with nothing under it', () => {
    for (const group of navGroups(t)) expect(group.items.length).toBeGreaterThan(0);
  });

  it('keeps each group contiguous, so no heading is rendered twice', () => {
    // `navGroups` collapses RUNS of adjacent items; a group split across the list would come back as
    // two entries with the same name, and the nav would show its heading twice. Spec 088 added a
    // third item to `Trening`, which is exactly the change that breaks this if it lands in the
    // wrong place.
    const names = navGroups(t).map((g) => g.group);
    expect(new Set(names).size).toBe(names.length);
  });

  it('reads every label from the catalog, so the sidebar speaks the reader language (spec 088)', () => {
    const en = navGroups(createTranslator('en')).flatMap((g) => g.items.map((i) => i.label));
    expect(en).toContain('Analysis');
    expect(en).toContain('Training plan');
    // A missing key renders as the key itself, which would sail past a "not empty" assertion.
    for (const label of en) expect(label).not.toMatch(/^nav\./);
  });
});

/**
 * Spec 088. `Analiza` (`/training`) and `Plan treningowy` (`/training/plan`) are the first pair of
 * nav entries where one href is a prefix of the other, so "is this active" stopped being answerable
 * one item at a time.
 */
describe('active destination (spec 088)', () => {
  const hrefOn = (path: string): string | undefined =>
    activeNavHref(
      navGroups(t).flatMap((g) => g.items),
      path
    );

  it('picks the longest match, so a subsection does not also light its parent', () => {
    expect(hrefOn('/training/plan')).toBe('/training/plan');
  });

  it('keeps the parent for every path the child does not claim', () => {
    expect(hrefOn('/training')).toBe('/training');
    expect(hrefOn('/training/run')).toBe('/training');
    expect(hrefOn('/training/volume')).toBe('/training');
  });

  it('follows an `owns` claim for a section page outside its prefix', () => {
    // `/training/goals` is the plan section's second tab. Without the claim, longest-match hands it
    // to `/training` and the sidebar says `Analiza` on a page whose tab bar says `Plan · Cele`.
    expect(hrefOn('/training/goals')).toBe('/training/plan');
  });

  it('scores an `owns` claim by its own depth, not the claiming entry`s', () => {
    // A shallow claim must not outrank a genuinely deeper href.
    const items: NavItem[] = [
      { href: '/a/b/c', label: 'deep', icon: 'home' },
      { href: '/z', label: 'shallow', icon: 'home', owns: ['/a'] }
    ];
    expect(activeNavHref(items, '/a/b/c')).toBe('/a/b/c');
    expect(activeNavHref(items, '/a/b')).toBe('/z');
  });

  it('matches a whole segment, never a string prefix of one', () => {
    // `/training/planner` must not be claimed by `/training/plan`.
    expect(hrefOn('/training/planner')).toBe('/training');
  });

  it('marks Start only at the root', () => {
    expect(hrefOn('/')).toBe('/');
    expect(hrefOn('/insights')).toBe('/insights');
    expect(hrefOn('/settings/integrations')).toBe('/settings');
  });

  it('marks nothing on a page outside the nav', () => {
    expect(hrefOn('/login')).toBeUndefined();
  });

  it('does not depend on the order the items arrive in', () => {
    const reversed = [...navGroups(t).flatMap((g) => g.items)].reverse();
    expect(activeNavHref(reversed, '/training/plan')).toBe('/training/plan');
  });
});

/**
 * Spec 063. The sidebar treats "has an icon" as the visual predicate for "is a destination", so an
 * item without one — or with a name the set does not hold — silently reads as a group heading.
 */
describe('nav icons (spec 063)', () => {
  it('gives every item an icon drawn from the shared set', () => {
    for (const item of items()) {
      expect(isIconName(item.icon), `${item.href} has no valid icon`).toBe(true);
    }
  });

  it('never reuses one glyph for two destinations', () => {
    // Load-bearing since spec 088: the collapsed sidebar is icons only, so `Analiza` and
    // `Plan treningowy` sharing a glyph would be two indistinguishable entries there.
    const icons = items().map((i) => i.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });
});
