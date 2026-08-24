import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, navGroups } from './nav';
import { isIconName } from './ui/icons';

describe('primary navigation', () => {
  it('groups adjacent items under one heading, leaving Start ungrouped', () => {
    expect(navGroups().map((g) => [g.group, g.items.map((i) => i.label)])).toEqual([
      [undefined, ['Start']],
      ['Trening', ['Trening', 'Aktywności']],
      ['Zdrowie', ['Wnioski']],
      ['System', ['Dane', 'Ustawienia']]
    ]);
  });

  it('is six FIXED items', () => {
    // Spec 048 consolidated the nav to seven; spec 064 took the seventh — the single `Panel` entry —
    // out of this list, because dashboards are now user-generated entries injected by the caller.
    // Six is therefore the whole static nav, and the variable part is asserted in the dashboards
    // module where it is built.
    expect(navGroups().flatMap((g) => g.items)).toHaveLength(6);
  });

  it('drops the pages that were folded away', () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    // Analityka merged into Wnioski, the heat map became an activities tab.
    expect(hrefs).not.toContain('/analytics');
    expect(hrefs).not.toContain('/heatmap');
  });

  it('holds no dashboard entry of its own any more (spec 064)', () => {
    // A single `/dashboard` item would now be a seventh way in beside the user's own panels, and it
    // would sit in the wrong group. `navGroups` splices the real ones in below Start instead.
    expect(NAV_ITEMS.map((i) => i.href)).not.toContain('/dashboard');
  });

  it('splices caller-supplied items in directly after Start, before Trening', () => {
    const injected = [{ href: '/dashboard/x', label: 'X', icon: 'grid' as const, group: 'Panele' }];
    const groups = navGroups(injected);
    expect(groups.map((g) => g.group)).toEqual([undefined, 'Panele', 'Trening', 'Zdrowie', 'System']);
  });

  it('is unchanged when the caller supplies none', () => {
    expect(navGroups([])).toEqual(navGroups());
  });

  it('lists every destination — nothing is hidden behind a tier any more (spec 071)', () => {
    const hrefs = navGroups().flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toEqual(['/', '/training', '/activities', '/insights', '/data', '/settings']);
  });

  it('never emits a heading with nothing under it', () => {
    for (const group of navGroups()) expect(group.items.length).toBeGreaterThan(0);
  });

  it('keeps each group contiguous, so no heading is rendered twice', () => {
    // `navGroups` collapses RUNS of adjacent items; a group split across the list would come back as
    // two entries with the same name, and the nav would show its heading twice.
    const names = navGroups().map((g) => g.group);
    expect(new Set(names).size).toBe(names.length);
  });
});

/**
 * Spec 063. The sidebar treats "has an icon" as the visual predicate for "is a destination", so an
 * item without one — or with a name the set does not hold — silently reads as a group heading.
 */
describe('nav icons (spec 063)', () => {
  it('gives every item an icon drawn from the shared set', () => {
    for (const item of NAV_ITEMS) {
      expect(isIconName(item.icon), `${item.href} has no valid icon`).toBe(true);
    }
  });

  it('never reuses one glyph for two destinations', () => {
    const icons = NAV_ITEMS.map((i) => i.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });
});
