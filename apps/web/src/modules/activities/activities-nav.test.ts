import { describe, it, expect } from 'vitest';
import { createTranslator } from '$lib/i18n';
import { activitiesTabs, activitiesTitle } from './activities-nav';

const t = createTranslator('pl');

describe('activities section navigation', () => {
  it('offers the list and the map as the section tabs', () => {
    expect([...activitiesTabs(t)]).toEqual([
      { href: '/activities', label: 'Lista' },
      { href: '/activities/map', label: 'Mapa' }
    ]);
  });

  it('titles the section plainly on the list and names the tab on the map', () => {
    expect(activitiesTitle(t, '/activities')).toBe('Aktywności');
    expect(activitiesTitle(t, '/activities/map')).toBe('Aktywności · Mapa');
  });

  it('falls back to the section title for a pathname that is not a tab', () => {
    // Activity detail lives under the same prefix but is not a tab; it must not produce a title with
    // a dangling separator.
    expect(activitiesTitle(t, '/activities/8891234')).toBe('Aktywności');
  });
});
